#!/bin/sh
# Instala el pre-commit anti índice ajeno en los repos de ALOVIDA (front, api, mobile).
#
#   sh scripts/instalar-hooks.sh [raíz-de-alovida]
#
# - Escribe en el directorio de hooks REAL de cada repo: `core.hooksPath` si está fijado, si no
#   `<git-common-dir>/hooks`. Los worktrees comparten ese directorio, así que basta una vez por repo.
# - NO toca post-commit / post-checkout (graphify) ni pre-push (.githooks). Si ya había un
#   `pre-commit` ajeno, lo conserva como `pre-commit.encadenado` y lo ejecuta después del nuestro.
# - Idempotente: reinstalar sobreescribe sólo nuestro hook (lleva la marca alovida-pre-commit).
set -eu
ORIGEN="$(cd "$(dirname "$0")" && pwd)/git-hooks/pre-commit"
RAIZ="${1:-$(cd "$(dirname "$0")/../.." && pwd)}"
for repo in mantra-core-health mantra-core-health-redesa-api mantra_core_health_mobile; do
  dir="$RAIZ/$repo"
  [ -e "$dir/.git" ] || { echo "salto $repo (no existe en $RAIZ)"; continue; }
  hp="$(git -C "$dir" config --get core.hooksPath || true)"
  if [ -n "$hp" ]; then
    case "$hp" in /*) hooks="$hp" ;; *) hooks="$dir/$hp" ;; esac
  else
    common="$(git -C "$dir" rev-parse --git-common-dir)"
    case "$common" in /*) ;; *) common="$dir/$common" ;; esac
    hooks="$common/hooks"
  fi
  mkdir -p "$hooks"
  destino="$hooks/pre-commit"
  if [ -f "$destino" ] && ! grep -q 'alovida-pre-commit-anti-indice-ajeno' "$destino"; then
    mv "$destino" "$hooks/pre-commit.encadenado"
    echo "$repo: hook previo conservado como pre-commit.encadenado"
  fi
  cp "$ORIGEN" "$destino"
  chmod +x "$destino"
  echo "$repo: instalado en $hooks/pre-commit"
done
