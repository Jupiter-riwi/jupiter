#!/usr/bin/env bash
# =============================================================================
# JÚPITER – Deploy Pipeline Local
# Construye imágenes Docker y levanta el stack completo.
#
# Uso:
#   bash scripts/deploy.sh              # Deploy completo
#   bash scripts/deploy.sh --build-only # Solo construir imágenes
#   bash scripts/deploy.sh --down       # Detener stack
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-deploy}"

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_env() {
    if [ ! -f .env ]; then
        log_warn "Archivo .env no encontrado. Copiando desde .env.example..."
        cp .env.example .env
        log_ok ".env creado desde .env.example. Revisa las variables antes de continuar."
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker no está instalado. Instálalo desde https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose no está disponible. Se requiere Docker >= 20.10."
        exit 1
    fi

    log_ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') detectado"
}

build_images() {
    log_info "Construyendo imágenes Docker..."
    docker compose build --no-cache api-gateway ai-workers frontend
    log_ok "Imágenes construidas correctamente"
}

start_services() {
    log_info "Levantando stack Júpiter..."
    docker compose --env-file .env up -d --build

    log_info "Esperando servicios..."
    sleep 5

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  🪐  JÚPITER – Stack Desplegado                ║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  RabbitMQ UI   → http://localhost:15672        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  API Gateway   → http://localhost:8080         ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  AI Workers    → http://localhost:8000/health  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  Frontend      → http://localhost:5173         ${GREEN}║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
    echo ""
}

stop_services() {
    log_info "Deteniendo stack Júpiter..."
    docker compose down -v --remove-orphans
    log_ok "Stack detenido y volúmenes eliminados"
}

show_status() {
    echo ""
    docker compose ps 2>/dev/null || log_info "No hay servicios ejecutándose"
}

# ─── Main ────────────────────────────────────────────────────────────────────

echo -e "${BLUE}"
echo "   ╔══════════════════════════════════════════╗"
echo "   ║    🪐  JÚPITER – Deploy Pipeline Local   ║"
echo "   ╚══════════════════════════════════════════╝"
echo -e "${NC}"

check_docker
check_env

case "$MODE" in
    --build-only)
        build_images
        ;;
    --down)
        stop_services
        ;;
    --status)
        show_status
        ;;
    deploy|*)
        build_images
        start_services
        show_status
        ;;
esac
