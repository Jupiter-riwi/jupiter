from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return int(raw)


def _get_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return float(raw)


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    rabbitmq_host: str
    rabbitmq_port: int
    rabbitmq_user: str
    rabbitmq_pass: str
    rabbitmq_vhost: str
    whisper_jobs_queue: str
    features_results_queue: str
    database_url: str
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str
    s3_endpoint_url: str
    worker_name: str
    temp_dir: Path
    ffmpeg_bin: str
    ffprobe_bin: str
    audio_format: str
    whisper_max_video_seconds: int
    whisper_chunk_seconds: int
    whisper_parallel_requests: int
    whisper_word_timestamps: bool
    openai_api_key: str
    openai_api_base: str
    whisper_model: str
    whisper_temperature: float
    whisper_language: str | None
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        temp_dir = Path(os.getenv("WHISPER_TEMP_DIR", "/tmp/jupiter-whisper"))
        return cls(
            rabbitmq_host=os.getenv("RABBITMQ_HOST", "localhost"),
            rabbitmq_port=_get_int("RABBITMQ_PORT", 5672),
            rabbitmq_user=os.getenv("RABBITMQ_USER", "guest"),
            rabbitmq_pass=os.getenv("RABBITMQ_PASS", "guest"),
            rabbitmq_vhost=os.getenv("RABBITMQ_VHOST", "/"),
            whisper_jobs_queue=os.getenv("WHISPER_JOBS_QUEUE", "whisper.jobs"),
            features_results_queue=os.getenv("FEATURES_RESULTS_QUEUE", "features.results"),
            database_url=os.getenv("DATABASE_URL", ""),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID", ""),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            s3_endpoint_url=os.getenv("S3_ENDPOINT_URL", ""),
            worker_name=os.getenv("WHISPER_WORKER_NAME", "whisper-worker"),
            temp_dir=temp_dir,
            ffmpeg_bin=os.getenv("FFMPEG_BIN", "ffmpeg"),
            ffprobe_bin=os.getenv("FFPROBE_BIN", "ffprobe"),
            audio_format=os.getenv("WHISPER_AUDIO_FORMAT", "wav"),
            whisper_max_video_seconds=_get_int("WHISPER_MAX_VIDEO_SECONDS", 480),
            whisper_chunk_seconds=_get_int("WHISPER_CHUNK_SECONDS", 120),
            whisper_parallel_requests=_get_int("WHISPER_PARALLEL_REQUESTS", 2),
            whisper_word_timestamps=_get_bool("WHISPER_WORD_TIMESTAMPS", False),
            openai_api_key=os.getenv("OPENAI_API_KEY", ""),
            openai_api_base=os.getenv("OPENAI_API_BASE", ""),
            whisper_model=os.getenv("WHISPER_MODEL", "whisper-1"),
            whisper_temperature=_get_float("WHISPER_TEMPERATURE", 0.0),
            whisper_language=os.getenv("WHISPER_LANGUAGE"),
            log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
        )
