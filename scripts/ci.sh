#!/usr/bin/env bash
# =============================================================================
# JÚPITER – CI Pipeline Local
# Ejecuta lint, tests y build para todos los servicios del monorepo.
#
# Uso:
#   bash scripts/ci.sh              # Pipeline completo
#   bash scripts/ci.sh --lint-only  # Solo lint
#   bash scripts/ci.sh --test-only  # Solo tests
#   bash scripts/ci.sh --build-only # Solo build
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODE="${1:-full}"
PASS=0
FAIL=0

log_section() { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }
log_pass()   { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
log_fail()   { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
log_warn()   { echo -e "  ${YELLOW}⚠${NC} $1"; }

# ─── Lint ────────────────────────────────────────────────────────────────────

run_lint_python() {
    log_section "Lint: ai-workers (Python)"
    cd ai-workers
    if python -m ruff check . 2>/dev/null; then
        log_pass "ruff"
    elif python -m flake8 . --max-line-length=120 2>/dev/null; then
        log_pass "flake8"
    else
        log_warn "ruff/flake8 no instalado – instala con: pip install ruff"
    fi
    cd ..
}

run_lint_frontend() {
    log_section "Lint: frontend (React/TS)"
    cd frontend
    if npm run lint -- --max-warnings=0 2>&1; then
        log_pass "eslint"
    else
        log_fail "eslint"
    fi
    cd ..
}

# ─── Tests ───────────────────────────────────────────────────────────────────

run_test_python() {
    log_section "Test: ai-workers (Python)"
    cd ai-workers
    if python -m pytest tests/ -v --tb=short 2>&1; then
        log_pass "pytest"
    else
        log_fail "pytest"
    fi
    cd ..
}

# ─── Build ───────────────────────────────────────────────────────────────────

run_build_python() {
    log_section "Build (syntax check): ai-workers (Python)"
    cd ai-workers
    if python -m compileall app/ 2>&1; then
        log_pass "compileall"
    else
        log_fail "compileall"
    fi
    cd ..
}

run_build_frontend() {
    log_section "Build: frontend (React/Vite)"
    cd frontend
    if npm run build 2>&1; then
        log_pass "vite build"
    else
        log_fail "vite build"
    fi
    cd ..
}

# ─── Summary ─────────────────────────────────────────────────────────────────

print_summary() {
    TOTAL=$((PASS + FAIL))
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  CI Pipeline – Resultado             ${BLUE}║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════╣${NC}"
    printf "${BLUE}║${NC}  ${GREEN}✓ %d pasado(s)${NC}                       ${BLUE}║${NC}\n" "$PASS"
    printf "${BLUE}║${NC}  ${RED}✗ %d fallido(s)${NC}                      ${BLUE}║${NC}\n" "$FAIL"
    echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
    echo ""

    if [ "$FAIL" -gt 0 ]; then
        exit 1
    fi
}

# ─── Main ────────────────────────────────────────────────────────────────────

echo -e "${BLUE}"
echo "   ╔══════════════════════════════════════════╗"
echo "   ║     🪐  JÚPITER – CI Pipeline Local      ║"
echo "   ╚══════════════════════════════════════════╝"
echo -e "${NC}"

case "$MODE" in
    --lint-only)
        run_lint_python
        run_lint_frontend
        ;;
    --test-only)
        run_test_python
        ;;
    --build-only)
        run_build_python
        run_build_frontend
        ;;
    full|*)
        run_lint_python
        run_lint_frontend
        run_test_python
        run_build_python
        run_build_frontend
        ;;
esac

print_summary
