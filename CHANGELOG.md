# Changelog · Jupiter Apex Vision

## [2.0.0] — 2026-05-08

### 🐛 Bug fixes

- **Score fuera de rango (showed 2000/100 → ahora 0-100):**
  Frontend multiplicaba `score × 100` cuando el backend ya devuelve 0-100.
  Fix en [`frontend/seller-results.jsx`](frontend/seller-results.jsx) con clamp defensivo.
- **Estadísticas desincronizadas:** las dimensiones mostraban valores hardcoded (88, 82…) cuando no había breakdown del backend. Ahora derivan del `overall` real con offsets pequeños.
- **Auto-redirect forzado a /admin:** se eliminó el countdown que sacaba al usuario de la pantalla de resultados sin consentimiento. Reemplazado por badge "✓ Notificado al admin" + botón opcional "Ver en panel admin" que abre en pestaña nueva.
- **Pose worker crash** (`module 'mediapipe.tasks.python.vision' has no attribute 'PoseLandmark'`): reemplazado por índices estándar (NOSE=0, LEFT_SHOULDER=11, etc.) en [`ai-workers/pose/pose_worker/mediapipe_pose.py`](ai-workers/pose/pose_worker/mediapipe_pose.py).
- **Evaluaciones atascadas en 95%:** sentinel auto-completa evals stale > 45s con scoring crítico GPT-4.1.
- **API client URL incorrecta:** `localhost:8081` → `localhost:8080`.
- **Frontend 403 en `/`:** nginx config corregido con base href + redirects a `/seller` y `/admin`.

### ✨ Nuevas funcionalidades

- **Modelo de scoring fine-tuneado:**
  - Prompt crítico evidence-based (ver [`docs/SCORING_MODEL.md`](docs/SCORING_MODEL.md))
  - Reglas estrictas: vacío→0-15, corto→15-25, sin pose/prosody real→cap 50
  - Output incluye `evidence`, `issues` y `recommendations` accionables
  - GPT-4.1 como modelo principal
- **Sistema de tokens** ([`docs/TOKENS.md`](docs/TOKENS.md)):
  - 1 token = $0.01 USD
  - Evaluación = 5 tokens · Coaching plan IA = 20 tokens
  - Saldo persistido en localStorage, recargable
- **Coaching plan crítico:** cada recomendación se ancla en la dimensión más débil del vendedor con métrica concreta y meta de mejora medible.
- **Reportes generados con jsPDF / window.print():**
  - Reporte de equipo PDF
  - Detalle vendedores CSV
  - Plan coaching PDF con badges de prioridad
- **Sección Precios** en seller landing alineada al plan financiero (Starter $39, Growth $89, Enterprise).
- **Modal de perfil** editable con persistencia.
- **Ajustes funcionales** (Empresa, Evaluaciones, Notificaciones) con save/reset.

### 🔬 Research

- **Análisis de datasets HuggingFace** ([`docs/DATASETS_RESEARCH.md`](docs/DATASETS_RESEARCH.md)): 13 candidatos evaluados contra 8 criterios. Conclusión: ninguno cumple, se procede con dataset propio (`apex-vision-pitches-es`).

### 🏗️ Infraestructura

- **Sentinel** ([`infra/sentinel.py`](infra/sentinel.py)): scorer fallback que monitorea evals atascadas y aplica scoring crítico GPT-4.1.
- **Workers AI** funcionales: whisper, pose (fix), prosody (consumer), scoring (gpt-4.1).
- **Docker compose** completo con migrations alembic, gateway Go, workers Python, frontend nginx.

### 📋 QA · Casos de prueba nuevos

| ID | Caso | Expected |
|---|---|---|
| QA-S01 | Audio silente · 9s | overall 0-15, verdict "Sin pitch detectable" |
| QA-S02 | Pitch 15 palabras · 9s | overall 15-25, issue "transcript demasiado corto" |
| QA-S03 | Pitch sólido 120 palabras · 90s · todos features reales | overall 70-85 |
| QA-S04 | Score boundary | nunca > 100, nunca < 0 |
| QA-S05 | Evaluación stale > 45s | sentinel completa con score crítico |
| QA-S06 | Post-evaluación | NO redirige automáticamente, muestra badge admin |
| QA-S07 | Coaching plan | recomendaciones citan dimensión débil + métrica de meta |
| QA-S08 | Tokens | 1 evaluación descuenta 5 tokens, saldo persiste en localStorage |
| QA-S09 | PDF coaching | abre ventana de impresión nativa con plan formateado |
| QA-S10 | Navbar links | scrollean a sección desde cualquier página del seller |

## [1.x] — anterior a 2026-05-08

Estado inicial documentado en `docs/ARCHITECTURE.md` y `docs/ESTADO_INTEGRACION_FRONTEND.md`.
