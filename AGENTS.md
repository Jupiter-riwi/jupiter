# AGENTS.md — Apex Vision Sales Evaluator

## Repo layout (monorepo, 4 subprojects)

| Dir | Language | Role | Status |
|-----|----------|------|--------|
| `ai-workers/` | Python 3.12 + FastAPI + pika | Pose, Whisper, Prosody & Scoring workers | Prosody & Scoring built; Pose & Whisper pending |
| `api-gateway/` | **Python 3.12 + FastAPI** | Auth, multi-tenant, REST + WebSocket, presigned URLs | Base FastAPI + `/health` |
| `frontend/` | React 18 + Vite + TypeScript + Tailwind | Login, grabación, dashboard | Vite+React scaffold |
| `infra/` | — | Docker Compose, scripts | **Empty** (only `.gitkeep`) |

Canonical docs live in `docs/`: `ARCHITECTURE.md`, `TEAM.md`, `HISTORIAS_USUARIO.md`, `AI-WORKERS-TECHNICAL.md`.

## Commands

```bash
# Frontend (from frontend/)
npm install              # install deps
npm run dev              # Vite dev server → http://localhost:5173
npm run build            # tsc -b && vite build
npm run lint             # ESLint

# AI Workers (from ai-workers/)
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt

# Workers individuales (puertos fijos)
uvicorn prosody.main:app --reload --port 8001   # Prosody Worker + /health
uvicorn scoring.main:app --reload --port 8002   # Scoring Worker + /health
uvicorn app.main:app --reload     # Template legacy — port 8000

# Tests
python -m pytest prosody/tests/ scoring/tests/ -v

# Prompt evaluation (usa fixtures, requiere OPENAI_API_KEY)
python scripts/prompt_eval.py --fixture vendedor_solido

# API Gateway (FastAPI)
uvicorn app.main:app --reload --port 8080   # /health

# Docker (3 services: rabbitmq + prosody + scoring)
# from ai-workers/:  docker compose up --build
```

## Architecture decisions (read before coding)

- **API Gateway is FastAPI** — all new endpoints go in `api-gateway/app/`.
- **`ai-workers/` template vs real workers** — the old code (`telemetry_queue` consumer in `app/`) is legacy. Real workers live in `prosody/` and `scoring/` (built by Dev 2). Pose and Whisper workers (Dev 1) go in `pose/` and `whisper/`. Each worker has its own FastAPI app on a unique port.
- **Shared persistence at `shared/db.py`** — uses `psycopg2` with `DATABASE_URL` env var. Provides `insert_features()`, `fetch_features_by_evaluation()`, `insert_score()`. Both workers import from `shared.db`.
- **Scoring prompts versioned** at `scoring/prompts/v1.md` — changes to the prompt require PR review. Placeholders `{{pose_features}}`, `{{transcript_features}}`, `{{prosody_features}}` are replaced at runtime.
- **Scoring fixtures** at `scoring/tests/fixtures/` — 3 realistic scenarios (vendedor_solido, nervioso, monotono) with expected overall ranges. Use `scripts/prompt_eval.py` to test against real GPT-4o.
- **Fan-in for scoring** — the scoring worker polls `features` table and `requeue=True` if not all 3 features are ready. Dev 3 still needs to implement the trigger that publishes to `scoring.jobs`.
- **Frontend axios points to `http://localhost:8080/api`** — will change when API gateway migrates to FastAPI (likely port 8000).
- **No root `docker-compose.yml` yet** — `infra/` is empty. The only compose file is in `ai-workers/` and runs RabbitMQ + telemetry + prosody + scoring.
- **After any architecture/contract change**, run `/generate-arch` to update `docs/ARCHITECTURE.md`.

## Gotchas

- **Duplicate `main.py`**: `ai-workers/main.py` and `ai-workers/app/main.py` are identical. The legacy Dockerfile runs `uvicorn app.main:app`. New workers use `uvicorn prosody.main:app` / `uvicorn scoring.main:app`.
- **`.env.example` exists** at `ai-workers/.env.example`. Env vars for all workers: `RABBITMQ_HOST/PORT/USER/PASS/VHOST`, `DATABASE_URL`, `OPENAI_API_KEY`, `PROSODY_QUEUE`, `SCORING_QUEUE`.
- **Root `.gitignore` exists** — covers Python, Node, IDE, OS, Docker, and .env files.
- **Tests exist for Dev 2 workers only** — 9 tests in `prosody/tests/`, 15 in `scoring/tests/` (including fixtures). Run with `python -m pytest prosody/tests/ scoring/tests/ -v`. No tests for pose, whisper, or frontend yet.
- **No pre-commit hooks**, no Alembic migrations, CI is a stub (`echo "Basic CI Step"`).
- **Tailwind is v4** (`^4.2.2`) but uses the v3-style config file (`tailwind.config.js`) — verify this works; typically v4 uses CSS-based config.

## Git conventions (from `.agents/workflows/skill-git.md`)

- **Branch naming**: `<area>/feature/<description>` or `bugfix/<desc>` or `hotfix/<desc>`
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`
- **PRs < 400 lines** ideal; review by at least 1 dev outside the domain
- **Only Juanes (Estka)** merges to `main` — never push to main directly

## Skill: `generate-arch`

The repo includes a skill at `.claude/skills/generate-arch/SKILL.md`. Use it (`/generate-arch`) to update `docs/ARCHITECTURE.md` when contracts, stack decisions, or schemas change. The skill preserves closed decisions and maintains cross-section consistency.
