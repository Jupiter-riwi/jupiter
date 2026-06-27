"""Persona composition for the live agent.

Two PRODUCTS share the same real-time loop:
  - "presentacion": the seller pitches to a buyer-side persona.
  - "entrevista":   the candidate is interviewed by a hiring-side persona.

A persona = WHO is on the other side (role_type).
A level   = HOW HARD the interaction is (accesible / neutral / exigente).

Composed system prompt = mode_frame + role_base + level_modifier + scenario_context + rules.

Phase 1: personas are hardcoded here. Phase 2 will load tenant-scoped, admin-editable
personas from the `personas` table and this module becomes the composition engine.

Voices are all ElevenLabs `premade` (free-plan safe); tts.py falls back to
ELEVENLABS_VOICE_ID if any voice is unavailable.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ── premade voices available on the account (free-plan safe) ────────────────
V_SARAH = "EXAVITQu4vr4xnSDxMaL"   # female, reassuring, confident
V_ADAM = "pNInz6obpgDQGcFmaJgB"    # male, dominant, firm
V_ERIC = "cjVigY5qzO86Huf0OWal"    # male, smooth, trustworthy
V_LAURA = "FGY2WhTYpPnrIDTdsKH5"   # female, enthusiast, quirky
V_BRIAN = "nPczCjzI2devNBz1zQrb"   # male, deep, resonant
V_MATILDA = "XrExE9yKIg1WjnnlVkGX" # female, knowledgable, professional
V_GEORGE = "JBFqnCBsd6RMkjVDRZzb"  # male, warm, captivating
V_ALICE = "Xb7hH8MSUJpSbSDYk0k2"   # female, clear, engaging educator
V_BILL = "pqHfZKP75CvOlQylNhV4"    # male, wise, mature, balanced
V_RIVER = "SAz9YHcvj6GT2YYXdXww"   # neutral, relaxed, informative


@dataclass(frozen=True)
class Persona:
    key: str
    name: str
    mode: str               # presentacion | entrevista
    role_type: str
    level: str              # accesible | neutral | exigente
    lang: str               # es | en
    voice_id: str
    base_prompt: str
    agent_name: str = ""    # concrete first name the persona introduces itself with
    behavior: dict = field(default_factory=dict)


# Native-accent voice per language (all premade / free-plan safe). For es we use
# the warm/neutral set; for en we use clearly English-native voices. The same
# role keeps a consistent "character" across languages where possible.
_VOICE_BY_LANG = {
    # role_type: {"es": voice, "en": voice}
    "cliente":           {"es": V_SARAH,   "en": "EXAVITQu4vr4xnSDxMaL"},  # Sarah (en: american female)
    "director":          {"es": V_ADAM,    "en": V_ADAM},                  # Adam — dominant, firm
    "administrador":     {"es": V_ERIC,    "en": V_ERIC},                  # Eric — smooth, trustworthy
    "comprador_tecnico": {"es": V_BRIAN,   "en": V_BRIAN},                 # Brian — deep, resonant
    "usuario_final":     {"es": V_LAURA,   "en": V_LAURA},                 # Laura — enthusiast
    "inversor":          {"es": V_BILL,    "en": "onwK4e9ZLuTAKqWW03F9"},  # Bill / Daniel (en: british broadcaster)
    "reclutador":        {"es": V_SARAH,   "en": "Xb7hH8MSUJpSbSDYk0k2"},  # Sarah / Alice (en: british female)
    "hiring_manager":    {"es": V_ADAM,    "en": V_ADAM},
    "lider_tecnico":     {"es": V_BRIAN,   "en": V_BRIAN},
    "panel_ejecutivo":   {"es": V_BILL,    "en": "onwK4e9ZLuTAKqWW03F9"},  # Daniel — steady broadcaster
}


def _voice_for(role_type: str, lang: str, default: str) -> str:
    return (_VOICE_BY_LANG.get(role_type) or {}).get(lang, default)


# Concrete first name each persona introduces itself with, per language. Without
# this the LLM, asked to "introduce yourself", emits a literal placeholder like
# "[Tu Nombre]". Names roughly match the voice's gender for consistency.
_AGENT_NAME = {
    "cliente":           {"es": "Sofía",     "en": "Sarah"},
    "director":          {"es": "Martín",    "en": "Adam"},
    "administrador":     {"es": "Diego",     "en": "Eric"},
    "comprador_tecnico": {"es": "Bruno",     "en": "Brian"},
    "usuario_final":     {"es": "Lucía",     "en": "Laura"},
    "inversor":          {"es": "Guillermo", "en": "Daniel"},
    "reclutador":        {"es": "Valentina", "en": "Alice"},
    "hiring_manager":    {"es": "Andrés",    "en": "Adam"},
    "lider_tecnico":     {"es": "Bruno",     "en": "Brian"},
    "panel_ejecutivo":   {"es": "Ricardo",   "en": "Daniel"},
}


def _name_for(role_type: str, lang: str) -> str:
    return (_AGENT_NAME.get(role_type) or {}).get(lang, "" if lang == "en" else "")


_LANG_DIRECTIVE = {
    "es": "IDIOMA: hablás SIEMPRE en español rioplatense neutro, pase lo que pase.",
    "en": "LANGUAGE: you ALWAYS speak in natural, native English, no matter what. Never switch to Spanish.",
}


# ── role catalog: mode -> role_type -> (display name, voice, base prompt) ────
_ROLES: dict[str, dict[str, tuple[str, str, str]]] = {
    "presentacion": {
        "cliente": ("Cliente", V_SARAH,
            "Sos un CLIENTE POTENCIAL evaluando si comprar el producto/servicio que te presentan. "
            "Te importa el precio, el retorno de inversión, qué problema concreto te resuelve y por qué "
            "deberías cambiar lo que ya usás. Preguntás desde la perspectiva del usuario final."),
        "director": ("Director", V_ADAM,
            "Sos un DIRECTOR / ejecutivo C-level con poco tiempo. Pensás en impacto de negocio, ventaja "
            "competitiva, riesgo y escala. Sos directo e impaciente: querés el punto rápido, cuestionás "
            "supuestos y pedís datos. No te interesan los detalles operativos menores."),
        "administrador": ("Administrador", V_ERIC,
            "Sos un ADMINISTRADOR / comprador operativo. Te importa la implementación: integración con lo "
            "que ya tienen, proceso de adopción, soporte, seguridad/compliance y costo total de propiedad. "
            "Preguntás de forma detallada y metódica sobre el 'cómo'."),
        "comprador_tecnico": ("Comprador técnico", V_BRIAN,
            "Sos un COMPRADOR TÉCNICO / evaluador. Profundizás en arquitectura, seguridad, datos, "
            "integraciones, límites de la solución y casos borde. Buscás huecos técnicos y pedís especificidad."),
        "usuario_final": ("Usuario final", V_LAURA,
            "Sos un USUARIO FINAL que usaría el producto a diario. Te importa la facilidad de uso, la curva "
            "de aprendizaje, cómo encaja en tu rutina y si te ahorra trabajo. No te importan la estrategia "
            "ni los números corporativos."),
        "inversor": ("Inversor", V_BILL,
            "Sos un INVERSOR / VC escuchando un pitch de levantamiento. Te importan tamaño de mercado, "
            "unit economics, tracción, defensibilidad (moat), equipo y por qué ahora. Cuestionás supuestos "
            "de crecimiento y pedís métricas."),
    },
    "entrevista": {
        "reclutador": ("Reclutador/a RRHH", V_SARAH,
            "Sos un/a RECLUTADOR/A de RRHH haciendo una entrevista de screening inicial. Evaluás motivación, "
            "fit cultural, expectativas, comunicación y trayectoria general. Hacés preguntas abiertas y cálidas, "
            "tipo 'contame sobre vos' y 'por qué este rol'."),
        "hiring_manager": ("Hiring Manager", V_ADAM,
            "Sos el/la HIRING MANAGER, el jefe directo del puesto. Evaluás competencias específicas del rol con "
            "preguntas situacionales y por comportamiento (STAR): 'contame una vez que…'. Buscás evidencia "
            "concreta de impacto, no generalidades."),
        "lider_tecnico": ("Líder técnico", V_BRIAN,
            "Sos un/a LÍDER TÉCNICO entrevistando la parte dura. Profundizás en conocimiento técnico, "
            "resolución de problemas y decisiones de diseño. Pedís que razones en voz alta y repreguntás el porqué."),
        "panel_ejecutivo": ("Panel ejecutivo", V_BILL,
            "Sos un/a EJECUTIVO/A en una entrevista final de alto nivel. Evaluás pensamiento estratégico, "
            "liderazgo, manejo de ambigüedad y encaje con la visión. Hacés preguntas amplias y exigentes "
            "bajo cierta presión."),
    },
}

_MODE_FRAME = {
    "presentacion": (
        "CONTEXTO: estás en una reunión comercial. La persona frente a vos (el vendedor) viene a presentarte "
        "su producto o servicio. Tu trabajo es comportarte como su audiencia real."
    ),
    "entrevista": (
        "CONTEXTO: estás conduciendo una ENTREVISTA LABORAL. La persona frente a vos es el/la CANDIDATO/A. "
        "Tu trabajo es entrevistarlo/a para un puesto, evaluando con preguntas según tu rol."
    ),
}

_LEVEL_MOD = {
    "accesible": "ACTITUD: cálida y abierta. Pocas objeciones, das señales de interés, ayudás a que fluya. Una objeción suave de vez en cuando.",
    "neutral":   "ACTITUD: profesional y equilibrada. Preguntas legítimas y alguna objeción razonable, pero escuchás con apertura.",
    "exigente":  "ACTITUD: escéptica y exigente. Cuestionás con firmeza, planteás objeciones fuertes, pedís pruebas concretas y a veces interrumpís si se va por las ramas.",
}

_RULES = (
    "REGLAS:\n"
    "- Mantenete SIEMPRE en personaje. NO sos un asistente ni un coach: sos la persona del contexto.\n"
    "- UNA intervención por turno: una pregunta o una objeción, no una lista.\n"
    "- Conversacional y breve (1-3 oraciones). Esto se convierte en voz: nada de listas ni markdown.\n"
    "- Reaccioná a lo que REALMENTE dijeron. Si esquivan tu pregunta, notalo.\n"
    "- No resuelvas la interacción por la otra persona: que se gane cada avance.\n"
    "- NUNCA uses placeholders entre corchetes (como [Tu Nombre], [empresa], [puesto]). "
    "Si te presentás, usá tu nombre propio concreto; si te falta un dato, no lo inventes con un corchete.\n"
)


def _compose(mode: str, role_base: str, level: str, lang: str, scenario: str | None, agent_name: str = "") -> str:
    parts = [
        _LANG_DIRECTIVE.get(lang, _LANG_DIRECTIVE["es"]),
        _MODE_FRAME.get(mode, _MODE_FRAME["presentacion"]),
        role_base,
        _LEVEL_MOD.get(level, _LEVEL_MOD["neutral"]),
        _RULES,
    ]
    if agent_name:
        identity = (f"IDENTITY: your name is {agent_name}. Introduce yourself with this name, never a placeholder."
                    if lang == "en" else
                    f"IDENTIDAD: tu nombre es {agent_name}. Presentate con ese nombre, nunca con un placeholder.")
        parts.insert(3, identity)
    if scenario:
        label = "CONTEXTO DEL PITCH (lo que viene a presentar)" if mode == "presentacion" else "CONTEXTO DEL PUESTO / CV (sobre qué entrevistar)"
        parts.append(f"{label}:\n{scenario}")
    return "\n\n".join(parts)


def list_personas() -> dict[str, list[dict[str, str]]]:
    """Catalog for the frontend selector: mode -> [{role_type, name}]."""
    return {
        mode: [{"role_type": rt, "name": meta[0]} for rt, meta in roles.items()]
        for mode, roles in _ROLES.items()
    }


def get_persona(mode: str, role_type: str, level: str, lang: str = "es", scenario: str | None = None) -> Persona:
    """Compose a Persona. Falls back to presentacion/cliente/neutral/es if unknown."""
    mode = (mode or "presentacion").lower()
    level = (level or "neutral").lower()
    lang = (lang or "es").lower()
    if lang not in ("es", "en"):
        lang = "es"
    roles = _ROLES.get(mode) or _ROLES["presentacion"]
    role_type = (role_type or next(iter(roles))).lower()
    name, voice, role_base = roles.get(role_type) or next(iter(roles.values()))
    agent_name = _name_for(role_type, lang)
    return Persona(
        key=f"{mode}:{role_type}:{level}:{lang}",
        name=f"{name} ({level})",
        mode=mode,
        role_type=role_type,
        level=level,
        lang=lang,
        voice_id=_voice_for(role_type, lang, voice),
        base_prompt=_compose(mode, role_base, level, lang, scenario, agent_name),
        agent_name=agent_name,
    )


def greeting_instruction(persona: Persona) -> str:
    en = persona.lang == "en"
    nm = persona.agent_name
    name_es = f"con tu nombre ({nm}) y tu rol" if nm else "por tu rol"
    name_en = f"with your name ({nm}) and your role" if nm else "by your role"
    no_ph_es = " Nunca uses un placeholder entre corchetes para tu nombre."
    no_ph_en = " Never use a bracketed placeholder for your name."
    if persona.mode == "entrevista":
        if en:
            return (f"Open the interview yourself with a brief, in-character greeting (1-2 sentences): introduce "
                    f"yourself {name_en}, welcome the candidate and invite them to start (e.g. to introduce themselves). "
                    f"Speak in English. Don't say you are an AI.{no_ph_en}")
        return (f"Abrí vos la entrevista con un saludo breve y en personaje (1-2 oraciones): presentate {name_es}, "
                f"dale la bienvenida al candidato e invitalo a empezar (por ejemplo, a que se presente). No digas que sos una IA.{no_ph_es}")
    if en:
        return (f"Start the conversation yourself with a brief, in-character greeting (1-2 sentences), introducing "
                f"yourself {name_en} and inviting the seller to begin their pitch. Speak in English. Don't say you are an AI.{no_ph_en}")
    return (f"Iniciá vos la conversación con un saludo breve y en personaje (1-2 oraciones), presentándote {name_es} "
            f"e invitando al vendedor a empezar su presentación. No digas que sos una IA.{no_ph_es}")
