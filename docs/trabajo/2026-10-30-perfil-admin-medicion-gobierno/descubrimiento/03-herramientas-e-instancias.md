# Descubrimiento 03 — Herramientas e instancias (estado, criticidad y brecha)

- Fecha: 2026-10-30 · Peldaño de evidencia: `DISCOVERED` (solo lectura de archivos; nada se ejecutó ni se levantó).
- Rutas: `A/` = `/home/user/mantra-core-health-api`, `F/` = `/home/user/mantra-core-health`, `ATLAS/` = `/home/user/pabloarauzcaballero/atlasadminportal`.
- Se omiten valores de variables secretas: solo se nombra la variable. Hallazgos de seguridad al final (sección 5).

## 0. Resumen ejecutivo

1. `A/docker-compose.yml` declara **36 servicios** (11 de infraestructura/emulador + API + **25 workers**, uno por cada `src/worker-*.ts`). Los comentarios del propio archivo dicen «21 workers» (`docker-compose.yml:26,207,301,607`): están desactualizados.
2. Coolify (`A/docker-compose.coolify.yml`) despliega solo **15 servicios**: API, `api-migrate` y **4 workers** (`messaging`, `scheduling`, `workflow`, `read_models`). Los otros 21 workers están apagados a propósito (`docker-compose.coolify.yml:840-866`, comentario «WORKERS OPCIONALES»).
3. La API **ya mide** dependencias síncronas: `GET /readiness` sondea `postgresql`, `mongodb`, `redis`, `opensearch` y `rls` (`A/src/app-readiness.service.ts:73-79`). **No** sondea MinIO/S3, ClamAV, Gmail, ElevenLabs, GA4, SIAT ni los workers.
4. **El front no puede leer `/health` ni `/readiness`**: `F/deploy/api-locations.conf` no los proxea (solo prefijos de módulo; `/admin/ops` sí, línea 176).
5. **No existe registro consultable de herramientas/instancias.** Hay tablas (`platform_ops.tool_registry`, `service_components`, `service_dependencies`, `health_checks`, `health_check_runs`, `component_tools`; `integrations.external_providers`, `provider_connections`) pero **sin ningún `@Get`**, sin seed y sin conceptos de tipo/criticidad sembrados. Solo hay escrituras (`POST /ops/health-checks/:id/runs`, `POST /integrations/providers`…).
6. Los workers exponen `/health`, `/readiness`, `/status` en `127.0.0.1:9100` (loopback por defecto, `A/src/worker/worker-health.server.ts:40-56`): la API **no puede** sondearlos por red; hay que usar latido (heartbeat) hacia la API.
7. Hay 3 capacidades de proveedor **sin adaptador real** (solo `mock`/`none`): `vector_rag.embeddings`, borrado `cross_store_consistency` e `identity_assurance` (`A/src/worker/jobs/*/mock-provider-wiring.service.ts`); y en producción el emulador está prohibido (`A/src/worker/worker.env.ts:233-251`).

---

## 1. INSTANCIAS en ejecución

### 1.1 Plano de aplicación (API, workers, front)

| Nombre | Tipo | Puerto | Imagen / comando | Variables clave (sin valores) | Depende de | Perfil | Healthcheck |
|---|---|---|---|---|---|---|---|
| `api` | API NestJS | 3000 (`docker-compose.yml:41`, host `${PORT:-3000}` en `:632`) | `mantra-redesa-api:local`, `node dist/src/main.js` (`:613-660`; `A/Dockerfile:94`) | `NODE_ENV`, `DB_*`, `MONGODB_URI`, `REDIS_*`, `OPENSEARCH_NODE`, `MINIO_*`, `FILE_STORAGE_*`, `JWT_*`, `MFA_ENCRYPTION_KEY`, `WEBHOOK_SIGNING_KEY`, `DOWNLOAD_URL_SECRET`, `ORM_SCHEMA_SYNC`, `RLS_ENFORCE`, `OTEL_*`, `OBSERVABILITY_HTTP_SLI_*`, `MOCK_PROVIDER_*`, `GOOGLE_OAUTH_*`, `AUDIO_TTS_*`/`ELEVENLABS_*` | `opensearch`(healthy), `opensearch-init`(completed), `redis`(healthy). Postgres/Mongo NO (viven fuera, Neon/Atlas, `:626-636`) | siempre | **Sí**: `fetch http://localhost:3000/health` cada 10 s, `start_period 120s` (`:638-650`). Además rutas `/liveness` y `/readiness` (`A/src/app.controller.ts:42-70`) |
| `api` (Coolify) | API | `expose 3000`, sin publicar (`docker-compose.coolify.yml:746-800`) | `${API_IMAGE:-alovida-api:coolify}` | idem + `ORM_SCHEMA_SYNC=off`, red `alovida` con alias `api`/`alovida-api` | `api-migrate` (completed) | siempre | **Sí** (`:791`, `/health`) |
| `api-migrate` (Coolify) | one-shot | — | `node dist/src/seed-cli.js` (`:696`) | `ORM_SCHEMA_SYNC=safe` | postgres, postgres-init, mongodb, mongo-init, opensearch(-init), minio-init, redis | siempre | No (one-shot) |
| `worker-<dominio>` ×25 | proceso de fondo, una imagen (la de la API) | sonda **9100 interno, no publicado** (`WORKER_HEALTH_PORT`, `docker-compose.yml:213`) | `node dist/src/worker-<dominio>.js` | `WORKER_API_BASE_URL`(=`http://api:3000`), `WORKER_TICK_TIMEOUT_MS`, `WORKER_STUCK_TICK_MS`, `WORKER_DRAIN/SHUTDOWN_TIMEOUT_MS`, `WORKER_HTTP_*` | `api` (healthy) | solo `worker-files` lleva perfil `malware-scan` (`:687`) | **Sí**, ancla `x-worker-healthcheck` (`:314-325`): `GET :9100/health`, 15 s. Deliberadamente NO usa `/readiness` (`:310-313`) |
| `web` (front SSR, producción) | Angular SSR (Node) | 4000; host `127.0.0.1:${HTTP_PORT:-8080}` (`F/docker-compose.yml:78,122`) | `node dist/mantra-core-health/server/server.mjs` (`F/Dockerfile:177`) | `PORT`, `NODE_ENV`, `PUBLIC_API_BASE_URL`(vacía a propósito), `SSR_ALLOWED_HOSTS`, `BUILD_CONFIGURATION` | — | siempre | **Sí**: `fetch /auth` cada 30 s (`F/Dockerfile:174-175`) |
| `dev` (front) | `ng serve` | `${FRONTEND_PORT:-4200}` (`F/docker-compose.yml:135-198`) | `Dockerfile.dev` | `BACKEND_ORIGIN`, `PUBLIC_API_BASE_URL` | — | `dev` | **Sí** (`:203-214`) |
| `web` + `proxy` (front, Coolify) | SSR + nginx | proxy `expose 80`, alias `alovida-front-test` (`F/deploy/docker-compose.coolify.yml:53,121`) | `deploy/Dockerfile.proxy` (nginx 1.27) | `APP_DOMAIN`, `ALOVIDA_NETWORK`; build `production-api` | `proxy` espera `web` healthy | siempre | **Sí** web (`/auth`); proxy `wget /nginx-salud` (`F/deploy/Dockerfile.proxy:77-78`) |
| `web` + `proxy` (front, prod genérico) | SSR + nginx | proxy `${HTTP_PORT:-80}:80` (`F/deploy/docker-compose.prod.yml:19,44`) | `nginx:1.27-alpine` | idem | idem | siempre | web: heredado del Dockerfile; proxy: no declarado |

**Los 25 workers** (entrypoint → compose línea → jobs, jobs según `A/src/worker/README.md` mapa de 25 procesos):

| Worker (`src/worker-*.ts`) | Compose | Jobs | Dep. extra en compose | Coolify |
|---|---|---|---|---|
| audio-assets | :888 | audio-generation | — | no |
| automation | :732 | calendar-trigger | — | no |
| billing | :710 | run-due-dunning | — | no |
| community | :1019 | feed-fanout, search-indexer, badge-expiry | — | no |
| consent | :754 | expiration-sweep | — | no |
| cross_store_consistency | :776 | deletion-pipeline | `mock-provider-server` | no |
| data_catalog | :978 | scan-tick | — | no |
| delegated_access | :800 | expiry-sweep | — | no |
| files | :676 | malware-scan, storage-lifecycle | `clamav` (perfil `malware-scan`); extra env `MALWARE_SCAN_ENABLED`, `CLAMD_HOST`, `CLAMD_PORT` | no |
| health_context | :822 | schedule-tick | — | no |
| identity_assurance | :844 | dispatch-identity-checks, expire-sweep, evidence-lifecycle | **solo `api`** aunque su wiring usa el mock (`identity_assurance/mock-provider-wiring.service.ts`) → hueco de dependencia | no |
| integrations | :866 | message-retry, message-correlation, message-dispatch | — | no |
| lakehouse | :1199 | release-expiry | — | no |
| messaging | :910 | outbox-relay, queue, notification-delivery, prescription-expiry-notice | `mock-provider-server` | **sí** (esencial) |
| pharmacy_inventory | :934 | expire-reservations | — | no |
| profiles | :1044 | admissions-expire-sweep | — | no |
| promotions | :956 | expire-points | — | no |
| qa_lab | :997 | schedule-tick, plan-run-tick | — | no |
| read_models | :1065 | read-model-reconciliation | — | **sí** (esencial) |
| reporting | :1087 | scheduler-tick | — | no |
| scheduling | :1109 | dispatch-reminders, promote-waitlist, expire-holds | — | **sí** (esencial) |
| time_series | :1221 | apply-retention, refresh-rollups, compress-chunks | — | no |
| tracking | :1131 | sla-scan | — | no |
| vector_rag | :1175 | embedding-drain | `mock-provider-server` | no |
| workflow | :1153 | sweep-timeouts | — | **sí** (esencial) |

Límites de recursos: API 2 CPU/1536 MB; worker 0,5 CPU/512 MB (`docker-compose.yml:292-299`); en Coolify el límite de worker es 384 MB (`docker-compose.coolify.yml:357-360`). `stop_grace_period: 45s` en API y workers.

### 1.2 Plano de datos y soporte (Compose de desarrollo `A/docker-compose.yml`)

| Nombre | Tipo | Puerto host→cont. | Imagen / comando | Variables clave | Depende de | Perfil | Healthcheck |
|---|---|---|---|---|---|---|---|
| `postgres` | PostgreSQL + TimescaleDB + pgvector | `${POSTGRES_PORT:-5433}:5432` (`:342`) | `timescale/timescaledb-ha:pg18` | `POSTGRES_DB/USER/PASSWORD` | — | `local-db` | **Sí** `pg_isready` (`:358`) |
| `postgres-init` | one-shot DDL | — | `bash /init/bin/init-postgres.sh` (`:368`) | idem | postgres | `local-db` | no |
| `mongodb` | MongoDB document store | `${MONGO_PORT:-27018}:27017` (`:392`) | `mongo:8.2.12` | `MONGO_DB` | — | `local-db` | **Sí** `mongosh ping`, timeout 30 s (`:402`) |
| `mongo-init` | one-shot validadores | — | `init-mongo.sh` (`:425`) | `MONGO_DB` | mongodb | `local-db` | no |
| `redis` | cache/runtime | `${REDIS_PORT:-6380}:6379` (`:442`) | `redis:8.10-alpine`, `redis-server --save 60 1` | — | — | siempre | **Sí** `redis-cli ping` (`:450`) |
| `opensearch` | búsqueda | `${OPENSEARCH_PORT:-9201}:9200`, `9601:9600` (`:458`) | `opensearchproject/opensearch:3.8.0` | `OPENSEARCH_JAVA_OPTS` | — | siempre | **Sí** `curl :9200` (`:481`) |
| `opensearch-init` | one-shot índices | — | `curlimages/curl:8.21.0` (`:491`) | — | opensearch | siempre | no |
| `minio` (en realidad RustFS) | objeto S3 | `${MINIO_PORT:-9002}:9000`, consola `9003:9001` (`:504`) | `rustfs/rustfs:1.0.1` | `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | — | siempre | **Sí** `curl /health/ready` (`:521`) |
| `clamav` | antimalware | — (3310 interno) (`:537`) | `clamav/clamav:1.4` | `CLAMAV_NO_FRESHCLAMD` | — | `malware-scan` | **Sí** `clamdcheck.sh`, `start_period 300s` (`:553`) |
| `mock-provider-server` | emulador de proveedores | `${MOCK_PROVIDER_PORT:-4100}:4100` (`:575`) | build `./mock-provider-server`, `node dist/main.js` (`A/mock-provider-server/Dockerfile:35`) | `MOCK_API_KEY`, `NOTIFICATIONS_FAILURE_RATE`, `DELETIONS_FAILURE_RATE`, `SIMULATED_LATENCY_MS`, `IDENTITY_VERIFICATION_*` | — | siempre | **Sí** `wget /health` (`:598`). Rutas: `notifications`, `deletions`, `identity-verification`, `embeddings`, `pharmacy-erp`, `health` |

Red: `mantra-redesa-network` (`:1283-1284`). Volúmenes nombrados: `api_storage`, `postgres_data`, `mongodb_data`, `clamav_data`, `redis_data`, `opensearch_data`, `minio_data` (`:1260-1281`).

### 1.3 Variantes de despliegue

| Stack | Archivo | Qué levanta | Observación |
|---|---|---|---|
| Coolify (app) | `A/docker-compose.coolify.yml` | api, api-migrate, 4 workers; datos tras perfil `embedded-data` (postgres `:427`, mongodb `:494`, redis `:532`, opensearch `:554`, minio `:604`) + init (`:468,513,587,659`) | Ningún puerto publicado (cabecera, punto 3). MinIO aquí es `bitnamilegacy/minio:2025.4.22`, **distinto** de dev (RustFS): divergencia de imagen |
| Datos fuera de Coolify | `A/infra/resilience/data-stack/docker-compose.yml` (postgres `:27`, mongodb `:47`, redis `:61`, opensearch `:75`, minio `:100`) | Las 5 bases, con volúmenes propios `alovida-data-<entorno>_*` | Postgres solo en `127.0.0.1:${POSTGRES_PUBLIC_PORT:-15433}`. Healthchecks idénticos al de Coolify |
| Jaeger (dev) | `A/docker-compose.jaeger.yml:29` | `jaegertracing/jaeger:2.20.0`; UI 16686, OTLP 4318/4317, **bind 127.0.0.1** | Traza en memoria (50 000), sin auth. Healthcheck `wget :16686` (`:49`) |
| Jaeger+Collector (front) | `F/infra/otel-collector/docker-compose.observability.yml` | `jaegertracing/all-in-one:1.76.0` (UI 16686, línea 21) + `otel/opentelemetry-collector-contrib:0.115.1` (`127.0.0.1:4318`, `13133`, línea 40) | Telemetría del navegador (Angular). Healthcheck en ambos |
| Collector de producción | `A/infra/otel-collector/otel-collector.config.yml` (sin compose) | recibe OTLP 4318/4317, exporta a `${JAEGER_COLLECTOR_ENDPOINT}` con cola y reintento; `health_check` 13133 | Solo configuración |
| Monitoreo del VPS | `A/infra/monitoring/docker-compose.yml` | ver 1.4 | Recurso aparte en Coolify (`alovida-monitoring`) |
| Visor de logs | `A/infra/log-viewer/docker-compose.yml` | `docker-read-proxy` (`:14`, `tecnativa/docker-socket-proxy:0.3.0`) + `dozzle` (`:30`, `amir20/dozzle:v11.1.0`, healthcheck `:47`) | Solo lectura, con login |
| Resiliencia del VPS | `A/infra/resilience/` | servicios systemd en el host: `alovida-standby`, `alovida-autodeploy` (timer 2 min), `alovida-uptime-probe` | No son contenedores: no aparecen en Docker |

### 1.4 Monitoreo (`A/infra/monitoring/docker-compose.yml`)

| Servicio | Línea | Imagen | Puerto | Healthcheck |
|---|---|---|---|---|
| prometheus | 46 | build propio | interno 9090 | sí (`/-/ready`, :72) |
| otel-collector | 83 | build propio | `${OTLP_BIND_ADDRESS:-127.0.0.1}:4318` | no en compose (la config trae `health_check` 13133) |
| alertmanager | 95 | build propio | interno 9093 | sí (:110) |
| grafana | 117 | build propio | `127.0.0.1:3000` + alias Traefik `alovida-grafana` | sí (:152) |
| node-exporter | 164 | `prom/node-exporter:v1.9.1`, `network_mode: host`, 9100 | host | no |
| cadvisor | 187 | `gcr.io/cadvisor/cadvisor:v0.55.1`, `privileged` | interno 8080 | no |
| blackbox | 216 | build propio | interno 9115 | no |
| docker-read-proxy | 230 | `tecnativa/docker-socket-proxy:0.3.0` (GET) | red interna | no |
| docker-restart-proxy | 254 | idem (POST+restarts) | red interna aislada | no |
| autoheal | 271 | `willfarrell/autoheal` por digest | — | no (reinicia contenedores con label `autoheal` y `unhealthy`) |
| telegram-bot | 297 | build propio | interno 9200 | sí (:328) |

Prometheus (`prometheus/prometheus.yml`) scrapea: prometheus, node, cadvisor, docker-state (bot:9200), alertmanager, grafana, traefik (`coolify-proxy:8082`), otel-collector (8889) y **blackbox contra 5 URLs públicas** (test/dev/mockup `*.62.169.18.132.sslip.io`, `http://62.169.18.132:8000/api/health`, `logs…/healthcheck`). Es la única fuente de «disponibilidad pública» que ya existe, pero vive fuera de la API.

---

## 2. HERRAMIENTAS (proveedores/integraciones y utilidades)

### 2.1 Dependencias e integraciones externas de la API

Leyenda de modo: **real** = hay adaptador contra el proveedor; **sim** = simulado por defecto; **mock** = emulador `mock-provider-server`; **DB** = solo registro en tablas, sin cliente.

| Herramienta | Tipo | Dónde se configura (variables) | Código | Modo | ¿Crítica? | Sondeada hoy |
|---|---|---|---|---|---|---|
| PostgreSQL (+Timescale, pgvector) | base | `DB_HOST/PORT/USER/NAME/SSL` (+`DB_PASSWORD`); en dev apunta a Neon (`.env.example` `DB_HOST=…neon.tech`, `DB_SSL=true`) | `A/src/orm`, `A/src/mikro-orm.config.ts` | real | **CRÍTICA** | sí `/readiness` `postgresql`+`rls` (`app-readiness.service.ts:73,79`) |
| MongoDB (document_store) | base | `MONGODB_URI`, `MONGO_DB` | `A/src/modules/document_store/repositories/mongo-connection.provider.ts:70` | real | **CRÍTICA** | sí `mongodb` (`:76`) |
| Redis | cache/runtime | `REDIS_HOST`, `REDIS_PORT` | `A/src/modules/redis_runtime/redis.provider.ts:25` | real | **CRÍTICA** | sí `redis` (`:77`) |
| OpenSearch | búsqueda | `OPENSEARCH_NODE` | `A/src/modules/search_platform/providers/opensearch-client.provider.ts:14` | real | **CRÍTICA** | sí `opensearch` (`:78`) |
| Almacenamiento de archivos (disco local / S3: MinIO-RustFS) | objeto | `FILE_STORAGE_ADAPTER` (default `local`), `FILE_STORAGE_S3_*`, `MINIO_*` | `A/src/common/storage/{local-disk,s3}-file-storage.adapter.ts` | real | **CRÍTICA solo si adaptador=s3**; con `local` depende del volumen `api_storage` | **no** (hueco) |
| ClamAV (antimalware) | seguridad de archivos | `MALWARE_SCAN_ENABLED`(false), `CLAMD_HOST`, `CLAMD_PORT` | `A/src/worker/jobs/files/clamd.client.ts` | real, opt-in | No crítica en dev; sin él las versiones quedan `SCAN_PENDING` (`docker-compose.yml:528-536`) | no |
| Gmail API (correo) | mensajería | `GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`, `GOOGLE_SENDER_EMAIL` (las 4 o cae al mock sin error) | `A/src/worker/google-email-client.service.ts:52`, `…/messaging/google-provider-wiring.service.ts:26` | real si las 4 existen | **CRÍTICA en producción**: «mensajería entrega los correos (activación de cuenta incluida)» (`docker-compose.coolify.yml:818-822`, comentario WORKERS ESENCIALES) | no |
| Emulador de proveedores | doble de prueba | `MOCK_PROVIDER_BASE_URL`, `MOCK_PROVIDER_API_KEY` | `A/src/worker/mock-provider-client.service.ts`; prohibido en prod `worker.env.ts:233-251` | mock | solo dev | sí (healthcheck compose) |
| Embeddings (vector_rag) | IA | ninguna real | `…/vector_rag/mock-embedding-provider.adapter.ts`, capacidad `vector_rag.embeddings` (`mock-provider-wiring.service.ts:25,28`) | **solo mock/none** | No crítica pero **sin proveedor productivo** | no |
| Borrado cross-store | cumplimiento | ninguna real | `…/cross_store_consistency/mock-deletion-provider.adapter.ts` | **solo mock/none** | Alta (derecho de supresión) y **sin proveedor productivo** | no |
| Verificación de identidad | KYC | ninguna real | `…/identity_assurance/mock-identity-verification-provider.adapter.ts` | **solo mock/none** | Alta y **sin proveedor productivo** | no |
| ElevenLabs (TTS) | IA / audio | `AUDIO_TTS_ENABLED`(false), `AUDIO_TTS_PROVIDER`, `ELEVENLABS_API_KEY/BASE_URL/VOICE_ID/MODEL_ID`, `AUDIO_TTS_*` (presupuesto, circuit breaker) | `A/src/modules/audio_assets/audio.env.ts:74`; `A/src/worker/jobs/audio_assets/elevenlabs/elevenlabs-http.client.ts` | real, apagado | No crítica | no |
| Google Analytics 4 | analítica | `TELEMETRY_WEB_ANALYTICS_ENABLED/PROVIDER`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `GA4_ENDPOINT` | `A/src/modules/telemetry/web-analytics.env.ts:22,87`; `…/google-analytics/google-analytics-http.client.ts` | real, apagado | No crítica | no |
| Web Push (VAPID) | notificaciones | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `A/src/modules/messaging/services/web-push.service.ts:248` (lib `web-push`) | real si hay claves | No crítica | no |
| SIAT (impuestos Bolivia, facturación) | fiscal | `SIAT_MODE` (`real`/simulado), `SIAT_BASE_URL`, `SIAT_CODIGO_SISTEMA`, `SIAT_NIT`, `SIAT_CODIGO_AMBIENTE`, `SIAT_TIMEOUT_MS`… | `A/src/modules/billing/billing.module.ts:106-111`; `…/adapters/siat-real.adapter.ts:39-47` | **sim por defecto** | Crítica legal si se emite factura real; hoy simulada | no |
| Geocodificación inversa (Nominatim / Photon) | mapas | `GEOCODING_REVERSE_URL`, `GEOCODING_FALLBACK_URL`, `GEOCODING_USER_AGENT` | `A/src/modules/geo/reverse-geocoding/reverse-geocoding.service.ts:90-97`; ruta pública `POST /public/geo/reverse` | real (con respaldo) | No crítica (degrada el alta) | no |
| Catálogo externo de farmacia (ERP) | integración | base URL por configuración de integración | `A/src/modules/pharmacy_inventory/infrastructure/adapters/http-external-pharmacy-catalog.adapter.ts:27-30` | real (a verificar origen de la URL) | No crítica | no |
| Pasarelas de pago | pagos | solo tablas `payments.payment_gateways`, `gateway_connections` | `A/src/modules/payments/entities/*`; controladores solo `POST` | **DB** (no hallé cliente HTTP en `modules/payments`) | Crítica de negocio, **sin integración real** | no |
| OTLP / Jaeger / Prometheus | observabilidad | `OTEL_ENABLED`(false), `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_*`, `OBSERVABILITY_HTTP_SLI_ENABLED` | `A/src/observability/telemetry.config.ts:35`, `A/src/observability/http-sli/` | real, apagado por defecto | No crítica (no debe tumbar la app) | no |
| OpenStreetMap (tiles, front) | mapas | constante `DEMO_TILES` | `F/src/app/shared/components/organisms/map/map-tiles.ts:25`; CSP `F/src/server/security-headers.ts:257` | real | No crítica (nombrada «DEMO»: revisar política de uso de OSM para producción) | no |

Homónimo a no confundir: `POST /automation/tools` (`A/src/modules/automation/controllers/agent-catalog.controller.ts:96`) registra **herramientas de agentes de automatización** (tipo `AUTO_TOOL_TYPE_HTTP_CALL`), no infraestructura.

### 2.2 Utilidades internas del repo (no son parte de la ejecución)

| Grupo | Dónde | Qué hace |
|---|---|---|
| Seeds | `A/tools/alovida/seed-*.mjs` (`seed:dev`, `seed:vitrina`, `seed:diagnostic-units`…), `A/tools/e2e/{reset,seed,verify}-e2e.mjs`, `A/tools/alovida-dev/*.py`, `A/scripts/seed-farmacia-e2e.mjs`, `yarn seed:boot[:prod]` → `src/seed-cli.ts` | Siembra datos de dev/E2E y catálogos |
| Generadores de catálogo | `A/scripts/gen-bo-*.py`, `A/tools/bolivia-datasets`, `A/tools/terminology-import`, `A/tools/catalog` (`orm:catalog`, `catalog:schemas`), `F/scripts/gen-*.mjs` | Datasets, catálogo ORM, fixtures del front |
| Verificadores | `A/scripts/db/{check-schema-drift,vendor-ddl,verify-clean-init}`, `A/scripts/verify-jaeger.sh`, `yarn inventario:verificar`, `yarn catalog:permission-drift`, `yarn docs:openapi:check-breaking`, `yarn seed:e2e:verify`, `yarn postman:verify`; front: `F/scripts/check-*.mjs` (≈25: tokens, contraste, prefijos de ruta, deriva de contrato, límite de líneas…) | Gates que se corren a mano (CI propio caído) |
| Inventario del portal | `A/inventario/` + `A/tools/inventario/*` → servido por `GET /admin/portal/*` (`A/src/modules/data_catalog/presentation/controllers/admin-portal.controller.ts:58-200`: `version`, `operaciones`, `flujos`, `catalogo/tablas`, `catalogo/deriva`, `linaje`, `glosario`) | Inventario de endpoints/flujos/tablas **de código**, no de infraestructura |
| Operación del VPS | `A/scripts/docker-prune.sh`, `A/tools/autodeploy`, `A/tools/devtunnel/devtunnel.sh`, `A/infra/server/harden-ssh.sh`, `A/scripts/recovery/drill-postgres.sh` | Mantenimiento, despliegue, endurecimiento, simulacro de restauración |
| Auth Google | `A/tools/google-oauth/get-refresh-token.mjs` | Obtiene el refresh token de Gmail |

---

## 3. Cómo modela Atlas las herramientas y qué tiene ya nuestra API

### 3.1 Atlas (solo front; el backend de Atlas no está en el clon)

Endpoints consumidos (`ATLAS/docs/contracts/frontend-backend-contracts.md:70-73`; `ATLAS/src/features/systems/services.ts:46,150,158`):

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/systems/tools` (paginado) | `systems.tools.read` |
| GET | `/systems/tools/:toolId` | `systems.tools.read` |
| GET | `/systems/health/tools` (lista **entera**, no paginada) | `systems.tools.health.read` |
| POST | `/systems/tools/infer-requirements` | `systems.tools.inferRequirements` |

Campos del **catálogo** `ToolItem` (`ATLAS/src/features/systems/types/catalog-data-types.ts:114-135`): `toolId, code, name, type, provider, purpose, description, businessValue, technicalUsage, auditNotes, failureRisks, requiredEnvVars[], hasSandbox, healthcheckRoute, requiresCredentials, isCritical, status, ownerTeam`. Estados de catálogo (`ATLAS/src/features/systems-tools/tools-page.tsx:28-48`, CHECK de `system_tool_catalog.status`): `ACTIVE`, `PLANNED`, `DEPRECATED`, `DISABLED`.

Campos de **salud** `ToolHealth` (`ATLAS/src/features/systems/types/catalog-types.ts:17-28`): `code, name, status, isCritical, isWorker, isConfigured, missingEnvVars[], isHealthy (true/false/null), healthMessage, checkType ("LIVE" | "CONFIGURATION" | "NOT_APPLICABLE")`.

Regla de presentación (`ATLAS/src/features/systems/tool-live-state.tsx:5-23`): el estado vivo sale **solo de `isHealthy`** (misma señal del monitor de avisos), nunca de `status`:
`isHealthy=true → UP`, `false → DOWN`, `null` + `checkType=NOT_APPLICABLE → NOT_APPLICABLE`, resto `NO_PROBE` («configurada · sin chequeo en vivo»). `CONFIGURATION` **no es caída** (`frontend-backend-contracts.md:85-87`); `healthMessage` se muestra tal cual (qué respondió, cuánto tardó, qué se degrada).

Criticidad: booleano `isCritical`; la tabla filtra «Críticas / No críticas» (`tools-health-table.tsx:48-59,76-83`) y filtra por estado vivo (UP/DOWN/NO_PROBE/NOT_APPLICABLE, `:18-46`). Columnas completas: Herramienta (nombre+código), Estado en vivo, Catálogo, Crítica, Chequeo, «Qué dice» (mensaje + `Faltan: <env vars>`). Pestañas «Catálogo» y «Salud» en `/internal/systems/tools` (`tools-page.tsx:56-58`); `/tools/health` solo redirige (`app/internal/systems/tools/health/page.tsx`). Cabecera de la pestaña: contadores «N operativas · N caídas · N sin chequeo en vivo · N no aplican» y banner rojo con las caídas (`tools-health-section.tsx:20-60`). El catálogo de Atlas incluye también los otros backends del ecosistema como herramientas más (`DECISION_ENGINE`, `ERP_BACKEND`), comprobados por HTTP desde el backend.

### 3.2 Registro equivalente en nuestra API (búsqueda `tools|providers|integrations|external_providers|system_context`)

| Módulo | Qué es | Endpoints reales | ¿Sirve para «todas las herramientas con estado»? |
|---|---|---|---|
| `integrations` (`A/src/modules/integrations`) | `external_providers` (code, name, tipo, `base_url`, auth, `doc_url`, estado), `provider_connections` (tenant, entorno, `config_json`, credencial, vigencia), `integration_endpoints` (método, ruta, `timeout_ms`), `webhook_subscriptions`, mensajes | **Solo escritura** y por rol `SECURITY_ADMIN`: `POST /integrations/providers`, `…/providers/:id/connections`, `…/endpoints`, `…/webhook-subscriptions` (`integrations-providers.controller.ts:58-115`), `POST /integrations/connections/:id/credentials:rotate`, `:pause` (`integrations-connections.controller.ts:49,67`), mensajería y `POST /integrations/webhooks/inbound`. **Ningún `@Get` de listado** | **No.** Es por tenant, sin criticidad ni salud; sin lectura |
| `platform_ops` (`A/src/modules/platform_ops`) | Entidades `tool_registry` (code, name, `tool_type_concept_id`, `current_version`, `homepage_url`, `is_approved`), `service_components` (`component_type_concept_id`, **`criticality_concept_id`**, `repository_url`, `owner_team`), `service_dependencies` (criticidad, `timeout_ms`, `failure_mode_text`, `fallback_strategy_text`), `component_tools`, `health_checks` (`target_kind`, `target_ref`, `timeout_ms`, `severity`, `is_enabled`, umbral), `health_check_runs` (`status`, `latency_ms`, `http_status`, `recorded_at`) | `POST /ops/health-checks/:id/runs` (roles `SYSTEM`,`SRE`,`PLATFORM_ADMIN`, `platform-ops.controller.ts:190-191`) — el módulo tiene **15 rutas, 0 `@Get`** | **Es el modelo exacto que falta**, pero vacío: no hay seed, ni rutas de lectura, ni conceptos sembrados de tipo/criticidad/chequeo (no hallé `platform_ops.concepts.ts`; `Grep` de `TOOL_TYPE|COMPONENT_TYPE|CHECK_TYPE` no devuelve conceptos de este módulo) |
| `ops_console` (`A/src/modules/ops_console`) | Consola de lectura | `GET /admin/ops/{readiness,incidents,incidents/:id,deployments,change-requests,slos,backups,traffic,traffic/endpoints}` con `OPS_READ_ROLES` = PLATFORM_ADMIN, SRE, SECURITY_ADMIN, RELEASE_MANAGER, GOVERNANCE_ADMIN (`ops-console.controller.ts:13-103`) | Parcial: `readiness` es «preparación para producción» (controles RESTORE_TESTED, SLO_ATTAINED, QA_GATE…, `domain/readiness.ts`), no salud de herramientas. **Sí está proxeado por el front** (`F/deploy/api-locations.conf:176`) y ya hay cliente (`F/src/app/core/data-access/admin-portal/platform.client.ts:184-209`) |
| `app.controller` | `GET /health`, `/liveness` (públicos), `/readiness` (público, 5 sondas con latencia) | — | Dato bueno, pero **no accesible desde el front** (nginx no lo proxea) y solo cubre 4 bases + RLS |
| `system_context` | Enumeraciones dinámicas y contextos versionados | `/system-context/dynamic-enums*`, `contexts*` (`system-context.controller.ts:63-382`) | **No**: nada de herramientas pese al nombre |
| `system_ops` | Backups, restore-tests, retención, residencia, legal hold | 8 controladores (`backup.controller.ts`…) | Solo alimenta `/admin/ops/backups` |
| `telemetry`, `auth_providers`, `integration_contracts` | analítica, proveedores de login, contratos de intercambio | varios | No son registro de herramientas |
| Estado de workers | `workerHealth` registra capacidades de proveedor `none/mock/real` (`A/src/worker/worker-health.registry.ts:55-67`) | `GET :9100/status` **loopback**, sin auth | Datos útiles pero inalcanzables por red |
| Resiliencia en proceso | `CircuitBreaker.snapshot()` (`A/src/common/resilience/circuit-breaker.ts:151`), `Bulkhead.snapshot()` (`bulkhead.ts:73`) | ninguno expuesto | Podría alimentar estado de ElevenLabs/GA4/SIAT |

---

## 4. Brecha y propuesta

### 4.1 Qué falta (verificado)

1. **Inventario** consultable: ninguna ruta lista herramientas ni instancias; las tablas `platform_ops.*` están vacías y sin conceptos.
2. **Estado vivo** de lo que no es base de datos (almacenamiento S3, ClamAV, Gmail, proveedores, workers, observabilidad): hoy nadie lo mide dentro de la API.
3. **Criticidad** como dato: existe `criticality_concept_id` en el modelo, no su catálogo ni su uso.
4. **Acceso del front** a salud: `/readiness` no está proxeado; `/admin/ops` sí.
5. **Workers**: `/status` solo por loopback → hace falta latido hacia la API (la API ya emite token `SYSTEM` a los workers: `A/src/worker/system-api-client.service.ts`).
6. **Fuentes de verdad paralelas**: el compose dice 21 workers y hay 25; Coolify tiene 4; MinIO difiere entre dev y Coolify. El inventario debe salir de **una** fuente (ver 4.3).

### 4.2 Endpoints propuestos (bajo `/admin/ops`, ya proxeado, roles `OPS_READ_ROLES`)

| Ruta | Respuesta (inspirada en Atlas, ampliada) |
|---|---|
| `GET /admin/ops/tools` | Lista **completa** (no paginada): `{ code, name, kind (DATABASE\|CACHE\|SEARCH\|OBJECT_STORAGE\|MAIL\|IDENTITY\|AI\|FISCAL\|ANALYTICS\|MAPS\|OBSERVABILITY\|SECURITY), provider, purpose, isCritical, status (ACTIVE\|PLANNED\|DEPRECATED\|DISABLED), binding (real\|mock\|none\|simulated), isConfigured, missingEnvVars[], requiredEnvVars[], checkType (LIVE\|CONFIGURATION\|NOT_APPLICABLE), isHealthy (true\|false\|null), healthMessage, latencyMs, checkedAt, ownerTeam, failureImpact, fallback }` |
| `GET /admin/ops/instances` | `{ code, kind (API\|WORKER\|FRONT\|DATABASE\|EMULATOR\|MONITORING), environment, isCritical, isEssential, desiredState (RUNNING\|OFF_BY_DESIGN), reportedState, lastHeartbeatAt, version/gitCommit, dependsOn[], healthSource }` |
| `GET /admin/ops/tools/:code` | Detalle + últimas N corridas (`health_check_runs`) y dependientes (`component_tools`) |
| (interno) `POST /ops/health-checks/:id/runs` | **Ya existe**: los workers lo usan como latido con su token `SYSTEM` |

Reglas de presentación para el front (copiadas de Atlas, `tool-live-state.tsx`): estado vivo solo de `isHealthy`; `CONFIGURATION` y `NOT_APPLICABLE` nunca en rojo; filtros «Críticas / No críticas» y por estado; mostrar `healthMessage` íntegro y `Faltan: …`; separar «herramientas» de «instancias» en dos pestañas (Atlas solo tiene herramientas).

### 4.3 Cómo alimentarlos sin inventar datos (reglas 00 §2 y 97.4)

- **Catálogo interno** (no oficial, con procedencia): sembrar `platform_ops.tool_registry` + `service_components` + `service_dependencies` + `health_checks` desde un seeder idempotente con identificadores estables, procedencia «compose X línea Y / env schema Z» y marcado como catálogo interno. Requiere sembrar antes los conceptos `tool_type`, `component_type`, `criticality`, `check_type`, `target_kind` (hoy no existen; pasan por el agregador `module-concepts.ts`).
- **Estado**: tres orígenes con `checkType` honesto:
  1. `LIVE` en proceso para lo que la API ya alcanza: reutilizar `AppReadinessService` (Postgres, Mongo, Redis, OpenSearch, RLS) y añadir sondas con timeout de 3 s (patrón `READINESS_TIMEOUT_MS`, `app-readiness.service.ts:21`) para S3/MinIO y ClamAV (`clamdcheck`), y `snapshot()` de los circuit breakers para ElevenLabs/GA4/SIAT.
  2. `CONFIGURATION` para proveedores sin sondeo barato (Gmail, VAPID, SIAT, ElevenLabs): `isConfigured` + `missingEnvVars` (patrón `GoogleEmailClient.isConfigured()`).
  3. Latido para workers: cada worker informa `declareProviderCapability` + último tick por `POST /ops/health-checks/:id/runs`; la API deriva `reportedState` por antigüedad del último latido (S7 «antigüedad del dato», contrato M34 del front, `ViewState`).
- **Estado deseado vs reportado**: el catálogo debe distinguir «apagado a propósito» (21 workers en Coolify, ClamAV sin perfil, TTS) de «caído»; si no, el tablero mostrará rojo permanente. Se recomienda un campo `desiredState` por entorno.
- **Contrato**: añadir los tres tipos al contrato del front (`api-contract.generated.ts`, `check-admin-portal-contract.mjs`) y un test negativo de autorización (otro rol → 403, sin token → 401) por la regla 80.2.3; la respuesta no debe incluir URLs con credenciales ni valores de variables (solo nombres).

### 4.4 Orden sugerido (franjas, `NO_BIG_BANG_REWRITE`)

1. API: conceptos + seeder idempotente del catálogo + `GET /admin/ops/tools` solo con `CONFIGURATION` y `LIVE` de las 5 sondas existentes.
2. API: sondas S3/ClamAV/breakers + `GET /admin/ops/instances` con inventario estático (sin latido).
3. API + workers: latido por `POST /ops/health-checks/:id/runs`.
4. Front: nueva pantalla bajo Superadministración (`navigation.platform.ts`, no `navigation.map.ts` congelado), cliente en `platform.client.ts`, dos pestañas (Herramientas / Instancias), mock con el mismo contrato.

---

## 5. Hallazgos de seguridad y de coherencia (sin transcribir valores)

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| S1 | Media | `A/.env.example` (versionado) trae **valores no vacíos** para `DB_PASSWORD`(:25), `POSTGRES_PASSWORD`(:33), `MINIO_ACCESS_KEY/SECRET_KEY`(:52-53), `JWT_SECRET`(:102), `MFA_ENCRYPTION_KEY`(:122), `WEBHOOK_SIGNING_KEY`(:125), `DOWNLOAD_URL_SECRET`(:141) y, comentadas, `BOOTSTRAP_ADMIN_PASSWORD`(:317) y `FAKER_PASSWORD`(:353). Los de JWT/MFA/WEBHOOK/DOWNLOAD/MINIO parecen marcadores de desarrollo; **`DB_PASSWORD` no sigue ese patrón** (igual a `POSTGRES_PASSWORD`, junto a `DB_USER=neondb_owner`, `DB_SSL=true`). Confirmar con el dueño que ninguno es real y rotar si lo fuera. `.env.coolify.example` las trae todas vacías (correcto) | `A/.env.example` |
| S2 | Media | El compose de desarrollo publica Redis (6380), OpenSearch (9201/9601), Mongo (27018), Postgres (5433) y RustFS (9002/9003) **en todas las interfaces** (sin `127.0.0.1:`), Redis sin `requirepass` y OpenSearch con `DISABLE_SECURITY_PLUGIN=true`. En una red compartida quedan abiertos. Jaeger y Postgres de data-stack sí van a loopback | `docker-compose.yml:352,399,447,477,517` |
| S3 | Baja | Default público `AUDIO_TTS_DATA_KEY` de desarrollo en el compose (`…dev-only…change-before-production`); en producción el esquema lo exige | `docker-compose.yml:106`; `docker-compose.coolify.yml` cabecera punto 4 |
| S4 | Baja | `/status` de workers sin autenticación (loopback por defecto); abrirlo con `WORKER_HEALTH_HOST` expone capacidades | `A/src/worker/worker-health.server.ts:40-56` |
| S5 | Baja | `docker-restart-proxy` permite `POST` bajo `/containers` (documentado; aislado en red `internal`) | `infra/monitoring/docker-compose.yml:247-269` |
| C1 | Info | Comentarios «21 workers» vs 25 reales; `worker-identity_assurance` sin dependencia del mock; MinIO distinto entre dev (RustFS) y Coolify (bitnamilegacy) | `docker-compose.yml:26,207,844`; `docker-compose.coolify.yml:604` |
| C2 | Info | `A/src/worker/README.md` dice que los 25 están «algunos bajo perfiles»; en `docker-compose.yml` **solo** `worker-files` tiene perfil | `docker-compose.yml:687` |
| C3 | Info | Tres capacidades de proveedor (embeddings, borrado, identidad) y pagos **sin integración real**; en producción el mock está prohibido, así que esos caminos quedan en `none` | `worker.env.ts:233-251` |

## 6. No cubierto

- Nada se levantó ni se consultó en runtime (ni `docker compose config`, ni peticiones HTTP): todo es lectura de archivos (peldaño `DISCOVERED`).
- No se leyó el backend de Atlas (no está en el clon); los campos de `system_tool_catalog` salen de los tipos del front y del contrato.
- No se verificó el origen de la URL del adaptador de catálogo de farmacia ni si `payments` tiene algún cliente en otro directorio fuera de `modules/payments`.
- No se inspeccionaron `mantra-core-health-model`, `mantra_core_health_mobile` ni `mantra_core_technologies_health_docs`: sin compose ni Dockerfile hasta 3 niveles de profundidad (solo se buscó por nombre).
- Los valores reales de `.env` (no existe `A/.env` en el clon) no se vieron; S1 se basa solo en el ejemplo versionado.
