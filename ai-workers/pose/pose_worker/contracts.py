from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class PoseJob(BaseModel):
    model_config = ConfigDict(extra="allow")

    job_id: str = Field(min_length=1)
    evaluation_id: str = Field(min_length=1)
    tenant_id: str = Field(min_length=1)
    video_url: str = Field(min_length=1)
    options: dict[str, Any] = Field(default_factory=dict)

    def segment_seconds(self, default_value: int) -> int:
        raw_value = self.options.get("segment_seconds", default_value)
        try:
            parsed = int(raw_value)
        except (TypeError, ValueError):
            return default_value

        if parsed < 1:
            return default_value
        if parsed > 120:
            return 120
        return parsed


def parse_pose_job(body: bytes) -> PoseJob:
    payload = json.loads(body.decode("utf-8"))
    return PoseJob.model_validate(payload)


def build_feature_ready(job: PoseJob, worker_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "event": "feature.ready",
        "status": "ok",
        "worker": worker_name,
        "job_id": job.job_id,
        "evaluation_id": job.evaluation_id,
        "tenant_id": job.tenant_id,
        "kind": "pose",
        "generated_at": _utc_now(),
        "payload": payload,
    }


def build_feature_error(
    job_hint: dict[str, str],
    worker_name: str,
    code: str,
    message: str,
) -> dict[str, Any]:
    return {
        "event": "feature.error",
        "status": "error",
        "worker": worker_name,
        "job_id": job_hint.get("job_id"),
        "evaluation_id": job_hint.get("evaluation_id"),
        "tenant_id": job_hint.get("tenant_id"),
        "kind": "pose",
        "generated_at": _utc_now(),
        "error": {
            "code": code,
            "message": message,
        },
    }
