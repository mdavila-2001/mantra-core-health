#!/usr/bin/env bash
# Auditoría de acabado premium (nombre accesible, globo, foco, target, tipografía,
# reduced motion). Complementa a `corr-evidencia.sh`, que mide la composición.
#
#   scripts/premium-visual.sh                 # carril 34, fase «después» (asevera)
#   scripts/premium-visual.sh 34 --antes       # línea base (no asevera)
#   scripts/premium-visual.sh 37 --ruta=/my-account
#   scripts/premium-visual.sh 34 --rutas=/my-account,/settings   # una familia
#   PREMIUM_USUARIO=paciente scripts/premium-visual.sh 34
#
# Siempre --workers=1 --max-failures=1 (lo exige .claude/hooks/resource_guard.py).
set -euo pipefail
cd "$(dirname "$0")/.."

LANE="${1:-34}"; shift || true
FASE=despues; RUTA=""; RUTAS=""
for a in "$@"; do
  case "$a" in
    --antes) FASE=antes ;;
    --ruta=*) RUTA="${a#--ruta=}" ;;
    --rutas=*) RUTAS="${a#--rutas=}" ;;
  esac
done

if ! curl -sfI "${E2E_BASE_URL:-http://localhost:4200}" >/dev/null; then
  echo "El front no responde en ${E2E_BASE_URL:-http://localhost:4200}. Levantalo con 'corepack yarn start' y volvé a correr." >&2
  exit 2
fi

DEST="../docs/progress/evidence/lane-${LANE}"
mkdir -p "$DEST"

PREMIUM_LANE="$LANE" PREMIUM_FASE="$FASE" PREMIUM_RUTA="$RUTA" PREMIUM_RUTAS="$RUTAS" \
  corepack yarn pw playwright/premium-visual.spec.ts --workers=1 --max-failures=1 --reporter=list
echo "Matriz y hallazgos en $DEST"
