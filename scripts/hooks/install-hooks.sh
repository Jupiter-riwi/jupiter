#!/usr/bin/env bash
# =============================================================================
# JÚPITER – Instalador de Git Hooks
# Copia/enlaza los hooks de scripts/hooks/ a .git/hooks/
#
# Uso: bash scripts/hooks/install-hooks.sh
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$ROOT/scripts/hooks"
HOOKS_DST="$ROOT/.git/hooks"

echo -e "${BLUE}🪐 Instalando git hooks de JÚPITER...${NC}"
echo ""

for hook in pre-commit pre-push; do
    src="$HOOKS_SRC/$hook"
    dst="$HOOKS_DST/$hook"

    if [ ! -f "$src" ]; then
        echo -e "${YELLOW}  ⚠ No se encontró $src — omitiendo${NC}"
        continue
    fi

    # Si ya existe un hook externo no nuestro, hacer backup
    if [ -f "$dst" ] && ! grep -q "JÚPITER" "$dst" 2>/dev/null; then
        cp "$dst" "${dst}.bak"
        echo -e "${YELLOW}  ⚠ Backup de hook existente → ${dst}.bak${NC}"
    fi

    cp "$src" "$dst"
    chmod +x "$dst"
    echo -e "${GREEN}  ✓ $hook instalado${NC}"
done

echo ""
echo -e "${GREEN}✓ Hooks instalados correctamente.${NC}"
echo ""
echo "  pre-commit  → lint rápido en archivos cambiados"
echo "  pre-push    → lint + test + build en servicios modificados"
echo "                (pipeline completo en ramas: developer, main)"
echo ""
echo -e "${BLUE}  Para desinstalar:${NC} make hooks-uninstall"
