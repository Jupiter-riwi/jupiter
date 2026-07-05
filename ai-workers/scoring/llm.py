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
DEFAULT_PROMPT_VERSION = os.getenv("SCORING_PROMPT_VERSION", "v2")

# Primary: OpenAI
OPENAI_MODEL = "gpt-4o"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

# Fallback: Groq
GROQ_MODEL = "llama-3.1-8b-instant"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def load_prompt(version: str = "v1") -> str:
    path = PROMPT_DIR / f"{version}.md"
    if not path.exists():
        raise FileNotFoundError(f"Prompt no encontrado: {path}")
    return path.read_text(encoding="utf-8")


# Difficulty directive injected into the prompt — stricter grading for harder personas.
_DIFFICULTY = {
    "accesible": "NIVEL DE EXIGENCIA: accesible. Sé indulgente, valorá el esfuerzo y no penalices errores menores. Las notas pueden ser generosas.",
    "neutral": "NIVEL DE EXIGENCIA: neutral. Evaluá con una vara profesional estándar.",
    "exigente": "NIVEL DE EXIGENCIA: exigente. Sé MUY estricto, como un evaluador senior de alto nivel. Subí la vara, penalizá con fuerza la falta de estructura, evidencia o energía, y NO regales puntos: un desempeño promedio merece nota baja-media.",
}


def build_prompt(
    pose_features: dict,
    transcript_features: dict,
    prosody_features: dict,
    version: str = DEFAULT_PROMPT_VERSION,
    difficulty: str | None = None,
    context_brief: dict | None = None,
) -> str:
    template = load_prompt(version)
    directive = _DIFFICULTY.get((difficulty or "neutral").lower(), _DIFFICULTY["neutral"])
    prompt = (
        template
        .replace("{{difficulty}}", directive)
        .replace("{{pose_features}}", json.dumps(pose_features, indent=2, ensure_ascii=False))
        .replace("{{transcript_features}}", json.dumps(transcript_features, indent=2, ensure_ascii=False))
        .replace("{{prosody_features}}", json.dumps(prosody_features, indent=2, ensure_ascii=False))
    )
    if context_brief:
        # The evaluation ran against a compiled vacante/producto brief: anchor
        # the grading in that context (affects evidence and recommendations).
        prompt += (
            "\n\n## Contexto de la sesión (puesto/producto)\n\n"
            "La sesión corrió contra este contexto. Evaluá pertinencia: el contenido del "
            "discurso debe responder a estas competencias y criterios; penalizá respuestas "
            "genéricas que los ignoren y citá el contexto en la evidencia cuando aplique.\n\n"
            + json.dumps(context_brief, indent=2, ensure_ascii=False)
        )
    return prompt


def call_llm(prompt: str, api_key: Optional[str] = None) -> ScoreResult:
    openai_key = api_key or os.getenv("OPENAI_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")

    # ── Try OpenAI first ──
    if openai_key:
        try:
            logger.info("Intentando scoring con OpenAI (gpt-4o)...")
            result = _call_openai_json(prompt, openai_key)
            score = ScoreResult.model_validate(result)
            logger.info(
                "Scoring completado con OpenAI | overall=%d | tokens_in=%d | tokens_out=%d",
                score.overall,
                result.get("_usage", {}).get("prompt_tokens", 0),
                result.get("_usage", {}).get("completion_tokens", 0),
            )
            return score
        except Exception as exc:
            logger.warning("OpenAI falló, intentando con Groq: %s", exc)

    # ── Fallback to Groq ──
    if groq_key:
        last_error: Optional[Exception] = None
        for attempt in range(1, MAX_RETRIES + 2):
            try:
                logger.info("Intentando scoring con Groq (%s)...", GROQ_MODEL)
                result = _call_groq_json(prompt, groq_key)
                score = ScoreResult.model_validate(result)
                logger.info(
                    "Scoring completado con Groq | overall=%d | tokens_in=%d | tokens_out=%d",
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

    raise ValueError("Ni OPENAI_API_KEY ni GROQ_API_KEY están configuradas")


def _score_result_json_schema() -> dict:
    dimension_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "score": {"type": "integer", "minimum": 0, "maximum": 100},
            "evidence": {"type": "string"},
        },
        "required": ["score", "evidence"],
    }
    recommendation_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "priority": {"type": "string", "enum": ["high", "medium", "low"]},
            "area": {"type": "string"},
            "problem": {"type": "string"},
            "impact": {"type": "string"},
            "tip": {"type": "string"},
            "drill": {"type": "string"},
            "success_metric": {"type": "string"},
        },
        "required": [
            "priority",
            "area",
            "problem",
            "impact",
            "tip",
            "drill",
            "success_metric",
        ],
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "overall": {"type": "integer", "minimum": 0, "maximum": 100},
            "dimensions": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "confianza": dimension_schema,
                    "claridad": dimension_schema,
                    "lenguaje_corporal": dimension_schema,
                    "ritmo_voz": dimension_schema,
                    "escucha_activa": dimension_schema,
                },
                "required": [
                    "confianza",
                    "claridad",
                    "lenguaje_corporal",
                    "ritmo_voz",
                    "escucha_activa",
                ],
            },
            "recommendations": {
                "type": "array",
                "minItems": 3,
                "maxItems": 5,
                "items": recommendation_schema,
            },
        },
        "required": ["overall", "dimensions", "recommendations"],
    }


def _call_openai_json(prompt: str, api_key: str) -> dict:
    import urllib.request
    import urllib.error

    body = json.dumps({
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "Eres un coach de ventas. Responde solo con JSON válido."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "score_result",
                "strict": True,
                "schema": _score_result_json_schema(),
            },
        },
        "temperature": 0.3,
        "max_tokens": 2000,
    }).encode("utf-8")

    req = urllib.request.Request(
        OPENAI_API_URL,
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


def _call_groq_json(prompt: str, api_key: str) -> dict:
    import urllib.request
    import urllib.error

    body = json.dumps({
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": "Eres un coach de ventas. Responde solo con JSON válido."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.3,
        "max_tokens": 2000,
    }).encode("utf-8")

    req = urllib.request.Request(
        GROQ_API_URL,
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
        raise RuntimeError(f"Groq API error {exc.code}: {error_body}")

    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    parsed["_usage"] = data.get("usage", {})
    return parsed
