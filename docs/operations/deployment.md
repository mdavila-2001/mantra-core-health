# Despliegue

**El código está listo.** Hay imagen de producción, reverse proxy, pipeline y un
despliegue de referencia. Lo que falta es **dónde** —el host o el orquestador— y
el certificado.

> ## Para un VPS con Coolify hay archivos propios
>
> [`deploy/docker-compose.coolify.yml`](../../deploy/docker-compose.coolify.yml) +
> [`deploy/nginx.coolify.conf`](../../deploy/nginx.coolify.conf), con sus variables en
> [`deploy/.env.coolify.example`](../../deploy/.env.coolify.example). El procedimiento
> completo —los dos recursos, la red compartida, el orden de despliegue— está en el
> repositorio de la API, en `docs/operations/coolify.md`.
>
> Dos diferencias con el despliegue de referencia de esta página, y las dos vienen de
> tener el Traefik de Coolify delante:
>
> · **`APP_DOMAIN` es obligatoria.** El servidor de renderizado responde 400 a todo
>   `Host` que no esté en su lista, y la lista horneada en el artefacto solo conoce
>   `localhost`. El stack arranca en verde —el healthcheck pide `localhost`— y devuelve
>   400 en cada página al primer visitante real.
>
> · **El proxy no valida el `Host` ni publica puertos.** De lo primero ya se encargó
>   Traefik; lo segundo chocaría con él.

> ## ✅ Decisión de arquitectura: la API va detrás del mismo dominio
>
> `PUBLIC_API_BASE_URL` vacía en todos los entornos. Sin CORS, con
> `connect-src 'self'`, y **una sola imagen** para todos.

## Lo que ya existe

| Pieza | Dónde |
|---|---|
| Imagen de producción | [`Dockerfile`](../../Dockerfile) — multietapa, usuario `node`, `HEALTHCHECK` |
| Reverse proxy | [`deploy/nginx.conf`](../../deploy/nginx.conf) + [`api-proxy.conf`](../../deploy/api-proxy.conf) |
| Los prefijos que van a la API | [`deploy/api-locations.conf`](../../deploy/api-locations.conf) — un solo archivo, incluido por los dos proxies |
| Despliegue en Coolify | [`deploy/docker-compose.coolify.yml`](../../deploy/docker-compose.coolify.yml) + [`nginx.coolify.conf`](../../deploy/nginx.coolify.conf) |
| Despliegue de referencia | [`deploy/docker-compose.prod.yml`](../../deploy/docker-compose.prod.yml) |
| Pipeline | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| Versionado del artefacto | Versión y commit estampados por `generate-env.mjs` |

```bash
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

## Lo que falta, y no es código

| # | Qué | Quién |
|---|---|---|
| 1 | Host, orquestador o PaaS de destino | Operaciones |
| 2 | Dominio y certificado TLS | Operaciones |
| 3 | Que la API sea alcanzable como `api:3000` en la red del proxy | Operaciones + API |
| 4 | **Que el dominio de los enlaces del correo coincida con el del frontend** | API |
| 5 | Credenciales del primer administrador | API |

**El 4 se pasa por alto y rompe dos journeys completos.**

---

## Lo que sí existe

```bash
yarn build                              # produce dist/mantra-core-health/
yarn serve:ssr:mantra-core-health       # lo sirve con Express en el PORT
```

El artefacto está completo: navegador + servidor SSR + 4 rutas prerenderizadas.
**Falta todo lo que va de ahí a un servidor.**

## Lo que no existe

| Elemento | Estado |
|---|---|
| `Dockerfile` de producción | **No existe.** Solo `Dockerfile.dev` |
| Destino (VPS, Kubernetes, PaaS…) | **No definido** |
| Dominio | **No definido** |
| Pipeline de CI/CD | **No existe** |
| Variables del entorno productivo | **No definidas** |
| TLS / certificados | No definido |
| Reverse proxy | No definido |
| CDN | No definido |
| Estrategia (azul-verde, canario, directa) | No definida |
| Rollback | Ver [rollback](rollback.md) |
| Smoke posterior | No existe |
| Versionado del artefacto | **No existe** — `version: "0.0.0"` |

## Lo que el artefacto necesita para funcionar

Verificado en el código, no supuesto:

### 1 · Node 24 con soporte de ESM

`server.mjs` usa `import.meta.dirname` y ESM. La imagen de desarrollo usa
`node:24-bookworm-slim`, y Debian y no Alpine por una razón concreta:

> *«las dependencias nativas del build de Angular (esbuild, rolldown,
> lightningcss, lmdb) publican binarios contra glibc.»*

**Para el artefacto ya construido, esas dependencias no hacen falta** — solo
Express y `@angular/ssr`. Una imagen de producción podría usar Alpine, pero eso
hay que verificarlo, no suponerlo.

### 2 · La estructura de `dist/`

```ts
const browserDistFolder = join(import.meta.dirname, '../browser');
```

`server.mjs` busca `../browser` **relativo a sí mismo**. La estructura
`dist/mantra-core-health/{browser,server}/` hay que preservarla.

### 3 · `PORT`

```ts
const port = process.env['PORT'] || 4000;
```

Es **la única variable de entorno que lee el código de este repositorio en
ejecución**.

### 4 · Que la API sea alcanzable

Con `PUBLIC_API_BASE_URL` vacío, el navegador pide al mismo origen. **En
producción no hay proxy**: o la API queda detrás del mismo dominio, o hay que
definir la variable **en el build**, no en ejecución.

La decisión está tomada: **la API va detrás del mismo dominio**. Ver
[configuración](configuration.md) y `deploy/nginx.conf`.

## Validación del `Host`

`deploy/nginx.conf` declara dos bloques `server`: uno `default_server` que
responde **421** a cualquier `Host` desconocido, y otro con los dominios reales.
Cambiar de dominio es editar una línea y recargar nginx.

### Por qué no está en Angular, que es donde venía

`angular.json` traía `build.options.security.allowedHosts: ["localhost"]`, y esa
opción **se hornea en el artefacto**. El resultado en producción era concreto y
grave:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: localhost'            http://127.0.0.1:4173/auth   # 200
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: mantra.example.com'   http://127.0.0.1:4173/auth   # 400
```

**El servidor rechazaba con 400 cualquier petición de un dominio real.** No lo
veía ninguna prueba unitaria, ni el build, ni el lint: solo aparece sirviendo el
artefacto construido y pidiéndole con un `Host` que no sea `localhost`. Lo
encontraron [las pruebas de extremo a extremo](../testing/e2e-tests.md#por-qué-existen),
que corren justo así.

Se probaron las tres alternativas antes de mover el control:

| Valor | Efecto |
|---|---|
| `["localhost"]` | 400 para todo dominio real |
| `["**"]` | Rechaza **todo**, incluido `localhost` |
| Sin la opción | Acepta cualquier `Host` |

Y se eligió quitarla, porque enumerar el dominio en el build significa **una
imagen distinta por dominio** y reconstruir para cambiarlo.

Se pierde poco al moverlo: la protección existe contra un `Host` manipulado que
lleve al servidor a pedirle algo a un host interno, y **este servidor SSR no hace
ninguna petición saliente** — no habla con la API.

## Propuesta de imagen de producción

```dockerfile
# PROPUESTA, no implementada — requiere verificación
FROM node:24-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --immutable
COPY . .
ARG PUBLIC_API_BASE_URL=""
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL
RUN yarn build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/dist/mantra-core-health ./dist/mantra-core-health
# Express y @angular/ssr son las únicas dependencias en ejecución:
# hay que verificar cómo resolverlas bajo PnP en la imagen final.
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/mantra-core-health/server/server.mjs"]
```

**Tres cosas hay que verificar antes de usarla**, y por eso está marcada como
propuesta:

1. **PnP en la etapa final.** El artefacto necesita resolver `express` y
   `@angular/ssr`. Con PnP hay que copiar `.pnp.cjs` y `.yarn/`, o cambiar el
   `nodeLinker` solo para el build de producción.
2. **`PUBLIC_API_BASE_URL` es de build, no de ejecución.** Queda compilada dentro
   del paquete. **Una imagen por entorno**, o rutas relativas siempre.
3. **Usuario no root** y comprobación de salud.

## Checklist de un despliegue

Para cuando exista:

### Antes

- [ ] `yarn install --immutable` sin cambios en el lockfile
- [ ] `yarn lint` limpio
- [ ] `yarn tsc -p tsconfig.app.json --noEmit` limpio
- [ ] `yarn build` con el aviso conocido y ninguno nuevo
- [ ] `yarn test:coverage` — 903 pruebas, umbrales cumplidos
- [ ] `yarn e2e` — 7 journeys de sesión contra el artefacto construido
- [ ] `node scripts/generate-doc-report.mjs` limpio
- [ ] `yarn npm audit --recursive` sin altas ni críticas
- [ ] La versión anterior sigue disponible para revertir

### Durante

- [ ] `PUBLIC_API_BASE_URL` correcta **para este entorno**
- [ ] `PORT` fijado
- [ ] La estructura de `dist/` preservada
- [ ] Cabeceras de seguridad, si ya se implementaron

### Después — smoke

- [ ] `/auth` carga y el formulario se ve
- [ ] `/design-system` carga (verifica el prerenderizado)
- [ ] Iniciar sesión funciona (verifica que la API es alcanzable)
- [ ] `/dashboard` muestra la tarjeta de sesión
- [ ] La tarjeta del directorio **no** muestra S8 (verifica el proxy/CORS)
- [ ] Recargar con sesión **no** vuelve al login (verifica `restoreSession`)
- [ ] El tema no parpadea (verifica el script en línea)
- [ ] `/auth/verify-email?token=x` muestra el estado correcto
- [ ] **Cerrar sesión y recargar `/dashboard`**: tiene que llevar al login
- [ ] La respuesta trae las seis cabeceras de seguridad (`curl -I`)

**El cuarto y el sexto son los que más fallan al desplegar por primera vez**, y
los dos apuntan a la misma causa: la API no alcanzable.

El penúltimo está en la lista porque **falló de verdad**: el borrado del refresh
token esperaba a la respuesta de la API y la navegación al login llegaba antes.
Ver [sesión y tokens](../security/session-and-tokens.md#el-orden-al-cerrar-sesión).

## Dependencias externas del despliegue

| Dependencia | Dueño |
|---|---|
| API desplegada y alcanzable | Equipo de la API |
| **Que el dominio de los enlaces del correo coincida con el del frontend** | Equipo de la API |
| Base de datos y almacenes | Equipo de la API |
| Primer administrador sembrado | Equipo de la API |

**La segunda rompe dos journeys completos y no está documentada en ninguno de los
dos repositorios.** Ver
[servicios externos](../integrations/external-services.md#la-coordinación-con-el-correo).

## Estado

**`BLOCKER`.** Bloquea a su vez: monitoreo, alertas, CSP probada, smoke,
rollback y Web Vitals de campo.

Registrado en
[el informe de preparación productiva](../reports/production-readiness.md).
