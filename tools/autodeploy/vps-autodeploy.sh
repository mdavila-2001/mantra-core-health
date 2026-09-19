#!/bin/bash
# Vigila `origin/mockup` y redespliega el VPS cuando la rama avanza.
#
# ## Por qué existe
#
# Coolify ya tiene el autodeploy encendido en `mockup-frontend`, pero eso sólo
# significa «si me avisan, reconstruyo». Nadie le avisa: la aplicación se
# conecta por llave SSH y no por una GitHub App, así que no hay webhook.
#
# Crear ese webhook exige ser **administrador del repositorio**, y la cuenta
# con la que trabaja el equipo tiene `push` pero no `admin`. Un GitHub Action
# tampoco sirve: necesitaría un secreto del repositorio, que también pide
# administrador, y encima el CI corre en runners propios que suelen estar
# apagados.
#
# Esto rodea las tres cosas. No necesita permisos de GitHub —sólo leer una
# referencia pública con `git ls-remote`— ni entrar al servidor por SSH: le
# habla a la API de Coolify, que es la misma que usa el botón Redeploy.
#
# ## Qué hace, exactamente
#
# Cada vez que corre compara el sha de `origin/mockup` con el último que
# desplegó. Si son iguales no hace nada y sale en silencio. Si la rama avanzó,
# llama a Coolify y anota el sha nuevo.
#
# Es idempotente: correrlo mil veces sobre una rama quieta no dispara ni un
# despliegue.
#
# ## Uso
#
#   tools/autodeploy/vps-autodeploy.sh          # una pasada
#   tools/autodeploy/vps-autodeploy.sh --forzar # despliega aunque no haya cambio
#   tools/autodeploy/vps-autodeploy.sh --estado # qué está desplegado y qué hay en la rama
#
# Para que corra solo, ver `README.md` de esta carpeta.

set -uo pipefail

RAMA="${AUTODEPLOY_RAMA:-mockup}"
REPO="${AUTODEPLOY_REPO:-https://github.com/mdavila-2001/mantra-core-health.git}"
COOLIFY="${AUTODEPLOY_COOLIFY:-http://173.249.39.237:8000}"
APP="${AUTODEPLOY_APP:-miwmlirpzpz9p5hdvbx1urjo}"
ENV_TOKEN="${AUTODEPLOY_ENV:-$HOME/.config/alovida/coolify.env}"

ESTADO_DIR="${AUTODEPLOY_ESTADO:-$HOME/.local/state/alovida-autodeploy}"
ULTIMO="$ESTADO_DIR/ultimo-sha"
DIARIO="$ESTADO_DIR/autodeploy.log"

mkdir -p "$ESTADO_DIR"

anotar() {
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$DIARIO"
  printf '%s\n' "$*"
}

# El token no se pasa por la línea de órdenes: ahí lo ve cualquiera con `ps`.
leer_token() {
  if [ ! -f "$ENV_TOKEN" ]; then
    anotar "ERROR: no existe $ENV_TOKEN. Ahí va COOLIFY_TOKEN='…' (comillas simples: el | rompe el source en zsh)."
    return 1
  fi
  sed -n "s/^COOLIFY_TOKEN='\(.*\)'$/\1/p;s/^COOLIFY_TOKEN=\"\(.*\)\"$/\1/p;s/^COOLIFY_TOKEN=\([^'\"].*\)$/\1/p" "$ENV_TOKEN" | head -1
}

sha_remoto() {
  git ls-remote "$REPO" "refs/heads/$RAMA" 2>/dev/null | awk '{print $1}' | head -1
}

# `force=true` construye sin caché (18–30 min medidos el 17–18/09): sólo con
# --forzar. Un merge normal despliega con caché.
FORZAR=false

desplegar() {
  local token sha respuesta codigo
  token="$(leer_token)" || return 1
  if [ -z "$token" ]; then
    anotar "ERROR: $ENV_TOKEN no define COOLIFY_TOKEN."
    return 1
  fi
  sha="$1"

  respuesta="$(curl -sS -m 60 -o /tmp/autodeploy-respuesta.$$ -w '%{http_code}' \
    -X POST -H "Authorization: Bearer $token" \
    "$COOLIFY/api/v1/deploy?uuid=$APP&force=$FORZAR" 2>&1)"
  codigo="$respuesta"

  if [ "$codigo" = "200" ] || [ "$codigo" = "201" ]; then
    printf '%s' "$sha" >"$ULTIMO"
    anotar "DESPLEGADO ${sha:0:8} — Coolify respondió $codigo"
    rm -f "/tmp/autodeploy-respuesta.$$"
    return 0
  fi

  # No se anota el sha: así el próximo intento vuelve a probar en vez de dar
  # el despliegue por hecho.
  anotar "FALLÓ ${sha:0:8} — Coolify respondió $codigo: $(head -c 200 "/tmp/autodeploy-respuesta.$$" 2>/dev/null)"
  rm -f "/tmp/autodeploy-respuesta.$$"
  return 1
}

case "${1:-}" in
  --estado)
    echo "rama:        $RAMA"
    echo "en la rama:  $(sha_remoto)"
    echo "desplegado:  $(cat "$ULTIMO" 2>/dev/null || echo '(nada todavía)')"
    echo "diario:      $DIARIO"
    tail -5 "$DIARIO" 2>/dev/null
    exit 0
    ;;
  --forzar)
    FORZAR=true
    sha="$(sha_remoto)"
    [ -z "$sha" ] && { anotar "ERROR: no se pudo leer $RAMA de $REPO"; exit 1; }
    desplegar "$sha"
    exit $?
    ;;
esac

sha="$(sha_remoto)"
if [ -z "$sha" ]; then
  anotar "ERROR: no se pudo leer $RAMA de $REPO (¿sin red?)"
  exit 1
fi

if [ "$sha" = "$(cat "$ULTIMO" 2>/dev/null || true)" ]; then
  exit 0   # la rama no se movió: en silencio, que esto corre cada pocos minutos
fi

anotar "la rama avanzó a ${sha:0:8}; desplegando"
desplegar "$sha"
