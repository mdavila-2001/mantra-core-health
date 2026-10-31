# 04 — Sonda de vida de instancias (API, workers, bases y servicios auxiliares)

- Fecha: 2026-10-30 · Fase: DISCOVERED + diseño (sin código escrito, nada ejecutado)
- Rutas de la API: relativas a `/home/user/mantra-core-health-api` (abreviado `API:`). Front: `/home/user/mantra-core-health` (abreviado `FRONT:`).
- Peldaño de evidencia (regla 30): **1 DISCOVERED**. Todo lo de las secciones 2-4 es diseño propuesto, no verificado en ejecución.
- Marca «no verificado» = no se leyó ni se ejecutó; es hipótesis.

---

## 1. Qué existe hoy (verificado leyendo código)

### 1.1 La API (proceso `api`)

| Endpoint | Qué hace | Evidencia |
|---|---|---|
| `GET /health` y `GET /liveness` | Público, sin JWT. Devuelve `{status:'ok'}` incondicional: sólo prueba que el proceso atiende HTTP. No toca base ni Redis. | `API:src/app.controller.ts:42-60` |
| `GET /readiness` | Público. Ejecuta 5 sondas en paralelo con timeout de 3 s: `postgresql` (`select 1` + integridad de esquema + seeds núcleo), `mongodb`, `redis` (PING), `opensearch`, `rls`. Si alguna cae lanza 503 con `{status:'error', checks:{nombre:{status,latencyMs}}}`; si no, 200 con `checks`. El mensaje del error nunca sale (sólo la clase al log). | `API:src/app.controller.ts:62-68`; `API:src/app-readiness.service.ts:18` (timeout), `:67-106` (check), `:226-258` (probe) |
| Healthcheck Docker de la API | `fetch('http://localhost:3000/health')` cada 10 s. | `API:docker-compose.yml:638-651` |
| Métricas Prometheus | **No existe `/metrics`** en esta API: `grep` de `/metrics` y `prom-client` en `src/` sólo halla la lista de exclusión, cuyo comentario dice que incluye «rutas que hoy no existen (`/metrics`, `/ready`, …)». | `API:src/observability/telemetry.constants.ts:98,107` |
| `GET /health/data-sources` (autenticado) | Estado `up/down` por conexión lógica de persistencia, con `role`, `engine`, `latencyMs` y motivo normalizado (sin host ni cadena de conexión); estado agregado `up/degraded/down`. Roles `PLATFORM_ADMIN, SRE, SECURITY_ADMIN`. Es la única lectura autenticada de salud de bases que ya existe; no cubre Redis ni OpenSearch ni workers. | `API:src/persistence/health/data-sources.controller.ts:14,30-40`; `data-sources.health.ts:53-71`; `registry/data-connection.contract.ts:39-53` |

Consecuencia: `/health` no es evidencia de nada más que «Node responde». Las bases sólo se ven en `/readiness`, que **lanza 503 en vez de devolver el detalle** (no sirve tal cual para un tablero).

### 1.2 Workers: cómo informan hoy su vida

- **25 entrypoints** `src/worker-<dominio>.ts` (`ls API:src/worker-*.ts` = 25) y **25 servicios `worker-*` en el compose de desarrollo** (`grep -c "^  worker-" API:docker-compose.yml` = 25). Todos pasan por `bootstrapWorker` (`API:src/worker/bootstrap.ts:58`). Los comentarios del código dicen «20 workers»: están desactualizados (no verificado cuál es el número «oficial»).
- El compose de **Coolify sólo declara 4 workers** (`messaging`, `scheduling`, `workflow`, `read_models`): `API:docker-compose.coolify.yml:823,827,831,835`. La lista de instancias esperadas **depende del entorno**.
- `worker-files` está bajo el perfil opt-in `malware-scan` (`API:docker-compose.yml:687`): puede no existir sin que sea una falla.
- **Registro de salud en memoria, por proceso**: `workerHealth` (`API:src/worker/worker-health.registry.ts:346`), alimentado por `runTick` (`API:src/worker/run-tick.util.ts:89-150`). Guarda por tick: `lastStartedAt`, `lastFinishedAt`, `lastOutcome`, `consecutiveFailures`, `skipped` (`worker-health.registry.ts:39-56`). El propio comentario lo declara «por proceso y en memoria… la visión agregada de la flota la da la telemetría» (`:24-26`).
- **Liveness** (`worker-health.registry.ts:215`): sólo falla si el proceso está `stopped` o si hay un tick en vuelo más allá de `WORKER_STUCK_TICK_MS` (por defecto 10 min, `API:src/worker/worker.env.ts:258`). **Readiness** (`:242`): falla si `starting`/`draining`/`stopped`, si hay un cortacircuitos abierto (el de `system-api` se registra en `API:src/worker/system-api-client.service.ts:141`) o, en producción, si una capacidad de proveedor no es `real`.
- **Sonda HTTP del worker** (`API:src/worker/worker-health.server.ts`): `GET /health|/liveness` (`:128`), `/readiness` (`:137`), `/status` (`:145`, snapshot completo con ticks, circuitos, memoria, `startedAt`, `pid`). **Escucha en `127.0.0.1:9100` por defecto** (`:41`, `worker.env.ts:256`) y sin autenticación. El único consumidor es el healthcheck de Compose dentro del mismo contenedor (`API:docker-compose.yml:314-326`). **La API no puede leerla**: ningún puerto de worker está publicado y el host es loopback.
- **No existe latido**: `grep -ri "heartbeat|latido"` en `API:src` sólo encuentra `health_context/entities/context_agents.entity.ts:56-63` (`last_heartbeat_at` de agentes de contexto clínico) y `cross_store_consistency/entities/projection_consumers.entity.ts:43-46` (`heartbeat_at` de consumidores de proyección): son de dominio, no de los procesos. Ningún worker escribe en Redis ni en tabla propia: **los workers no tienen conexión a base**, son clientes HTTP de la API (`grep MikroOrm API:src/worker` = sin resultados; `API:src/worker/system-api-client.service.ts:26-42`).
- Logs: `app.flushLogs()` en el bootstrap (`API:src/worker/bootstrap.ts:106`) y `logger.info(... 'Worker "x" en marcha')` (`:167-176`). Sirven para forense, no para un tablero.
- Telemetría: el nombre del servicio se deriva del entrypoint (`alovida-worker-<dominio>`, `API:src/observability/telemetry.config.ts:106-122`). Trazas OTel, apagadas por defecto (`OTEL_ENABLED`, no verificado el valor por entorno).

### 1.3 Qué mide `ops_console` / `platform_ops` y de dónde sale

- `ops_console`: 1 controller, `@Controller('admin/ops')`, todas las rutas `GET` con `@Roles(...OPS_READ_ROLES)` = `PLATFORM_ADMIN, SRE, SECURITY_ADMIN, RELEASE_MANAGER, GOVERNANCE_ADMIN` (`API:src/modules/ops_console/presentation/controllers/ops-console.controller.ts:14-25`). Rutas: `readiness, incidents, incidents/:id, deployments, change-requests, slos, backups, traffic, traffic/endpoints` (`:32-109`). Módulo sin tablas propias, sólo `SELECT` (`ops_console.module.ts:9-24`).
- `GET /admin/ops/readiness`: controles de **preparación para producción** (restauración probada, incidentes graves abiertos, SLO medidos, gate de QA, defectos graves, catálogo, último despliegue). Salen de tablas `system_ops.*`, `platform_ops.*`, `qa_lab.*`, `qa_execution.*`, `data_catalog.*` (`API:src/modules/ops_console/infrastructure/repositories/ops-console.repository.ts:55-273`). **No hay ningún control de «las instancias están vivas»**: `domain/readiness.ts` no tiene tal cosa (controles `RESTORE_TESTED, NO_OPEN_SEVERE_INCIDENTS, SLO_ATTAINED, QA_GATE, NO_OPEN_SEVERE_DEFECTS, DATA_CATALOG_REVIEWED, LAST_PRODUCTION_DEPLOYMENT`). Patrón reutilizable: `PASS/FAIL/UNKNOWN/NOT_APPLICABLE`, «no saber no es estar bien» (`domain/readiness.ts:22-27`, `:439-457`).
- `GET /admin/ops/traffic*`: lee `time_series.service_sli_series` (`sli_code='http_requests'`) que escribe `HttpSliFlushService` cada 60 s **sólo si `OBSERVABILITY_HTTP_SLI_ENABLED=true`** (apagado por defecto) y **sólo cuando hubo tráfico** (`flush` retorna si `drain()` viene vacío) (`API:src/observability/http-sli/http-sli-flush.service.ts:122-123`, `http-sli.env.ts:7-8`). Declara explícitamente `workersNotHttp` en `notMeasured` (`API:src/modules/ops_console/domain/latency-buckets.ts:188`). Es decir: **la medición de tráfico no ve a los workers ni distingue «sin tráfico» de «API caída»**: un minuto sin fila no es evidencia de nada.
- `platform_ops` (`@Controller('ops')`, `API:src/modules/platform_ops/controllers/platform-ops.controller.ts:60`) sí tiene un modelo de `health_checks` / `health_check_runs` / `service_components` (`API:src/modules/platform_ops/entities/health_checks.entity.ts`, `health_check_runs.entity.ts`) y un endpoint `POST /ops/health-checks/:id/runs` con rol `SYSTEM|SRE|PLATFORM_ADMIN` (`platform-ops.controller.ts:190-209`). **Ningún worker lo invoca** (`grep "health-checks|/ops/|slo/" API:src/worker` = vacío). Además es inadecuado como latido: cada llamada inserta una fila, exige un `health_check` previo activo por instancia y puede abrir incidentes al alcanzar el umbral (`API:src/modules/platform_ops/services/ops-incidents.service.ts:161-250`). No hay `GET` de listado de health checks en ops_console. **No se usa para esto.**
- `system_context`, `system_ops`: no tienen estado de vida de procesos (sólo contextos dinámicos / backups / restauraciones). No verificado en detalle más allá de `ls` y del README.

### 1.4 Infra disponible para reusar

- Redis real, persistente (`--save 60 1`, volumen `redis_data`), `API:docker-compose.yml:442-456`. `RedisRuntimeModule` exporta `RedisRuntimeService` **y `REDIS_CLIENT`** (`API:src/modules/redis_runtime/redis_runtime.module.ts`, `redis.provider.ts:11`). `OpsConsoleModule` hoy no lo importa (`ops_console.module.ts:14-23`).
- **Ojo de seguridad**: las claves de `RedisRuntimeService.setWithTtl/get` son `{tenantId}:cache:{key}` (`redis-runtime.service.ts:86-103`) y el controller `/redis-runtime/cache` (rol `PLATFORM_OPERATOR`) permite escribirlas/leerlas por API. Guardar latidos allí permitiría **falsificarlos** desde un cliente. Usar `REDIS_CLIENT` con un prefijo propio (`ops:heartbeat:`) que ese controller no puede formar.
- Principal de los workers: `TokenService.signAccessToken(SEED.systemWorkerUserId, …, ['SYSTEM'])` en cada llamada (`API:src/worker/system-api-client.service.ts:142-148`); rol `SYSTEM` es de alcance plataforma (`API:src/common/tenant/tenant-resolution.ts:12`). Precedente de endpoint con `@Roles('SYSTEM', …)`: `platform-ops.controller.ts:191`, `:257`, `:279`.
- Todas las llamadas del worker pasan por mamparo + cortacircuitos único `system-api` (`system-api-client.service.ts:74-115`, `:200-232`). `post()` no reintenta salvo `idempotent:true` (`:171-190`).
- Throttle global 300 req/60 s por IP (`API:src/app.module.ts:147-155`); cada worker es un contenedor con IP propia (no verificado el comportamiento tras un proxy).
- Medición HTTP excluye `/health, /healthz, /ready, /readiness, /liveness, /metrics, …` (`API:src/observability/telemetry.constants.ts:101-112`); un `POST /internal/ops/heartbeats` **no** está excluido y ensuciaría `/admin/ops/traffic` y las trazas.

### 1.5 Front y referencia Atlas

- `FRONT:src/app/core/data-access/admin-portal/ops-traffic.client.ts:16-33` (`OpsTrafficClient`) y `platform.client.ts:186-215` (`OpsConsoleClient`: `readiness, incidents, deployments, slos, backups`; no hay nada de instancias). Pantallas: `features/admin/observability/observability.ts` (tráfico; ya declara «Workers y jobs» como no medido, `:~44`) y `features/admin/operations/operations.ts` (readiness en pestañas). Portada admin: `features/dashboard/platform-home/platform-home.ts`. Navegación del dominio en `core/navigation/navigation.platform.ts` (la `navigation.map.ts` está congelada por `check-max-lines`, según `PLAN.md`). Rutas lazy en `app.routes.ts:218-230`.
- Mocks: `FRONT:src/app/core/mock/handlers/ops-traffic.handlers.ts` + registro en `handlers/index.ts:49`; contrato generado desde el OpenAPI (`core/mock/contract/api-contract.generated.ts`, scripts `contract:refresh` y `mock-contract:check`, `FRONT:package.json:34,37`).
- Atlas (referencia, solo lectura): `src/features/systems-dashboard/critical-tools.tsx:23-53` muestra un banner rojo si hay herramientas **críticas** con `toolLiveState==='DOWN'`, y una tarjeta con tabla y refresco cada 30 s (`features/systems/hooks.ts:77-87`). `tool-live-state.tsx:5-23` define `UP | DOWN | NO_PROBE | NOT_APPLICABLE` y **separa explícitamente «caída» de «sin chequeo en vivo»**: `isHealthy: true|false|null`. Es el mismo principio que se pide aquí (SIN_DATO ≠ CAIDA). La ruta vieja `/internal/systems/tools/health` sólo redirige a `?tab=salud` (`app/internal/systems/tools/health/page.tsx`).

### 1.6 Huecos concretos (lo que la sonda tiene que cubrir)

1. Ningún proceso worker deja evidencia de vida visible para la API ni para un admin.
2. `/readiness` no se puede consumir como dato (lanza 503) y no cubre MinIO, ClamAV, mock-provider; `/health/data-sources` es autenticado pero sólo cubre las conexiones de persistencia y no es parte de `ops_console`.
3. `ops_console` no tiene noción de «instancia» ni de «latido».
4. La medición de tráfico no distingue silencio de caída.

---

## 2. Diseño mínimo y fiable

### 2.1 Principio rector

**Un estado «VIVA» sólo se emite con evidencia fresca y verificable, calculada con el reloj de la API.** Cualquier otra cosa degrada, nunca se rellena. El cliente nunca calcula estados: sólo pinta lo que el servidor declara (misma regla que `readiness`).

Evidencia aceptada por tipo de instancia:

| Tipo | Evidencia | Quién la produce |
|---|---|---|
| `API` | La propia petición fue atendida (`source:'self'`). Sólo prueba **la instancia que respondió**, no otras réplicas (réplicas: no verificado, el compose tiene una). | el endpoint |
| `WORKER` | Latido recibido (`source:'heartbeat'`) con `receivedAt` = reloj de la API. | cada worker, vía `bootstrapWorker` |
| `DATABASE` (`postgresql`, `mongodb`) y `SERVICE` (`redis`, `opensearch`) | Sonda activa en la petición (`source:'probe'`), mismo código y timeout que `/readiness` (v1, por ser la única que cubre las cuatro). `/health/data-sources` (`ConnectionRegistry.healthCheckAll()`) queda como alternativa para la parte de persistencia; no se mezclan las dos fuentes en v1 para no tener dos verdades del mismo estado. | la API |
| `SERVICE` sin sonda (`minio`, `clamav`, `mock-provider-server`) | Ninguna en v1 → `SIN_DATO` / `NOT_PROBED`. No se inventa. | — |

### 2.2 Decisión: latido empujado (push) y no sonda tirada (pull)

Se descartó que la API consulte `/status` de cada worker: obligaría a cambiar `WORKER_HEALTH_HOST` a `0.0.0.0` en 25 servicios y a exponer un endpoint **sin autenticación** en la red del compose (`worker-health.server.ts:41-60` lo protege justo por eso), y a mantener en la API una tabla de URLs. El push reutiliza al cliente autenticado que ya existe y no abre puertos. Costo: depende de que el worker alcance la API y de Redis (ambos se declaran, ver 2.5).

### 2.3 Cómo emite el latido cada worker (cambio mínimo)

**Cero archivos por worker.** Los 25 entrypoints son `void bootstrapWorker(Modulo, 'nombre')` (p. ej. `API:src/worker-messaging.ts`). El cambio es **uno solo**, en el código compartido:

1. Nuevo `API:src/worker/worker-heartbeat.service.ts` (`@Injectable`, `OnApplicationBootstrap` + `OnApplicationShutdown`), registrado en `providers` de `WorkerRootModule` junto a `WorkerLifecycleService` (`bootstrap.ts:97`).
2. Cada `WORKER_HEARTBEAT_INTERVAL_MS` (por defecto 15 000; nuevo en `workerEnvSchema`, `worker.env.ts:38`) hace `api.post('/internal/ops/heartbeats', body, {idempotent:true})` con `SystemApiClient`. Es idempotente (sobrescribe la entrada de la instancia). `timer.unref()` y todo en `try/catch`: **un latido que falla no puede tumbar el worker** (mismo criterio que la sonda, `worker-health.server.ts:70-80`). Fuera de `runTick`, así que no cuenta como tick ni compite con la exclusión mutua.
3. Cuerpo (todo sale de `workerHealth.snapshot()`, `worker-health.registry.ts:274`; nunca mensajes de error ni datos de negocio):
```json
{
  "instanceId": "worker-messaging",
  "pid": 41,
  "startedAt": "2026-10-30T12:00:00.000Z",
  "sentAt": "2026-10-30T12:05:15.000Z",
  "status": "running",
  "liveness": {"healthy": true, "reasons": []},
  "readiness": {"healthy": true, "reasons": []},
  "stuckTicks": 0,
  "openCircuits": []
}
```
   `instanceId` = `worker-${name}` (el `name` ya llega a `bootstrapWorker`, `bootstrap.ts:60`). Las `reasons` son frases generadas por el registro con claves de tick y circuito, no con payloads (`worker-health.registry.ts:226-231`, `:251-255`); se truncan a 200 caracteres y 10 elementos en el DTO.
4. **El primer latido sale al terminar el arranque** (`onApplicationBootstrap`, igual que `setStatus('running')`, `worker-lifecycle.service.ts:56-58`), no antes: un worker que no terminó de arrancar no emite «vida».
5. Se excluye la ruta de la medición HTTP: añadir `'/internal/ops/heartbeats'` a `EXCLUDED_HTTP_PATHS` (`telemetry.constants.ts:101`). Sin `@Audited` (25 workers × 4/min = 100 filas de auditoría/min sin valor).

Limitación declarada: si el cortacircuitos `system-api` del worker está abierto, el latido tampoco sale (`call()` falla local); desde el tablero el worker aparece «sin latido» aunque su proceso viva. Por eso la causa dice **«sin latido recibido»**, nunca «proceso muerto» (no se afirma lo que no se observó).

### 2.4 Endpoints

**Ingesta (interno, sólo workers).** `POST /internal/ops/heartbeats`, `@Roles('SYSTEM')`, `201`, controller nuevo `ops-heartbeat.controller.ts` en `ops_console` (el prefijo `internal/ops` ya lo usa `restore-test.controller.ts:18`). Valida con class-validator (`whitelist`, campos no declarados rechazados, regla 96.2). Rechaza `instanceId` fuera del registro esperado con `422` y razón `INSTANCE_UNKNOWN`. Escribe en Redis con `REDIS_CLIENT`: `HSET ops:heartbeat:v1 <instanceId> <json>` y `EXPIRE ops:heartbeat:v1 604800` (7 días, solo renueva la clave contenedora; los campos **no** expiran uno a uno, para que «caída» no se confunda con «nunca vista»). El JSON guardado añade `receivedAt` (= `Date.now()` de la API) y descarta `sentAt` para el cálculo.

**Lectura (admin, sólo lectura).** `GET /admin/ops/instances/liveness`, `@Roles(...OPS_READ_ROLES)` (se importa la constante existente, `ops-console.controller.ts:14`). Va en el mismo controller o en uno hermano bajo `@Controller('admin/ops')`; sin query params en v1. Responde **200 siempre que la API conteste**, incluso con Redis caído (un 5xx impediría mostrar el motivo).

```jsonc
{
  "modelVersion": "instance-liveness/v1",
  "evaluatedAt": "2026-10-30T12:05:20.000Z",          // reloj de la API
  "overall": "OK | ATENCION | CRITICO | SIN_DATO",
  "summary": {"VIVA": 22, "DEGRADADA": 1, "CAIDA": 1, "SIN_DATO": 3, "total": 27},
  "heartbeatStore": {"status": "up | down", "reason": null},   // down => reason "STORE_UNAVAILABLE"
  "thresholds": {
    "workerHeartbeatIntervalSeconds": 15,
    "degradedAfterSeconds": 30,         // age <= 30  => fresca
    "downAfterSeconds": 60,             // age >  60  => CAIDA ; entre 30 y 60 => DEGRADADA
    "dependencyLatencyDegradedMs": 1000,
    "dependencyProbeTimeoutMs": 3000,   // = READINESS_TIMEOUT_MS
    "clockToleranceSeconds": 5
  },
  "instances": [
    {
      "id": "worker-messaging",
      "label": "Mensajería",
      "type": "API | WORKER | DATABASE | SERVICE",
      "required": true,                  // false = opt-in (worker-files) o sin sonda
      "state": "VIVA | DEGRADADA | CAIDA | SIN_DATO",
      "lastHeartbeatAt": "2026-10-30T12:05:15.000Z | null",
      "ageSeconds": 5,                   // evaluatedAt - receivedAt, entero; null si no hay latido
      "thresholdSeconds": 60,            // el umbral que decide CAIDA para este tipo; null en SIN_DATO sin latido
      "cause": "OK | HEARTBEAT_LATE | HEARTBEAT_EXPIRED | NEVER_SEEN | STORE_UNAVAILABLE | CLOCK_INCONSISTENT | RECORD_CORRUPT | TICK_STUCK | CIRCUIT_OPEN | DRAINING | PROBE_FAILED | PROBE_TIMEOUT | PROBE_SLOW | NOT_PROBED",
      "causeDetail": "texto corto generado por el servidor, sin mensajes crudos de error",
      "evidence": {
        "source": "heartbeat | probe | self | none",
        "reportedStatus": "running | draining | starting | stopped | null",
        "startedAt": "ISO | null",       // un cambio de startedAt = reinicio observado
        "latencyMs": null
      }
    }
  ],
  "notMeasured": ["replicasOfApi", "storageObjectStore", "malwareScanner", "providerEmulator", "processInternals"]
}
```

`id` de los workers = `worker-<dominio>` exacto de `src/worker-*.ts`. `id` de infraestructura: `api`, `postgresql`, `mongodb`, `redis`, `opensearch`, `minio`, `clamav`, `mock-provider-server`.

### 2.5 Regla de decisión (función pura, sin I/O)

`evaluateInstance(record | null, probe | null, now, thresholds, flags) → {state, cause, ageSeconds}`; vive en `domain/instance-liveness.ts` (mismo estilo que `domain/readiness.ts`, probada sin base).

Workers (`age = now − receivedAt`, en ms; todas las comparaciones en ms, sin redondear antes):

1. Store caído o lectura falló → `SIN_DATO / STORE_UNAVAILABLE` (nunca VIVA, nunca CAIDA: no sabemos).
2. Sin registro → `SIN_DATO / NEVER_SEEN`. (No es CAIDA: jamás vista no es «se cayó».) `required:false` no afecta `overall`.
3. Registro ilegible (JSON inválido o campos que no cumplen el esquema) → `SIN_DATO / RECORD_CORRUPT`.
4. `age < −clockTolerance` (latido «del futuro») → `SIN_DATO / CLOCK_INCONSISTENT`. `−tolerance ≤ age < 0` se trata como `0`.
5. `age > downAfter (60 s)` → `CAIDA / HEARTBEAT_EXPIRED`. Texto: «sin latido desde hace N s».
6. `degradedAfter (30 s) < age ≤ downAfter` → `DEGRADADA / HEARTBEAT_LATE`.
7. `age ≤ degradedAfter` (latido fresco):
   - `reportedStatus` ∈ {`starting`,`draining`,`stopped`} → `DEGRADADA / DRAINING`.
   - `liveness.healthy=false` (tick atascado) → `DEGRADADA / TICK_STUCK`.
   - `readiness.healthy=false` (circuito abierto, proveedor sin real en producción) → `DEGRADADA / CIRCUIT_OPEN`.
   - si no → `VIVA / OK`.

Los umbrales salen de `intervalo × 2` y `intervalo × 4`, **declarados en la respuesta** (`thresholds`) y configurables (`OPS_LIVENESS_DEGRADED_AFTER_SECONDS`, `OPS_LIVENESS_DOWN_AFTER_SECONDS`, validados al arrancar: entero, `down > degraded ≥ intervalo`). Si la API arranca con un umbral inválido, **falla al arrancar** (regla 90.3.4, igual que `http-sli.env.ts:34-60`). Estos valores (15/30/60) son **propuesta mía**, no hechos del repo; confirmar con SRE.

Dependencias (sonda en la petición, resultado cacheado 10 s en memoria del servicio para que varios admins no multipliquen sondas):

- up y `latencyMs ≤ 1000` → `VIVA / OK`; up y `> 1000` → `DEGRADADA / PROBE_SLOW`.
- down con `errorType` timeout → `CAIDA / PROBE_TIMEOUT`; down otro → `CAIDA / PROBE_FAILED` (sólo la clase del error, como hoy, `app-readiness.service.ts:244-250`).
- `redis` lo prueba la API; si Redis está caído, `heartbeatStore.status='down'` y todos los workers pasan a `SIN_DATO / STORE_UNAVAILABLE` (el almacén de latidos **es** Redis) mientras `redis` aparece `CAIDA`.
- `minio`, `clamav`, `mock-provider-server` → `SIN_DATO / NOT_PROBED`, `required:false`, listados en `notMeasured`. No se prueban en v1.

API: `VIVA / OK`, `source:'self'`, `startedAt` = arranque del proceso. Es tautológico por diseño y se rotula así en `causeDetail` («la instancia que respondió esta consulta»).

`overall`: `CRITICO` si alguna `required` está `CAIDA`; si no `ATENCION` si alguna `required` está `DEGRADADA` o `SIN_DATO`; `SIN_DATO` si no hay ninguna `required` evaluable; `OK` sólo si **todas** las `required` están `VIVA`. Con cero instancias nunca es `OK`.

### 2.6 Registro de instancias esperadas

`API:src/modules/ops_console/domain/instance-registry.ts`: lista cerrada de 25 workers + 8 infra con `id`, `label`, `type`, `required`. Variable `OPS_LIVENESS_REQUIRED_WORKERS` (CSV) para entornos con menos procesos (el compose de Coolify tiene 4, `docker-compose.coolify.yml:823-835`); por defecto, los 24 salvo `worker-files`. Una prueba compara el registro con `src/worker-*.ts` y con los servicios `worker-*` del `docker-compose.yml` para que no derive.

Rechazo explícito de lo que **no** se hace: no se inventa «réplica 2 de la API», no se infiere vida de la ausencia de errores, no se usa el tráfico HTTP como latido, no se escribe en `platform_ops.health_check_runs`, no se crea tabla (cero DDL → ninguna deriva que verificar, regla 97).

### 2.7 Front

- Tipos y cliente nuevos (no se engorda `platform.client.ts`): `FRONT:src/app/core/data-access/admin-portal/ops-liveness.types.ts` y `ops-liveness.client.ts`, calcados de `ops-traffic.client.ts:16-33` (`GET /admin/ops/instances/liveness`).
- Pantalla `FRONT:src/app/features/admin/instances/instances.ts|html|css|spec.ts` con `ViewState<InstanceLiveness>` (`loading/ready/empty/error`, S7 = antigüedad del dato: mostrar `evaluatedAt`), `ViewStateHost`, `Card`, `Badge`, `DataTable` ya existentes (se usan en `observability.ts:20-26`). Un chip por estado con **texto** además de color (regla 95.4.6). Refresco cada 30 s y botón «Actualizar» (mismo criterio que Atlas, `hooks.ts:77-87`). Banner si `overall==='CRITICO'` (equivalente al `CriticalToolsBanner` de Atlas). `SIN_DATO` se pinta distinto de `CAIDA` y con su causa.
- Entrada: sección nueva en `core/navigation/navigation.platform.ts` (`superadmin/instances`, roles = los de `OPS_READ_ROLES`) + ruta lazy en `app.routes.ts` (junto a `:218-230`) + tarjeta «Instancias» en `platform-home.ts`.
- Mock: `core/mock/handlers/ops-liveness.handlers.ts` registrado en `handlers/index.ts`, etiquetado como simulado, datos sintéticos fijos que incluyan los cuatro estados; `yarn contract:refresh` y `yarn mock-contract:check` tras publicar el OpenAPI de la API.

---

## 3. Casos de prueba

Convención: **V** válido · **L** límite · **I** inválido. Unitarias = función pura `evaluateInstance` (sin I/O). «INT» = integración con Redis real. «ROMPER» = se rompe algo a propósito (regla 30 / paso `VERIFIED`).

### 3.1 Lógica de umbral (unitarias, `domain/instance-liveness.spec.ts`)

| # | Tipo | Entrada | Esperado |
|---|---|---|---|
| U1 | V | latido hace 5 s, `running`, liveness y readiness sanas | `VIVA / OK`, `ageSeconds=5` |
| U2 | L | edad = 30 000 ms exactos | `VIVA` (límite inclusivo `≤`) |
| U3 | L | edad = 30 001 ms | `DEGRADADA / HEARTBEAT_LATE` |
| U4 | L | edad = 60 000 ms exactos | `DEGRADADA / HEARTBEAT_LATE` |
| U5 | L | edad = 60 001 ms | `CAIDA / HEARTBEAT_EXPIRED` |
| U6 | L | edad = 0 ms | `VIVA` |
| U7 | L | `receivedAt = now + 4 999 ms` (reloj desfasado dentro de tolerancia) | `VIVA`, `ageSeconds=0` (clamp, nunca negativa) |
| U8 | L | `receivedAt = now + 5 001 ms` | `SIN_DATO / CLOCK_INCONSISTENT` (jamás VIVA) |
| U9 | L | `sentAt` del worker 1 h distinto de `receivedAt` | el estado **no** cambia (se ignora `sentAt`); `evidence` puede marcarlo, no decide |
| U10 | V | registro ausente, `required:true` | `SIN_DATO / NEVER_SEEN`, `lastHeartbeatAt=null`, `ageSeconds=null` |
| U11 | L | registro ausente, `required:false` | `SIN_DATO / NEVER_SEEN`; no entra en `overall` |
| U12 | I | JSON guardado inválido / falta `receivedAt` / `receivedAt` no numérico / `NaN` | `SIN_DATO / RECORD_CORRUPT` |
| U13 | V | fresco con `liveness.healthy=false` | `DEGRADADA / TICK_STUCK` |
| U14 | V | fresco con `readiness.healthy=false` (circuito abierto) | `DEGRADADA / CIRCUIT_OPEN` |
| U15 | V | fresco con `status='draining'` | `DEGRADADA / DRAINING` |
| U16 | V | fresco con `status='starting'` | no `VIVA` |
| U17 | I | store caído (lectura lanza) | todos los workers `SIN_DATO / STORE_UNAVAILABLE`, ninguno `VIVA` ni `CAIDA` |
| U18 | V | dependencia up 120 ms | `VIVA`; 1 000 ms → `VIVA` (L); 1 001 ms → `DEGRADADA / PROBE_SLOW` (L) |
| U19 | V | dependencia down, error de timeout / de otro tipo | `CAIDA / PROBE_TIMEOUT` / `CAIDA / PROBE_FAILED`; el mensaje del error **no** aparece en la salida |
| U20 | V | `minio`/`clamav`/`mock-provider-server` sin sonda | `SIN_DATO / NOT_PROBED` |
| U21 | L | `overall`: todas VIVA → `OK`; una DEGRADADA `required` → `ATENCION`; una CAIDA `required` → `CRITICO`; CAIDA en `required:false` → no sube a `CRITICO`; lista vacía → no `OK` | |
| U22 | L | umbrales inválidos al cargar el entorno (`down ≤ degraded`, no entero, `< intervalo`) | lanza al arrancar, sin valor por defecto silencioso |
| U23 | V | contrato de forma: toda instancia trae los 8 campos, `state` ∈ 4 valores, `cause` ∈ catálogo | prueba de esquema |
| U24 | V | registro ↔ disco: ids de `instance-registry` = `src/worker-*.ts` y servicios `worker-*` de `docker-compose.yml` | falla si hay deriva |

### 3.2 Contrato HTTP (API, `*.spec.ts` del controller / e2e)

| # | Tipo | Caso | Esperado |
|---|---|---|---|
| H1 | V | `POST /internal/ops/heartbeats` con token `SYSTEM` y cuerpo válido | `201`; el siguiente `GET` muestra ese worker `VIVA` con `ageSeconds` ≤ 1 |
| H2 | V | mismo `POST` dos veces (idempotente) | una sola entrada del worker, `lastHeartbeatAt` avanza, sin duplicar |
| H3 | I | `POST` sin token | `401` |
| H4 | I | `POST` con rol `PLATFORM_ADMIN`/`SRE` (no `SYSTEM`) | `403` (los admins no pueden fabricar latidos) |
| H5 | I | `POST` con `instanceId` fuera del registro | `422 INSTANCE_UNKNOWN`; nada se guarda |
| H6 | I | `POST` con campo extra (`isAdmin:true`), `status` fuera del enum, `reasons` de 11 elementos o 201 caracteres, cuerpo vacío | `400/422`, nada guardado (lista blanca) |
| H7 | I | `GET /admin/ops/instances/liveness` sin token / rol `PATIENT` / rol de otro tenant sin `OPS_READ_ROLES` | `401` / `403` / `403` |
| H8 | V | `GET` con cada rol de `OPS_READ_ROLES` | `200` con el cuerpo de 2.4 |
| H9 | V | `GET` no escribe nada (sin `@Audited`, sin `HSET`) | sin cambios en Redis |
| H10 | L | `POST` heartbeat **no** se contabiliza en `/admin/ops/traffic` | tras 10 latidos, `GET /admin/ops/traffic/endpoints` no lista `/internal/ops/heartbeats` |
| H11 | I | forja vía `/redis-runtime/cache`: `PLATFORM_OPERATOR` escribe `ops:heartbeat:v1`/clave equivalente | no afecta el estado (la clave no es alcanzable por `keyFor`) |
| H12 | L | respuesta no filtra `pid`, mensajes de error, hosts ni cadenas de conexión | revisión del JSON |

### 3.3 Integración y «romper a propósito» (INT / ROMPER; requieren stack real, no ejecutadas)

| # | Caso | Esperado |
|---|---|---|
| R1 | ROMPER: `docker stop api-worker-messaging` (nombre exacto: no verificado) y esperar > 60 s | `GET` muestra `CAIDA / HEARTBEAT_EXPIRED`, `overall=CRITICO`; `docker start` → `VIVA` en ≤ 15 s con `startedAt` nuevo |
| R2 | ROMPER: `docker stop redis` | `heartbeatStore.down`, workers `SIN_DATO / STORE_UNAVAILABLE`, `redis` `CAIDA`, `GET` sigue `200` en < 4 s; al volver Redis, los workers vuelven a `VIVA` tras su siguiente latido sin intervención |
| R3 | ROMPER: matar la API 30 s con workers vivos | los workers siguen vivos; su circuito `system-api` abre y se recupera; al volver la API, los latidos retoman y el tablero no marca `VIVA` hasta recibir uno nuevo (no hereda el viejo) |
| R4 | Worker con tick colgado (job de prueba que no vuelve > `WORKER_STUCK_TICK_MS` reducido) | `DEGRADADA / TICK_STUCK` mientras el proceso emite latidos |
| R5 | Reinicio de la API | los latidos persisten en Redis (volumen, `--save 60 1`): inmediatamente tras reiniciar los workers siguen con su edad real, no «nunca vistos» (si Redis se reinició sin persistir: `NEVER_SEEN`, no `CAIDA`) |
| R6 | Arrancar el compose sin `worker-files` (perfil) | `worker-files` `SIN_DATO / NEVER_SEEN`, `required:false`, `overall` no cambia |
| R7 | 25 workers latiendo 5 min | 0 respuestas 429 por el throttle global; 0 filas nuevas de auditoría por latidos; costo de CPU/Redis medido (no verificado) |
| R8 | Front: mock vs API real | misma forma (`mock-contract:check`); capturas en 3 viewports y 2 temas; consola y red limpias |

---

## 4. Orden de implementación (5 pasos) y archivos exactos

Cada paso es una franja verificable por separado (`NO_BIG_BANG_REWRITE`) y cierra con su DoD antes del siguiente. Entrega por franja: dos PRs (`dev` y `test`) según `CLAUDE.md` del front. Los pasos 1-3 son API, 4-5 front.

**Paso 1 — Dominio puro + registro (API, sin I/O).**
- Nuevo `API:src/modules/ops_console/domain/instance-liveness.ts` (+ `.spec.ts`): `evaluateInstance`, `overallOf`, catálogo de `cause`, tipos.
- Nuevo `API:src/modules/ops_console/domain/instance-registry.ts` (+ spec U24).
- Nuevo `API:src/modules/ops_console/domain/instance-liveness.env.ts` (+ spec U22): `OPS_LIVENESS_*`.
- DoD: casos U1-U24 en verde (`corepack yarn test src/modules/ops_console --runInBand --silent`, el comando documentado en el README del módulo), `yarn lint`, `yarn type-check`.

**Paso 2 — Ingesta y lectura (API).**
- Nuevo `API:src/modules/ops_console/infrastructure/repositories/instance-heartbeat.repository.ts` (HSET/HGETALL sobre `REDIS_CLIENT`).
- Nuevo `API:src/modules/ops_console/application/ops-instances.service.ts` (arma el cuerpo 2.4, cachea sondas 10 s).
- Nuevo `API:src/modules/ops_console/presentation/controllers/ops-heartbeat.controller.ts` (`POST /internal/ops/heartbeats`, `SYSTEM`) y ruta `GET instances/liveness` en `ops-console.controller.ts` (o controller hermano) + DTOs en `presentation/dto/`.
- Modificar `API:src/modules/ops_console/ops_console.module.ts` (importar `RedisRuntimeModule`, registrar proveedores/controller).
- Modificar `API:src/app-readiness.service.ts`: extraer un método público no lanzante (p. ej. `collect()`) que devuelva las entradas de `check()`; `check()` lo usa sin cambiar su comportamiento (`app-readiness.*.spec.ts` deben seguir verdes).
- Modificar `API:src/observability/telemetry.constants.ts:101` (excluir `/internal/ops/heartbeats`).
- Actualizar OpenAPI (`yarn docs:openapi:generate` y `docs:openapi:check-breaking`) y el README de `ops_console` (tabla de rutas medida).
- DoD: H1-H12, test de integración con Redis real (nuevo en `API:test/integration/`, patrón de `ops-console.int-spec.ts`).

**Paso 3 — Emisión del latido en los workers (API).**
- Nuevo `API:src/worker/worker-heartbeat.service.ts` (+ spec: intervalo, `unref`, fallo no propaga, no emite antes de `running`).
- Modificar `API:src/worker/bootstrap.ts:97` (agregar a `providers`) — único cambio para los 25 workers.
- Modificar `API:src/worker/worker.env.ts` (`WORKER_HEARTBEAT_INTERVAL_MS`, validado) y `API:docker-compose.yml:~213` (pasar la variable en `x-app-env`).
- DoD: spec del servicio; stack levantado con los workers reales: R1, R2, R3, R4, R5, R6, R7 ejercitados con salida pegada. Hasta aquí peldaño máximo posible = `VERIFIED` del lado API.

**Paso 4 — Cliente, tipos y mock (front).**
- Nuevos `FRONT:src/app/core/data-access/admin-portal/ops-liveness.types.ts`, `ops-liveness.client.ts` (+ spec).
- Nuevo `FRONT:src/app/core/mock/handlers/ops-liveness.handlers.ts` (+ spec); registrar en `FRONT:src/app/core/mock/handlers/index.ts:49`.
- `yarn contract:refresh` y `yarn mock-contract:check` (regenera `core/mock/contract/api-contract.generated.ts`).
- DoD: `yarn typecheck`, `yarn lint`, pruebas del cliente y del mock.

**Paso 5 — Pantalla y entradas (front).**
- Nuevos `FRONT:src/app/features/admin/instances/instances.ts|html|css|spec.ts`.
- Modificar `FRONT:src/app/core/navigation/navigation.platform.ts` (sección `superadmin/instances`), `FRONT:src/app/app.routes.ts` (ruta lazy cerca de `:218-230`), `FRONT:src/app/features/dashboard/platform-home/platform-home.ts` (+ `.html`) con la tarjeta «Instancias».
- DoD: capturas Playwright (`yarn pw`, sin `networkidle`) en 3 viewports y 2 temas contra la API real con el paso 3 corriendo, estados `VIVA/DEGRADADA/CAIDA/SIN_DATO` y los de vista (loading/empty/error), con **doble revisión** de capturas (regla 35.1) y revisores independientes (`visual-reviewer`, `frontend-reviewer`, `regression-auditor`); mutación no aplica (es solo lectura).

Fuera de las 5 franjas, **no incluido** (decisión de alcance a confirmar): control bloqueante `INSTANCES_ALIVE` en `domain/readiness.ts` para que la preparación para producción dependa de la vida real; sondas de MinIO/ClamAV/mock-provider; réplicas múltiples de la API y de un mismo worker; alertas/incidentes automáticos a partir de `CAIDA` (conectar con `platform_ops` sería otra franja).

---

## 5. Riesgos, ambigüedades y qué no se cubre

| Tema | Detalle | A quién confirmar |
|---|---|---|
| Umbrales 15/30/60 s y 1 000 ms | Propuesta mía (2× y 4× el intervalo; el healthcheck de Compose usa 15 s, `docker-compose.yml:323`). No están en ningún requisito. | SRE / dueño de operación |
| Redis como almacén de latidos | Si Redis cae, los workers son `SIN_DATO`, no `CAIDA`. Alternativa descartada por costo: tabla propia (DDL + deriva, regla 97). | Arquitectura |
| Réplicas | Un `instanceId` por dominio: dos réplicas se pisarían (la última escribe). No verificado si algún entorno corre réplicas (el dev no). | Despliegue |
| Dependencia API↔worker | Cortacircuito abierto ⇒ sin latido aunque el proceso viva; la causa lo dice, pero la señal es «sin latido», no «proceso caído». | — |
| Nombres de contenedor | Los de `docker stop` en R1-R3 no se verificaron (el compose no fija `container_name`; sólo nombres de servicio). | — |
| Hostname con `_` | No se usa DNS ni URL por worker en este diseño (otro motivo para descartar el pull). | — |
| Contradicción documental | Comentarios dicen «20/21 workers»; hay 25 entrypoints y 25 servicios. Registrada, no corregida (fuera de alcance, regla 00 §3). | Dueño de `worker/` |
| Peso por petición | `GET` ejecuta ≤ 5 sondas cacheadas 10 s; `postgresql` incluye `checkSeedCore` (hasta una consulta de conteo sobre `terminology.catalog_concepts` cuando `SEED_ON_BOOT=false`, `app-readiness.service.ts:206-223`). No medido el costo. | Rendimiento |
| Nada ejecutado | Ningún comando, test ni contenedor se corrió en este descubrimiento. Todos los `archivo:línea` son de lectura. | — |

**No cubierto por este documento:** comportamiento real bajo carga, forma exacta del DTO final en el OpenAPI, comportamiento de `RolesGuard` con un token `SYSTEM` en rutas `internal/*` (leído como precedente, no probado: patrón en `platform-ops.controller.ts:191`), instrumentación OTel en producción, y el estado de `docker-compose.coolify.yml` más allá de los 4 workers.
