"""Facial expression analysis via MediaPipe FaceLandmarker (blendshapes + head pose).

Runs alongside the pose analyzer. Per frame it produces:
  - smile, brow movement, eye openness, mouth/jaw open (talking) from 52 blendshapes
  - head yaw/pitch/roll (degrees) from the facial transformation matrix — a far more
    accurate "looking at camera" signal than the pose-landmark nose geometry.

Gracefully degrades: if the model can't load or no face is detected, returns None and
the pose pipeline keeps working with its landmark-based head estimate.
"""

from __future__ import annotations

import math
import ssl
from dataclasses import dataclass
from pathlib import Path
from urllib.request import HTTPSHandler, build_opener, install_opener, urlretrieve

import certifi


@dataclass(frozen=True)
class FaceSignal:
    smile: float          # 0..1
    brow_raise: float     # 0..1 (surprise/emphasis)
    eye_open: float       # 0..1 (1 = wide open, 0 = closed)
    jaw_open: float       # 0..1 (talking / mouth movement)
    frown: float          # 0..1
    head_yaw_deg: float
    head_pitch_deg: float
    head_roll_deg: float
    expressiveness: float  # overall facial activity 0..1


# blendshape category names we read (ARKit-style, 52 total)
_SMILE = ("mouthSmileLeft", "mouthSmileRight")
_FROWN = ("mouthFrownLeft", "mouthFrownRight")
_BROW = ("browInnerUp", "browOuterUpLeft", "browOuterUpRight")
_BLINK = ("eyeBlinkLeft", "eyeBlinkRight")
_JAW = ("jawOpen",)


def _avg(d: dict, keys) -> float:
    vals = [d.get(k, 0.0) for k in keys]
    return float(sum(vals) / len(vals)) if vals else 0.0


def _euler_from_matrix(m) -> tuple[float, float, float]:
    """Yaw, pitch, roll (degrees) from a 4x4 facial transformation matrix."""
    # rotation is the upper-left 3x3
    r00, r01, r02 = m[0][0], m[0][1], m[0][2]
    r10, r11, r12 = m[1][0], m[1][1], m[1][2]
    r20, r21, r22 = m[2][0], m[2][1], m[2][2]
    sy = math.sqrt(r00 * r00 + r10 * r10)
    if sy > 1e-6:
        pitch = math.atan2(-r20, sy)
        yaw = math.atan2(r10, r00)
        roll = math.atan2(r21, r22)
    else:  # gimbal lock
        pitch = math.atan2(-r20, sy)
        yaw = 0.0
        roll = math.atan2(-r12, r11)
    return math.degrees(yaw), math.degrees(pitch), math.degrees(roll)


class FaceAnalyzer:
    """Wraps a MediaPipe FaceLandmarker in VIDEO mode with blendshapes + transform matrix."""

    def __init__(self, *, model_path: Path, model_url: str, detection_confidence: float, tracking_confidence: float) -> None:
        import mediapipe as mp  # noqa: F401  (validates availability)
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.core.base_options import BaseOptions
        from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode

        self._vision = vision
        self._base_options_cls = BaseOptions
        self._video_mode = VisionTaskRunningMode.VIDEO
        self._model_path = self._ensure_model(model_path, model_url)
        self._opts = lambda: vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(self._model_path)),
            running_mode=VisionTaskRunningMode.VIDEO,
            num_faces=1,
            min_face_detection_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
        )
        self._face = vision.FaceLandmarker.create_from_options(self._opts())

    @staticmethod
    def _ensure_model(model_path: Path, model_url: str) -> Path:
        model_path.parent.mkdir(parents=True, exist_ok=True)
        if model_path.exists():
            return model_path
        ctx = ssl.create_default_context(cafile=certifi.where())
        install_opener(build_opener(HTTPSHandler(context=ctx)))
        urlretrieve(model_url, model_path)
        return model_path

    def reset(self) -> None:
        """Recreate the detector so VIDEO timestamps restart at 0 for a new video."""
        self._face = self._vision.FaceLandmarker.create_from_options(self._opts())

    def close(self) -> None:
        fn = getattr(self._face, "close", None)
        if callable(fn):
            fn()

    def detect(self, mp_image, timestamp_ms: int) -> FaceSignal | None:
        try:
            res = self._face.detect_for_video(mp_image, timestamp_ms)
        except Exception:
            return None
        if not res.face_blendshapes:
            return None

        cats = {c.category_name: float(c.score) for c in res.face_blendshapes[0]}
        smile = _avg(cats, _SMILE)
        frown = _avg(cats, _FROWN)
        brow = min(1.0, _avg(cats, _BROW))
        blink = _avg(cats, _BLINK)
        eye_open = max(0.0, 1.0 - blink)
        jaw = _avg(cats, _JAW)

        yaw = pitch = roll = 0.0
        mats = getattr(res, "facial_transformation_matrixes", None)
        if mats:
            try:
                yaw, pitch, roll = _euler_from_matrix(mats[0])
            except Exception:
                yaw = pitch = roll = 0.0

        # expressiveness: how much the face moves away from a neutral resting state
        expressiveness = min(1.0, smile + brow + jaw * 0.5 + frown)

        return FaceSignal(
            smile=smile, brow_raise=brow, eye_open=eye_open, jaw_open=jaw, frown=frown,
            head_yaw_deg=yaw, head_pitch_deg=pitch, head_roll_deg=roll,
            expressiveness=expressiveness,
        )
