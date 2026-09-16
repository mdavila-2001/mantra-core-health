#!/usr/bin/env bash
# =============================================================================
#  Redespliegue de la rama `mockup` detrás del Funnel de Tailscale.
#
#  El hermano pequeño de `redeploy.sh`, y a propósito mucho más simple: la rama
#  `mockup` no habla con ninguna API ni con ninguna base —el backend está dentro
#  del propio navegador—, así que no hace falta ni SSR, ni nginx con
#  `api-locations`, ni el baile de puertos del túnel. Lo único que hay que
#  publicar es el artefacto del navegador.
#
#  Qué hace, cada pasada:
#
#    1. Se trae `origin/mockup`. Si no avanzó desde lo que se está sirviendo,
#       termina sin hacer nada (dos segundos, sin tocar Docker).
#    2. Construye **dentro de un contenedor**, con la etapa `build` del
#       `Dockerfile` del repositorio: la misma que se usa para desplegar en un
#       VPS, así que si compila aquí compila allá. Con techo de memoria, que en
#       esta máquina no es opcional: el swap ya está caliente y una construcción
#       sin límite se lleva por delante a Postgres —ya pasó una vez—.
#    3. Extrae `dist/.../browser` de la imagen a `publico/entregas/<sha>/` y
#       mueve el enlace `publico/actual` a la entrega nueva. El cambio es de un
#       tirón —`mv -T` de un enlace simbólico es atómico— y sin `rsync` encima
#       de lo que se está sirviendo: a mitad de un `rsync` la página queda con
#       el `index` nuevo pidiendo fragmentos que aún no existen, y quien la
#       tenga abierta ve una pantalla en blanco.
#
#       Por qué un enlace y no mover el directorio servido: **el contenedor de
#       nginx monta ese directorio**, y un `mv` le cambia el inodo debajo. El
#       montaje se queda apuntando al directorio viejo —que este script acababa
#       de borrar— y todo devuelve 404 hasta que alguien recrea el contenedor.
#       Pasó, y por eso está escrito aquí. Lo que se monta es `publico/`
#       entero; nginx resuelve `root .../actual` en cada petición, así que ve el
#       enlace nuevo sin enterarse de nada.
#    4. Anota el commit servido. Es lo que hace que la pasada siguiente no
#       vuelva a construir lo mismo.
#
#  El contenedor que sirve (`alovida-mockup`, nginx) no se reinicia nunca: monta
#  el directorio, así que con cambiar el contenido ya está.
#
#  Uso:
#    mockup.sh una-vez     una pasada (lo que dispara el temporizador)
#    mockup.sh forzar      construye aunque el commit no haya cambiado
#    mockup.sh estado      qué se está sirviendo
# =============================================================================

set -euo pipefail

RAMA="${MOCKUP_RAMA:-mockup}"
RAIZ="${MOCKUP_RAIZ:-/opt/alovida-mockup/repo}"
PUBLICO="${MOCKUP_PUBLICO:-/opt/alovida-mockup/publico}"
ESTADO="${MOCKUP_ESTADO:-/opt/alovida-mockup/estado}"
CONTENEDOR="${MOCKUP_CONTENEDOR:-alovida-mockup}"
# 6 GB y no 4: con 4 la construcción de Angular moría en esbuild con un
# `deadlock` que no menciona la memoria por ninguna parte (salida 129). El pico
# medido con 447 componentes y sus fragmentos diferidos ronda los 4,5 GB.
MEMORIA="${MOCKUP_MEMORIA:-6g}"
# El techo de memoria + swap del contenedor. **Mayor que `MEMORIA` a propósito:**
# cuando los dos valores coinciden, Docker le prohíbe el swap al contenedor, y
# entonces el límite deja de ser un techo y pasa a ser una sentencia — si la
# máquina no tiene los 6 GB libres en RAM, el kernel mata la construcción con
# `exit code: 137` en vez de dejarla desbordar. Es lo que pasó el 15/09/2026:
# la H310 estaba con 5 GiB disponibles sosteniendo el resto de la plataforma, y
# siete despliegues seguidos murieron ahí. Con holgura de swap la construcción
# se vuelve lenta, que es mucho mejor que imposible.
MEMORIA_SWAP="${MOCKUP_MEMORIA_SWAP:-10g}"
URL="${MOCKUP_URL:-https://pablo-h310.taila8f993.ts.net:8443}"

BITACORA="$ESTADO/redeploy.log"
CERROJO="$ESTADO/una-vez.lock"

mkdir -p "$ESTADO"

log() {
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$BITACORA"
}

commit_servido() {
  cat "$ESTADO/COMMIT_DESPLEGADO" 2>/dev/null || echo ''
}

construir_y_publicar() {
  local sha="$1" corto="${1:0:7}"
  local imagen="alovida-mockup-build:$corto"

  log "BUILD: construyendo $corto"
  # `--target build` se queda en la etapa que compila: no hace falta la imagen
  # de ejecución, sólo su `dist/`.
  if ! docker build --target build --memory "$MEMORIA" --memory-swap "$MEMORIA_SWAP" \
      -t "$imagen" "$RAIZ" >>"$BITACORA" 2>&1; then
    log "BUILD: FALLÓ $corto — se sigue sirviendo $(commit_servido)"
    # Se anota el fallo para no reintentar en bucle cada dos minutos contra un
    # commit que no compila: hasta que la rama avance, no se vuelve a intentar.
    echo "$sha" >"$ESTADO/COMMIT_FALLIDO"
    return 1
  fi

  local contenedor entrega="$PUBLICO/entregas/$corto"
  contenedor="$(docker create "$imagen")"
  rm -rf "$entrega"
  mkdir -p "$entrega"
  docker cp "$contenedor:/app/dist/mantra-core-health/browser/." "$entrega/" >>"$BITACORA" 2>&1
  docker rm -f "$contenedor" >/dev/null

  if [[ ! -f "$entrega/index.csr.html" ]]; then
    log "BUILD: el artefacto no trae index.csr.html — no se publica"
    rm -rf "$entrega"
    return 1
  fi

  # El cambio, de un tirón: `ln -sfn` sobre un enlace que ya existe no es
  # atómico —lo borra y lo crea—, así que se crea al lado y se mueve con
  # `mv -T`, que sí lo es.
  ln -sfn "entregas/$corto" "$PUBLICO/.actual.nuevo"
  mv -T "$PUBLICO/.actual.nuevo" "$PUBLICO/actual"

  echo "$sha" >"$ESTADO/COMMIT_DESPLEGADO"
  rm -f "$ESTADO/COMMIT_FALLIDO"

  # Limpieza: las imágenes de construcción se acumulan rápido y esta máquina
  # comparte disco con la base de datos.
  docker image prune -f --filter 'label=stage=build' >/dev/null 2>&1 || true
  docker images 'alovida-mockup-build' --format '{{.Repository}}:{{.Tag}}' | tail -n +4 |
    xargs -r docker rmi >/dev/null 2>&1 || true

  # Se guardan las tres últimas entregas: volver atrás es mover el enlace.
  ls -1dt "$PUBLICO/entregas"/*/ 2>/dev/null | tail -n +4 | xargs -r rm -rf

  log "OK: sirviendo $corto en $URL"
}

una_pasada() {
  git -C "$RAIZ" fetch --quiet origin "$RAMA" || {
    log "FETCH: no se pudo hablar con origin; se deja lo que hay"
    return 0
  }
  local remoto corto
  remoto="$(git -C "$RAIZ" rev-parse "origin/$RAMA")"
  corto="${remoto:0:7}"

  if [[ "$remoto" == "$(commit_servido)" ]]; then
    return 0
  fi
  if [[ "$remoto" == "$(cat "$ESTADO/COMMIT_FALLIDO" 2>/dev/null || echo '')" ]]; then
    log "FETCH: $corto ya falló antes; esperando a que la rama avance"
    return 0
  fi

  local servido; servido="$(commit_servido)"
  log "FETCH: $RAMA está en $corto y se sirve ${servido:-nada}; desplegando"
  git -C "$RAIZ" reset --hard --quiet "origin/$RAMA"
  construir_y_publicar "$remoto"
}

case "${1:-una-vez}" in
  una-vez)
    # `flock` sin espera: si la pasada anterior sigue construyendo, esta se va.
    exec 9>"$CERROJO"
    flock -n 9 || { log "otra pasada en curso; esta se salta"; exit 0; }
    una_pasada
    ;;
  forzar)
    exec 9>"$CERROJO"
    flock -n 9 || exit 1
    git -C "$RAIZ" fetch --quiet origin "$RAMA"
    git -C "$RAIZ" reset --hard --quiet "origin/$RAMA"
    construir_y_publicar "$(git -C "$RAIZ" rev-parse "origin/$RAMA")"
    ;;
  estado)
    echo "rama       : origin/$RAMA @ $(git -C "$RAIZ" rev-parse --short "origin/$RAMA" 2>/dev/null || echo '?')"
    servido="$(commit_servido)"
    echo "sirviendo  : ${servido:-nada}"
    echo "url        : $URL"
    echo "contenedor : $(docker inspect -f '{{.State.Status}}' "$CONTENEDOR" 2>/dev/null || echo 'no existe')"
    echo "bitácora   : $BITACORA"
    ;;
  *)
    echo "uso: $0 {una-vez|forzar|estado}" >&2
    exit 2
    ;;
esac
