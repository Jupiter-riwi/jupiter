"""Speech-to-text for the live loop, using Groq Whisper (whisper-large-v3-turbo).

Input is one complete user turn (WAV bytes, 16 kHz mono) segmented client-side by VAD.
"""

from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("jupiter.gateway.live.stt")

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_STT_MODEL = os.getenv("LIVE_STT_MODEL", "whisper-large-v3-turbo")


async def transcribe_turn(audio_wav: bytes, *, language: str | None = "es") -> str:
    """Transcribe one utterance. Returns '' on failure or silence."""
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        logger.warning("GROQ_API_KEY not configured — STT disabled")
        return ""
    if not audio_wav:
        return ""

    data = {"model": GROQ_STT_MODEL, "response_format": "text", "temperature": "0"}
    if language:
        data["language"] = language
    files = {"file": ("turn.wav", audio_wav, "audio/wav")}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                GROQ_STT_URL,
                headers={"Authorization": f"Bearer {key}"},
                data=data,
                files=files,
            )
        if resp.status_code >= 300:
            logger.warning("Groq STT failed: status=%s body=%s", resp.status_code, resp.text[:200])
            return ""
        # response_format=text returns the raw transcript string.
        return resp.text.strip()
    except Exception as exc:  # pragma: no cover
        logger.warning("Groq STT error: %s", exc)
        return ""
