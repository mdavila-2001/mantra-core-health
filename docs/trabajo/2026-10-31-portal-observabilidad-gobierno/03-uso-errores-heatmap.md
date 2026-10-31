# 03 — Uso y errores de cada parte de la app, con mapa de calor (web y móvil)

Franja del portal de observabilidad (31/10/2026). Contexto y reglas: [`CONTEXTO-COMUN.md`](./CONTEXTO-COMUN.md).
Dueño de este archivo: agente de la franja 03. No toca código ni otros archivos.

Convenciones de este documento: cada hecho lleva `repo › ruta:línea` y la marca **DISCOVERED**; lo que no se leyó dice **no verificado**. Repos: `front` = `mantra-core-health`, `api` = `mantra-core-health-api`, `model` = `mantra-core-health-model`, `movil` = `mantra_core_health_mobile`.

---

## 0. Resumen ejecutivo

**Lo que existe.** El M28 `telemetry` está completo como *ingesta* (5 endpoints `POST /telemetry/*`, gate de consentimiento, política de propiedades declaradas, journeys, web vitals, embudos) y como *lectura por tenant* (`GET /admin/analytics/overview|timeseries|web-vitals|funnels|sessions|pipeline-health`). El front tiene un SDK de interacciones para mapas de calor (`core/observability/ux/`) que ya mide clics con coordenadas normalizadas, clics repetidos, foco de campos, vista y abandono de página; un `ErrorHandler` global con código de soporte dictable; trazas OTel propias; y lectura de `requestId` (`x-request-id`/`correlationId`) en todo fallo HTTP, exigido por S9.

**El hueco principal, en una frase:** **hoy no entra ni una fila real.** Tres defectos encadenados hacen que la telemetría UX produzca cero datos en producción, y los errores del cliente nunca llegan a Postgres (van a Jaeger como spans, no consultables por el panel):

1. El SDK manda `userId`, `sessionId` y `tenantId` en cada evento (`front › src/app/core/observability/ux/ux-analytics.service.ts:353-363`) y el DTO de la API no los declara (`api › src/modules/telemetry/presentation/dto/activity-event.dto.ts:82-192`) con `ValidationPipe` en `whitelist + forbidNonWhitelisted` (`api › src/common/http/validation-pipe.ts:106-107`) → **400 al primer lote**, y el SDK se apaga por 400 (`ux-analytics.service.ts:244-249, 453-455`).
2. El seeder crea el esquema `ux_interaccion` **sin `propertySchemaJson`** (`api › src/common/seed/telemetry-ux-heatmap-seed.service.ts:123-137`) y la política rechaza toda propiedad no declarada (`api › src/modules/telemetry/domain/event-property-policy.ts:12-14, 372-373`) → aun corrigiendo (1), **422 `TELEMETRY_EVENT_PROPERTY_NOT_ALLOWED`** y cero clics.
3. El propósito exige consentimiento (`seed…:105 requiresConsent: true`) y la API descarta sin consentimiento `GRANTED` (`api › …/telemetry-events.service.ts:167-171, 693-704`), pero **el front no tiene ninguna pantalla ni llamada de consentimiento** (búsqueda de `tracking-consents` en `front/src/app`: 0 resultados) → aun con (1) y (2) resueltos, **todo evento se descarta** (`skipped`).

Además: el «mapa de calor» que hoy ve el admin (`/admin/analytics/onboarding/heatmap`) es **una maqueta con números fijos** (`api › …/telemetry-onboarding-analytics.service.ts:30-105, 107-423`: `totalStarted = 1420`, `score` por campo escrito a mano), consumida por `front › features/admin/web-analytics/web-analytics.ts:123-124` y `features/admin/measurement/measurement.ts:131`. Es exactamente lo que el usuario rechazó.

**Qué propone esta franja.** (a) Arreglar la cadena de ingesta punta a punta y probarla contra Postgres; (b) una taxonomía estable de «partes» derivada del registro de navegación y sembrada en `read_models.frontend_routes`, usada como clave común por uso, errores y latencia; (c) errores del cliente en una tabla propia `telemetry.client_error_events` con `request_id` para saltar al error de servidor de la franja 02; (d) heatmap real por pantalla (`/admin/analytics/heatmap`) con celdas, elementos, scroll, rage/dead clicks y escala secuencial de un matiz; (e) SDK Dart mínimo para la app Flutter contra los mismos endpoints; (f) panel «Uso y errores de la app» de 7 pestañas, cada widget con su pregunta y su endpoint; (g) prueba E2E con N pantallas y M errores controlados cuyo conteo exacto se comprueba en el panel.

---

## 1. Telemetría existente, punta a punta (DISCOVERED)

### 1.1 API — módulo `telemetry` (28)

| Pieza | Dónde | Qué hace / qué limita |
|---|---|---|
| Ingesta | `api › src/modules/telemetry/presentation/controllers/telemetry-events.controller.ts:35` `@Controller('telemetry')`; `POST activity-events` :49, `client-contexts` :67, `web-vitals` :84, `conversion-events` :102, `session-journeys/:id/close` :118 | Todas exigen token (guard global). Identidad, sesión y tenant salen del actor, «nunca del cuerpo» (:27-32). |
| Captura de eventos | `…/application/services/telemetry-events.service.ts:126-273` | `tenantId = getCurrentTenantId()` :135; `sessionId` = `iam.sessions.id` resuelto desde el claim `sid` (:140, :536-551; `actor-sessions.repository.ts:23-30`) → sin sesión registrada **412 `TELEMETRY_SESSION_NOT_RESOLVED`**; gate de consentimiento :167-171 (`consentAllows` :693-704: la última decisión debe ser `GRANTED`); idempotencia por clave **del mismo usuario** :175-186; validación de propiedades :190; `portalTypeConceptId` por defecto `WEB` :209-212; `correlationId` sólo si viene y es UUID :218 (`dto:170-175`). |
| DTO del lote | `…/presentation/dto/activity-event.dto.ts:82-192` | Campos admitidos: `eventSchemaDefinitionId`, `eventName`, `eventIdempotencyKey`, `analyticsSubjectId`, `sessionJourneyId`, `portalTypeConceptId`, `routeTemplate` (≤300), `occurredAt`, `correlationId` (uuid), `properties` (≤25). Lote 1–500 (:203-205). **No existen `userId`, `sessionId`, `tenantId`.** |
| Política de propiedades | `…/domain/event-property-policy.ts` | Cerrada por defecto: sin `properties` en el esquema no se admite ninguna (:12-14, :372-373 `NOT_DECLARED`); tipos `string|number|integer|boolean` con `maxLength/min/max/enum/pattern` (:83-94); tokens de nombre prohibidos salvo `phiAllowed` (:105-144: incluye `nombre`, `token`, `ci`, `paciente`…); valores prohibidos `email` y `\d{7,}` (:147-150); la clasificación la fija el servidor (:20-22). |
| Lectura administrativa | `…/presentation/controllers/telemetry-analytics.controller.ts:117` `@Controller('admin/analytics')` | `overview` :121, `timeseries` :130, `web-vitals` :139, `funnels` :149, `funnels/:id/report` :156, `pipeline-health` :169, `sessions` :179 (roles RAW), `sessions/:id` :188. Roles :29-42. **Toda lectura exige tenant**: `requireTenantId()` en cada método (:127, 136, 146, 166, 176, 185, 195) y el comentario :109-113 «no hay barrido global, ni siquiera para SUPERADMIN». `requireTenantId` lanza 412 `TENANT_REQUIRED` (`api › src/common/tenant/tenant-context.ts:60-69`). |
| Consultas | `…/infrastructure/repositories/telemetry-analytics.repository.ts` | `eventScope` añade `tenant_id = ?` (:50-58); `overview` cuenta `page_views` como `event_name = 'page_view'` (:116) — **el front emite `pagina_vista`** (`front › …/ux/ux-events.ts:24`) → `pageViews` siempre 0; `topRoutes` por `route_template` (:122-132); vitales por `percentile_cont` (:192-200); `pipelineHealth` declara `notMeasured` duplicados/consentimiento/rechazos (`service:386-402`). |
| Onboarding (maqueta) | `…/telemetry-onboarding-analytics.controller.ts:126-129` `POST telemetry/onboarding-events` `@Public() @TenantAgnostic()`; `GET admin/analytics/onboarding/funnel` :138, `/heatmap` :152 | Servicio **en memoria y con cifras fijas** (`…/telemetry-onboarding-analytics.service.ts:17-28` buffer; :71-72 `totalStarted = 1420`, `reachedCurva = [1420, 1180, 810, 560]`; :107-423 `score` por campo escrito a mano). Nada se persiste (`@NotAudited` :123-125). |
| Gobierno | `…/telemetry-governance.controller.ts:43, 60, 79, 96` | `POST tracking-purposes`, `event-schemas`, `disclosure-versions`, `funnels`, todos `SECURITY_ADMIN`. |
| Consentimiento | `…/telemetry-consent.controller.ts:51, 69, 80, 95, 111` | `POST disclosure-acceptances`, `POST tracking-consents`, `GET tracking-consents/me?purposeDefinitionId`, `POST analytics-subjects` (SECURITY_ADMIN), `POST tracking-consents/:id/withdraw`. |
| Analítica externa | `api › src/modules/telemetry/web-analytics.env.ts:16-17, 36-40` | Proveedores `none|google_analytics`; **apagado por defecto** (:10-12); reenvío sólo de lo persistido y `forwardable` (`events.service:73-77, 712-723`). Fuera de alcance de esta franja: el panel es propio. |
| Seeder heatmap | `api › src/common/seed/telemetry-ux-heatmap-seed.service.ts` | Propósito `PORTAL_UX_HEATMAP` (`requiresConsent: true` :105, `permitsCrossTenantAggregation: false` :106, sin retención :33-37) y esquema `ux_interaccion` v1 `PORTAL_WEB`, `PII_NONE`, **sin `propertySchemaJson`** (:123-137). IDs deterministas en `api › src/common/constants/concepts.ts:118-124`. Se ejecuta en `seed-bootstrap.service.ts:475`. |
| Conceptos | `api › src/modules/telemetry/telemetry.concepts.ts` | `PORTAL_WEB`/`PORTAL_MOBILE` :27-28, `DECISION_GRANTED/WITHDRAWN` :39-43, métricas CWV :53-58, ratings :59-64. `PORTAL_CODES = ['WEB','MOBILE']` (`telemetry-analytics.service.ts:23`). |
| Error reasons | `api › src/modules/telemetry/telemetry.error-reasons.ts:13-29` | `TELEMETRY_SESSION_NOT_RESOLVED`, `TELEMETRY_EVENT_PROPERTY_NOT_ALLOWED`, `*_OUT_OF_SCOPE`. |

**Endpoint de heatmap de clics (`/admin/analytics/heatmap`), dinero y dispositivos.** El contrato `front › docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/contratos/H2-dinero-y-heatmap.md:70-73` nombra `telemetry-click-heatmap.{controller,service,repository}.ts` en la rama `claude/stoic-johnson-4vl5bf`. **En este espacio de trabajo esa rama no existe**: `git branch -r` en `api` y en `front` sólo lista `origin/master` y `origin/claude/busy-dijkstra-5apd55`; `find src -name '*click-heatmap*'` → vacío; `git log --all -S heatmap -- src/modules/telemetry src/common/seed` sólo devuelve los commits del seeder (`1e9db9da`, `fae32cfa`). Los clientes del front `core/data-access/admin-portal/analytics-money.client.ts:16` (`/admin/analytics/money`) y `analytics-devices.client.ts:16` (`/admin/analytics/devices`) apuntan a endpoints que **no están en esta API** (`grep devices` en los controladores de telemetry: 0). Conclusión: el heatmap de clics se implementa en esta franja tomando el contrato H2 §2 como punto de partida (está bien pensado: celdas 20×20, `byElement`, `notMeasured`), **no verificado** contra el código de aquella rama.

### 1.2 Modelo — `telemetry.*` (`model › SQL/28_telemetry/02_tables.sql`)

| Tabla | Columnas que importan para esta franja |
|---|---|
| `user_activity_events` (:98-119) | `event_schema_definition_id`, `analytics_subject_id`, `user_id` (nullable), `session_id` (nullable), `device_id`, `tenant_id` (nullable), `portal_type_concept_id`, `event_name`, `event_idempotency_key`, `route_template`, `occurred_at`, `received_at`, `correlation_id`. Índices por schema/subject/user/session/device/tenant/portal (`04_indexes.sql:67-81`); **no hay índice por `occurred_at` ni `route_template`** (toda consulta de ventana barre por tenant). `05_constraints.sql:9-12`: UK en prosa (schema + idempotency key), «PARTITION: received_at», «RETENTION: purpose-specific» — ninguna materializada. |
| `user_activity_event_properties` (:121-135) | EAV: una fila por propiedad con `value_string/number/boolean/timestamp/concept/hash` y `data_classification_concept_id`. Las coordenadas de clic viven aquí (contrato H2:106). |
| `session_journeys` (:137-152) | `session_id`, `portal_type_concept_id`, `started_at/ended_at`, `entry/exit_event_id`, `event_count`, estado. Sin `tenant_id` (se deriva de los eventos: `telemetry-analytics.repository.ts:60-76`). |
| `client_contexts` (:192-214) | `device_type/os_family/browser_family_concept_id`, `app_version`, `screen_class`, `viewport_bucket`, `locale`, `timezone_offset_minutes`, `country_concept_id`, `region_coarse`, `ip_prefix_hash`, `user_agent_hash`, `is_bot`. **El front nunca la escribe** (ninguna llamada a `/telemetry/client-contexts` en `front/src/app`). |
| `web_vitals` (:216-231) | `route_template`, `metric_concept_id`, `metric_value`, `rating_concept_id`, `measured_at`. **El front nunca la escribe** (sólo el `GET` admin en `platform.client.ts:52`; `docs/observability/web-vitals.md` existe como diseño). |
| `activity_event_schema_definitions` (:24-40) | `property_schema_json`, `prohibited_property_patterns_json`, `phi_allowed`, `portal_type_concept_id`, `purpose_definition_id`. **Es la política de propiedades declaradas.** |
| `tracking_purpose_definitions` (:5-22) | `requires_consent`, `permits_marketing_use`, **`permits_cross_tenant_aggregation`**, `default_retention_days`, `legal_basis_concept_id`. |
| `tracking_consents` (:55-68) | `user_id`, `purpose_definition_id`, `decision_concept_id`, `granted_at/withdrawn_at`, `evidence_hash`. Append-only por decisión (`concepts.ts:38`). |

**Qué se puede medir sin consentimiento, según el modelo y el código.** El modelo distingue propósitos con `requires_consent` y base legal (`LEGAL_BASIS_CONSENT` / `LEGAL_BASIS_LEGITIMATE_INTEREST`, `telemetry.concepts.ts:21-25`), pero el gate del código **no mira `requires_consent`**: `consentAllows` exige siempre una decisión `GRANTED` (`events.service:693-704`). Hoy, por tanto, *nada* se mide sin consentimiento explícito. La franja propone respetar el modelo: un propósito con `requires_consent = false` y base legal «interés legítimo» (errores, salud del servicio, conteo agregado de vistas sin sujeto) pasa el gate sin decisión; uno con `requires_consent = true` (heatmap con coordenadas, sesiones individuales, usuarios únicos) sigue exigiendo `GRANTED`. Es una decisión de privacidad → §9 D-1.

### 1.3 Front — qué hay y qué falta

| Pieza | Dónde (`front › src/app/`) | Estado |
|---|---|---|
| Cliente de ingesta | `core/data-access/telemetry/telemetry.client.ts:33-42` (`POST /telemetry/activity-events`, `keepalive`) ; tipos `telemetry.types.ts:20-36` | El tipo `ActivityEvent` dice ser «copia del DTO» (:4-5) pero lleva `userId`, `sessionId`, `tenantId` que el DTO no admite → **400** (ver §0). |
| SDK UX (heatmap) | `core/observability/ux/ux-analytics.service.ts` | Oyentes pasivos fuera de Angular (:165-173); cola + lote 50 / 10 s / keepalive 20 / tope 500 (`ux-analytics.config.ts:37-40`); muestreo por pestaña en `sessionStorage` (:132-133); reintento con espera creciente para 0/429/5xx (:237-243) y apagado en 400/403/404 (:244-249); vacía el buffer al cambiar de persona (:103-118); `routeTemplate` desde la config del Router (`routing/route-template.ts:32-38`) y `normalizarRuta` (:444-450). **Apagado por defecto** (`src/environments/environment.ts:32-36`: `enabled: false`, `eventSchemaDefinitionId: ''`). |
| Catálogo de eventos UX | `core/observability/ux/ux-events.ts:23-28` (`pagina_vista`, `pagina_abandonada`, `clic`, `campo_enfocado`); clic :94-127 (`x_doc`, `y_doc_px`, `x_vp`, `y_vp`, `objetivo_x/y`, `es_interactivo`, `es_teclado`, `es_clic_repetido`); lienzo :167-174 (`ancho_vp`, `alto_vp`, `alto_doc_px`, `tamano_pantalla`); abandono :79-92 (`profundidad_max`, `ms_en_pagina`, `clics`); `DetectorDeClicRepetido` :149-165 (3 clics / 700 ms / 30 px) | Cubre coordenadas, rage clicks y scroll depth (vía `profundidad_max`). **No cubre** dead clicks ni cortes de 600/1024 configurables (:63-67). Doc: `docs/observability/analytics-events.md`. |
| Selector estable | `core/observability/ux/ux-element.ts:1-27` | Lista blanca `data-testid`, `role`, `type`, `formcontrolname`, `name`; hasta 5 niveles; `:id` por uuid/dígitos; `data-ux-ignore` excluye zonas. `data-testid` ya se usa en 51 plantillas de `shared/components` y en el armazón (`features/shell-layout/*.html:89, 145, 159, 170, 226`). |
| Errores no capturados | `core/errors/app-error-handler.ts:25-44` → `core/errors/error-reporter.ts:80-129` | Código dictable `E-<commit>-NNN` (:82), ruta saneada, mensaje sin stack (:41-48); consola siempre; destino remoto = `ErrorTelemetry` (`core/observability/errors/error-telemetry.ts:52-101`) que marca el span activo o abre uno (`SPAN_NAMES.error`) → exportador OTLP a `/otel/v1/traces` (`environment.ts:22`) → Collector/Jaeger propios. **No queda en Postgres**; el panel no puede consultarlo. `telemetry.enabled` también es `false` por defecto (`environment.ts:18`). Fuentes cerradas `'error-handler'|'router'|'http'|'hydration'|'chunk'` (:13); dedup por `type::mensaje saneado` (`error-deduplicator.ts:93-96`) — **ya es una huella**. `docs/observability/error-reporting.md:18` sigue diciendo «Destino remoto ❌». |
| Fallos HTTP | `core/http/api-failure-log.interceptor.ts:46-60` (consola, sólo dev o `localStorage alovida.debugApi`); `core/http/api-failure.ts:112-114` `supportCodeOf = body.correlationId ?? header x-request-id`; `core/http/error-to-view-state.ts:249-250` → S9 `requestId` obligatorio (`core/view-state/view-state.types.ts:196`; ADR-0005) | El `requestId` **ya llega a cada pantalla**. Nadie lo persiste. `tracing.interceptor.ts:181-189` no lo pone en el span a propósito. El front **no envía** `x-request-id` (sólo `traceparent`, :152-157); la API lo genera (`api › src/logging/pino-options.ts:85-92`, devuelve `X-Request-Id`; usa el entrante sólo con `TRUST_PROXY_HOPS > 0`) y lo copia al cuerpo de error (`api › src/common/filters/all-exceptions.filter.ts:217-227`). |
| Errores de ruta / plantilla | `app.routes.ts:2548-2551` `**` → `NotFound` (`features/not-found/not-found.ts:26`: clase vacía, sin telemetría); fragmento diferido caído → `chunkFallido()` (:1840); `core/observability/routing/router-tracing.ts:216-231` cuenta `NavigationError` y `chunk` **en spans** | Un 404 de ruta por plantilla rota (`CLAUDE.md` §3) hoy es invisible para el panel. |
| Panel actual | `features/admin/web-analytics/web-analytics.ts` (overview/timeseries/web-vitals/pipeline-health/sessions/funnels + onboarding maqueta :123-124, :197-200); `features/admin/measurement/measurement.ts:124-137` (uso = `/admin/ops/traffic/endpoints` agrupado por `measurement-groups.ts`; dinero = `/admin/analytics/money` inexistente aquí; heatmap = onboarding maqueta) | Rutas en `core/navigation/navigation.platform.ts:39` (`administration/web-analytics`), :91 (`superadmin/observability`), :109 (`superadmin/measurement`), :170 (`superadmin/web-analytics`). |
| Gráficos | `shared/components/organisms/chart-panel/` (ECharts, ADR-0017); `chart-option.builder.ts` conoce barra/línea (:40-128), `funnel` (:182), `pie` (:205). **No hay forma `calor`/heatmap.** | Se extiende el builder, no se crea otro organismo (regla «primitivas existentes»). |

### 1.4 Taxonomía disponible

- **Registro de navegación** `front › src/app/core/navigation/navigation.types.ts:255-513` `AppSection { path, label, group: NavGroup, icon, roles, availability, summary, module }`. Grupos (`navigation.groups.ts:10-21`): `General`, `Atención`, `Administración`, `Facturación`, `Superadministración`, `Mi cuenta`. Secciones: 83 (`navigation.map.ts`) + 14 (`navigation.platform.ts`) + 14 (`navigation.support.ts`) + 4 (`navigation.laboratory.ts`) + 1 (`navigation.insights.ts`) = **116** (conteo de `path: '`). Cada ruta lleva su sección en `data[SECTION_ROUTE_DATA]` (`navigation.types.ts:525` = `'seccion'`) → la sección es legible en tiempo de ejecución desde `ActivatedRoute`. `module` trae el módulo del modelo (`M41 scheduling`) :505-512.
- **Modelo** `model › SQL/30_read_models/02_tables.sql`: `portal_surfaces` (:5-22: `portal_code`, `portal_type_concept_id`, `default_route`) y `frontend_routes` (:24-46: `portal_surface_id`, `route_code`, `route_pattern`, `page_title`, `navigation_group`, `required_permission_id`, `feature_flag_code`, `status_concept_id`). **Sembrado:** la API no tiene seeder (`grep -ri frontend_routes src/common/seed` → 0); el repositorio sólo tiene `findBySurfaceAndCode` y `create` (`api › src/modules/read_models/repositories/frontend-routes.repository.ts:81, 96`); el único controlador es de vistas por ruta (`frontend-views.controller.ts:58, 72, 113`), sin `GET` de listado. En `model › seedsGenerales/modules/30_read_models.seeds.json` no se hallaron claves `frontend_routes`/`portal_surfaces` por búsqueda de nombre (**no verificado a fondo**). Conclusión: el mapa ruta → superficie/funcionalidad **existe como tabla y está vacío**.

### 1.5 Franja 02 (sistema): clave de cruce disponible

El agregador HTTP-SLI de la API agrupa por `${method}|${route}` (`api › src/observability/http-sli/http-sli.aggregator.ts:178, 250`) y persiste en `time_series.service_sli_series` (leído por `api › src/modules/ops_console/infrastructure/repositories/ops-traffic.repository.ts:117-143` bajo `SEED.tenantId` :103). El front ya calcula una plantilla de ruta de API comparable: `apiRouteTemplate` (`front › core/observability/privacy/sanitize-url.ts:105-114`, uuid/dígitos → `:id`). Por tanto los errores HTTP del cliente pueden llevar `api_metodo` + `api_ruta` (plantilla) + `http_estado` + `codigo` + `request_id`, y cruzarse con la franja 02 por (`api_metodo`, `api_ruta`) para latencia y por `request_id` para el error de servidor concreto.

---

## 2. Taxonomía de «partes de la app»

### 2.1 Niveles y código estable

```
superficie  →  dominio        →  funcionalidad        →  pantalla (ruta)                    →  componente
WEB         →  Administración →  administration/web-analytics → /administration/web-analytics  →  button[data-testid="…"]
MOBILE      →  Atención       →  agenda               →  /agenda/:citaId                    →  Semantics(identifier)
```

| Nivel | Fuente de verdad | Código estable | Dónde se guarda |
|---|---|---|---|
| Superficie | `portal_surfaces.portal_code` | `WEB`, `MOBILE`, `WEB_PUBLICO` (rutas sin sesión: `/search`, `/auth/*`), `INSIGHTS` | `read_models.portal_surfaces` (sembrar 4 filas) |
| Dominio | `NavGroup` del registro | el literal del grupo (6) + `Público` + `Autenticación` | `frontend_routes.navigation_group` |
| Funcionalidad | `AppSection.path` + `AppSection.module` | `path` tal cual (`agenda`, `administration/web-analytics`) | `frontend_routes.route_code` del padre; `page_title = label` |
| Pantalla | plantilla de ruta del Router (`routeTemplate`) | `frontend_routes.route_pattern` = la plantilla (`/agenda/:citaId`); `route_code` = `WEB.ATENCION.AGENDA.DETALLE` (derivado: superficie.grupo-slug.path-slug.hijo-slug, mayúsculas, ≤100) | `read_models.frontend_routes` |
| Componente | selector estable del SDK (`objetivo`) o `data-part` | `app-x > form > button[data-testid="guardar"]` | propiedad `objetivo` del evento (ya existe) |

**Regla clave: la unión es la taxonomía.** Los eventos, errores y vitales **siguen llevando `route_template`** (columna que ya existe); el panel resuelve `route_template → frontend_routes.route_pattern → route_code, navigation_group, portal_surface` **en la consulta**, no en el cliente. Consecuencias deliberadas:

- No se agrega una columna `part_code` al evento (sin cambio de modelo en `user_activity_events`, sin cardinalidad nueva).
- Una ruta que **no casa** con ninguna `route_pattern` cae en el cubo `(sin parte)` y aparece como alerta en el panel: es, a la vez, el detector de rutas no registradas y de 404 de ruta (la plantilla `**` produce `route_template` = URL saneada que no casa).
- Si el equipo renombra una ruta, cambia una fila de `frontend_routes`, no los eventos históricos.

### 2.2 Cómo se siembra (de la fuente, no a mano)

1. `front › scripts/export-partes.mjs` (nuevo, en `scripts/` junto a `check-architecture.mjs`): importa `app.routes.ts` y los registros `SECCIONES_*`, aplana el árbol de rutas con los `:param` tal como se declaran (misma lógica que `route-template.ts:48-91`), y emite `docs/partes/partes.json` (`[{portal, group, sectionPath, module, routePattern, routeCode, pageTitle}]`). Gate: `yarn check:partes` falla si una ruta de `app.routes.ts` con `data.seccion` no está en el JSON.
2. `model`: `read_models.frontend_routes`/`portal_surfaces` ya existen; **no hay DDL nuevo**. Los códigos de `route_code` se documentan en `Mantra Core Health Context/docs/` (sólo texto).
3. `api › src/common/seed/frontend-routes-seed.service.ts` (nuevo): lee el JSON copiado a `src/common/seed/data/partes.json`, `upsert` idempotente por (`portal_surface_id`, `route_code`); marca `status` `DEPRECATED` a lo que ya no está. Registrado en `seed-bootstrap.service.ts` como el de heatmap (:475).
4. `api`: `GET /admin/analytics/parts` devuelve el árbol (superficie → dominio → funcionalidad → pantallas) desde `frontend_routes`; es lo que el panel usa para los filtros. Sin hardcode en el front.

### 2.3 Cómo se etiqueta cada cosa

| Señal | Clave de parte | Cómo llega |
|---|---|---|
| Evento UX (`pagina_vista`, `clic`, …) | `route_template` | ya lo manda el SDK (`ux-analytics.service.ts:360`) |
| Error del cliente | `route_template` (dónde ocurrió) + `api_ruta` (si fue HTTP) | SDK de errores (§4) |
| Web vital | `route_template` | columna existente (`web_vitals.route_template`) |
| Petición HTTP (franja 02) | cabecera **`X-App-Part: <route_code>`** (y `X-App-Platform: web|mobile`) | nuevo interceptor del front (allowlist igual que `traceparent`: `observability/http/propagation-allowlist.ts`); **la franja 02 decide** si la guarda como dimensión del SLI (`http-sli.aggregator.ts:178` hoy sólo método+ruta). Contrato propuesto, no impuesto. |
| Móvil | `route_template` = nombre de ruta de `Navigator` (`/agenda/:id`) con `portalTypeConceptId = PORTAL_MOBILE` | SDK Dart (§6) |

---

## 3. Uso por parte

### 3.1 Métricas y de dónde salen

| Métrica | Pregunta | Fuente | Estado hoy |
|---|---|---|---|
| Vistas | ¿Cuántas veces se abrió cada pantalla? | `user_activity_events` `event_name='pagina_vista'` por `route_template` | datos: **0** (ver §0); consulta: `overview.topRoutes` existe pero cuenta todos los eventos, no vistas, y busca `page_view` (:116) |
| Sesiones | ¿En cuántas sesiones distintas? | `count(distinct session_id)` (ya en `overview` :114) | sesión = `iam.sessions.id` (de la API), no la pestaña |
| Usuarios únicos | ¿Cuántas personas distintas? | `count(distinct user_id)` — **sólo con consentimiento**; `analytics_subject_id` seudónimo (`overview` :115 lo llama «sujetos seudónimos, no usuarios únicos» :145-146) | el SDK no provisiona sujeto; `user_id` sí queda (`events.service:207`) |
| Tiempo en pantalla | ¿Cuánto se quedan? | `pagina_abandonada.ms_en_pagina` (`ux-events.ts:88`) → p50/p75 por ruta desde `user_activity_event_properties` | datos: 0 |
| Acciones clave | ¿Qué botones se usan? | `clic` con `es_interactivo = true` agrupado por `objetivo` | datos: 0 |
| Embudos por funcionalidad | ¿Dónde se cae la gente? | `funnel_definitions` + `funnelReach` (`repository:344-381`) con pasos = esquemas de evento | sin embudos sembrados (listado vacío); los de alta son maqueta |
| Dispositivos | ¿Desde qué pantalla/SO? | `client_contexts` (`device_type`, `os_family`, `browser_family`, `viewport_bucket`) | el front **no la escribe**; `tamano_pantalla` sí viaja en cada evento UX |
| Web vitals por pantalla | ¿Qué pantallas son lentas? | `web_vitals` + `webVitalsByRoute` (:217-233) | el front **no las envía** |
| Tendencia y comparativo | ¿Mejor o peor que el periodo anterior? | `timeseries` (:149-169) + segunda ventana | falta el comparativo (dos ventanas en una llamada) |

### 3.2 Qué hay que construir

**Modelo:** nada nuevo para uso. Sí dos índices que faltan para que las consultas de ventana no barran: `ix_user_activity_events_occurred_at` y `ix_user_activity_events_route_template_occurred_at` → se agregan en el `.puml` del módulo 28 y se regenera `04_indexes.sql` (regla: `.puml → gen_ddl.py → SQL/`; `model › README.md` «Qué hay acá»). Retención: `default_retention_days` del propósito (hoy nulo, `seed:33-37`) → decisión §9.

**API (`telemetry`):**

- Corregir `overview`: `page_views` = `event_name IN ('pagina_vista','page_view')` (:116) y añadir `viewsByRoute`.
- Nuevo `GET /admin/analytics/parts?from&to&portal&compare=previous` → por parte: `views`, `sessions`, `users` (null si el propósito no permite identificar), `avgDwellMs` (p50/p75), `keyActions` top 10, `errors` (de §4), `vitals.p75` (LCP/INP/CLS), y el mismo bloque para el periodo anterior cuando `compare=previous`. Devuelve `tree` (de `frontend_routes`) + `unmapped` (rutas sin parte) + `notMeasured[]`.
- Nuevo `GET /admin/analytics/parts/:routeCode` → detalle: serie temporal de vistas, embudo si hay, dispositivos, vitales por métrica, top elementos, errores recientes (agregados).
- Nuevo `GET /admin/analytics/devices` (el front ya lo espera: `analytics-devices.client.ts:16`) desde `client_contexts` + `tamano_pantalla`.
- `GET /admin/analytics/funnels` ya existe; sembrar embudos reales de las altas (pasos = eventos `alta_inicio`, `alta_paso`, `alta_completa` del SDK, reemplazando la ingesta en memoria de onboarding).

**Front SDK (`core/observability/ux/`):**

- `telemetry.types.ts`: quitar `userId/sessionId/tenantId` del cuerpo (la API los deriva); conservarlos **sólo en memoria** para el filtro por generación (`ux-analytics.service.ts:218-220`). La pestaña viaja como propiedad declarada `pestana` (uuid) si se quiere distinguir pestañas de una misma sesión.
- Enviar `POST /telemetry/client-contexts` una vez por sesión de pestaña (UA parseado a familias, `viewport_bucket`, `locale`, `timezone_offset_minutes`, `app_version = BUILD_INFO.version`; **sin IP**: `ip_prefix_hash` lo calcula el servidor o se omite).
- Enviar `POST /telemetry/web-vitals` con `web-vitals` (ya está diseñado en `docs/observability/web-vitals.md`; **no verificado** si el paquete está en `package.json`) por `routeTemplate`, en lote al abandonar la página.
- Cortes de `tamanoDePantalla` (600/1024) alineados con los tres viewports de Playwright (ya lo dice el comentario `ux-events.ts:59-62`).

### 3.3 Consentimiento y Do-Not-Track (SDK)

- Al iniciar sesión: `GET /telemetry/tracking-consents/me?purposeDefinitionId=<UX_HEATMAP>`; si no hay decisión, el SDK **no captura coordenadas ni foco** y muestra una vez el aviso de privacidad (molécula `app-alert` existente) con «Permitir / No permitir» → `POST /telemetry/tracking-consents` (`consent.controller:69`). Retiro desde «Mi cuenta» → `POST …/:id/withdraw` (:111).
- `navigator.doNotTrack === '1'` o `globalPrivacyControl === true` → el SDK UX **no arranca** (ni pide consentimiento); los errores (interés legítimo, sin sujeto) sí se mandan. El panel declara `notMeasured.dntSessions` como no medido (no se puede contar lo que no se manda).
- Un `pagina_vista` **sin** consentimiento se manda igual pero contra un esquema distinto `pagina_vista_anonima` (propósito `PLATFORM_USAGE_AGGREGATE`, `requires_consent=false`, sin propiedades de posición) y la API lo persiste con `analytics_subject_id = null` y **`user_id = null`** (nuevo: el servicio deja `userId` nulo cuando el propósito no requiere consentimiento). Así «vistas por pantalla» existe para todos y «usuarios únicos» sólo para quien consintió. → Decisión D-1.

---

## 4. Errores por parte

### 4.1 Qué se captura, en el cliente

| Clase | Cómo se detecta hoy | Qué agrega el SDK |
|---|---|---|
| JS no capturado y rechazo de promesa | `AppErrorHandler` (`app-error-handler.ts:29`) vía `provideBrowserGlobalErrorListeners()` (`app.config.ts:50`) | `ErrorReporter.report` (:80) ya llama a `ErrorTelemetry`; se añade una segunda salida: `ClientErrorQueue.push(...)` con la huella `type::mensaje saneado` (`error-deduplicator.ts:93-96`) convertida a `sha256` corto |
| Error de plantilla / ruta | `NavigationError` y chunk (`router-tracing.ts:216-231`); `**` → `NotFound` (`app.routes.ts:2548`) | `NotFound` emite `ruta_no_encontrada` (con `route_template` saneado y `ruta_anterior`); `RouterTracing.finishFailed` emite `navegacion_fallida` con `tipo` (`ChunkLoadError`…). **Detección de plantilla rota en CI**: `yarn check:plantillas` = Playwright que visita las 116 rutas con sesión de cada rol y falla si cae en `NotFound` o si `AppErrorHandler` registra algo (ya existe el patrón en `playwright/api-real-click-sweep.spec.ts:228-233`). |
| HTTP visto por el cliente | `apiFailureLogInterceptor` (consola) y `errorToViewState` (S4/S5/S6/S8/S9) | Nuevo `clientErrorInterceptor` **después** de `authInterceptor` (para no contar el 401 que el refresco resuelve, cfr. orden en `app.config.ts:94-126`): por cada `HttpErrorResponse` con `status ≥ 500`, `0` o `4xx` no esperado (`code` ∉ {`VALIDATION_FAILED`, `NOT_FOUND` esperado por la pantalla}) encola `{clase:'http', api_metodo, api_ruta: apiRouteTemplate(url), http_estado, codigo: body.code, request_id: supportCodeOf(...)}`. **Nunca** `message` ni cuerpo (puede citar un correo: `tracing.interceptor.ts:184-188`). |
| Estados S9 mostrados | `unexpectedError(requestId)` (`view-state.ts:113-117`) | `ViewStateHost` (único punto, ADR-0005) emite `estado_error_mostrado` con `request_id` cuando pinta S9: así el panel sabe **cuántos S9 vio la gente**, no sólo cuántos fallos hubo. |

Agrupación: `huella = sha256(clase + tipo + mensaje_saneado + route_template)[0:16]`. Cada fila lleva `request_id` cuando lo hay → enlace directo al error de servidor de la franja 02 (`/admin/ops/...?requestId=`; la franja 02 define la pantalla).

### 4.2 SDK de cliente (servicio Angular `core/observability/errors/client-error-sink.ts`)

- **Cola + lote**: misma disciplina que `UxAnalytics` (lote 50, tick 10 s, tope 500, espera creciente, `keepalive` al ocultar). Se **reutiliza** extrayendo `ColaDeLotes<T>` de `ux-analytics.service.ts:197-252` a `core/observability/common/cola-de-lotes.ts`; `UxAnalytics` pasa a usarla (sin cambio de comportamiento; las 20+ pruebas de `ux-analytics.service.spec.ts` quedan).
- **`sendBeacon` / `keepalive`**: el cliente ya usa `fetch keepalive` (`telemetry.client.ts:28-31`). Para errores **sin sesión** (pantalla de acceso, chunk caído antes de hidratar) se usa `navigator.sendBeacon` al endpoint público (§4.3).
- **Muestreo**: errores **no se muestrean** por defecto (son pocos y son lo que importa); tope por huella: 20/min/pestaña, luego `suprimidos += n` (se manda el contador, no los eventos).
- **Sin PII**: sólo `type` + mensaje saneado por `sanitizeError` (`error-sanitizer.ts`) + ruta saneada por `sanitizeUrl`; nunca stack, nunca cuerpo, nunca `aria-label`. Misma regla que `error-reporter.ts:41-48`.
- **Consentimiento/DNT**: errores = interés legítimo, sin sujeto (`user_id` nulo salvo que el propósito lo permita) → se mandan con DNT; no llevan `objetivo` ni coordenadas.
- **Contexto**: `version`, `commit` (`BUILD_INFO`), `route_template`, `tamano_pantalla`, `en_linea` (`navigator.onLine`), `codigo_soporte` (`E-…`) para cruzar con lo que la persona dicta a soporte.

### 4.3 Tabla nueva vs. reutilizar `user_activity_events` (decisión argumentada)

Reutilizar `user_activity_events` + EAV obliga a (a) exigir sesión (412 sin `sid`, `events.service:536-551`) → los errores de la pantalla de acceso y de un chunk caído al recargar **se pierden**, que es justo donde más duele; (b) pasar el gate de consentimiento (hoy ciego a `requires_consent`); (c) consultar «top huellas con su último `request_id` y conteo por estado HTTP» pivotando propiedades EAV (una fila por propiedad, `user_activity_event_properties`); (d) compartir retención con la analítica de uso (`RETENTION: purpose-specific`, `05_constraints.sql:11`).

**Propuesta:** tabla propia `telemetry.client_error_events` (append-only; **sólo en `model` primero**, `.puml` 28 → `gen_ddl.py` → `gen_entities.py`):

```
id uuid pk · received_at timestamptz · occurred_at timestamptz
portal_type_concept_id uuid (WEB|MOBILE) · tenant_id uuid null · user_id uuid null · session_id uuid null
route_template varchar(300) · fingerprint varchar(32) · error_class_concept_id uuid (JS|PROMISE|HTTP|ROUTE|CHUNK|HYDRATION|TEMPLATE|NATIVE)
error_type varchar(120) · sanitized_message varchar(500) · http_method varchar(8) null · api_route_template varchar(300) null
http_status smallint null · api_error_code varchar(60) null · request_id varchar(80) null · support_code varchar(40) null
app_version varchar(40) · build_id varchar(40) · screen_size varchar(12) · is_online boolean · suppressed_count integer default 0
```
Índices: (`received_at`), (`fingerprint`, `received_at`), (`route_template`, `received_at`), (`request_id`). Retención propia: 90 días (CHECK en prosa en el `.puml`, igual que el resto del módulo). Sin PHI por construcción (longitudes cortas + saneado del cliente + `BASELINE_PROHIBITED_VALUE_PATTERNS` aplicados en el servidor al `sanitized_message`: reutilizar `event-property-policy.ts:147-150`).

Ingesta: `POST /telemetry/client-errors` **`@Public()` + `@TenantAgnostic()` + `@NotAudited(...)`** (mismo patrón que `onboarding-events`, `telemetry-onboarding-analytics.controller.ts:123-129`), con `@Throttle` (ya hay `RATE_LIMITED` en el contrato de errores: `api-failure.ts:42`) de 60 lotes/min/IP y lote ≤ 50; si trae token, el servicio rellena `user_id/tenant_id/session_id` **desde el actor**, nunca del cuerpo. Mobile usa el mismo endpoint.

→ **Decisión D-2** (tabla nueva + endpoint público limitado, recomendado) para el usuario.

### 4.4 Endpoints de lectura

| Endpoint | Devuelve |
|---|---|
| `GET /admin/analytics/errors?from&to&portal&routeCode&class` | `totals` (errores, huellas, sesiones afectadas o `null`+motivo, S9 mostrados), `byPart[]` (route_code → errores, huellas, tasa = errores / vistas de §3 cuando hay vistas, si no `null`), `byClass[]`, `byHttpStatus[]`, `byApiRoute[]` (clave de cruce con franja 02), `series[]` por hora/día, `notMeasured[]` |
| `GET /admin/analytics/errors/fingerprints?…&limit` | top huellas: `fingerprint`, `errorType`, `sanitizedMessage`, `count`, `firstSeen`, `lastSeen`, `parts[]`, `lastRequestId`, `versions[]`, `trend` (vs. periodo anterior) |
| `GET /admin/analytics/errors/fingerprints/:fp` | detalle agregado: serie, partes, versiones, estados HTTP, últimos 20 `request_id` (sólo roles RAW) |
| `GET /admin/analytics/errors/routes-not-found?…` | rutas que cayeron en `**` o en `(sin parte)`, con conteo y `ruta_anterior` top — detector de enlaces/plantillas rotas |

Alcance: **plataforma**, no tenant (la autoridad es el guard; §9 D-1 cubre el alcance).

---

## 5. Mapa de calor por pantalla

### 5.1 Datos (ya se capturan casi todos)

Del SDK (`ux-events.ts`): `x_doc` (0–1 del ancho del documento), `y_doc_px` + `alto_doc_px` (→ `y` normalizado en la consulta), `x_vp`/`y_vp`, `objetivo` + `objetivo_x/y` (posición dentro del elemento), `es_interactivo`, `es_teclado`, `es_clic_repetido`, `tamano_pantalla`, `ancho_vp/alto_vp`; `profundidad_max` por página (scroll depth). **Se agrega**: `es_clic_muerto` (clic sobre elemento interactivo tras el cual, en 1 000 ms, no hubo `NavigationStart`, ni petición HTTP (hook del `tracingInterceptor`), ni mutación del DOM en el ancestro `app-*` más cercano — `MutationObserver` ya disponible, sin dependencias) y `data-part` como atributo de la lista blanca de `ux-element.ts` para componentes compuestos (tarjetas, pestañas) que no tienen `data-testid`.

### 5.2 Arreglo del defecto conocido (seeder)

`telemetry-ux-heatmap-seed.service.ts:123-137` debe sembrar `propertySchemaJson` con **todas** las propiedades de `ux-events.ts` y las nuevas:

```jsonc
{ "properties": {
  "ancho_vp": {"type":"integer","minimum":0,"maximum":20000}, "alto_vp": {...}, "alto_doc_px": {...},
  "tamano_pantalla": {"type":"string","enum":["movil","tableta","escritorio"]},
  "ruta_anterior": {"type":"string","maxLength":300}, "pestana": {"type":"string","maxLength":36},
  "profundidad_max": {"type":"number","minimum":0,"maximum":1}, "ms_en_pagina": {"type":"integer","minimum":0}, "clics": {"type":"integer","minimum":0},
  "objetivo": {"type":"string","maxLength":300}, "es_interactivo": {"type":"boolean"}, "es_teclado": {"type":"boolean"},
  "es_clic_repetido": {"type":"boolean"}, "es_clic_muerto": {"type":"boolean"},
  "x_doc": {"type":"number","minimum":0,"maximum":1}, "y_doc_px": {"type":"integer","minimum":0}, "x_vp": {...}, "y_vp": {...},
  "objetivo_x": {...}, "objetivo_y": {...}, "tipo_campo": {"type":"string","maxLength":40}
} }
```
Cuidado con la política: `objetivo` es `string` y el valor pasa por `BASELINE_PROHIBITED_VALUE_PATTERNS` (`\d{7,}`): `ux-element.ts` ya reemplaza corridas de 4+ dígitos por `:id`, así que cumple. **El esquema sembrado se versiona** (`schema_version` 2) porque el seeder es idempotente por id (:118-122): hay que sembrar `ux_interaccion:2` con id determinista nuevo y dejar el 1 `DEPRECATED`; el front toma el id de `PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID` (`environment.ts:28-30`) → se publica el nuevo id en el `.env` de cada entorno (microtarea con evidencia). Prueba de integración: `POST /telemetry/activity-events` con un `clic` real → `inserted: 1` y 14 filas en `user_activity_event_properties`.

### 5.3 Endpoint `GET /admin/analytics/heatmap?route&from&to[&portal][&screenSize][&metric=clicks|rage|dead|scroll]`

Se adopta el contrato H2 §2 (`H2-dinero-y-heatmap.md:76-101`): `grid 20×20`, `cells[{column,row,x,y,clicks,share}]`, `byElement[{target,clicks,repeated}]`, `byScreenSize`, `totals{clicks,positioned,keyboard,withoutPosition,repeated}`, `notMeasured`. **Se amplía**: `totals.dead`, `byElement[].dead`, `scroll[{depthBucket:0.1…1.0, sessionsReached, share}]` (de `profundidad_max`), `elements[{target, bbox: null}]`. La `y` normalizada = `y_doc_px / alto_doc_px` **del mismo evento** (limitación declarada: páginas que crecen al cargar). Se implementa en `telemetry/` (controlador, servicio, repositorio) con SQL parametrizado sobre `user_activity_event_properties` pivotado por `user_activity_event_id` (CTE con `FILTER (WHERE property_name = …)`), ventana ≤ 92 días (`analytics-window.ts`).

### 5.4 Render y privacidad

Opciones evaluadas:

| Opción | Privacidad | Fidelidad | Veredicto |
|---|---|---|---|
| A. Captura automática del navegador de cada usuario | **Inaceptable**: la pantalla tiene PHI (nombres, recetas) | alta | descartada |
| B. Captura que el admin toma de **su propia** pantalla al abrir la ruta en el portal (vive en su navegador, no se sube) | aceptable si la sesión del admin no ve PHI real (en prod sí la vería) | alta | sólo entorno de prueba |
| C. **Mapa por elemento sin captura** + rejilla 20×20 sobre un lienzo con la proporción del viewport elegido, con la lista de elementos (selector estable) ordenada por clics y los «puntos calientes» etiquetados por `objetivo` | **sin dato de personas**: sólo selectores y fracciones | media, suficiente para decidir | **recomendada por defecto** |
| D. **Captura de referencia** subida por el equipo (PNG de la pantalla con datos de ejemplo, una por `route_code` y `screenSize`, guardada como archivo del `data_catalog`/`assets`) sobre la que se pinta la rejilla | sin PHI (datos ficticios) | alta | **opcional sobre C**; coste de mantenimiento al cambiar la pantalla |

Render en el front: extender `chart-option.builder.ts` con forma `calor` (ECharts `series.type='heatmap'` + `visualMap` **continuo, un matiz**) y una vista de **tabla alterna** (celda, clics, %) obligatoria (dataviz: «a table view exists»). Escala: secuencial **azul 100→700** de `references/palette.md:100-118` (sólo para magnitud continua; «la más clara ≈ cero puede fundirse con la superficie»), modo oscuro con sus propios pasos (no invertir); nunca arcoíris, nunca rojo-verde como escala; rage y dead clicks **no** se codifican por color dentro del mismo mapa (serían otra variable): van como capa de marcadores con icono + etiqueta, o como `metric=` alternativo que repinta todo el mapa con el mismo matiz. La paleta categórica no aplica aquí; el validador `scripts/validate_palette.js` se corre para los colores del resto del panel (series de errores por clase), no para la rampa secuencial (`color-formula.md:104-107`: fallaría por diseño). Los tokens de color salen de los 188 del sistema (`docs/design-system/tokens.md`): si no hay rampa azul de 13 pasos, se declara una familia `--chart-seq-*` en la hoja de tokens (franja de diseño del panel, agente 0x; aquí sólo se exige el contrato).

---

## 6. App móvil (Flutter) — mínimo serio

**Estado (DISCOVERED):** `movil › lib/main.dart:15-27` es un `MaterialApp` con `routes` nombradas (`/`, `/design-system`, `/showcase` → `PantallaTokens`); `lib/features/home/home_screen.dart:3-17` es un marcador; `pubspec.yaml` sólo depende de `cupertino_icons`; `lib/theme/` (6 archivos: `mantra_tokens.dart`, `mantra_theme.dart`…), `lib/shared/atoms/` y `lib/shared/molecules/` (componentes `Mantra*`); 25 archivos Dart. **No hay cliente HTTP, ni autenticación, ni almacenamiento, ni telemetría, ni captura de errores.**

Propuesta (`lib/core/telemetry/`, sin terceros fuera del equipo Flutter; → §9 A-4):

| Pieza | Archivo | Qué hace |
|---|---|---|
| Config | `telemetry_config.dart` | `--dart-define=TELEMETRY_BASE_URL`, `TELEMETRY_ENABLED`, `UX_EVENT_SCHEMA_ID`, `APP_VERSION` (la skill `alovida-app-movil-ux` ya prescribe dart-defines por entorno) |
| Partes | `parte_actual.dart` | `NavigatorObserver` que mantiene `rutaActual` = `RouteSettings.name` con `:id` en lugar de identificadores (misma regla de `normalizarRuta`); `pagina_vista`/`pagina_abandonada` con `ms_en_pagina`; `portalTypeConceptId = PORTAL_MOBILE` |
| Errores | `captura_errores.dart` | `FlutterError.onError` (errores de framework/render), `PlatformDispatcher.instance.onError` (asíncronos no capturados), `runZonedGuarded` en `main`; huella = `tipo::mensaje saneado` (sin stack; el stack se queda en consola en debug); clase `NATIVE` para los que llegan de plataforma |
| Toques | `captura_toques.dart` | `Listener` raíz (`HitTestBehavior.translucent`) sobre el `MaterialApp.builder`: `x_doc = dx/anchoPantalla`, `y_doc_px` con `alto_doc_px = altoPantalla` (la app no tiene documento que crece), `objetivo` = `Semantics(identifier:)` del widget más cercano (Flutter ≥ 3.19; **no verificado** la versión del SDK en `pubspec.lock`), `es_clic_repetido` con el mismo umbral 3/700 ms/30 px, `tamano_pantalla` por ancho (`movil`/`tableta`) |
| Cola offline | `cola_offline.dart` | JSONL en `getApplicationSupportDirectory()` (paquete `path_provider`, equipo Flutter) con tope 500 eventos / 1 MB, envío en lotes de 50 al volver la conectividad (`ConnectivityPlus` **no**: se reintenta por temporizador y por éxito/fracaso de la petición), claves de idempotencia por evento, borrado al cambiar de usuario |
| Transporte | `telemetry_client.dart` | `dart:io HttpClient` o paquete `http` (equipo Dart) → `POST /telemetry/activity-events` (con token), `POST /telemetry/client-errors` (sin token), `POST /telemetry/client-contexts` (`Platform.operatingSystem`, `MediaQuery.size`, `locale`, `app_version`) |
| Consentimiento | `pantalla_consentimiento.dart` | Hoja modal con `MantraButton` (áreas de 48 dp, `Semantics`) al primer inicio con sesión; `GET /telemetry/tracking-consents/me` + `POST`; «Ajustes › Privacidad» para retirar |

Lo que la app **no** puede hacer todavía y condiciona el orden: sin inicio de sesión no hay token → sólo errores (endpoint público) hasta que exista autenticación en la app. Por eso el hito móvil (H5) empieza por errores y contexto, y los toques/vistas con consentimiento quedan detrás de la autenticación móvil (dependencia externa a esta franja, declarada).

---

## 7. Pestañas del panel «Uso y errores de la app» (una tarjeta, a lo ancho, con pestañas — `composition-rules.md` §5)

Filtros en una fila arriba (dataviz `interaction.md`): ventana (`24h / 7d / 30d / personalizada`, ≤ 92 días), superficie (`Todas / Web / Móvil`), parte (árbol de `GET /admin/analytics/parts`), comparar con periodo anterior (sí/no). Sin selector de organización (franja 01). Cada widget pinta los 9 estados con `ViewStateHost`; `null` ≠ 0; `notMeasured` visible.

| # | Pestaña | Widget | Pregunta que responde | Endpoint |
|---|---|---|---|---|
| 1 | **Resumen** | 4 tarjetas: vistas, sesiones, errores, S9 vistos (con Δ vs. periodo anterior) | ¿Cuánto se usa y cuánto falla la app, hoy vs. antes? | `/admin/analytics/parts?compare=previous` + `/errors` |
| 1 | | Línea doble eje único: vistas/h y errores/h (índice 100 = inicio) | ¿Fallan más cuando se usa más? | `/timeseries` + `/errors.series` |
| 1 | | Barras horizontales «partes con más errores por 1 000 vistas» (top 10) | ¿Dónde duele más en proporción? | `/parts` (campo `errorRate`) |
| 1 | | Lista «sin parte» y «rutas no encontradas» | ¿Qué rutas no están registradas o están rotas? | `/errors/routes-not-found` + `/parts.unmapped` |
| 2 | **Uso por parte** | Árbol/tabla densa dominio → funcionalidad → pantalla: vistas, sesiones, usuarios (o «sin consentimiento»), tiempo p50, Δ | ¿Qué partes se usan y cuáles no? | `/parts` |
| 2 | | Detalle de pantalla: serie, dispositivos, acciones clave (top `objetivo`), vitales p75 | ¿Cómo se usa esta pantalla? | `/parts/:routeCode`, `/devices` |
| 2 | | Embudo por funcionalidad (si hay definición) | ¿Dónde se cae la gente? | `/funnels/:id/report` |
| 3 | **Errores** | Tabla de huellas: tipo, mensaje saneado, conteo, partes, versiones, último `requestId` (enlace a franja 02), tendencia | ¿Qué está fallando y es nuevo o viejo? | `/errors/fingerprints` |
| 3 | | Barras apiladas por clase (JS, HTTP, ruta, chunk, hidratación, nativo), categóricas en orden fijo, legenda + etiqueta | ¿De qué tipo son? | `/errors.byClass` |
| 3 | | Tabla «HTTP visto por el cliente» por `api_metodo + api_ruta`, estado, código de contrato, n, último `requestId` | ¿Qué endpoints devuelven error a la gente? (cruce con latencia de la franja 02 por la misma clave) | `/errors.byApiRoute` |
| 3 | | Serie por versión/commit | ¿Lo introdujo el último despliegue? | `/errors?groupBy=version` |
| 4 | **Mapa de calor** | Selector de pantalla + tamaño; rejilla 20×20 secuencial un matiz; tabla alterna; capas: clics / repetidos / muertos; lista de elementos | ¿Dónde toca la gente, qué no responde, qué parece botón y no lo es? | `/heatmap?metric=` |
| 4 | | Profundidad de scroll (barras por decil, sesiones que llegaron) | ¿Hasta dónde bajan? | `/heatmap.scroll` |
| 5 | **Rendimiento** | p75 LCP/INP/CLS por pantalla con umbrales (bueno/mejorar/pobre como estado con icono+etiqueta, no sólo color) | ¿Qué pantallas son lentas de verdad? | `/web-vitals?metric=` |
| 6 | **Móvil** | Las mismas tarjetas de 1 filtradas a `MOBILE`, errores nativos, versiones de app, SO | ¿Cómo va la app en los teléfonos? | mismos endpoints con `portal=MOBILE` |
| 7 | **Salud del dato** | Frescura, lag, descartes por consentimiento (`notMeasured`), lotes rechazados, consentimientos vigentes vs. sesiones, cobertura de partes (% rutas con filas) | ¿Puedo confiar en estos números? | `/pipeline-health` + `/consents/summary` (nuevo, agregado) |

El detalle visual (tokens, densidad, estados, movimiento reducido) lo hace el agente del panel; aquí queda el contrato de cada widget. Regla dataviz aplicada: un solo eje por gráfico; categóricas en orden fijo validadas con `scripts/validate_palette.js` (claro y oscuro) con evidencia en `evidencia-dataviz/`; secuencial un matiz para el mapa; estados reservados sólo para «bueno/mejorar/pobre».

---

## 8. Cómo se prueba que funciona de verdad

Todo contra **API real + Postgres** (`E2E_API_REAL=1`, patrón de `front › playwright/api-real-click-sweep.spec.ts:24-31` y `altas-api-real-tres-escenarios.spec.ts:19-31`; `baseURL` por `E2E_BASE_URL`, `playwright.config.ts:43`; **nunca** `networkidle`). Un solo navegador de pruebas a la vez. Quien implementa no aprueba (`visual-reviewer`, `regression-auditor`).

**Spec `playwright/uso-errores-api-real.spec.ts`** (nuevo), con cuenta `PLATFORM_ADMIN` y entorno con `PUBLIC_UX_ANALYTICS_ENABLED=true` y el id del esquema v2:

1. **Preparación medible**: `SELECT count(*) FROM telemetry.user_activity_events WHERE received_at > now()` → `antes_eventos`; ídem `client_error_events` → `antes_errores`. Otorgar consentimiento vía UI (aviso → «Permitir») y comprobar `GET /telemetry/tracking-consents/me` = `GRANTED`.
2. **N = 5 pantallas** en orden conocido: `/dashboard`, `/superadmin/web-analytics`, `/superadmin/measurement`, `/administration/data-catalog`, `/superadmin/observability`; en cada una esperar un `data-testid` propio de la pantalla (no `networkidle`).
3. **Clics en coordenadas conocidas** en `/superadmin/measurement` con viewport 1280×800: 6 clics en `page.mouse.click(64, 40)` (celda esperada `(column 1, row 1)` con documento de alto conocido: la prueba lee `document.documentElement.scrollWidth/scrollHeight` y **calcula** la celda esperada con la misma fórmula del servidor), 3 clics rápidos sobre un `data-testid="nav-recoger"` (→ `repeated ≥ 1`), 1 clic sobre un `<span>` no interactivo (→ `es_interactivo=false`).
4. **M = 3 errores controlados**:
   - navegar a `/esta-ruta-no-existe-e2e` → `NotFound` → 1 `ROUTE`;
   - `page.evaluate(() => fetch(API + '/admin/analytics/no-existe-e2e', {headers}))` **no** — debe pasar por `HttpClient`: la prueba abre `/superadmin/web-analytics?e2eFallo=http` y el componente, **sólo** con `environment.e2eHooks === true`, pide `/admin/analytics/__e2e-404` → 404 con `x-request-id` → 1 `HTTP` con `request_id` ≠ null;
   - `?e2eFallo=render` → `throw new Error('E2E render')` en `afterNextRender` del mismo componente → 1 `JS` con código `E-…`.
   El hook `e2eHooks` es `false` en todo build que no sea E2E y la prueba lo verifica (`grep` de la constante en el bundle de producción, `check-*.mjs`).
5. **Vaciar la cola**: ocultar la pestaña (`page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))` con `visibilityState='hidden'` simulado) o esperar ≤ 12 s; comprobar por API `POST` respuestas `inserted` = esperado y `skipped = 0`.
6. **Persistencia**: `psql` → `count(*)` de `user_activity_events` − `antes_eventos` = 5 `pagina_vista` + 4 `pagina_abandonada` + 10 `clic` (+ los `campo_enfocado` que haya, contados aparte); `client_error_events` − `antes_errores` = 3, con `request_id` no nulo en el HTTP y `fingerprint` distinto por clase.
7. **Recarga y UI**: abrir el panel «Uso y errores» con ventana 24 h: pestaña Resumen muestra errores = 3 exactos; Errores lista 3 huellas y el `requestId` del HTTP coincide con el leído en `psql`; Uso por parte muestra 1 vista por cada una de las 5 pantallas; Mapa de calor de `/superadmin/measurement` muestra celda `(1,1)` con `clicks = 6` (comparación **exacta**), `repeated ≥ 1`, `byElement` contiene `nav-recoger`; «Rutas no encontradas» lista `/esta-ruta-no-existe-e2e` normalizada. Capturas en `docs/trabajo/2026-10-31-portal-observabilidad-gobierno/evidencia/03-*/` en 3 viewports × 2 temas.
8. **Negativos**: con DNT activado (`page.context()` con `extraHTTPHeaders DNT: 1` + `navigator.doNotTrack` sobrescrito) no sale ningún `activity-events` pero sí `client-errors`; sin consentimiento, `pagina_vista` entra como anónima (`user_id IS NULL`) y ningún `clic` entra; con el esquema v1 (sin propiedades) el lote devuelve 422 `TELEMETRY_EVENT_PROPERTY_NOT_ALLOWED` (prueba de integración en la API, Jest, contra Postgres de pruebas).
9. **API (Jest de integración, Postgres real)**: `heatmap` con 6 filas sintéticas insertadas por SQL en celdas conocidas → `cells` exactas y `share = 1.0`; `errors/fingerprints` agrupa 3 eventos con mismo `fingerprint` en 1 fila con `count = 3`; `parts` resuelve `route_template` a `route_code` y manda `/zzz` a `unmapped`.

Cadena de evidencia por cada afirmación: **UI → request (HAR o `page.waitForResponse`) → response → `psql` → recarga → UI**. Un `inserted: n` en la respuesta no basta; se cuenta en la tabla.

---

## 9. Hitos, riesgos y ambigüedades

### Hitos (CA dado/cuando/entonces · DoD ejecutable · microtareas `Hn.Sn.Mn`, todas `TODO`)

#### H1 — La ingesta UX produce filas reales (prerrequisito de todo)

**CA:** Dado un usuario con consentimiento `GRANTED`, cuando navega y hace clic en el portal con la captura encendida, entonces `POST /telemetry/activity-events` responde `inserted = n, skipped = 0` y las propiedades del clic están en `user_activity_event_properties`.
**DoD:** prueba Jest de integración (Postgres) verde para esquema v2; `yarn test` del front verde; `psql` con ≥ 1 clic real desde el navegador; captura del `Network` del lote 201.

| ID | Microtarea | Repo | Evidencia |
|---|---|---|---|
| H1.S1.M1 | Alinear `ActivityEvent` del front con `ActivityEventItemDto`: quitar `userId/sessionId/tenantId` del cuerpo, conservar en memoria para el filtro de generación; `pestana` como propiedad | front | spec actualizado (`ux-analytics.service.spec.ts:139, 460` siguen pasando con el campo interno) + lote 201 |
| H1.S1.M2 | Seeder: `ux_interaccion` v2 con `propertySchemaJson` completo (§5.2); v1 `DEPRECATED`; id determinista nuevo en `concepts.ts` | api | 2.ª corrida = 0 inserciones; `POST` con clic real → 201 |
| H1.S1.M3 | Gate de consentimiento respeta `requires_consent` del propósito; propósito `PLATFORM_USAGE_AGGREGATE` (sin consentimiento, sin sujeto, `user_id` nulo) y esquema `pagina_vista_anonima` | api | spec: sin decisión → anónimo entra, `clic` se descarta |
| H1.S1.M4 | `overview.pageViews` cuenta `pagina_vista`; índices `occurred_at` y (`route_template`,`occurred_at`) en el `.puml` 28 → `gen_ddl.py` | model, api | `EXPLAIN` antes/después pegado |
| H1.S2.M1 | Aviso de consentimiento (una vez, `app-alert`) + «Mi cuenta › Privacidad» para retirar; `GET …/me` al iniciar sesión | front | captura + `tracking_consents` con fila `GRANTED` |
| H1.S2.M2 | DNT / GPC → el SDK UX no arranca; registro en `pipeline-health.notMeasured` | front, api | spec |
| H1.S2.M3 | Publicar `PUBLIC_UX_ANALYTICS_ENABLED=true` y el id v2 en `.env` de dev/test (documentar en `docs/observability/analytics-events.md` «Cómo se enciende») | front | diff del `.env.example` + lote real |

#### H2 — Taxonomía de partes sembrada y usada

**CA:** Dado el registro de navegación, cuando corre el seeder, entonces `read_models.frontend_routes` tiene una fila por ruta con `route_code` estable y `GET /admin/analytics/parts` devuelve el árbol sin ninguna constante en el front.
**DoD:** `yarn check:partes` verde; 2.ª corrida del seeder = 0 inserciones; una ruta inventada aparece en `unmapped`.

| ID | Microtarea | Repo |
|---|---|---|
| H2.S1.M1 | `scripts/export-partes.mjs` + gate `check:partes` + `docs/partes/partes.json` | front |
| H2.S1.M2 | `FrontendRoutesSeedService` idempotente (surfaces + routes) registrado en `seed-bootstrap` | api |
| H2.S1.M3 | `GET /admin/analytics/parts` (árbol + métricas de uso + `unmapped`) y `/parts/:routeCode` | api |
| H2.S1.M4 | Interceptor `X-App-Part`/`X-App-Platform` (allowlist a la API) y contrato escrito para la franja 02 | front |
| H2.S2.M1 | SDK: `client-contexts` por pestaña y `web-vitals` por ruta; `/admin/analytics/devices` real | front, api |
| H2.S2.M2 | Retirar la ingesta en memoria de onboarding: eventos de alta como `alta_*` reales + embudos sembrados; el `GET onboarding/*` pasa a leer de Postgres o se elimina (front `web-analytics.ts`, `measurement.ts` adaptados) | api, front |

#### H3 — Errores del cliente en Postgres, con `requestId`

**CA:** Dado un fallo JS, de ruta o HTTP en el portal, cuando ocurre, entonces hay una fila en `telemetry.client_error_events` con huella, parte y (si fue HTTP) `request_id`, y el panel la muestra agrupada.
**DoD:** spec E2E §8 pasos 4–7 (3 errores exactos); Jest de integración de `fingerprints`.

| ID | Microtarea | Repo |
|---|---|---|
| H3.S1.M1 | `.puml` 28: `client_error_events` + conceptos `ERROR_CLASS_*`; `gen_ddl.py`, `gen_entities.py` | model → api |
| H3.S1.M2 | `POST /telemetry/client-errors` público, limitado, `@NotAudited`; saneado en servidor; actor → `user_id/tenant_id` si hay token | api |
| H3.S1.M3 | `GET /admin/analytics/errors`, `/errors/fingerprints[/:fp]`, `/errors/routes-not-found` | api |
| H3.S2.M1 | Extraer `ColaDeLotes<T>` de `UxAnalytics` (sin cambio de comportamiento) | front |
| H3.S2.M2 | `ClientErrorSink` + salidas: `ErrorReporter`, `clientErrorInterceptor`, `NotFound`, `RouterTracing`, `ViewStateHost` (S9 mostrado) | front |
| H3.S2.M3 | `yarn check:plantillas` (Playwright, 116 rutas × roles, falla en `NotFound`/error global) | front |
| H3.S2.M4 | Actualizar `docs/observability/error-reporting.md` («destino remoto» ya existe) | front |

#### H4 — Mapa de calor real por pantalla

**CA:** Dado 6 clics en una celda conocida, cuando se consulta `/admin/analytics/heatmap?route=…`, entonces esa celda devuelve `clicks = 6` y el panel la pinta con escala secuencial de un matiz y tabla alterna.
**DoD:** E2E §8 paso 7 (igualdad exacta); captura 3 viewports × 2 temas; `anti-patterns.md` revisado.

| ID | Microtarea | Repo |
|---|---|---|
| H4.S1.M1 | `es_clic_muerto` + `data-part` en lista blanca; cortes de tamaño configurables | front |
| H4.S1.M2 | Endpoint `heatmap` (contrato H2 §2 ampliado: `dead`, `scroll`) con SQL pivotado | api |
| H4.S2.M1 | Forma `calor` en `chart-option.builder.ts` + tabla alterna + capas | front |
| H4.S2.M2 | Opción D (captura de referencia) sólo si D-3 lo aprueba | front, api |

#### H5 — SDK móvil mínimo

**CA:** Dado un error no capturado en la app Flutter sin sesión, cuando ocurre, entonces hay una fila `client_error_events` con `portal = MOBILE`, `app_version` y huella; con sesión y consentimiento, una vista de pantalla produce `pagina_vista` con `PORTAL_MOBILE`.
**DoD:** `flutter test` de la cola offline (reinicio con red caída → envío al volver); fila en Postgres desde el simulador iOS; captura de la hoja de consentimiento.

| ID | Microtarea | Repo |
|---|---|---|
| H5.S1.M1 | ADR móvil: dependencias permitidas (`http`, `path_provider`), endpoints propios, sin terceros | movil (docs) |
| H5.S1.M2 | `lib/core/telemetry/`: config, cliente, cola offline, captura de errores (`FlutterError.onError`, `PlatformDispatcher.onError`, `runZonedGuarded`) | movil |
| H5.S2.M1 | `ParteActual` (NavigatorObserver), `client-contexts`, toques con `Semantics.identifier` — **tras** autenticación móvil | movil |
| H5.S2.M2 | Hoja de consentimiento y «Privacidad» | movil |

#### H6 — Panel integrado y evidencia

**CA:** Dado un `PLATFORM_ADMIN` sin elegir organización, cuando abre «Uso y errores de la app», entonces ve las 7 pestañas con datos reales de la ventana, cada widget con su estado M34 y `notMeasured` visible.
**DoD:** spec E2E §8 completa verde contra API real; `validate_palette.js` claro/oscuro en `evidencia-dataviz/`; revisión de `visual-reviewer` y `regression-auditor`; **dos PRs** (dev y test, `CLAUDE.md` Git).

| ID | Microtarea |
|---|---|
| H6.S1.M1 | `core/data-access/admin-portal/analytics-parts.client.ts`, `analytics-errors.client.ts`, `analytics-heatmap.client.ts` tipados (sin `any`) |
| H6.S1.M2 | `features/admin/app-usage/` (una tarjeta, pestañas, filtros arriba) — reemplaza `web-analytics` y el bloque heatmap de `measurement`; rutas en `navigation.platform.ts` |
| H6.S2.M1 | Spec E2E `uso-errores-api-real.spec.ts` + `e2eHooks` + gate de bundle |
| H6.S2.M2 | Evidencia (capturas, HAR, `psql`) en `evidencia/03-*` y actualización de `trabajo/ESTADO.md` |
| H6.S2.M3 | PR a `dev` y PR a `test` (rama propia desde `test`, cherry-pick) |

Orden de dependencias: H1 → H2 → (H3 ∥ H4) → H6; H5 en paralelo desde H3.S1.M1 (necesita la tabla). Franja por franja, sin reescritura masiva.

### Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Privacidad: `objetivo`/`route_template`/mensaje con PHI | Fuga en una tabla de analítica | Lista blanca de `ux-element.ts`; saneado doble (cliente + `BASELINE_PROHIBITED_*` en servidor); longitudes cortas; revisión del DPO del `propertySchemaJson`; sin stack ni cuerpo |
| Cardinalidad de `route_template`/`objetivo`/`fingerprint` | Consultas lentas, panel inútil | Plantillas desde el Router (no URL), `:id` obligatorio, top-N en todo ranking (`TOP_LIMIT = 20`), índices nuevos, agregados por hora materializados si el volumen supera 1 M filas/mes (umbral medido en `pipeline-health`) |
| Volumen de clics (EAV: ~14 filas por clic) | Crecimiento de `user_activity_event_properties` | Muestreo por pestaña (`sampleRatio`) en prod (p. ej. 0.25) **declarado** en el panel; retención del propósito; partición por `received_at` (ya prevista en prosa, `05_constraints.sql:10`) |
| Consentimiento bajo → heatmap vacío | Panel «sin dato» | Vistas anónimas sin consentimiento (D-1); tasa de consentimiento visible en «Salud del dato»; aviso claro y no intrusivo |
| Endpoint público de errores abusado | Basura, DoS | Rate limit por IP, lote ≤ 50, `fingerprint` obligatorio, tamaño ≤ 8 KB, descartar sin `app_version` conocida |
| Alcance de plataforma vs. tenant (`requireTenantId` en toda lectura) | 412 para el admin de plataforma | D-1: guard de alcance de plataforma para `/admin/analytics/*` con roles de plataforma; agregación cross-tenant sólo para propósitos con `permits_cross_tenant_aggregation = true` |
| Rama `stoic-johnson` con heatmap/dinero no disponible | Rehacer trabajo | Se parte del contrato escrito (H2 §2) y se declara; si la rama aparece, se compara antes de H4.S1.M2 |
| Dependencia de autenticación móvil | H5.S2 bloqueado | H5.S1 (errores sin sesión) no depende; se declara |

### Ambigüedades y supuesto tomado

| # | Ambigüedad | Supuesto |
|---|---|---|
| A-1 | «Usuarios únicos»: ¿`user_id` o sujeto seudónimo? | Con consentimiento: `count(distinct user_id)` mostrado como «personas con consentimiento»; sin consentimiento: `null` + motivo. No se provisiona `analytics_subjects` en esta franja. |
| A-2 | Ventana máxima y comparativo | 92 días (`analytics-window.ts`); comparativo = misma duración inmediatamente anterior. |
| A-3 | Granularidad del grid | 20×20 (contrato H2) para todos los tamaños; se re-evalúa con datos. |
| A-4 | Terceros en móvil | Permitidos sólo paquetes del equipo Flutter/Dart (`http`, `path_provider`); ningún SDK de analítica/crash de terceros (ADR en H5.S1.M1). |
| A-5 | Retención | 90 días para errores; la de uso/heatmap la fija el DPO (hoy nula); el panel muestra «sin retención definida» hasta entonces. |
| A-6 | ¿Se conserva `GET /admin/analytics/onboarding/*`? | Se reemplaza por datos reales (H2.S2.M2); mientras no exista, el front lo muestra como «sin dato: fuente de ejemplo retirada», nunca con las cifras fijas. |

### Decisiones que necesitan al usuario

- **D-1 · Base legal y alcance.** ¿Aceptar que vistas por pantalla, errores y salud del servicio se midan **sin consentimiento** (interés legítimo, sin sujeto, `user_id` nulo) y que el panel de plataforma agregue **todos los tenants** (propósitos con `permits_cross_tenant_aggregation = true`), dejando coordenadas, sesiones y usuarios únicos bajo consentimiento explícito? Sin esto el panel queda vacío para quien no consienta y 412 para el admin de plataforma.
- **D-2 · Errores del cliente.** ¿Tabla nueva `telemetry.client_error_events` con ingesta pública limitada (recomendado: captura errores sin sesión, consulta directa, retención propia) o reutilizar `user_activity_events` sólo con sesión (menos piezas, pierde login/chunk y complica el agrupado)?
- **D-3 · Heatmap sobre captura.** ¿Mapa por elemento + rejilla **sin captura** (recomendado, cero PHI) o además capturas de referencia con datos ficticios subidas por el equipo por pantalla y tamaño (más legible, coste de mantenimiento)? La captura automática del navegador de los usuarios queda descartada por PHI.
