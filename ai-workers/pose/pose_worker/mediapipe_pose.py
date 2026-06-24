from __future__ import annotations

import logging
import math
import ssl
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.request import HTTPSHandler, build_opener, install_opener, urlretrieve

import certifi
import cv2

from pose_worker.config import Settings
from pose_worker.face_expression import FaceAnalyzer, FaceSignal
from pose_worker.feature_extraction import FrameSignal, PoseFeatureExtractor

logger = logging.getLogger("pose_worker.mediapipe")


class PoseProcessingError(RuntimeError):
    """Error base del procesamiento de pose."""


class VideoTooLongError(PoseProcessingError):
    """El video excede la duracion maxima configurada."""


class InvalidVideoError(PoseProcessingError):
    """No se pudo abrir o leer el video."""


# MediaPipe Pose landmark indices (33-point model)
NOSE = 0
L_EYE, R_EYE = 2, 5
L_EAR, R_EAR = 7, 8
L_SHOULDER, R_SHOULDER = 11, 12
L_ELBOW, R_ELBOW = 13, 14
L_WRIST, R_WRIST = 15, 16
L_HIP, R_HIP = 23, 24


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
    target_analysis_fps: float
    face_enabled: bool
    model_path: Path
    model_url: str
    face_model_path: Path
    face_model_url: str

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
            target_analysis_fps=settings.target_analysis_fps,
            face_enabled=settings.face_enabled,
            model_path=settings.mediapipe_model_path,
            model_url=settings.mediapipe_model_url,
            face_model_path=settings.face_model_path,
            face_model_url=settings.face_model_url,
        )


def _vis(landmark: Any) -> float:
    return float(getattr(landmark, "visibility", 1.0) or 0.0)


class MediaPipePoseAnalyzer:
    def __init__(self, config: DetectorConfig):
        self.config = config
        self._prev_left_wrist: tuple[float, float] | None = None
        self._prev_right_wrist: tuple[float, float] | None = None

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
        self._base_options_cls = BaseOptions
        self._video_mode = VisionTaskRunningMode.VIDEO
        self._pose = vision.PoseLandmarker.create_from_options(options)

        # Facial expression analyzer (optional / best-effort).
        self._face: FaceAnalyzer | None = None
        if config.face_enabled:
            try:
                self._face = FaceAnalyzer(
                    model_path=config.face_model_path,
                    model_url=config.face_model_url,
                    detection_confidence=config.detection_confidence,
                    tracking_confidence=config.tracking_confidence,
                )
            except Exception as exc:  # pragma: no cover
                logger.warning("FaceLandmarker no disponible, sigo solo con pose: %s", exc)
                self._face = None

    @staticmethod
    def _ensure_model(model_path: Path, model_url: str) -> Path:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        if model_path.exists():
            return model_path
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        install_opener(build_opener(HTTPSHandler(context=ssl_context)))
        urlretrieve(model_url, model_path)
        return model_path

    def close(self) -> None:
        for obj in (self._pose, self._face):
            fn = getattr(obj, "close", None)
            if callable(fn):
                fn()

    def process_video(self, video_path: Path, *, segment_seconds: int | None = None) -> dict[str, Any]:
        # Reset detectors so VIDEO timestamps restart at 0 for each video.
        options = self._vision.PoseLandmarkerOptions(
            base_options=self._base_options_cls(model_asset_path=str(self.config.model_path)),
            running_mode=self._video_mode,
            min_pose_detection_confidence=self.config.detection_confidence,
            min_tracking_confidence=self.config.tracking_confidence,
            num_poses=self.config.max_people,
        )
        self._pose = self._vision.PoseLandmarker.create_from_options(options)
        if self._face is not None:
            try:
                self._face.reset()
            except Exception:
                self._face = None

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

        # Subsample to ~target_analysis_fps to keep pose+face affordable on long clips.
        step = max(1, round(fps / max(1.0, self.config.target_analysis_fps)))
        analysis_fps = fps / step

        actual_segment_seconds = segment_seconds or self.config.default_segment_seconds
        extractor = PoseFeatureExtractor(
            segment_seconds=actual_segment_seconds,
            fps=analysis_fps,
            shoulder_open_threshold=self.config.shoulder_open_threshold,
            hand_motion_threshold=self.config.hand_motion_threshold,
        )

        self._prev_left_wrist = None
        self._prev_right_wrist = None
        frame_index = 0
        processed = 0
        try:
            while True:
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_index % step != 0:
                    frame_index += 1
                    continue

                if width <= 0 or height <= 0:
                    height, width = frame.shape[:2]

                second = frame_index / fps
                timestamp_ms = int(second * 1000)
                signal = self._extract_signal(frame, timestamp_ms=timestamp_ms)
                extractor.add_frame(second, signal)
                processed += 1
                frame_index += 1

                if second > self.config.max_video_seconds:
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
                "analysis_fps": analysis_fps,
                "frame_count": frame_count_from_meta if frame_count_from_meta > 0 else frame_index,
                "processed_frames": processed,
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

        face_signal: FaceSignal | None = None
        if self._face is not None:
            face_signal = self._face.detect(mp_image, timestamp_ms)

        return self._signal_from_landmarks(results.pose_landmarks[0], face_signal)

    def _signal_from_landmarks(self, lm: list[Any], face: FaceSignal | None) -> FrameSignal | None:
        conf = self.config.detection_confidence
        l_sh, r_sh = lm[L_SHOULDER], lm[R_SHOULDER]
        # Shoulders are the anchor — without them we can't normalize anything.
        if _vis(l_sh) < conf or _vis(r_sh) < conf:
            return None

        sh_cx = (l_sh.x + r_sh.x) / 2.0
        sh_cy = (l_sh.y + r_sh.y) / 2.0
        shoulder_width = max(abs(r_sh.x - l_sh.x), 1e-6)

        # torso height (fall back to a shoulder-width multiple if hips are not visible)
        l_hip, r_hip = lm[L_HIP], lm[R_HIP]
        hips_ok = _vis(l_hip) >= conf and _vis(r_hip) >= conf
        if hips_ok:
            hip_cx = (l_hip.x + r_hip.x) / 2.0
            hip_cy = (l_hip.y + r_hip.y) / 2.0
            torso_h = max(abs(hip_cy - sh_cy), 1e-6)
        else:
            hip_cx, hip_cy = sh_cx, sh_cy + shoulder_width * 1.5
            torso_h = max(shoulder_width * 1.5, 1e-6)

        shoulder_tilt = math.degrees(math.atan2(l_sh.y - r_sh.y, (l_sh.x - r_sh.x) or 1e-6))
        lean_deg = math.degrees(math.atan2(hip_cx - sh_cx, torso_h))

        # ── posture openness: lateral spread of elbows/wrists beyond the shoulders ──
        spreads: list[float] = []
        for idx in (L_ELBOW, R_ELBOW, L_WRIST, R_WRIST):
            p = lm[idx]
            if _vis(p) >= conf:
                spreads.append(abs(p.x - sh_cx) / shoulder_width)
        posture_open = (sum(spreads) / len(spreads)) if spreads else 0.0

        # ── arms crossed: wrists swapped to the opposite side, around chest height ──
        arms_crossed = 0.0
        lw, rw = lm[L_WRIST], lm[R_WRIST]
        if _vis(lw) >= conf and _vis(rw) >= conf:
            crossed_x = (lw.x < rw.x) if (l_sh.x > r_sh.x) else (lw.x > rw.x)
            chest_band = (sh_cy + 0.05 * torso_h) < ((lw.y + rw.y) / 2.0) < (sh_cy + 0.7 * torso_h)
            close_together = abs(lw.x - rw.x) < shoulder_width * 0.9
            if crossed_x and chest_band and close_together:
                arms_crossed = 1.0

        # ── slouch: head sinks toward the shoulders (short neck) ──
        l_ear, r_ear = lm[L_EAR], lm[R_EAR]
        ears = [e for e in (l_ear, r_ear) if _vis(e) >= conf]
        if ears:
            ear_cy = sum(e.y for e in ears) / len(ears)
            neck_ratio = (sh_cy - ear_cy) / torso_h
            slouch = max(0.0, min(1.0, (0.32 - neck_ratio) / 0.32))
        else:
            slouch = 0.0

        # ── head yaw/pitch: prefer the face transform matrix, else landmark geometry ──
        if face is not None:
            head_yaw = face.head_yaw_deg
            head_pitch = face.head_pitch_deg
        else:
            ear_cx = (sum(e.x for e in ears) / len(ears)) if ears else sh_cx
            ear_span = (abs(l_ear.x - r_ear.x) if len(ears) == 2 else shoulder_width) or 1e-6
            nose = lm[NOSE]
            head_yaw = ((nose.x - ear_cx) / (ear_span / 2.0)) * 45.0 if _vis(nose) >= conf else 0.0
            eye_cy = (lm[L_EYE].y + lm[R_EYE].y) / 2.0 if (_vis(lm[L_EYE]) >= conf and _vis(lm[R_EYE]) >= conf) else sh_cy
            head_pitch = ((lm[NOSE].y - eye_cy) / (torso_h)) * 90.0 if _vis(lm[NOSE]) >= conf else 0.0

        looking = 1.0 if (abs(head_yaw) <= 20.0 and abs(head_pitch) <= 18.0) else 0.0

        # ── gestures: per-hand motion (fixes two-handed cancellation) ──
        left_motion = self._hand_motion(lm[L_WRIST], conf, torso_h, "left")
        right_motion = self._hand_motion(lm[R_WRIST], conf, torso_h, "right")
        amps = []
        for idx in (L_WRIST, R_WRIST):
            w = lm[idx]
            if _vis(w) >= conf:
                amps.append(math.hypot(w.x - sh_cx, w.y - sh_cy) / torso_h)
        gesture_amp = max(amps) if amps else 0.0
        hands_visible = float(sum(1 for idx in (L_WRIST, R_WRIST) if _vis(lm[idx]) >= conf))

        landmarks_vector = self._landmark_vector(lm, conf, sh_cx, sh_cy)

        return FrameSignal(
            posture_open=float(posture_open),
            slouch=float(slouch),
            lean_deg=float(lean_deg),
            shoulder_tilt_deg=float(shoulder_tilt),
            arms_crossed=float(arms_crossed),
            head_yaw_deg=float(head_yaw),
            head_pitch_deg=float(head_pitch),
            looking_at_camera=float(looking),
            left_hand_motion=float(left_motion),
            right_hand_motion=float(right_motion),
            gesture_amplitude=float(gesture_amp),
            hands_visible=hands_visible,
            face_detected=1.0 if face is not None else 0.0,
            smile=float(face.smile) if face else 0.0,
            brow_raise=float(face.brow_raise) if face else 0.0,
            eye_open=float(face.eye_open) if face else 0.0,
            jaw_open=float(face.jaw_open) if face else 0.0,
            expressiveness=float(face.expressiveness) if face else 0.0,
            landmarks_vector=landmarks_vector,
        )

    def _hand_motion(self, wrist: Any, conf: float, torso_h: float, side: str) -> float:
        prev_attr = "_prev_left_wrist" if side == "left" else "_prev_right_wrist"
        if _vis(wrist) < conf:
            setattr(self, prev_attr, None)
            return 0.0
        cur = (wrist.x, wrist.y)
        prev = getattr(self, prev_attr)
        motion = 0.0 if prev is None else math.hypot(cur[0] - prev[0], cur[1] - prev[1]) / torso_h
        setattr(self, prev_attr, cur)
        return motion

    @staticmethod
    def _landmark_vector(lm: list[Any], conf: float, sh_cx: float, sh_cy: float) -> list[float]:
        # fixed-length vector for variability; missing points fall back to shoulder center
        out: list[float] = []
        for idx in (NOSE, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_WRIST, R_WRIST, L_ELBOW, R_ELBOW):
            p = lm[idx]
            if _vis(p) >= conf:
                out.extend([float(p.x), float(p.y)])
            else:
                out.extend([sh_cx, sh_cy])
        return out
