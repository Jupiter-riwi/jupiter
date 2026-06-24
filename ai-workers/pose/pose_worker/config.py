from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return int(value)


def _get_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return float(value)


@dataclass(frozen=True)
class Settings:
    rabbitmq_host: str
    rabbitmq_port: int
    rabbitmq_user: str
    rabbitmq_pass: str
    rabbitmq_vhost: str
    pose_jobs_queue: str
    features_results_queue: str
    database_url: str
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_endpoint_url: str
    worker_name: str
    segment_seconds: int
    max_video_seconds: int
    max_people: int
    shoulder_open_threshold: float
    detection_confidence: float
    tracking_confidence: float
    eye_contact_yaw_threshold: float
    hand_motion_threshold: float
    target_analysis_fps: float
    face_enabled: bool
    temp_dir: Path
    mediapipe_model_path: Path
    mediapipe_model_url: str
    face_model_path: Path
    face_model_url: str
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        temp_dir = Path(os.getenv("POSE_TEMP_DIR", "/tmp/jupiter-pose"))
        model_path = Path(
            os.getenv(
                "MEDIAPIPE_MODEL_PATH",
                str(temp_dir / "models" / "pose_landmarker_full.task"),
            )
        )
        face_model_path = Path(
            os.getenv(
                "MEDIAPIPE_FACE_MODEL_PATH",
                str(temp_dir / "models" / "face_landmarker.task"),
            )
        )

        return cls(
            rabbitmq_host=os.getenv("RABBITMQ_HOST", "localhost"),
            rabbitmq_port=_get_int("RABBITMQ_PORT", 5672),
            rabbitmq_user=os.getenv("RABBITMQ_USER", "guest"),
            rabbitmq_pass=os.getenv("RABBITMQ_PASS", "guest"),
            rabbitmq_vhost=os.getenv("RABBITMQ_VHOST", "/"),
            pose_jobs_queue=os.getenv("POSE_JOBS_QUEUE", "pose.jobs"),
            features_results_queue=os.getenv("FEATURES_RESULTS_QUEUE", "features.results"),
            database_url=os.getenv("DATABASE_URL", ""),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            s3_endpoint_url=os.getenv("S3_ENDPOINT_URL", ""),
            worker_name=os.getenv("POSE_WORKER_NAME", "pose-worker"),
            segment_seconds=_get_int("POSE_SEGMENT_SECONDS", 5),
            max_video_seconds=_get_int("POSE_MAX_VIDEO_SECONDS", 600),
            max_people=_get_int("POSE_MAX_PEOPLE", 1),
            shoulder_open_threshold=_get_float("POSE_SHOULDER_OPEN_THRESHOLD", 0.16),
            detection_confidence=_get_float("POSE_DETECTION_CONFIDENCE", 0.5),
            tracking_confidence=_get_float("POSE_TRACKING_CONFIDENCE", 0.5),
            eye_contact_yaw_threshold=_get_float("POSE_EYE_CONTACT_YAW_THRESHOLD", 0.35),
            hand_motion_threshold=_get_float("POSE_HAND_MOTION_THRESHOLD", 0.02),
            target_analysis_fps=_get_float("POSE_ANALYSIS_FPS", 8.0),
            face_enabled=os.getenv("POSE_FACE_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"},
            temp_dir=temp_dir,
            mediapipe_model_path=model_path,
            mediapipe_model_url=os.getenv(
                "MEDIAPIPE_MODEL_URL",
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
                "pose_landmarker_full/float16/latest/pose_landmarker_full.task",
            ),
            face_model_path=face_model_path,
            face_model_url=os.getenv(
                "MEDIAPIPE_FACE_MODEL_URL",
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
                "face_landmarker/float16/latest/face_landmarker.task",
            ),
            log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        )
