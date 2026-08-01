# Entornos

**Existen dos, y ninguno es producción.**

---

## Los que existen

### 1 · Desarrollo en el host

```bash
yarn start   # http://localhost:4200
```

| Aspecto | Valor |
|---|---|
| Compilación | Desarrollo, sin optimizar, con mapas de fuente |
| Entorno | `environment.development.ts` (por `fileReplacements`) |
| API | `proxy.conf.json` → `http://localhost:3000`, **fijo** |
| `PUBLIC_API_BASE_URL` | Vacío → rutas relativas |
| SSR | Sí, el dev-server lo incluye |
| Hosts permitidos | `localhost`, `127.0.0.1` |

### 2 · Desarrollo en contenedor

```bash
docker compose up --build   # http://localhost:4200
```

| Aspecto | Valor |
|---|---|
| Imagen | `node:24-bookworm-slim` |
| API | `BACKEND_ORIGIN`, por defecto `http://host.docker.internal:3000` |
| Proxy | `proxy.generated.json`, generado al arrancar desde la plantilla |
| Puerto del host | `FRONTEND_PORT`, por defecto 4200 |
| Recarga en caliente | Sí, con `--poll 2000` |

Diferencias que importan:

- Instala **dentro** de la imagen: los binarios de `.yarn/unplugged/` son de
  Linux.
- Monta **solo** `src/`, `public/` y los `tsconfig`. Montar la raíz taparía el
  `.pnp.cjs`.
- `angular.json` declara `security.allowedHosts: ["localhost"]` para el build, y
  el `serve` añade `127.0.0.1`.

## El que no existe: producción

| Elemento | Estado |
|---|---|
| Imagen de producción | **No existe.** Solo `Dockerfile.dev` |
| Destino de despliegue | **No definido** |
| Dominio | **No definido** |
| Pipeline | **No existe** |
| Certificados / TLS | No definido |
| CDN | No definido |
| Variables del entorno productivo | No definidas |

**Lo que sí existe** es la mitad de arriba: `yarn build` produce un artefacto
completo con SSR y 4 rutas prerenderizadas, y `yarn serve:ssr:mantra-core-health`
lo sirve.

Falta todo lo que va de ahí a un servidor. Ver
[despliegue](deployment.md).

## Y tampoco hay staging

Sin él:

- Un cambio de renderizado no se puede verificar antes de producción.
- No hay dónde correr un smoke.
- Las cabeceras de seguridad **están implementadas y verificadas contra el
  artefacto**, pero nadie las ha visto salir de un servidor real todavía.

Ver [CSP](../security/content-security-policy.md#qué-verificar-tras-un-despliegue).

## Diferencias entre desarrollo y lo que sería producción

| Aspecto | Desarrollo | Producción |
|---|---|---|
| Optimización | No | Sí |
| Mapas de fuente | Sí | **No** |
| Hash en los nombres | No | **Sí** (`outputHashing: "all"`) |
| Presupuestos | No se evalúan | **Sí** |
| CSS crítico en línea | — | **Desactivado**, sin motivo registrado |
| Entorno | `environment.development.ts` | `environment.ts` |
| Proxy | Sí | **No.** Lo resuelve el servidor web o `PUBLIC_API_BASE_URL` |

**La fila del proxy es la que más sorprende al desplegar**: en desarrollo el
proxy resuelve `/iam`, `/public`… y en producción **no hay proxy**. O la API queda
detrás del mismo dominio, o hay que definir `PUBLIC_API_BASE_URL`.

Ver [configuración](configuration.md).

## Matriz de configuración

| Variable | Host | Contenedor | Producción |
|---|---|---|---|
| `PUBLIC_API_BASE_URL` | vacío | vacío | **Sin decidir** |
| `PORT` | n/a | n/a | 4000 |
| `FRONTEND_PORT` | n/a | 4200 | n/a |
| `BACKEND_ORIGIN` | n/a | `host.docker.internal:3000` | n/a |

## Comprobar en qué entorno se está

```js
// consola del navegador
document.querySelector('script[src*="main"]')?.src
// con hash (main-CJEZRIXM.js)  → build de producción
// sin hash (main.js)           → desarrollo
```

Y el proxy:

```bash
curl -i http://localhost:4200/public/directory
# 200 → el proxy alcanza la API
# 404 con HTML de Angular → la ruta no está en proxy.conf.json
```

## Lo que hay que definir

| # | Decisión | Bloquea |
|---|---|---|
| 1 | ¿La API va detrás del mismo dominio? | `PUBLIC_API_BASE_URL`, la CSP, el CORS |
| 2 | ¿Dónde se despliega? | Todo lo operativo |
| 3 | ¿Hay staging? | Probar CSP y cabeceras |
| 4 | ¿El dominio del frontend coincide con el de los enlaces del correo? | Verificación y recuperación |

**La 4 se pasa por alto y rompe dos journeys completos.** Ver
[servicios externos](../integrations/external-services.md#la-coordinación-con-el-correo).

Registradas en [el análisis de brechas](../reports/documentation-gap-analysis.md).
