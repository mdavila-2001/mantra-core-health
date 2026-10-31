# Contrato JSON — analítica de la app (carril F2-APP)

Fuente de verdad: `api › src/modules/telemetry/` (`presentation/controllers/telemetry-{errors,parts}-analytics.controller.ts`,
`telemetry-click-heatmap.controller.ts`, `telemetry-analytics.controller.ts`, `telemetry-client-errors.controller.ts`).
Todos los ejemplos son la forma real; los números de `evidencia-f0/F2-app.md` salen de una corrida contra Postgres.

## 0. Reglas comunes

**Ventana.** `from`, `to` (ISO-8601, UTC). Por defecto `to = ahora`, `from = to − 7 d`; máximo 92 d (`422 VALIDATION_FAILED`, `details.reason ∈ EMPTY_WINDOW|WINDOW_TOO_LARGE|INVALID_DATE|INTERVAL_TOO_FINE`). `interval=hour|day` (hora sólo ≤ 7 d). `portal=WEB|MOBILE`.

**Alcance (decisión X-5).** Roles: `PLATFORM_ADMIN, SECURITY_ADMIN, DATA_PLATFORM_ADMIN, MARKETING_MANAGER, DPO` (y `SUPERADMIN`).
- Con `X-Tenant-Id` (membresía obligatoria) o con una única membresía: **alcance organización** (`scope.level = "tenant"`).
- **Sin** `X-Tenant-Id`, un rol de plataforma **global** (`PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN`, `SUPERADMIN`) obtiene **alcance plataforma**: agrega todas las organizaciones (`scope.level = "platform"`, `scope.minSample = N`). Cualquier otro rol sin organización resuelta: `403 TENANT_AMBIGUOUS|TENANT_REQUIRED` (guard) o `412 TENANT_REQUIRED`.
- `minSample`: piso del servidor `TELEMETRY_PLATFORM_MIN_SAMPLE` (por defecto **5**). `?minSample=` sólo puede **subirlo** (máx. 1000). En alcance plataforma todo grupo (celda, elemento, ruta, familia de dispositivo) con menos de N **sujetos** se **suprime** y se declara en `notMeasured` `{metric:"minSample"}`; las cifras que identifican personas (`users`, `affectedUsers`, p50/p75 de muestras pequeñas) salen `null`.
- Sin sesión: `401`. Con sesión y sin rol: `403 ROLE_INSUFFICIENT`.
- `scope`: `{ "level": "tenant"|"platform", "tenantId": uuid|null, "minSample": int|null }`.
- `notMeasured`: `[{ "metric": string, "reason": string }]`. **Null ≠ 0**: lo que no se puede medir va `null` con motivo.

## 1. `POST /telemetry/client-errors` (público)

Sin token también funciona. Con `Authorization: Bearer` válido (sesión activa) el servidor añade `user_id`, sesión y `actor_tenant_id`
(`X-Tenant-Id` sólo si es membresía del token; si no, la única membresía; si no, `null`). Nada de eso se lee del cuerpo.
Límite: 60 lotes/min/IP (`429 RATE_LIMITED`). Lote 1–50. Campo no declarado (p. ej. `userId`) → 400.

```json
{ "errors": [ {
  "errorClass": "JS",                // JS|PROMISE|HTTP|ROUTE|CHUNK|HYDRATION|TEMPLATE|NATIVE
  "errorType": "TypeError",          // ≤120, sólo [A-Za-z0-9_.$:-]
  "message": "Cannot read …",        // ≤2000 de entrada; el servidor lo reduce a 1.ª línea, sin stack/correos/tokens/uuid/dígitos, ≤500
  "routeTemplate": "/agenda/:citaId",// lista cerrada de la ruta anónima; si no pasa se guarda null
  "occurredAt": "2026-10-31T14:05:12.000Z",
  "portal": "WEB",                   // WEB (defecto) | MOBILE
  "httpMethod": "GET", "apiRouteTemplate": "/admin/x/:id", "httpStatus": 404, "apiErrorCode": "NOT_FOUND",
  "requestId": "…",                  // X-Request-Id de la respuesta → observability.error_events
  "supportCode": "E-abc1234-001",
  "appVersion": "1.0.0",             // OBLIGATORIO; sin versión reconocible se descarta (rejected)
  "buildId": "abc1234", "screenSize": "escritorio", "isOnline": true, "suppressedCount": 0,
  "fingerprint": "ignorado"          // la huella la calcula el servidor: sha256(clase|tipo|mensaje|ruta)[0:16]
} ] }
```
`201 { "inserted": n, "rejected": m }`. Inserción sin `RETURNING` (RLS de la tabla).

## 2. Errores (lecturas)

> `lastRequestId` (en `byApiRoute[]` y `fingerprints[]`) y `recentRequestIds` sólo se devuelven a `PLATFORM_ADMIN, SECURITY_ADMIN, DPO, SUPERADMIN`; para el resto `null` (+ `notMeasured.lastRequestId`).

### `GET /admin/analytics/errors?from&to&portal&routeCode&class`
```json
{ "window": {"from","to","interval","timezone":"UTC","portal":null}, "scope": {…},
  "totals": { "errors": 4, "suppressedRepeats": 0, "fingerprints": 3, "sessionsAffected": null, "sessionsWithError": 2,
              "affectedUsers": 1, "s9Shown": null },
  "byPart": [ { "routeCode": "WEB.SUPERADMINISTRACION.SUPERADMIN_MEASUREMENT"|null, "routePattern": "/superadmin/measurement",
                "pageTitle": "…"|null, "domain": "…"|null, "errors": 2, "fingerprints": 1, "rate": 0.5|null } ],
  "byClass": [ { "class": "JS", "errors": 2, "fingerprints": 1 } ],
  "byHttpStatus": [ { "status": 404, "errors": 1 } ],
  "byApiRoute": [ { "method": "GET", "route": "/admin/x", "errors": 1, "lastRequestId": "…"|null } ],
  "series": [ { "bucket": "2026-10-31T14:00:00.000Z", "errors": 3 } ],     // cubos vacíos en 0
  "notMeasured": [ {"metric","reason"} ] }
```
`sessionsAffected` es `null` si algún error llegó sin sesión (motivo en `notMeasured`); `sessionsWithError` es el recuento de sesiones conocidas.
`s9Shown` es `null` si no hay eventos `estado_error_mostrado`. `rate = errores / vistas` de la parte (`null` sin vistas).

### `GET /admin/analytics/errors/fingerprints?…&limit(1–100, 20)`
`{ window, scope, fingerprints: [ { fingerprint, errorType, class, sanitizedMessage, count, firstSeen, lastSeen, parts: [{routeCode|null, routeTemplate, errors}], lastRequestId|null, versions: [..], affectedUsers|null, trend: { previous, change|null, direction: "up"|"down"|"flat" } } ], notMeasured }`

### `GET /admin/analytics/errors/fingerprints/:fingerprint`
`{ window, scope, fingerprint, found, errorType, class, sanitizedMessage, count, firstSeen, lastSeen, affectedUsers|null, series[], parts[], versions: [{version, errors}], httpStatuses: [{status, errors}], recentRequestIds: [{requestId, receivedAt, httpStatus}] | null, notMeasured }`
`recentRequestIds` (hasta 20) sólo para `PLATFORM_ADMIN, SECURITY_ADMIN, DPO, SUPERADMIN`; para el resto `null` con motivo.

### `GET /admin/analytics/errors/routes-not-found?…`
`{ window, scope, classes, notFound: [{ routeTemplate, errors, firstSeen, lastSeen, affectedUsers|null, registered }], unmappedErrorRoutes: [{routeTemplate, errors}], notMeasured }`

## 3. Partes

### `GET /admin/analytics/parts?…&compare=previous`
```json
{ "window": {…}, "scope": {…}, "compare": { "from","to" } | null,
  "tree": [ { "surface": "WEB", "domains": [ { "domain": "Administración", "features": [ { "feature": "ADMINISTRATION_WEB_ANALYTICS",
        "screens": [ { "routeCode", "routePattern", "pageTitle", "status": "ACTIVE"|"DEPRECATED" } ] } ] } ] } ],
  "parts": [ { "routeCode", "routePattern", "pageTitle", "surface", "domain",
               "views": 4, "events": 9, "sessions": 2, "users": 1|null, "anonymousEvents": 3,
               "dwellMs": { "samples": 5, "p50": 3000, "p75": 4000 } | null,
               "errors": 2, "errorRate": 0.5|null,
               "vitals": { "LCP": { "p75": 2400, "samples": 12 } },
               "previous": { "views": 1, "errors": 0 } /* sólo con compare=previous */ } ],
  "unmapped": [ { "routeTemplate": "/zzz"|null, "portal": "WEB", "views": 1, "events": 1, "errors": 0 } ], "unmappedTotal": 1,
  "notMeasured": [ … ] }
```
`parts` sólo trae partes con actividad (vistas, eventos o errores), ordenadas por vistas; el catálogo completo está en `tree`.
`views` = `pagina_vista` (+ `page_view` histórico), identificadas y anónimas. `users` = `user_id` distintos (sólo personas con consentimiento; `anonymousEvents` aparte).
`unmapped`: `route_template` que no casa con ninguna `frontend_routes.route_pattern` de su superficie (detector de rutas no registradas); `routeTemplate: null` = evento sin ruta.

### `GET /admin/analytics/parts/:routeCode`
`{ window, scope, part: {routeCode, routePattern, pageTitle, surface, domain, status}, totals: {views, events, sessions, users|null, anonymous, anonymousEvents}, dwellMs|null, viewsSeries: [{bucket, views}], screenSizes: [{screenSize, events}], keyActions: [{target, clicks}], vitals: [{metric, samples, p50, p75, p95}], recentErrors: [{fingerprint, errorType, sanitizedMessage, count, lastSeen}], notMeasured }` · `404` si el código no existe.

## 4. Mapa de calor

### `GET /admin/analytics/heatmap?route=<plantilla>&from&to&portal&screenSize=movil|tableta|escritorio&metric=clicks|rage|dead|scroll`
```json
{ "route": "/superadmin/measurement", "window": {"from","to","timezone":"UTC","portal":null,"screenSize":null},
  "metric": "clicks", "scope": {…}, "views": 4,
  "grid": { "columns": 20, "rows": 20 },
  "totals": { "clicks": 7, "positioned": 7, "keyboard": 0, "withoutPosition": 0, "repeated": 3, "dead": 1 },
  "cells": [ { "column": 1, "row": 1, "x": 0.075, "y": 0.075, "clicks": 6, "rage": 3, "dead": 1, "value": 6, "share": 0.8571 } ],
  "byElement": [ { "target": "button[data-testid=nav-recoger]", "clicks": 7, "repeated": 3, "dead": 1 } ],
  "byScreenSize": [ { "screenSize": "escritorio", "clicks": 7 } ],
  "scroll": { "pages": 5, "measured": 5, "buckets": [ { "depth": 0.1, "pagesReached": 5, "share": 1 }, … hasta 1.0 ] } | null,
  "notMeasured": [ {"metric","reason"} ] }
```
- `cells` sólo trae celdas con valor > 0. `value` es el de la métrica pedida (`clicks`, `rage`, `dead`); con `metric=rage|dead` sólo salen celdas con valor > 0 y `share = value / suma de valores`. Con `metric=scroll`, `cells = []` y se usa `scroll`.
- Celda: `column = floor(x_doc·20)`, `row = floor((y_doc_px / alto_doc_px)·20)`, ambos acotados a 0–19. `x`,`y` = centro en 0–1.
- `share` (clicks) = `clicks / totals.positioned` (null si positioned = 0). `scroll.share = pagesReached / measured`.
- Alcance plataforma con < N personas en la ruta: `totals.*` = `null`, `cells = []`, `byElement = []`, `notMeasured[0].metric = "minSample"`.
- `views` y `scroll` salen del mismo filtro de ventana/portal/tamaño (las vistas no se filtran por tamaño).

## 5. Dispositivos y agregados existentes (alcance plataforma añadido)

`GET /admin/analytics/devices|overview|timeseries|web-vitals` ahora aceptan alcance plataforma y devuelven `scope`. **`pipeline-health` NO** (exige organización: sin `X-Tenant-Id` un rol de plataforma recibe 403).
- `devices`: grupos con < N sesiones suprimidos (`notMeasured`).
- `overview`: `totals` pasa a `null` si la muestra total < N; `topRoutes`/`topEvents` sin los grupos pequeños; `pageViews` cuenta `pagina_vista`. Añade `notMeasured`.
- El tamaño de muestra que se compara con N son **sujetos distintos** (`user_id`/sujeto/sesión), no mediciones.
- `timeseries`: `events` y `sessions` del cubo `null` si el cubo tiene < N sujetos. `web-vitals`: `samples`, p50/p75/p95 y `ratings` `null` si hay < N sujetos.
- `sessions`, `sessions/:id`, `funnels/:id/report` **no** son de alcance plataforma: exigen organización.

## 6. Retención (interno)

`POST /telemetry/retention/purge` — sólo rol `SYSTEM` (worker `telemetry`, cada hora). Body `{batchSize ≤5000, maxBatches ≤100}`.
`{ now, purposes: [{purposeCode, retentionDays, cutoff, events, properties, batches, more}], clientErrors: {retentionDays, cutoff, deleted, batches, more}, totalEvents, totalProperties, totalClientErrors, withoutRetention: [purposeCode] }`.
`PORTAL_UX_HEATMAP` no tiene `default_retention_days` (decisión de privacidad pendiente): no se purga y se declara en `withoutRetention`.

## 7. Qué necesita el front / otros carriles

- Siembra: `read_models.frontend_routes` se llena con el paso de seed `partes-del-frontend` (fixture `src/modules/read_models/seed/partes.seed.json`, o `PARTES_JSON_PATH=<docs/partes/partes.json>`). Sin esa siembra, `parts` queda vacío y todo cae en `unmapped`.
- Conceptos nuevos (`ERROR_CLASS_*`, `read_models:ROUTE_DEPRECATED`): los crea el paso `catalogo-de-conceptos` del seed; sin ellos `POST /telemetry/client-errors` falla por FK.
- El SDK debe mandar `appVersion` (obligatorio) y puede mandar `requestId` copiado de `X-Request-Id`.
