#!/bin/bash
# Instala (o quita, con --quitar) el vigilante que redespliega el VPS cuando
# `origin/mockup` avanza. Copia el guion a ~/.local/bin para que siga andando
# aunque se borre este worktree, y lo registra en launchd cada 3 minutos.
set -euo pipefail

ETIQUETA=bo.alovida.autodeploy
PLIST="$HOME/Library/LaunchAgents/$ETIQUETA.plist"
GUION="$HOME/.local/bin/alovida-autodeploy.sh"
DIARIO="$HOME/.local/state/alovida-autodeploy/launchd.log"
AQUI="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" = "--quitar" ]; then
  launchctl unload -w "$PLIST" 2>/dev/null || true
  rm -f "$PLIST" "$GUION"
  echo "Quitado."
  exit 0
fi

[ -f "$HOME/.config/alovida/coolify.env" ] || {
  echo "Falta ~/.config/alovida/coolify.env con COOLIFY_TOKEN='…'" >&2
  exit 1
}

mkdir -p "$(dirname "$GUION")" "$(dirname "$DIARIO")" "$(dirname "$PLIST")"
install -m 755 "$AQUI/vps-autodeploy.sh" "$GUION"
sed -e "s#RUTA_DEL_GUION#$GUION#" -e "s#RUTA_DEL_DIARIO#$DIARIO#" \
  "$AQUI/$ETIQUETA.plist" >"$PLIST"

launchctl unload -w "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"
echo "Instalado: cada 3 minutos mira origin/mockup y, si avanzó, redespliega."
echo "Estado:    $GUION --estado"
