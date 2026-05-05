from __future__ import annotations

import ssl
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.request import urlretrieve
from urllib.request import HTTPSHandler, build_opener, install_opener

import certifi
import cv2
import numpy as np

from config import MEDIAPIPE_MODEL_PATH, MEDIAPIPE_MODEL_URL


@dataclass
class DetectorConfig:
    backend: str = "auto"
    max_people: int = 5
    shoulder_threshold: float = 0.16
    detection_confidence: float = 0.5
    tracking_confidence: float = 0.5


class PoseDetector:
    def __init__(self, config: DetectorConfig):
        self.config = config
        self.backend = None
        self.pose = None
        self.mp = None
        self.mp_vision = None
        self.openpose = None
        self.previous_centers: dict[int, tuple[int, int]] = {}
        self._bootstrap_backend()

    def _bootstrap_backend(self) -> None:
        requested = self.config.backend.lower()
        if requested in {"auto", "openpose"}:
            if self._try_setup_openpose():
                self.backend = "openpose"
                return
            if requested == "openpose":
                raise RuntimeError(
                    "Se solicito OpenPose, pero el binding de Python no esta disponible."
                )

        if requested in {"auto", "mediapipe"}:
            if self._try_setup_mediapipe():
                self.backend = "mediapipe"
                return
            raise RuntimeError(
                "No fue posible inicializar MediaPipe. Instala las dependencias del proyecto."
            )

        raise ValueError(f"Backend no soportado: {self.config.backend}")

    def _try_setup_openpose(self) -> bool:
        try:
            import pyopenpose as op  # type: ignore
        except Exception:
            return False

        params = {
            "model_folder": "models/",
            "net_resolution": "-1x256",
        }
        wrapper = op.WrapperPython()
        wrapper.configure(params)
        wrapper.start()

        self.openpose = op
        self.pose = wrapper
        return True

    def _try_setup_mediapipe(self) -> bool:
        try:
            import mediapipe as mp
            from mediapipe.tasks.python import vision
            from mediapipe.tasks.python.core.base_options import BaseOptions
            from mediapipe.tasks.python.vision.core.vision_task_running_mode import (
                VisionTaskRunningMode,
            )
        except Exception:
            return False

        model_path = self._ensure_mediapipe_model()
        options = vision.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=VisionTaskRunningMode.VIDEO,
            min_pose_detection_confidence=self.config.detection_confidence,
            min_tracking_confidence=self.config.tracking_confidence,
            num_poses=self.config.max_people,
        )
        self.mp = mp
        self.mp_vision = vision
        self.pose = vision.PoseLandmarker.create_from_options(options)
        return True

    def _ensure_mediapipe_model(self) -> Path:
        model_path = MEDIAPIPE_MODEL_PATH
        model_path.parent.mkdir(parents=True, exist_ok=True)
        if not model_path.exists():
            context = ssl.create_default_context(cafile=certifi.where())
            opener = build_opener(HTTPSHandler(context=context))
            install_opener(opener)
            urlretrieve(MEDIAPIPE_MODEL_URL, model_path)
        return model_path

    def process_frame(
        self,
        frame: np.ndarray,
        timestamp_ms: int = 0,
    ) -> tuple[np.ndarray, list[dict[str, Any]]]:
        if self.backend == "openpose":
            return self._process_frame_openpose(frame)
        return self._process_frame_mediapipe(frame, timestamp_ms)

    def _process_frame_openpose(self, frame: np.ndarray) -> tuple[np.ndarray, list[dict[str, Any]]]:
        datum = self.openpose.Datum()
        datum.cvInputData = frame
        self.pose.emplaceAndPop([datum])

        people = []
        pose_keypoints = getattr(datum, "poseKeypoints", None)
        if pose_keypoints is None:
            return datum.cvOutputData, people

        for person_id, person in enumerate(pose_keypoints[: self.config.max_people]):
            payload = self._build_person_from_openpose(person_id, person)
            if payload is not None:
                people.append(payload)

        return datum.cvOutputData, people

    def _build_person_from_openpose(self, person_id: int, keypoints: Any) -> dict[str, Any] | None:
        left_shoulder = keypoints[5]
        right_shoulder = keypoints[2]
        left_conf = float(left_shoulder[2])
        right_conf = float(right_shoulder[2])
        if left_conf <= 0 or right_conf <= 0:
            return None

        left_xy = [int(left_shoulder[0]), int(left_shoulder[1])]
        right_xy = [int(right_shoulder[0]), int(right_shoulder[1])]
        posture = self.analyze_posture(left_xy, right_xy, frame_width=None)
        return {
            "id": person_id,
            "shoulder_left": left_xy,
            "shoulder_right": right_xy,
            "posture": posture,
            "movement_px": self.compute_movement(person_id, left_xy, right_xy),
        }

    def _process_frame_mediapipe(
        self,
        frame: np.ndarray,
        timestamp_ms: int,
    ) -> tuple[np.ndarray, list[dict[str, Any]]]:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb_frame)
        results = self.pose.detect_for_video(mp_image, timestamp_ms)
        annotated = frame.copy()
        people = []

        if not results.pose_landmarks:
            return annotated, people

        for person_id, landmarks in enumerate(results.pose_landmarks[: self.config.max_people]):
            self._draw_pose_landmarks(annotated, landmarks, frame.shape[1], frame.shape[0])
            person = self._build_person_from_mediapipe(
                person_id,
                landmarks,
                frame.shape[1],
                frame.shape[0],
            )
            if person is not None:
                people.append(person)

        return annotated, people

    def _build_person_from_mediapipe(
        self,
        person_id: int,
        landmarks: list[Any],
        frame_width: int,
        frame_height: int,
    ) -> dict[str, Any] | None:
        left = landmarks[self.mp_vision.PoseLandmark.LEFT_SHOULDER]
        right = landmarks[self.mp_vision.PoseLandmark.RIGHT_SHOULDER]

        if min(left.visibility, right.visibility) < self.config.detection_confidence:
            return None

        left_xy = [int(left.x * frame_width), int(left.y * frame_height)]
        right_xy = [int(right.x * frame_width), int(right.y * frame_height)]
        posture = self.analyze_posture(left_xy, right_xy, frame_width=frame_width)
        return {
            "id": person_id,
            "shoulder_left": left_xy,
            "shoulder_right": right_xy,
            "posture": posture,
            "movement_px": self.compute_movement(person_id, left_xy, right_xy),
        }

    def _draw_pose_landmarks(
        self,
        frame: np.ndarray,
        landmarks: list[Any],
        frame_width: int,
        frame_height: int,
    ) -> None:
        points = []
        for landmark in landmarks:
            points.append((int(landmark.x * frame_width), int(landmark.y * frame_height)))

        for connection in self.mp_vision.PoseLandmarksConnections.POSE_LANDMARKS:
            start = points[connection.start]
            end = points[connection.end]
            cv2.line(frame, start, end, (255, 180, 0), 2)

        for point in points:
            cv2.circle(frame, point, 3, (0, 255, 255), -1)

    def analyze_posture(
        self,
        shoulder_left: list[int],
        shoulder_right: list[int],
        frame_width: int | None,
    ) -> str:
        shoulder_distance = abs(shoulder_right[0] - shoulder_left[0])
        threshold = self.config.shoulder_threshold
        if frame_width:
            threshold = frame_width * self.config.shoulder_threshold
        return "open" if shoulder_distance > threshold else "closed"

    def compute_movement(
        self,
        person_id: int,
        shoulder_left: list[int],
        shoulder_right: list[int],
    ) -> float:
        center = (
            int((shoulder_left[0] + shoulder_right[0]) / 2),
            int((shoulder_left[1] + shoulder_right[1]) / 2),
        )
        previous_center = self.previous_centers.get(person_id)
        self.previous_centers[person_id] = center
        if previous_center is None:
            return 0.0

        delta_x = center[0] - previous_center[0]
        delta_y = center[1] - previous_center[1]
        return round(float(np.hypot(delta_x, delta_y)), 2)
