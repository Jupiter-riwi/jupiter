#!/usr/bin/env bash
# ============================================================================
# Apex Vision — VPS deploy helper (Hetzner, single-origin HTTPS via Caddy).
#
#   ./deploy.sh up      build + start the whole stack (default)
#   ./deploy.sh seed    create the first tenant + admin/seller users
#   ./deploy.sh logs    tail logs (optionally: ./deploy.sh logs gateway)
#   ./deploy.sh ps      show service status
#   ./deploy.sh down    stop everything (keeps data volumes)
#   ./deploy.sh secrets print fresh random secrets you can paste into .env.prod
#
# Reads configuration from .env.prod (copy it from .env.prod.example first).
# ============================================================================
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=".env.prod"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file "$ENV_FILE")

c_red()  { printf '\033[31m%s\033[0m\n' "$*"; }
c_grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
c_yel()  { printf '\033[33m%s\033[0m\n' "$*"; }
c_bld()  { printf '\033[1m%s\033[0m\n' "$*"; }
die()    { c_red "✗ $*"; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || die "Docker no está instalado. Instalá Docker + el plugin compose."
  docker compose version >/dev/null 2>&1 || die "Falta el plugin 'docker compose'."
}

# Pull a value out of .env.prod without sourcing it (avoids running arbitrary code).
envval() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }

preflight() {
  [ -f "$ENV_FILE" ] || die "No existe $ENV_FILE. Hacé: cp .env.prod.example .env.prod  y editalo."

  local missing=()
  for k in APEX_DOMAIN DB_PASSWORD JWT_SECRET MINIO_SECRET_KEY; do
    local v; v="$(envval "$k")"
    if [ -z "$v" ] || printf '%s' "$v" | grep -q "CHANGE_ME"; then
      missing+=("$k")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    die "Faltan valores reales en $ENV_FILE: ${missing[*]} (todavía tienen el placeholder)."
  fi

  local jwt; jwt="$(envval JWT_SECRET)"
  [ "${#jwt}" -ge 32 ] || c_yel "⚠ JWT_SECRET es corto; usá: ./deploy.sh secrets"

  c_grn "✓ Preflight OK — dominio: $(envval APEX_DOMAIN)"
}

cmd_secrets() {
  c_bld "Pegá estos en .env.prod (cada vez son distintos):"
  printf 'JWT_SECRET=%s\n'        "$(openssl rand -hex 32)"
  printf 'DB_PASSWORD=%s\n'       "$(openssl rand -base64 24 | tr -d '/+=')"
  printf 'MINIO_SECRET_KEY=%s\n'  "$(openssl rand -base64 24 | tr -d '/+=')"
  printf 'RABBITMQ_PASS=%s\n'     "$(openssl rand -base64 18 | tr -d '/+=')"
}

wait_healthy() {
  local svc="$1" tries="${2:-60}" i st
  printf 'esperando %s' "$svc"
  for ((i=0; i<tries; i++)); do
    st="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "jupiter-$svc" 2>/dev/null || echo missing)"
    [ "$st" = "healthy" ] && { printf ' → healthy\n'; return 0; }
    printf '.'; sleep 2
  done
  printf '\n'; c_yel "⚠ $svc no llegó a healthy; revisá: ./deploy.sh logs $svc"
  return 1
}

cmd_up() {
  preflight
  c_bld "▶ Construyendo y levantando el stack…"
  "${COMPOSE[@]}" up -d --build
  wait_healthy gateway 90 || true
  wait_healthy frontend 60 || true
  wait_healthy caddy 30 || true
  c_grn "✓ Stack arriba."
  local dom; dom="$(envval APEX_DOMAIN)"
  echo
  c_bld "Probá:  https://$dom/seller    (admin: https://$dom/admin)"
  c_yel "Si es la primera vez, creá los usuarios:  ./deploy.sh seed"
}

cmd_seed() {
  preflight
  c_bld "▶ Sembrando tenant + usuarios demo…"
  "${COMPOSE[@]}" run --rm gateway ./seed
  c_grn "✓ Seed completo (seller.demo / admin.demo — cambiá las contraseñas)."
}

cmd_logs() { "${COMPOSE[@]}" logs -f --tail=120 "${1:-}"; }
cmd_ps()   { "${COMPOSE[@]}" ps; }
cmd_down() { "${COMPOSE[@]}" down; c_grn "✓ Detenido (los volúmenes de datos se conservan)."; }

require_docker
case "${1:-up}" in
  up)      cmd_up ;;
  seed)    cmd_seed ;;
  logs)    shift || true; cmd_logs "${1:-}" ;;
  ps)      cmd_ps ;;
  down)    cmd_down ;;
  secrets) cmd_secrets ;;
  *)       die "Comando desconocido: $1 (usá: up | seed | logs | ps | down | secrets)" ;;
esac
