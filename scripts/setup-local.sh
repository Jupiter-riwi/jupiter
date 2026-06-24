#!/usr/bin/env bash
set -euo pipefail

# Local setup helper for Apex Vision on macOS/Linux.
#
# Usage:
#   ./scripts/setup-local.sh
#   ./scripts/setup-local.sh --skip-install
#   ./scripts/setup-local.sh --skip-docker-check

SKIP_INSTALL=0
SKIP_DOCKER_CHECK=0
SKIP_ENV=0

for arg in "$@"; do
  case "$arg" in
    --skip-install)
      SKIP_INSTALL=1
      ;;
    --skip-docker-check)
      SKIP_DOCKER_CHECK=1
      ;;
    --skip-env)
      SKIP_ENV=1
      ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *)
      echo "[fail] Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

write_step() {
  printf '\n\033[36m[step]\033[0m %s\n' "$1"
}

write_ok() {
  printf '\033[32m[ok]\033[0m %s\n' "$1"
}

write_warn() {
  printf '\033[33m[warn]\033[0m %s\n' "$1"
}

write_fail() {
  printf '\033[31m[fail]\033[0m %s\n' "$1" >&2
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

assert_command() {
  local name="$1"
  local hint="$2"

  if has_command "$name"; then
    write_ok "$name detected"
    return 0
  fi

  write_fail "$name is not installed or is not in PATH."
  printf '       %s\n' "$hint"
  return 1
}

resolve_python() {
  if has_command python3.12; then
    printf 'python3.12'
  elif has_command python3; then
    printf 'python3'
  elif has_command python; then
    printf 'python'
  else
    return 1
  fi
}

run_logged() {
  local working_dir="$1"
  shift

  printf '       '
  printf '%q ' "$@"
  printf '\n'
  (cd "$working_dir" && "$@")
}

init_python_env() {
  local project_name="$1"
  local project_path="$2"
  local requirements_path="$3"
  local absolute_project_path="$REPO_ROOT/$project_path"
  local absolute_requirements_path="$REPO_ROOT/$requirements_path"
  local venv_path="$absolute_project_path/.venv"
  local python_exe="$venv_path/bin/python"

  if [[ ! -f "$absolute_requirements_path" ]]; then
    write_warn "$project_name skipped: $requirements_path does not exist"
    return 0
  fi

  if [[ ! -d "$venv_path" ]]; then
    printf '       Creating venv for %s\n' "$project_name"
    run_logged "$absolute_project_path" "$PYTHON_CMD" -m venv .venv
  else
    printf '       Reusing venv for %s\n' "$project_name"
  fi

  if [[ ! -x "$python_exe" ]]; then
    write_fail "Virtualenv Python was not found: $python_exe"
    return 1
  fi

  run_logged "$absolute_project_path" "$python_exe" -m pip install --upgrade pip
  run_logged "$absolute_project_path" "$python_exe" -m pip install -r "$absolute_requirements_path"
  write_ok "$project_name dependencies installed"
}

init_node_project() {
  local project_name="$1"
  local project_path="$2"
  local absolute_project_path="$REPO_ROOT/$project_path"
  local package_json="$absolute_project_path/package.json"

  if [[ ! -f "$package_json" ]]; then
    write_warn "$project_name skipped: package.json does not exist"
    return 0
  fi

  run_logged "$absolute_project_path" npm install
  write_ok "$project_name dependencies installed"
}

test_compose_file() {
  local compose_path="$1"
  local absolute_compose_path="$REPO_ROOT/$compose_path"

  if [[ ! -f "$absolute_compose_path" ]]; then
    write_warn "$compose_path does not exist"
    return 0
  fi

  printf '       Validating %s\n' "$compose_path"
  docker compose -f "$absolute_compose_path" config --quiet
  write_ok "$compose_path is valid"
}

test_dockerfile_references() {
  local compose_path="$1"
  local absolute_compose_path="$REPO_ROOT/$compose_path"

  if [[ ! -f "$absolute_compose_path" ]]; then
    return 0
  fi

  if [[ -z "$PYTHON_CMD" ]]; then
    write_warn "Dockerfile reference check skipped for $compose_path because Python is unavailable."
    return 0
  fi

  "$PYTHON_CMD" - "$absolute_compose_path" <<'PY'
from pathlib import Path
import re
import sys

compose_path = Path(sys.argv[1]).resolve()
compose_dir = compose_path.parent
current_context = None
entries = []

for line in compose_path.read_text(encoding="utf-8").splitlines():
    context_match = re.match(r"^\s+context:\s+(.+?)\s*$", line)
    dockerfile_match = re.match(r"^\s+dockerfile:\s+(.+?)\s*$", line)
    if context_match:
        current_context = context_match.group(1).strip().strip("\"'")
    elif dockerfile_match and current_context:
        dockerfile = dockerfile_match.group(1).strip().strip("\"'")
        entries.append((current_context, dockerfile))

missing = []
for context, dockerfile in entries:
    dockerfile_path = compose_dir / context / dockerfile
    if not dockerfile_path.exists():
        missing.append(str(dockerfile_path))
    else:
        print(f"[ok] Dockerfile found: {context}/{dockerfile}")

if missing:
    print("[fail] Compose references missing Dockerfiles:", file=sys.stderr)
    for path in missing:
        print(f"       {path}", file=sys.stderr)
    sys.exit(1)
PY
}

echo "Apex Vision local setup"
echo "Repo: $REPO_ROOT"

write_step "Checking base tools"
if PYTHON_CMD="$(resolve_python)"; then
  write_ok "$PYTHON_CMD detected"
else
  write_fail "Python is not installed or is not in PATH."
  echo "       Install Python 3.12 from https://www.python.org/downloads/ or your package manager."
  PYTHON_CMD=""
fi

NPM_OK=0
DOCKER_OK=0
assert_command npm "Install Node.js LTS from https://nodejs.org/ or your package manager." && NPM_OK=1 || true
assert_command docker "Install Docker Desktop, Colima, or Docker Engine and start it before running compose." && DOCKER_OK=1 || true

if [[ -z "$PYTHON_CMD" && "$SKIP_INSTALL" -eq 0 ]]; then
  write_fail "Python is required to install dependencies."
  exit 1
fi

if [[ "$SKIP_ENV" -eq 0 ]]; then
  write_step "Preparing local environment"
  if [[ ! -f .env && -f .env.example ]]; then
    cp .env.example .env
    write_warn ".env was created from .env.example. Fill API keys before starting AI workers."
  elif [[ -f .env ]]; then
    write_ok ".env already exists"
  else
    write_warn ".env.example was not found, .env was not created"
  fi
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  write_step "Installing Python dependencies"
  init_python_env "api-gateway" "api-gateway" "api-gateway/requirements.txt"
  init_python_env "ai-workers" "ai-workers" "ai-workers/requirements.txt"
  init_python_env "pose worker" "ai-workers/pose" "ai-workers/pose/requirements.txt"
  init_python_env "whisper worker" "ai-workers/whisper" "ai-workers/whisper/requirements.txt"
  init_python_env "infra migrations" "infra/migrations" "infra/migrations/requirements.txt"
  init_python_env "infra tests" "infra/tests" "infra/tests/requirements.txt"
  init_python_env "github-mcp" "github-mcp" "github-mcp/requirements.txt"

  write_step "Installing Node dependencies"
  if [[ "$NPM_OK" -eq 1 ]]; then
    init_node_project "body-detection" "body-detection"
    init_node_project "frontend" "frontend"
  else
    write_warn "Node dependencies skipped because npm is unavailable."
  fi
else
  write_warn "Install skipped by --skip-install"
fi

if [[ "$SKIP_DOCKER_CHECK" -eq 0 ]]; then
  write_step "Checking Docker setup"
  if [[ "$DOCKER_OK" -eq 1 ]]; then
    test_compose_file "docker-compose.yml"
    test_dockerfile_references "docker-compose.yml"
    test_compose_file "ai-workers/docker-compose.yml"
    test_dockerfile_references "ai-workers/docker-compose.yml"
  else
    write_warn "Docker check skipped because docker is unavailable."
  fi
else
  write_warn "Docker check skipped by --skip-docker-check"
fi

write_step "Summary"
echo "Current frontend: served as static files by nginx in docker-compose.yml."
echo "Frontend npm: skipped unless frontend/package.json exists."
echo "Full startup: ./scripts/start-mvp.ps1 on Windows or docker compose up -d --build on any Docker host."
echo "URLs: http://localhost:5173/Apex%20Vision%20Vendedor.html and http://localhost:8080/docs"
write_ok "Local setup finished"
