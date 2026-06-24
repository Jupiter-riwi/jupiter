"""End-of-session scoring for the live agent.

When a session ends, we score the full dialogue with a rubric that depends on the
product (sales pitch vs job interview), in the session language, via DeepSeek
(JSON output). Returns a structured result the frontend renders as a card.
"""

from __future__ import annotations

import json
import logging
import os

import httpx

logger = logging.getLogger("jupiter.gateway.live.scoring")

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = os.getenv("LIVE_LLM_MODEL", "deepseek-chat")

# rubric dimensions per mode: key -> {es, en}
RUBRICS = {
    "presentacion": [
        ("claridad", "Claridad del mensaje", "Message clarity"),
        ("descubrimiento", "Descubrimiento", "Discovery"),
        ("manejo_objeciones", "Manejo de objeciones", "Objection handling"),
        ("valor", "Propuesta de valor", "Value proposition"),
        ("cierre", "Cierre y próximos pasos", "Closing & next steps"),
    ],
    "entrevista": [
        ("comunicacion", "Comunicación", "Communication"),
        ("respuestas_star", "Respuestas concretas (STAR)", "Concrete answers (STAR)"),
        ("fit_motivacion", "Fit y motivación", "Fit & motivation"),
        ("conocimiento", "Conocimiento del rol", "Role knowledge"),
        ("manejo_presion", "Manejo de presión", "Handling pressure"),
    ],
}


def _rubric_for(mode: str, lang: str) -> list[dict]:
    dims = RUBRICS.get(mode, RUBRICS["presentacion"])
    i = 2 if lang == "en" else 1
    return [{"key": d[0], "label": d[i]} for d in dims]


def _dialogue_text(history: list[dict]) -> str:
    lines = []
    for m in history:
        who = "VENDEDOR/CANDIDATO" if m["role"] == "user" else "AGENTE"
        lines.append(f"{who}: {m['content']}")
    return "\n".join(lines)


_DIFFICULTY = {
    "es": {
        "accesible": "NIVEL accesible: sé indulgente, valorá el esfuerzo y no penalices errores menores. Las notas pueden ser generosas.",
        "neutral": "NIVEL neutral: evaluá con una vara profesional estándar.",
        "exigente": "NIVEL exigente: sé MUY estricto, como un evaluador senior en una entrevista/venta de alto nivel. Subí la vara, penalizá respuestas vagas, falta de estructura o evidencia, y NO regales puntos. Un desempeño promedio acá merece nota baja-media.",
    },
    "en": {
        "accesible": "EASYGOING level: be lenient, reward effort and don't penalize minor mistakes. Scores can be generous.",
        "neutral": "NEUTRAL level: grade with a standard professional bar.",
        "exigente": "DEMANDING level: be VERY strict, like a senior evaluator in a high-stakes interview/sale. Raise the bar, penalize vague answers, lack of structure or evidence, and do NOT give away points. An average performance here deserves a low-to-mid score.",
    },
}


async def score_session(*, mode: str, lang: str, persona_name: str, history: list[dict], level: str = "neutral") -> dict | None:
    """Score the dialogue. Returns None if there isn't enough to score.

    `level` (accesible/neutral/exigente) makes the grading stricter as difficulty rises."""
    user_turns = [m for m in history if m["role"] == "user"]
    if len(user_turns) < 1:
        return None
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        return None

    rubric = _rubric_for(mode, lang)
    dim_keys = ", ".join(d["key"] for d in rubric)
    en = lang == "en"
    difficulty = _DIFFICULTY.get(lang, _DIFFICULTY["es"]).get(level, _DIFFICULTY[lang if en else "es"]["neutral"])
    product = ("a job interview" if mode == "entrevista" else "a sales pitch") if en else \
              ("una entrevista laboral" if mode == "entrevista" else "una presentación de ventas")
    subject = ("the candidate" if mode == "entrevista" else "the seller") if en else \
              ("el candidato" if mode == "entrevista" else "el vendedor")

    if en:
        sys = (
            f"You are a strict but fair evaluator of {product}. You scored a live, voice conversation between "
            f"{subject} and an interviewer/buyer agent ({persona_name}). Be evidence-based and concrete: cite what "
            f"{subject} actually said. Score each dimension 0-100 and give one short, actionable comment per dimension. "
            f"Then give an overall 0-100, 2-3 strengths and 2-3 improvements. Respond ONLY with JSON. Write all text in English.\n"
            f"{difficulty}"
        )
        instr = (
            f"Dimensions to score (use these exact keys): {dim_keys}.\n"
            'JSON shape: {"overall": <0-100>, "dimensions": [{"key": "...", "score": <0-100>, "comment": "..."}], '
            '"strengths": ["..."], "improvements": ["..."], "summary": "one-sentence verdict"}'
        )
    else:
        sys = (
            f"Sos un evaluador estricto pero justo de {product}. Evaluaste una conversación de voz en vivo entre "
            f"{subject} y un agente entrevistador/comprador ({persona_name}). Sé evidence-based y concreto: citá lo que "
            f"{subject} realmente dijo. Puntuá cada dimensión 0-100 con un comentario corto y accionable. Después un "
            f"overall 0-100, 2-3 fortalezas y 2-3 mejoras. Respondé SOLO con JSON. Escribí todo en español.\n"
            f"{difficulty}"
        )
        instr = (
            f"Dimensiones a puntuar (usá estas claves exactas): {dim_keys}.\n"
            'Forma del JSON: {"overall": <0-100>, "dimensions": [{"key": "...", "score": <0-100>, "comment": "..."}], '
            '"strengths": ["..."], "improvements": ["..."], "summary": "veredicto en una oración"}'
        )

    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": sys},
            {"role": "user", "content": f"{instr}\n\n=== CONVERSACIÓN ===\n{_dialogue_text(history)}"},
        ],
        "temperature": 0.3,
        "max_tokens": 900,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                DEEPSEEK_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            )
        if resp.status_code >= 300:
            logger.warning("session scoring failed: %s %s", resp.status_code, resp.text[:200])
            return None
        content = resp.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
    except Exception as exc:  # pragma: no cover
        logger.warning("session scoring error: %s", exc)
        return None

    # attach the localized labels so the frontend can render without its own map
    label_by_key = {d["key"]: d["label"] for d in rubric}
    for dim in data.get("dimensions", []):
        dim["label"] = label_by_key.get(dim.get("key"), dim.get("key"))
    data["mode"] = mode
    data["lang"] = lang
    return data
