"""Compile raw pasted text (job description / CV / product blurb) into a
structured ContextBrief with ONE LLM call at creation time.

Compiling once — instead of per turn — keeps the live loop's latency intact:
sessions just read the stored brief. DeepSeek is primary (same provider the
live agent already uses), Groq is the fallback (same pattern as live/llm.py).
"""

from __future__ import annotations

import json
import logging
import os

import httpx

from .models import ContextBrief

logger = logging.getLogger("jupiter.gateway.context.compiler")

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = os.getenv("CONTEXT_LLM_MODEL", "deepseek-chat")
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_CHAT_MODEL = os.getenv("CONTEXT_GROQ_MODEL", "llama-3.1-8b-instant")


class CompileError(RuntimeError):
    """The brief could not be compiled from the raw text."""


_SYSTEM = (
    "Sos un analista experto en selección de personal y en ventas B2B. "
    "Respondés ÚNICAMENTE con JSON válido, sin markdown ni texto extra."
)

_TEMPLATE_PUESTO = """Analizá la siguiente descripción de puesto (y/o CV) y producí un brief para que un entrevistador de IA conduzca la entrevista orientada a ESTE cargo.

TEXTO CRUDO:
---
{raw_text}
---

Devolvé exactamente este JSON (en el mismo idioma del texto crudo):
{{
  "summary": "resumen del puesto en 2-3 oraciones",
  "competencies": ["3 a 8 competencias concretas a evaluar en la entrevista"],
  "seed_questions": ["8 a 12 preguntas específicas de ESTE cargo, mezclando técnicas y de comportamiento"],
  "red_flags": ["2 a 6 señales de alerta específicas para este puesto"],
  "success_criteria": ["3 a 6 criterios que distinguen a un gran candidato para este rol"],
  "vocabulary": ["hasta 15 términos del dominio que el entrevistador debe usar con naturalidad"]
}}"""

_TEMPLATE_PRODUCTO = """Analizá la siguiente descripción de producto/servicio y producí un brief para que un comprador de IA (cliente, director, comprador técnico…) evalúe un pitch de ventas sobre ESTE producto.

TEXTO CRUDO:
---
{raw_text}
---

Devolvé exactamente este JSON (en el mismo idioma del texto crudo):
{{
  "summary": "resumen del producto y su mercado en 2-3 oraciones",
  "competencies": ["3 a 8 aspectos que un buen pitch de este producto debe cubrir (ROI, diferenciación, integración, etc.)"],
  "seed_questions": ["8 a 12 preguntas y objeciones específicas que un comprador real haría sobre ESTE producto"],
  "red_flags": ["2 a 6 señales de un pitch débil para este producto (promesas vagas, ignorar competencia, etc.)"],
  "success_criteria": ["3 a 6 criterios que distinguen un gran pitch de este producto"],
  "vocabulary": ["hasta 15 términos del dominio/industria que el comprador debe usar con naturalidad"]
}}"""


def _call_json(url: str, key: str, model: str, prompt: str, provider: str) -> dict:
    resp = httpx.post(
        url,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
            "max_tokens": 1800,
        },
        timeout=60,
    )
    if resp.status_code >= 300:
        raise CompileError(f"{provider} error {resp.status_code}: {resp.text[:200]}")
    content = resp.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def compile_brief(kind: str, raw_text: str) -> ContextBrief:
    """kind: 'puesto' | 'producto'. Raises CompileError if no provider succeeds."""
    template = _TEMPLATE_PUESTO if kind == "puesto" else _TEMPLATE_PRODUCTO
    prompt = template.format(raw_text=raw_text.strip()[:12000])

    providers: list[tuple[str, str, str, str]] = []
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if deepseek_key:
        providers.append(("DeepSeek", DEEPSEEK_URL, deepseek_key, DEEPSEEK_MODEL))
    if groq_key:
        providers.append(("Groq", GROQ_CHAT_URL, groq_key, GROQ_CHAT_MODEL))
    if not providers:
        raise CompileError("No LLM key configured (DEEPSEEK_API_KEY / GROQ_API_KEY)")

    last: Exception | None = None
    for provider, url, key, model in providers:
        try:
            data = _call_json(url, key, model, prompt, provider)
            brief = ContextBrief.model_validate(data)
            logger.info("brief compiled via %s | kind=%s questions=%d",
                        provider, kind, len(brief.seed_questions))
            return brief
        except Exception as exc:  # noqa: BLE001 — try next provider
            last = exc
            logger.warning("%s brief compile failed: %s", provider, exc)

    raise CompileError(f"brief compilation failed on all providers: {last}")
