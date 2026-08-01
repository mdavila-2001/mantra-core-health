# Despliegue

**El código está listo.** Hay imagen de producción, reverse proxy, pipeline y un
despliegue de referencia. Lo que falta es **dónde** —el host o el orquestador— y
el certificado.

> ## ✅ Decisión de arquitectura: la API va detrás del mismo dominio
>
> `PUBLIC_API_BASE_URL` vacía en todos los entornos. Sin CORS, con
> `connect-src 'self'`, y **una sola imagen** para todos.

## Lo que ya existe

| Pieza | Dónde |
|---|---|
| Imagen de producción | [`Dockerfile`](../../Dockerfile) — multietapa, usuario `node`, `HEALTHCHECK` |
| Reverse proxy | [`deploy/nginx.conf`](../../deploy/nginx.conf) + [`api-proxy.conf`](../../deploy/api-proxy.conf) |
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

Es la decisión pendiente número uno. Ver [configuración](configuration.md).

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
- [ ] `yarn test:coverage` — 804 pruebas, umbrales cumplidos
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
- [ ] `/panel` muestra la tarjeta de sesión
- [ ] La tarjeta del directorio **no** muestra S8 (verifica el proxy/CORS)
- [ ] Recargar con sesión **no** vuelve al login (verifica `restoreSession`)
- [ ] El tema no parpadea (verifica el script en línea)
- [ ] `/auth/verificar?token=x` muestra el estado correcto

**El cuarto y el sexto son los que más fallan al desplegar por primera vez**, y
los dos apuntan a la misma causa: la API no alcanzable.

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
