# Reconciliación con `origin/dev` — auditoría de solo lectura

- Fecha: 2026-10-31 · Alcance: lo construido sobre `master` (commits `39a8bd456` y `ab86fbcda` de la API; `9ee5301f` + árbol sin commitear del front; parche `ui_visibility` del modelo) frente a `origin/dev` (API `78dd3646d`, front `27febd08`, modelo `67fb7f1`).
- Fuera de alcance (ya en manos de otros agentes): `authz-governance` y `system_ops/governance-read` (y por extensión `portal/governance/{policies,pii}` y `portal/permissions/*` del front).
- Método: `git ls-tree`, `git show origin/dev:<ruta>`, `git grep` sobre `origin/dev`; lectura del árbol de trabajo con el merge en curso. No se editó código ni se tocó git.
- Peldaño de evidencia: `DISCOVERED` (rutas y líneas citadas). Nada de esto se ejecutó: no se levantó la API, no se corrió Swagger, no se probó el orden de registro de rutas.

## Veredictos

| # | Módulo (API + front) | Veredicto | Acción |
|---|---|---|---|
| a1 | `governance_admin` · incidencias y reglas de calidad (`admin/governance/data-quality/*`) + `portal/data-quality` | **COMPLEMENTO** (con riesgo de nombre) | Conservar; renombrar a «calidad de datos clínicos»; añadir `@AccessLogged`; revisar alcance por organización |
| a2 | `governance_admin` · solicitudes de privacidad (`admin/governance/privacy-requests`) + `portal/privacy` | **DUPLICADO** de `GET /privacy/dsar` de dev | Reimplementar sobre `AuditOversightReadService` de dev (o retirar) y apuntar el front a `/privacy/dsar` |
| b1 | `admin_catalogs` · Servicios (`admin/catalogs/services`) | **DUPLICADO** exacto de `billing/` (6 de 7 rutas idénticas; `scopes` es lo único nuevo) | Borrar `admin_catalogs`; pasar `GET scopes` a `billing/` |
| b2 | Glosario (`admin/catalogs/glossary`) | **YA EN DEV** (`terminology/`); mi API nunca lo tuvo | Nada en la API; el front `catalog-editor/glossary` es **COMPLEMENTO** |
| b3 | Reporte contable por tipo de usuario | **NUEVO, sin construir** en ningún lado | Sigue siendo `DECISION_REQUIRED` |
| b4 | Front `catalog-editor` (servicios, glosario, auditoría, contable) | **COMPLEMENTO** (dev no tiene pantalla) | Conservar; ajustar a lo que dev sirve (ver §b) |
| c | `clinical_import` (`admin/clinical-imports`) + front `clinical-imports` | **DUPLICADO** de `bulk_import` (`hc-*`) + `features/admin/bulk-imports` | Retirar el módulo y la pantalla; portar tres piezas únicas a `bulk_import` |
| d | `ui_visibility` (`admin/ui-visibility`, `me/ui-visibility`) + front `core/visibility` | **NUEVO** | Conservar; enchufe opcional con `ViewFeatureFlags` de `read_models` |
| e | `platform_ops/runtime_pieces` (`admin/ops/runtime-pieces`) + `portal/probes/runtime-pieces` | **COMPLEMENTO** (extiende `ops_console` y `tool_registry`) | Conservar; coordinar la tabla compartida `tool_registry` |
| f | `data_catalog/application/fit`, `application/catalogacion`, `common/seed/catalog`, tick `fit-tick` | **NUEVO** | Conservar; registrar las rutas nuevas en `inventario/` |
| g1 | Front `core/visibility` | **NUEVO** | Conservar |
| g2 | Front `portal/rbac-matrix` + `GET /authz/catalog/modules` | **COMPLEMENTO**; la API repite la enumeración de rutas de dev | Conservar la pantalla; la API debe usar `RouteMetadataService` de dev |
| m | Parche `authz.ui_visibility_*` del modelo | **Sin choque** con `origin/dev` | Regenerar `README`/`SHA256SUMS` al rebasar |

---

## (a) `governance_admin` y `portal/{data-quality,privacy}`

### a1. Calidad de datos — COMPLEMENTO

Lo que dev ya tiene, sin solaparse con mis rutas:

- `POST /health-data/quality-runs` — sólo escritura de una corrida (`health_data/controllers/health-data.controller.ts:286`).
- `GET /admin/catalog/quality/rules` y `/quality/issues` (`data_catalog/presentation/controllers/admin-catalog.controller.ts:437,448`). Son calidad **del catálogo** (fichas incompletas), «derivadas al leer, sin estado ni acción de cierre» (descripción del propio endpoint, línea 453). Es otra materia.
- Lo planificado por dev, aún sin API: `GET/POST /admin/governance/quality/*` sobre `data_catalog.quality_rules / quality_rule_runs / quality_issues / quality_issue_events` (`docs/trabajo/2026-10-31-portal-observabilidad-gobierno/04-catalogo-y-gobierno.md`, filas 23–24 y §3.3). Las tablas ya están en el modelo (`SQL/patches/2026-10-31_v4281_gobierno_de_datos.sql`).

Lo mío: `GET admin/governance/data-quality/{issues,issues/:id,rules,rules/:id}` y `POST issues/:id/resolution` (`governance_admin/controllers/admin-data-quality.controller.ts:34-78`) sobre `health_data.health_data_quality_issues / _rules / _rule_sets / _runs` (`repositories/data-quality.repository.ts:86-104`). Es la lectura que dev reconoce que falta: «hay tablas de calidad por dominio… y sólo `POST` para correrlas» (04-catalogo, punto 5). No hay endpoint de dev que lea esas tablas (`git grep` sobre `origin/dev -- 'src/**/*controller*.ts'` por `data-quality`: sólo `diagnostics-imaging.controller.ts:166`, otro asunto).

Colisión de rutas HTTP: **ninguna**. En el prefijo `admin/governance` dev tiene (`system_ops/*`, `data_catalog/governance-queue.controller.ts`): `review-queue`, `jobs`, `policies…`, `change-log`, `entity-registry…`, `domains`, `legal-holds`, `retention-executions`, `drafts`, `write-policies`, `retention-policies`, `anonymization-rules`, `field-registry`, `residency-policies`, `assessments`… Ninguna se llama `data-quality` ni `privacy-requests`.

Colisión de tablas / conceptos: ninguna. Declaré conceptos nuevos (`QUAL_ISSUE_RESOLVED`, `QUAL_ISSUE_DISMISSED` en `governance_admin.constants.ts`); `git grep` sobre `origin/dev` no los encuentra.

Riesgos que **sí** hay:

1. **Dos «Calidad de datos» para el mismo administrador.** Cuando dev construya `admin/governance/quality/*` habrá dos pantallas con el mismo nombre y datos distintos (clínicos por organización vs. del catálogo de plataforma). Resolución: rotular la mía «Calidad de datos clínicos (health_data)» en `quality-labels.ts` y en `portal-nav.ts`, y dejar escrito en `governance_admin/README` que es `health_data.*`.
2. **Alcance por organización sin verificar.** El controlador es `@TenantAgnostic()` y las lecturas admiten `SECURITY_ADMIN` (`governance_admin.constants.ts`, `GOVERNANCE_READ_ROLES`); el repositorio devuelve `tenant_id` de cada fila y no filtra por organización (`data-quality.repository.ts:84`, sin `where tenant`). Dev asigna los roles de gobierno sin organización (`data_catalog.roles.ts`) pero `SECURITY_ADMIN` es un rol que puede ir acotado a una organización. Hay que comprobar con el guard real que un `SECURITY_ADMIN` de una sola organización no vea incidencias ajenas; si las ve, filtrar o exigir ámbito de plataforma.
3. **Falta `@AccessLogged`.** Dev sella cada lectura que identifica personas (`audit/controllers/privacy.controller.ts` usa `@AccessLogged({ resourceType: 'DSAR_REQUEST', purpose: 'SECURITY_OVERSIGHT' })`). Mis lecturas de incidencias no lo llevan (`grep AccessLogged governance_admin` vacío). Si una incidencia apunta a un registro de paciente, incumple la regla 90.2.7.

### a2. Solicitudes de privacidad — DUPLICADO

| | Dev | Mío |
|---|---|---|
| Lista | `GET /privacy/dsar` (`audit/controllers/privacy.controller.ts:49`) → `AuditOversightReadService.dsarList` (`audit/services/audit-oversight-read.service.ts:206`) | `GET /admin/governance/privacy-requests` (`admin-privacy-requests.controller.ts:20`) |
| Detalle | `GET /privacy/dsar/:id` (:59) | `GET /admin/governance/privacy-requests/:id` (:27) |
| Tabla | `audit.dsar_requests` | `audit.dsar_requests` (`privacy-requests.repository.ts:62,79,88`) |
| Paginación | keyset `(requested_at, id)` desc | keyset, más antiguas primero |
| Roles | `AUDITOR, DPO, SECURITY_ADMIN` (`audit-query.controller.ts:23`) | siete roles, incluidos `PLATFORM_ADMIN`, `GOVERNANCE_ADMIN`, `DATA_PLATFORM_ADMIN`, `DATA_STEWARD` |
| Sello de lectura | `@AccessLogged` | ninguno |
| Extras de dev | `dueAt` / `overdue` (plazo fijo `DSAR_PLAZO_DIAS`), `hasResultFile`, `notMeasured` | — |
| Extras míos | `statusCounts` por estado; `allowedTransitions` | — |

Escritura: las dos usan `POST/PATCH /privacy/dsar` de dev (mi README lo dice). No hay colisión de rutas (prefijos distintos), sí de **responsabilidad**: dos listas de la misma tabla con roles y auditoría distintos. La mía **amplía el acceso a identidades de titulares sin sello de lectura**, que es peor que lo de dev.

Resolución:

- `governance_admin/services/privacy-requests.service.ts` y `repositories/privacy-requests.repository.ts` → reemplazar por una llamada a `AuditOversightReadService` (exportarlo desde `AuditModule`), o retirar el controlador. Lo único que dev no da son `statusCounts` y `allowedTransitions`: pedirlo al dueño de `audit/` como parámetro opcional de `dsarList`, o calcular `allowedTransitions` en el front desde la máquina de estados documentada.
- Front: `core/data-access/admin-portal/privacy-requests.client.ts` (`/admin/governance/privacy-requests`) → `/privacy/dsar`; adaptar `portal/privacy/privacy-requests.model.ts` a `dueAt/overdue/hasResultFile`. La transición ya usa `PATCH /privacy/dsar/:id` (spec del cliente, línea 50) — eso no cambia.
- Dev no tiene pantalla de DSAR (`git grep 'privacy/dsar' origin/dev -- src` del front: vacío), así que `portal/privacy/*` se conserva.

---

## (b) `admin_catalogs` y `catalog-editor`

### Servicios — DUPLICADO exacto

El contrato `contratos/H3-catalogos.md` decía que la API de Servicios y Glosario estaba hecha. **Lo está, en `origin/dev`**, y `TRASPASO.md:86` la ubica: «`billing/` y `terminology/` (`/admin/catalogs/...`), `TESTED` con dobles».

| Ruta | Dev (`billing/controllers/admin-service-catalog.controller.ts`) | Mío (`admin_catalogs/controllers/admin-service-catalog.controller.ts`) |
|---|---|---|
| `GET /admin/catalogs/services` | :64 | :55 |
| `GET /admin/catalogs/services/:id` | :75 | :64 |
| `POST /admin/catalogs/services` | :87 | :77 |
| `PATCH /admin/catalogs/services/:id` | :106 | :98 |
| `POST …/:id/deactivate` | :122 | :117 |
| `POST …/:id/reactivate` | :138 | :133 |
| `GET /admin/catalogs/services/scopes` | **no existe** | :46 |

Mismo prefijo, mismos verbos, mismos `@Audited` (`ADMIN_SERVICE_CATALOG_CREATED|UPDATED|DEACTIVATED|REACTIVATED`, entidad `service_catalog`), mismos DTO (`expectedRowVersion`, cursor `(code,id)`), misma tabla `billing.service_catalog` y `practice.practices`. Siete clases con el mismo nombre en dos módulos: `AdminServiceCatalogController`, `AdminServiceCatalogService`, `AdminCreateServiceDto`, `AdminUpdateServiceDto`, `AdminServiceItemDto`, `AdminServicePageDto` (+ `AdminServiceCreateResult`).

Consecuencias en el árbol con el merge: Express sirve la **primera** ruta registrada y deja la otra inalcanzable; `AdminCatalogsModule` figura antes que `BillingModule` en `app.module.ts` (líneas 209 y 219), por lo que probablemente la mía tapa la de dev (orden de escaneo de Nest, no probado). Además el `operationId` de Swagger y de `RouteIndexService` (`<Controlador>_<handler>`) sale repetido y los esquemas Swagger de los DTO se pisan.

Resolución:

1. Borrar `src/modules/admin_catalogs/` entero y quitar `AdminCatalogsModule` (import línea 53 y uso línea 209) de `src/app.module.ts`.
2. Añadir a `billing/controllers/admin-service-catalog.controller.ts` un `@Get('scopes')` **declarado antes de `@Get(':id')`**, con `scopes()` en `billing/services/admin-service-catalog.service.ts` (usa `PracticesRepository.findByTenant`, ya inyectado en :79). Sin esto el front (`catalog-editor.client.ts:40`) recibe 400 por `ParseUUIDPipe`. Llevar la lógica de `admin_catalogs/services/admin-service-catalog.service.ts:94-115` y el `AdminServiceScopesDto`, y su spec.
3. Pasar mis pruebas que dev no tenga (precio 0 → 422, práctica ajena → 404, repetición idéntica → 200) a `admin-service-catalog.controller.http.spec.ts` de dev, sin debilitar las suyas. Comparar antes: la mía tiene 446 líneas de servicio contra 342 de dev.
4. Mover el texto de `admin_catalogs/README.md` (tabla de rutas, auditoría) al README de `billing/`.

### Glosario — ya en dev

`terminology/controllers/admin-glossary.controller.ts:81` (`@Controller('admin/catalogs/glossary')`): `GET` (:85), `GET :conceptId` (:95), `POST` (:111), `PATCH :conceptId` (:130), `POST :conceptId/deactivate` (:148), `POST :conceptId/reactivate` (:172). Es exactamente el contrato H3 §3. Detalle que el front debe respetar: **escribir exige `SUPERADMIN` de plataforma** (`requirePlatformScope`, líneas 64-76 del controlador); un `SECURITY_ADMIN` de organización recibe 403. `catalog-editor/glossary` debe mostrar la pestaña en solo lectura (o el estado S5 «sin permiso» con próxima acción) a quien no sea plataforma.

### Reporte contable — nada en ningún lado

`git grep` por `accounting-report|catalogs/accounting` en `origin/dev` y en `ab86fbcda`: vacío. `catalog-editor/accounting/accounting-tab.ts` declara «decisión de negocio pendiente (`DECISION_REQUIRED`)». Se mantiene.

### Front `catalog-editor` — COMPLEMENTO

Dev no tiene pantalla para `/admin/catalogs/*` (`git grep 'admin/catalogs' origin/dev -- src`: vacío; `features/admin/services-catalog` es el catálogo de facturación clínica, otra cosa). El cliente `catalog-editor.client.ts` ya llama a las rutas de dev para glosario y a las comunes de servicios; la única llamada que dev no sirve es `scopes` (se cubre con el punto 2).

---

## (c) `clinical_import` — DUPLICADO de `bulk_import`

Dev: `bulk_import` (`@Controller('admin/bulk-imports')`, `bulk_import/controllers/bulk-import.controller.ts:88`) con 10 tipos, **incluidos los siete `hc-*`** (`schema/clinical-kinds.ts`: `hc-encuentro`, `hc-diagnostico`, `hc-medicacion`, `hc-alergia`, `hc-signo-vital`, `hc-resultado`, `hc-nota`). Mi `clinical_import` define los mismos siete (`clinical-import.schema.ts:185,239,299,338,385,424,518`).

Permiso: dev usa `bulk_import.clinical` (acción `EXECUTE`, `bulk-import.constants.ts:38`, sembrado en `authz/authz.seed.ts:193-203` según `06-cargas-masivas…md:75`); el mío es `SECURITY_ADMIN` fijo y declara que «el permiso fino llega con H5» (`clinical-import.controller.ts` doc de clase).

Mismo estado de colaboradores, los dos en doble: lote en memoria, escritor clínico y resolutores `NotConnected…`. Clases duplicadas por nombre: `ClinicalRecordWriterPort`, `PatientResolverPort`, `InMemoryBatchRepository`, `NotConnectedClinicalWriter`, `NotConnectedPatientResolver`, `BatchView`, `RowIssue`, `ReportRow`, `TemplateFile` (en `bulk_import/ports`, `adapters`, `repositories`, `services`).

Rutas: **sin colisión** (`admin/clinical-imports` vs `admin/bulk-imports`); la duplicación es de función.

Novedad de dev que el README de dev aún no refleja: el modelo ya trae la tabla del lote (`system_ops.bulk_import_batches` y `_batch_rows`, parche `2026-10-31_v4281_cargas_masivas.sql`), así que el repositorio en memoria de dev es el que se va a sustituir; el mío no tiene tabla (crea ninguna, `clinical-import.module.ts`).

Lo único que aporta el mío y dev no tiene (`bulk-import.controller.ts` de dev: 0 `@AccessLogged`):

- `GET admin/clinical-imports/:id/loaded` con `@AccessLogged` (lectura de lo cargado, `clinical-import.controller.ts:274`).
- `resilienceGuard` con `retry` + `withTimeout` del núcleo `common/resilience` (`clinical-import.module.ts`, líneas ~45-75), por encima del plazo propio de dev.
- Una batería de validación (`clinical-import.validator.spec.ts`, `…state.spec.ts`) que puede servir de casos para los `hc-*` de dev.

Resolución:

1. Quitar `ClinicalImportModule` de `app.module.ts` (import línea 52, uso 211) y borrar `src/modules/clinical_import/`.
2. Portar a `bulk_import`: el `@AccessLogged` en la lectura de filas/informe de lotes `hc-*`, y el guard de resiliencia en `services/bulk-import.processor.ts`. Dueño: quien lleve H4 de dev (`06-cargas-masivas-…md`, filas H4.S1–S2).
3. Front: borrar `features/admin/clinical-imports/`, su cliente (`core/data-access/admin-portal/clinical-imports.*`), mock (`core/mock/handlers/clinical-imports.*`), entradas de `app.routes.ts` (import línea 1), `navigation.platform.ts:236` y `navigation.subgroups.ts:334`. La pantalla de dev `features/admin/bulk-imports` ya tiene `GRUPOS_DE_CARGA` y `loadedAt` en sus tipos (`bulk-imports.types.ts:104`).

---

## (d) `ui_visibility` — NUEVO (confirmado)

Búsqueda en `origin/dev` de `ui.?visib|visibilityRule|feature.?flag|screen_access|menu_access` sobre `src` (API) y de `visib|rbac|permission-matrix|feature-flag|menu-access` sobre el árbol del front:

- API: sólo `read_models` — columna `frontend_routes.feature_flag_code` y el puerto `ViewFeatureFlags` con `DisabledViewFeatureFlags` (`read_models/services/view-access.adapters.ts:200-205`: «la API no tiene todavía un proveedor de feature flags»). Es el contrato de acceso de una vista de datos, no reglas SHOW/HIDE por sujeto.
- Front: nada (`conditional-visibility.ts` es de formularios).
- Modelo: sólo `read_models` (`feature_flag_code`).

Rutas `admin/ui-visibility/*` y `me/ui-visibility`: libres en dev. Nombres de clase: sin repetidos.

Oportunidad (no obligación): un adaptador `ViewFeatureFlags` respaldado por `ui_visibility` para que el hueco de `read_models` tenga proveedor. Declararlo como idea, no hacerlo en esta reconciliación.

## (e) `platform_ops/runtime_pieces` — COMPLEMENTO

Mi README lo declara: «Extiende la sonda de vida (`ops_console`) y el registro de herramientas; no los duplica».

- Dev `ops_console`: `GET /admin/ops/instances/liveness` (`ops-liveness.controller.ts`), latidos `POST /internal/ops/heartbeats`, `GET /admin/ops/{readiness,incidents,…,traffic}`. Mi prefijo `admin/ops/runtime-pieces` no choca con ninguna ruta estática de esa lista (la única con parámetro es `incidents/:id`).
- Dev `platform_ops` `tools/` (`tool-catalog.ts`, `tool-health.ts`, `ops-tools.repository.ts`): catálogo de **herramientas de infraestructura** (BD, caché, buscador, almacenamiento…), global (`tenant_id` nulo, `ops-tools.repository.ts:46`). Lo mío descubre **procesos, jobs, consumidores y conectores** del código. Otra capa.
- Tabla compartida `platform_ops.tool_registry`: índice único global en `code` (`SQL/46_platform_ops/04_indexes.sql:24`). Mis filas llevan prefijo `rtp.*` y `tenant_id` de plataforma, así que `findTool` de dev (que filtra `tenantId: null`) no las ve; `INSERT … ON CONFLICT (code) DO NOTHING` es compatible. Sin colisión mientras se mantenga el prefijo.
- Reutilizo `evaluateInstance` y `loadInstanceLivenessEnv` de dev (`ops_console/domain/instance-liveness.ts:380`, `instance-liveness.env.ts:80`): existen.
- Front: dev tiene `features/admin/instances` (liveness y herramientas); mi `portal/probes/runtime-pieces` es otra vista.

Hallazgo **dentro de dev** (no mío, para quien lo reciba): `GET /admin/ops/tools` está declarado dos veces — `ops_console/…/ops-tools.controller.ts` (`@Controller('admin/ops')`, `@Get('tools')`) y `platform_ops/controllers/ops-tools.controller.ts` (`@Controller('admin/ops/tools')`, `@Get()`), ambos registrados (`ops_console.module.ts:43`, `platform_ops.module.ts:30`). Mi módulo no lo agrava.

## (f) Catalogación — NUEVO

- `GET admin/catalog/fit`, `POST …/run`, `POST /internal/catalog/fit/run` (`catalog-fit.controller.ts:44,48,65,105,112`): dev no tiene nada parecido (`git grep 'catalog/fit|FIT-|fit-tick' origin/dev`: vacío). El módulo `admin-catalog.controller.ts` de dev no tiene ruta con parámetro en la raíz de `admin/catalog` (todas son estáticas), así que `fit` no queda tapado.
- `application/catalogacion/*`: mide calidad de la explicación de operaciones/tablas del inventario (numerador y denominador). Dev mide otra cosa: `GET /admin/catalog/coverage` sobre fichas curadas en la BD (`domain/catalog/coverage.ts`). Mismo vocablo «cobertura», distinta fuente; ponerlo en el rótulo de la pantalla.
- `common/seed/catalog/*`: dev no siembra documentación (`git ls-tree origin/dev src/common/seed | grep catal` sólo da catálogos de geografía y afiliaciones). Escribe en `data_catalog.catalog_glossary_terms / _revisions / _lineage_edges`, `catalog_annotations`, etc., que en dev existen **sólo en el modelo** (`git grep` en `src` de dev: ninguna entidad ni consulta, salvo un mensaje en `governance-queue.service.ts:108` que dice «catalog_certifications aún no existe»). Hay que comprobar contra el DDL de `v4281_gobierno_de_datos.sql` que las columnas de mis `SeedTableSpec` (`catalog-seed.types.ts:54-157`) coinciden; dev va a escribir su propio glosario vivo (`admin/catalog/glossary`, 04-catalogo §3.2) sobre las mismas tablas: acordar quién siembra y con qué `origin`.
- Riesgo operativo: FIT-RUT-001/002 comparan rutas del código contra `inventario/`. Mis rutas nuevas (`admin/governance/data-quality/*`, `admin/ui-visibility/*`, `admin/catalog/fit`, `admin/ops/runtime-pieces`, `authz/catalog/modules`) y las que se retiren obligan a regenerar `inventario/endpoints/*.json` y `docs/inventario/`; si no, el primer resultado de la sonda sale en rojo por mi propia entrega.

## (g) Front

### g1. `core/visibility` — NUEVO

Sin equivalente en dev. Toca `navigation.service.ts` (+`mostrar` con `UiVisibilityService`), `app.config.ts`, `app.routes.ts`, `dashboard.*`: son ediciones sobre archivos de dev, no copias. Falla abierto (sin reglas leídas no oculta nada). No colisiona.

### g2. `portal/rbac-matrix` y `GET /authz/catalog/modules`

- Pantalla: dev tiene `portal/governance/access/role-permissions-panel.ts`, que lista por rol sus permisos con `GET /authz/roles/:roleId/permissions` (`authz-admin.controller.ts:97`), y la escritura `PUT /authz/roles/:roleId/permissions` ya existe en dev (`authz/controllers/authz-roles.controller.ts:80`). Mi matriz es por **módulo × acción → roles**, con huecos y cobertura; reutiliza el `PUT` de dev. COMPLEMENTO. Cuidar que `rbac-matrix/role-view-editor.ts` y `permissions/roles/role-permissions-editor.ts` (mío) no sean dos editores del mismo `PUT`.
- API `authz/services/authz-modules-route-inventory.ts` reimplementa la enumeración de rutas con `ModulesContainer`, `ROLES_KEY`, `IS_PUBLIC_KEY`. Dev ya tiene `observability/route-index/route-index.service.ts` (índice método+plantilla por `DiscoveryService`) y `route-metadata.service.ts` (roles / pública por ruta, mismo `ROLES_KEY` y `IS_PUBLIC_KEY`, líneas 10-11). Refactor: inyectar `RouteMetadataService` en vez de recorrer `ModulesContainer`. No cambia el contrato HTTP.
- `GET /authz/catalog/modules`: ruta libre en dev (los controladores de dev bajo `authz` son `authz-admin`, `authz-catalog` —sólo `POST permission-categories` y `POST permissions`—, `authz-governance`, `authz-roles`).

---

## Modelo (`mantra-core-health-model`)

- `HEAD` de la rama == `origin/dev` (`67fb7f1`): sin commits propios; mis cambios están sin commitear.
- Parche mío: `SQL/patches/2026-10-31_ui_visibility.sql` + `salud-db/gen_ui_visibility_patch.py` + módulo 06 regenerado (`02_tables.sql` añade `authz.ui_visibility_elements` y `authz.ui_visibility_rules`; `03_fk_intra`, `04_indexes`, `05_constraints`, `90_fk_deferred`, `diagram_06_authz.puml`, `diagram_33_integrity.puml`, `integrity-matrix.md`).
- Choque de tablas: **ninguno**. Tablas de `authz` en dev: `permission_categories, permissions, roles, role_permissions, user_role_assignments, user_permission_grants, field_permissions, resource_scope_grants, access_policies, clinical_access_grants, service_principals, break_glass_sessions, ip_access_rules, care_relationships, patient_legal_representations`. `git grep 'ui_visibility|visibility_rule|ui_element'` sobre `origin/dev` del modelo sólo coincide en `30_read_models` por `feature_flag_code` (otra cosa). Las tablas de dev que se acaban de añadir (v4.2.81): `data_catalog.quality_*`, `catalog_glossary_*`, `catalog_lineage_edges`, `catalog_stewardships`, `catalog_certifications`, `catalog_change_acknowledgements`, `system_ops.governance_policy_revisions`, `system_ops.bulk_import_batches` y `_rows`, módulo `observability.*`, `telemetry.client_error_events`: ninguna se llama como las mías.
- Fricción previsible (textual, no semántica): `README.md` (lista de parches, línea ~87), `Mantra Core Health Context/SHA256SUMS.txt`, `SQL/_integrity/integrity-matrix.md` y las cabeceras `-- SALUD v4.2.79 → v4.2.81` de `SQL/06_authz/*` cambian a la vez que lo que dev publique después. Al rebasar: no resolver a mano; regenerar con `salud-db/gen_ddl.py`, `gen_integrity.py` y `gen_ui_visibility_patch.py`.
- El patrón de versión es una decisión pendiente: mi parche no sube versión («posterior a v4.2.81»); dev numera los suyos `v4281_*`. Acordar si entra como v4.2.82.
- Los parámetros de la API que dependen del modelo viven en `ui_visibility/entities/*.entity.ts`; no hay entidades de `clinical_import` ni de `admin_catalogs` (no crearon tablas).

---

## Acciones, por orden de dependencia

| # | Acción | Archivos | Verificación |
|---|---|---|---|
| 1 | Retirar `admin_catalogs`; mover `GET scopes` a `billing/` | borrar `src/modules/admin_catalogs/`; editar `src/app.module.ts` (líneas 53, 209), `billing/controllers/admin-service-catalog.controller.ts`, `billing/services/admin-service-catalog.service.ts`, `billing/dto/admin-service-catalog.dto.ts`, su `*.http.spec.ts` | `yarn build`; spec HTTP de `scopes` antes de `:id` |
| 2 | Retirar `clinical_import`; portar `@AccessLogged` y resiliencia a `bulk_import` | borrar `src/modules/clinical_import/`; editar `src/app.module.ts` (52, 211), `bulk_import/controllers/bulk-import.controller.ts`, `bulk_import/services/bulk-import.processor.ts` | specs de `bulk_import` en verde |
| 3 | Privacidad sobre `AuditOversightReadService` | `governance_admin/{services,repositories,controllers}/*privacy*`, `audit/audit.module.ts` (exportar), front `privacy-requests.client.ts` y `portal/privacy/privacy-requests.model.ts` | lista y detalle contra el servicio de dev |
| 4 | Calidad: rótulo «clínicos», `@AccessLogged`, comprobar alcance por organización | `governance_admin/controllers/admin-data-quality.controller.ts`, `repositories/data-quality.repository.ts`, `portal/data-quality/quality-labels.ts`, `portal-nav.ts` | prueba de autorización negativa: `SECURITY_ADMIN` de otra organización |
| 5 | Front: quitar `clinical-imports`; `catalog-editor/glossary` en solo lectura sin plataforma | ver §c y §b | specs del front |
| 6 | `authz-modules-route-inventory.ts` sobre `RouteMetadataService` | `authz/services/authz-modules-route-inventory{,.spec}.ts` | specs de `authz-modules-catalog` |
| 7 | Regenerar inventario y modelo al rebasar | `inventario/`, `docs/inventario/`; en el modelo, `gen_ddl.py` / `gen_integrity.py` | `GET /admin/catalog/fit` sin `FIT-RUT-001/002` por mis rutas |

## No cubierto

- No se ejecutó nada: ni build, ni pruebas, ni la API. El orden de registro de rutas del punto b1 es una inferencia, no una observación.
- No se comparó línea a línea `clinical-import.schema.ts` contra `bulk_import/schema/clinical-kinds.ts`: coinciden los siete tipos y el estado de colaboradores, no las columnas de cada tipo.
- No se verificó contra el guard real si un `SECURITY_ADMIN` acotado a una organización pasa por un controlador `@TenantAgnostic()` (riesgo 2 de a1).
- No se revisó `authz-governance` ni `system_ops/governance-read` (asignados a otros agentes), ni `system_ops/mutability` ni `common/seed/mutability`.
- Las páginas del front del árbol sin commitear (`visibility`, `rbac-matrix`, `probes/runtime-pieces`) se miraron por su cabecera y su cliente, no por su comportamiento.
- No se hizo `git fetch`: `origin/dev` es el que había localmente.

## Decisiones y ambigüedades

- **Quién es dueño de `audit/`** (para añadir conteos por estado a `dsarList`): sin confirmar; supuesto: el dueño del módulo `audit` de dev. A confirmar con el autor de `AuditOversightReadService`.
- **Número de versión del parche de `ui_visibility`**: a confirmar con quien lleve el modelo.
- **Quién siembra `data_catalog.catalog_glossary_*`**: mi semilla o el glosario vivo que dev planea (04-catalogo §3.2). A confirmar con el responsable de gobierno de dev antes de que ambos escriban.
