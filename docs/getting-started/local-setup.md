# Instalación local

Dos caminos. El del host es más rápido; el de Docker aísla las dependencias
nativas y es el que reproduce lo que corre en CI.

## En el host

```bash
corepack enable
yarn install --immutable     # --immutable: falla si el lockfile no cuadra
yarn start                   # http://localhost:4200
```

`yarn start` encadena dos cosas (ver `package.json`):

```text
yarn env:generate  →  escribe src/environments/env.generated.ts desde .env
ng serve           →  servidor de desarrollo en el 4200
```

El proxy sale de `proxy.conf.json`, que reenvía seis prefijos a
`http://localhost:3000`:

```text
/iam  /public  /terminology  /profiles  /identity  /common
```

Por eso el navegador ve **un solo origen** y no hay CORS que negociar. Si la API
corre en otro puerto, ver [variables de entorno](environment-variables.md).

### Sin `.env` también funciona

Todas las variables tienen valor por defecto. `.env` existe para cambiarlas sin
tocar código; `.env.example` es la plantilla:

```bash
cp .env.example .env
```

## Con Docker

```bash
docker compose up --build     # http://localhost:4200
```

Qué hace distinto al host:

- Instala dentro de la imagen, así que los binarios nativos de
  `.yarn/unplugged/` son de Linux, no de tu máquina.
- Monta **solo** `src/`, `public/` y los `tsconfig` — nunca la raíz. Montar `.`
  taparía el `.pnp.cjs` de Linux con el del host y el build no arrancaría.
- Genera `proxy.generated.json` al arrancar, sustituyendo `BACKEND_ORIGIN` sobre
  la plantilla `proxy.conf.docker.json`. **El `proxy.conf.json` del repositorio
  queda intacto**, que es lo que usa el `yarn start` del host.
- Usa `--poll 2000` porque los bind mounts de Docker Desktop en macOS no
  propagan eventos de sistema de archivos, y sin sondeo el recargado en caliente
  no se entera de nada.

### El backend visto desde el contenedor

Dentro del contenedor, `localhost` es el propio contenedor. Para llegar a una API
que corre en tu máquina, el valor por defecto es:

```bash
BACKEND_ORIGIN=http://host.docker.internal:3000
```

El servicio `dev` de `docker-compose.yml` declara
`extra_hosts: host.docker.internal:host-gateway`
para que también funcione en Docker Engine sobre Linux, donde ese nombre no
existe de fábrica.

## Levantar el sistema completo

Orden que funciona, tomado de `ESTADO-FRONTEND.md` (trabajo previo del equipo):

```bash
# 1 · Almacenes de la API — NUNCA el servicio `api` del compose de la API:
#     arranca con DDL propio y pisa el esquema.
cd ../mantra-core-health-redesa-api
docker compose up -d postgres redis

# 2 · API en el host
yarn start:prod                       # http://localhost:3000

# 3 · Primer administrador (una sola vez, idempotente)
#     Credenciales: BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD del .env
#     de la API. No viven en este repositorio.

# 4 · Frontend
cd ../mantra-core-health
yarn start                            # http://localhost:4200
```

## Comprobar que quedó bien

| Comprobación | Qué esperar |
|---|---|
| `http://localhost:4200/design-system` | La vitrina pinta. No necesita API |
| `http://localhost:4200/auth` | El login pinta |
| `http://localhost:4200/` sin sesión | Redirige a `/auth` — es el `authGuard` |
| Entrar con la cuenta de demostración | Cae en `/dashboard` |
| El panel, con la API caída | La franja «Lo que toca hoy» en estado S8 o S9 |

Esa última fila es una **prueba, no un fallo**: la aplicación debe decir que no
hay API en vez de quedarse en blanco.

## Verificar la instalación sin levantar nada

```bash
yarn lint                              # ESLint sobre todo el repo
yarn tsc -p tsconfig.app.json --noEmit # tipos
yarn build                             # build de producción con SSR
yarn test:coverage                     # 804 pruebas + umbrales de cobertura
```

Los cuatro deben pasar. Sus resultados de referencia están en
[la línea base](../reports/baseline.md).

## Si algo falla

[Solución de problemas](troubleshooting.md).
