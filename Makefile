.PHONY: up down restart logs seed ps build pull health

# ── Lifecycle ──────────────────────────────────────────────────────────────────

up:
	docker compose up -d --build
	@echo ""
	@echo "Services available:"
	@echo "  Gateway   → http://localhost:$${GATEWAY_PORT:-8080}"
	@echo "  API Docs  → http://localhost:$${GATEWAY_PORT:-8080}/docs"
	@echo "  Frontend  → http://localhost:$${FRONTEND_PORT:-5173}"
	@echo "  RabbitMQ  → http://localhost:15672  (guest / guest)"
	@echo "  MinIO     → http://localhost:9001   (minioadmin / minioadmin)"

down:
	docker compose down

restart:
	docker compose restart

# ── Observability ──────────────────────────────────────────────────────────────

logs:
	docker compose logs -f

ps:
	docker compose ps

# ── Data ──────────────────────────────────────────────────────────────────────

seed:
	docker compose run --rm migrate \
		sh -c "pip install -q -r requirements.txt && python -c \
		\"import os, sys; sys.path.insert(0, '.'); \
		from versions.seed import run; run(os.environ.get('SEED_TENANT_ID'))\""
	@echo "Seed complete."

# ── Build & pull ──────────────────────────────────────────────────────────────

build:
	docker compose build

pull:
	docker compose pull

# ── Health check ──────────────────────────────────────────────────────────────

health:
	@echo "Checking service health..."
	@curl -sf http://localhost:$${GATEWAY_PORT:-8080}/health && echo " gateway OK" || echo " gateway FAIL"
	@curl -sf http://localhost:$${FRONTEND_PORT:-5173} > /dev/null && echo " frontend OK" || echo " frontend FAIL"
	@curl -sf http://localhost:15672 > /dev/null && echo " rabbitmq OK" || echo " rabbitmq FAIL"
	@curl -sf http://localhost:9001 > /dev/null && echo " minio OK" || echo " minio FAIL"
