from __future__ import annotations

import json

from pose_worker.contracts import (
    build_feature_error,
    build_feature_ready,
    parse_pose_job,
)


def test_parse_pose_job_and_segment_override() -> None:
    raw = {
        "job_id": "job-1",
        "evaluation_id": "eval-1",
        "tenant_id": "tenant-1",
        "video_url": "s3://videos/test.webm",
        "options": {"segment_seconds": 9},
    }
    job = parse_pose_job(json.dumps(raw).encode("utf-8"))
    assert job.job_id == "job-1"
    assert job.segment_seconds(5) == 9


def test_build_feature_ready_contract() -> None:
    raw = {
        "job_id": "job-2",
        "evaluation_id": "eval-2",
        "tenant_id": "tenant-2",
        "video_url": "file:///tmp/test.webm",
    }
    job = parse_pose_job(json.dumps(raw).encode("utf-8"))
    event = build_feature_ready(job, "pose-worker", {"summary": {"segments_count": 1}})

    assert event["event"] == "feature.ready"
    assert event["kind"] == "pose"
    assert event["worker"] == "pose-worker"
    assert event["payload"]["summary"]["segments_count"] == 1


def test_build_feature_error_contract() -> None:
    event = build_feature_error(
        job_hint={"job_id": "job-3", "evaluation_id": "eval-3", "tenant_id": "tenant-3"},
        worker_name="pose-worker",
        code="VIDEO_CORRUPT",
        message="Video vacio",
    )
    assert event["event"] == "feature.error"
    assert event["kind"] == "pose"
    assert event["error"]["code"] == "VIDEO_CORRUPT"
