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

# `--immutable` falla si el lockfile no cuadra: es lo que garantiza que lo
# instalado sea exactamente lo declarado.
RUN yarn install --immutable

COPY . .

# Vacío por defecto = rutas relativas = mismo origen. Ver la nota de arriba.
ARG PUBLIC_API_BASE_URL=""
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL

# `yarn build` encadena `env:generate`, que además estampa versión y commit en
# el paquete. El commit sale de Git, y por eso `.git` tiene que estar en el
# contexto: sin él queda `desconocido` y se pierde la trazabilidad del artefacto.
RUN yarn build

# ─── Etapa 2 · ejecución ─────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime

RUN corepack enable
WORKDIR /app

# El servidor SSR necesita resolver `express` y `@angular/ssr` en ejecución. Se
# reinstala solo lo de producción en vez de copiar el `.yarn` entero de la etapa
# anterior, que arrastra el toolchain de build (esbuild, lmdb) sin usarlo.
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn workspaces focus --production --all || yarn install --immutable

# La estructura `dist/mantra-core-health/{browser,server}` hay que preservarla:
# `server.mjs` busca `../browser` relativo a sí mismo.
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
