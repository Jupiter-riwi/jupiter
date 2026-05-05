from __future__ import annotations

import json

from whisper_worker.contracts import WhisperJob, parse_whisper_job


def test_parse_whisper_job_with_options() -> None:
    raw = {
        "job_id": "job-1",
        "evaluation_id": "eval-1",
        "tenant_id": "tenant-1",
        "video_url": "s3://bucket/video.mp4",
        "options": {"language": "es", "prompt": "hola"},
    }

    job = parse_whisper_job(json.dumps(raw).encode("utf-8"))

    assert isinstance(job, WhisperJob)
    assert job.language_override() == "es"
    assert job.prompt() == "hola"


def test_language_override_ignores_empty_string() -> None:
    job = WhisperJob(
        job_id="job-2",
        evaluation_id="eval-2",
        tenant_id="tenant-2",
        video_url="https://example.com/video.mp4",
        options={"language": "   "},
    )

    assert job.language_override() is None
