"""Streaming LLM for the live agent, using DeepSeek (deepseek-chat).

Unlike the post-evaluation coach (`call_deepseek` in main.py), this:
  - takes a persona system prompt (the agent stays in character),
  - streams tokens so TTS can start mid-response (sentence pipelining),
  - keeps a running dialogue history.
"""

from __future__ import annotations

import json
import logging
import os
from typing import AsyncIterator

import httpx

logger = logging.getLogger("jupiter.gateway.live.llm")

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = os.getenv("LIVE_LLM_MODEL", "deepseek-chat")


async def stream_reply(
    system_prompt: str,
    history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Yield response token deltas from DeepSeek. `history` is the running dialogue
    (roles 'user'/'assistant'), most recent last. Yields nothing on failure."""
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        logger.warning("DEEPSEEK_API_KEY not configured — LLM disabled")
        return

    messages = [{"role": "system", "content": system_prompt}, *history]
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "temperature": 0.8,
        "max_tokens": 220,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                DEEPSEEK_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            ) as resp:
                if resp.status_code >= 300:
                    body = await resp.aread()
                    logger.warning("DeepSeek stream failed: status=%s body=%s", resp.status_code, body[:200])
                    return
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content")
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
                    if delta:
                        yield delta
    except Exception as exc:  # pragma: no cover
        logger.warning("DeepSeek stream error: %s", exc)
        return
