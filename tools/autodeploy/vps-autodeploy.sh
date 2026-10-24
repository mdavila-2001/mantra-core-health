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
# **espera a que se aquiete** y entonces llama a Coolify y anota el sha nuevo.
#
# Es idempotente: correrlo mil veces sobre una rama quieta no dispara ni un
# despliegue.
#
# ## Por qué espera en vez de desplegar en el acto
#
# Un despliegue no es gratis: Coolify **reemplaza** el contenedor, y medido el
# 26/09/2026 cada uno tarda entre 8 y 17 minutos, con una ventana en la que el
# sitio devuelve 502. Ese día hubo **8 despliegues de la API** —uno por merge a
# `test`— y el resultado fue un entorno que se caía a ratos durante toda la
# jornada. Es la causa de los «no available server» que reportó el propietario;
# no era ni memoria ni un bug de la aplicación.
#
# Así que ahora, cuando la rama avanza, el sha queda como **candidato** y sólo
# se despliega si sigue siendo el mismo después de $AUTODEPLOY_REPOSO segundos.
# Tres merges seguidos se juntan en un despliegue en vez de tres.
#
# El tope $AUTODEPLOY_ESPERA_MAX existe porque en una rama con merges todo el
# día el reposo no llegaría nunca: pasado ese tiempo desde el primer cambio sin
# desplegar, se despliega lo que haya. Sin ese tope, «esperar a que se aquiete»
# se convierte en «no desplegar más».
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

# Cuánto tiene que estar quieta la rama antes de desplegar, y cuánto se puede
# posponer como máximo. Ver el encabezado.
REPOSO="${AUTODEPLOY_REPOSO:-900}"
ESPERA_MAX="${AUTODEPLOY_ESPERA_MAX:-2700}"
CANDIDATO="$ESTADO_DIR/candidato-sha"
CANDIDATO_VISTO="$ESTADO_DIR/candidato-visto"
PRIMER_CAMBIO="$ESTADO_DIR/primer-cambio"

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

# Tres intentos con espera, sin preguntar nada y con tope de tiempo.
#
# El 20/09/2026 el vigilante se pasó cinco horas anotando «no se pudo leer
# mockup (¿sin red?)» y el merge del propietario nunca se desplegó. La lectura
# de la rama es lo único de este guion que necesita credencial: el remoto es
# HTTPS privado y el ayudante es `osxkeychain`, que **no responde** cuando el
# llavero está bloqueado —la Mac durmió— ni mientras la red todavía no volvió
# al despertar. Sin `GIT_TERMINAL_PROMPT=0`, git además se queda esperando un
# usuario que en launchd no existe, y el intento muere por reloj en vez de
# fallar rápido.
#
# El último error queda en $ULTIMO_ERROR para que el diario diga QUÉ pasó y no
# sólo que pasó algo.
ULTIMO_ERROR=""
sha_remoto() {
  local intento salida
  for intento in 1 2 3; do
    salida="$(GIT_TERMINAL_PROMPT=0 timeout 30 git ls-remote "$REPO" "refs/heads/$RAMA" 2>&1)"
    if [ $? -eq 0 ]; then
      printf '%s' "$salida" | awk '{print $1}' | head -1
      return 0
    fi
    ULTIMO_ERROR="$(printf '%s' "$salida" | tr '\n' ' ' | head -c 160)"
    [ "$intento" -lt 3 ] && sleep $((intento * 5))
  done
  return 1
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
    rm -f "$CANDIDATO" "$CANDIDATO_VISTO" "$PRIMER_CAMBIO"
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
    if [ -f "$CANDIDATO" ]; then
      quieto=$(( $(date +%s) - $(cat "$CANDIDATO_VISTO" 2>/dev/null || date +%s) ))
      echo "en espera:   $(cat "$CANDIDATO") — quieto ${quieto}s de ${REPOSO}s"
    else
      echo "en espera:   (nada)"
    fi
    echo "diario:      $DIARIO"
    tail -5 "$DIARIO" 2>/dev/null
    exit 0
    ;;
  --forzar)
    FORZAR=true
    sha="$(sha_remoto)"
    [ -z "$sha" ] && { anotar "ERROR: no se pudo leer $RAMA de $REPO tras 3 intentos: ${ULTIMO_ERROR:-sin detalle}"; exit 1; }
    desplegar "$sha"
    exit $?
    ;;
esac

sha="$(sha_remoto)"
if [ -z "$sha" ]; then
  anotar "ERROR: no se pudo leer $RAMA de $REPO tras 3 intentos: ${ULTIMO_ERROR:-sin detalle}"
  exit 1
fi

if [ "$sha" = "$(cat "$ULTIMO" 2>/dev/null || true)" ]; then
  # La rama no se movió respecto de lo desplegado: en silencio, que esto corre
  # cada pocos minutos. Si había un candidato en espera, ya no aplica.
  rm -f "$CANDIDATO" "$CANDIDATO_VISTO" "$PRIMER_CAMBIO"
  exit 0
fi

ahora="$(date +%s)"
[ -f "$PRIMER_CAMBIO" ] || printf '%s' "$ahora" >"$PRIMER_CAMBIO"

if [ "$sha" != "$(cat "$CANDIDATO" 2>/dev/null || true)" ]; then
  # Sha nuevo: empieza a contar el reposo de cero. Un merge que llega mientras
  # esperamos posterga el despliegue, que es justamente lo que se busca.
  printf '%s' "$sha" >"$CANDIDATO"
  printf '%s' "$ahora" >"$CANDIDATO_VISTO"
  anotar "la rama avanzó a ${sha:0:8}; esperando ${REPOSO}s de reposo antes de desplegar"
  exit 0
fi

quieto=$(( ahora - $(cat "$CANDIDATO_VISTO" 2>/dev/null || printf '%s' "$ahora") ))
esperando=$(( ahora - $(cat "$PRIMER_CAMBIO" 2>/dev/null || printf '%s' "$ahora") ))

if [ "$quieto" -ge "$REPOSO" ]; then
  anotar "${sha:0:8} quieto ${quieto}s; desplegando"
elif [ "$esperando" -ge "$ESPERA_MAX" ]; then
  anotar "${sha:0:8} lleva ${esperando}s sin desplegar (tope ${ESPERA_MAX}s); desplegando aunque la rama siga moviéndose"
else
  exit 0   # todavía en reposo: en silencio
fi

desplegar "$sha"
