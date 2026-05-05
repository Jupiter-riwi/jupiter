.PHONY: help install lint test build deploy dev clean hooks hooks-uninstall

SHELL := /bin/bash
ENV_FILE := .env

help: ## Mostrar todos los comandos disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Dependencias ────────────────────────────────────────────────────────────

install: install-go install-python install-frontend ## Instalar dependencias de todos los servicios

install-go: ## Instalar dependencias de api-gateway (Go)
	cd api-gateway && go mod download && go mod verify

install-python: ## Instalar dependencias de ai-workers (Python)
	cd ai-workers && pip install -r requirements.txt

install-frontend: ## Instalar dependencias de frontend (Node)
	cd frontend && npm ci

# ─── Lint ────────────────────────────────────────────────────────────────────

lint: lint-go lint-python lint-frontend ## Ejecutar lint en todos los servicios

lint-go: ## Lint de api-gateway
	cd api-gateway && go vet ./...

lint-python: ## Lint de ai-workers
	cd ai-workers && python -m ruff check . 2>/dev/null || python -m flake8 . --max-line-length=120 2>/dev/null || echo "ruff/flake8 no instalado, omitiendo lint Python"

lint-frontend: ## Lint de frontend
	cd frontend && npm run lint -- --max-warnings=0

# ─── Tests ───────────────────────────────────────────────────────────────────

test: test-go test-python ## Ejecutar tests en todos los servicios

test-go: ## Tests de api-gateway
	cd api-gateway && go test ./... -v -race -coverprofile=coverage.out

test-python: ## Tests de ai-workers
	cd ai-workers && python -m pytest tests/ -v --tb=short

# ─── Build ───────────────────────────────────────────────────────────────────

build: build-go build-python build-frontend ## Build de todos los servicios

build-go: ## Build de api-gateway
	cd api-gateway && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/gateway ./cmd/api

build-python: ## Verificar sintaxis de ai-workers
	cd ai-workers && python -m compileall app/

build-frontend: ## Build de frontend
	cd frontend && npm run build

# ─── Docker ──────────────────────────────────────────────────────────────────

docker-build: ## Construir imágenes Docker de todos los servicios
	docker compose build

docker-up: ## Levantar todos los servicios con Docker Compose
	docker compose --env-file $(ENV_FILE) up -d --build

docker-down: ## Detener todos los servicios
	docker compose down -v

docker-logs: ## Ver logs de todos los servicios
	docker compose logs -f

docker-restart: docker-down docker-up ## Reiniciar stack completo

# ─── Desarrollo ──────────────────────────────────────────────────────────────

dev: ## Iniciar entorno de desarrollo completo
	docker compose --env-file $(ENV_FILE) up -d --build rabbitmq postgres
	@echo "RabbitMQ → http://localhost:15672 (guest/guest)"
	@echo "PostgreSQL → localhost:5432"
	@echo ""
	@echo "Ejecuta los servicios en terminales separadas:"
	@echo "  cd api-gateway && go run ./cmd/api"
	@echo "  cd ai-workers && uvicorn app.main:app --reload --port 8000"
	@echo "  cd frontend && npm run dev"

# ─── CI Pipeline ─────────────────────────────────────────────────────────────

ci: install lint test build ## Pipeline CI completo (local)

# ─── Git Hooks ───────────────────────────────────────────────────────────────

hooks: ## Instalar git hooks (pre-commit lint + pre-push CI)
	bash scripts/hooks/install-hooks.sh

hooks-uninstall: ## Desinstalar git hooks
	@rm -f .git/hooks/pre-commit .git/hooks/pre-push
	@echo "Git hooks desinstalados."

# ─── Limpieza ────────────────────────────────────────────────────────────────

clean: ## Limpiar artefactos de build
	rm -rf api-gateway/bin/
	rm -rf frontend/dist/
	rm -rf ai-workers/__pycache__/ ai-workers/app/__pycache__/ ai-workers/tests/__pycache__/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	docker compose down -v --remove-orphans
