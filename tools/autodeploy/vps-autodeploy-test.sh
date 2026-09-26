#!/bin/bash
# Vigila `origin/test` en los dos repos y redespliega las dos apps del VPS.
#
# Reusa `vps-autodeploy.sh` (mismo guion que ya vigila `mockup`), llamándolo
# dos veces con variables de entorno distintas: una por app. Cada pasada tiene
# su propio directorio de estado, así que no se pisan entre sí ni con el
# vigilante de `mockup`.
#
# Uso:
#   tools/autodeploy/vps-autodeploy-test.sh          # una pasada de las dos apps
#   tools/autodeploy/vps-autodeploy-test.sh --estado # qué está desplegado en cada una

set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="$HOME/.local/state/alovida-autodeploy-test"

# --- front: alovida-frontend, rama test -------------------------------------
AUTODEPLOY_RAMA=test \
AUTODEPLOY_REPO="https://github.com/mdavila-2001/mantra-core-health.git" \
AUTODEPLOY_APP="zslh6pytstjjgf5mexeopvkz" \
AUTODEPLOY_ESTADO="$BASE/front" \
  "$HOME/.local/bin/alovida-autodeploy.sh" "${1:-}"
r1=$?

# --- API: alovida-backend-central, rama test --------------------------------
AUTODEPLOY_RAMA=test \
AUTODEPLOY_REPO="https://github.com/mdavila-2001/mantra-core-health-api.git" \
AUTODEPLOY_APP="33sxkfqwp1axlkrishtgildb" \
AUTODEPLOY_ESTADO="$BASE/api" \
  "$HOME/.local/bin/alovida-autodeploy.sh" "${1:-}"
r2=$?

[ "$r1" -eq 0 ] && [ "$r2" -eq 0 ]
