from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from openai import (
    APIError,
    AuthenticationError,
    PermissionDeniedError,
    RateLimitError,
    OpenAI,
)

logger = logging.getLogger(__name__)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class WhisperTranscriptionError(RuntimeError):
    """Raised when the Whisper API call fails."""

    def __init__(self, message: str, retryable: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable


class GroqWhisperClient:
    """Whisper transcription client. Tries OpenAI first, falls back to Groq."""

    def __init__(
        self,
        *,
        api_key: str,
        api_base: str,
        openai_api_key: str = "",
        openai_api_base: str = "",
        groq_api_key: str = "",
        model: str = "whisper-1",
        groq_model: str = "whisper-large-v3",
        temperature: float = 0.0,
        default_language: str | None = None,
        include_word_timestamps: bool = False,
    ) -> None:
        # Primary: OpenAI
        self.openai_client: OpenAI | None = None
        if openai_api_key:
            self.openai_client = OpenAI(
                api_key=openai_api_key,
                base_url=openai_api_base or None,
            )

        # Fallback: Groq
        self.groq_client: OpenAI | None = None
        groq_key = groq_api_key or api_key
        if groq_key:
            self.groq_client = OpenAI(
                api_key=groq_key,
                base_url=api_base or GROQ_BASE_URL,
            )

        if not self.openai_client and not self.groq_client:
            raise WhisperTranscriptionError(
                "OPENAI_API_KEY or GROQ_API_KEY is required",
                retryable=False,
            )

        self.model = model
        self.groq_model = groq_model
        self.temperature = temperature
        self.default_language = default_language
        self.include_word_timestamps = include_word_timestamps

    def transcribe(
        self, audio_path: Path, *, language: str | None, prompt: str | None
    ) -> dict[str, Any]:
        # Try OpenAI first
        if self.openai_client:
            try:
                logger.info("Transcribing with OpenAI...")
                options = self._build_options(self.model, language, prompt)
                return self._transcribe_with(self.openai_client, audio_path, options)
            except (AuthenticationError, PermissionDeniedError) as exc:
                logger.warning("OpenAI auth error, falling back to Groq: %s", exc)
            except RateLimitError:
                logger.warning("OpenAI rate limited, falling back to Groq")
            except Exception as exc:
                logger.warning("OpenAI error, falling back to Groq: %s", exc)

        # Fallback to Groq
        if self.groq_client:
            try:
                logger.info("Transcribing with Groq...")
                options = self._build_options(self.groq_model, language, prompt)
                return self._transcribe_with(self.groq_client, audio_path, options)
            except AuthenticationError as exc:
                raise WhisperTranscriptionError(str(exc), retryable=False) from exc
            except PermissionDeniedError as exc:
                raise WhisperTranscriptionError(str(exc), retryable=False) from exc
            except RateLimitError as exc:
                raise WhisperTranscriptionError(str(exc), retryable=True) from exc
            except APIError as exc:
                retryable = 500 <= getattr(exc, "status_code", 0) < 600
                raise WhisperTranscriptionError(str(exc), retryable=retryable) from exc
            except Exception as exc:  # pragma: no cover
                raise WhisperTranscriptionError("Whisper API call failed") from exc

        raise WhisperTranscriptionError(
            "No transcription provider available", retryable=False
        )

    def _build_options(
        self, model: str, language: str | None, prompt: str | None
    ) -> dict[str, Any]:
        options: dict[str, Any] = {
            "model": model,
            "response_format": "verbose_json",
            "temperature": self.temperature,
        }

        granularity = ["segment"]
        if self.include_word_timestamps:
            granularity.append("word")
        options["timestamp_granularities"] = granularity

        lang = language or self.default_language
        if lang:
            options["language"] = lang
        if prompt:
            options["prompt"] = prompt
        return options

    @staticmethod
    def _transcribe_with(
        client: OpenAI,
        audio_path: Path,
        options: dict[str, Any],
    ) -> dict[str, Any]:
        with audio_path.open("rb") as handle:
            result = client.audio.transcriptions.create(
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
