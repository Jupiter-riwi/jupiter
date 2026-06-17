#!/usr/bin/env python3
"""
Sentinel: scorer crítico que evalúa pitches usando GPT-4.1.

Reemplaza al worker de scoring cuando se queda atascado y aplica un
sistema crítico real basado en features whisper + pose + prosody.
Si las features son stub (worker no corrió), penaliza la dimensión correspondiente.
"""
import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://jupiter:jupiter_secret@localhost:5432/jupiter_db",
)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")
STALE_AFTER_SECONDS = int(os.getenv("SENTINEL_STALE_SECONDS", "45"))
POLL_INTERVAL_SECONDS = int(os.getenv("SENTINEL_POLL_SECONDS", "10"))

PROMPT = """Eres un coach SENIOR de ventas con 20 años de experiencia. Tu trabajo es dar feedback HONESTO y EXIGENTE, no complaciente.

REGLAS DE PUNTUACIÓN ESTRICTAS (todas en escala 0-100, NUNCA superar 100):

1. CONTENIDO INSUFICIENTE (overall ≤ 25):
   - Transcript vacío o <5 palabras → overall 0-15
   - Transcript 5-29 palabras → overall 15-25
   - Veredicto: "Sin pitch detectable" o "Pitch incompleto"

2. PITCH MUY CORTO (overall ≤ 50):
   - Duración <20s con cualquier contenido → máximo 35
   - Duración 20-40s sin estructura → máximo 50

3. WORKERS STUB (no se analizó la dimensión):
   - pose con stub → body_language ≤ 45 (anota "lenguaje corporal no analizado")
   - prosody con stub → prosody ≤ 45 (anota "ritmo de voz no analizado")
   - NO inventar datos: si no hay evidencia, marcalo

4. CALIDAD DEL DISCURSO:
   - Sin propuesta de valor clara → communication ≤ 50
   - Sin estructura (apertura-desarrollo-cierre) → communication ≤ 60
   - Repetitivo, muletillas excesivas → prosody ≤ 60
   - No hay manejo anticipado de objeciones → objection_handling ≤ 40

5. SOLO >75 SI:
   - Transcript >100 palabras Y estructura clara
   - Pose Y prosody analizados (no stub)
   - Propuesta de valor explícita
   - Llamada a acción al final

REGLAS PARA EVIDENCIA:
- Cada `issue` debe citar un dato concreto (palabras, segundos, métrica numérica).
- Cada `recommendation` debe ser ACCIONABLE (verbo + qué hacer + cómo medirlo).
- NO uses generalidades como "mejora tu confianza" — usa "agrega 2 frases de contexto en los primeros 5 segundos".

Devuelve EXCLUSIVAMENTE JSON con esta estructura:
{
  "overall": <integer 0-100>,
  "verdict": "<frase honesta de máximo 80 caracteres>",
  "dimensions": {
    "communication":      <0-100>,
    "body_language":      <0-100>,
    "prosody":            <0-100>,
    "objection_handling": <0-100>,
    "confidence":         <0-100>
  },
  "evidence": {
    "word_count": <int>,
    "duration_sec": <float>,
    "speech_density": <palabras/segundo>,
    "has_structure": <bool>,
    "has_value_prop": <bool>,
    "has_cta": <bool>
  },
  "issues": [
    "<problema concreto con dato numérico>",
    ...
  ],
  "recommendations": [
    {"area": "<dimension>", "tip": "<acción específica con métrica de éxito>"},
    ...
  ]
}

DATOS DEL PITCH A EVALUAR:
TRANSCRIPT: {transcript}
DURATION_SECONDS: {duration}
POSE: {pose}
PROSODY: {prosody}
"""


def find_stuck_evaluations(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, tenant_id
            FROM evaluations
            WHERE status = 'processing'
              AND updated_at < NOW() - INTERVAL '%s seconds'
            """ % STALE_AFTER_SECONDS,
        )
        return cur.fetchall()


def get_features(conn, eval_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT kind, payload FROM features WHERE evaluation_id = %s", (eval_id,))
        return {row["kind"]: row["payload"] for row in cur.fetchall()}


def has_score(conn, eval_id):
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM scores WHERE evaluation_id = %s LIMIT 1", (eval_id,))
        return cur.fetchone() is not None


def call_gpt(transcript, duration, pose, prosody):
    if not OPENAI_API_KEY:
        return None
    prompt = (PROMPT
              .replace("{transcript}", json.dumps(transcript, ensure_ascii=False))
              .replace("{duration}", str(duration))
              .replace("{pose}", json.dumps(pose, ensure_ascii=False))
              .replace("{prosody}", json.dumps(prosody, ensure_ascii=False)))
    body = json.dumps({
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "Eres un coach exigente. Solo respondes JSON válido."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_API_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as exc:
        print(f"GPT error: {exc}", flush=True)
        return None


def heuristic_score(transcript_text, duration, pose_stub, prosody_stub):
    """Fallback si GPT no está disponible — sigue siendo crítico."""
    word_count = len(transcript_text.split()) if transcript_text else 0
    if word_count < 5:
        return {
            "overall": 8,
            "verdict": "Sin pitch detectable: el audio no contiene discurso comercial.",
            "dimensions": {"communication": 5, "body_language": 30, "prosody": 10, "objection_handling": 0, "confidence": 5},
            "issues": ["Transcripción vacía o casi vacía", "No se detectó propuesta de valor"],
            "recommendations": [
                {"area": "Contenido", "tip": "Grabá un pitch de al menos 60 segundos con apertura, valor y cierre"},
            ],
        }
    if word_count < 30:
        return {
            "overall": 22,
            "verdict": f"Pitch incompleto: solo {word_count} palabras detectadas.",
            "dimensions": {"communication": 20, "body_language": 40, "prosody": 25, "objection_handling": 10, "confidence": 18},
            "issues": [f"Transcript de {word_count} palabras: insuficiente", "Falta estructura de pitch"],
            "recommendations": [
                {"area": "Contenido", "tip": "Estructura tu pitch: problema → solución → diferencial → CTA"},
                {"area": "Duración", "tip": "Usa los 90s completos para desarrollar tu propuesta"},
            ],
        }
    base = min(60, 35 + word_count // 4)
    if pose_stub: base = min(base, 55)
    if prosody_stub: base = min(base, 55)
    return {
        "overall": base,
        "verdict": f"Pitch parcial · {word_count} palabras · {duration:.0f}s",
        "dimensions": {
            "communication": base + 5,
            "body_language": 45 if pose_stub else base,
            "prosody": 45 if prosody_stub else base,
            "objection_handling": base - 10,
            "confidence": base,
        },
        "issues": [
            *(["Lenguaje corporal no analizado (worker stub)"] if pose_stub else []),
            *(["Prosodia no analizada (worker stub)"] if prosody_stub else []),
        ],
        "recommendations": [
            {"area": "Estructura", "tip": "Asegurate de cubrir problema-solución-CTA"},
        ],
    }


def unblock(conn, eval_id, tenant_id):
    feats = get_features(conn, eval_id)
    transcript_obj = feats.get("transcript", {})
    transcript_text = transcript_obj.get("text", "")
    duration = transcript_obj.get("duration_seconds", 0)

    pose_obj = feats.get("pose", {})
    prosody_obj = feats.get("prosody", {})
    pose_stub = bool(pose_obj.get("stub_by") or pose_obj.get("stub"))
    prosody_stub = bool(prosody_obj.get("stub_by") or prosody_obj.get("stub"))

    # Insertar features faltantes como stub (mantiene contrato del DB)
    with conn.cursor() as cur:
        for kind, default in [
            ("pose",       {"stub_by": "sentinel", "posture_score": None, "movement_score": None}),
            ("transcript", {"stub_by": "sentinel", "text": "", "duration_seconds": 0}),
            ("prosody",    {"stub_by": "sentinel", "pace_wpm": None}),
        ]:
            if kind not in feats:
                cur.execute(
                    "INSERT INTO features (evaluation_id, tenant_id, kind, payload) VALUES (%s,%s,%s,%s::jsonb)",
                    (eval_id, tenant_id, kind, json.dumps(default)),
                )
                if kind == "transcript":
                    transcript_text = ""
                    duration = 0
                if kind == "pose": pose_stub = True
                if kind == "prosody": prosody_stub = True

    breakdown = call_gpt(transcript_text, duration, pose_obj, prosody_obj)
    if breakdown is None:
        breakdown = heuristic_score(transcript_text, duration, pose_stub, prosody_stub)

    # Defensivo: cap todos los valores a 0-100
    def _cap(v):
        try: return max(0, min(100, int(round(float(v)))))
        except (TypeError, ValueError): return 0
    breakdown["overall"] = _cap(breakdown.get("overall", 0))
    if isinstance(breakdown.get("dimensions"), dict):
        breakdown["dimensions"] = {k: _cap(v) for k, v in breakdown["dimensions"].items()}
    overall = breakdown["overall"]

    with conn.cursor() as cur:
        if not has_score(conn, eval_id):
            cur.execute(
                "INSERT INTO scores (evaluation_id, tenant_id, value, breakdown) VALUES (%s,%s,%s,%s::jsonb)",
                (eval_id, tenant_id, overall, json.dumps(breakdown, ensure_ascii=False)),
            )
        # También copiamos breakdown a evaluations.features para que el frontend lo vea
        # (el gateway no hace JOIN con scores, devuelve solo evaluations row + features JSONB).
        cur.execute(
            "UPDATE evaluations SET status='completed', score=%s, features=%s::jsonb, updated_at=NOW() WHERE id=%s",
            (overall, json.dumps(breakdown, ensure_ascii=False), eval_id),
        )
    conn.commit()
    print(
        f"[{datetime.now(timezone.utc).isoformat()}] scored {eval_id} "
        f"overall={overall} words={len(transcript_text.split())} dur={duration:.1f}s "
        f"pose_stub={pose_stub} prosody_stub={prosody_stub}",
        flush=True,
    )


def main():
    print(
        f"Sentinel started · model={OPENAI_MODEL if OPENAI_API_KEY else 'heuristic'} "
        f"· poll={POLL_INTERVAL_SECONDS}s · stale_after={STALE_AFTER_SECONDS}s",
        flush=True,
    )
    while True:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            try:
                stuck = find_stuck_evaluations(conn)
                for row in stuck:
                    unblock(conn, row["id"], row["tenant_id"])
            finally:
                conn.close()
        except Exception as exc:
            print(f"Sentinel error: {exc}", flush=True)
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
