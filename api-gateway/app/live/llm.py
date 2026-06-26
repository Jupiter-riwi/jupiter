"""Streaming LLM for the live agent.

DeepSeek remains the primary provider. In local/dev environments we also allow
Groq as an OpenAI-compatible fallback because the live stack already requires
GROQ_API_KEY for STT.
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
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_CHAT_MODEL = os.getenv("LIVE_GROQ_MODEL", "llama-3.1-8b-instant")


async def _stream_openai_compatible(
    *,
    provider: str,
    url: str,
    key: str,
    model: str,
    messages: list[dict[str, str]],
) -> AsyncIterator[str]:
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.8,
        "max_tokens": 220,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            ) as resp:
                if resp.status_code >= 300:
                    body = await resp.aread()
                    logger.warning("%s stream failed: status=%s body=%s", provider, resp.status_code, body[:200])
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
        logger.warning("%s stream error: %s", provider, exc)
        return


async def stream_reply(
    system_prompt: str,
    history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Yield response token deltas. DeepSeek is primary; Groq is fallback."""
    messages = [{"role": "system", "content": system_prompt}, *history]
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()

    providers: list[tuple[str, str, str, str]] = []
    if deepseek_key:
        providers.append(("DeepSeek", DEEPSEEK_URL, deepseek_key, DEEPSEEK_MODEL))
    elif not groq_key:
        logger.warning("No live LLM key configured; set DEEPSEEK_API_KEY or GROQ_API_KEY")

    if groq_key:
        if not deepseek_key:
            logger.warning("DEEPSEEK_API_KEY not configured; using Groq live LLM fallback")
        providers.append(("Groq", GROQ_CHAT_URL, groq_key, GROQ_CHAT_MODEL))

    if not providers:
        return

    for provider, url, key, model in providers:
        yielded = False
        async for delta in _stream_openai_compatible(
            provider=provider,
            url=url,
            key=key,
            model=model,
            messages=messages,
        ):
            yielded = True
            yield delta
        if yielded:
            return
