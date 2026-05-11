# Modelo de Scoring · Jupiter Apex Vision

> Versión: **2.0** · Fecha: 2026-05-08
> Estado: en producción (sentinel + scoring worker)

## 1. Filosofía del modelo

El scorer es **crítico, evidence-based y honesto**. Reglas inviolables:

- Rango de output: **0–100** estricto. Cualquier valor fuera del rango es bug.
- Cada `issue` debe citar un dato concreto (palabras, segundos, métrica).
- Cada `recommendation` debe ser accionable: verbo + qué hacer + cómo medirlo.
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
- `pose.stub_by` presente → `body_language ≤ 45`
- `prosody.stub_by` presente → `prosody ≤ 45`

### 3.4 Calidad del discurso
- Sin propuesta de valor → `communication ≤ 50`
- Sin estructura (apertura-desarrollo-cierre) → `communication ≤ 60`
- Repetitivo / muletillas excesivas → `prosody ≤ 60`
- Sin manejo anticipado de objeciones → `objection_handling ≤ 40`

## 4. Output schema

```json
{
  "overall": 0,
  "verdict": "Frase honesta máx 80 chars",
  "dimensions": {
    "communication": 0,
    "body_language": 0,
    "prosody": 0,
    "objection_handling": 0,
    "confidence": 0
  },
  "evidence": {
    "word_count": 0,
    "duration_sec": 0.0,
    "speech_density": 0.0,
    "has_structure": false,
    "has_value_prop": false,
    "has_cta": false
  },
  "issues": ["..."],
  "recommendations": [{ "area": "...", "tip": "..." }]
}
```

## 5. Implementación

| Componente | Archivo | Modelo |
|---|---|---|
| Sentinel (fallback) | [`infra/sentinel.py`](../infra/sentinel.py) | GPT-4.1 + heurística |
| Scoring worker | [`ai-workers/scoring/llm.py`](../ai-workers/scoring/llm.py) | GPT-4.1 |
| Frontend cap | [`frontend/seller-results.jsx`](../frontend/seller-results.jsx) | clamp 0–100 |

El sentinel actúa como fallback: si una evaluación queda en `processing > 45s`, lo levanta, ejecuta el scorer GPT-4.1 sobre las features disponibles (reales o stub) y completa.

## 6. Testing del modelo

| Caso | Input | Expected overall |
|---|---|---|
| Audio silente | transcript="" | 0–15 |
| Pitch ultracorto | 15 palabras, 9s | 15–25 |
| Pitch básico sin estructura | 50 palabras, 60s | 35–55 |
| Pitch sólido | 120 palabras, 90s, todos features reales | 70–85 |
| Pitch excelente | 150 palabras, estructura clara, value prop, CTA | 85–95 |
