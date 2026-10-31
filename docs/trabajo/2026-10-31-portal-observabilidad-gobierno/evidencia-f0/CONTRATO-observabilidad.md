# Contrato JSON — `GET /admin/observability/*` (F2-SISTEMA, rebanadas 2-5)

Fuente: respuestas reales de la API local (Postgres 5544, `OBSERVABILITY_ENABLED=true`, 31/10/2026). Los ejemplos están recortados; los nombres y tipos son los de la API. Detalle de autoría: `src/modules/observability/README.md` del API.

## Estado (cierre del carril)

Rebanadas 2, 3, 4 y 5: completas y verificadas contra Postgres real (ver `F2-sistema.md`). No existen aún: `/modules/heatmap`, `/workers`, `/dependencies`, `/slo`. El 422 de `from` inválido está corregido en el commit `3a30108ce` pero sin re-probar en vivo (la API local puede seguir con el build anterior, que responde 400 del pipe). `moduleCode` es `UNKNOWN` hasta que se importe el catálogo de operaciones.

## Reglas comunes

- **Autorización.** Las 13 lecturas exigen `Authorization: Bearer` con rol `PLATFORM_ADMIN | SRE | SECURITY_ADMIN | RELEASE_MANAGER | GOVERNANCE_ADMIN` (o `SUPERADMIN`). **Sin `X-Tenant-Id`** responden con alcance plataforma (`plataforma@alovida.test` → 200). Sin token 401; usuario sin rol de plataforma (`medico2org@alovida.test`) 403; con `X-Tenant-Id` de una organización ajena 403.
- **`PATCH /errors/groups/:id`** (`PLATFORM_ADMIN | SRE`) **no** tiene alcance plataforma: un `PLATFORM_ADMIN` que pertenece a varias organizaciones debe enviar `X-Tenant-Id` (si no, 403 `TENANT_AMBIGUOUS`). `SUPERADMIN` no lo necesita. El front debe mandar el tenant activo.
- **Sobre.** Toda respuesta de lectura lleva `window`, `freshness`, `notMeasured[]` y `generatedAt`:
  - `window: { from, to, interval: "minute"|"hour"|"day", timezone }` — `to` por defecto ahora; `from` por defecto 00:00 de `to` en `tz`.
  - `freshness: { lastFlushAt, lagSeconds, droppedFlushes }` — el front marca `stale` si `lagSeconds > 180`.
  - `notMeasured: [{ metric, reason }]` — lo que **no** se mide (siempre se muestra; no se rellena con 0).
- **Parámetros de ventana (todas las rutas con ventana):** `from`, `to` (ISO-8601 estricto: `2026-10-31` o `2026-10-31T10:00:00Z`), `tz` (IANA; por defecto `America/La_Paz`; la respuesta devuelve `window.timezone`). `interval` (`minute|hour|day`) en `timeseries`, `errors/groups/:id` y `sql/statements/:hash`. Si se omite, la API lo elige según el ancho de la ventana.
- **`null ≠ 0`.** Una cifra no medida es `{ "value": null, "reason": "<CODIGO>" }`; un cubo de serie sin fila no aparece (no es 0). Percentiles: `{ value }` o `{ value: null, reason }`.
- **Percentiles estimados** (histograma de 11 cortes): `latencyMs.method = "histogram-estimate"`, `approximate: true` → el front dice «por lo menos / aprox.».
- **Paginación** (`endpoints`, `errors/groups`, `errors/events`, `sql/statements`, `sql/slow`): `limit` (1–200, 50) y `cursor` opaco keyset; respuesta `{ items, nextCursor }` (`nextCursor: null` al final). Orden determinista (desempate por clave).
- **Errores** (cuerpo estándar `{ code, message, correlationId, reason, details? }`; `correlationId` = `requestId` buscable en `GET /requests/:requestId`):
  - `422 VALIDATION_FAILED` con `reason`: `INVALID_DATE`, `EMPTY_WINDOW`, `WINDOW_TOO_LARGE`, `INTERVAL_TOO_FINE`, `INVALID_TIMEZONE`, `OBSERVABILITY_UNSUPPORTED_GROUPING`, `OBSERVABILITY_INVALID_REQUEST_ID`, `OBSERVABILITY_INVALID_QUERY_HASH`, `OBSERVABILITY_ERROR_GROUP_NOTE_REQUIRED`.
  - `400 VALIDATION_FAILED / VALIDATION_PIPE_REJECTED` sólo para tipos/enums mal formados (`metric` desconocida, `limit` fuera de rango, `state` inválido).
  - `404 NOT_FOUND` (`OBSERVABILITY_ERROR_GROUP_NOT_FOUND`, `OBSERVABILITY_SQL_STATEMENT_NOT_FOUND`).
  - `409 CONCURRENCY_CONFLICT` (`OBSERVABILITY_ERROR_GROUP_VERSION_CONFLICT`, `details.currentRowVersion`) → el front muestra `validation` con «recargar».
- **Vocabulario de `notMeasured.metric`:** `rejectedBeforeApi`, `healthchecksExcluded`, `percentilesEstimated`, `errorSampling`, `sqlOnlyOrm`, `workers`, `dependencies`, `slo`, `affectedActors`, `lastMinuteNotFlushed`, `moduleAttribution`, `observability` (captura apagada).
- **`moduleCode`**: sale de `data_catalog.catalog_operations`; si el catálogo está vacío es `"UNKNOWN"` (no se inventa). Hoy, en la base local, el catálogo está vacío: todas las filas dicen `UNKNOWN` y `/coverage.catalog.operations = 0`. La pestaña «Módulos» debe tratar eso como «sin atribución», con la razón de `notMeasured.moduleAttribution`.

## Rutas que NO existen todavía (otra tanda)

`GET /modules/heatmap`, `/workers`, `/dependencies`, `/slo`. Los KPI `workers`, `dependencies` y `slo` de `/summary` salen `{ value: null, reason: "WORKERS_NOT_REPORTING" | "DEPENDENCIES_NOT_PROBED" | "SLO_NOT_COMPUTED" }`. El front muestra «sin dato» con esa razón; no inventa estado.

## Rutas

### `GET /admin/observability/summary?from&to&tz`

```json
{
  "window": { "from": "2026-10-31T04:00:00.000Z", "to": "2026-10-31T13:09:15.184Z", "interval": "hour", "timezone": "America/La_Paz" },
  "freshness": { "lastFlushAt": "2026-10-31T13:09:04.532Z", "lagSeconds": 11, "droppedFlushes": 0 },
  "notMeasured": [
    { "metric": "rejectedBeforeApi", "reason": "Lo que Traefik contesta antes de llegar a la API ..." },
    { "metric": "percentilesEstimated", "reason": "p50/p95/p99 se estiman por interpolación del histograma ..." },
    { "metric": "workers", "reason": "WORKERS_NOT_REPORTING: los latidos de workers aún no se recogen (H5)" }
  ],
  "generatedAt": "2026-10-31T13:09:15.198Z",
  "kpis": {
    "requests": { "value": 1538 },
    "errorRate5xx": { "value": 0.003901 },
    "errorRate4xx": { "value": 0.356957 },
    "latencyMs": { "p50": { "value": 8.78 }, "p95": { "value": 148.85 }, "p99": { "value": 366.2 }, "avg": 26, "max": 1423.5, "method": "histogram-estimate", "approximate": true },
    "errorGroups": { "value": { "new": 119, "open": 119, "regressed": 1 } },
    "slowSql": { "value": { "count": 25, "topHash": "191fa0827c2b" } },
    "workers": { "value": null, "reason": "WORKERS_NOT_REPORTING" },
    "dependencies": { "value": null, "reason": "DEPENDENCIES_NOT_PROBED" },
    "slo": { "value": null, "reason": "SLO_NOT_COMPUTED" }
  },
  "statusClasses": { "2xx": 1041, "3xx": 19, "4xx": 585, "5xx": 6, "other": 0 },
  "latencyBuckets": [ { "leMs": 5, "count": 401 }, { "leMs": 10, "count": 938 }, "...", { "leMs": null, "count": 1651 } ]
}
```

Las tasas son **razones 0–1** (no porcentaje). `latencyBuckets` son acumuladas (`leMs: null` = total). Sin instancias en la ventana: `kpis.requests = { value: null, reason: "NO_INSTANCE_REPORTED_IN_WINDOW" }`; con captura viva y 0 peticiones: `reason: "NO_REQUESTS_IN_WINDOW"` en las tasas.

### `GET /timeseries?metric&interval&groupBy&from&to&tz`

`metric`: `requests | errors4xx | errors5xx | latency_p95 | latency_p99 | sql_ms | sql_slow | error_events`. `groupBy`: `none` (por defecto) | `module` | `status_class` (este último sólo con `metric=requests`; otro caso → 422 `OBSERVABILITY_UNSUPPORTED_GROUPING`).

```json
{ "metric": "requests", "groupBy": "none", "minSample": 5, "note": "Un cubo sin fila es «sin dato», no cero.",
  "series": [ { "key": "requests", "points": [ { "bucket": "2026-10-31T10:00:00.000Z", "value": 252 }, { "bucket": "2026-10-31T12:00:00.000Z", "value": 796 } ] } ] }
```

`bucket` es el inicio del cubo en UTC (ISO); los cubos se calculan en `tz`. Un cubo ausente = sin dato.

### `GET /endpoints?module&sort&cursor&limit&from&to&tz`

`sort`: `requests` (defecto) `| failed | p95 | p99 | errorGroups`.

```json
{ "sort": "requests", "total": 70, "nextCursor": "eyJzIjoi...",
  "items": [ { "method": "GET", "route": "/admin/ops/slos", "operationKey": "OpsConsoleController_slos", "moduleCode": "UNKNOWN",
      "requests": 168, "failed4xx": 20, "failed5xx": 0,
      "latencyMs": { "p50": { "value": 6.11 }, "p95": { "value": 24 }, "p99": { "value": 61.48 }, "avg": 7.76, "max": 61.48 },
      "errorGroupsOpen": 1, "lastSeenAt": "2026-10-31T13:07:00.000Z" } ] }
```

`route` es siempre plantilla (`:id`), o `UNMATCHED` (404 de ruta inexistente) / `__overflow__`; `operationKey` puede ser `null` en `UNMATCHED`.

### `GET /modules?from&to&tz`

```json
{ "items": [ { "moduleCode": "UNKNOWN", "requests": 1639, "failed4xx": 584, "failed5xx": 6, "errorRate": 0.003661, "latencyMs": { "p95": { "value": 162.59 } }, "errorGroupsOpen": 119 } ] }
```

`errorRate = failed5xx / requests`.

### `GET /coverage?from&to&tz`

```json
{ "flags": { "observability": true, "httpSli": true, "otel": false, "diagnostics": true, "actorHash": true },
  "flush": { "lastAt": "2026-10-31T13:10:02.200Z", "lastRows": 40, "lastDurationMs": 22, "droppedFlushes": 0, "lastFailureAt": null, "lastFailureType": null, "intervalSeconds": 15, "pendingErrorEvents": 1, "pendingErrorGroups": 1 },
  "sampling": { "sampledOutErrorEvents": 0, "droppedErrorEvents": 0, "slowRequestSamplesOverCap": 0, "slowRequestMs": 2000 },
  "catalog": { "operations": 0, "loadedAt": "2026-10-31T13:07:17.114Z" },
  "instances": [ { "id": "d95fb12a-...", "kind": "API", "name": "api", "status": "running", "buildCommit": null, "buildVersion": null, "startedAt": "...", "lastSeenAt": "..." } ],
  "notMeasured": [ "...completo, incluye lastMinuteNotFlushed y sqlOnlyOrm..." ] }
```

`droppedFlushes`, `pending*` y `sampling.*` son contadores **de la instancia que respondió**, desde que arrancó.

### `GET /errors/groups?state&module&code&source&sort&cursor&limit&from&to&tz`

`state`: `NEW|SEEN|RESOLVED|IGNORED`; `sort`: `last_seen` (defecto) `| occurrences | first_seen`.

```json
{ "sort": "last_seen", "nextCursor": null,
  "items": [ { "id": "3f31fcae-604d-484a-9420-795cabcd77a5", "title": "INTERNAL · — · GET /internal/observability/selftest/fail",
      "source": "api", "httpStatus": 500, "code": "INTERNAL", "reason": null, "exceptionType": "Error",
      "moduleCode": "UNKNOWN", "operationKey": "ObservabilitySelftestController_fail", "method": "GET", "route": "/internal/observability/selftest/fail",
      "state": "NEW", "firstSeenAt": "...", "lastSeenAt": "...", "occurrencesTotal": 25, "occurrences24h": 25,
      "affectedActors24h": null, "affectedActors24hReason": "MUESTRA_INSUFICIENTE",
      "sparkline": [ { "bucket": "2026-10-31T10:00:00.000Z", "count": 12 } ],
      "lastRequestId": "fa69de11-...", "rowVersion": 4, "regressedAt": null, "resolvedAt": null, "resolutionNote": null } ] }
```

`affectedActors24h` es `null` con `affectedActors24hReason` (`MUESTRA_INSUFICIENTE` si hay menos de 5 usuarios distintos, o `ACTOR_HASH_NOT_AVAILABLE`). `rowVersion` es lo que el `PATCH` pide como `expectedVersion`. Un grupo `RESOLVED` que vuelve a verse pasa a `NEW` con `regressedAt`.

### `GET /errors/groups/:id?interval&from&to&tz`

Lo anterior más: `sampleMessage` (redactado; `null` en 5xx salvo `API_ERROR_DIAGNOSTICS=true`), `sampleFrames[]` (`src/…:línea`), `series[]{bucket,count}`, `byModule[]{moduleCode,events}`, `recentEvents[]` (≤ 50, más nuevo primero):

```json
{ "recentEvents": [ { "id": "8f6925ca-...", "occurredAt": "2026-10-31T13:09:24.227Z", "requestId": "fa69de11-fc62-4b29-ba70-d82dc20ae478", "traceId": null, "httpStatus": 500, "instanceId": "d95fb12a-...", "durationMs": 4 } ] }
```

### `GET /errors/events?groupId&requestId&cursor&limit&from&to&tz`

`items[]` = `{ id, occurredAt, groupId, requestId, traceId, instanceId, httpStatus, code, reason, exceptionType, moduleCode, operationKey, method, route, durationMs }` — sin mensajes.

### `GET /requests/:requestId`

```json
{ "requestId": "7c31cc40-58ad-412d-a7ba-935a44464bf2", "found": true,
  "errors": [ { "id": "8113eaa7-...", "occurredAt": "...", "groupId": "3f31fcae-...", "httpStatus": 500, "code": "INTERNAL", "reason": null,
      "exceptionType": "Error", "moduleCode": "UNKNOWN", "operationKey": "ObservabilitySelftestController_fail", "method": "GET", "route": "/internal/observability/selftest/fail",
      "durationMs": 5, "sqlstate": null, "constraint": null, "table": null, "column": null, "violations": null,
      "messageRedacted": null, "frames": ["src/…:36"], "instanceId": "d95fb12a-..." } ],
  "slowSample": null, "traceId": null, "hint": null }
```

`found: false` → `errors: []`, `slowSample: null` y `hint` con la explicación («sólo se guardan errores y muestras lentas; el log del servidor conserva el resto»): el front muestra `not-found` con ese texto. `slowSample` (si hay) = como un ítem de `/sql/slow`.

### `PATCH /errors/groups/:id`  (`PLATFORM_ADMIN | SRE`, auditado)

Cuerpo `{ "state": "NEW|SEEN|RESOLVED|IGNORED", "note"?: string, "expectedVersion": <rowVersion leído> }`. `note` obligatorio (≥ 3 caracteres) para `RESOLVED` e `IGNORED`. 200 devuelve el grupo actualizado (misma forma que un ítem de `/errors/groups`). Errores: 409 (versión vieja), 422 (`…NOTE_REQUIRED`), 404, 403 (`TENANT_AMBIGUOUS` si falta `X-Tenant-Id`).

### `GET /sql/statements?sort&module&cursor&limit&from&to&tz`

`sort`: `total_ms` (defecto) `| p95 | executions | slow`.

```json
{ "items": [ { "queryHash": "191fa0827c2b", "statementClass": "select", "primaryTable": "iam.sessions", "executions": 1203, "totalMs": 3019,
    "latencyMs": { "p50": { "value": 0.69 }, "p95": { "value": 8.26 }, "p99": { "value": 24.49 }, "avg": 2.51, "max": 112, "method": "histogram-estimate", "approximate": true },
    "slowCount": 6, "failedCount": 0, "modules": ["UNKNOWN"] } ], "nextCursor": "eyJz..." }
```

### `GET /sql/statements/:hash?interval&from&to&tz`

`{ queryHash, statementClass, normalizedSql, primaryTable, firstSeenAt, lastSeenAt, slowEver, executions, totalMs, slowCount, failedCount, latencyMs{…}, series[]{bucket,executions,totalMs,slowCount,p95}, operations[]{operationKey,moduleCode,executions,…}, slowSamples[]{requestId,durationMs,occurredAt} }`. `normalizedSql` **nunca** lleva literales: `?` por valor; una sentencia que no se pudo normalizar con seguridad se guarda como `[truncated]`.

### `GET /sql/slow?cursor&limit&from&to&tz`

```json
{ "items": [ { "id": "e7c5358a-...", "occurredAt": "2026-10-31T13:09:36.020Z", "requestId": "0c06f04c-...", "traceId": null, "instanceId": "d95fb12a-...",
    "method": "GET", "route": "/admin/ops/readiness", "operationKey": "OpsConsoleController_readiness", "moduleCode": "UNKNOWN", "httpStatus": 200,
    "durationMs": 150, "sqlCount": 8, "sqlTotalMs": 410,
    "sqlTop": [ { "queryHash": "e709fb62845f", "executions": 1, "sumMs": 77 } ], "sampledBecause": "slow" } ], "nextCursor": null }
```

`sampledBecause`: `slow | error | random`. Sólo hashes, nunca SQL.

## Nginx

Falta añadir `/admin/observability` a `deploy/api-locations.conf` del front (hoy sólo `/admin/ops`). No lo tocó este carril.
