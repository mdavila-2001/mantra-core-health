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
#   tools/redeploy/redeploy.sh webhook   # despliegue inmediato por webhook de GitHub (además del temporizador)
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

# Cómo se llega al despliegue desde fuera de la máquina.
#
#   tailscale  · `tailscale funnel`: el nombre de la máquina en la tailnet
#                (`<host>.<tailnet>.ts.net`) servido por HTTPS, con certificado
#                automático y sin sesión que caduque. Es el que se usa.
#   devtunnel  · el dev tunnel de Microsoft. Se conserva porque el enlace que
#                circula por ahí es suyo, pero pide `devtunnel user login` cada
#                vez que la sesión vence, y eso ya dejó el enlace muerto.
#   ninguna    · sólo local, sin exponer nada.
#
# Con `tailscale`, el nombre no se elige ni se sortea: es el de la máquina, y
# sobrevive a reinicios, a cambios de IP y a que el proceso se caiga.
EXPOSICION="${REDEPLOY_EXPOSICION:-tailscale}"

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

# `WEB` y `PROXY` son el nombre EN USO y pueden pasar a `…-rescate` (ver
# `nombre_libre`); `*_BASE` es el nombre de siempre, que es contra el que se
# busca. Separarlos evita que un rescate se convierta en `…-rescate-rescate`.
WEB_BASE=alovida-web
PROXY_BASE=alovida-proxy
WEB="$WEB_BASE"
PROXY="$PROXY_BASE"
IMAGEN=alovida-front
# El binario del túnel. El instalador oficial lo deja en `~/bin/devtunnel` tanto
# en Linux como en macOS, y si está en el PATH se usa el del PATH.
DEVTUNNEL="${DEVTUNNEL_BIN:-$HOME/bin/devtunnel}"
[ -x "$DEVTUNNEL" ] || DEVTUNNEL="$(command -v devtunnel 2>/dev/null || printf '%s' "$DEVTUNNEL")"

# La ruta resuelta del propio script: hace falta para relanzarse a sí mismo (ver
# `recargarse_si_cambio`), y `$0` puede ser relativa a donde lo invocaron.
RUTA="$RAIZ/tools/redeploy/redeploy.sh"

# Cómo alcanza un contenedor al host, que **no es lo mismo en Linux que en macOS**.
#
# En la máquina Linux original se usa `--network host`: ahí el contenedor comparte
# la pila de red del host, así que `127.0.0.1` es el host de verdad y se esquiva
# el firewall que filtra el tráfico de los puentes de Docker (la nota de
# API_PUERTO).
#
# En macOS eso **no existe**. Docker Desktop corre los contenedores dentro de una
# VM Linux, y `--network host` los mete en la red de LA VM, no en la del Mac. Se
# comprobó y es exactamente lo que pasaba: nginx respondía 200 desde dentro del
# contenedor mientras `lsof -iTCP:4200` en el Mac no encontraba a nadie
# escuchando — el túnel, que corre en macOS, no tenía a quién hablarle y el
# enlace daba 000. Ahí la forma correcta es la contraria: publicar el puerto y
# llamar al host por `host.docker.internal`.
if [ "$(uname -s)" = "Darwin" ]; then
  HOST_DESDE_CONTENEDOR=host.docker.internal
  RED_DEL_HOST=no
else
  HOST_DESDE_CONTENEDOR=127.0.0.1
  RED_DEL_HOST=si
fi

LOG="$ESTADO/redeploy.log"
URL_FILE="$ESTADO/URL"
TUNEL_LOG="$ESTADO/devtunnel.log"
TUNEL_PID="$ESTADO/devtunnel.pid"
VIGILANTE_PID="$ESTADO/vigilante.pid"
NGINX_GEN="$ESTADO/nginx.generado.conf"

# `date -Is` es de GNU: el `date` de BSD —el de macOS, donde también se corre
# esto— responde `invalid argument 's' for -I` y deja cada línea del diario sin
# marca de tiempo. El formato explícito da la misma cadena ISO 8601 en los dos.
ahora() { date +%Y-%m-%dT%H:%M:%S%z; }

# `setsid` es de util-linux y **no existe en macOS**, donde también se corre
# esto. Sin él, las dos líneas que dejaban algo en segundo plano morían con un
# `command not found` y el proceso no llegaba a arrancar: el vigilante figuraba
# «parado» un segundo después de decir que estaba arriba, y el enlace se quedaba
# sin nadie que lo reconstruyera.
#
# Lo que `setsid` aporta es desligar al hijo del grupo de procesos de la
# terminal, para que un cierre de sesión no se lo lleve; `nohup` ya lo protege
# de SIGHUP, que es el 95 % del caso. Donde `setsid` está se usa —no se pierde
# nada—, y donde no, el `nohup` suelto hace el trabajo.
en_segundo_plano() {
  if command -v setsid >/dev/null 2>&1; then
    setsid nohup "$@" &
  else
    nohup "$@" &
  fi
}

log() { printf '%s | %s\n' "$(ahora)" "$*" >> "$LOG"; printf '%s\n' "$*"; }

# `flock` es de util-linux y tampoco existe en macOS. Ahí el `command not found`
# hacía que la condición se leyera al revés —127 es «falló», y la guarda es un
# `if ! flock`—: cada pasada del temporizador creía que ya había otra en curso y
# se retiraba sin desplegar nada. `mkdir` es atómico en cualquier sistema de
# archivos y no necesita nada instalado.
CERROJO="$ESTADO/una-vez.lock.d"

tomar_cerrojo() {
  if ! mkdir "$CERROJO" 2>/dev/null; then
    local dueno
    dueno="$(cat "$CERROJO/pid" 2>/dev/null)"
    # El precio de un cerrojo que no es del núcleo: si la pasada dueña muere sin
    # soltarlo, nadie lo suelta por ella y el despliegue queda parado para
    # siempre. Por eso se comprueba de quién es antes de creerle.
    if [ -n "$dueno" ] && kill -0 "$dueno" 2>/dev/null; then return 1; fi
    [ -e "$CERROJO" ] && log "PASADA: cerrojo huérfano de la pasada ${dueno:-?}; se recoge"
    rm -rf "$CERROJO"
    mkdir "$CERROJO" 2>/dev/null || return 1
  fi
  echo $$ > "$CERROJO/pid"
  trap 'rm -rf "$CERROJO"' EXIT
  return 0
}

# ─── Tailscale ───────────────────────────────────────────────────────────────

# El nombre público de esta máquina en la tailnet, con el punto final quitado.
#
# `--peers=false` no es cosmético: sin él el JSON trae un `DNSName` por cada
# máquina de la tailnet y quedarse con el primero es apostar a que el nuestro
# venga antes que los demás.
nombre_tailscale() {
  tailscale status --peers=false --json 2>/dev/null \
    | sed -n 's/.*"DNSName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -1 | sed 's/\.$//'
}

# Funnel expone a INTERNET, así que sólo se toca si se pidió `tailscale`.
# Requisitos que no se pueden resolver desde acá y por eso se explican:
#   · Funnel habilitado en la tailnet (lo aprueba el dueño en la consola);
#   · el usuario, operador de tailscale, o hará falta sudo en cada pasada.
asegurar_funnel() {
  local nombre salida
  if ! command -v tailscale >/dev/null 2>&1; then
    log "TAILSCALE: ✗ no está instalado en esta máquina"
    return 1
  fi
  nombre="$(nombre_tailscale)"
  if [ -z "$nombre" ]; then
    log "TAILSCALE: ✗ no hay sesión ('tailscale up'), o MagicDNS está apagado"
    return 1
  fi
  printf 'https://%s/\n' "$nombre" > "$URL_FILE"

  # Ya servido y apuntando a donde toca: no se toca nada. `funnel` es
  # idempotente, pero rehacerlo en cada pasada ensucia el diario.
  if tailscale funnel status 2>/dev/null | grep -q "127.0.0.1:${PUERTO}"; then
    log "TAILSCALE: funnel sirviendo https://$nombre → 127.0.0.1:$PUERTO"
    return 0
  fi

  salida="$(tailscale funnel --bg "$PUERTO" 2>&1 </dev/null)"
  if [ $? -ne 0 ] || printf '%s' "$salida" | grep -qi 'not enabled\|denied\|access'; then
    log "TAILSCALE: ✗ no pude activar el funnel:"
    printf '%s\n' "$salida" | head -6 | while IFS= read -r linea; do log "TAILSCALE:   $linea"; done
    log "TAILSCALE:   si pide habilitarlo, abrí ese enlace: lo aprueba el dueño de la tailnet."
    log "TAILSCALE:   si pide permisos, corré una vez: sudo tailscale set --operator=\$USER"
    return 1
  fi
  log "TAILSCALE: funnel sirviendo https://$nombre → 127.0.0.1:$PUERTO"
}

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

# Sin binario no hay enlace, y callarlo es lo peor que puede hacer este script:
# el diario decía «hospedando … → » y «✓ sirviendo en » con la URL vacía, así que
# el despliegue **parecía correcto** mientras nadie podía entrar. Lo que fallaba
# —`nohup: …/devtunnel: No such file or directory`— quedaba enterrado en
# `devtunnel.log`, que nadie mira cuando el resumen dice ✓.
hay_devtunnel() {
  [ -x "$DEVTUNNEL" ] && return 0
  log "TÚNEL: ✗ no hay binario en '$DEVTUNNEL'. El despliegue local sigue, pero NO habrá enlace."
  log "TÚNEL:   instálalo con  curl -sL https://aka.ms/DevTunnelCliInstall | bash"
  log "TÚNEL:   o apunta al tuyo con  DEVTUNNEL_BIN=/ruta/a/devtunnel"
  return 1
}

arrancar_tunel() {
  hay_devtunnel || return 1
  # `--host-header` se deja en su valor por defecto (reescribe a `localhost`):
  # así el `server_name localhost` de la configuración de nginx sirve tal cual.
  en_segundo_plano "$DEVTUNNEL" host "$TUNEL" >>"$TUNEL_LOG" 2>&1 < /dev/null
  local pid=$!
  echo "$pid" > "$TUNEL_PID"
  sleep 5
  # La URL se escribe siempre que se pueda: `show` la sirve aunque no hospede
  # nadie, y tenerla es lo que permite generar el `server_name` de nginx.
  url_del_tunel > "$URL_FILE"

  # **Que haya URL no significa que estemos hospedando.** `devtunnel show` contesta
  # sin sesión iniciada, así que el paso anterior llenaba el archivo y el diario
  # decía «hospedando» mientras el proceso había muerto un segundo antes con
  # `Tunnel service response status code: Unauthorized`. Se pregunta por el proceso,
  # que es lo que de verdad sostiene el enlace.
  if ! kill -0 "$pid" 2>/dev/null; then
    log "TÚNEL: ✗ el proceso murió al arrancar. Últimas líneas de su diario:"
    tail -n 5 "$TUNEL_LOG" 2>/dev/null | while IFS= read -r linea; do log "TÚNEL:   $linea"; done
    log "TÚNEL:   si dice 'Unauthorized', falta sesión: corré '$DEVTUNNEL user login'"
    rm -f "$TUNEL_PID"
    return 1
  fi
  if [ ! -s "$URL_FILE" ]; then
    log "TÚNEL: ⚠ hospedando $TUNEL pero no pude leer su URL ('$DEVTUNNEL show $TUNEL')"
    return 1
  fi
  log "TÚNEL: hospedando $TUNEL → $(cat "$URL_FILE") (local :$PUERTO)"
}

asegurar_tunel() {
  case "$EXPOSICION" in
    tailscale) asegurar_funnel; return $? ;;
    ninguna)   : > "$URL_FILE"; return 0 ;;
  esac
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
  if [ -n "$host_tunel" ] && [ "$EXPOSICION" = devtunnel ]; then
    dominio="${host_tunel#*.}"
    id="${host_tunel%%-*}"
    host_tunel_alterno="${id}.${dominio}"
  fi

  # Cuatro sustituciones sobre la configuración de producción, y ninguna más:
  #   · los dos `upstream` apuntan a puertos de loopback del host en vez de a
  #     servicios de un compose;
  #   · los dos `listen` bajan del 80 al puerto del túnel — nginx corre en la red
  #     del host, así que el puerto que escucha ES el del host;
  #   · el `server_name` acepta además el hostname del túnel y `127.0.0.1`, para
  #     que una comprobación por IP no choque con el `default_server` que
  #     devuelve 421.
  # Con `--network host` el contenedor ES el host: escuchar en `127.0.0.1:$PUERTO`
  # deja el puerto donde el túnel lo espera y sin exponerlo a la red local. Con el
  # puerto publicado (macOS) hay que escuchar en todas las interfaces DE DENTRO del
  # contenedor —el tráfico publicado no entra por su loopback—, y quien acota a
  # loopback es el `-p 127.0.0.1:…` de `docker run`.
  local escucha
  if [ "$RED_DEL_HOST" = si ]; then escucha="127.0.0.1:${PUERTO}"; else escucha="${PUERTO}"; fi

  sed -e "s#^\( *\)server api:3000;#\1server ${HOST_DESDE_CONTENEDOR}:${API_PUERTO};#" \
      -e "s#^\( *\)server web:4000;#\1server ${HOST_DESDE_CONTENEDOR}:${PUERTO_WEB};#" \
      -e "s#^\( *\)listen 80 default_server;#\1listen ${escucha} default_server;#" \
      -e "s#^\( *\)listen 80;#\1listen ${escucha};#" \
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

# Los `include` que arrastra la configuración de producción, montados uno a uno.
#
# Antes había un único `-v` con `api-proxy.conf` escrito a mano, y el día que
# `nginx.conf` se partió en dos —`api-locations.conf`, con los 60 prefijos de la
# API— el proxy entró en bucle de reinicio: `open() "/etc/nginx/api-locations.conf"
# failed (2: No such file or directory)`. La lista se saca ahora de los propios
# `include`, así que el siguiente archivo que se añada se monta solo.
montajes_incluidos() {
  local vistos=" " archivo ruta
  # Dos niveles: `nginx.conf` incluye `api-locations.conf`, y ese incluye
  # `api-proxy.conf` en cada `location`.
  for archivo in $(grep -hoE 'include +/etc/nginx/[A-Za-z0-9_.-]+\.conf' \
                     "$RAIZ/deploy/nginx.conf" "$RAIZ/deploy/api-locations.conf" 2>/dev/null \
                   | sed 's#.*/##' | sort -u); do
    case "$vistos" in *" $archivo "*) continue ;; esac
    ruta="$RAIZ/deploy/$archivo"
    if [ -f "$ruta" ]; then
      vistos="$vistos$archivo "
      printf -- '-v %s:/etc/nginx/%s:ro ' "$ruta" "$archivo"
    else
      log "PROXY: ⚠ '$archivo' se incluye en la configuración pero no está en deploy/" >&2
    fi
  done
}

lanzar_proxy() {
  generar_nginx
  PROXY="$(nombre_libre "$PROXY_BASE")"
  # Red del host: es lo que le permite hablar con la API por loopback (ver la
  # nota de API_PUERTO). La configuración generada escucha en
  # `127.0.0.1:$PUERTO`, así que sigue sin quedar expuesto a la red local — el
  # único que tiene que alcanzarlo es el proceso del túnel, que corre acá mismo.
  local red
  if [ "$RED_DEL_HOST" = si ]; then
    red="--network host"
  else
    # Sólo en loopback del Mac, como en Linux: el único que tiene que alcanzarlo
    # es el proceso del túnel, que corre acá mismo.
    red="-p 127.0.0.1:${PUERTO}:${PUERTO} --add-host=host.docker.internal:host-gateway"
  fi
  docker run -d --name "$PROXY" $red --restart unless-stopped \
    --memory "$MEM_PROXY" --memory-swap "$MEM_PROXY" \
    -v "$NGINX_GEN:/etc/nginx/conf.d/default.conf:ro" \
    $(montajes_incluidos) \
    nginx:1.27-alpine >/dev/null || return 1
  log "PROXY: nginx en 127.0.0.1:$PUERTO (API → $HOST_DESDE_CONTENEDOR:$API_PUERTO · SSR → $HOST_DESDE_CONTENEDOR:$PUERTO_WEB)"
}

recargar_proxy() {
  # El `upstream` es un puerto fijo del host, así que un cambio de contenedor no
  # obliga a recargar. Se recarga igual por si la configuración se regeneró
  # —cambió el hostname del túnel, por ejemplo—: es instantáneo y no suelta el
  # puerto, así que el túnel ni se entera.
  generar_nginx
  docker exec "$PROXY" nginx -s reload >/dev/null 2>&1
}

# Vivo con CUALQUIERA de los dos nombres —el de siempre o el de rescate—, y el
# que se encuentre pasa a ser el nombre en uso. Sin esto, un despliegue que tuvo
# que caer al nombre alterno se vería «caído» en cada pasada y el ciclo lo
# reconstruiría cada dos minutos para siempre.
vivo_con_nombre() {
  local var="$1" base="$2" hallado
  hallado="$(docker ps --format '{{.Names}}' | grep -xE "${base}(-rescate)?" | head -1)"
  [ -n "$hallado" ] || return 1
  eval "$var=\$hallado"
  return 0
}

proxy_vivo() { vivo_con_nombre PROXY "$PROXY_BASE"; }

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
  # Con puerto y sin él: el `Host` que manda el navegador lo lleva cuando la URL
  # lo lleva, y la comparación del SSR es literal.
  if [ "$EXPOSICION" = devtunnel ]; then
    # El dev tunnel publica el enlace de DOS formas —`<id>-<puerto>.<dominio>` y
    # `<id>.<dominio>:<puerto>`— y las dos tienen que estar. Con Tailscale hay un
    # solo nombre, y partirlo por el guión daría un host que no existe
    # (`pablo-h310…` → `pablo…`).
    dominio="${h#*.}"          # brs.devtunnels.ms
    id="${h%%-*}"              # 2ptbhqtv
    echo "${h},${h}:${PUERTO},${id}.${dominio},${id}.${dominio}:${PUERTO},localhost,127.0.0.1"
  else
    echo "${h},${h}:${PUERTO},localhost,127.0.0.1"
  fi
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
web_vivo()   { vivo_con_nombre WEB "$WEB_BASE"; }

# ─── El despliegue ───────────────────────────────────────────────────────────

construir() {
  local etiqueta="$1" contexto="${2:-$RAIZ}"
  log "BUILD: construyendo $IMAGEN:$etiqueta (esto tarda unos minutos)"
  # `PUBLIC_API_BASE_URL` vacía a propósito: rutas relativas, un solo origen,
  # sin CORS. Es la decisión que documenta el propio Dockerfile.
  # `--network=host`: el DNS que Docker copia a los contenedores (192.168.0.1) no
  # responde desde los puentes, así que `yarn install` muere por timeout. Con la red
  # del anfitrión la construcción resuelve por systemd-resolved y sí sale a internet.
  docker build --network=host -f "$contexto/Dockerfile" -t "$IMAGEN:$etiqueta" \
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

# Docker puede dejar un contenedor en estado `Dead`: ni corre ni se puede
# quitar, y el `docker run` siguiente choca con «name already in use». Pasó con
# los dos contenedores de este despliegue y el sitio se quedó caído, porque el
# ciclo reintentaba lo mismo cada dos minutos sin decir nunca por qué fallaba.
#
# Lo que enruta acá es el PUERTO del host, no el nombre del contenedor, así que
# un nombre alterno sirve igual de bien y devuelve el servicio en el acto.
# `docker rm -f` se intenta primero: si funciona —que es lo normal— no se cambia
# nada y el nombre de siempre se conserva.
nombre_libre() {
  local base="$1"
  docker rm -f "$base" >/dev/null 2>&1
  if docker ps -a --format '{{.Names}}' | grep -qx "$base"; then
    log "DOCKER: ⚠ '$base' quedó en estado 'Dead' y no se deja quitar; se usa '${base}-rescate'"
    log "DOCKER:   se limpia solo con 'docker container prune -f', o reiniciando el demonio"
    docker rm -f "${base}-rescate" >/dev/null 2>&1
    printf '%s\n' "${base}-rescate"
  else
    # El nombre de siempre está libre otra vez —Docker soltó el cadáver, o
    # alguien lo limpió—. Hay que retirar el rescate ANTES de crear el nuevo: si
    # no, los dos quedan vivos peleándose por el mismo puerto del host y el que
    # llega segundo entra en bucle de reinicio. Pasó, y estuvo dos horas así.
    if docker ps -a --format '{{.Names}}' | grep -qx "${base}-rescate"; then
      log "DOCKER: '$base' vuelve a estar libre; se retira '${base}-rescate'"
      docker rm -f "${base}-rescate" >/dev/null 2>&1
    fi
    printf '%s\n' "$base"
  fi
}

lanzar_web() {
  local etiqueta="$1"
  WEB="$(nombre_libre "$WEB_BASE")"
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
  # Sin URL no hay nada que comprobar, y decir que sí es peor que no decir nada:
  # `status` llegó a imprimir «enlace sirve: sí» con el enlace vacío.
  if [ -z "$host_tunel" ]; then
    [ "${1:-}" = "silencioso" ] || log "ENLACE: ⚠ no hay URL de túnel; no hay enlace que comprobar"
    return 1
  fi
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
  # El commit puede estar servido de verdad y el enlace no existir: son dos
  # cosas distintas y el resumen las separa, porque «✓ sirviendo en » con la URL
  # en blanco se lee como éxito y no lo es.
  local url; url="$(cat "$URL_FILE" 2>/dev/null)"
  if [ -n "$url" ]; then
    log "DESPLIEGUE: ✓ $commit sirviendo en $url"
  else
    log "DESPLIEGUE: ✓ $commit sirviendo en 127.0.0.1:$PUERTO — ⚠ SIN enlace público (ver TÚNEL arriba)"
  fi
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
    en_segundo_plano "$RUTA" watch >>"$ESTADO/vigilante.out" 2>&1 < /dev/null
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
    # El cerrojo no espera, porque una construcción pasa de los dos minutos del
    # ciclo: si la anterior sigue viva, esta se retira en silencio en vez de
    # solaparse.
    if ! tomar_cerrojo; then
      log "PASADA: ya hay una en curso; esta se retira"
      exit 0
    fi
    ciclo
    ;;

  webhook)
    # Deja el receptor del webhook escuchando y publica su ruta por el Funnel.
    #
    # NO retira el temporizador: el webhook adelanta el despliegue, y el
    # temporizador sigue siendo quien garantiza que ocurra si el aviso no llega.
    if ! command -v systemctl >/dev/null 2>&1; then
      log "WEBHOOK: ✗ esta máquina no tiene systemd; el receptor se corre a mano con tools/redeploy/webhook.py"
      exit 1
    fi
    UNIDADES="$HOME/.config/systemd/user"
    SECRETO_ENV="$HOME/.config/alovida-redeploy-webhook.env"
    PUERTO_HOOK="${REDEPLOY_WEBHOOK_PUERTO:-9099}"
    RUTA_HOOK="${REDEPLOY_WEBHOOK_RUTA:-/webhook/front}"
    mkdir -p "$UNIDADES" "$HOME/.config"

    # El secreto se genera una vez y no se vuelve a tocar: regenerarlo en cada
    # pasada dejaría el webhook de GitHub firmando con uno viejo.
    if [ ! -s "$SECRETO_ENV" ]; then
      umask 077
      printf 'REDEPLOY_WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 32)" > "$SECRETO_ENV"
      chmod 600 "$SECRETO_ENV"
      log "WEBHOOK: secreto nuevo en $SECRETO_ENV"
    fi

    ln -sf "$RAIZ/tools/redeploy/systemd/alovida-redeploy-webhook.service" "$UNIDADES/"
    systemctl --user daemon-reload
    systemctl --user enable --now alovida-redeploy-webhook.service >/dev/null 2>&1
    sleep 1
    if ! systemctl --user is-active --quiet alovida-redeploy-webhook.service; then
      log "WEBHOOK: ✗ el receptor no arrancó. Mirá: journalctl --user -u alovida-redeploy-webhook -n 20"
      exit 1
    fi

    # Se publica sólo esa ruta, no el puerto entero: el resto del Funnel sigue
    # sirviendo la aplicación en `/`.
    if [ "$EXPOSICION" = tailscale ]; then
      nombre="$(nombre_tailscale)"
      if tailscale funnel --bg --set-path "$RUTA_HOOK" "$PUERTO_HOOK" </dev/null >/dev/null 2>&1; then
        log "WEBHOOK: escuchando en https://${nombre}${RUTA_HOOK}"
      else
        log "WEBHOOK: ⚠ el receptor corre, pero no pude publicar la ruta por el funnel"
      fi
    fi

    echo
    echo "En GitHub → Settings → Webhooks → Add webhook:"
    echo "  Payload URL   : https://$(nombre_tailscale)${RUTA_HOOK}"
    echo "  Content type  : application/json"
    echo "  Secret        : $(sed -n 's/^REDEPLOY_WEBHOOK_SECRET=//p' "$SECRETO_ENV")"
    echo "  Eventos       : sólo 'push'"
    echo
    echo "El temporizador sigue puesto como respaldo; los dos disparan la misma unidad."
    ;;

  systemd)
    # Deja el despliegue en manos del temporizador de usuario y retira el vigilante suelto:
    # los dos a la vez construirían la misma imagen dos veces.
    #
    # `enable-linger` es la pieza que la gente olvida: sin él, las unidades de usuario sólo
    # viven mientras haya sesión iniciada, así que un reinicio sin login deja el enlace
    # servido por contenedores viejos y a nadie vigilando.
    # En macOS no hay systemd. Antes esto dejaba un `~/.config/systemd/user` con
    # dos enlaces simbólicos que no manda nadie, y tres `command not found`
    # sueltos entre medias: quien lo corría se quedaba creyendo que había
    # instalado un temporizador. Ahí el equivalente es `start` (o launchd).
    if ! command -v systemctl >/dev/null 2>&1; then
      log "SYSTEMD: ✗ esta máquina no tiene systemd (macOS). Usá 'start' para dejar el vigilante corriendo."
      exit 1
    fi
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
    if [ "$EXPOSICION" = tailscale ]; then
      # Se retira el funnel: bajar los contenedores y dejar el nombre público
      # abierto a internet apuntando a un puerto muerto es peor que cerrarlo.
      tailscale funnel --https=443 off >/dev/null 2>&1 \
        && log "TAILSCALE: funnel retirado; vuelve con 'start'"
    else
      [ -f "$TUNEL_PID" ] && kill -TERM "$(cat "$TUNEL_PID")" 2>/dev/null
      rm -f "$TUNEL_PID"
    fi
    # También por el nombre de rescate: si no, un `stop` dejaría el sitio
    # sirviendo desde un contenedor que se creía bajado.
    docker rm -f "$PROXY_BASE" "$WEB_BASE" "${PROXY_BASE}-rescate" "${WEB_BASE}-rescate" >/dev/null 2>&1
    log "Todo abajo. El enlace $(cat "$URL_FILE" 2>/dev/null) vuelve intacto con 'start'."
    ;;

  status)
    echo "rama        : origin/$RAMA @ $(git -C "$RAIZ" rev-parse --short "origin/$RAMA" 2>/dev/null) (tu copia local no interviene)"
    echo "desplegado  : $(cat "$ESTADO/COMMIT_DESPLEGADO" 2>/dev/null || echo '—')"
    echo "enlace      : $( [ -s "$URL_FILE" ] && cat "$URL_FILE" || url_del_tunel )"
    if [ "$EXPOSICION" = tailscale ]; then
      echo "exposición  : tailscale funnel $(tailscale funnel status 2>/dev/null | grep -q "127.0.0.1:${PUERTO}" && echo "→ 127.0.0.1:$PUERTO" || echo '⚠ SIN servir')"
    else
      echo "exposición  : $EXPOSICION · $(tunel_proceso_vivo && echo 'hospedado' || echo 'sin hospedar')"
    fi
    # Lo que de verdad se pregunta cuando se pregunta por el estado: si la
    # petición COMO LLEGA POR EL ENLACE funciona. En el ciclo esto es silencioso
    # mientras va bien, así que acá se dice siempre.
    echo "enlace sirve: $(comprobar_enlace silencioso >/dev/null 2>&1 && echo 'sí (200 con el host del túnel)' || echo '⚠ NO')"
    echo "API         : 127.0.0.1:$API_PUERTO → $(curl -s -o /dev/null -w '%{http_code}' -m 5 "http://127.0.0.1:${API_PUERTO}/" 2>/dev/null)"
    # Quién vigila. Con el temporizador puesto, «vigilante: parado» es lo correcto y no una
    # avería: el bucle en segundo plano sobra, y decirlo aquí ahorra el susto de leerlo.
    echo "temporizador: $(systemctl --user is-active alovida-redeploy.timer 2>/dev/null || echo 'sin instalar') $([ "$(systemctl --user is-active alovida-redeploy.timer 2>/dev/null)" = active ] && echo '(manda systemd; el vigilante suelto sobra)')"
    echo "vigilante   : $( { [ -f "$VIGILANTE_PID" ] && kill -0 "$(cat "$VIGILANTE_PID")" 2>/dev/null && echo "pid $(cat "$VIGILANTE_PID")"; } || echo 'parado')"
    docker ps --filter "name=^${WEB_BASE}(-rescate)?$" --filter "name=^${PROXY_BASE}(-rescate)?$" \
      --format 'contenedor  : {{.Names}} · {{.Image}} · {{.Status}}'
    web_vivo; proxy_vivo
    docker stats --no-stream --format 'memoria     : {{.Name}} · {{.MemUsage}}' "$WEB" "$PROXY" 2>/dev/null
    exit 0
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

  # `[ -s ]` y no `cat … || …`: `cat` de un archivo vacío sale con 0, así que el
  # respaldo estaba escrito pero era inalcanzable justo cuando hacía falta.
  url)  if [ -s "$URL_FILE" ]; then cat "$URL_FILE"; else url_del_tunel; fi ;;
  logs) tail -n "${2:-40}" "$LOG" ;;

  *) sed -n '2,60p' "$0"; exit 1 ;;
esac
