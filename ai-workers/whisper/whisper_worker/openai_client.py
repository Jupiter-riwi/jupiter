from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from openai import APIError, OpenAI


class WhisperTranscriptionError(RuntimeError):
    """Raised when the Whisper API call fails."""


class WhisperClient:
    def __init__(
        self,
        *,
        api_key: str,
        api_base: str,
        model: str,
        temperature: float,
        default_language: str | None,
    ) -> None:
        if not api_key:
            raise WhisperTranscriptionError("OPENAI_API_KEY is required")

        self.client = OpenAI(api_key=api_key, base_url=api_base or None)
        self.model = model
        self.temperature = temperature
        self.default_language = default_language

    def transcribe(self, audio_path: Path, *, language: str | None, prompt: str | None) -> dict[str, Any]:
        try:
            options: dict[str, Any] = {
                "model": self.model,
                "response_format": "verbose_json",
                "temperature": self.temperature,
                "timestamp_granularities": ["segment", "word"],
            }

            lang = language or self.default_language
            if lang:
                options["language"] = lang
            if prompt:
                options["prompt"] = prompt

            with audio_path.open("rb") as handle:
                result = self.client.audio.transcriptions.create(
                    file=handle,
                    **options,
                )

            if hasattr(result, "model_dump"):
                return result.model_dump()

            if hasattr(result, "json"):
                return json.loads(result.json())

            if isinstance(result, dict):
                return result

            raise WhisperTranscriptionError("Unexpected Whisper API response type")
        except APIError as exc:
            raise WhisperTranscriptionError(str(exc)) from exc
        except Exception as exc:  # pragma: no cover
            raise WhisperTranscriptionError("Whisper API call failed") from exc
