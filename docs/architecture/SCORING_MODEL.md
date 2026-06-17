# Modelo de Scoring · Jupiter Apex Vision

> Versión: **2.1** · Fecha: 2026-05-27
> Estado: en producción (sentinel + scoring worker)

## 1. Filosofía del modelo

El scorer es **crítico, evidence-based y honesto**. Reglas inviolables:

- Rango de output: **0–100** estricto. Cualquier valor fuera del rango es bug.
- Cada dimensión debe citar un dato concreto (palabras, segundos, métrica o frase).
- Cada `recommendation` debe ser accionable: problema + impacto + acción + ejercicio + métrica.
- Si no hay evidencia para una dimensión (worker stub, audio silente), se marca explícitamente y la dimensión cap a ≤ 50.
- No se otorgan puntajes >75 sin: contenido sustancial (>100 palabras) + pose real + prosody real.

## 2. Inputs del scorer

| Input | Origen | Formato |
|---|---|---|
| `transcript` | whisper-1 (OpenAI) | `{ text, segments, duration_seconds, language }` |
| `pose` | MediaPipe Pose (33 landmarks) | `{ posture_score, movement_score, eye_contact, ... }` |
| `prosody` | librosa | `{ pace_wpm, energy, clarity, pauses, fillers }` |

## 3. Reglas de puntuación

### 3.1 Contenido insuficiente (overall ≤ 25)
- Transcript vacío o <5 palabras → `overall ∈ [0, 15]`
- Transcript 5–29 palabras → `overall ∈ [15, 25]`

### 3.2 Pitch corto (overall ≤ 50)
- Duración <20s → máximo 35
- Duración 20–40s sin estructura → máximo 50

### 3.3 Workers stub (no analizados)
- `pose.stub_by` presente → `lenguaje_corporal ≤ 45`
- `prosody.stub_by` presente → `ritmo_voz ≤ 45`

### 3.4 Calidad del discurso
- Sin propuesta de valor → `claridad ≤ 50`
- Sin estructura (apertura-desarrollo-cierre) → `claridad ≤ 60`
- Repetitivo / muletillas excesivas → `ritmo_voz ≤ 60`
- Sin preguntas consultivas o reformulación → `escucha_activa ≤ 40`

## 4. Output schema

```json
{
  "overall": 0,
  "dimensions": {
    "confianza": { "score": 0, "evidence": "..." },
    "claridad": { "score": 0, "evidence": "..." },
    "lenguaje_corporal": { "score": 0, "evidence": "..." },
    "ritmo_voz": { "score": 0, "evidence": "..." },
    "escucha_activa": { "score": 0, "evidence": "..." }
  },
  "recommendations": [
    {
      "priority": "high",
      "area": "ritmo_voz",
      "problem": "Hablas a 185 WPM, por encima del rango recomendado.",
      "impact": "El prospecto puede percibir ansiedad y perder partes clave.",
      "tip": "Reduce velocidad y marca pausas entre ideas.",
      "drill": "Graba el mismo pitch 3 veces intentando llegar a 150 WPM.",
      "success_metric": "WPM entre 130 y 160 durante al menos 80% del pitch."
    }
  ]
}
```

## 5. Implementación

| Componente | Archivo | Modelo |
|---|---|---|
| Sentinel (fallback) | [`infra/sentinel.py`](../infra/sentinel.py) | GPT-4.1 + heurística |
| Scoring worker | [`ai-workers/scoring/llm.py`](../ai-workers/scoring/llm.py) | GPT-4o primario + Groq fallback |
| Frontend cap | [`frontend/seller-results.jsx`](../frontend/seller-results.jsx) | clamp 0–100 |

El worker usa `ai-workers/scoring/prompts/v2.md` por defecto (`SCORING_PROMPT_VERSION` permite cambiarlo). OpenAI se llama con JSON schema y el resultado se valida con Pydantic antes de persistir. El sentinel actúa como fallback: si una evaluación queda en `processing > 45s`, lo levanta, ejecuta el scorer sobre las features disponibles (reales o stub) y completa.

## 6. Testing del modelo

| Caso | Input | Expected overall |
|---|---|---|
| Audio silente | transcript="" | 0–15 |
| Pitch ultracorto | 15 palabras, 9s | 15–25 |
| Pitch básico sin estructura | 50 palabras, 60s | 35–55 |
| Pitch sólido | 120 palabras, 90s, todos features reales | 70–85 |
| Pitch excelente | 150 palabras, estructura clara, value prop, CTA | 85–95 |
