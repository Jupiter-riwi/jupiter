from __future__ import annotations

from pathlib import Path

from whisper_worker.audio import AudioChunk
from whisper_worker.config import Settings
from whisper_worker.contracts import WhisperJob
from whisper_worker.storage import DownloadError
from whisper_worker.worker import SilentAudioError, VideoTooLongError, WhisperWorker


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
        ffprobe_bin="ffprobe",
        audio_format="wav",
        whisper_max_video_seconds=600,
        whisper_chunk_seconds=120,
        whisper_parallel_requests=2,
        whisper_word_timestamps=False,
        groq_api_key="key",
        groq_api_base="",
        whisper_model="whisper-large-v3",
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


def test_build_payload_estimates_words_when_missing_words() -> None:
    worker = _make_worker_stub()
    job = WhisperJob(
        job_id="job-xyz",
        evaluation_id="eval-xyz",
        tenant_id="tenant-xyz",
        video_url="file:///tmp/video.mp4",
        options={},
    )

    transcript = {
        "text": "hola mundo desde whisper",
        "language": "es",
        "duration": 5.0,
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 5.0,
                "text": "hola mundo desde whisper",
                "words": [],
            }
        ],
    }

    payload = worker._build_payload(job, transcript)
    assert payload["summary"]["words_total"] == 4


def test_merge_chunk_transcripts_offsets_segments() -> None:
    worker = _make_worker_stub()
    chunks = [
        AudioChunk(index=0, start_sec=0.0, end_sec=30.0, path=Path("/tmp/a0.wav")),
        AudioChunk(index=1, start_sec=30.0, end_sec=60.0, path=Path("/tmp/a1.wav")),
    ]
    results = {
        0: {
            "text": "hola",
            "language": "es",
            "segments": [
                {"id": 0, "start": 1.0, "end": 3.0, "text": "hola", "words": []},
            ],
        },
        1: {
            "text": "mundo",
            "language": "es",
            "segments": [
                {"id": 0, "start": 2.0, "end": 5.0, "text": "mundo", "words": []},
            ],
        },
    }

    merged = worker._merge_chunk_transcripts(
        chunks,
        results=results,
        duration_seconds=60.0,
    )

    assert merged["text"] == "hola mundo"
    assert len(merged["segments"]) == 2
    assert merged["segments"][0]["start"] == 1.0
    assert merged["segments"][1]["start"] == 32.0


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


def test_map_error_translates_video_too_long() -> None:
    worker = _make_worker_stub()
    code, message = worker._map_error(VideoTooLongError("too long"))
    assert code == "VIDEO_TOO_LONG"
    assert message == "too long"
