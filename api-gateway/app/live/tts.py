"""Text-to-speech for the live loop, using ElevenLabs Flash v2.5 (~75ms).

We synthesize sentence-by-sentence so the agent can start speaking before the
LLM finishes the full response. Each call returns MP3 bytes for one sentence.
"""

from __future__ import annotations

import logging
import os
import re

import httpx

logger = logging.getLogger("jupiter.gateway.live.tts")

ELEVEN_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
FLASH_MODEL = os.getenv("LIVE_TTS_MODEL", "eleven_flash_v2_5")

# Split a streaming token buffer into complete sentences for incremental TTS.
_SENTENCE_END = re.compile(r"(.+?[.!?…]+[\s\"')\]]*)", re.DOTALL)


def take_sentences(buffer: str) -> tuple[list[str], str]:
    """Return (complete_sentences, remainder) from a growing token buffer."""
    sentences: list[str] = []
    last_end = 0
    for m in _SENTENCE_END.finditer(buffer):
        sentences.append(m.group(1).strip())
        last_end = m.end()
    remainder = buffer[last_end:]
    return [s for s in sentences if s], remainder


async def _post(client: httpx.AsyncClient, voice_id: str, key: str, payload: dict) -> httpx.Response:
    return await client.post(
        ELEVEN_URL.format(voice_id=voice_id),
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        json=payload,
        params={"optimize_streaming_latency": "3", "output_format": "mp3_44100_128"},
    )


async def synthesize(text: str, *, voice_id: str) -> bytes | None:
    """Synthesize one short chunk to MP3 bytes with the low-latency Flash model.

    Falls back to ELEVENLABS_VOICE_ID if the requested voice is unavailable
    (e.g. a library voice rejected with 402 on the free plan)."""
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        logger.warning("ELEVENLABS_API_KEY not configured — TTS disabled")
        return None
    text = (text or "").strip()
    if not text:
        return None

    payload = {
        "text": text,
        "model_id": FLASH_MODEL,
        "voice_settings": {
            "stability": 0.4,
            "similarity_boost": 0.75,
            "style": 0.25,
            "use_speaker_boost": True,
        },
    }
    fallback = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL").strip()
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await _post(client, voice_id, key, payload)
            if resp.status_code in (401, 402, 404) and voice_id != fallback:
                logger.info("voice %s unavailable (%s); falling back to %s", voice_id, resp.status_code, fallback)
                resp = await _post(client, fallback, key, payload)
            if resp.status_code >= 300:
                logger.warning("ElevenLabs Flash failed: status=%s body=%s", resp.status_code, resp.text[:200])
                return None
            return resp.content
    except Exception as exc:  # pragma: no cover
        logger.warning("ElevenLabs Flash error: %s", exc)
        return None
