#!/usr/bin/env bash
# Redespliegue del frontend en cada commit nuevo de `dev`, detrás de un enlace
# que no cambia nunca.
#
# ## Las tres cosas que resuelve
#
# **1 · El enlace es fijo.** El túnel es un *dev tunnel* de Microsoft con
# identidad propia (`atlas-alovida.brs`): la URL sale del identificador del
# túnel, no del proceso que lo hospeda. Se puede matar el proceso, reiniciar la
# máquina o reconstruir todos los contenedores — la URL sigue siendo la misma.
# Es la diferencia con el *quick tunnel* de `trycloudflare` que usaba el
# supervisor anterior: aquel sorteaba un hostname nuevo en cada arranque, así
# que «no reiniciar nunca» era la única forma de conservarlo, y bastaba un corte
# de red para perderlo.
#
# **2 · Se despliega solo.** Cada pasada se trae `origin/dev`. Si avanzó, se
# reconstruye la imagen —desde un `git worktree` desprendido en ese commit, no
# desde la copia de trabajo— y se cambia el contenedor. Lo que sirve el enlace es
# exactamente `dev`: ni tu rama, ni lo que tengas sin guardar. El túnel apunta a
# un puerto fijo del host y NO se toca en el cambio: el enlace sobrevive a
# cualquier cantidad de despliegues.
#
# **3 · Gasta poca memoria.** Sirve el artefacto de producción (el Express de
# `dist/…/server/server.mjs`), no `ng serve`. La diferencia no es de matiz:
#
#   · `ng serve` en watch (docker-compose.yml)  → techo de 3 GB, y los usa
#   · este despliegue: SSR + nginx              → ~250 MB entre los dos
#
# El precio es que un cambio ya no se ve en caliente: hay que reconstruir. Para
# un enlace de demostración —que es lo que esto es— ese precio es el correcto,
# y es lo que permite tenerlo levantado sin ahogar a la base de datos.
#
# ## La forma
#
#   dev tunnel  →  127.0.0.1:4200  →  nginx (48 MB)  ┬─ /iam, /public, …  →  127.0.0.1:3010 (API)
#                                                    └─ /                 →  127.0.0.1:4000 (SSR)
#
# nginx está por la misma razón que en producción: los prefijos de la API tienen
# que salir del MISMO origen que la aplicación. Con `PUBLIC_API_BASE_URL` vacía
# el navegador pide `/iam/...` relativo, y sin nadie que enrute esos prefijos la
# petición muere en el servidor de renderizado. La configuración se genera a
# partir de `deploy/nginx.conf` —la de producción— cambiándole sólo los dos
# `upstream`: así lo que se demuestra es lo que se despliega.
#
# ## Uso
#
#   tools/redeploy/redeploy.sh once      # despliega el último commit de dev y sale
#   tools/redeploy/redeploy.sh una-vez   # una pasada del ciclo (lo que llama systemd)
#   tools/redeploy/redeploy.sh systemd   # instala el temporizador: sobrevive a los reinicios
#   tools/redeploy/redeploy.sh start     # deja el vigilante en segundo plano (sin systemd)
#   tools/redeploy/redeploy.sh status    # qué hay vivo y en qué commit
#   tools/redeploy/redeploy.sh url       # el enlace
#   tools/redeploy/redeploy.sh web       # relanza sólo el frontend (sin reconstruir)
#   tools/redeploy/redeploy.sh proxy     # relanza sólo nginx (sin reconstruir)
#   tools/redeploy/redeploy.sh logs      # las últimas líneas del diario
#   tools/redeploy/redeploy.sh stop      # baja vigilante, contenedores y túnel
#
# Todo se puede cambiar por entorno: REDEPLOY_RAMA, REDEPLOY_TUNEL,
# REDEPLOY_PUERTO, REDEPLOY_PUERTO_WEB, REDEPLOY_API_PUERTO, REDEPLOY_INTERVALO,
# REDEPLOY_MEM_WEB, REDEPLOY_HEAP_WEB, REDEPLOY_MEM_PROXY.

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ESTADO="$RAIZ/tools/redeploy/estado"
mkdir -p "$ESTADO"

RAMA="${REDEPLOY_RAMA:-dev}"

# El worktree desprendido desde el que se construye. Se crea y se borra en cada despliegue.
TRABAJO="$ESTADO/arbol"

# El túnel ya existe y es de la organización. Su puerto publicado es el 4200, y
# el número del puerto forma parte de la URL: cambiarlo acá cambiaría el enlace,
# que es justo lo que no puede pasar.
TUNEL="${REDEPLOY_TUNEL:-atlas-alovida.brs}"
PUERTO="${REDEPLOY_PUERTO:-4200}"

# Puerto del host donde escucha la API. 3000 es el que dan por supuesto el resto
# de piezas del repositorio (`BACKEND_ORIGIN` del compose, `proxy.conf.json`).
#
# **Se comprueba antes de creerle.** Esta máquina comparte puertos con otros
# proyectos: el 3010 —donde esta API estuvo alguna vez— hoy lo ocupa un front de
# Next.js de ATLAS, y apuntarle los prefijos clínicos a un desconocido es peor
# que no apuntarlos a nada. `comprobar_api` deja en el diario qué contestó.
#
# Se alcanza por `127.0.0.1` y no por `host.docker.internal` porque **esta
# máquina filtra el tráfico que entra desde los puentes de Docker**: un servicio
# del host que escucha en `0.0.0.0` no lo alcanza un contenedor ni por
# `172.17.0.1` ni por la puerta de su propia red — se comprobó, y da timeout.
# Por eso nginx corre en la red del host: desde ahí `127.0.0.1:$API_PUERTO` es la
# API, sin firewall de por medio y sin tocar ninguna regla del sistema.
API_PUERTO="${REDEPLOY_API_PUERTO:-3000}"

INTERVALO="${REDEPLOY_INTERVALO:-120}"

# Techos de memoria. `--memory-swap` igual a `--memory` le prohíbe al contenedor
# usar swap: en esta máquina el swap ya está caliente, y un proceso que se va a
# swap no se muere — se arrastra, y arrastra a todo lo demás con él.
MEM_WEB="${REDEPLOY_MEM_WEB:-768m}"
HEAP_WEB="${REDEPLOY_HEAP_WEB:-512}"   # heap de Node, por debajo del techo
MEM_PROXY="${REDEPLOY_MEM_PROXY:-48m}"

# El puerto del SSR en el host, sólo en loopback: es el que nginx tiene como
# `upstream frontend`. Fijo a propósito — así el proxy no depende de la IP que
# Docker le dé al contenedor y sobrevive a los cambios sin recargar nada.
PUERTO_WEB="${REDEPLOY_PUERTO_WEB:-4000}"

WEB=alovida-web
PROXY=alovida-proxy
IMAGEN=alovida-front
DEVTUNNEL="${DEVTUNNEL_BIN:-$HOME/bin/devtunnel}"

# La ruta resuelta del propio script: hace falta para relanzarse a sí mismo (ver
# `recargarse_si_cambio`), y `$0` puede ser relativa a donde lo invocaron.
RUTA="$RAIZ/tools/redeploy/redeploy.sh"

LOG="$ESTADO/redeploy.log"
URL_FILE="$ESTADO/URL"
TUNEL_LOG="$ESTADO/devtunnel.log"
TUNEL_PID="$ESTADO/devtunnel.pid"
VIGILANTE_PID="$ESTADO/vigilante.pid"
NGINX_GEN="$ESTADO/nginx.generado.conf"

log() { printf '%s | %s\n' "$(date -Is)" "$*" >> "$LOG"; printf '%s\n' "$*"; }

# ─── El túnel ────────────────────────────────────────────────────────────────

url_del_tunel() {
  # La URL no se «descubre» leyendo un log como con los quick tunnels: es un
  # dato del túnel y se puede consultar aunque no haya nadie hospedándolo.
  "$DEVTUNNEL" show "$TUNEL" 2>/dev/null \
    | grep -oE 'https://[a-z0-9-]+\.[a-z0-9-]+\.devtunnels\.ms/?' | head -1
}

# El túnel lo hospeda `atlas-devtunnel@atlas-alovida.service`, igual que los tres de ATLAS: un
# `oneshot` no puede ser el padre del proceso, porque systemd mata el cgroup del servicio al
# terminar la pasada y el enlace se quedaba muerto hasta el siguiente disparo del temporizador.
# Por eso el proceso se busca por su línea de órdenes y no sólo por el PID que dejamos escrito:
# el que manda puede haberlo arrancado systemd, y su PID cambia en cada reinicio suyo.
UNIDAD_TUNEL="atlas-devtunnel@${TUNEL%.brs}.service"

tunel_pid() {
  local pid
  if [ -f "$TUNEL_PID" ]; then
    pid="$(cat "$TUNEL_PID" 2>/dev/null)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then printf '%s\n' "$pid"; return 0; fi
  fi
  pgrep -f "devtunnel host ${TUNEL%.brs}" | head -1
}

tunel_proceso_vivo() {
  [ -n "$(tunel_pid)" ]
}

# El proceso puede estar vivo y el borde no servir. Se comprueba el borde, que
# es lo que ve quien abre el enlace. 401/302 cuentan como servido: el túnel pide
# identidad de la organización antes de dejar pasar.
tunel_responde() {
  local url codigo
  url="$(cat "$URL_FILE" 2>/dev/null)"
  [ -n "$url" ] || return 1
  codigo="$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$url" 2>/dev/null)"
  [ -n "$codigo" ] || codigo=000
  case "$codigo" in
    000|502|503|504) return 1 ;;
    *) return 0 ;;
  esac
}

arrancar_tunel() {
  # `--host-header` se deja en su valor por defecto (reescribe a `localhost`):
  # así el `server_name localhost` de la configuración de nginx sirve tal cual.
  setsid nohup "$DEVTUNNEL" host "$TUNEL" >>"$TUNEL_LOG" 2>&1 < /dev/null &
  echo $! > "$TUNEL_PID"
  sleep 5
  url_del_tunel > "$URL_FILE"
  log "TÚNEL: hospedando $TUNEL → $(cat "$URL_FILE") (local :$PUERTO)"
}

asegurar_tunel() {
  if ! tunel_proceso_vivo; then
    log "TÚNEL: no hay proceso; arrancando"
    arrancar_tunel
  elif ! tunel_responde; then
    log "TÚNEL: el proceso vive pero el borde no sirve; se rehospeda (el enlace NO cambia)"
    # Si lo hospeda systemd, rehospedar es reiniciar su unidad: matar el proceso a mano dejaría a
    # `Restart=always` levantando otro por su cuenta y a este script hospedando un duplicado.
    if systemctl --user is-active --quiet "$UNIDAD_TUNEL" 2>/dev/null; then
      systemctl --user restart "$UNIDAD_TUNEL"
      sleep 5
      url_del_tunel > "$URL_FILE"
      log "TÚNEL: rehospedado por $UNIDAD_TUNEL → $(cat "$URL_FILE") (local :$PUERTO)"
    else
      kill -TERM "$(tunel_pid)" 2>/dev/null
      sleep 3
      arrancar_tunel
    fi
  fi
}

# ─── La infraestructura ──────────────────────────────────────────────────────

generar_nginx() {
  local host_tunel host_tunel_alterno dominio id
  host_tunel="$(sed -E 's#https?://##; s#/$##' "$URL_FILE" 2>/dev/null)"
  # El túnel publica el enlace de dos formas —`<id>-<puerto>.<dominio>` y
  # `<id>.<dominio>:<puerto>`— y las dos tienen que pasar el `server_name`, o el
  # `default_server` que devuelve 421 se come una de ellas.
  dominio="${host_tunel#*.}"
  id="${host_tunel%%-*}"
  [ -n "$host_tunel" ] && host_tunel_alterno="${id}.${dominio}"

  # Cuatro sustituciones sobre la configuración de producción, y ninguna más:
  #   · los dos `upstream` apuntan a puertos de loopback del host en vez de a
  #     servicios de un compose;
  #   · los dos `listen` bajan del 80 al puerto del túnel — nginx corre en la red
  #     del host, así que el puerto que escucha ES el del host;
  #   · el `server_name` acepta además el hostname del túnel y `127.0.0.1`, para
  #     que una comprobación por IP no choque con el `default_server` que
  #     devuelve 421.
  sed -e "s#^\( *\)server api:3000;#\1server 127.0.0.1:${API_PUERTO};#" \
      -e "s#^\( *\)server web:4000;#\1server 127.0.0.1:${PUERTO_WEB};#" \
      -e "s#^\( *\)listen 80 default_server;#\1listen 127.0.0.1:${PUERTO} default_server;#" \
      -e "s#^\( *\)listen 80;#\1listen 127.0.0.1:${PUERTO};#" \
      -e "s#^\( *\)server_name localhost mantra-core-health.local;#\1server_name localhost 127.0.0.1 mantra-core-health.local ${host_tunel:-localhost} ${host_tunel_alterno:-localhost};#" \
      "$RAIZ/deploy/nginx.conf" > "$NGINX_GEN"
}

# El compose de desarrollo publica el MISMO puerto 4200 y levanta un `ng serve`
# de 3 GB. Si está vivo, no hay despliegue posible: el puerto está tomado y la
# memoria también.
apagar_dev_server() {
  local viejo=mantra-core-health-dev
  if [ -n "$(docker ps -q --filter "name=^${viejo}$")" ]; then
    log "DEV: el contenedor de desarrollo ($viejo) tiene el puerto $PUERTO y 3 GB; se para"
    docker stop -t 10 "$viejo" >/dev/null 2>&1
  fi
}

lanzar_proxy() {
  generar_nginx
  docker rm -f "$PROXY" >/dev/null 2>&1
  # Red del host: es lo que le permite hablar con la API por loopback (ver la
  # nota de API_PUERTO). La configuración generada escucha en
  # `127.0.0.1:$PUERTO`, así que sigue sin quedar expuesto a la red local — el
  # único que tiene que alcanzarlo es el proceso del túnel, que corre acá mismo.
  docker run -d --name "$PROXY" --network host --restart unless-stopped \
    --memory "$MEM_PROXY" --memory-swap "$MEM_PROXY" \
    -v "$NGINX_GEN:/etc/nginx/conf.d/default.conf:ro" \
    -v "$RAIZ/deploy/api-proxy.conf:/etc/nginx/api-proxy.conf:ro" \
    nginx:1.27-alpine >/dev/null || return 1
  log "PROXY: nginx en 127.0.0.1:$PUERTO (API → 127.0.0.1:$API_PUERTO · SSR → 127.0.0.1:$PUERTO_WEB)"
}

recargar_proxy() {
  # El `upstream` es un puerto fijo del host, así que un cambio de contenedor no
  # obliga a recargar. Se recarga igual por si la configuración se regeneró
  # —cambió el hostname del túnel, por ejemplo—: es instantáneo y no suelta el
  # puerto, así que el túnel ni se entera.
  generar_nginx
  docker exec "$PROXY" nginx -s reload >/dev/null 2>&1
}

proxy_vivo() { [ -n "$(docker ps -q --filter "name=^${PROXY}$")" ]; }

# Los hosts que el servidor de renderizado acepta atender.
#
# **Sin esto el enlace no sirve.** `AngularNodeAppEngine` compara el `Host` (y el
# `x-forwarded-host`, que el borde del túnel añade) contra una lista blanca, y lo
# que no está en ella se rechaza con un 400 en texto plano: «Header
# "x-forwarded-host" … is not allowed». El artefacto trae sellados los de
# `angular.json` —`localhost`, `127.0.0.1`, `mantra-core-health.local`—, que
# alcanzan para probar en local y **no** para entrar por el túnel. Por eso el
# dominio público se suma en ejecución, que es justo para lo que existe
# `SSR_ALLOWED_HOSTS` (ver `src/server/allowed-hosts.ts`).
#
# Se declaran las dos formas del enlace, porque el túnel publica las dos:
#   2ptbhqtv-4200.brs.devtunnels.ms   y   2ptbhqtv.brs.devtunnels.ms:4200
hosts_ssr() {
  local h dominio id
  h="$(sed -E 's#https?://##; s#/$##' "$URL_FILE" 2>/dev/null)"
  [ -n "$h" ] || { echo "localhost,127.0.0.1"; return; }
  dominio="${h#*.}"          # brs.devtunnels.ms
  id="${h%%-*}"              # 2ptbhqtv
  # Con puerto y sin él: el `Host` que manda el navegador lo lleva cuando la URL
  # lo lleva, y la comparación del SSR es literal.
  echo "${h},${h}:${PUERTO},${id}.${dominio},${id}.${dominio}:${PUERTO},localhost,127.0.0.1"
}

# Qué hay del otro lado de los prefijos de la API. No corrige nada —no es su
# trabajo levantar la API— pero lo deja dicho: un frontend que carga y no
# autentica se diagnostica en dos segundos si el diario ya lo cuenta.
comprobar_api() {
  local codigo
  codigo="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:${API_PUERTO}/" 2>/dev/null)"
  [ -n "$codigo" ] || codigo=000
  if [ "$codigo" = "000" ]; then
    log "API: nada escucha en 127.0.0.1:$API_PUERTO — el frontend cargará, pero no autentica."
    log "API:   levantá la API y, si no es el 3000, relanzá con REDEPLOY_API_PUERTO=<puerto>"
  else
    log "API: 127.0.0.1:$API_PUERTO responde $codigo"
  fi
}
web_vivo()   { [ -n "$(docker ps -q --filter "name=^${WEB}$")" ]; }

# ─── El despliegue ───────────────────────────────────────────────────────────

construir() {
  local etiqueta="$1" contexto="${2:-$RAIZ}"
  log "BUILD: construyendo $IMAGEN:$etiqueta (esto tarda unos minutos)"
  # `PUBLIC_API_BASE_URL` vacía a propósito: rutas relativas, un solo origen,
  # sin CORS. Es la decisión que documenta el propio Dockerfile.
  docker build -f "$contexto/Dockerfile" -t "$IMAGEN:$etiqueta" \
    --build-arg PUBLIC_API_BASE_URL= "$contexto" >>"$LOG" 2>&1
}

# Espera a que el contenedor se declare sano. El `HEALTHCHECK` de la imagen pide
# `/auth`, así que comprueba que el proceso responde Y que el paquete del
# navegador está donde el servidor lo busca.
esperar_sano() {
  local i estado
  for i in $(seq 1 60); do
    estado="$(docker inspect --format '{{.State.Health.Status}}' "$WEB" 2>/dev/null)"
    [ "$estado" = "healthy" ] && return 0
    [ "$estado" = "unhealthy" ] && return 1
    sleep 3
  done
  return 1
}

lanzar_web() {
  local etiqueta="$1"
  docker rm -f "$WEB" >/dev/null 2>&1
  docker run -d --name "$WEB" --restart unless-stopped \
    --memory "$MEM_WEB" --memory-swap "$MEM_WEB" \
    -p "127.0.0.1:${PUERTO_WEB}:4000" \
    -e "NODE_OPTIONS=--max-old-space-size=${HEAP_WEB}" \
    -e PORT=4000 -e PUBLIC_API_BASE_URL= \
    -e "SSR_ALLOWED_HOSTS=$(hosts_ssr)" \
    "$IMAGEN:$etiqueta" >/dev/null
}

# Deja como mucho dos imágenes nuestras: la que sirve y la anterior, que es a la
# que se vuelve si un despliegue sale mal. El resto es disco muerto.
podar_imagenes() {
  docker images "$IMAGEN" --format '{{.ID}} {{.Tag}}' | tail -n +3 \
    | while read -r id _; do docker rmi "$id" >/dev/null 2>&1; done
}

# Que el contenedor esté sano no basta, y este despliegue ya se rompió así: el
# `HEALTHCHECK` de la imagen pide `/auth` con `Host: 127.0.0.1`, que SIEMPRE está
# permitido, de modo que el contenedor se declaraba sano mientras el único camino
# que importa —la petición como llega por el enlace, con el host del túnel—
# devolvía 400. Se comprueba ese camino, y en cada ciclo: si algo lo rompe, se
# sabe en dos minutos y no cuando alguien abre el enlace.
comprobar_enlace() {
  local host_tunel codigo
  host_tunel="$(sed -E 's#https?://##; s#/$##' "$URL_FILE" 2>/dev/null)"
  [ -n "$host_tunel" ] || return 0
  codigo="$(curl -s -o /dev/null -w '%{http_code}' -m 15 \
    -H "Host: $host_tunel" -H "x-forwarded-host: $host_tunel" \
    "http://127.0.0.1:${PUERTO}/" 2>/dev/null)"
  [ -n "$codigo" ] || codigo=000
  if [ "$codigo" = "200" ]; then
    [ "${1:-}" = "silencioso" ] || log "ENLACE: la raíz con el host del túnel responde 200"
    return 0
  fi
  log "ENLACE: ⚠ la raíz con el host del túnel responde $codigo — el enlace NO sirve"
  log "ENLACE:   suele ser SSR_ALLOWED_HOSTS; mirá 'docker logs $WEB'"
  return 1
}

desplegar() {
  local sha commit anterior
  # Lo que se despliega es el último commit de `dev`, no la copia de trabajo. Antes se rebasaba
  # la rama local y se construía desde el árbol; eso hacía que un archivo sin guardar —una captura
  # sin commitear bastaba— congelara el despliegue en silencio durante horas, y que lo servido
  # fuese «dev más lo que hubiera por aquí», que no es lo que ve nadie más.
  sha="${1:-$(git -C "$RAIZ" rev-parse "origin/$RAMA" 2>/dev/null)}"
  commit="$(git -C "$RAIZ" rev-parse --short "$sha" 2>/dev/null)"
  [ -n "$commit" ] || { log "BUILD: ✗ no sé qué commit desplegar"; return 1; }
  anterior="$(docker inspect --format '{{.Config.Image}}' "$WEB" 2>/dev/null)"

  # Un worktree desprendido: el árbol de trabajo puede estar en otra rama y a medias, y esto ni
  # lo mira. Se borra al terminar, salga bien o mal.
  rm -rf "$TRABAJO"
  git -C "$RAIZ" worktree prune >/dev/null 2>&1
  git -C "$RAIZ" worktree add -q --detach "$TRABAJO" "$sha" 2>>"$LOG" || {
    log "BUILD: ✗ no pude crear el worktree en $commit"; return 1; }

  # Se construye ANTES de tocar nada: mientras dura el build, el contenedor
  # viejo sigue sirviendo. Una construcción fallida no deja el enlace caído.
  construir "$commit" "$TRABAJO" || {
    log "BUILD: ✗ falló; se conserva lo que está sirviendo ($anterior)"
    git -C "$RAIZ" worktree remove --force "$TRABAJO" >/dev/null 2>&1
    return 1
  }
  git -C "$RAIZ" worktree remove --force "$TRABAJO" >/dev/null 2>&1
  git -C "$RAIZ" worktree prune >/dev/null 2>&1

  apagar_dev_server
  lanzar_web "$commit"

  if ! esperar_sano; then
    log "DESPLIEGUE: ✗ $commit no llegó a sano"
    docker logs --tail 30 "$WEB" >> "$LOG" 2>&1
    if [ -n "$anterior" ] && [ "$anterior" != "$IMAGEN:$commit" ]; then
      log "DESPLIEGUE: volviendo a $anterior"
      docker rm -f "$WEB" >/dev/null 2>&1
      docker run -d --name "$WEB" --restart unless-stopped \
        --memory "$MEM_WEB" --memory-swap "$MEM_WEB" \
        -p "127.0.0.1:${PUERTO_WEB}:4000" \
        -e "NODE_OPTIONS=--max-old-space-size=${HEAP_WEB}" \
        -e PORT=4000 -e PUBLIC_API_BASE_URL= \
        -e "SSR_ALLOWED_HOSTS=$(hosts_ssr)" "$anterior" >/dev/null
      esperar_sano
    fi
    proxy_vivo && recargar_proxy
    return 1
  fi

  if proxy_vivo; then recargar_proxy; else lanzar_proxy; fi

  comprobar_enlace

  comprobar_api
  echo "$commit" > "$ESTADO/COMMIT_DESPLEGADO"
  podar_imagenes
  log "DESPLIEGUE: ✓ $commit sirviendo en $(cat "$URL_FILE" 2>/dev/null)"
}

# ─── El disparador: un commit nuevo en dev ───────────────────────────────────

revisar_repo() {
  local remoto corto fallido
  git -C "$RAIZ" fetch --quiet origin "$RAMA" 2>/dev/null || {
    log "FETCH: sin red o sin remoto; se reintenta en el próximo ciclo"
    return 0
  }
  remoto="$(git -C "$RAIZ" rev-parse "origin/$RAMA" 2>/dev/null)" || return 0
  corto="$(git -C "$RAIZ" rev-parse --short "$remoto")"
  [ "$corto" = "$(cat "$ESTADO/COMMIT_DESPLEGADO" 2>/dev/null)" ] && return 0

  # Un commit que ya demostró que no arranca no se reintenta cada dos minutos: sería reconstruir
  # y deshacer en bucle para llegar siempre al mismo sitio. Se anota y se espera a que `dev`
  # avance, que es lo único que puede arreglarlo.
  fallido="$(cat "$ESTADO/COMMIT_FALLIDO" 2>/dev/null || echo '')"
  [ "$corto" = "$fallido" ] && return 0

  log "FETCH: $RAMA está en $corto y se sirve $(cat "$ESTADO/COMMIT_DESPLEGADO" 2>/dev/null || echo 'nada'); desplegando"
  if desplegar "$remoto"; then
    rm -f "$ESTADO/COMMIT_FALLIDO"
  else
    echo "$corto" > "$ESTADO/COMMIT_FALLIDO"
    log "FETCH: anotado $corto como fallido; no se reintenta hasta que $RAMA avance"
  fi
}

# ─── Órdenes ─────────────────────────────────────────────────────────────────

# Bash no relee el archivo de un script en marcha: el vigilante se queda con el
# código que tenía al arrancar. Y este script vive en una rama que **se rebasa
# sola** cada vez que `dev` avanza, así que un arreglo recién commiteado no
# entraba en vigor hasta que alguien se acordaba de reiniciar el vigilante —
# entretanto seguía desplegando con la versión vieja. Pasó de verdad: un
# despliegue automático deshizo un arreglo ya commiteado y el enlace se rompió
# otra vez, con los contenedores sanos y verdes.
#
# `exec` conserva el PID, así que el archivo de PID sigue siendo válido.
FIRMA="$(cksum "$RUTA" 2>/dev/null | awk '{print $1, $2}')"

recargarse_si_cambio() {
  local ahora
  ahora="$(cksum "$RUTA" 2>/dev/null | awk '{print $1, $2}')"
  [ -n "$ahora" ] || return 0
  [ "$ahora" = "$FIRMA" ] && return 0
  log "VIGILANTE: el script cambió en disco; recargándose"
  exec "$RUTA" watch
}

ciclo() {
  asegurar_tunel
  proxy_vivo || { web_vivo && lanzar_proxy; }
  web_vivo   || { log "WEB: el contenedor no está vivo; desplegando"; desplegar; }

  # Si el enlace no sirve pero el contenedor vive, casi siempre es un frontend
  # levantado sin los hosts permitidos. Relanzarlo con la imagen que ya está
  # cuesta segundos y no toca el túnel; si aun así falla, el diario lo dice.
  if web_vivo && ! comprobar_enlace silencioso; then
    log "ENLACE: relanzando el frontend con el entorno correcto"
    lanzar_web "$(cat "$ESTADO/COMMIT_DESPLEGADO" 2>/dev/null || git -C "$RAIZ" rev-parse --short "origin/$RAMA")"
    esperar_sano && comprobar_enlace
  fi

  revisar_repo
}

case "${1:-once}" in
  once)
    log "=== despliegue puntual · rama $RAMA · túnel $TUNEL ==="
    asegurar_tunel
    apagar_dev_server
    desplegar
    ;;

  watch)
    log "=== vigilante arriba · rama $RAMA · cada ${INTERVALO}s ==="
    trap 'log "=== vigilante detenido ==="; exit 0' INT TERM
    while true; do recargarse_si_cambio; ciclo; sleep "$INTERVALO"; done
    ;;

  start)
    if [ -f "$VIGILANTE_PID" ] && kill -0 "$(cat "$VIGILANTE_PID")" 2>/dev/null; then
      log "El vigilante ya corre (pid $(cat "$VIGILANTE_PID"))"; exit 0
    fi
    setsid nohup "$RUTA" watch >>"$ESTADO/vigilante.out" 2>&1 < /dev/null &
    echo $! > "$VIGILANTE_PID"
    log "Vigilante en segundo plano (pid $(cat "$VIGILANTE_PID"))"
    ;;

  una-vez)
    # Una pasada y fuera. Es lo que invoca el temporizador de systemd, y es la forma
    # en que este despliegue sobrevive a un apagón: `start` deja un proceso suelto que
    # el reinicio se lleva —los contenedores vuelven por `restart=unless-stopped`, pero
    # nadie vuelve a mirar `dev`, y el enlace se queda sirviendo la versión de ayer sin
    # que nada parezca roto—. Un `oneshot` que el temporizador relanza cada minuto no
    # tiene ese estado que perder.
    #
    # `flock` sin espera porque una construcción pasa de los dos minutos del ciclo: si
    # la anterior sigue viva, esta se retira en silencio en vez de solaparse.
    exec 9>"$ESTADO/una-vez.lock"
    if ! flock -n 9; then
      log "PASADA: ya hay una en curso; esta se retira"
      exit 0
    fi
    ciclo
    ;;

  systemd)
    # Deja el despliegue en manos del temporizador de usuario y retira el vigilante suelto:
    # los dos a la vez construirían la misma imagen dos veces.
    #
    # `enable-linger` es la pieza que la gente olvida: sin él, las unidades de usuario sólo
    # viven mientras haya sesión iniciada, así que un reinicio sin login deja el enlace
    # servido por contenedores viejos y a nadie vigilando.
    UNIDADES="$HOME/.config/systemd/user"
    mkdir -p "$UNIDADES"
    if [ -f "$VIGILANTE_PID" ] && kill -0 "$(cat "$VIGILANTE_PID")" 2>/dev/null; then
      kill -TERM "$(cat "$VIGILANTE_PID")" 2>/dev/null
      rm -f "$VIGILANTE_PID"
      log "SYSTEMD: vigilante suelto retirado; a partir de ahora manda el temporizador"
    fi
    ln -sf "$RAIZ/tools/redeploy/systemd/alovida-redeploy.service" "$UNIDADES/"
    ln -sf "$RAIZ/tools/redeploy/systemd/alovida-redeploy.timer"   "$UNIDADES/"
    systemctl --user daemon-reload
    systemctl --user enable --now alovida-redeploy.timer >/dev/null 2>&1
    loginctl enable-linger "$USER" >/dev/null 2>&1 \
      && log "SYSTEMD: linger activo — el temporizador corre aunque nadie inicie sesión" \
      || log "SYSTEMD: ⚠ no se pudo activar linger; sólo correrá con sesión iniciada"
    log "SYSTEMD: temporizador instalado ($(systemctl --user is-active alovida-redeploy.timer))"
    systemctl --user list-timers alovida-redeploy.timer --no-pager
    ;;

  stop)
    [ -f "$VIGILANTE_PID" ] && kill -TERM "$(cat "$VIGILANTE_PID")" 2>/dev/null
    rm -f "$VIGILANTE_PID"
    [ -f "$TUNEL_PID" ] && kill -TERM "$(cat "$TUNEL_PID")" 2>/dev/null
    rm -f "$TUNEL_PID"
    docker rm -f "$PROXY" "$WEB" >/dev/null 2>&1
    log "Todo abajo. El enlace $(cat "$URL_FILE" 2>/dev/null) vuelve intacto con 'start'."
    ;;

  status)
    echo "rama        : origin/$RAMA @ $(git -C "$RAIZ" rev-parse --short "origin/$RAMA" 2>/dev/null) (tu copia local no interviene)"
    echo "desplegado  : $(cat "$ESTADO/COMMIT_DESPLEGADO" 2>/dev/null || echo '—')"
    echo "enlace      : $(cat "$URL_FILE" 2>/dev/null || url_del_tunel)"
    echo "túnel       : $(tunel_proceso_vivo && echo 'hospedado' || echo 'sin hospedar')"
    # Lo que de verdad se pregunta cuando se pregunta por el estado: si la
    # petición COMO LLEGA POR EL ENLACE funciona. En el ciclo esto es silencioso
    # mientras va bien, así que acá se dice siempre.
    echo "enlace sirve: $(comprobar_enlace silencioso >/dev/null 2>&1 && echo 'sí (200 con el host del túnel)' || echo '⚠ NO')"
    echo "API         : 127.0.0.1:$API_PUERTO → $(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:${API_PUERTO}/" 2>/dev/null)"
    # Quién vigila. Con el temporizador puesto, «vigilante: parado» es lo correcto y no una
    # avería: el bucle en segundo plano sobra, y decirlo aquí ahorra el susto de leerlo.
    echo "temporizador: $(systemctl --user is-active alovida-redeploy.timer 2>/dev/null || echo 'sin instalar') $([ "$(systemctl --user is-active alovida-redeploy.timer 2>/dev/null)" = active ] && echo '(manda systemd; el vigilante suelto sobra)')"
    echo "vigilante   : $( { [ -f "$VIGILANTE_PID" ] && kill -0 "$(cat "$VIGILANTE_PID")" 2>/dev/null && echo "pid $(cat "$VIGILANTE_PID")"; } || echo 'parado')"
    docker ps --filter "name=^${WEB}$" --filter "name=^${PROXY}$" \
      --format 'contenedor  : {{.Names}} · {{.Image}} · {{.Status}}'
    docker stats --no-stream --format 'memoria     : {{.Name}} · {{.MemUsage}}' "$WEB" "$PROXY" 2>/dev/null
    ;;

  proxy)
    # Sólo el proxy: regenera la configuración y lo relanza. Sirve para cambiar
    # el puerto de la API sin volver a construir la imagen del frontend.
    asegurar_tunel
    lanzar_proxy && comprobar_api
    ;;

  web)
    # Sólo el frontend, con la imagen que ya está: sirve para cambiarle el
    # entorno (los hosts permitidos, el techo de memoria) sin reconstruir.
    asegurar_tunel
    lanzar_web "$(cat "$ESTADO/COMMIT_DESPLEGADO" 2>/dev/null || git -C "$RAIZ" rev-parse --short "origin/$RAMA")"
    esperar_sano && log "WEB: relanzado y sano" || log "WEB: ✗ no llegó a sano"
    proxy_vivo && recargar_proxy
    ;;

  url)  cat "$URL_FILE" 2>/dev/null || url_del_tunel ;;
  logs) tail -n "${2:-40}" "$LOG" ;;

  *) sed -n '2,60p' "$0"; exit 1 ;;
esac
