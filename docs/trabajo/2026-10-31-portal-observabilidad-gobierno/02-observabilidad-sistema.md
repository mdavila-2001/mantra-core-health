# 02 — Observabilidad a nivel de sistema: consultas, latencia y errores

- Fecha: 2026-10-31 · Franja del portal de observabilidad y gobierno · Dueño único de este archivo.
- Peldaño de evidencia: **DISCOVERED** (todo lo de §1 se leyó en código; nada se ejecutó). Lo que no se leyó dice «no verificado».
- Rutas: `API:` = `/home/user/mantra-core-health-api`, `FRONT:` = `/home/user/mantra-core-health`, `MODEL:` = `/home/user/mantra-core-health-model`.
- Reglas que mandan: `CONTEXTO-COMUN.md` (esquema en el modelo primero, `null ≠ 0`, sin PHI, autoridad en la API, 9 estados `ViewState`, evidencia UI → request → response → persistencia → recarga → UI), `FRONT:CLAUDE.md`, `API:docs/adr/ADR-0027-metricas-http-en-proceso.md`.

---

## 0. Hallazgos principales (leer primero)

1. **Hoy la API sólo mide tráfico HTTP, en memoria, por minuto × método × plantilla de ruta, y lo vuelca cada 60 s a `time_series.service_sli_series` con el histograma dentro de un `jsonb`** (`API:src/observability/http-sli/http-sli.aggregator.ts:161-271`, `http-sli-flush.service.ts:101-171`). **Está apagado por defecto** (`http-sli.env.ts:37-60`), el `.env.example` de desarrollo lo enciende (`API:.env.example:388`) **pero `.env.coolify.example` no lo nombra** (grep `OBSERVABILITY_HTTP_SLI` sobre `.env.coolify.example` y `docker-compose.coolify.yml` = 0): en el despliegue real la medición está apagada salvo que alguien la haya puesto a mano. Limitación principal: **no persiste ningún error individual** (ni código, ni `requestId`, ni stack); los errores sólo son un contador `4xx`/`5xx` por minuto.
2. **Los errores se registran a pino (stdout) y nada más**: el filtro global escribe `code`, `reason`, `correlationId`, `path`, `method`, `userId` y el stack saneado (`API:src/common/filters/all-exceptions.filter.ts:242-285`), pero no hay tabla, ni agrupamiento, ni lectura. El `correlationId` es el `req.id` de pino-http (UUID v4 o el `x-request-id` del proxy) y vuelve al cliente en cuerpo y cabecera (`API:src/logging/pino-options.ts:85-92`, filtro `:217-233`); el front ya lo captura y lo muestra como `requestId` en el `ViewState` (`FRONT:src/app/core/http/error-to-view-state.ts:64,250`, `api-failure.ts:113`). **La correlación existe punta a punta; lo que falta es un lugar donde buscarla.**
3. **La duración de cada consulta SQL ya se mide y se cuenta, pero sólo en memoria de proceso y sin salida**: `OrmLogger.logQuery` recibe `took`, marca lentas (`ORM_SLOW_QUERY_MS`, 200 ms por defecto) y alimenta `QueryMetrics` (`API:src/orm/observability/orm.logger.ts:75-109`, `query-metrics.ts:51-77`, `orm.env.ts:143`). Hay normalizador de forma de consulta y huella `sqlShapeHash` (`sql-redaction.ts:43-60`). Nadie expone `QueryMetrics.snapshot()` (grep en `src/`: sólo `persistence.metrics` llega a `GET /health/data-sources/metrics`, `API:src/persistence/health/data-sources.controller.ts:42`).
4. **Los workers no tienen latido ni base**: su salud vive en memoria (`API:src/worker/worker-health.registry.ts:54-253`) y se expone en `127.0.0.1:9100` (`worker-health.server.ts:95-150`, `.env.example:456`), inalcanzable desde la API. El front ya tiene cliente y pantalla para `GET /admin/ops/instances/liveness` y `/admin/ops/tools` (`FRONT:src/app/core/data-access/admin-portal/ops-liveness.types.ts:1-98`, `features/admin/instances/instances.ts:109-110,237-244`, `platform-home.ts:160-197`) **pero esas rutas no existen en la API** (grep `instances/liveness` en `API:src` = 0; el controlador de `ops_console` tiene 9 rutas, `API:src/modules/ops_console/README.md`). Hoy esas pantallas sólo funcionan contra el simulador (`FRONT:src/app/core/mock/handlers/ops-liveness.handlers.ts`).
5. **`platform_ops` ya tiene el modelo de SLI/SLO/presupuesto de error e incidentes** (`MODEL:SQL/46_platform_ops/02_tables.sql:334-417`, `154-176`) y escritura por API (`POST /ops/slo/:id/measurements`, `POST /ops/error-budget/:policyId/burn-events`, rol `SYSTEM|SRE|PLATFORM_ADMIN`, `API:src/modules/platform_ops/controllers/platform-ops.controller.ts:256-299`) y lectura `GET /admin/ops/slos` (`ops-console.service.ts:109-137`). **Nadie calcula mediciones**: grep en `API:src/worker` de `slo/` = 0. Se reutiliza, no se duplica.
6. **TimescaleDB está en la imagen local y en Coolify** (`timescale/timescaledb-ha:pg18`, `API:docker-compose.yml:344,370`, `docker-compose.coolify.yml:432`), la API convierte las 12 series del módulo 58 en hypertables al arrancar (`API:src/orm/catalog/physical.catalog.ts:17-41`) y ya hay rollups `continuous_sli_hourly/daily` y retención por `drop_chunks` (`API:src/modules/time_series/constants/time-series.constants.ts:143-193`, `worker/jobs/time_series/refresh-rollups.job.ts:29-54`, `apply-retention.job.ts:40-82`). **Pero `worker-time_series` no está en Coolify** (sólo `messaging, scheduling, workflow, read_models`: `docker-compose.coolify.yml:823-835`) y `TS_RETENTION_POLICIES` está vacío (`.env.example:501`): en producción no hay rollup ni retención.
7. **El mapa ruta → módulo ya existe en la base**: `data_catalog.catalog_operations` (`operation_key`, `http_method`, `route_template`, `module_code`; `API:src/modules/data_catalog/entities/catalog_operations.entity.ts:4-21`), y `operation_key` coincide con el `operationId` del índice de rutas en proceso (`${Controller}_${handler}`, `API:src/observability/route-index/route-index.service.ts:95`; inventario `API:inventario/endpoints/ops_console.json` → `"id": "OpsConsoleController_backups"`). Es lo que permite «errores y latencia por módulo/funcionalidad» sin inventar un catálogo.
8. **Lo que Traefik contesta antes de la API** sólo se ve en el Prometheus del VPS (`traefik_router_requests_total`, `API:infra/monitoring/prometheus/rules/traffic.yml:10-16`), que la API no puede leer (ADR-0027 «alternativas descartadas»). Queda declarado en `notMeasured` como hoy (`rejectedBeforeApi`, `latency-buckets.ts:173`). `pg_stat_statements`: **no verificado** que esté en `shared_preload_libraries` de la imagen (`grep -rn pg_stat_statements` en compose, `infra/`, `scripts/` = 0).

---

## 1. Qué hay hoy (DISCOVERED, con ruta:línea)

### 1.1 Medición HTTP (`src/observability/http-sli`)

| Qué | Dónde | Detalle |
|---|---|---|
| Middleware Express, antes de rutas y del parseo del cuerpo | `API:src/main.ts:162-171`, `http-sli.middleware.ts:52-81` | Lee verbo, `req.route.path` (plantilla), `statusCode`, duración (`hrtime`). Excluye `OPTIONS` y `EXCLUDED_HTTP_PATHS` (`telemetry.constants.ts:101-112`: `/health, /healthz, /ready, /readiness, /liveness, /metrics, /favicon.ico, /docs, /docs-json, /reference`). No lee URL, query, cuerpo, cabeceras ni usuario. |
| Agregador en memoria | `http-sli.aggregator.ts:161-227` | Celda por `minuto|método|plantilla`; códigos por clase (`2xx…5xx`, `other`), `sumMs`, `maxMs`, histograma de 11 cortes (`5…10000 ms` + `inf`, `:30-38`). Tope 2000 claves/minuto → `__overflow__` (`:41-44`). UUID o ≥6 dígitos en la ruta → `UNMATCHED` (`:137-148`). |
| Volcado | `http-sli-flush.service.ts:77-130` | `setInterval` cada `OBSERVABILITY_HTTP_SLI_FLUSH_SECONDS` (10–3600, 60), `unref()`; `drain()` vacía; reintento **una vez**; después `droppedFlushes++` y aviso. Volcado en `onApplicationShutdown` (`:90-94`). Escribe con `SeriesIngestRepository.insertPoints(tx, 'service_sli_series', rows)` bajo `SEED.tenantId` (deuda TS-07, `:46-51`, ADR-0027 §8). |
| Fila persistida | `time_series.service_sli_series` (`MODEL:NoSQL/58_time_series_timescaledb/time_series.timescaledb.sql:169-183`) | `time, tenant_id, series_id='http|GET|/x/:id', ingestion_id, source_version='http-sli/1', quality_state, service_id, sli_code='http_requests', numerator (2xx+3xx), denominator, value, dimensions jsonb {method, route, codes, latency{sumMs,maxMs,buckets}}`. **Sin PK ni UNIQUE**; índice sólo `(service_id, sli_code, time DESC)` (`:231`). Hypertable `chunk 1 day` (`:230`; la API lo asegura en `physical.catalog.ts:41`). |
| Lectura | `API:src/modules/ops_console/infrastructure/repositories/ops-traffic.repository.ts:106-181` | 4 `SELECT` con `jsonb_each_text` sobre `dimensions` y `CASE … ~ '^[0-9]+$'` por cada campo (`:58-63`); `date_trunc('hour'|'day')` en UTC. Con RLS fija `SEED.tenantId` (`:86-99`). Usuarios activos desde `iam.sessions` (`:188-197`). |
| Servicio y contrato | `ops-traffic.service.ts:113-257` | `measured{requests, succeeded, failed{client4xx, server5xx}, successRatio, latencyMs{avg,p50,p95,max, method:'histogram-estimate', approximate}, activeUsers, lastDataAt}`, `series[]{bucket, requests, failed4xx, failed5xx, p95Ms}`, `notMeasured[]{metric, reason}` (`latency-buckets.ts:150-200`). Endpoints: `items[]{method, route, operationId, requests, succeeded, failed4xx, failed5xx, latencyMs{avg,p95,max}, firstSeenAt, lastSeenAt}`, `truncated`, `note`. |
| Ventana | `traffic-window.ts:24-44`, `common/time/analytics-window.ts:9-67` | «Hoy» = 00:00 **UTC**; máximo 92 días; por hora sólo ≤ 7 días; `timezone: 'UTC'` fijo. «Hoy en hora de Bolivia» quedó como decisión del cliente (`traffic-window.ts:17-19`). |
| Multi-instancia | ADR-0027 «Consecuencias» | Cada réplica vuelca sus filas; la lectura suma. Nada identifica la instancia. |
| Pérdida al reiniciar | `latency-buckets.ts` `lastMinuteNotFlushed` | Hasta un ciclo de volcado (se intenta volcar en el apagado ordenado). |

**Limitaciones que este plan ataca**: (a) sin errores individuales ni `requestId`; (b) sólo clases de estado, no códigos (`404` vs `422` vs `409` indistinguibles); (c) sin módulo/funcionalidad; (d) `jsonb` que obliga a parsear en cada lectura y sin clave idempotente; (e) sin `instance_id`; (f) percentiles sólo p50/p95 y estimados; (g) ventana sólo UTC y por hora/día; (h) apagada en Coolify.

### 1.2 Errores: filtro global, diagnóstico y log

- `AllExceptionsFilter.catch` (`API:src/common/filters/all-exceptions.filter.ts:191-291`): normaliza a `{status, code, message, details, reason, internals}` (`:221`), arma el cuerpo `{code, message, correlationId, details, reason, timestamp, path, diagnostics?}` (`:67-105`), marca la traza OTel (`:239`) y registra: **5xx** → `logger.error({err: safeErrorForLog(...), code, reason, correlationId, path, method, userId}, 'Unhandled exception')` y censura el cuerpo salvo `EXPOSABLE_5XX_CODES/REASONS` (`:242-266`); **<500** → `logger.warn({correlationId, code, reason, path, method, status, userId, violations…, integrity…}, message)` (`:267-285`).
- Catálogo de códigos: `ErrorCode` (`API:src/common/errors/error-codes.ts:7-68`: `VALIDATION_FAILED, UNAUTHENTICATED, FORBIDDEN, IDENTITY_VERIFICATION_REQUIRED, NOT_FOUND, CONFLICT, PRECONDITION_FAILED, CONCURRENCY_CONFLICT, PAYLOAD_TOO_LARGE, RATE_LIMITED, DEPENDENCY_UNAVAILABLE, TIMEOUT, CIRCUIT_OPEN, CONCURRENCY_LIMIT, IMPORT_*, INTERNAL`) y 40 `SystemErrorReason` (`system-error-reasons.ts`) más los `reason` de cada módulo (p. ej. `platform_ops.error-reasons.ts`). Errores del driver mapeados a `code+reason` con `sqlstate/constraint/table/column` (`all-exceptions.filter.ts:600-820`).
- Stack saneado para log: hasta 15 marcos `at …`, cadena de causas (5), `sqlstate`, `constraint`, `table`, `column`; **mensaje interno sólo con `API_ERROR_DIAGNOSTICS=true`** (`error-diagnostics.ts:101-165`). Marcos propios (`src/…:línea`) para el bloque `diagnostics` (`:80-98`, máx. 5).
- `req.id` / `correlationId`: `genReqId` (`API:src/logging/pino-options.ts:85-92`) → UUID v4 o el `x-request-id` entrante **sólo** con `TRUST_PROXY_HOPS > 0` (Coolify: 2, `.env.coolify.example:100`); se devuelve `X-Request-Id`. `mixin` añade `trace_id/span_id` del contexto OTel a cada línea (`:105-121`). `x-trace-id` en la respuesta (`observability/trace-response.interceptor.ts:58`) sólo con OTel encendido (`OTEL_ENABLED=false` en ambos env, `.env.example:397`, `.env.coolify.example:144`).
- **Dónde queda**: stdout del contenedor → Coolify/Dozzle (`API:infra/log-viewer/README.md`). No hay tabla ni índice por `correlationId`.
- Front: `ErrorReporter` genera `E-<commit>-NNN` y manda a `ErrorTelemetry` (OTel browser, apagado por defecto, `FRONT:src/app/core/errors/error-reporter.ts:80-128`, `environments/environment.development.ts:17-23`); el interceptor pone `traceparent` sólo a URLs de la API (`core/observability/http/tracing.interceptor.ts:145-156`, `propagation-allowlist.ts:11-20`). **No existe endpoint de la API que reciba errores del cliente.**

### 1.3 Consultas SQL (`src/orm/observability`)

- `OrmLogger extends DefaultLogger`, creado por `loggerFactory` con `ORM_SLOW_QUERY_MS` (`API:src/orm/config/orm.config.ts:133-136`, `orm.env.ts:140-143`): `logQuery({query, took, results|affected})` → `metrics.record(query, took, isSlow)` **siempre**, `warn 'consulta lenta'` si `took >= umbral` (con `statement`, `queryHash`, `rows`; SQL literal sólo con `ORM_LOG_SQL=true` y fuera de producción, `orm.logger.ts:19-23,115-121`), `debug 'consulta'` sólo con `MIKRO_ORM_DEBUG`. `error()` → `recordFailure()` (`:158-161`).
- `QueryMetrics`: `total, byKind, slowQueries, failedQueries, totalMs, maxMs, slowestQuery` (`query-metrics.ts:7-15`), proveedor global (`orm.module.ts:43-48`), **sin consumidor HTTP**.
- `normalizeSql` (literales/parámetros/números → `?`, `sql-redaction.ts:43-52`) y `sqlShapeHash` (sha256 de la forma, 12 hex, `:54-60`): huella estable sin datos.
- **Hueco**: `logQuery` no conoce la petición (no hay `AsyncLocalStorage` que una SQL ↔ `requestId`/ruta); el comentario «se registra siempre, aunque el modo debug esté apagado» (`orm.logger.ts:89-90`) afirma que MikroORM 7 invoca `logQuery` con `took` sin `debug`: **no verificado en ejecución** (no hay `node_modules` en esta máquina) → microtarea de prueba H4.S1.M1.
- `pg_stat_statements`: no verificado (ver §0.8). Pool: `DB_POOL_MIN/MAX` (`orm.env.ts:62-67`).

### 1.4 Resiliencia, HTTP saliente, Redis

- Cortacircuitos con `CircuitSnapshot{operation, state, failureRate, samples, consecutiveOpenings, retryAfterMs}` (`API:src/common/resilience/circuit-breaker.ts:67-75`); registrados en el worker (`worker-health.registry.ts:90-91`). No se persisten.
- `HttpDispatcherService` (webhooks/salientes): timeout 5 s/30 s, 1 MB (`API:src/common/http/http-dispatcher.service.ts:13-25,107-160`), devuelve `status` (0 si no hubo respuesta, `:86`). **Sin métrica.**
- `RedisRuntimeService.ping()` (`API:src/modules/redis_runtime/services/redis-runtime.service.ts:60`); sondas de `/readiness`: `postgresql` (+ integridad de esquema + seed), `mongodb`, `redis`, `opensearch`, `rls` (`API:src/app-readiness.service.ts:69-79`, `probe` en `:226`). Resultado: `{status, checks{name:{status, latencyMs, errorType}}}`, **503 si alguna cae** (`:83-102`); no se guarda historial.

### 1.5 Workers

25 entrypoints `src/worker-*.ts`; en Coolify sólo 4 (`API:docker-compose.coolify.yml:823-835`). `runTick` alimenta `workerHealth` (`run-tick.util.ts:89-161`): `TickHealth{operation, inFlightSince, lastStartedAt, lastFinishedAt, lastDurationMs, lastOutcome(ok|failed|timeout|skipped), lastErrorCode, runs, failures, timeouts, skipped, consecutiveFailures}` (`worker-health.registry.ts:9-22`). Sonda `GET /health|/readiness|/status` en loopback (`worker-health.server.ts:120-150`). Los workers son clientes HTTP de la API con token `SYSTEM` (`04-sonda-de-vida.md` §1.4). Colas: `messaging.outbox_messages`, `cross_store_consistency.projection_delivery_attempts` (grep `outbox` en entidades) — hay materia prima para «lag» pero ninguna lectura agregada.

### 1.6 `platform_ops`, `system_ops`, `time_series`

- SLI (`service_level_indicators.query_definition_json`, `good_event_definition`, `total_event_definition`), SLO (`target_value numeric(12,8)`, `rolling_window_seconds`, `warning_threshold`), `slo_measurements` (`window_start/end`, `good_events`, `total_events`, `attained_value`, `status_concept_id`, `source_reference`; `<<LOG>>` sin `row_version`), `error_budget_policies` (`budget_percent`, `burn_rate_warning/critical`, `deployment_freeze_on_exhaustion`), `error_budget_burn_events` (`burn_rate`, `remaining_budget_percent`, `health_incident_id`), `health_checks` / `health_check_runs` (`latency_ms`, `http_status`, `status_concept_id`, `recorded_at`), `health_incidents` (`MODEL:SQL/46_platform_ops/02_tables.sql`, puml `diagram_46_platform_ops.puml:441-470,1077-1083`). Índices nombrados `pk_*`, `uq_*`, `ix_*`, `brin_*` (`04_indexes.sql:1-12`).
- `system_ops`: gobierno y retención de datos (`retention_policies`, `retention_executions`, `partition_specs`, …; `MODEL:SQL/11_system_ops/02_tables.sql`). No tiene nada de procesos vivos.
- `time_series` (módulo 58, **NoSQL** en el modelo, generado por `gen_nosql.py` desde `diagram_58_time_series.puml`, `MODEL:salud-db/gen_nosql.py:1-14`): hypertables de 1 día, políticas sólo como comentario «definir intervalos concretos» (`time_series.timescaledb.sql:236-258`). Rollups y retención viven en la API (`ROLLUPS`, `TS_RETENTION_POLICIES`) y los dispara `worker-time_series` vía `POST /ts/admin/rollups/:name/refresh` y `/ts/admin/retention/policies` (`API:src/modules/time_series/README.md:37-51`).
- Consola: `GET /admin/ops/{readiness, incidents, incidents/:id, deployments, change-requests, slos, backups, traffic, traffic/endpoints}`, roles `OPS_READ_ROLES = PLATFORM_ADMIN, SRE, SECURITY_ADMIN, RELEASE_MANAGER, GOVERNANCE_ADMIN` (`ops-console.controller.ts:14-25`). Módulo **sin tablas, sólo SELECT** (README).

### 1.7 Infra fuera de la API

`infra/monitoring`: Prometheus + Alertmanager + Telegram + Grafana en el VPS; métricas de Traefik (`router:requests:rate5m`, `router:errors5xx:rate5m`, `router:latency_p95_seconds:5m`, alertas `SiteErrors5xx*`, `SiteLatencyHigh`, `API:infra/monitoring/prometheus/rules/traffic.yml`), `otel-collector` que convierte trazas en `spanmetrics` con los mismos 11 cortes (`infra/monitoring/otel-collector/config.yaml:45-49`) — vacío mientras `OTEL_ENABLED=false`. Nada de esto es legible por la API ni existe en local.

### 1.8 Front hoy

- `features/admin/observability` (`FRONT:src/app/features/admin/observability/observability.ts:69-175`, `.html:16-140`): pestañas **Resumen** (5 indicadores + barras CSS por intervalo), **Endpoints** (tabla, orden `requests|failed|p95`), **Usuarios activos**, **No medido**; rangos `hoy|24h|7d`; estados `loading/ready/empty(disabled | sin peticiones)/error` vía `errorToViewState` (`:81-100`). Sin ECharts (el organismo `shared/components/organisms/chart-panel/` existe, ADR-0017). 11 pruebas unitarias (`observability.spec.ts:100-191`). Cubre S1/S2/S4/S5/S9; no hay S7 (`stale`) ni S8 (`offline`).
- `features/admin/instances` y `dashboard/platform-home` consumen `OpsLivenessClient`/`OpsToolsClient` (**sin API**, §0.4) y `OpsTrafficClient`.
- Navegación: `superadmin/observability` y `superadmin/instances` (`FRONT:src/app/core/navigation/navigation.platform.ts:87-98,194-204`). nginx proxea `/admin/ops` (`FRONT:deploy/api-locations.conf:194`); **`/admin/observability` habrá que añadirlo** (H7.S4).
- `ViewState`: 10 estados tipados (`core/view-state/view-state.types.ts:79-195`: `route-auth-pending, loading, empty, ready, validation, forbidden, not-found, stale, offline, error`), fábricas `stale(data, asOf)`, `unexpectedError(requestId)` (`view-state.ts:97-113`).

---

## 2. Objetivo, alcance y principios

**Objetivo**: un panel «Sistema» del Portal Admin de AloVida que responda, con datos reales y persistidos, (1) cuántas peticiones recibe la plataforma y con qué resultado, (2) cuánto tarda y dónde, (3) **qué errores ocurren, cuántas veces, desde cuándo, en qué parte, con qué `requestId`**, (4) qué consultas SQL pesan, (5) si los workers y las dependencias están vivos, (6) cómo va el SLO. Todo a nivel de plataforma (sin elegir organización), sin PHI/PII, y declarando lo que no se mide.

**Fuera de alcance de esta franja** (otros archivos del portal): heatmap de uso por funcionalidad (lo cubre `0X-uso-y-heatmap`; acá se entrega la serie por módulo que lo alimenta), catálogo/gobierno de datos, sacar la selección de tenant en el login (contexto común §1).

**Principios**: medir nunca tumba una petición (patrón `http-sli`); `null ≠ 0` y `notMeasured[]{metric, reason}` en cada respuesta; sólo plantillas de ruta, huellas y conteos (regla 90.2); la API autoriza (`OPS_READ_ROLES`; mutaciones sólo `PLATFORM_ADMIN|SRE`); esquema en el modelo primero (`.puml` → `gen_ddl/gen_nosql/gen_entities` → parche para la base viva); idempotente y multi-instancia por diseño (`instance_id`, claves naturales, `ON CONFLICT DO NOTHING`); retención explícita.

---

## 3. Arquitectura propuesta

```text
                 ┌──────────── proceso API (×N instancias, instance_id propio) ────────────┐
petición ──► middleware HTTP ──► contexto de petición (ALS: requestId, método, plantilla, operationKey, módulo)
   │             │                                   │
   │             ▼ res.finish                        ▼ cada SQL (OrmLogger.logQuery)
   │     HttpSink (minuto × método × plantilla × código)   SqlSink (minuto × queryHash × módulo) + muestras lentas
   │
   └─► excepción ──► AllExceptionsFilter ──► ErrorSink (evento + huella) ──┐
                                                                            ▼
                      ObservabilityFlushService (cada 15–60 s, 1 transacción, reintento 1, nunca lanza)
                                                                            ▼
      time_series (hypertables):  observability.http_request_minute_series · sql_statement_minute_series ·
                                  error_events · slow_request_samples · worker_tick_minute_series · dependency_probe_runs
      observability (relacional): error_groups · sql_statements · instances · rollup_watermarks
      platform_ops (reuso):       service_level_* · slo_measurements · error_budget_* · health_incidents

workers ──POST /internal/observability/heartbeats (SYSTEM)──► instances + worker_tick_minute_series
API (scheduler) ──sondas por minuto──► dependency_probe_runs ; rollups minuto→hora→día ; SLO ; alertas → health_incidents

front «Sistema» ──GET /admin/observability/* (OPS_READ_ROLES)──► 7 pestañas, 9 estados ViewState
```

Decisión de módulo («un módulo, no un servicio»): **módulo nuevo `src/modules/observability`** con su schema `observability`, entidades generadas, repositorios, rollups, ingestión de latidos y lectura `GET /admin/observability/*`. Razones: `ops_console` es por contrato «sin tablas, sólo SELECT» (`README.md`) y esto necesita escritura, estado (`error_groups.state`) y jobs; `src/observability/` sigue siendo la capa transversal de captura (middleware instalado en `main.ts` antes del contenedor, `http-sli.tokens.ts:3-9`, logger del ORM creado antes del contenedor, `orm.module.ts:43-45`) y expone *sinks* en memoria que el módulo vuelca. `GET /admin/ops/traffic*` se mantiene intacto durante la franja (el front y `platform-home` dependen de él) y en H7 pasa a leer de la tabla nueva sin cambiar su contrato.

---

## 4. Modelo de datos (en `mantra-core-health-model`, primero)

Convenciones copiadas de `SQL/46_platform_ops/02_tables.sql` y `04_indexes.sql`: `uuid` PK `pk_<tabla>`, `timestamptz`, `*_concept_id uuid` a `terminology.catalog_concepts`, `created_at/updated_at`, `created_by_user_id/updated_by_user_id`, `row_version integer NOT NULL DEFAULT 1` en agregados mutables (no en `<<LOG>>`), índices `ix_`, `uq_`, `brin_`. Se declara en un **`diagram_70_observability.puml` nuevo** (relacional, módulo 70: el último es 69) y las series en **`diagram_58_time_series.puml`** (hypertables, `gen_nosql.py` → `NoSQL/58_time_series_timescaledb/`). Nombres de schema: `observability` para todo lo nuevo (las hypertables también pueden vivir ahí: `create_hypertable` acepta cualquier schema; `physical.catalog.ts:17-41` deberá listarlas). Parche para base viva: `SQL/patches/2026-11-xx_v42xx_observabilidad_sistema.sql`, idempotente, con el estilo de `2026-10-31_v4278_gobierno_de_accesos.sql:1-40`.

### 4.1 Tablas nuevas (las cinco más importantes primero)

**T1 `observability.error_groups`** (agregado mutable; «huella» = grupo)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `fingerprint` | varchar(64) NOT NULL | sha256 de `source|code|reason|exception_type|method|route_template|top3 marcos propios (archivo:línea)`. `uq_error_groups_fingerprint`. |
| `source` | varchar NOT NULL | `api` / `worker` / `web` |
| `http_status` | integer | |
| `error_code` | varchar NOT NULL | `ErrorCode` |
| `error_reason` | varchar | `reason` del módulo |
| `exception_type` | varchar | `TypeError`, `UniqueConstraintViolationException`… |
| `module_code` | varchar | de `catalog_operations.module_code` (o `UNKNOWN`) |
| `operation_key` | varchar | `Controller_handler` |
| `http_method`, `route_template` | varchar | plantilla, nunca URL |
| `title` | varchar NOT NULL | `code · reason · ruta`, generado |
| `sample_message` | text | mensaje **redactado** (`redactDriverMessage`, 500 chars) |
| `sample_frames_json` | jsonb | ≤ 15 marcos sin columnas de código, rutas relativas |
| `first_seen_at`, `last_seen_at` | timestamptz NOT NULL | |
| `occurrences_total` | bigint NOT NULL | sólo se incrementa por filas **efectivamente insertadas** en `error_events` (idempotente) |
| `occurrences_24h` | bigint NOT NULL | recalculado por rollup |
| `affected_actors_24h` | integer | `COUNT(DISTINCT actor_hash)`; `null` si `minSample` no se alcanza |
| `state_concept_id` | uuid NOT NULL FK | `NEW / SEEN / RESOLVED / IGNORED` (conceptos nuevos del catálogo `observability.error_group_state`) |
| `assigned_to_user_id` | uuid FK | |
| `resolved_at`, `resolved_by_user_id`, `resolution_note` | | |
| `regressed_at` | timestamptz | un `RESOLVED` que vuelve a verse → `NEW` + marca |
| `last_request_id` | varchar | para abrir la traza al toque |
| `created_at, updated_at, created_by_user_id, updated_by_user_id, row_version` | | |

Índices: `uq_error_groups_fingerprint(fingerprint)`, `ix_error_groups_state_last_seen(state_concept_id, last_seen_at DESC)`, `ix_error_groups_module_last_seen(module_code, last_seen_at DESC)`, `ix_error_groups_code(error_code, error_reason)`.

**T2 `observability.error_events`** (`<<LOG>>`, hypertable por `occurred_at`, chunk 1 día)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid NOT NULL | `uq_error_events_id_time(id, occurred_at)` (Timescale exige la columna de tiempo en la unicidad) |
| `occurred_at` | timestamptz NOT NULL | |
| `error_group_id` | uuid NOT NULL FK → `error_groups` | |
| `request_id` | varchar | `correlationId`; `ix_error_events_request_id(request_id, occurred_at DESC)` — **la búsqueda por `requestId`** |
| `trace_id` | varchar(32) | del contexto OTel si hay |
| `instance_id` | uuid NOT NULL FK → `instances` | |
| `source`, `http_status`, `error_code`, `error_reason`, `exception_type`, `module_code`, `operation_key`, `http_method`, `route_template` | | desnormalizado para filtrar sin JOIN |
| `tenant_id` | uuid | del token, nullable (plataforma); nunca del cuerpo |
| `actor_hash` | varchar(64) | `HMAC(user_id, OBSERVABILITY_ACTOR_HASH_SECRET)`; nunca el id. **Decisión D-02**. |
| `duration_ms` | integer | de la petición |
| `sqlstate`, `constraint_name`, `table_name`, `column_name` | varchar | lo mismo que ya va al log |
| `violations_json` | jsonb | sólo `{field, constraint}` (`violationsForLog`), sin valores |
| `message_redacted` | text | 500 chars, `redactDriverMessage` |
| `frames_json` | jsonb | ≤ 15 marcos |
| `client_kind` | varchar | `browser/mobile/worker/unknown` (clasificación del UA, no el UA) |
| `created_at` | timestamptz NOT NULL | |

Índices: `ix_error_events_group_time(error_group_id, occurred_at DESC)`, `ix_error_events_module_time(module_code, occurred_at DESC)`, `brin_error_events_time(occurred_at)`. Retención: 90 días (`drop_chunks`).

**T3 `observability.http_request_minute_series`** (hypertable por `time`, chunk 1 día; reemplaza el `jsonb` de `service_sli_series` para esta lectura)

`time timestamptz NOT NULL`, `instance_id uuid NOT NULL`, `flush_seq integer NOT NULL` (ordinal del volcado dentro del minuto en esa instancia), `http_method varchar NOT NULL`, `route_template varchar NOT NULL`, `operation_key varchar`, `module_code varchar`, `http_status integer NOT NULL` (código exacto; `0` = abortada), `requests integer NOT NULL`, `sum_ms double precision NOT NULL`, `max_ms double precision NOT NULL`, `le5 … le10000 integer NOT NULL` (11 columnas, acumuladas como hoy), `created_at`. **`uq_http_minute_key(time, instance_id, flush_seq, http_method, route_template, http_status)`** → el reintento de un volcado hace `ON CONFLICT DO NOTHING` (idempotente; hoy la retry puede duplicar si la primera transacción confirmó y la respuesta se perdió). Índices: `ix_http_minute_module_time(module_code, time DESC)`, `ix_http_minute_route_time(route_template, http_method, time DESC)`, `brin_http_minute_time(time)`. Retención crudo 14 días; agregados `observability.http_request_hourly` / `_daily` (continuous aggregates, §4.3) 400 días / 5 años.

**T4 `observability.sql_statement_minute_series`** (hypertable) + **`observability.sql_statements`** (catálogo)

- Catálogo: `query_hash varchar(12) PK` (`sqlShapeHash`), `statement_class varchar` (`select/insert/update/delete/ddl/other`, `classifyQuery`), `normalized_sql text` (≤ 2000, sin literales), `primary_table varchar` (primer `FROM/INTO/UPDATE <schema.tabla>` parseado; `null` si no se reconoce), `first_seen_at`, `last_seen_at`, `is_slow_ever boolean`, `created_at, updated_at, row_version`. `uq_sql_statements_hash`.
- Serie: `time`, `instance_id`, `flush_seq`, `query_hash`, `module_code`, `operation_key`, `executions integer`, `sum_ms`, `max_ms`, `slow_count`, `failed_count`, `rows_sum bigint`, `le1, le5, le10, le25, le50, le100, le250, le500, le1000, le5000, inf` (histograma propio para p50/p95/p99 de SQL), `created_at`. `uq_sql_minute_key(time, instance_id, flush_seq, query_hash, operation_key)`. Índices `ix_sql_minute_hash_time(query_hash, time DESC)`, `ix_sql_minute_module_time(module_code, time DESC)`.
- Cardinalidad: ≤ 5000 `query_hash` por minuto por instancia; el excedente a `__overflow__`.

**T5 `observability.instances`** (registro de procesos) + **`observability.worker_tick_minute_series`**

- `instances`: `id uuid PK` (generado al arrancar), `kind varchar NOT NULL` (`API/WORKER`), `name varchar NOT NULL` (`api`, `worker-messaging`…), `build_commit varchar`, `build_version varchar`, `host_hash varchar(64)` (sha256 del hostname, no el hostname), `started_at timestamptz NOT NULL`, `last_seen_at timestamptz NOT NULL`, `status varchar NOT NULL` (`starting/running/draining/stopped`), `last_snapshot_json jsonb` (ticks, circuitos, memoria: lo que hoy da `/status`), `expected boolean` (si figura en la lista esperada del entorno), `created_at, updated_at, row_version`. Índices `ix_instances_kind_last_seen(kind, last_seen_at DESC)`, `ix_instances_name(name)`.
- `worker_tick_minute_series` (hypertable): `time`, `instance_id`, `worker_name`, `operation`, `runs`, `failures`, `timeouts`, `skipped`, `sum_ms`, `max_ms`, `consecutive_failures_max`, `created_at`; `uq_worker_tick_key(time, instance_id, operation)`.

**Otras tablas**

- `observability.slow_request_samples` (hypertable, 30 días): `time`, `request_id`, `trace_id`, `instance_id`, `http_method`, `route_template`, `operation_key`, `module_code`, `http_status`, `duration_ms`, `sql_count`, `sql_total_ms`, `sql_top_json` (≤ 5 `{query_hash, executions, sum_ms}`), `sampled_because varchar` (`slow` ≥ `OBSERVABILITY_SLOW_REQUEST_MS` [2000], `error`, `random` 1 %). `ix_slow_request_request_id(request_id)`. Es lo que vuelve «traza por `requestId`» algo más que el error: muestra el SQL de esa petición.
- `observability.dependency_probe_runs` (hypertable, 30 días): `time`, `instance_id`, `dependency_code varchar` (`postgresql, redis, mongodb, opensearch, minio, smtp_gmail, ga4, siat, elevenlabs…`), `service_component_id uuid FK → platform_ops.service_components` (reuso del catálogo de componentes), `status varchar` (`up/degraded/down/not_probed`), `latency_ms integer`, `error_type varchar`, `created_at`. `uq_dependency_probe_key(time, instance_id, dependency_code)`.
- `observability.rollup_watermarks`: `rollup_name varchar PK`, `materialized_until timestamptz NOT NULL`, `last_run_at`, `last_duration_ms`, `last_error varchar`, `row_version`. Para rollups manuales idempotentes cuando no haya continuous aggregates.
- `observability.alert_rules` (mutable; `code`, `metric`, `comparator`, `threshold numeric`, `for_seconds`, `severity_concept_id`, `enabled`, `module_code`, `route_template`, `row_version`) y `observability.alert_evaluations` (`<<LOG>>`: `time`, `alert_rule_id`, `observed_value`, `fired boolean`, `health_incident_id FK → platform_ops.health_incidents`). Las alertas **abren/actualizan incidentes de `platform_ops`** en vez de inventar otro buzón.
- `observability.client_error_events` (hypertable, 30 días; **D-03**): `time`, `client_error_id varchar` (`E-<commit>-NNN`), `request_id` (si el error vino de la API), `route_template` (del router Angular, saneada por `sanitize-url`), `error_name`, `message_redacted`, `frames_json`, `app_version`, `rendering_mode`, `client_kind`, `actor_hash`.

### 4.2 Conceptos y semillas

Conceptos nuevos en `terminology.catalog_concepts` (vía `seedsProd/*.seeds.json`, ids deterministas como hace el parche v4278): `observability.error_group_state` (`NEW, SEEN, RESOLVED, IGNORED`), `observability.alert_severity` (reusar `platform_ops` severidades si existen → verificar en H1.S2). `platform_ops.service_components` sembrados para `api`, `worker-*`, `postgresql`, `redis`, `mongodb`, `opensearch`, `minio`; `service_level_indicators` ×3 (`api_availability`, `api_latency_p95`, `api_error_rate_5xx`) con `query_definition_json = {source:'http_request_minute_series', filter:{…}}`, `service_level_objectives` ×3 (99,5 % / p95 ≤ 1000 ms / ≤ 1 % en 30 días rodantes), `error_budget_policies` ×3.

### 4.3 Rollups, particionado, retención

- Hypertables con `chunk_time_interval => 1 day` (como las 12 existentes); las convierte `physical.catalog.ts` al arrancar (`TIMESERIES_TABLES` debe incluir las nuevas; `migrate_data => TRUE` ya está previsto, `:33-41`).
- Agregados continuos nuevos en `ROLLUPS` (`time-series.constants.ts:143`): `observability_http_hourly`, `observability_http_daily`, `observability_sql_hourly`, `observability_errors_hourly` (grupo × hora). Refresco: `refresh-rollups.job` ya existe; **D-04**: desplegar `worker-time_series` en Coolify o ejecutar el refresco desde un `@Interval` en la API (`@nestjs/schedule` ya se usa). Mientras no se decida, el módulo trae `rollup_watermarks` + `INSERT … SELECT … ON CONFLICT DO UPDATE` manual minuto→hora→día, idempotente por ventana `[materialized_until − 2 h, now − 1 min)`.
- Retención: `TS_RETENTION_POLICIES` pasa a declarar `error_events:90d, http_request_minute_series:14d, sql_statement_minute_series:14d, slow_request_samples:30d, dependency_probe_runs:30d, worker_tick_minute_series:30d, client_error_events:30d`; agregados horarios 400 d; diarios 5 años. Documentado en `system_ops.retention_policies` (fila por tabla, para que el gobierno de datos lo vea).

---

## 5. API

### 5.1 Instrumentación (captura)

| Pieza | Dónde | Qué hace |
|---|---|---|
| **Contexto de petición** (`src/observability/request-context/`) | `AsyncLocalStorage<{requestId?, method, routeTemplate?, operationKey?, moduleCode?, startedAt, sqlCount, sqlMs, sqlTop}>` abierto en el middleware de `main.ts` (antes de pino-http, que corre después como middleware de módulo, por eso `requestId` se completa en `res.finish` leyendo `req.id`; `pino-options.ts:85`). | Une SQL ↔ petición ↔ error sin pasar parámetros. Nunca lanza. |
| **HttpSink** | Evolución de `HttpSliAggregator`: clave `minuto|método|plantilla|código`, `operation_key/module_code` resueltos al drenar con `RouteIndexService.lookup` + mapa `catalog_operations` cacheado (refresco cada 10 min; fallback `module_code = controller → módulo` por `InstanceWrapper.host` de `DiscoveryService`, **no verificado**). Mantiene también el volcado a `service_sli_series` durante H1–H6 (doble escritura) para no romper `/admin/ops/traffic*`. | `flush_seq` por minuto e instancia. |
| **ErrorSink** | Llamado desde `AllExceptionsFilter.catch` después de `normalize` y antes de `response.json` (`all-exceptions.filter.ts:221-233`), en `try/catch` propio. Construye `fingerprint`, evento y agrupa en memoria `{fingerprint → {count, sample}}`; tope **500 eventos/minuto/instancia**; por encima sólo cuenta (`occurrences_total` sube, no hay fila de evento, y `notMeasured.errorSampling` lo declara). | 4xx también se capturan (el `404` de una ruta que el front pide mal es un error de la app), pero `UNAUTHENTICATED` sin sesión y `RATE_LIMITED` se agregan **sin evento individual** (ruido y vector de llenado). |
| **SqlSink** | `OrmLogger.logQuery` → `sqlSink.record(hash, class, took, rows, ctx)`; `error()` → `failed_count`. Muestra lenta (`slow_request_samples`) al cerrar una petición con `duration ≥ OBSERVABILITY_SLOW_REQUEST_MS`, con error, o 1 % aleatorio. | El SQL normalizado va al catálogo una vez (`ON CONFLICT (query_hash) DO UPDATE SET last_seen_at`). |
| **Flush** | `ObservabilityFlushService` (módulo nuevo): cada `OBSERVABILITY_FLUSH_SECONDS` (15–3600, 30) drena los tres sinks + muestras, una transacción, `ON CONFLICT DO NOTHING`, reintento 1 vez, luego descarte con `droppedFlushes++` (expuesto en `/coverage`); volcado en `onApplicationShutdown`. Patrón literal de `http-sli-flush.service.ts:101-171`. | Con `RLS_ENFORCE=true` las tablas nuevas **no llevan `tenant_id` obligatorio** (son de plataforma): la política RLS no aplica (verificar en el parche que `2026-08-05_tenant_rls.sql` no las alcance). Cierra la deuda TS-07 para estas tablas. |
| **Latidos de workers** | `WorkerHealthRegistry.snapshot()` cada `WORKER_HEARTBEAT_SECONDS` (30) → `POST /internal/observability/heartbeats` (rol `SYSTEM`, excluido de `HttpSink` y de las trazas añadiéndolo a `EXCLUDED_HTTP_PATHS` o a una lista propia; ver `04-sonda-de-vida.md` §1.4 sobre ensuciar `/traffic`). Cuerpo: `{instanceId, kind:'WORKER', name, startedAt, status, build, ticks[], circuits[]}`. Fallos de tick → `POST /internal/observability/errors` (source `worker`). | La API registra su propia instancia al arrancar y la refresca en cada flush. Lista **esperada** por entorno: `OBSERVABILITY_EXPECTED_INSTANCES=api,worker-messaging,…` (**D-05**; en local 25 workers, en Coolify 4). |
| **Sondas de dependencias** | `@Interval(60_000)` en la API: reutiliza `AppReadinessService.probe` (`app-readiness.service.ts:226`) para `postgresql/mongodb/redis/opensearch/rls` (`:69-79`) y añade MinIO (`HEAD` bucket), SMTP/Gmail, GA4 adapter, SIAT, ElevenLabs cuando estén configurados (`not_probed` si no). Resultado a `dependency_probe_runs`. | Nunca un `503`: el panel muestra el historial. |
| **Correlación** | `requestId` = `req.id` (pino) = `correlationId` del cuerpo = cabecera `X-Request-Id`; `trace_id` del `mixin` si OTel. El front ya lo tiene en `ViewState.requestId`. Para el log: el flush escribe `logger.info({operation:'observability.flush', rows})`; buscar un `requestId` en Dozzle sigue siendo posible. | Front → API → SQL: `slow_request_samples.sql_top_json` + `error_events.request_id`. |
| **Privacidad** | Sin URL real, query, cuerpo, cabeceras, IP, UA, `user_id`. `actor_hash` con secreto propio (D-02). Mensajes por `redactDriverMessage` + 500 chars; `details` sólo nombres de campo/restricción. Nada de esto entra en etiquetas de series (sólo plantilla, código, módulo, hash). | Revisión de privacidad (DPO) antes de encender en Coolify. |

### 5.2 Endpoints de lectura (`@Controller('admin/observability')`, `@Roles(...OPS_READ_ROLES)`)

Sobre común: `{ window: {from, to, interval:'minute'|'hour'|'day', timezone}, freshness: {lastFlushAt, lagSeconds, droppedFlushes}, notMeasured: [{metric, reason}], generatedAt, … }`. Ventana: `resolveTrafficWindow` extendido con `interval: 'minute'` (≤ 24 h) y parámetro `tz` (IANA validado contra `pg_timezone_names`; cubos con `date_trunc(interval, time AT TIME ZONE tz)`; **D-01** fija el valor por defecto). Paginación: cursor keyset con `encodeKeysetCursor/decodeKeysetCursor` (`API:src/common/pagination/keyset-cursor.ts:22-47`), `limit ≤ 200`. Errores de ventana: `422 VALIDATION_FAILED` con `reason` (como hoy).

| Ruta | Pregunta que responde | Respuesta (resumen) |
|---|---|---|
| `GET /summary?from&to&tz` | ¿Cómo está el sistema ahora y en la ventana? | `kpis: {requests, errorRate5xx, errorRate4xx, latencyMs:{p50,p95,p99,method,approximate}, errorGroups:{new, open, regressed}, slowSql:{count, topHash}, workers:{alive, expected, late}, dependencies:{up, down, notProbed}, slo:{worstBudgetRemainingPct, burning:boolean}}` cada uno `{value|null, reason?}` |
| `GET /timeseries?metric=requests\|errors4xx\|errors5xx\|latency_p95\|latency_p99\|sql_ms\|sql_slow\|error_events&interval&groupBy=none\|module\|status_class&from&to&tz` | ¿Cómo evolucionó X? | `series[]{key, points[]{bucket, value}}`, `minSample` |
| `GET /endpoints?from&to&module&sort=requests\|failed\|p95\|p99\|errorGroups&cursor&limit` | ¿Qué operación falla o tarda más? | `items[]{method, route, operationKey, moduleCode, requests, failed4xx, failed5xx, latencyMs{p50,p95,p99,max}, errorGroupsOpen, lastSeenAt}`, `nextCursor` |
| `GET /modules?from&to` | ¿Qué parte de la app concentra errores/latencia? | `items[]{moduleCode, requests, failed4xx, failed5xx, errorRate, latencyMs{p95}, errorGroupsOpen}` (alimenta el heatmap de la otra franja) |
| `GET /modules/heatmap?metric=errors\|requests\|p95&interval=hour\|day&from&to&tz` | ¿Cuándo y dónde? | `rows[]{moduleCode}`, `cols[]{bucket}`, `cells[][]{value|null}` |
| `GET /errors/groups?state&module&code&source&from&to&sort=last_seen\|occurrences\|first_seen&cursor` | ¿Qué errores hay, cuántos, desde cuándo? | `items[]{id, title, source, httpStatus, code, reason, moduleCode, operationKey, method, route, state, firstSeenAt, lastSeenAt, occurrencesTotal, occurrences24h, affectedActors24h|null, sparkline[]{bucket,count}, lastRequestId}` |
| `GET /errors/groups/:id` | ¿Qué es exactamente este error? | grupo + `sampleMessage`, `sampleFrames[]`, `series[]`, `byModule[]`, `recentEvents[]{occurredAt, requestId, traceId, httpStatus, instanceId, durationMs}` (≤ 50) |
| `PATCH /errors/groups/:id` (`PLATFORM_ADMIN, SRE`) | Marcar visto / resuelto / ignorado | cuerpo `{state, note?, rowVersion}` → `409 CONCURRENCY_CONFLICT` si `row_version` no coincide; auditado (`@Audited`). |
| `GET /errors/events?groupId&requestId&from&to&cursor` | Lista cruda de eventos | `items[]` (sin mensajes: sólo ids, códigos, tiempos) |
| `GET /requests/:requestId` | ¿Qué pasó con esta petición que el usuario reportó? | `{requestId, found: boolean, errors[]{…}, slowSample?{…sqlTop[]}, traceId?, hint}`; `found:false` → el front muestra `not-found` con «sólo se guardan errores y muestras lentas; el log del servidor conserva el resto». |
| `GET /sql/statements?from&to&sort=total_ms\|p95\|executions\|slow&module&cursor` | ¿Qué consultas pesan? | `items[]{queryHash, statementClass, primaryTable, executions, totalMs, latencyMs{p50,p95,p99,max}, slowCount, failedCount, modules[]}` |
| `GET /sql/statements/:hash` | ¿Qué es esta consulta y quién la dispara? | `normalizedSql`, series, `operations[]{operationKey, moduleCode, executions}`, `slowSamples[]{requestId, durationMs, occurredAt}` |
| `GET /sql/slow?from&to&cursor` | Peticiones lentas recientes | `slow_request_samples` paginadas |
| `GET /workers` | ¿Están vivos los workers? ¿Qué tick falla? | `instances[]{id, kind, name, status, startedAt, lastSeenAt, ageSeconds, state: VIVA\|DEGRADADA\|CAIDA\|SIN_DATO, cause, ticks[]{operation, runs, failures, timeouts, consecutiveFailures, lastOutcome, lastDurationMs}, circuits[]}`, `expected[]`, `missing[]` — **mismo vocabulario que `ops-liveness.types.ts`** para que `instances` y `platform-home` dejen el simulador. |
| `GET /dependencies?from&to` | ¿Qué dependencia falla o está lenta? | `items[]{code, componentId, status, lastProbeAt, latencyMs, uptimePct, series[]}` |
| `GET /slo` | ¿Cumplimos el objetivo? ¿Cuánto presupuesto queda? | reuso de `platform_ops`: `items[]{sloId, indicator, target, window, attained, goodEvents, totalEvents, budgetRemainingPct, burnRate1h, burnRate6h, status, measuredAt}` (extiende `OpsConsoleService.listSlos`) |
| `GET /coverage` | ¿Qué se mide y qué no? ¿Está sana la propia medición? | `flags{httpSli, observability, otel, diagnostics}`, `flush{lastAt, droppedFlushes, pendingGroups}`, `instances`, `notMeasured[]` completo (incluye `rejectedBeforeApi`, `healthchecksExcluded`, `errorSampling`, `percentilesEstimated`, `sqlOnlyOrm` — SQL fuera de MikroORM, p. ej. `pg` directo del harness, no se ve) |
| `POST /internal/observability/heartbeats`, `POST /internal/observability/errors` (`SYSTEM`) | ingestión de workers | `202` |
| `POST /observability/client-errors` (**D-03**) | errores del navegador | sesión opcional, throttle propio 30/min/IP, esquema cerrado |

OpenAPI (`API:openapi/endpoints/observability.md`) e inventario (`yarn inventario:endpoints`) se regeneran en H7; el front refresca el contrato con `yarn contract:refresh` (`FRONT:package.json:34`).

### 5.3 Alertas por umbral

Evaluación cada minuto en la API (`@Interval`), con `alert_rules` sembradas: `5xx_rate > 5 % durante 5 min` (misma regla que Traefik, `traffic.yml:30-52`), `p95 > 2 s durante 10 min`, `error_group_new` (grupo con `first_seen` en los últimos 5 min y ≥ 3 ocurrencias), `worker_heartbeat_late` (> 3 × intervalo), `dependency_down` (3 sondas seguidas), `slo_burn_rate > critical`. Al disparar: `OpsIncidentsService` abre/actualiza `health_incidents` (sin duplicar: una abierta por regla+objetivo) y `error_budget_burn_events` cuando corresponda; el panel muestra el incidente abierto en la pestaña Resumen. Telegram/Alertmanager quedan fuera (viven en el VPS y no en local).

---

## 6. Front: pestañas, widgets y contratos (el visual lo hace otro agente)

Una tarjeta a lo ancho con pestañas (`composition-rules.md` §5), selector de ventana (`hoy | 24 h | 7 d | 30 d | personalizado`) y zona horaria declarada; cada widget con sus 9 estados; `null` → «sin dato» con el `reason`. Formas según `dataviz/references/choosing-a-form.md` (tabla «The job → the type»); una sola paleta validada con `scripts/validate_palette.js`; sin doble eje, sin donas, sin cifra en cada punto (`anti-patterns.md`).

| Pestaña | Widget | Pregunta | Endpoint · campo | Forma dataviz | Estados especiales |
|---|---|---|---|---|---|
| **Resumen** | Fila de KPI (6 tiles) | ¿Está bien el sistema? | `/summary.kpis.*` | stat tile con delta vs ventana anterior y sparkline (`/timeseries`) | `empty` si `requests=0`; `empty` con acción si `coverage.flags.observability=false` |
| | Peticiones y errores en el tiempo | ¿Cuándo pasó? | `/timeseries?metric=requests` + `errors5xx` | línea (peticiones) + énfasis en 5xx; un eje | `stale` si `freshness.lagSeconds > 180` |
| | Incidentes abiertos y alertas | ¿Hay algo ardiendo? | `/admin/ops/incidents?open=true` (existe) + `/slo.burning` | lista | `empty` «sin incidentes abiertos» |
| | Cobertura | ¿Qué no se mide? | `/coverage.notMeasured` | lista; banner si `droppedFlushes>0` | — |
| **Errores** | Grupos | ¿Qué falla, cuánto, desde cuándo? | `/errors/groups` | tabla ordenable + sparkline por fila; filtros estado/módulo/código/origen; estado como chip | `empty` por filtro ≠ `empty` global |
| | Detalle de grupo (panel lateral o ruta hija) | ¿Qué es y dónde? | `/errors/groups/:id` | hero figure (ocurrencias), línea, barras horizontales por módulo, tabla de eventos con `requestId` copiable | `PATCH` estado → `validation` en 409 con «recargar» |
| | Buscar `requestId` | Un usuario me pasó un código | `/requests/:requestId` | ficha | `not-found` con explicación |
| | Nuevos vs regresiones | ¿Qué apareció hoy? | `/errors/groups?state=NEW&from=hoy` | tabla corta | — |
| **Latencia** | p50/p95/p99 en el tiempo | ¿Se degradó? | `/timeseries?metric=latency_p95`, `latency_p99` | multilínea ≤ 3 series (categórica) | `approximate` → nota «por lo menos» |
| | Distribución | ¿Cuántas peticiones tardan más de 1 s? | histograma de `/summary` (cortes acumulados) | barras verticales (secuencial) | — |
| | Operaciones más lentas | ¿Dónde? | `/endpoints?sort=p95` | barras horizontales ordenadas (una tinta) | — |
| | Peticiones lentas recientes | ¿Cuáles exactamente? | `/sql/slow` | tabla con `requestId` | — |
| **Consultas SQL** | Sentencias por coste | ¿Qué consulta pesa? | `/sql/statements?sort=total_ms` | tabla (hash, clase, tabla, ejecuciones, total, p95, lentas) | `empty` + razón `sqlOnlyOrm` |
| | Detalle de sentencia | ¿Quién la dispara? | `/sql/statements/:hash` | SQL normalizado (monoespaciado, copiable), línea, barras por operación | — |
| | SQL en el tiempo | ¿Sube el tiempo de base? | `/timeseries?metric=sql_ms`, `sql_slow` | línea | — |
| **Endpoints** | Tabla por operación | ¿Qué ruta falla o tarda? | `/endpoints` (reemplaza la pestaña actual) | tabla; filtro por módulo | igual que hoy (plantillas, `UNMATCHED`, `__overflow__`) |
| | Mapa módulo × hora | ¿Qué parte y cuándo? | `/modules/heatmap?metric=errors` | heatmap secuencial (una tinta), tabla alterna | `minSample` |
| **Workers y dependencias** | Flota | ¿Están vivos? | `/workers` | tabla de instancias con estado `VIVA/DEGRADADA/CAIDA/SIN_DATO` (color de estado, nunca de serie) + `missing[]` | `SIN_DATO` ≠ `CAIDA` |
| | Ticks | ¿Qué tarea falla? | `/workers.instances[].ticks` | tabla | — |
| | Dependencias | ¿Postgres/Redis/MinIO…? | `/dependencies` | tiles de estado + línea de latencia | `not_probed` como «sin dato» |
| **SLO** | Objetivos | ¿Cumplimos? | `/slo` | meter por SLO (presupuesto restante) + línea de burn rate | `empty` si no hay mediciones («el cálculo corre cada hora; primera medición a las …») |

Las pantallas `instances` y `platform-home` pasan a `GET /admin/observability/workers` y `/summary` (mismo vocabulario que `ops-liveness.types.ts`), y los handlers del simulador se regeneran desde el contrato (`mock-contract:check`). Pruebas Playwright contra `ng serve` + API real, sin `networkidle`, `data-testid` en cada KPI (`observability-p95` ya existe).

---

## 7. Cómo se prueba que funciona de verdad

Entorno: `docker compose --profile local-db up -d postgres postgres-init redis` (`API:docker-compose.yml:333`) + API con `OBSERVABILITY_ENABLED=true`, `OBSERVABILITY_FLUSH_SECONDS=10`, `ORM_SLOW_QUERY_MS=50`, `RLS_ENFORCE=true` (la variante que más rompe), `TRUST_PROXY_HOPS=0`. Script `API:scripts/observability/selftest.mjs` (nuevo), determinista, con token `SUPERADMIN` del harness (`test/integration/harness.ts`).

| Prueba | Cómo | Esperado exacto |
|---|---|---|
| **P1 conteos HTTP** | 37 `GET /admin/ops/slos` (200), 11 `GET /admin/ops/traffic?from=basura` (422 `VALIDATION_FAILED`), 7 `GET /no-existe-xyz` (404, `UNMATCHED`), 5 `GET /admin/ops/slos` con token sin rol (403), 3 `POST /ops/change-requests` con cuerpo duplicado (409). Esperar 2 ciclos de flush. | `/summary.kpis.requests.value = 63`; `/endpoints` fila `GET /admin/ops/slos`: `requests 42, failed4xx 5`; fila `GET /admin/ops/traffic`: `failed4xx 11`; `UNMATCHED: 7`. Comparación JSON con `node --test`, sin tolerancia. |
| **P2 errores agrupados** | Los 11 × 422 son **un** grupo; los 7 × 404 **un** grupo; los 5 × 403 **un** grupo; los 3 × 409 **un** grupo. | `/errors/groups?from=hoy` = 4 grupos con `occurrencesTotal` 11/7/5/3, `state=NEW`; `/errors/groups/:id.recentEvents.length = 11` con 11 `requestId` distintos iguales a los `correlationId` recibidos por el script. |
| **P3 500 conocido** | Ruta de falla **sólo fuera de producción**: `GET /internal/observability/selftest/fail?kind=throw\|fk\|timeout` (`@Roles('SYSTEM')`, se registra sólo si `NODE_ENV !== 'production'`; **D-06**). 4 llamadas `throw`. | Grupo con `code=INTERNAL`, `exceptionType='Error'`, `sampleFrames[0]` apunta a `src/modules/observability/.../selftest.controller.ts:<línea>`, `occurrencesTotal=4`; el cuerpo al cliente **no** trae stack (`API_ERROR_DIAGNOSTICS=false`). |
| **P4 `requestId` de punta a punta** | Playwright: abrir `/superadmin/observability` con API real; forzar un 404 real desde el front (navegar a una ficha con id inexistente); leer `requestId` del `ViewState` (`data-testid` del bloque de error); pegarlo en «Buscar requestId». | `/requests/:id.found=true`, `errors[0].code='NOT_FOUND'`, misma `route`; captura de pantalla antes/después. |
| **P5 reinicio** | `docker compose restart api` (SIGTERM → `onApplicationShutdown` vuelca) y, aparte, `docker kill -s KILL api` justo después de generar 20 peticiones. | Tras SIGTERM: conteos idénticos a antes. Tras KILL: faltan ≤ 1 ciclo (≤ 10 s) y `/coverage.notMeasured` incluye `lastMinuteNotFlushed`; **lo persistido antes no cambia** (`SELECT count(*) FROM observability.error_events` antes = después). |
| **P6 dos instancias** | Segunda API en `PORT=3001` contra la misma base; el script reparte 40 peticiones 20/20 (sin balanceador). | `/summary.requests = 40` desde cualquiera de las dos; `/workers.instances` lista 2 de `kind=API` con `instanceId` distintos; reintentar un flush a mano (`flushService.flush()` dos veces con la misma cola) **no duplica** (`uq_http_minute_key`). |
| **P7 SQL** | Con `ORM_SLOW_QUERY_MS=1` todas las consultas son lentas; 10 `GET /admin/ops/slos`. | `/sql/statements` contiene el `queryHash` del `SELECT` de `listSlos`, `executions ≥ 10`, `slowCount = executions`; `/sql/statements/:hash.operations[0].operationKey='OpsConsoleController_slos'`. Contraste opcional con `pg_stat_statements` si la extensión está cargada (si no, se anota). |
| **P8 workers** | Levantar `worker-time_series` local; cortar la API 90 s; volver. | `/workers`: `VIVA` → `DEGRADADA (HEARTBEAT_LATE)` → `CAIDA (HEARTBEAT_EXPIRED)` → `VIVA`; `worker_tick_minute_series` con `runs>0`. |
| **P9 dependencias** | `docker compose stop redis` 3 min. | `/dependencies.items[redis].status='down'` con 3 sondas; incidente abierto en `/admin/ops/incidents?open=true`; al volver, `up` y el incidente sigue abierto hasta que un humano lo cierre (`PATCH /ops/incidents/:id`). |
| **P10 SLO** | Correr el job de SLO a mano sobre la ventana de P1–P3. | `slo_measurements` tiene 1 fila por SLO con `good_events/total_events` = exactamente los de P1 (`42/63` disponibilidad si se cuentan 4xx como «buenos» según `good_event_definition`; la definición se fija en H6.S1). |
| **P11 privacidad** | `grep -E '[0-9a-f]{8}-[0-9a-f]{4}-' ` sobre `route_template`, `normalized_sql`, `sample_message` de todas las tablas nuevas tras P1–P9; `SELECT` de columnas → ninguna `user_id`, `ip`, `url`. | 0 coincidencias; `actor_hash` no reversible (no hay `user_id` en ninguna tabla nueva). |
| **P12 contrato y gates** | `yarn inventario:verificar`, `yarn contract:refresh && yarn mock-contract:check`, `check-*.mjs`, `yarn test`, `yarn typecheck`, `yarn pw` (18 + los nuevos). | Verde; evidencias en `evidencias/H8/`. |

Toda afirmación de «funciona» enlaza la salida del script (JSON crudo), la consulta SQL de persistencia y la captura del panel tras recarga.

---

## 8. Hitos

Estados: todo `TODO`. Estimación relativa S/M/L. Dos PRs por hito (dev y test) según `CLAUDE.md`.

### H0 — Decisiones y arranque (S)
- **CA**: dado el plan, cuando el usuario responde D-01…D-06, entonces quedan anotadas en `trabajo/DECISIONES.md` y el resto de hitos no tiene ambigüedad abierta.
- **DoD**: D-01…D-06 con respuesta o supuesto confirmado; `OBSERVABILITY_HTTP_SLI_ENABLED=true` agregado a `.env.coolify.example` y al compose de Coolify (hoy la medición está apagada en producción, §0.1).
- H0.S1.M1 Presentar decisiones · H0.S1.M2 Encender `http-sli` en Coolify (PR chico, independiente) · H0.S1.M3 Confirmar con `SELECT count(*) FROM time_series.service_sli_series WHERE time > now() - interval '1 hour'` en la base de `test`.

### H1 — Modelo (M)
- **CA**: dado `diagram_70_observability.puml` y `diagram_58_time_series.puml` actualizados, cuando corre `gen_ddl.py 70`, `gen_nosql.py 58`, `gen_integrity.py`, `gen_entities.py 70`, entonces `SQL/70_observability/*.sql`, `NoSQL/58_*/time_series.timescaledb.sql` y `API:src/modules/observability/entities/*.entity.ts` se regeneran sin edición manual, y `scripts/db/check-schema-drift.mjs` da 0 derivas contra una base levantada desde cero.
- **DoD**: tablas de §4.1 con índices nombrados; conceptos y semillas de §4.2; parche idempotente `SQL/patches/…_observabilidad_sistema.sql` aplicado dos veces sin error sobre una base poblada; `physical.catalog.ts` lista las hypertables nuevas; `TS_RETENTION_POLICIES` documentado; `yarn db:vendor` sincroniza `database/`.
- H1.S1.M1 Entidades en `.puml` (T1–T5 + otras) · H1.S1.M2 Índices (`INDEX_SET`) · H1.S1.M3 FK cruzadas (`90_fk_deferred`: `instances`, `service_components`, `health_incidents`, `iam.users`) · H1.S2.M1 Conceptos `error_group_state` y verificación de severidades existentes · H1.S2.M2 Semillas `service_components`, SLI/SLO/presupuesto ×3 · H1.S3.M1 Generación y `gen_entities` · H1.S3.M2 Parche y prueba de doble aplicación · H1.S3.M3 Verificar que la RLS (`2026-08-05_tenant_rls.sql`) no alcanza las tablas nuevas (sin `tenant_id NOT NULL`).

### H2 — Captura y persistencia en la API (L)
- **CA**: dado `OBSERVABILITY_ENABLED=true`, cuando llegan N peticiones con códigos conocidos, entonces tras ≤ 2 ciclos `http_request_minute_series` suma exactamente N por `(método, plantilla, código)` con `module_code` resuelto, y un reintento del mismo volcado no duplica.
- **DoD**: `request-context` (ALS), `HttpSink` con código exacto y `flush_seq`, `ObservabilityFlushService`, `instances` (registro de la API al arrancar), `/coverage`; pruebas unitarias (agregador, idempotencia, cardinalidad, exclusiones) + `observability-http.int-spec.ts` contra Postgres real (patrón `ops-traffic.int-spec.ts`); P1 y P5 y P6 de §7 en verde; `/admin/ops/traffic*` sigue respondiendo igual (doble escritura).
- H2.S1.M1 ALS y middleware (en `main.ts`, después de `helmet()` y antes del parseo del cuerpo, donde hoy está `http-sli`, `main.ts:162-171`) · H2.S1.M2 Resolver `operation_key/module_code` (RouteIndex + `catalog_operations` cacheado; fallback) · H2.S2.M1 `HttpSink` + histograma · H2.S2.M2 Flush transaccional, reintento, `ON CONFLICT DO NOTHING`, shutdown · H2.S2.M3 `instance_id`, `build_commit` (`build-info.ts`) · H2.S3.M1 Env (`OBSERVABILITY_ENABLED`, `_FLUSH_SECONDS`, `_SLOW_REQUEST_MS`, `_ACTOR_HASH_SECRET`, fallar al arrancar si inválido como `http-sli.env.ts`) · H2.S3.M2 Pruebas unitarias e integración · H2.S3.M3 P1/P5/P6.

### H3 — Errores individuales y agrupados (M)
- **CA**: dado un error con `code+reason+ruta` repetido k veces, cuando se consulta `/errors/groups`, entonces hay **un** grupo con `occurrencesTotal = k` y k eventos con `requestId` distintos; dado un `requestId` del front, `/requests/:id` lo encuentra con su código.
- **DoD**: `ErrorSink` en el filtro (sin cambiar el cuerpo de respuesta ni el log), huella estable (prueba: mismo error desde dos instancias → un grupo), tope 500/min, regresión `RESOLVED → NEW`, `PATCH` con `row_version` y auditoría, `recentEvents`, `GET /requests/:id`; P2, P3, P4 en verde; prueba de privacidad P11 sobre `error_events`.
- H3.S1.M1 Huella (marcos propios por `whereOf`, `error-diagnostics.ts:88`) · H3.S1.M2 Sink + agregación en memoria + tope · H3.S1.M3 Redacción (`redactDriverMessage`, `violationsForLog`) · H3.S2.M1 Upsert de grupos con conteo por filas insertadas · H3.S2.M2 Lecturas `/errors/*`, `/requests/:id` · H3.S2.M3 `PATCH` estado + `@Audited` · H3.S3.M1 Ruta de falla `selftest` (D-06) · H3.S3.M2 Pruebas P2–P4, P11.

### H4 — Consultas SQL (M)
- **CA**: dado `ORM_SLOW_QUERY_MS=1`, cuando se ejecutan 10 veces la misma operación, entonces `/sql/statements/:hash` muestra `executions ≥ 10`, `slowCount = executions` y la operación que la dispara.
- **DoD**: prueba de que `logQuery` recibe `took` con `MIKRO_ORM_DEBUG=false` (si no: `debug: ['query']` con nivel silenciado); `SqlSink` + catálogo + histograma; muestras lentas con `sql_top_json`; `/sql/*`; cardinalidad acotada; P7.
- H4.S1.M1 Verificar MikroORM 7 (`took` sin debug) · H4.S1.M2 `SqlSink` enlazado al ALS · H4.S1.M3 `primary_table` parser conservador · H4.S2.M1 `slow_request_samples` (umbral, error, 1 %) · H4.S2.M2 Lecturas · H4.S2.M3 P7 + cruce opcional con `pg_stat_statements`.

### H5 — Workers y dependencias (M)
- **CA**: dado un worker que deja de latir, cuando pasan 3 intervalos, entonces `/workers` lo marca `CAIDA (HEARTBEAT_EXPIRED)` y al volver `VIVA`; dado Redis caído, `/dependencies` lo muestra `down` sin que la API responda 503 en el panel.
- **DoD**: `POST /internal/observability/heartbeats|errors` (`SYSTEM`, excluidos de la medición), latido en `bootstrapWorker`, sondas por minuto, lista esperada por entorno (D-05), estados `VIVA/DEGRADADA/CAIDA/SIN_DATO` con causa (vocabulario de `ops-liveness.types.ts`), `instances`/`platform-home` del front conectados a la API real (se retira el handler simulado); P8, P9.
- H5.S1.M1 Endpoints de ingestión + exclusión de medición · H5.S1.M2 Cliente de latido en worker (`system-api-client`, idempotente) · H5.S1.M3 Reglas de estado (late = 3×, expired = 10×) · H5.S2.M1 Sondas (reuso `probe`) + MinIO/externas `not_probed` · H5.S2.M2 Lecturas `/workers`, `/dependencies` · H5.S2.M3 Front `instances`/`platform-home` a API real · H5.S3.M1 P8/P9.

### H6 — Rollups, retención, SLO y alertas (M)
- **CA**: dado un día de datos, cuando corre el rollup dos veces, entonces las horas materializadas son idénticas (idempotente) y `http_request_hourly` suma lo mismo que el crudo; dado el job de SLO, `slo_measurements` recibe una fila por SLO con `good/total` exactos.
- **DoD**: agregados (continuous aggregates o manual con `rollup_watermarks`, según D-04), retención declarada y aplicada en local, job de SLO que escribe por `OpsReliabilityService` (sin pasar por HTTP interno), presupuesto/burn rate, 6 reglas de alerta → `health_incidents`; `/slo`, `/timeseries` por hora/día desde agregados; P10.
- H6.S1.M1 Definición de «evento bueno» por SLI (4xx cuenta como bueno para disponibilidad; no para error-rate) · H6.S1.M2 Rollups + watermarks · H6.S1.M3 Retención (`TS_RETENTION_POLICIES`, `system_ops.retention_policies`) · H6.S2.M1 Job SLO + burn rate · H6.S2.M2 Alertas → incidentes (sin duplicar) · H6.S2.M3 P10.

### H7 — API de lectura completa y contratos (L)
- **CA**: dado el módulo `observability`, cuando se piden las 16 rutas de §5.2 con ventanas válidas e inválidas, entonces responden con el sobre común, `notMeasured`, paginación keyset y `422` con `reason`; `/admin/ops/traffic*` responde igual que antes leyendo la tabla nueva.
- **DoD**: `observability.module.ts` (sin importar `TimeSeriesModule` completo: patrón de `http-sli.module.ts:11-18`), DTOs con `class-validator`, `tz` validado, OpenAPI + `inventario:endpoints` + `contract:refresh`, nginx `/admin/observability` en `api-locations.conf`, README del módulo con tabla de rutas medida, pruebas de controlador y de contrato de error (`core-error-contract.http.spec.ts` como modelo); `yarn test`, `yarn typecheck` verdes.
- H7.S1.M1 Módulo, DTOs, ventana con `minute`/`tz` · H7.S1.M2 Repositorios de lectura (SUM sobre crudo ≤ 24 h, agregados > 24 h) · H7.S2.M1 `/summary`, `/timeseries`, `/endpoints`, `/modules*` · H7.S2.M2 `/sql/*`, `/workers`, `/dependencies`, `/slo`, `/coverage` · H7.S3.M1 Re-apuntar `/admin/ops/traffic*` · H7.S3.M2 OpenAPI, inventario, nginx · H7.S3.M3 Pruebas.

### H8 — Panel «Sistema» en el front y verificación E2E (L; visual a cargo del otro agente)
- **CA**: dado el panel con API real, cuando se ejecutan P1–P4 y se recarga, entonces cada número del panel coincide con el JSON de la API y con el `SELECT` en Postgres; cada widget muestra los estados `loading/empty/ready/error/stale/not-found/forbidden` según corresponda.
- **DoD**: 7 pestañas de §6 con ECharts (`chart-panel`), paleta validada, modo oscuro, tabla alterna por gráfico, `data-testid` por KPI; Playwright nuevo `playwright/observabilidad-sistema.spec.ts` sin `networkidle`; `visual-reviewer`, `frontend-reviewer` y `regression-auditor` aprueban (quien implementa no aprueba); evidencias UI → request → response → persistencia → recarga → UI en `evidencias/H8/`.
- H8.S1.M1 Data-access `observability.client.ts` + tipos del contrato · H8.S1.M2 Pestañas y estados · H8.S2.M1 Gráficos · H8.S2.M2 Búsqueda por `requestId` · H8.S3.M1 P4 Playwright · H8.S3.M2 Revisión cruzada y evidencias · H8.S3.M3 PRs dev/test.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| MikroORM 7 no invoca `logQuery` con `took` sin `debug` (§1.3) | H4.S1.M1 lo prueba primero; plan B: `debug: ['query']` + logger que no escribe líneas `debug`. |
| ALS pierde contexto en callbacks del driver `pg` | Probar con `AsyncLocalStorage` + `AsyncResource.bind` en el pool; si falla, atribuir SQL por `operation_key` desde el interceptor (menos preciso) y declararlo en `notMeasured.sqlAttribution`. |
| Volumen de `error_events` bajo ataque (p. ej. escaneo de rutas → 404 masivo) | Tope 500/min/instancia, `UNAUTHENTICATED` y `RATE_LIMITED` sin evento individual, retención 90 d, alertas de `droppedFlushes`. |
| Cardinalidad de `query_hash` (consultas dinámicas con `IN (?,?,?)`) | `normalizeSql` ya pliega listas `(?)` (`sql-redaction.ts:47`); tope 5000/min. |
| Doble escritura (`service_sli_series` + tabla nueva) duplica coste durante H2–H7 | Volúmenes pequeños (una fila por minuto × ruta × código); se retira en H7.S3.M1. |
| `worker-time_series` no está en Coolify (rollups/retención no corren) | D-04; mientras tanto rollup manual en la API. |
| Hypertables en schema `observability` fuera de `time_series` rompen `TIMESERIES_TABLES`/`ROLLUPS` (listas cerradas con `time_series.` implícito) | Parametrizar schema en `physical.catalog.ts` y `ROLLUPS`; alternativa: ubicar las series en `time_series.*` con prefijo `observability_` (decidir en H1.S1.M1; el plan prefiere `observability.*` para que el gobierno de datos las vea como un dominio). |
| `TRUST_PROXY_HOPS=2` en Coolify: el `x-request-id` lo genera nginx del front; el UUID que ve el usuario es el de nginx | Es el mismo que llega al filtro y a `error_events.request_id`; verificar en `test` que nginx envía `X-Request-Id` (no verificado: `FRONT:deploy/*.conf`). |
| Privacidad: `message_redacted` podría colar un valor | Sólo tras `redactDriverMessage`; P11; revisión DPO antes de Coolify; `message` 5xx sólo con `API_ERROR_DIAGNOSTICS` (como hoy en el log). |

## 10. Ambigüedades y supuestos tomados

| # | Ambigüedad | Supuesto en este plan | Necesita al usuario |
|---|---|---|---|
| D-01 | Zona horaria de «hoy» y de los cubos (`traffic-window.ts:17-19` lo dejó al cliente) | `tz` por parámetro, **por defecto `America/La_Paz`** en el front; la API responde siempre `timezone` explícito | **Sí** |
| D-02 | ¿Se guarda algo del actor en los errores? | `actor_hash` HMAC con secreto propio, sólo para «usuarios afectados» con `minSample ≥ 5`; nunca `user_id` | **Sí** (DPO) |
| D-03 | ¿Se ingieren errores del navegador (`E-<commit>-NNN`) en esta franja? | Diseñado (`client_error_events`, `POST /observability/client-errors`), **implementación en una franja posterior** salvo que se pida ahora | **Sí** |
| D-04 | Rollups/retención: desplegar `worker-time_series` en Coolify o correrlos desde la API | Rollup manual idempotente desde la API en H6; continuous aggregates cuando el worker esté desplegado | Sí (operación) |
| D-05 | Lista de instancias esperadas por entorno | Variable `OBSERVABILITY_EXPECTED_INSTANCES`; en Coolify `api,worker-messaging,worker-scheduling,worker-workflow,worker-read_models` | Sí (operación) |
| D-06 | Ruta de falla controlada para pruebas (`selftest/fail`) | Sólo `NODE_ENV !== 'production'`, rol `SYSTEM`, excluida de la medición propia | Sí (seguridad) |
| — | Dónde viven los latidos (Redis según `04-sonda-de-vida.md` vs Postgres) | Postgres (`observability.instances`): sobrevive reinicios, multi-instancia, sin la vulnerabilidad del controlador de caché de Redis señalada en ese doc §1.4 | No (justificado) |
| — | Guardar código exacto vs clase | Código exacto (necesario para 404 vs 422 vs 409); la clase se deriva | No |
| — | Un 4xx ¿es error? | Se captura y agrupa (es un fallo de uso de la app) pero no cuenta para disponibilidad SLO; `UNAUTHENTICATED` anónimo y `RATE_LIMITED` sólo se cuentan | No |
| — | Percentiles | Histogramas con estimación (como hoy) + p99; exactos sólo en `slow_request_samples` | No |
