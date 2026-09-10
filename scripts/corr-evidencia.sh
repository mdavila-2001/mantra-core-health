#!/usr/bin/env bash
# Evidencia fotográfica medida de un carril de correcciones (31–40).
#   scripts/corr-evidencia.sh 35                # después (asevera la regla)
#   scripts/corr-evidencia.sh 35 --antes        # línea base (no asevera)
#   scripts/corr-evidencia.sh 35 --ruta=/x      # una sola ruta
#   scripts/corr-evidencia.sh 34 --auditoria    # barrido global (carril 34)
# Siempre --workers=1 --max-failures=1 (lo exige .claude/hooks/resource_guard.py).
set -euo pipefail
cd "$(dirname "$0")/.."

LANE="${1:?carril (31-40)}"; shift || true
FASE=despues; RUTA=""; MODO=carril
for a in "$@"; do
  case "$a" in
    --antes) FASE=antes ;;
    --ruta=*) RUTA="${a#--ruta=}" ;;
    --auditoria|--solo-auditoria) MODO=auditoria ;;
  esac
done

if ! curl -sfI "${E2E_BASE_URL:-http://localhost:4200}" >/dev/null; then
  echo "El front no responde en ${E2E_BASE_URL:-http://localhost:4200}. Levantalo con 'corepack yarn start' y volvé a correr." >&2
  exit 2
fi

DEST="../docs/progress/evidence/lane-${LANE}"
mkdir -p "$DEST"

# La auditoría global es el carril 34: sus rutas salen de `playwright/corr-rutas.json`,
# que se regenera con `scripts/corr-rutas.mjs` desde el mapa de navegación. Un solo
# spec mide todo — dos implementaciones de la misma medición se separan en el primer
# arreglo que alguien haga en una sola.
if [ "$MODO" = auditoria ]; then LANE=34; fi
CORR_LANE="$LANE" CORR_FASE="$FASE" CORR_RUTA="$RUTA" corepack yarn pw playwright/corr-evidencia.spec.ts --workers=1 --max-failures=1 --reporter=list
echo "Evidencia en $DEST"
