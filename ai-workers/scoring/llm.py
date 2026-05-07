import json
import logging
import time
import os
from pathlib import Path
from typing import Optional

from scoring.models import ScoreResult

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_BACKOFF_SECONDS = 2

PROMPT_DIR = Path(__file__).parent / "prompts"


def load_prompt(version: str = "v1") -> str:
    path = PROMPT_DIR / f"{version}.md"
    if not path.exists():
        raise FileNotFoundError(f"Prompt no encontrado: {path}")
    return path.read_text(encoding="utf-8")


def build_prompt(
    pose_features: dict,
    transcript_features: dict,
    prosody_features: dict,
) -> str:
    template = load_prompt("v1")
    return (
        template
        .replace("{{pose_features}}", json.dumps(pose_features, indent=2, ensure_ascii=False))
        .replace("{{transcript_features}}", json.dumps(transcript_features, indent=2, ensure_ascii=False))
        .replace("{{prosody_features}}", json.dumps(prosody_features, indent=2, ensure_ascii=False))
    )


def call_gpt4o(prompt: str, api_key: Optional[str] = None) -> ScoreResult:
    api_key = api_key or os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY no configurada")

    last_error: Optional[Exception] = None

    for attempt in range(1, MAX_RETRIES + 2):
        try:
            result = _call_openai_json(prompt, api_key)
            score = ScoreResult.model_validate(result)
            logger.info(
                "Scoring completado | overall=%d | tokens_in=%d | tokens_out=%d",
                score.overall,
                result.get("_usage", {}).get("prompt_tokens", 0),
                result.get("_usage", {}).get("completion_tokens", 0),
            )
            return score
        except Exception as exc:
            last_error = exc
            if attempt <= MAX_RETRIES:
                delay = RETRY_BACKOFF_SECONDS * attempt
                logger.warning(
                    "Intento %d fallido (retry en %ds): %s", attempt, delay, exc
                )
                time.sleep(delay)
            else:
                logger.error("Agotados %d intentos. Último error: %s", MAX_RETRIES + 1, exc)

    raise last_error  # type: ignore[misc]


def _call_openai_json(prompt: str, api_key: str) -> dict:
    import urllib.request
    import urllib.error

    body = json.dumps({
        "model": "gpt-4.1",
        "messages": [
            {"role": "system", "content": "Eres un coach de ventas. Responde solo con JSON válido."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
        "max_tokens": 2000,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8")
        raise RuntimeError(f"OpenAI API error {exc.code}: {error_body}")

    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    parsed["_usage"] = data.get("usage", {})
    return parsed
