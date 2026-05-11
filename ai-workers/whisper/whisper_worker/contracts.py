from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WhisperJob(BaseModel):
    model_config = ConfigDict(extra="allow")

    job_id: str = Field(min_length=1)
    evaluation_id: str = Field(min_length=1)
    tenant_id: str = Field(min_length=1)
    video_url: str = Field(min_length=1)
    options: dict[str, Any] = Field(default_factory=dict)

    def language_override(self) -> str | None:
        raw = self.options.get("language")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
        return None

    def prompt(self) -> str | None:
        raw = self.options.get("prompt")
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
        return None


def parse_whisper_job(body: bytes) -> WhisperJob:
    payload = json.loads(body.decode("utf-8"))
    return WhisperJob.model_validate(payload)
