"""Speech-to-text for the live loop, using Groq Whisper (whisper-large-v3-turbo).

Input is one complete user turn (WAV bytes, 16 kHz mono) segmented client-side by VAD.
"""

from __future__ import annotations

import logging
import os
import re
import unicodedata

import httpx

logger = logging.getLogger("jupiter.gateway.live.stt")

GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_STT_MODEL = os.getenv("LIVE_STT_MODEL", "whisper-large-v3-turbo")

# Whisper hallucinates these canned phrases on silence / near-silent audio
# (it was trained on lots of video endings). Drop them so a breath or speaker
# bleed never reaches the agent as a fake "Gracias".
_HALLUCINATIONS = {
    "gracias", "muchas gracias", "gracias por ver", "gracias por ver el video",
    "gracias por ver el vídeo", "gracias por su atencion", "gracias por su atención",
    "subtitulos realizados por la comunidad de amara.org",
    "subtítulos realizados por la comunidad de amara.org",
    "subtitulos por la comunidad de amara.org", "subtítulos por la comunidad de amara.org",
    "amara.org", "thanks for watching", "thank you", "thank you for watching",
    "please subscribe", "subscribe", "you", "the", "bye", "chau", "adios", "adiós", "ok",
    "hola", "buenas", "si", "sí", "no", "ya", "eh", "mmm", "ah",
}


def _normalize(text: str) -> str:
    # strip accents so "subtítulos"/"sí" match the (accent-free) blocklist
    stripped = "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )
    return re.sub(r"[^\w\s]", "", stripped.lower()).strip()


def _is_hallucination(text: str) -> bool:
    norm = _normalize(text)
    if not norm:
        return True
    if norm in _HALLUCINATIONS:
        return True
    # the classic Whisper "video ending" hallucinations
    if "amara" in norm or norm.startswith("subtitul") or "gracias por ver" in norm:
        return True
    # a single short token (filler/greeting) is almost always noise
    words = norm.split()
    if len(words) <= 1 and (norm in _HALLUCINATIONS or len(norm) <= 3):
        return True
    return False


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
        text = resp.text.strip()
        if _is_hallucination(text):
            logger.info("STT dropped likely hallucination: %r", text[:60])
            return ""
        return text
    except Exception as exc:  # pragma: no cover
        logger.warning("Groq STT error: %s", exc)
        return ""
