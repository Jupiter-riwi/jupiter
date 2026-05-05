from __future__ import annotations

import math
import ssl
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.request import HTTPSHandler, build_opener, install_opener, urlretrieve

import certifi
import cv2

from pose_worker.config import Settings
from pose_worker.feature_extraction import FrameSignal, PoseFeatureExtractor


class PoseProcessingError(RuntimeError):
    """Error base del procesamiento de pose."""


class VideoTooLongError(PoseProcessingError):
    """El video excede la duracion maxima configurada."""


class InvalidVideoError(PoseProcessingError):
    """No se pudo abrir o leer el video."""


@dataclass(frozen=True)
class DetectorConfig:
    max_video_seconds: int
    max_people: int
    shoulder_open_threshold: float
    detection_confidence: float
    tracking_confidence: float
    eye_contact_yaw_threshold: float
    hand_motion_threshold: float
    default_segment_seconds: int
    model_path: Path
    model_url: str

    @classmethod
    def from_settings(cls, settings: Settings) -> "DetectorConfig":
        return cls(
            max_video_seconds=settings.max_video_seconds,
            max_people=settings.max_people,
            shoulder_open_threshold=settings.shoulder_open_threshold,
            detection_confidence=settings.detection_confidence,
            tracking_confidence=settings.tracking_confidence,
            eye_contact_yaw_threshold=settings.eye_contact_yaw_threshold,
            hand_motion_threshold=settings.hand_motion_threshold,
            default_segment_seconds=settings.segment_seconds,
            model_path=settings.mediapipe_model_path,
            model_url=settings.mediapipe_model_url,
        )


class MediaPipePoseAnalyzer:
    def __init__(self, config: DetectorConfig):
        self.config = config
        self._previous_wrist_center: tuple[float, float] | None = None

        try:
            import mediapipe as mp
            from mediapipe.tasks.python import vision
            from mediapipe.tasks.python.core.base_options import BaseOptions
            from mediapipe.tasks.python.vision.core.vision_task_running_mode import (
                VisionTaskRunningMode,
            )
        except Exception as exc:  # pragma: no cover - depende del entorno.
            raise PoseProcessingError(
                "No se pudo importar MediaPipe. Instala las dependencias del worker de pose."
            ) from exc

        model_path = self._ensure_model(config.model_path, config.model_url)
        options = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=VisionTaskRunningMode.VIDEO,
            min_pose_detection_confidence=config.detection_confidence,
            min_tracking_confidence=config.tracking_confidence,
            num_poses=config.max_people,
        )

        self._mp = mp
        self._vision = vision
        self._pose = vision.PoseLandmarker.create_from_options(options)

    @staticmethod
    def _ensure_model(model_path: Path, model_url: str) -> Path:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        if model_path.exists():
            return model_path

        ssl_context = ssl.create_default_context(cafile=certifi.where())
        opener = build_opener(HTTPSHandler(context=ssl_context))
        install_opener(opener)
        urlretrieve(model_url, model_path)
        return model_path

    def close(self) -> None:
        close_fn = getattr(self._pose, "close", None)
        if callable(close_fn):
            close_fn()

    def process_video(self, video_path: Path, *, segment_seconds: int | None = None) -> dict[str, Any]:
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            raise InvalidVideoError(f"No se pudo abrir el video: {video_path}")

        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
        if fps <= 0.0 or fps > 240.0:
            fps = 30.0

        frame_count_from_meta = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_count_from_meta > 0:
            duration_from_meta = frame_count_from_meta / fps
            if duration_from_meta > self.config.max_video_seconds:
                raise VideoTooLongError(
                    f"Duracion {duration_from_meta:.2f}s excede maximo de {self.config.max_video_seconds}s"
                )

        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

        actual_segment_seconds = segment_seconds or self.config.default_segment_seconds
        extractor = PoseFeatureExtractor(
            segment_seconds=actual_segment_seconds,
            fps=fps,
            shoulder_open_threshold=self.config.shoulder_open_threshold,
            hand_motion_threshold=self.config.hand_motion_threshold,
        )

        self._previous_wrist_center = None
        frame_index = 0
        try:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break

                if width <= 0 or height <= 0:
                    height, width = frame.shape[:2]

                timestamp_ms = int((frame_index / fps) * 1000)
                signal = self._extract_signal(frame, timestamp_ms=timestamp_ms)
                extractor.add_frame(frame_index, signal)
                frame_index += 1

                if (frame_index / fps) > self.config.max_video_seconds:
                    raise VideoTooLongError(
                        f"Duracion procesada excede {self.config.max_video_seconds}s"
                    )
        finally:
            capture.release()

        if frame_index == 0:
            raise InvalidVideoError("Video vacio o corrupto: no se pudieron leer frames")

        duration_seconds = frame_index / fps
        if duration_seconds > self.config.max_video_seconds:
            raise VideoTooLongError(
                f"Duracion {duration_seconds:.2f}s excede maximo de {self.config.max_video_seconds}s"
            )

        return extractor.build_payload(
            {
                "fps": fps,
                "frame_count": frame_count_from_meta if frame_count_from_meta > 0 else frame_index,
                "processed_frames": frame_index,
                "duration_seconds": duration_seconds,
                "width": width,
                "height": height,
            }
        )

    def _extract_signal(self, frame: Any, *, timestamp_ms: int) -> FrameSignal | None:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb_frame)
        results = self._pose.detect_for_video(mp_image, timestamp_ms)

        if not results.pose_landmarks:
            return None

        landmarks = results.pose_landmarks[0]
        return self._signal_from_landmarks(landmarks)

    def _signal_from_landmarks(self, landmarks: list[Any]) -> FrameSignal | None:
        point = self._vision.PoseLandmark
        left_shoulder = landmarks[point.LEFT_SHOULDER]
        right_shoulder = landmarks[point.RIGHT_SHOULDER]
        left_hip = landmarks[point.LEFT_HIP]
        right_hip = landmarks[point.RIGHT_HIP]
        nose = landmarks[point.NOSE]

        min_visibility = min(
            left_shoulder.visibility,
            right_shoulder.visibility,
            left_hip.visibility,
            right_hip.visibility,
            nose.visibility,
        )

        if min_visibility < self.config.detection_confidence:
            return None

        shoulder_center_x = (left_shoulder.x + right_shoulder.x) / 2.0
        shoulder_center_y = (left_shoulder.y + right_shoulder.y) / 2.0
        hip_center_x = (left_hip.x + right_hip.x) / 2.0
        hip_center_y = (left_hip.y + right_hip.y) / 2.0

        shoulder_dx = right_shoulder.x - left_shoulder.x
        shoulder_dy = right_shoulder.y - left_shoulder.y
        shoulder_width = max(abs(shoulder_dx), 1e-6)
        torso_height = max(abs(hip_center_y - shoulder_center_y), 1e-6)

        posture_opening = shoulder_width
        shoulder_tilt_deg = math.degrees(math.atan2(shoulder_dy, shoulder_dx))

        torso_dx = hip_center_x - shoulder_center_x
        torso_dy = max(hip_center_y - shoulder_center_y, 1e-6)
        torso_tilt_deg = math.degrees(math.atan2(torso_dx, torso_dy))

        wrist_center = self._wrist_center(landmarks)
        if wrist_center is None:
            hand_motion = 0.0
            hand_amplitude = 0.0
        else:
            hand_amplitude = self._distance(
                wrist_center,
                (shoulder_center_x, shoulder_center_y),
            ) / torso_height

            if self._previous_wrist_center is None:
                hand_motion = 0.0
            else:
                hand_motion = self._distance(wrist_center, self._previous_wrist_center) / torso_height

            self._previous_wrist_center = wrist_center

        head_yaw = (nose.x - shoulder_center_x) / shoulder_width
        head_pitch = (nose.y - shoulder_center_y) / torso_height
        eye_contact = 1.0 if abs(head_yaw) <= self.config.eye_contact_yaw_threshold else 0.0

        landmarks_vector = [
            nose.x,
            nose.y,
            left_shoulder.x,
            left_shoulder.y,
            right_shoulder.x,
            right_shoulder.y,
            left_hip.x,
            left_hip.y,
            right_hip.x,
            right_hip.y,
        ]

        if wrist_center is None:
            landmarks_vector.extend([shoulder_center_x, shoulder_center_y])
        else:
            landmarks_vector.extend([wrist_center[0], wrist_center[1]])

        return FrameSignal(
            posture_opening=float(posture_opening),
            shoulder_tilt_deg=float(shoulder_tilt_deg),
            torso_tilt_deg=float(torso_tilt_deg),
            hand_motion=float(hand_motion),
            hand_amplitude=float(hand_amplitude),
            eye_contact=float(eye_contact),
            head_yaw=float(head_yaw),
            head_pitch=float(head_pitch),
            landmarks_vector=[float(value) for value in landmarks_vector],
        )

    def _wrist_center(self, landmarks: list[Any]) -> tuple[float, float] | None:
        point = self._vision.PoseLandmark
        wrists = []

        left_wrist = landmarks[point.LEFT_WRIST]
        if left_wrist.visibility >= self.config.detection_confidence:
            wrists.append((left_wrist.x, left_wrist.y))

        right_wrist = landmarks[point.RIGHT_WRIST]
        if right_wrist.visibility >= self.config.detection_confidence:
            wrists.append((right_wrist.x, right_wrist.y))

        if not wrists:
            return None

        mean_x = sum(item[0] for item in wrists) / len(wrists)
        mean_y = sum(item[1] for item in wrists) / len(wrists)
        return float(mean_x), float(mean_y)

    @staticmethod
    def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
        return math.hypot(a[0] - b[0], a[1] - b[1])
