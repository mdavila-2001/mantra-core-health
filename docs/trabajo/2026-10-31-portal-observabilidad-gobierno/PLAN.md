# Plan maestro — Panel de observabilidad y gobierno de la plataforma AloVida

- Fecha: 2026-10-31 · Repos: `mantra-core-health-model` (esquema, primero), `mantra-core-health-api`, `mantra-core-health` (front), `mantra_core_health_mobile` (SDK de telemetría) · Rama de trabajo: `claude/busy-dijkstra-5apd55` en cada repo.
- **Peldaño de evidencia de este documento: `DISCOVERED`.** Todo lo que se afirma sobre el código tiene `ruta:línea` en los seis documentos de frente. Nada de lo propuesto está escrito ni ejecutado, salvo la **validación de la paleta de gráficos** (`evidencia-dataviz/`, salidas íntegras del validador de la skill `dataviz`).
- Reemplaza, como definición del «portal de administración / reportería» del admin de plataforma, al supuesto H8 de `../2026-10-30-perfil-admin-medicion-gobierno/PLAN.md` y a la maqueta comercial de `../2026-10-30-reporteria-comercial-alovida/`.
- **Kill-test global (binario):** entro como Portal Admin de AloVida contra la API real con Postgres, **no** paso por «elegir organización», aterrizo en el Centro de la plataforma, abro «Observabilidad y gobierno» y cada pestaña muestra números que coinciden con un `SELECT` en la base y con la respuesta JSON de la API. Un toast, una captura contra el simulador o un `0` donde debía decir «sin dato» significan **no hecho**.

## 0. Cómo leer esta carpeta

| Archivo | Frente | Qué responde |
|---|---|---|
| `CONTEXTO-COMUN.md` | — | El pedido literal del usuario y las reglas que todos los frentes respetan |
| [`01-entrada-y-acceso.md`](./01-entrada-y-acceso.md) | Entrada | Por qué el Portal Admin cae en elegir organización (dos patas: front y API), por qué «está bugueado todo», qué se hace con la maqueta, rutas y roles definitivos |
| [`02-observabilidad-sistema.md`](./02-observabilidad-sistema.md) | Sistema | Peticiones, latencia, consultas SQL, **errores individuales y agrupados**, workers, dependencias, SLO: modelo, captura, endpoints, pestañas |
| [`03-uso-errores-heatmap.md`](./03-uso-errores-heatmap.md) | App | Uso y errores **por parte de la app** (web y móvil), taxonomía de partes, heatmap real por pantalla, SDK Flutter |
| [`04-catalogo-y-gobierno.md`](./04-catalogo-y-gobierno.md) | Datos | Matriz pantalla por pantalla contra Atlas Admin Portal, catálogo vivo, y **gobierno de datos** completo (dominios, stewards, glosario, PII, políticas, calidad, linaje, certificación, auditoría) |
| [`05-frontend-dataviz-y-evidencia.md`](./05-frontend-dataviz-y-evidencia.md) + `evidencia-dataviz/` | Front | Arquitectura del panel, sistema de visualización conforme a la skill `dataviz` **ya validado**, protocolo de evidencia «funciona de verdad» |
| [`06-cargas-masivas-aprobacion-gobierno-usuarios.md`](./06-cargas-masivas-aprobacion-gobierno-usuarios.md) | Personas | Inventario forense **por rama** de lo que ya existe; cargas masivas, motor de aprobación único, gobierno de usuarios |
| `PLAN.md` (este) | — | Diagnóstico unificado, decisiones entre frentes, orden de franjas, kill-tests, lo que necesita al usuario |

## 1. Diagnóstico unificado (lo que explica «está bugueado absolutamente todo»)

Seis causas independientes, cada una con ruta en su documento:

1. **Selección de organización forzada al admin de plataforma** (01 §1). Front: `session.store.ts:227-229` decide «elegir organización» con la sola regla «2+ membresías y ninguna elegida», sin mirar roles; `login.ts:219-222` y `auth.guard.ts:36-38` la aplican antes que cualquier otra. API: sólo `SUPERADMIN` y `SYSTEM` son alcance plataforma (`tenant-resolution.ts:12`); un `PLATFORM_ADMIN` sin `X-Tenant-Id` recibe `403 TENANT_AMBIGUOUS` y el interceptor del front lo devuelve a elegir organización (`auth.interceptor.ts:136-142`). **Arreglar un solo lado produce un bucle.**
2. **El portal de reportería es una maqueta que no puede funcionar contra la API** (01 §1.4, D-01…D-12). Pide `/reporting/catalog` y `/reporting/commercial/:tab`, rutas que el API no tiene (sólo expone `POST` de definiciones); el proxy de desarrollo no reenvía `/reporting`; todos los datos son de ejemplo en el navegador; los estados se fuerzan por `localStorage`.
3. **La observabilidad del sistema no persiste errores** (02 §0). El API agrega tráfico en memoria y vuelca contadores 2xx/4xx/5xx por minuto a un `jsonb`; **ningún error individual, código exacto, `requestId` ni stack llega a la base**; la medición está apagada en Coolify; la duración de cada SQL se mide pero no sale de memoria; los workers no tienen latido y el front ya llama a `/admin/ops/instances/liveness` y `/tools`, que no existen.
4. **La telemetría de uso produce cero filas reales** (03 §0). Tres defectos encadenados: el SDK manda campos que el DTO rechaza (400 y el SDK se autoapaga), el seeder crea el esquema `ux_interaccion` sin propiedades declaradas (422), y no existe pantalla de consentimiento (todo `skipped`). El «heatmap» que hoy ve el admin devuelve cifras fijas escritas a mano.
5. **El gobierno de datos existe como tablas, no como producto** (04 §0). `system_ops` tiene 30 tablas de gobierno y **cero** rutas de lectura; hay dos catálogos que no se hablan (inventario JSON estático y catálogo vivo de `pg_catalog`); el contrato H4 del carril anterior quedó sólo en papel; roles duplicados `GOVERNANCE_ADMIN` / `DATA_GOVERNANCE_ADMIN`; `audit_log.correlation_id` existe en DDL pero el ORM no lo mapea. Matriz Atlas: **6 existen, 15 parciales, 12 faltan** de 33.
6. **Cargas masivas y gobierno de accesos: desbalance front/API** (06 §0). El motor `bulk_import` está en `dev` y `test` pero no persiste (`InMemoryBatchRepository`) ni da de alta a nadie (`NotConnected*`) porque **falta la tabla del lote en el modelo**. El gobierno de accesos (cuatro ojos, campañas, explicar/simular) está en el **front** de `dev`/`test` y en el **modelo**, pero el PR de la **API** quedó cerrado sin mergear: el front llama 60+ rutas que la API de `dev` no tiene. El ciclo de vida de usuarios (suspender con revocación real de sesión) **sí** está en la API y **ninguna pantalla lo consume**.

Lo que **ya existe y se reutiliza** (no se reescribe): `chart-panel` con ECharts (ADR-0017), `ViewState` de nueve estados, el «Centro de la plataforma», `/admin/ops/traffic*`, `platform_ops` (SLI/SLO/incidentes), TimescaleDB con rollups, el SDK UX de clics con coordenadas, el catálogo vivo con clasificación PII Safe Harbor, `authz` completo, el motor `bulk_import`, FAR-05 (farmacia) y `four_eyes_requests` en la rama de API sin mergear.

## 2. Decisiones entre frentes (tomadas aquí; el usuario puede vetarlas)

| # | Conflicto | Decisión | Por qué |
|---|---|---|---|
| X-1 | Dónde vive el panel: portal propio `/observability` (05 §4.1) vs `/superadmin/*` dentro de `ShellLayout` (01 §3.3) | **`/superadmin/*` dentro de `ShellLayout`**, con navegación lateral por áreas en el grupo «Superadministración» y **archivo de rutas propio** (05 §4.5) para no engordar `app.routes.ts` | Ya existe con SSR, guards, redirecciones heredadas y el conmutador de organización; un tercer armazón repite menú, tema y conmutador y suma líneas a un archivo ya sobre su techo. El Centro de la plataforma (`/dashboard`) es la portada: su puerta «Portal de reportería» pasa a llamarse «Observabilidad y gobierno». |
| X-2 | Errores del navegador: tabla en `observability` (02 D-03) vs en `telemetry` (03 §4.3) | **Una sola tabla, `telemetry.client_error_events`, ingesta `POST /telemetry/client-errors`**, con `request_id` que enlaza a `observability.error_events` | Vive junto al consentimiento y al SDK del cliente; el frente 02 no la duplica y sólo consume el cruce por `request_id`. |
| X-3 | Zona horaria: `America/La_Paz` por defecto con `tz` en la API (02 D-01) vs UTC con conversión de presentación (05 §8) | **La API acepta `tz` y responde `timezone` explícito; el front muestra `America/La_Paz` por defecto con conmutador a UTC** | «Hoy» tiene que ser el hoy del usuario; la API sigue agregando en UTC y lo declara. |
| X-4 | Aprobaciones: revisiones de política con `submit/approve/reject` propias (04 §3.4) vs motor único sobre `four_eyes_requests` (06 H3) | **Motor único** (06 H3) con `kind` por caso: `BULK_IMPORT_CONFIRM`, `CATALOG_CLASSIFICATION`, `GOVERNANCE_POLICY_CHANGE`, `ACCESS_SENSITIVE_CHANGE`; las revisiones de política del frente 04 lo usan | Hoy hay ≥ 9 aprobaciones ad hoc; una décima nueva sería la undécima. `four_eyes_requests` ya tiene hash de carga, vencimiento, consumo atómico y front. |
| X-5 | Alcance plataforma en `/admin/analytics/*` (01 A-3, 03 D-1, 05 D-4) | **Sí: agregación entre organizaciones para roles de plataforma, con `minSample`**; hasta implementarlo, S5 «Elegir organización» y nunca un error | Es lo que el usuario pide (observabilidad de **la app**, no de una organización). |
| X-6 | Roles de gobierno duplicados (04 D-1) y roles de alcance plataforma (01 A-2) | **Alcance plataforma = `SUPERADMIN`, `PLATFORM_ADMIN`, `DATA_PLATFORM_ADMIN`, `GOVERNANCE_ADMIN`** (sólo como roles globales). `DATA_GOVERNANCE_ADMIN` se unifica en `GOVERNANCE_ADMIN` con alias en el guard y migración de seed | Ampliar `PRIVILEGED_TENANT_ROLES` (leer cualquier tenant por cabecera) **queda prohibido**: alcance plataforma ≠ elegir cualquier organización. |
| X-7 | Taxonomía común de «partes de la app» (03 §2) y «módulo/operación» del sistema (02 §0.7) | **Clave de cruce única**: `route_code` de `read_models.frontend_routes` para la app; `operation_key`/`module_code` de `data_catalog.catalog_operations` para la API; cabecera `X-App-Part` del front enlaza ambas | Uso, errores del cliente, errores del servidor y latencia se leen por la misma llave. |
| X-8 | Paleta: `--chart-6` oscuro y leyenda con una serie (05 D-1, D-2) | **Corregir `--chart-6` oscuro a `#0c960c`** (validado) y **seguir la skill** (una serie no lleva caja de leyenda), enmendando ADR-0017 | El validador lo probó contra la superficie real del proyecto; la ADR copió la referencia sin revalidar. |

Corrección a `CONTEXTO-COMUN.md`: no existe `PlatformAdminScopeGuard` según 01 §8; lo que existe es `@PlatformTenantOptional`. El frente 06 lo nombra en su guion de prueba 3: **a verificar** al arrancar F0.

## 3. Arquitectura resultante (una línea por capa)

```text
MODELO (fuente de verdad)  .puml → gen_ddl/gen_entities →  70_observability (nuevo) · 28_telemetry (+client_error_events, ux_interaccion v2)
                                                           · 67_data_catalog (+stewardship, glosario, calidad, linaje, certificación)
                                                           · 11_system_ops (+policy_revisions) · bulk_import (tabla del lote, nueva) · v4275-79 ya en dev
API    captura: middleware HTTP + OrmLogger + AllExceptionsFilter → sinks → volcado idempotente → Timescale/Postgres
       lectura: /admin/observability/*  ·  /admin/analytics/{parts,errors,heatmap,devices}  ·  /admin/governance/* + /admin/catalog/*
                /admin/bulk-imports/* (persistente)  ·  /approvals/* (motor único)  ·  /iam/users/:id/{suspend,…} (ya existe)
       alcance plataforma: @PlatformTenantOptional en lo que corresponda; nunca ampliar PRIVILEGED_TENANT_ROLES
FRONT  /dashboard (Centro) → /superadmin/*  = UNA tarjeta a lo ancho con pestañas por área, 9 estados por widget, chart-panel con paleta validada
       áreas: Sistema · Uso y errores de la app · Catálogo · Gobierno de datos · Usuarios y accesos · Cargas y aprobaciones · Auditoría · Operación
       SDK: UxAnalytics (arreglado) + ClientErrorSink + X-App-Part; consentimiento; DNT
MÓVIL  lib/core/telemetry/: errores primero, luego pantallas y toques, contra los mismos /telemetry/*
```

## 4. Franjas en orden de dependencias

Regla: `NO_BIG_BANG_REWRITE`. Cada franja cierra con evidencia real y **dos PRs por repo** (dev y test). Las franjas marcadas ‖ se hacen **en paralelo con agentes en archivos disjuntos**, según la autorización del usuario registrada en `CLAUDE.md`; siempre un solo navegador de pruebas y quien implementa no aprueba.

### F0 — Lo que se ve mañana (S; sin tocar el esquema)

Cinco arreglos pequeños, independientes, que destraban todo lo demás. Kill-test del frente 01 al cierre.

| Qué | Dónde está el detalle | Resultado observable |
|---|---|---|
| Alcance plataforma en front **y** API: sesión, guard, login, interceptor; `@PlatformTenantOptional` en `/admin/ops/*`; prueba negativa «tenant ajeno → 403» | 01 H1, H2, H3 | El Portal Admin entra sin elegir organización; conmutador «Toda la plataforma» por defecto |
| Maqueta comercial fuera de la entrada: bandera apagada, `/reports/**` → `/superadmin/observability`, `/portal-selector` → `/`, Playwright de la maqueta sólo con bandera | 01 H4 | No hay selector de tres portales; la puerta del Centro dice «Observabilidad y gobierno» |
| Encender la medición HTTP en Coolify (`OBSERVABILITY_HTTP_SLI_ENABLED`) y confirmar filas en `service_sli_series` | 02 H0 | El panel actual de tráfico deja de estar vacío en `test` |
| Ingesta UX produce filas reales: DTO alineado, `ux_interaccion` v2 con propiedades, consentimiento + DNT, propósito agregado sin sujeto | 03 H1 | `POST /telemetry/activity-events` → `inserted = n, skipped = 0` en Postgres |
| Paleta: `--chart-6` oscuro `#0c960c`, tokens ordinales `--chart-ord-1..4`, gate `check-chart-palette.mjs` | 05 H1 | Validador en verde sin WARN en ambos temas, dentro de `gates:diseno` |

### F1 — Esquema (M; `mantra-core-health-model`, un PR por módulo, en este orden)

1. `70_observability` (02 §4): `error_groups`, `error_events`, `http_request_minute_series`, `sql_statements` + `sql_statement_minute_series`, `instances`, `worker_tick_minute_series`, `slow_request_samples`, `dependency_probe_runs`, `rollup_watermarks`, `alert_rules/alert_evaluations`; hypertables y retención declaradas.
2. `28_telemetry` (03 H3.S1.M1, H1.S1.M4): `client_error_events`, índices de `user_activity_events`, conceptos `ERROR_CLASS_*`.
3. `67_data_catalog` + `11_system_ops` (04 H1): stewardship, dominio en objeto, glosario con revisiones y enlaces, reglas/corridas/incidencias/eventos/puntajes de calidad, aristas de linaje, certificaciones, acuses de cambio, revisiones de política.
4. Tabla del lote de `bulk_import` (06 H2) y, si falta, lo que exija `four_eyes_requests` para los `kind` nuevos (06 H3).
5. Parches idempotentes para bases vivas; `check-schema-drift` en cero; `gen_entities.py` en el API.

### F2 — API (L; ‖ cuatro carriles en módulos disjuntos)

| Carril | Módulos | Hitos | Entrega |
|---|---|---|---|
| Sistema | `src/observability/*` (captura), `src/modules/observability` (nuevo) | 02 H2–H7 | Captura idempotente con código exacto y `module_code`; errores agrupados con `requestId`; SQL por huella; latidos de workers y sondas; rollups, SLO y alertas sobre `platform_ops`; 16 rutas `/admin/observability/*`; `/admin/ops/traffic*` relee de la tabla nueva sin cambiar contrato |
| App | `telemetry` | 03 H2–H4 | Siembra de `frontend_routes` desde el registro de navegación; `/admin/analytics/parts`, `/errors*`, `/heatmap` real, `/devices`; retiro de la maqueta de onboarding; alcance plataforma con `minSample` (X-5) |
| Datos | `data_catalog`, `system_ops`, `audit` | 04 H2–H5 | Lectura de todo lo que ya existe (políticas, dominios, PII transversal, cola de revisión, jobs); mutaciones con aprobación vía motor único; motor de calidad con worker y lease; linaje oficial reconstruido desde FK + operaciones + read models; certificación, readiness, alertas, búsqueda, exportaciones selladas |
| Personas | `authz`, `iam`, `bulk_import`, `four_eyes` | 06 H1–H4 | Rescatar la API de gobierno de accesos a `dev` (resolviendo los conflictos descritos en 06 §1.2, nunca «ours/theirs»); lote persistente y alta real por tipo; motor de aprobación único; puertos clínicos conectados (H7 del carril anterior) |

Contratos: cada carril publica `contratos/<carril>.md` con JSON de ejemplo y `notMeasured`/`reason` **antes** de que el front empiece; el front no inventa campos.

### F3 — Front (L; shell primero, luego ‖ un agente por área)

1. **Shell y cimientos** (05 H2–H3, secuencial): extensiones cerradas de `chart-panel` (17 ítems de 05 §3.4: heatmap ordinal, histograma, brecha de 2 px, `[plano]`, `rol` por serie, anotaciones, `app-meter` lineal…), archivo de rutas propio, store de contexto sincronizado con la URL (rango, `tz`, organización opcional), guards por sección, clientes `core/data-access/<área>/` tipados.
2. **Áreas en paralelo**, cada una UNA tarjeta a lo ancho con pestañas (`composition-rules.md` §5) y 9 estados **por widget**:
   - Sistema (05 H4 + 02 §6): Resumen · Errores · Latencia · Consultas SQL · Endpoints · Workers y dependencias · SLO.
   - Uso y errores de la app (05 H5 + 03 §7): Uso por parte · Errores del cliente · Rutas rotas · Heatmap por pantalla · Dispositivos y web vitals · Embudos · Consentimiento.
   - Catálogo y Gobierno de datos (05 H6 + 04 §3.13): Inicio con postura · Catálogo unificado · Linaje · Dominios y stewards · Glosario · PII · Políticas · Calidad · Revisión · Certificación · Deriva · Readiness · Exportar.
   - Usuarios y accesos · Cargas y aprobaciones (06 H5): ciclo de vida con motivo, «quién puede qué», simulador = PDP, revisión de accesos, sesiones; lotes con plantilla CSV y JSON, vista previa, cuatro ojos, informe.
   - Auditoría y Operación (05 H7): bitácora con `requestId`, acceso a datos sensibles, DSAR; instancias, herramientas, despliegues, respaldos (conectados a la API real, se retira el handler simulado).
3. **Móvil** (03 H5): `lib/core/telemetry/` con captura de errores primero; pantallas y toques cuando exista autenticación móvil.

### F4 — Evidencia «funciona de verdad» y PRs (M; por área, en serie)

Protocolo de 05 §5 para cada área: API real con Postgres (`docker compose --profile local-db`), `yarn start:real-api`, script de carga conocida, Playwright sin `networkidle` que entra como Portal Admin y comprueba **conteos exactos** (UI → request → response → `SELECT` → recarga → UI), consola y red limpias, capturas 3 viewports × 2 temas × estados, `visual-reviewer` + `frontend-reviewer` + `regression-auditor` (quien implementa no aprueba), `check-*.mjs` a mano, `REPORTE.md` con escalera de evidencia, dos PRs por repo. Baterías: 02 P1–P12, 03 §8, 04 P1–P8, 06 §5.

### F5 — Cierre de deuda (S/M)

Borrar la maqueta comercial tras rescatar `kpi-tile`, `sparkline`, `filter-bar`, `tab-view` a `shared/` (01 H6); retirar la doble escritura de tráfico (02 H7.S3); enmendar ADR-0017 (X-8) y escribir las ADR nuevas (módulo `observability`, motor de aprobación único, SDK móvil, taxonomía de partes).

## 5. Kill-tests por área (todos binarios, todos contra la API real)

| Área | Pasa sólo si… | Detalle |
|---|---|---|
| Entrada | `admin@alovidasalud.com` con 2+ membresías aterriza en `/dashboard` sin visitar `/auth/organization` ni `/portal-selector`; `GET /admin/ops/traffic` → 200 sin `X-Tenant-Id`; una cuenta sin rol de plataforma con 2 membresías **sí** elige organización | 01 §5 |
| Sistema | N peticiones con códigos conocidos aparecen con conteos exactos por (método, plantilla, código); un 500 provocado aparece como grupo con su `requestId`, y ese `requestId` copiado del front se encuentra en `/requests/:id`; sobrevive a `SIGKILL` de la API; dos instancias no duplican | 02 §7 |
| App | 5 pantallas navegadas y 6 clics en una celda conocida → `clicks = 6` en `/admin/analytics/heatmap`; 3 errores controlados → 3 filas agrupadas con su parte; una plantilla rota aparece en «Rutas rotas» | 03 §8 |
| Datos | Escaneo → objetos reales; clasificar una columna → persiste, entra en revisión, queda auditado; regla de calidad violada a propósito → incidencia que una persona resuelve; linaje de una tabla = sus FK reales; rol insuficiente → 403, objeto de otro tenant → 404 | 04 §5 |
| Personas | Lote de 50 usuarios: validado → aprobado por **otro** rol → 50 filas en `iam.users` → reenvío idéntico no duplica → informe sin tokens; suspender a U → su token devuelve `401 SESSION_INACTIVE` → reactivar; simulador y PDP coinciden en 4 casos | 06 §5 |
| Dataviz | `check-chart-palette.mjs` exit 0 en ambos temas; ninguna pantalla cae en un anti-patrón de `anti-patterns.md` en la revisión visual | 05 §0, §3.5 |

## 6. Lo que necesita al usuario (consolidado y sin duplicados)

Las decisiones marcadas ★ cambian el alcance; el resto tiene supuesto tomado y se puede arrancar.

| # | Decisión | Supuesto si no responde | Frente |
|---|---|---|---|
| ★ U-1 | ¿Qué cuenta es «Portal Admin de AloVida» en tu entorno y cuántas membresías tiene? (no hay seed que asigne `PLATFORM_ADMIN`) | `admin@alovidasalud.com` en local; `PLATFORM_ADMIN` asignado a mano en `test` | 01 |
| ★ U-2 | ¿`SRE`, `RELEASE_MANAGER`, `DPO`, `QA_ADMIN` también entran sin elegir organización? | No; sólo los cuatro de X-6 | 01 |
| ★ U-3 | Medir vistas, errores y salud **sin** consentimiento (interés legítimo, sin sujeto) y agregar todas las organizaciones en el panel de plataforma | Sí a ambas, con `minSample` | 03, 05 |
| ★ U-4 | Motor de aprobación único extendiendo `four_eyes_requests`; qué lotes exigen cuatro ojos | Sí; todo `hc-*` y lotes de usuarios > 100 filas | 06, 04 |
| ★ U-5 | Rescatar la API de gobierno de accesos (PR cerrado) resolviendo 207 conflictos, o rehacerla sobre `dev` | Rescatar con merge archivo por archivo | 06 |
| U-6 | Guardar `actor_hash` (HMAC) en errores para «usuarios afectados»; nunca `user_id` | Sí | 02 |
| U-7 | Zona horaria por defecto `America/La_Paz` | Sí (X-3) | 02, 05 |
| U-8 | Desplegar `worker-time_series` en Coolify (rollups y retención hoy no corren) y lista de instancias esperadas por entorno | Rollup manual desde la API mientras tanto | 02 |
| U-9 | Ruta de falla controlada `selftest/fail` fuera de producción para probar los 500 con conteos exactos | Sí, sólo `NODE_ENV !== 'production'`, rol `SYSTEM` | 02 |
| U-10 | Dónde vive la API de gobierno: políticas y dominios en `system_ops`, catálogo/calidad/linaje/glosario/certificación en `data_catalog` | Así | 04 |
| U-11 | Calidad de datos: sin SQL libre; las incidencias las resuelve una persona; certificación con umbral 80 y vigencia 180 días | Así | 04 |
| U-12 | Heatmap por elemento y rejilla **sin** captura de pantalla del cliente (PHI); capturas de referencia sólo si el equipo las sube | Sin captura | 03 |
| U-13 | Entrega del token de activación en altas masivas (correo vs. alta asistida) y tratamiento de consentimiento revocado | Correo si hay `EmailNoticePort`; si no, asistida; revocación → fila rechazada | 06 |
| U-14 | Tipos de usuario por lote: los 3 existentes + farmacia, laboratorio, aseguradora, secretaria; nunca `OWNER`/`SECURITY_ADMIN` por archivo | Así | 06 |

## 7. Riesgos transversales

| Riesgo | Mitigación |
|---|---|
| Arreglar el front del alcance plataforma sin el API desplegado → bucle `/dashboard ↔ /auth/organization` | F0 se verifica con los dos lados en el mismo entorno; el interceptor deja de navegar para alcance plataforma (peor caso: S5) |
| Volver a entregar maqueta | Ninguna franja se declara hecha sin `VERIFIED_REAL` contra Postgres; el simulador sirve para desarrollar, nunca como evidencia |
| PHI/PII en tableros, muestras de calidad o errores | Sólo agregados y `minSample`; `sample_ids_json` sólo ids; `message_redacted` tras redacción; `actor_hash`; revisión DPO antes de Coolify |
| `check-max-lines` rojo en 126 archivos | Neto ≤ 0 en cada archivo ya excedido; rutas y navegación en archivos propios |
| Cardinalidad y volumen (404 masivos, SQL dinámico, eventos UX) | Topes por minuto e instancia, retención 90 días, hypertables con `drop_chunks`, `droppedFlushes` visible en «No medido» |
| Conflictos con ramas previas (`stoic-johnson` ya en dev; API de `personal-apoyo` sin mergear) | Partir siempre de `origin/dev`; rescates por merge archivo a archivo con su prueba |
| Dos sistemas de gráficos (`insights/charts` SVG vs `chart-panel`) | El panel usa sólo `chart-panel`; deuda registrada |
| Sin Postgres verificado en la máquina de trabajo | Bloqueante explícito en F2+: `docker compose --profile local-db` o la base de `test`; sin eso, nada sube de `TESTED` |

## 8. Tamaño y camino mínimo

F0 **S** · F1 **M** · F2 **L** (‖ 4) · F3 **L** (‖ por área) · F4 **M** · F5 **S/M**. Mínimo viable para que el usuario vea un panel real y no una maqueta: **F0 + F1 (módulos 70 y 28) + F2 carriles Sistema y App + F3 shell y áreas Sistema y App + F4**. Gobierno de datos y Personas pueden ir en paralelo desde F1 sin bloquear ese mínimo.

## 9. Próximo paso

Responder las cinco decisiones ★ (U-1 a U-5). Con eso, F0 arranca de inmediato en los dos repos y se cierra con el kill-test de entrada contra la API real; en paralelo, F1 empieza por el módulo `70_observability` del modelo.
