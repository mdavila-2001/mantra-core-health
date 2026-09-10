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

if [ "$MODO" = auditoria ]; then
  if [ ! -f "$DEST/rutas.json" ]; then
    # Primera vez: todas las rutas sin parámetros del mapa de navegación.
    node -e '
      const s = require("fs").readFileSync("src/app/core/navigation/navigation.map.ts","utf8");
      const rutas = [...s.matchAll(/path:\s*\x27([^\x27]+)\x27/g)].map(m=>"/"+m[1]).filter(r=>!r.includes(":"));
      require("fs").writeFileSync(process.argv[1], JSON.stringify([...new Set(rutas)], null, 2));
    ' "$DEST/rutas.json"
    echo "Generado $DEST/rutas.json ($(node -e 'console.log(require(process.argv[1]).length)' "$DEST/rutas.json") rutas). Podalo si hace falta."
  fi
  CORR_FASE="$FASE" CORR_RUTA="$RUTA" corepack yarn pw playwright/corr-regla-visual.spec.ts --workers=1 --max-failures=1 --reporter=list
else
  CORR_LANE="$LANE" CORR_FASE="$FASE" CORR_RUTA="$RUTA" corepack yarn pw playwright/corr-evidencia.spec.ts --workers=1 --max-failures=1 --reporter=list
fi
echo "Evidencia en $DEST"
