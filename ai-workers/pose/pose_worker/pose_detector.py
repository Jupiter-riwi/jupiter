from __future__ import annotations

from pose_worker.mediapipe_pose import (
    DetectorConfig,
    InvalidVideoError,
    MediaPipePoseAnalyzer,
    PoseProcessingError,
    VideoTooLongError,
)


class PoseDetector(MediaPipePoseAnalyzer):
    """Compatibilidad con la nomenclatura del detector original."""


__all__ = [
    "DetectorConfig",
    "InvalidVideoError",
    "PoseDetector",
    "PoseProcessingError",
    "VideoTooLongError",
]
