# Tablero de tareas (sincronizado con GitHub Project)

Ultima actualizacion: 2026-05-29

## 1) Estado actual del tablero GitHub

Proyecto: `Apex Vision` (org `Jupiter-riwi`, project #1)

- Total items: `21`
- `Done`: `14`
- `In Progress`: `2`
- `Todo`: `5`

Historias HU en `Done`:

- `#2` HU-1.1 Pose Worker
- `#3` HU-1.2 Whisper Worker
- `#4` HU-2.1 Prosody Worker
- `#5` HU-2.2 Scoring Worker
- `#6` HU-3.1 Auth multi-tenant
- `#7` HU-3.2 Evaluations flow
- `#8` HU-3.3 Questions by tenant
- `#9` HU-3.4 Data model and migrations

Historias HU abiertas:

- `#10` HU-3.5 Local infrastructure (`In Progress`)
- `#11` HU-3.6 Worker coordination (`In Progress`)
- `#12` HU-4.1 Login/profile (`Todo`)
- `#13` HU-4.2 Record/upload (`Todo`)
- `#14` HU-4.3 Seller dashboard (`Todo`)
- `#15` HU-4.4 Admin dashboard (`Todo`)
- `#16` HU-4.5 API client/types (`Todo`)

## 2) Tareas adicionales ya hechas (agregadas al tablero)

Estas tareas no estaban en el tablero HU original, pero ya estaban implementadas en codigo y se registraron como tareas cerradas en GitHub:

- `#23` [TASK-EXTRA] Migrate transcription/scoring to OpenAI+Groq fallback  
  Evidencia: `ai-workers/whisper/whisper_worker/groq_client.py`, `ai-workers/scoring/llm.py`, `ai-workers/.env.example`, `docker-compose.yml`
- `#24` [TASK-EXTRA] Harden whisper worker error classification and retries  
  Evidencia: `ai-workers/whisper/whisper_worker/worker.py`, `ai-workers/whisper/tests/test_worker.py`
- `#25` [TASK-EXTRA] Add sentinel fallback for stale evaluations  
  Evidencia: `infra/sentinel.py`, `docs/SCORING_MODEL.md`, `CHANGELOG.md`
- `#26` [TASK-EXTRA] Connect admin dashboard to real API data  
  Evidencia: `frontend/api-client.js`, `frontend/admin-app.jsx`
- `#27` [TASK-EXTRA] Improve seller UX and production scoring display fixes  
  Evidencia: `frontend/seller-home.jsx`, `frontend/seller-record.jsx`, `frontend/seller-results.jsx`
- `#28` [TASK-EXTRA] Version scoring model and token economics docs  
  Evidencia: `ai-workers/scoring/prompts/v2.md`, `docs/SCORING_MODEL.md`, `docs/TOKENS.md`

## 3) Criterio usado para esta sincronizacion

Se agrego como tarea todo trabajo que cumplio estas condiciones:

1. Ya existe en el repo con evidencia concreta (codigo/doc/commit).
2. No estaba trazado en las HU cerradas del tablero original.
3. Tiene alcance verificable y entregable claro.

## 4) Resultado

Tablero y docs quedaron alineados para el trabajo ya completado fuera del tracking HU inicial.
