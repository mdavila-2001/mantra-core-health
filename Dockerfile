# Imagen de producción: sirve el artefacto ya construido con el Express de
# `src/server.ts` (SSR + estáticos + cabeceras de seguridad).
#
# Es distinta de `Dockerfile.dev`, que levanta `ng serve` con recarga en
# caliente y monta las fuentes desde el host. Ésta no monta nada: lo que entra
# en la imagen es lo que se sirve.
#
#   docker build -t mantra-core-health .
#   docker run --rm -p 4000:4000 mantra-core-health
#
# ─── Lo único que queda por decidir fuera de este archivo ────────────────────
#
# `PUBLIC_API_BASE_URL` es una variable de **build**, no de ejecución: se
# compila dentro del paquete que descarga el navegador, así que no se puede
# inyectar al arrancar el contenedor. Dos caminos, y hay que elegir uno:
#
#   1. La API detrás del MISMO dominio (recomendado). Se deja vacía, las
#      peticiones salen relativas y una sola imagen sirve para todos los
#      entornos. Sin CORS que negociar y con la CSP más simple.
#
#   2. La API en otro dominio. Se pasa en el build y hay UNA IMAGEN POR ENTORNO:
#        docker build --build-arg PUBLIC_API_BASE_URL=https://api.ejemplo.com .
#      Requiere además configurar CORS del lado de la API.
#
# Ver docs/operations/configuration.md.

# ─── Etapa 1 · construcción ──────────────────────────────────────────────────
# Debian y no Alpine: las dependencias nativas del build de Angular (esbuild,
# rolldown, lightningcss, lmdb) publican binarios contra glibc.
FROM node:24-bookworm-slim AS build

RUN corepack enable
WORKDIR /app

# Manifiesto, lockfile y configuración de Yarn primero: la capa de instalación
# se reutiliza mientras esos tres archivos no cambien.
COPY package.json yarn.lock .yarnrc.yml ./

# Ni Cypress ni los navegadores de Playwright pintan nada en una imagen que sólo
# compila: son doscientos y pico megas de binarios que se descargan en cada
# construcción sin caché y que el artefacto no toca. Sin esto, el redespliegue
# del servidor se quedaba colgado en el `postinstall` de Cypress —medido— y la
# construcción no llegaba nunca a Angular.
ENV CYPRESS_INSTALL_BINARY=0 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    HUSKY=0 \
    # El heap de Node, por debajo del techo del contenedor: así el recolector
    # empieza a trabajar **antes** de que el kernel mate el proceso. Sin esto,
    # una construcción con techo de 4 GB moría con
    # `esbuild: all goroutines are asleep - deadlock` y salida 129 —que no dice
    # «me quedé sin memoria», pero es lo que era—.
    #
    # 2 GB desde el 29/09/2026: con 1,5 GB el despliegue de `1faba02` murió
    # con `Worker terminated due to reaching memory limit: JS heap out of
    # memory` (exit 1, no 137: fue el montón y no el guardián). La aplicación
    # creció y el compilador de Angular ya no entraba. Medido con Node 24 y un
    # trabajador: con 1,5 GB falla, con 2 GB compila.
    #
    # 4 GB desde el 26/10/2026: volvió a pasar lo mismo con 2 GB. Todos los
    # despliegues de la web en `dev` (4d94e05) y `test` (94adefc) morían en
    # `yarn build` con exit 1 y el sitio quedaba sirviendo la versión anterior.
    # Reproducido con `production-api` y un trabajador: con 2 GB, `JS heap out
    # of memory`; con 3 GB compila justo; con 4 GB compila con margen. El pico
    # de RSS medido es de ~2,5 GB tanto con 3 como con 4 GB, así que el techo
    # más alto no hace crecer la memoria real: sólo evita que el montón se
    # quede corto cuando la aplicación siga creciendo.
    NODE_OPTIONS=--max-old-space-size=4096 \
    # Cuántos procesos de esbuild corren a la vez. Por omisión, uno por núcleo:
    # con doce núcleos y 447 fragmentos diferidos el pico se va por encima de los
    # 6 GB y el cgroup mata la construcción (`ng build` a 4,7 GB de RSS, medido).
    # Con dos trabajadores tarda algo más y cabe. En un portátil con memoria de
    # sobra no hace falta tocar nada: esto sólo aplica a la imagen.
    # UN trabajador, no dos, y en esta máquina no es negociable.
    #
    # El H310 corre `h310-guardian.service`, que vigila la presión de memoria y
    # MATA compilaciones: las frena con `memory.high` = RAM/4 y dispara
    # `cgroup.kill` cuando coinciden PSI ≥20%, memoria disponible ≤10% y swap
    # libre ≤20%. Tras matar deja 600 s de enfriamiento en los que todo build
    # nuevo muere al nacer. En el log del despliegue eso se ve sólo como
    # `exit code: 137`, sin una palabra sobre memoria; quien lo cuenta es
    # `journalctl -t h310-guardian`.
    #
    # Cada trabajador es un proceso con su propio montón, así que bajar de dos a
    # uno es lo que más recorta el pico —más que el `--max-old-space-size` de
    # arriba—. Medido el 16/09/2026 en la rama `mockup`: con 1 trabajador y
    # 1,5 GB de montón la compilación cabe y termina en ~4 min; con 2 y 3 GB la
    # mataba el guardián.
    NG_BUILD_MAX_WORKERS=1

# `--immutable` falla si el lockfile no cuadra: es lo que garantiza que lo
# instalado sea exactamente lo declarado.
RUN yarn install --immutable

COPY . .

# La API usa rutas relativas por defecto; el AI Service se define aparte y
# queda público en el paquete del navegador. Ninguna de las dos variables lleva secretos.
ARG PUBLIC_API_BASE_URL=""
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL
ARG PUBLIC_AI_BASE_URL="/ai"
ENV PUBLIC_AI_BASE_URL=$PUBLIC_AI_BASE_URL

# `production` (el valor por omisión de `ng build`) es la maqueta: sin este ARG
# el contenedor sale SIEMPRE con el backend simulado encendido, sin importar
# qué variables de entorno se le pasen. Un despliegue real pide
# `--build-arg BUILD_CONFIGURATION=production-api` (H1.S1): SSR encendido,
# simulador y las cuatro demostraciones apagadas. La maqueta sigue viva sin
# tocar nada: no pasar el ARG construye exactamente lo mismo que antes.
ARG BUILD_CONFIGURATION="production"

# `yarn build` encadena `env:generate`, que además estampa versión y commit en
# el paquete. El commit sale de Git, y por eso `.git` tiene que estar en el
# contexto: sin él queda `desconocido` y se pierde la trazabilidad del artefacto.
RUN yarn build --configuration=$BUILD_CONFIGURATION

# ─── Etapa 2 · dependencias de producción ────────────────────────────────────
FROM node:24-bookworm-slim AS prod-deps

RUN corepack enable
WORKDIR /app

# ─── ESTE `COPY --from=build` ENCADENA LAS DOS INSTALACIONES A PROPÓSITO ─────
#
# BuildKit construye en grafo, no en lista: dos etapas sin dependencia entre
# ellas corren EN PARALELO. Si esta etapa copiara los manifiestos del contexto,
# los dos `yarn install` —el de desarrollo de arriba y el de producción de acá—
# arrancarían a la vez. Dos instalaciones simultáneas de este repositorio son el
# pico de memoria real del build: no es Angular. En el H310 eso despertaba a
# `h310-guardian`, que mataba los dos pasos y dejaba en el log dos
# `exit code: 137` seguidos, uno por cada `yarn` (despliegue 712, 17/09, con el
# swap todavía al 57% libre — o sea que ni siquiera era falta de swap, era la
# presión instantánea).
#
# Copiarlos DESDE la etapa `build` obliga a esperar a que termine, así que las
# instalaciones siguen una detrás de otra. Y como BuildKit calcula la caché de
# un `COPY` por el contenido de lo que copia, mientras `package.json`,
# `yarn.lock` y `.yarnrc.yml` no cambien el `yarn install` de abajo sale de
# caché: ya no se paga un minuto largo de instalación en cada despliegue.
#
# Antes esta instalación vivía en la etapa `runtime`, después de copiar `dist/`.
# Encadenaba igual, pero como `dist/` cambia en cada commit la capa no se
# reutilizaba nunca.
COPY --from=build /app/package.json /app/yarn.lock /app/.yarnrc.yml ./

# El servidor SSR necesita resolver `express` y `@angular/ssr` en ejecución. Se
# instala solo lo de producción en vez de copiar el `node_modules` de la etapa
# anterior, que arrastra el toolchain de build (esbuild, lmdb) sin usarlo.
#
# El montón va acotado en la propia orden y NO como `ENV`, por costumbre: en la
# etapa `runtime` un `ENV` se hornearía en la imagen final y le pondría techo
# al heap del servidor SSR. Lo que se acota es la instalación.
RUN NODE_OPTIONS=--max-old-space-size=1024     yarn workspaces focus --production --all || yarn install --immutable

# ─── Etapa 3 · ejecución ─────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime

RUN corepack enable
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY --from=prod-deps /app/node_modules ./node_modules

# Preserva la estructura `dist/mantra-core-health/{browser,server}`, que
# `server.mjs` necesita porque busca `../browser` relativo a sí mismo.
COPY --from=build /app/dist/mantra-core-health ./dist/mantra-core-health

# Usuario sin privilegios. La imagen base trae `node` (uid 1000) creado.
USER node

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Comprobación de salud sobre una ruta prerenderizada: verifica que el proceso
# responde Y que el artefacto del navegador está donde el servidor lo busca.
# `/auth` y no `/`, que redirige al login y depende del guard.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/auth').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/mantra-core-health/server/server.mjs"]
