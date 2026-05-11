from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from whisper_worker.openai_client import WhisperClient, WhisperTranscriptionError


def test_client_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(WhisperTranscriptionError):
        WhisperClient(
            api_key="",
            api_base="",
            model="whisper-1",
            temperature=0.0,
            default_language=None,
            include_word_timestamps=False,
        )


def test_transcribe_uses_model_dump(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"audio")

    class FakeResult:
        def model_dump(self) -> dict[str, Any]:
            return {"text": "hello"}

    class FakeTranscriptions:
        kwargs_seen: dict[str, Any] | None = None

        def create(self, file, **kwargs):  # type: ignore[no-untyped-def]
            self.kwargs_seen = kwargs
            return FakeResult()

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.audio = type("Audio", (), {"transcriptions": FakeTranscriptions()})()

    monkeypatch.setattr("whisper_worker.openai_client.OpenAI", FakeOpenAI)

    client = WhisperClient(
        api_key="key",
        api_base="",
        model="whisper-1",
        temperature=0.0,
        default_language=None,
        include_word_timestamps=False,
    )

    result = client.transcribe(audio_path, language=None, prompt=None)
    assert result["text"] == "hello"
    assert client.client.audio.transcriptions.kwargs_seen is not None
    assert client.client.audio.transcriptions.kwargs_seen["timestamp_granularities"] == ["segment"]
