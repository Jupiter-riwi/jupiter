from __future__ import annotations

from pathlib import Path

from whisper_worker.config import Settings
from whisper_worker.contracts import WhisperJob
from whisper_worker.storage import DownloadError
from whisper_worker.worker import SilentAudioError, WhisperWorker


def _make_settings() -> Settings:
    return Settings(
        rabbitmq_host="localhost",
        rabbitmq_port=5672,
        rabbitmq_user="guest",
        rabbitmq_pass="guest",
        rabbitmq_vhost="/",
        whisper_jobs_queue="whisper.jobs",
        features_results_queue="features.results",
        database_url="postgresql://user:pass@localhost:5432/db",
        aws_access_key_id="",
        aws_secret_access_key="",
        aws_region="us-east-1",
        s3_endpoint_url="",
        worker_name="whisper-worker",
        temp_dir=Path("/tmp"),
        ffmpeg_bin="ffmpeg",
        audio_format="wav",
        openai_api_key="key",
        openai_api_base="",
        whisper_model="whisper-1",
        whisper_temperature=0.0,
        whisper_language=None,
        log_level="INFO",
    )


def _make_worker_stub() -> WhisperWorker:
    worker = object.__new__(WhisperWorker)
    worker.settings = _make_settings()
    return worker


def test_build_payload_counts_words() -> None:
    worker = _make_worker_stub()
    job = WhisperJob(
        job_id="job-123",
        evaluation_id="eval-123",
        tenant_id="tenant-123",
        video_url="file:///tmp/video.mp4",
        options={},
    )

    transcript = {
        "text": "hello world",
        "language": "en",
        "duration": 12.3,
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 5.0,
                "text": "hello",
                "words": [
                    {"word": "hello", "start": 0.0, "end": 0.5},
                ],
            },
            {
                "id": 1,
                "start": 5.0,
                "end": 10.0,
                "text": "world",
                "words": [
                    {"word": "world", "start": 5.0, "end": 5.6},
                    {"word": "again", "start": 5.6, "end": 6.0},
                ],
            },
        ],
    }

    payload = worker._build_payload(job, transcript)

    assert payload["summary"]["segments_count"] == 2
    assert payload["summary"]["words_total"] == 3
    assert payload["evaluation_id"] == "eval-123"


def test_map_error_translates_download_error() -> None:
    worker = _make_worker_stub()
    code, message = worker._map_error(DownloadError("not found"))
    assert code == "VIDEO_DOWNLOAD_ERROR"
    assert message == "not found"


def test_map_error_translates_silent_audio() -> None:
    worker = _make_worker_stub()
    code, message = worker._map_error(SilentAudioError("empty"))
    assert code == "AUDIO_SILENT"
    assert message == "empty"
