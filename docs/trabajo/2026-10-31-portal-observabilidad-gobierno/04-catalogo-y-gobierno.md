# 04 — Catalogación de datos y GOBIERNO DE DATOS (nivel Atlas Admin Portal)

- Fecha: 2026-10-31 · Peldaño: `DISCOVERED` (sólo lectura de código en los tres repos; nada se ejecutó, ninguna base levantada). Rama de trabajo `claude/busy-dijkstra-5apd55` en los tres repos.
- Rutas: `MODEL/` = `/home/user/mantra-core-health-model`, `API/` = `/home/user/mantra-core-health-api`, `FRONT/` = `/home/user/mantra-core-health`. Lo que no se leyó dice **no verificado**.
- Reglas que manda `CONTEXTO-COMUN.md`: la API autoriza; esquema SIEMPRE en el modelo (`.puml` → `SQL/` → `gen_entities.py` → API); `null` ≠ 0; 9 estados `ViewState`; evidencia UI → request → response → persistencia → recarga → UI contra Postgres real; dos PRs (dev y test) por franja.
- Este archivo es el único que escribe este frente. No se tocó código.

---

## 0. Hallazgos de partida (leer primero)

1. **Hay dos catálogos que no se hablan.** `admin/portal/*` sirve un **inventario estático en JSON** (`API/inventario/**`, leído por `InventoryRepository`, `API/src/modules/data_catalog/infrastructure/repositories/inventory.repository.ts:44-166`; sin inventario responde 503, `:70`). `admin/catalog/*` es el **catálogo vivo**: un escaneo de `pg_catalog` (`scan.queries.ts:26-74`) alimenta `data_catalog.catalog_objects/columns/change_events`, y encima viven fichas, revisiones y evidencia. El README del módulo lo dice textual: «dos mitades que no se mezclan» (`API/src/modules/data_catalog/README.md:3-6`). Atlas tiene **una** vista; acá el front tiene dos entradas de menú (`FRONT/src/app/core/navigation/navigation.platform.ts:121` «Catálogo de datos» y `:133` «Portal de inventario»).
2. **El gobierno de datos existe como tablas pero no como producto.** `system_ops` tiene 30 tablas (clasificaciones, dominios, registro de entidades y campos, políticas de escritura/retención/anonimización/residencia, legal holds, cifrado, incidentes) y su API **sólo escribe**: `grep "@Get(" API/src/modules/system_ops` devuelve vacío; todas las rutas son `POST/PATCH` con `@Roles('SECURITY_ADMIN')` (`governance-catalog.controller.ts:53-160`, `legal-hold.controller.ts:43,60`, `residency.controller.ts:38-73`). Nadie puede **ver** una política, un dominio o el `governance_change_log`.
3. **El contrato H4 anterior quedó sólo en papel.** `FRONT/docs/trabajo/2026-10-30-perfil-admin-medicion-gobierno/contratos/H4-gobernanza.md:3` dice «Rama API: `claude/stoic-johnson-4vl5bf` (sin commit)» y «sin verificar contra PostgreSQL real». Verificado acá: en `API/` el clon sólo tiene `origin/master` y `origin/claude/busy-dijkstra-5apd55` (`git branch -r`); los archivos que el contrato nombra (`system_ops/controllers/governance-read.controller.ts`, `data_catalog/application/catalog-insights.service.ts`, `domain/catalog/governance-insights.ts`) **no existen** en el árbol y `grep -rn "pii/summary\|quality/rules\|filter-catalog\|linaje/nodos" API/src --include=*.controller.ts` devuelve vacío. En `FRONT/`, `git log origin/dev..origin/claude/stoic-johnson-4vl5bf -- src/app/features/admin/portal src/app/core/data-access` devuelve vacío: esa rama no agrega nada sobre `dev` en el portal. **Conclusión: todo lo de H4 hay que construirlo; su diseño de rutas se reaprovecha (§4).**
4. **Clasificación PII automática ya existe y es seria**: tabla de reglas con los 18 identificadores de Safe Harbor (`API/src/modules/data_catalog/domain/classification/classification.rules.ts:5-11`), umbral de certeza 0.9 (`:33`), versión `catalog-classifier/v1` (`:36`), «nunca baja un nivel ni pisa lo manual» (`catalog-classification.service.ts:52-62`). Lo que falta es la **vista transversal** (qué columnas son personales en toda la base) y el **puente** con el registro declarado `system_ops.field_registry` (hoy vacío por diseño: nadie lo pobló).
5. **Calidad de datos de VALORES no existe en la plataforma.** Hay tablas de calidad **por dominio** (`lakehouse.lakehouse_quality_rules/runs/issues`, `MODEL/SQL/63_lakehouse/02_tables.sql:132-167`; `health_data.health_data_quality_*`, `MODEL/SQL/52_health_data/02_tables.sql:302-367`, acotadas a `tenant_id`) y sólo `POST` para correrlas (`lakehouse.controller.ts:180`). No hay reglas declarativas sobre tablas del catálogo, ni worker, ni incidencias con ciclo de vida. Es el hueco más grande.
6. **Dos roles para lo mismo**: `GOVERNANCE_ADMIN` lo siembra `data_catalog` (`API/src/modules/data_catalog/data_catalog.roles.ts:22`) y `DATA_GOVERNANCE_ADMIN` lo siembra `authz` (`API/src/modules/authz/authz.platform-roles.seed.ts:133-138`) y lo exige `cross_store_consistency` (`cross-store-admin.controller.ts:75`). Hay que unificar antes de repartir permisos nuevos (decisión D-1, §9).
7. **La bitácora no guarda el `requestId`**: `audit.audit_log.correlation_id` existe en el DDL (`MODEL/SQL/10_audit/02_tables.sql:17`, índice parcial `04_indexes.sql:17`) pero la entidad del ORM no lo mapea (`grep correlation API/src/modules/audit/entities/audit_log.entity.ts` vacío). La traza por petición que pide Atlas depende de la franja de observabilidad (otro frente); acá sólo se consume.

---

## 1. Inventario de lo que ya existe, por capa

### 1.1 Modelo (`MODEL/SQL/`)

Pipeline obligatorio: `.puml` → `SQL/` → BD → ORM, «solo en esa dirección» (`MODEL/SQL/README.md:3-10`). Las tablas e índices se declaran en el `.puml` del módulo con `entity` + bloque `<<INDEX_SET>>` (`MODEL/Mantra Core Health Context/modules/diagram_67_data_catalog.puml:15-58`); generadores en `MODEL/salud-db/gen_ddl.py`, `gen_entities.py`, `gen_integrity.py`. Inmutabilidad por trigger `integrity.forbid_mutation` (`MODEL/SQL/_integrity/00_integrity_functions.sql:7`), aplicada p. ej. a `catalog_change_events`, `catalog_annotation_revisions`, `catalog_review_decisions`, `catalog_evidence_items` (`67_data_catalog/05_constraints.sql:59-92`). Versión vigente: SALUD v4.2.79 (`SQL/_generation_report.md:1`).

| Schema | Tabla (columnas clave, ruta:línea) | Para qué sirve al gobierno |
|---|---|---|
| `data_catalog` | `catalog_scan_runs` (status, idempotency_key, lease_owner/expires, contadores objects_*/columns_*, snapshot_hash, error_*; `67_data_catalog/02_tables.sql:5-41`). Un activo por fuente: `ux_data_catalog_scan_runs_one_active` (`04_indexes.sql:7`); idempotencia por usuario+clave (`:9`) | Jobs del catálogo, deriva de esquema |
| | `catalog_objects` (schema_name, object_name, object_kind, observation_status, estimated_rows, total_bytes, primary_key_columns jsonb, technical_hash, first/last_seen_scan_id, not_observed_since; `:43-67`); identidad única `(source_code, schema_name, object_name)` (`04_indexes.sql:11`) | Inventario real de tablas/vistas |
| | `catalog_columns` (native_type, is_nullable, is_primary_key, is_unique, **foreign_key jsonb**, column_comment, observation_status; `:69-95`) | Linaje por FK, base de reglas de calidad |
| | `catalog_change_events` (scan_run_id, object_id, column_id, change_kind, before_json/after_json; `:97-107`; UPDATE prohibido `05_constraints.sql:62-65`) | Deriva de esquema real |
| | `catalog_annotations` (business_name, definition, purpose, existence_rationale, row_grain, producers/consumers jsonb, **business_owner, data_steward, technical_owner** `:125-127` (texto libre), unit, value_domain, null_semantics, **sensitivity** `:131`, **review_status** `:133`, origin, current/approved_revision_no, approved_by/at; `:109-145`); una por objeto y una por columna (`04_indexes.sql:21-23`) | Ficha curada, clasificación, dueños |
| | `catalog_annotation_revisions` (content_json, content_hash, origin, submitted_status, change_reason, author; `:147-159`; inmutable) · `catalog_review_decisions` (decision, comment, reviewer, decided_at; `:161-170`; inmutable) · `catalog_evidence_items` (kind, reference, excerpt, source_revision; `:172-183`; inmutable) | Revisión con evidencia, historia |
| | `catalog_operations` (operation_key, http_method, route_template, module_code, controller/handler, is_public, required_roles jsonb, risk_level, observation_status; `:185-208`) · `catalog_operation_impacts` (operation_id, object_id, column_id, access_kind, confidence, call_path jsonb; `:210-226`) | Linaje endpoint → tabla; «systems/endpoints» de Atlas |
| | `catalog_processes` / `catalog_process_steps` / `catalog_process_step_operations` (`:228-269`) | Procesos/flujos |
| `system_ops` | `data_classifications` (code, rank, is_pii, is_phi, handling_rules_json; `11_system_ops/02_tables.sql:5-20`) | Escala de sensibilidad (los `code` coinciden con `SENSITIVITIES` del API, `catalog.constants.ts:51-68`) |
| | `data_domains` (code, name, description, **owner_team**; `:22-34`) | Dominios de datos |
| | `entity_registry` (schema_name, table_name, **domain_id**, classification_id, is_append_only, is_soft_delete, has_history, **retention_policy_id**, partition_spec_id, **write_policy_id**, owner_team, contains_pii/phi; `:36-59`) · `field_registry` (entity_registry_id, column_name, classification_id, is_pii/phi, masking_strategy_concept_id, anonymization_rule_id; `:61-77`) | Registro **declarado** (vs. observado) |
| | `write_policies` (`:79-97`), `retention_policies` (retention_period_days, legal_basis, disposition, jurisdiction; `:99-114`), `anonymization_rules` (`:116-128`), `retention_executions` (status, total_scanned/deleted/anonymized/archived, error_text; `:130-145`) | Políticas y su aplicación medible |
| | `governance_change_log` (target_type, target_id, action_concept_id, changed_by, previous/new_snapshot_json, reason; `:147-159`). Índices sólo por acción, usuario y BRIN fecha (`04_indexes.sql:91-97`): **no hay índice por objetivo** | Auditoría de cambios de gobierno |
| | `record_revisions` (`:161-174`), `draft_records` (`:176-195`) | Revisión de filas afectadas por retención |
| | `data_residency_policies` (`:197-216`), `tenant_residency_bindings` (`:218-233`), `legal_holds` (`:235-251`), `backup_policies` (`:253-271`), `restore_test_runs` (`:273-287`), `cross_border_transfer_events` (`:289-301`), `encryption_keys` (`:471-491`), `key_rotation_events` (`:493-504`), `security_incidents` (`:506-528`), `breach_notifications` (`:530-549`) | Políticas de residencia, retención legal, cifrado, incidentes |
| `audit` | `audit_log` (user_id, tenant_id, action, entity, entity_id, outcome, ip, session_id, **correlation_id**, previous_hash/record_hash; `10_audit/02_tables.sql:5-24`) · `data_access_log` (patient_profile_id, purpose, legal_basis, resource_type/id, action; `:26-39`) · `dsar_requests` (type, status, jurisdiction, requested/completed_at, result_file_id; `:41-56`) · `analytics_governance_log` (actor, action, export_reference, affected_subject_count, query_hash, approval_status; `:425-437`) · 70+ `*_history` | Auditoría de acceso a datos sensibles, DSAR, exportaciones |
| `read_models` | `read_model_definitions` (schema/object, owning_module, refresh_mode, maximum_staleness_seconds, **contains_pii/phi**, security_barrier_required, rls_required, definition_hash, version; `30_read_models/02_tables.sql:48-73`) · **`read_model_dependencies`** (source_schema/object, dependency_type, selected_columns_json; `:75-86`) · `frontend_routes` (`:24-46`) · `frontend_page_views` (route ↔ read model; `:87`) · `read_model_refresh_runs` (`:263-277`) | Linaje tabla → read model → pantalla; frescura |
| `lakehouse` | `lakehouse_quality_rules/runs/issues` (`63_lakehouse/02_tables.sql:132-167`), `lakehouse_lineage_edges` (`:169-179`), `data_products`, `dataset_release_*` | Calidad y linaje **del lago**, por tenant |
| `reporting` | `report_data_sources` (read_model_definition_id, view_name, row_security_json; `39_reporting/02_tables.sql:5-22`) · `report_definitions` (required_permission_id, is_public, current_version; `:24-44`) · `report_versions` (`:46-60`) · `report_executions`, `dashboards` | Readiness de reportes |
| `authz` | `permissions` (resource, is_dangerous, requires_reason, requires_step_up, touches_clinical_data; `06_authz/02_tables.sql:19-47`) · `roles` (`:49-67`) · `role_permissions` (`:69-84`) · `user_role_assignments` (`:86-103`) · `user_permission_grants` (`:105-123`) · `field_permissions`, `access_policies`, `break_glass_sessions` | Usuarios, roles, permisos |
| `consent` | `processing_purposes`, `processing_legal_bases`, `consents`, `consent_events` (`07_consent/02_tables.sql:5-222`) | Base legal del tratamiento (lectura para la ficha PII) |
| `platform_ops` | `operational_readiness_reviews` / `readiness_review_findings` (`46_platform_ops/02_tables.sql:295-332`), `tool_registry` (`:24-43`), `health_checks/_runs`, `service_components` | Release readiness, herramientas |
| `qa_lab` / `qa_execution` | `test_suites`, `test_runs`, `test_case_results`, `test_defects` (`36_qa_lab/02_tables.sql:23-246`); `execution_targets`, `execution_plans`, `plan_approvals`, `plan_events` (`68_qa_execution/02_tables.sql:5-76`) | QA suites/runs/planes con aprobación |
| `cross_store_consistency` | `reconciliation_runs/items` (`62.../02_tables.sql:81-107`), `projection_drift_events` (`:108`), `deletion_requests/targets/executions/verifications` (`:135-184`) | Deriva entre almacenes, borrado verificado |

### 1.2 API (`API/src/modules/`)

**`data_catalog`** (3 controladores, 37 rutas, `README.md:17`):

- Lectura `@Roles(...PORTAL_READ_ROLES)` = `SECURITY_ADMIN, PLATFORM_ADMIN, GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN, DPO, AUDITOR, DATA_STEWARD` (`data_catalog.constants.ts:8-16`); escritura `CATALOG_WRITE_ROLES` = `GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN, DATA_STEWARD` (`:25-29`). Los cinco roles de gobierno se siembran de ámbito `GLOBAL` y **se asignan sin tenant** (`data_catalog.roles.ts:11-13,20-56`). `@TenantAgnostic()` en ambos controladores (`admin-catalog.controller.ts:77`, `admin-portal.controller.ts:57`). `SUPERADMIN` es comodín sólo de plataforma (`API/src/common/auth/roles.guard.ts:82-86`).
- `admin/catalog`: `GET schemas` (:88), `objects` (:99; filtros `schema, kind, observationStatus, reviewStatus|'NONE', q, missing`, `catalog-request.dto.ts:63-99`), `objects/:id` (:109), `/columns` (:121), `/evidence` GET/POST (:131/:146), `columns/:id/evidence` (:161/:177), `/history` (:193), `/changes` (:203), `/impact` (:213; `direction up/down/both`, `depth`, dto `:114-122`), `PUT objects/:id/annotation` (:229; 409 `CONCURRENCY_CONFLICT` por `expectedVersion`, 422 `VALIDATION_FAILED`), `PUT columns/:id/annotation` (:257), `POST annotations/:id/review` (:287; 403 `SELF_REVIEW`: quien escribe no aprueba), `POST classification/run` (:318), `GET permission-drift` (:334), `GET coverage` (:347; dimensiones `technical, semantic, ownership, sensitivity, review`, `domain/catalog/coverage.ts:110-123`), `GET scans`/`scans/:id` (:357/:367), `POST scans` (:380; 202, `Idempotency-Key` obligatoria 8–128, `:383-388`). Toda mutación lleva `@Audited` (p. ej. `:225-228`, `:375-379`); el candado `audit-trail-coverage.spec.ts:19-25` exige `@Audited` o `@NotAudited` en cada `POST/PUT/PATCH/DELETE`.
- `admin/portal` (inventario estático): `version` (:64), `operaciones[/:id[/arbol]]` (:71-92), `flujos/mapa|hallazgos[/:id]|:codigo[/grafo]` (:104-150), `catalogo/tablas[/:schema/:tabla]` (:159-166), `catalogo/deriva` (:175; sale de `catalogo/indice.json`, `portal-inventory.service.ts:389-391`), `linaje` y `linaje/tablas/:schema/:tabla` (:184-191), `glosario` (:200; `inventario/glosario.json`).
- Interno: `POST /internal/catalog/scans/run-next` y `/inventory/import` con `@Roles('SYSTEM')` (`internal-catalog.controller.ts:33-34,62-63`).
- Servicios: escaneo con lease de 300 s y «a lo sumo uno activo por fuente garantizado por índice, no por `if`» (`catalog-scan.service.ts:56-66`); excluye `pg_*`, `information_schema`, `_*` (`:37`); sonda cada 15 min (`catalog.constants.ts:164`). Clasificación: `CONFIDENCE` 0.95/0.9/0.5, umbral 0.9 (`classification.rules.ts:20-33`); escala `UNKNOWN < ANONYMIZED < PUBLIC < INTERNAL < PSEUDONYMIZED < PERSONAL < PHI_IDENTIFIER < PHI_SENSITIVE < PHI_SPECIAL < CREDENTIAL` (`catalog.constants.ts:56-68`); estados de ficha `AUTO_DETECTED, DRAFT, NEEDS_REVIEW, APPROVED, REJECTED` (`:26-34`). Deriva de permisos: rutas registradas vs roles sembrados vs `authz.roles` (`permission-drift.service.ts:27-31`), sobre `RouteMetadataService` (`API/src/observability/route-index/route-metadata.service.ts:14-24`).
- Worker: `API/src/worker-data_catalog.ts:1-4` arranca `DataCatalogWorkerModule`; `scan-tick.job.ts:11,50` llama `run-next` cada 10 s y, tras un escaneo `SUCCEEDED`, importa el inventario.

**`system_ops`** (`admin/governance`, todo `SECURITY_ADMIN`, sólo escritura): `POST entity-registry` (`governance-catalog.controller.ts:53`; DTO con `ownerTeam, containsPii, containsPhi, historyTable`, `dto/governance-catalog.dto.ts:215-240`), `POST write-policies` (:72), `PATCH entity-registry/:id/write-policy` (:89), `POST retention-policies` (:107), `PATCH entity-registry/:id/retention` (:124), `POST anonymization-rules` (:142), `PATCH field-registry/:id` (:159); `POST legal-holds` / `:id/release` (`legal-hold.controller.ts:43,60`); `POST residency-policies`, `tenant-residency-bindings`, `cross-border-transfers` (`residency.controller.ts:38-73`); `POST drafts`, `drafts/:id/publish` (`draft.controller.ts:38,55`); `POST /internal/governance/retention-executions/run` (`retention-execution.controller.ts:32`; excluye legal holds activos y audita filas en `record_revisions`, `retention-execution.service.ts:50-62`); evaluaciones/hallazgos/remediación (`assessment.controller.ts:57-168`). Cada mutación escribe `governance_change_log` vía `repo.recordChange` (`governance-catalog.service.ts:135,188,223,259,300,333,361`). **Cero `@Get`.**

**`audit`**: `GET /audit/log` y `/audit/data-access` con `AUDIT_READ_ROLES = AUDITOR, DPO, SECURITY_ADMIN` (`audit-query.controller.ts:20,40,54`), `@PlatformTenantOptional` (:36), cada lectura sellada en `data_access_log` (:29-30). Filtros: `from, to, userId, tenantId, limit, cursor, result, action, method, route, entity, operation, resourceType, patientProfileId` (`dto/audit-query.dto.ts:49-157`); **no hay `entityId` ni `requestId`**. Mutaciones: `POST events`, `history/:entity/:id`, `integrity/verify`, `retention/apply`, `anomaly/scan` (`audit.controller.ts:69-174`); DSAR sólo `POST/PATCH` (`privacy.controller.ts:39,56`), exportación `POST /compliance/audit-export` (`compliance.controller.ts:29`).

**`authz`**: `GET /authz/roles` (`authz-roles.controller.ts:50`), `POST` (:63), `PUT :roleId/permissions` (:80), `PUT field-permissions` (:98); `GET users/:userId/role-assignments` (`authz-admin.controller.ts:54`), `DELETE` (:72), `GET permissions` (:89), `GET roles/:roleId/permissions` (:97), `GET internal-users` (:108); grants (`authz-grants.controller.ts:43-81`); PDP `POST decisions/evaluate` (`authz-pdp.controller.ts:58`). Todo `SECURITY_ADMIN`.

**Otros**: `consent` sólo `POST` + `GET /consent/me/*` (paciente). `lakehouse`: `POST datasets/:id/quality-runs` (`lakehouse.controller.ts:180`, `DATA_STEWARD|SYSTEM|PLATFORM_ADMIN`), `GET research/dataset-releases/expired` (`research.controller.ts:152`). `cross_store_consistency`: admin sólo `POST` (`cross-store-admin.controller.ts:74-231`). `qa_lab` lectura `GET /admin/qa/environments|suites[/:id]|runs[/:id]|defects|flows[/:id]` (`qa-lab-read.controller.ts:89-145`; `QA_LAB_READ_ROLES = QA_ADMIN, QA_ENGINEER, RELEASE_MANAGER, PLATFORM_ADMIN` :27-32); `qa_execution` `GET /admin/qa/targets|plans[/:id]`, `POST plans|preflight|approvals|cancel` (`qa-execution.controller.ts:63-173`). **No existe «stress»** (`grep -ri stress` en ambos módulos: vacío). `platform_ops` sólo `POST` (`platform-ops.controller.ts:83-385`, `readiness-reviews/:id/complete` :322). `ops_console`: `GET /admin/ops/readiness|incidents|deployments|change-requests|slos|backups|traffic|traffic/endpoints` (`ops-console.controller.ts:32-102`; `OPS_READ_ROLES = PLATFORM_ADMIN, SRE, SECURITY_ADMIN, RELEASE_MANAGER` :14-18). `reporting` sólo `POST` (`reporting.controller.ts:67-294`). `read_models`: `GET read-models/health` (`read-model-definitions.controller.ts:90`), resto `POST`; **ninguna lectura de `read_model_dependencies`**. `search_platform`: `POST /search/:index/_search` (`search-platform.controller.ts:71`) es un índice de documentos, no un buscador del portal. Sesiones: `GET /iam/users/:id/sessions` (`iam-users.controller.ts:249`), `GET me/sessions` y `POST me/sessions/:id/revoke` (`iam-account-security.controller.ts:62,76`), `POST sessions/purge` (`iam-auth.controller.ts:521`).

### 1.3 Front (`FRONT/src/app/`)

- Montaje: `superadmin/data-catalog` → `features/admin/data-catalog/data-catalog.ts` (`app.routes.ts:237-238`; ficha `superadmin/data-catalog/:objectId` `:1042-1046`); `superadmin/portal` → `PORTAL_RUTAS` (`:240`, `:1281`); `superadmin/qa-lab` (`:245`). Roles del menú para catálogo y portal: `SECURITY_ADMIN, PLATFORM_ADMIN, GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN, DPO` (`navigation.platform.ts:126,138`) — **faltan `AUDITOR` y `DATA_STEWARD`**, que la API sí admite (`PORTAL_READ_ROLES`); ocultar no es seguridad, pero un custodio no encuentra su herramienta.
- Portal (`features/admin/portal/portal.routes.ts:56-134`): hub (`hub/portal-hub.ts:36` → `/admin/portal/version`), `systems/operations[/:id]`, `systems/flows[/diagram]`, `systems/drift` (`drift-page.ts:122` → hallazgos del inventario), `systems/review` (`review-page.ts:106-110` → `listObjects({reviewStatus:'NEEDS_REVIEW'})`), `processes[/:code]`, `catalog/tables[/:schema/:table]` (`tables-page.ts:96` → inventario estático), `catalog/domains` (`domains-page.ts:70,127` → glosario JSON + linaje), `lineage` (`lineage-page.ts:96,129`), `schemas` (`schemas-page.ts:132,140` → `admin/catalog/schemas` + `coverage`), y grupo «Gobierno y acceso» (`governance/governance.routes.ts:10-27`): `governance/audit` (`audit-page.ts:153,159` → `/audit/log`, `/audit/data-access`), `governance/users` (`access-page.ts:115,144` → `/authz/internal-users`, roles), `governance/permission-drift` (`permission-drift-page.ts:135`). Navegación única en `portal-nav.ts:26-147`; buscador `portal-search.ts:23` busca **sólo en `PORTAL_NAV`** (pantallas), no en datos.
- Catálogo vivo (`features/admin/data-catalog/data-catalog.ts:111` pestañas; `:235-274` schemas, cobertura, objetos) y ficha (`object-detail/catalog-object-detail.ts`, `annotation-dialog.ts`, `evidence-dialog.ts`).
- Clientes: `core/data-access/admin-portal/data-catalog.client.ts:99-229` (cubre las 20 rutas de `admin/catalog`), `portal.client.ts:41-108` (16 rutas de `admin/portal`), `audit/audit.client.ts:42,51`, `authz-admin/authz-admin.client.ts:80-138`. `ViewState` se usa en 20 archivos de `portal/` + `data-catalog/`. ECharts vive en `shared/components/organisms/chart-panel/` (`chart-option.builder.ts`, `chart-color.ts`).
- **No existe** `features/admin/access-governance/` (el grupo de gobierno vive dentro de `portal/governance/`).

---

## 2. Matriz Atlas → AloVida

Rutas de Atlas según `CONTEXTO-COMUN.md:21` (lo que hace cada pantalla se toma de las citas de Atlas en `H4-gobernanza.md:22-31` y del nombre de la ruta; el repo de Atlas no está en esta máquina → su comportamiento interno queda **no verificado**). Estado: **EXISTE** = modelo + API + front usable hoy; **PARCIAL** = alguna capa falta o está incompleta; **FALTA** = nada usable.

| # | Pantalla Atlas | Qué hace | Equivalente AloVida (modelo / API / front) | Estado | Qué falta exactamente |
|---|---|---|---|---|---|
| 1 | `systems/endpoints` | Lista todos los endpoints con riesgo, roles, tablas tocadas y pruebas | M: `catalog_operations`, `catalog_operation_impacts` (`67/02_tables.sql:185-226`) · A: `GET /admin/portal/operaciones[/:id[/arbol]]` (`admin-portal.controller.ts:71-92`) · F: `portal/operations/*` (`portal.routes.ts:64-74`) | **EXISTE** | Datos vienen del JSON estático, no de `catalog_operations` (la importación los carga, pero nadie los lee). Fuente única: servir desde la tabla (H2) |
| 2 | `data-catalog/tables` | Tablas con ficha, columnas, dueños | M: `catalog_objects/columns/annotations` · A: `GET /admin/catalog/objects…` (`admin-catalog.controller.ts:99-121`) y `GET /admin/portal/catalogo/tablas` (:159) · F: `data-catalog.ts` **y** `portal/tables/*` | **PARCIAL** | Dos pantallas para una cosa; la del portal lee el JSON (modelo) y la otra la base (observado). Unificar en una ficha con pestañas «Observado / Declarado / Ficha / Columnas / Linaje / Calidad / Historia» |
| 3 | `qa/suites`, `qa/runs` | Suites, corridas, defectos | M: `qa_lab.*` · A: `GET /admin/qa/suites|runs|defects` (`qa-lab-read.controller.ts:96-128`) · F: `features/admin/qa-lab/` | **EXISTE** | Nada para este frente; roles distintos (`QA_LAB_READ_ROLES`): el portal debe enlazar, no duplicar |
| 4 | `qa/stress` | Pruebas de carga | A: `grep -ri stress` vacío en `qa_lab`/`qa_execution` | **FALTA** | Fuera de alcance de gobierno; lo más cercano es `qa_execution.execution_plans` con aprobación de riesgo (`68/02_tables.sql:29-76`). Dejar enlace «no disponible» con motivo (S3) |
| 5 | `audit` | Bitácora con filtros por actor, recurso, acción, fecha, `requestId` | M: `audit.audit_log` · A: `GET /audit/log`, `/audit/data-access` (`audit-query.controller.ts:40,54`) · F: `portal/governance/audit/audit-page.ts` | **PARCIAL** | Falta filtro `entityId` (recurso concreto) y `GET /audit/log/filter-catalog`; `requestId` NO MEDIDO (`correlation_id` sin mapear, §0.7). Roles: `GOVERNANCE_ADMIN`/`DATA_*` reciben 403 (decisión D-2) |
| 6 | `review-queue` | Cola única de lo que espera decisión | A: sólo fichas `NEEDS_REVIEW` vía `listObjects` · F: `portal/review/review-page.ts:106` | **PARCIAL** | Cola transversal: fichas de objeto **y columna**, términos del glosario, revisiones de política, certificaciones, incidencias HIGH abiertas, con «asignado a mí». Endpoint agregador `GET /admin/governance/review-queue` (H2) |
| 7 | `systems/tools` + salud | Registro de herramientas/instancias y su estado | M: `platform_ops.tool_registry`, `health_checks` · A: sin `@Get` (`platform-ops.controller.ts` sólo POST); `GET /admin/ops/readiness` (`ops-console.controller.ts:32`) | **PARCIAL** | Frente de observabilidad (descubrimiento 03/04). Acá sólo se enlaza |
| 8 | `settings/users` | Usuarios internos y sus roles | A: `GET /authz/internal-users`, role-assignments (`authz-admin.controller.ts:54-108`) · F: `governance/access/access-page.ts` | **EXISTE** | Añadir pestaña «Sesiones» (fila 29) |
| 9 | `settings/roles` | Roles y permisos por rol | A: `GET /authz/roles`, `GET roles/:id/permissions`, `PUT` (`authz-roles.controller.ts:50-98`) · F: `access/role-permissions-panel.ts` | **EXISTE** | Mostrar `permissions.is_dangerous/requires_reason/requires_step_up` (`06/02_tables.sql:27,38-39`) como columnas de riesgo |
| 10 | `settings/catalog-sync` | Pedir/ver sincronización del catálogo | M: `catalog_scan_runs` · A: `GET/POST /admin/catalog/scans` (`admin-catalog.controller.ts:357-380`) · F: `data-catalog.ts` (pestaña escaneos, no verificado el botón) | **PARCIAL** | Pantalla «Jobs» (fila 25) con pedir escaneo (Idempotency-Key), ver lease, contadores, errores, y correr clasificación (`POST classification/run` :318) |
| 11 | `lineage` | Grafo operación → tabla, dominios | A: `GET /admin/portal/linaje` (:184) · F: `portal/lineage/lineage-page.ts` | **PARCIAL** | Grafo completo paginado `linaje/nodos`, `linaje/aristas` (H4 §3.4, no construido) |
| 12 | `lineage/official` | Linaje aprobado (declarado) | M: `read_model_dependencies` (`30/02_tables.sql:75-86`), `frontend_page_views` (:87), `lakehouse_lineage_edges` · A: ninguna lectura | **FALTA** | Tabla `catalog_lineage_edges` con origen (FK observada / código / read model declarado / manual) y aprobación (§3.6); `GET /admin/governance/lineage/official` |
| 13 | `lineage/impact` | Impacto de cambiar una tabla/columna | A: `GET /admin/catalog/objects/:id/impact` (:213, por FK observadas) + `catalog_operation_impacts` · F: en la ficha | **PARCIAL** | Cruzar FK + operaciones + read models + pantallas (`frontend_page_views`) + reportes (`report_data_sources.read_model_definition_id`) en un solo árbol: tabla → read model → pantalla/reporte |
| 14 | `lineage/nodes` | Nodo con sus aristas | A: `linaje/tablas/:schema/:tabla` (:191) sólo tablas | **PARCIAL** | `GET …/lineage/nodes/:id` para operación, tabla, read model, pantalla, dominio |
| 15 | `governance` (overview) | Postura global: cobertura, PII, políticas, incidencias | A: `GET /admin/catalog/coverage` (:347; 5 dimensiones) · F: `schemas-page.ts:140` | **PARCIAL** | Tablero de gobierno (una tarjeta, pestañas): cobertura, PII por sensibilidad, políticas activas vs. aplicadas, incidencias abiertas, puntaje de calidad por dominio. Todo con `notMeasured` |
| 16 | `governance/pii` | Registro de datos personales por tabla/columna | M: `catalog_annotations.sensitivity`, `field_registry`, `read_model_definitions.contains_pii` · A: sólo por objeto (`objects/:id/columns`) | **FALTA** | `GET /admin/catalog/pii/summary`, `pii/columns` (H4 §3.2) + conciliación observado vs declarado (`registryMarksPersonal`) + acción «declarar en `field_registry`» |
| 17 | `governance/policies[/:id]` | Políticas con versión, estado, alcance | M: `write/retention/anonymization/residency_policies`, `entity_registry` bindings · A: sólo `POST/PATCH SECURITY_ADMIN` | **FALTA** | Lectura `GET /admin/governance/policies[/:type/:id]` (H4 §3.1), **versionado y aprobación** (`governance_policy_revisions`, §3.4), `appliedTo` medible, `GET change-log` |
| 18 | `business-metadata/domains` | Dominios con dueño/steward y tablas | M: `system_ops.data_domains` (`11/02_tables.sql:22-34`), `entity_registry.domain_id` · A: ninguna lectura; no hay POST de dominios · F: `catalog/domains` lee etiquetas del linaje JSON | **FALTA** | CRUD de dominios + `catalog_stewardships` (§3.1) + asignar tablas a dominio; vista «Dominios» con dueño, steward, nº tablas, puntaje |
| 19 | `business-metadata/definitions` | Definiciones de negocio por tabla/columna | M: `catalog_annotations.definition/business_name` · A: `PUT annotation` · F: `annotation-dialog.ts` | **EXISTE** | Enlazar definiciones con términos del glosario (fila 20) |
| 20 | `business-metadata/glossary` | Términos ↔ columnas | A: `GET /admin/portal/glosario` (JSON estático, :200) · F: `domains-page.ts:70` | **PARCIAL** | Glosario **vivo**: `catalog_glossary_terms` + `_links` (§3.2), revisión y aprobación, enlace término ↔ columna |
| 21 | `reports/readiness` | Qué reportes están listos (fuente certificada, frescura, permisos) | M: `report_definitions`, `report_data_sources`, `read_model_refresh_runs` · A: `reporting` sólo POST | **FALTA** | `GET /admin/governance/readiness/reports` derivado: por reporte → fuente → read model → `maximum_staleness_seconds` vs último refresh, certificación, permiso requerido (§3.9) |
| 22 | `reports[/:id]` | Catálogo de reportes | A: ninguna lectura | **FALTA** | `GET /reporting/definitions[/:id]` (metadatos). Frente de reportería decide si lo asume; acá se consume |
| 23 | `data-quality/rules[/:id]` | Reglas declarativas de calidad | M: nada de plataforma (sólo `lakehouse_*`, `health_data_*` por tenant) · A: nada | **FALTA** | `quality_rules` + `quality_rule_runs` + worker (§3.3); `GET/POST /admin/governance/quality/rules`, `POST rules/:id/run` |
| 24 | `data-quality/issues` | Incidencias con ciclo de vida | — | **FALTA** | `quality_issues` + `quality_issue_events` (§3.3); `GET issues`, `POST issues/:id/acknowledge|resolve|ignore` idempotentes |
| 25 | `jobs` | Corridas de fondo | M: `catalog_scan_runs`, `retention_executions`, `read_model_refresh_runs`, `reconciliation_runs` · A: sólo `GET /admin/catalog/scans` | **PARCIAL** | `GET /admin/governance/jobs` unión tipada (scan, classification, quality, retention, refresh, reconciliation) con estado, lease, duración, error (§3.10) |
| 26 | `alerts` | Alertas de gobierno | M: `security_incidents`, `assessment_findings` · A: nada | **FALTA** | Derivado: incidencias HIGH abiertas, jobs fallidos, deriva nueva, PII sin ficha, políticas vencidas (`valid_to`), legal holds por vencer. Sin tabla nueva en la primera versión |
| 27 | `exports` | Exportar catálogo/PII/auditoría | A: `POST /compliance/audit-export` (`compliance.controller.ts:29`) · M: `analytics_governance_log` (`10/02_tables.sql:425-437`) | **PARCIAL** | `GET /admin/governance/exports/{catalog,pii,policies}.csv` sellados en `analytics_governance_log` (export_reference, query_hash) |
| 28 | `risk-policy/current` | Política de riesgo vigente de QA/release | M: `qa_execution.execution_plans/plan_approvals` · A: `GET /admin/qa/plans` | **PARCIAL** | No hay «documento de política de riesgo»; se puede mostrar la regla vigente del preflight (`POST plans/preflight`, `qa-execution.controller.ts:95`) como sólo lectura. Decidir con QA |
| 29 | `security/session` | Sesiones activas y revocación | A: `GET /iam/users/:id/sessions` (`iam-users.controller.ts:249`), `GET me/sessions`, `POST me/sessions/:id/revoke` (`iam-account-security.controller.ts:62,76`) | **PARCIAL** | Front en `governance/users` → drawer «Sesiones» por usuario; revocación administrativa no verificada (sólo `me/…/revoke`) |
| 30 | `search` | Búsqueda global en el portal | F: `portal-search.ts:23` busca sólo pantallas | **FALTA** | `GET /admin/governance/search?q=` sobre objetos, columnas, términos, políticas, operaciones, procesos (§3.11) |
| 31 | `roles/permissions` | Matriz rol × permiso | A: `GET /authz/permissions`, `roles/:id/permissions` (`authz-admin.controller.ts:89-97`) · F: `access/permission-catalog.ts`, `role-permissions-panel.ts` | **EXISTE** | Agregar «deriva de permisos» como pestaña (ya existe `permission-drift-page.ts`) |
| 32 | `release-readiness` | Semáforo de release | M: `operational_readiness_reviews/findings` (`46/02_tables.sql:295-332`) · A: sólo `POST …/complete`; `GET /admin/ops/readiness` es la salud técnica | **FALTA** | `GET /admin/governance/readiness/release` derivado: deriva de esquema (change_events sin revisar), deriva de permisos (drift > 0), PII sin ficha aprobada, incidencias HIGH, planes QA sin aprobación, revisión de readiness abierta |
| 33 | `data-catalog` deriva (`catalogo/deriva`) | Modelo vs ORM vs base | A: `GET /admin/portal/catalogo/deriva` (:175) + `objects/:id/changes` (:203) · F: `schemas-page.ts` | **PARCIAL** | Una sola pestaña «Deriva» que una la estática (modelo↔ORM) con la viva (`catalog_change_events` por escaneo) y permita «reconocer» un cambio |

**Conteo: EXISTE 6 · PARCIAL 15 · FALTA 12** (33 filas).

---

## 3. Gobierno de datos: modelo operativo y qué lo soporta

Principio: **observado vs declarado vs aprobado**. El escaneo observa (`catalog_*`), gobierno declara (`system_ops.*`, fichas, políticas) y una segunda persona aprueba (`review_decisions`, revisiones). Nada automático pisa lo manual; nada manual se aprueba a sí mismo (`SELF_REVIEW` ya existe, `admin-catalog.controller.ts:294-296`). Todo DDL nuevo se escribe en el `.puml` del módulo 67 (o 11) y se regenera; abajo va el SQL **resultante esperado**, en el estilo del generador (nombres `pk_`, `ux_`, `ix_`, `brin_`; `row_version`; auditoría `created/updated_by_user_id`).

### 3.1 Dominios, dueños y stewards

- **Existe**: `system_ops.data_domains` (code, name, owner_team), `entity_registry.domain_id/owner_team`, texto libre `business_owner/data_steward/technical_owner` en la ficha (`catalog_annotations:125-127`). Ninguna lectura; ningún `POST` de dominios.
- **Nuevo (módulo 67)**: responsables como **filas con usuario y vigencia**, no texto libre.

```sql
CREATE TABLE IF NOT EXISTS "data_catalog"."catalog_stewardships" (
    "id" uuid NOT NULL,
    "scope_kind" varchar NOT NULL,            -- DOMAIN | OBJECT
    "domain_id" uuid,                         -- FK system_ops.data_domains (deferred)
    "object_id" uuid,                         -- FK data_catalog.catalog_objects
    "role_kind" varchar NOT NULL,             -- BUSINESS_OWNER | DATA_STEWARD | TECHNICAL_OWNER
    "user_id" uuid,                           -- FK iam.users (deferred)
    "team_code" varchar,
    "valid_from" timestamptz NOT NULL,
    "valid_to" timestamptz,
    "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL,
    "created_by_user_id" uuid, "updated_by_user_id" uuid,
    "row_version" integer NOT NULL DEFAULT 1,
    CONSTRAINT "pk_catalog_stewardships" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_stewardships_active_role"
  ON "data_catalog"."catalog_stewardships" ("scope_kind", COALESCE("domain_id","object_id"), "role_kind")
  WHERE valid_to IS NULL;
CREATE INDEX IF NOT EXISTS "ix_data_catalog_stewardships_user_id" ON "data_catalog"."catalog_stewardships" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_data_catalog_stewardships_object_id" ON "data_catalog"."catalog_stewardships" ("object_id");
-- Pertenencia observada ↔ declarada: catalog_objects gana una FK opcional al dominio
ALTER TABLE "data_catalog"."catalog_objects" ADD COLUMN IF NOT EXISTS "domain_id" uuid;   -- en el .puml, no a mano
CREATE INDEX IF NOT EXISTS "ix_data_catalog_objects_domain_id" ON "data_catalog"."catalog_objects" ("domain_id");
```

- **Endpoints** (`admin/governance/domains`, módulo `system_ops` o nuevo controlador en `data_catalog`; decisión D-3): `GET domains` (con conteo de tablas, dueño activo, puntaje), `GET domains/:id` (tablas, stewards, políticas aplicadas), `POST domains` (SECURITY_ADMIN|GOVERNANCE_ADMIN; `@Audited DOMAIN_CREATED`), `PUT objects/:id/domain` (precondición `expectedVersion` de `catalog_objects.row_version`; 409), `POST stewardships` (idempotente por `(scope, target, role, user, valid_from)`; cierra la vigente con `valid_to` en la misma transacción), `POST stewardships/:id/end`. Cada mutación → `governance_change_log` (`target_type 'catalog_stewardship'`).
- **Pantalla**: `governance/domains`: una tarjeta, pestañas «Dominios · Tablas sin dominio · Responsables». Herencia visible: tabla sin steward propio muestra el del dominio con etiqueta «heredado».
- **Roles**: ver matriz §3.12.

### 3.2 Glosario de negocio vivo

- **Existe**: JSON estático (`inventario/glosario.json`, `inventory.repository.ts:166`). Sin revisión ni enlace a columnas.
- **Nuevo (módulo 67)**:

```sql
CREATE TABLE IF NOT EXISTS "data_catalog"."catalog_glossary_terms" (
    "id" uuid NOT NULL,
    "term_code" varchar NOT NULL,             -- slug estable
    "name" varchar NOT NULL,
    "definition" text NOT NULL,
    "domain_id" uuid,
    "synonyms" jsonb,
    "status" varchar NOT NULL,                -- DRAFT | NEEDS_REVIEW | APPROVED | DEPRECATED
    "current_revision_no" integer NOT NULL,
    "approved_revision_no" integer,
    "approved_by_user_id" uuid, "approved_at" timestamptz,
    "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL,
    "created_by_user_id" uuid, "updated_by_user_id" uuid,
    "row_version" integer NOT NULL DEFAULT 1,
    CONSTRAINT "pk_catalog_glossary_terms" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_glossary_terms_code" ON "data_catalog"."catalog_glossary_terms" ("term_code");
CREATE INDEX IF NOT EXISTS "ix_data_catalog_glossary_terms_status" ON "data_catalog"."catalog_glossary_terms" ("status");

CREATE TABLE IF NOT EXISTS "data_catalog"."catalog_glossary_term_revisions" (   -- inmutable (forbid_mutation)
    "id" uuid NOT NULL, "term_id" uuid NOT NULL, "revision_no" integer NOT NULL,
    "content_json" jsonb NOT NULL, "content_hash" varchar NOT NULL,
    "change_reason" text, "author_user_id" uuid, "created_at" timestamptz NOT NULL,
    CONSTRAINT "pk_catalog_glossary_term_revisions" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_glossary_term_revisions_no" ON "data_catalog"."catalog_glossary_term_revisions" ("term_id", "revision_no");

CREATE TABLE IF NOT EXISTS "data_catalog"."catalog_glossary_term_links" (
    "id" uuid NOT NULL, "term_id" uuid NOT NULL,
    "object_id" uuid NOT NULL, "column_id" uuid,
    "link_kind" varchar NOT NULL,             -- DEFINES | RELATED
    "created_at" timestamptz NOT NULL, "created_by_user_id" uuid,
    CONSTRAINT "pk_catalog_glossary_term_links" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_glossary_term_links_pair"
  ON "data_catalog"."catalog_glossary_term_links" ("term_id", "object_id", COALESCE("column_id", '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS "ix_data_catalog_glossary_term_links_column_id" ON "data_catalog"."catalog_glossary_term_links" ("column_id");
```

- **Endpoints** (`admin/catalog/glossary`): `GET terms` (filtros `q, status, domain`, cursor), `GET terms/:id` (revisiones, enlaces), `PUT terms/:id` (crea/edita con `expectedVersion`; `submit=true` → `NEEDS_REVIEW`; mismo molde que `saveAnnotation`), `POST terms/:id/review` (otro usuario; reutiliza `catalog_review_decisions` añadiendo `target_kind` — **o** tabla gemela `catalog_glossary_review_decisions`; D-4), `POST terms/:id/links` / `DELETE links/:id` (idempotente por el índice único). Migración inicial: importar `glosario.json` como `DRAFT` con `origin IMPORT` (una vez, `POST /internal/catalog/glossary/import`).
- **Pantalla**: `catalog/glossary`: pestañas «Términos · Pendientes · Sin enlazar»; en la ficha de columna, chip «término» que abre el glosario.

### 3.3 Calidad de datos (reglas → worker → incidencias → puntaje)

El hueco principal. Reglas **declarativas** sobre objetos del catálogo vivo, ejecutadas por un worker con lease (molde de `catalog_scan_runs`), incidencias con ciclo de vida idempotente y puntaje por tabla/dominio.

```sql
CREATE TABLE IF NOT EXISTS "data_catalog"."quality_rules" (
    "id" uuid NOT NULL,
    "rule_code" varchar NOT NULL,             -- p. ej. DQ-persons-email-not-null
    "name" varchar NOT NULL, "description" text,
    "object_id" uuid NOT NULL,                -- FK catalog_objects
    "column_id" uuid,                         -- FK catalog_columns (NULL para VOLUME/FRESHNESS)
    "rule_kind" varchar NOT NULL,             -- NOT_NULL | UNIQUE | RANGE | SET | REGEX | REFERENTIAL | FRESHNESS | VOLUME
    "params_json" jsonb NOT NULL,             -- {min,max} | {values[]} | {pattern} | {targetObjectId,targetColumnId} | {maxAgeSeconds,timestampColumn} | {minRows,maxRows,maxDeltaPct}
    "severity" varchar NOT NULL,              -- HIGH | MEDIUM | LOW
    "threshold_pct" numeric(5,2) NOT NULL DEFAULT 0,   -- % de filas falladas tolerado
    "schedule_minutes" integer,               -- NULL = sólo manual
    "sample_limit" integer NOT NULL DEFAULT 20,         -- ids de muestra; NUNCA valores
    "enabled" boolean NOT NULL DEFAULT true,
    "owner_user_id" uuid,
    "version" integer NOT NULL DEFAULT 1,
    "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL,
    "created_by_user_id" uuid, "updated_by_user_id" uuid,
    "row_version" integer NOT NULL DEFAULT 1,
    CONSTRAINT "pk_quality_rules" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_quality_rules_code" ON "data_catalog"."quality_rules" ("rule_code");
CREATE INDEX IF NOT EXISTS "ix_data_catalog_quality_rules_object_id" ON "data_catalog"."quality_rules" ("object_id");
CREATE INDEX IF NOT EXISTS "ix_data_catalog_quality_rules_due" ON "data_catalog"."quality_rules" ("enabled", "schedule_minutes") WHERE enabled;

CREATE TABLE IF NOT EXISTS "data_catalog"."quality_rule_runs" (
    "id" uuid NOT NULL, "rule_id" uuid NOT NULL,
    "trigger" varchar NOT NULL,               -- SCHEDULE | MANUAL
    "status" varchar NOT NULL,                -- QUEUED | RUNNING | SUCCEEDED | FAILED
    "idempotency_key" varchar, "requested_by_user_id" uuid,
    "lease_owner" varchar, "lease_expires_at" timestamptz,
    "started_at" timestamptz, "finished_at" timestamptz,
    "evaluated_rows" bigint, "failed_rows" bigint, "failed_pct" numeric(7,4),
    "passed" boolean,
    "sample_ids_json" jsonb,                  -- sólo claves primarias
    "error_code" varchar, "error_message" text,
    "created_at" timestamptz NOT NULL,
    CONSTRAINT "pk_quality_rule_runs" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_quality_rule_runs_one_active" ON "data_catalog"."quality_rule_runs" ("rule_id") WHERE status IN ('QUEUED','RUNNING');
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_quality_rule_runs_idempotency" ON "data_catalog"."quality_rule_runs" ("requested_by_user_id","idempotency_key") WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_data_catalog_quality_rule_runs_rule_created" ON "data_catalog"."quality_rule_runs" ("rule_id","created_at" DESC);

CREATE TABLE IF NOT EXISTS "data_catalog"."quality_issues" (
    "id" uuid NOT NULL, "rule_id" uuid NOT NULL,
    "object_id" uuid NOT NULL, "column_id" uuid,
    "fingerprint" varchar NOT NULL,           -- hash(rule_id + rule.version): una incidencia viva por regla
    "severity" varchar NOT NULL,
    "status" varchar NOT NULL,                -- OPEN | ACKNOWLEDGED | RESOLVED | IGNORED
    "first_seen_run_id" uuid NOT NULL, "last_seen_run_id" uuid NOT NULL,
    "occurrences" integer NOT NULL DEFAULT 1,
    "failed_rows_last" bigint, "failed_pct_last" numeric(7,4),
    "acknowledged_by_user_id" uuid, "acknowledged_at" timestamptz,
    "resolved_by_user_id" uuid, "resolved_at" timestamptz, "resolution_kind" varchar, -- FIXED | RULE_CHANGED | FALSE_POSITIVE
    "ignored_until" timestamptz,
    "reason" text,
    "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL,
    "row_version" integer NOT NULL DEFAULT 1,
    CONSTRAINT "pk_quality_issues" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_quality_issues_live" ON "data_catalog"."quality_issues" ("fingerprint") WHERE status IN ('OPEN','ACKNOWLEDGED');
CREATE INDEX IF NOT EXISTS "ix_data_catalog_quality_issues_status_severity" ON "data_catalog"."quality_issues" ("status","severity");
CREATE INDEX IF NOT EXISTS "ix_data_catalog_quality_issues_object_id" ON "data_catalog"."quality_issues" ("object_id");

CREATE TABLE IF NOT EXISTS "data_catalog"."quality_issue_events" (     -- inmutable (forbid_mutation)
    "id" uuid NOT NULL, "issue_id" uuid NOT NULL,
    "event_kind" varchar NOT NULL,            -- OPENED | REOCCURRED | ACKNOWLEDGED | RESOLVED | IGNORED | REOPENED
    "run_id" uuid, "actor_user_id" uuid, "reason" text,
    "created_at" timestamptz NOT NULL,
    CONSTRAINT "pk_quality_issue_events" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ix_data_catalog_quality_issue_events_issue_created" ON "data_catalog"."quality_issue_events" ("issue_id","created_at");

CREATE TABLE IF NOT EXISTS "data_catalog"."quality_score_snapshots" (
    "id" uuid NOT NULL,
    "scope_kind" varchar NOT NULL,            -- OBJECT | DOMAIN | GLOBAL
    "object_id" uuid, "domain_id" uuid,
    "as_of" timestamptz NOT NULL,
    "score" numeric(5,2) NOT NULL,            -- 0..100
    "components_json" jsonb NOT NULL,         -- {rulesTotal, rulesPassed, openHigh, openMedium, coverage: {...}}
    "created_at" timestamptz NOT NULL,
    CONSTRAINT "pk_quality_score_snapshots" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_quality_score_snapshots_scope_asof"
  ON "data_catalog"."quality_score_snapshots" ("scope_kind", COALESCE("object_id","domain_id",'00000000-0000-0000-0000-000000000000'::uuid), "as_of");
```

- **Motor** (`API/src/modules/data_catalog/application/quality-*.service.ts` + `domain/quality/`): compilador de reglas → SQL parametrizado **por tipo**, sin SQL libre del usuario (D-5: ¿se admite `CUSTOM_SQL`? supuesto: NO en v1). Identificadores siempre entrecomillados desde `catalog_objects.schema_name/object_name` y `catalog_columns.column_name` (nunca del cuerpo). Ejecuta en transacción de sólo lectura con `statement_timeout` (p. ej. 30 s) y `LIMIT` de muestra. Evaluación: `failed_pct > threshold_pct` ⇒ falla ⇒ `quality_issues` upsert por `fingerprint` (si vive: `REOCCURRED`, `occurrences+1`; si estaba `RESOLVED`: nueva `OPEN`); si pasa y hay incidencia viva ⇒ **no** la cierra sola: queda `OPEN` con `failed_rows_last = 0` y una sugerencia «puede resolverse» (la resolución es humana; D-6). Puntaje: `100 − Σ pesos(HIGH 10, MEDIUM 4, LOW 1 por incidencia viva) − 20 × (1 − cobertura de reglas)`, snapshot diario por objeto/dominio/global.
- **Worker**: job `quality-tick` en `DataCatalogWorkerModule` (`API/src/worker/jobs/data_catalog/`), cada 30 s llama `POST /internal/catalog/quality/run-next` (`@Roles('SYSTEM')`): cierra leases vencidos, reclama la corrida `QUEUED` más antigua, y encola reglas con `schedule_minutes` vencido.
- **Endpoints** (`admin/governance/quality`): `GET rules` (filtros `object, kind, severity, enabled, q`), `GET rules/:id` (últimas corridas, incidencia viva), `POST rules` (valida `params_json` contra el `rule_kind` y que columna ∈ objeto; `@Audited QUALITY_RULE_CREATED`), `PUT rules/:id` (`expectedVersion`; cambiar params ⇒ `version+1` ⇒ nuevo fingerprint), `POST rules/:id/run` (202, `Idempotency-Key`, 409 si ya hay una activa), `GET runs[/:id]`, `GET issues` (filtros `status, severity, object, domain, rule`, `summary` por severidad), `GET issues/:id` (eventos), `POST issues/:id/acknowledge|resolve|ignore` (cuerpo `{reason, expectedVersion, until?}`; **idempotente**: repetir la misma transición devuelve 200 con la misma fila; transición inválida 409; `@Audited QUALITY_ISSUE_*`), `GET scores?scope=…`. Roles: leer `PORTAL_READ_ROLES`; crear/editar reglas `GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN, DATA_STEWARD`; resolver incidencias `DATA_STEWARD` del objeto/dominio o `GOVERNANCE_ADMIN` (verificación por `catalog_stewardships` en el servicio; 403 `NOT_STEWARD`).
- **Pantalla** `governance/quality`: una tarjeta, pestañas «Incidencias · Reglas · Corridas · Puntaje». Puntaje por dominio como barras horizontales ordenadas (dataviz: una pregunta = «¿qué dominio está peor?»); incidencias por severidad como barras apiladas, no donut. Tabla alterna siempre.

### 3.4 Políticas con versión, aprobación y aplicación medible

- **Existe**: cuatro familias de política (`write`, `retention`, `anonymization`, `residency`) + `legal_holds`, `backup_policies`, `encryption_keys`; vínculos en `entity_registry`; ejecución medible en `retention_executions` (totales), `restore_test_runs`, `key_rotation_events`; bitácora `governance_change_log`. Falta: lectura, **versionado** (las tablas tienen `row_version` pero no revisiones), **aprobación** (segunda persona) y **estado de aplicación**.
- **Nuevo (módulo 11 `system_ops`)**:

```sql
CREATE TABLE IF NOT EXISTS "system_ops"."governance_policy_revisions" (   -- inmutable (forbid_mutation)
    "id" uuid NOT NULL,
    "policy_type" varchar NOT NULL,           -- WRITE | RETENTION | ANONYMIZATION | RESIDENCY | BACKUP | ENCRYPTION
    "policy_id" uuid NOT NULL,
    "revision_no" integer NOT NULL,
    "content_json" jsonb NOT NULL, "content_hash" varchar NOT NULL,
    "status" varchar NOT NULL,                -- DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | SUPERSEDED
    "change_reason" text NOT NULL,
    "submitted_by_user_id" uuid NOT NULL, "submitted_at" timestamptz NOT NULL,
    "decided_by_user_id" uuid, "decided_at" timestamptz, "decision_comment" text,
    "effective_from" timestamptz,
    "created_at" timestamptz NOT NULL,
    CONSTRAINT "pk_governance_policy_revisions" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_governance_policy_revisions_no" ON "system_ops"."governance_policy_revisions" ("policy_type","policy_id","revision_no");
CREATE UNIQUE INDEX IF NOT EXISTS "ux_governance_policy_revisions_one_pending" ON "system_ops"."governance_policy_revisions" ("policy_type","policy_id") WHERE status = 'PENDING_APPROVAL';
-- La bitácora necesita buscarse por objetivo (hoy sólo por acción/usuario/fecha, 04_indexes.sql:91-97)
CREATE INDEX IF NOT EXISTS "ix_governance_change_log_target_recorded" ON "system_ops"."governance_change_log" ("target_type","target_id","recorded_at" DESC);
```

- **Flujo**: editar política ⇒ `DRAFT` ⇒ `submit` ⇒ `PENDING_APPROVAL` (una sola pendiente por índice) ⇒ otro usuario `approve|reject` ⇒ al aprobar, el servicio **aplica** el `content_json` a la tabla de la política en la misma transacción, marca la revisión anterior `SUPERSEDED` y escribe `governance_change_log` con `previous/new_snapshot_json`. Las rutas `POST/PATCH` actuales de `system_ops` pasan a crear revisiones en vez de escribir directo (o se mantienen sólo para `SECURITY_ADMIN` como «vía de emergencia» auditada; D-7).
- **Aplicación medible**: `GET policies/:type/:id` devuelve `appliedTo` (tablas vía `entity_registry`) y `enforcement`: retención → última `retention_executions` (status, totales, fecha) y tablas con política pero **sin ejecución en el período** (`retention_period_days` vencido); residencia → `tenant_residency_bindings` activos vs tenants totales; cifrado → `next_rotation_at < now()`; backup → `restore_test_runs.objective_status`. Todo `null` con motivo si no hay fuente.
- **Endpoints**: `GET /admin/governance/policies` (`type, state, q, sort, cursor`), `GET policies/:type/:id`, `GET policies/:type/:id/revisions`, `POST policies/:type[/:id]/revisions` (crea DRAFT con `content_json`), `POST revisions/:id/submit|approve|reject` (idempotentes; 403 `SELF_APPROVAL`), `GET change-log` (`targetType, targetId, changedBy, from, to`; sin snapshots), `GET legal-holds`, `GET retention-executions`, `GET residency`, `GET encryption-keys` (sólo metadatos: alias, propósito, versión, próxima rotación; jamás `external_key_ref`). Roles: leer `GOVERNANCE_READ_ROLES = SECURITY_ADMIN, GOVERNANCE_ADMIN, DPO, PLATFORM_ADMIN, DATA_PLATFORM_ADMIN` (+ `AUDITOR` sólo lectura; D-2); proponer `GOVERNANCE_ADMIN, DATA_PLATFORM_ADMIN`; aprobar `SECURITY_ADMIN` (retención/residencia/cifrado) o `GOVERNANCE_ADMIN` (escritura/anonimización) distinto del proponente.
- **Pantalla** `governance/policies`: una tarjeta, pestañas por familia («Retención · Anonimización · Residencia · Escritura · Legal holds · Cifrado y respaldo»); ficha de política con pestañas «Vigente · Revisiones · Aplicada a · Cumplimiento · Bitácora».

### 3.5 Clasificación PII/PHI con detección, revisión humana y evidencia

- **Existe**: todo el motor (§0.4), fichas de columna `AUTO_DETECTED/NEEDS_REVIEW`, revisión con evidencia obligatoria y `SELF_REVIEW`, `catalog_evidence_items`. Falta la vista transversal y el puente con `field_registry`/`data_classifications`.
- **Sin DDL**. Endpoints (`admin/catalog/pii`, contrato H4 §3.2 reaprovechado): `GET pii/summary` (observadas, clasificadas, personales, por sensibilidad × estado, registro declarado, `notMeasured: dataValues` siempre — el clasificador **no lee valores**), `GET pii/columns` (`schema, minSensitivity, sensitivity, reviewStatus, q, sort`), `GET pii/reconciliation` (columnas con sensibilidad aprobada ≥ PERSONAL **sin** fila en `field_registry`, y filas de `field_registry` sin columna observada), `POST pii/columns/:columnId/declare` (crea/actualiza `entity_registry` + `field_registry` desde la ficha aprobada; idempotente; `@Audited FIELD_DECLARED`; roles `GOVERNANCE_ADMIN, DPO, SECURITY_ADMIN`). La clasificación manual sigue siendo `PUT columns/:id/annotation` con `sensitivity`.
- **Pantalla** `governance/pii`: pestañas «Resumen · Columnas · Pendientes de revisión · Conciliación». Heatmap schema × sensibilidad (celdas = nº columnas; secuencial de un solo matiz, leyenda + etiqueta directa; `minSample` no aplica porque son metadatos).

### 3.6 Linaje oficial y por impacto

- **Existe**: FK observadas (`catalog_columns.foreign_key`), operación → tabla (`catalog_operation_impacts`), read model → tablas (`read_model_dependencies`), ruta → read model (`frontend_page_views`), reporte → read model (`report_data_sources`), lago (`lakehouse_lineage_edges`). Nadie los une.
- **Nuevo (módulo 67)**: aristas materializadas con origen y aprobación, para que «oficial» sea un dato y no una opinión.

```sql
CREATE TABLE IF NOT EXISTS "data_catalog"."catalog_lineage_edges" (
    "id" uuid NOT NULL,
    "source_kind" varchar NOT NULL,           -- TABLE | OPERATION | READ_MODEL | ROUTE | REPORT | DATASET
    "source_ref" varchar NOT NULL,            -- 'schema.table' | operation_key | 'schema.object' | route_code | report code | dataset id
    "target_kind" varchar NOT NULL, "target_ref" varchar NOT NULL,
    "edge_kind" varchar NOT NULL,             -- REFERENCES | READS | WRITES | DERIVES | SERVES
    "origin" varchar NOT NULL,                -- OBSERVED_FK | OBSERVED_CODE | DECLARED_READ_MODEL | DECLARED_ROUTE | DECLARED_REPORT | MANUAL
    "confidence" varchar,                     -- HIGH | MEDIUM | LOW
    "is_official" boolean NOT NULL DEFAULT false,
    "approved_by_user_id" uuid, "approved_at" timestamptz,
    "observation_status" varchar NOT NULL,    -- OBSERVED | NOT_OBSERVED (desapareció en el último rebuild)
    "first_seen_at" timestamptz NOT NULL, "last_seen_at" timestamptz NOT NULL,
    "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL,
    "created_by_user_id" uuid, "updated_by_user_id" uuid,
    "row_version" integer NOT NULL DEFAULT 1,
    CONSTRAINT "pk_catalog_lineage_edges" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_lineage_edges_identity" ON "data_catalog"."catalog_lineage_edges" ("source_kind","source_ref","target_kind","target_ref","edge_kind","origin");
CREATE INDEX IF NOT EXISTS "ix_data_catalog_lineage_edges_source" ON "data_catalog"."catalog_lineage_edges" ("source_kind","source_ref");
CREATE INDEX IF NOT EXISTS "ix_data_catalog_lineage_edges_target" ON "data_catalog"."catalog_lineage_edges" ("target_kind","target_ref");
```

- **Rebuild** tras cada escaneo `SUCCEEDED` (mismo tick que la importación, `scan-tick.job.ts:36-38`): upsert por identidad; lo que no reaparece pasa a `NOT_OBSERVED` (nunca se borra; una arista `MANUAL` no la toca el rebuild). «Oficial» = `MANUAL` aprobada o `OBSERVED_FK`/`DECLARED_*` aprobadas por un steward (`POST edges/:id/approve`).
- **Endpoints** (`admin/catalog/lineage`): `GET nodes` (`kind, q, domain`, cursor), `GET edges` (`kind, origin, official, from, to`), `GET nodes/:kind/:ref` (vecinos 1 salto), `GET impact/:kind/:ref?direction&depth` (BFS acotado, devuelve niveles: tabla → read models → rutas/reportes → operaciones), `GET official` (sólo `is_official`), `POST edges` (MANUAL), `POST edges/:id/approve|revoke` (idempotentes, `@Audited`). Sustituye en el front a `/admin/portal/linaje*` (que queda hasta que se verifique paridad).
- **Pantalla** `lineage`: pestañas «Grafo · Oficial · Impacto · Nodos». Grafo con ECharts `graph` (ya hay `chart-panel`); la tabla alterna lista aristas.

### 3.7 Auditoría de acceso a datos sensibles, cambios de gobierno y DSAR

- **Existe**: `GET /audit/log`, `GET /audit/data-access` (sellado), `data_access_log` con propósito y base legal, DSAR sólo escritura, exportación `POST /compliance/audit-export`.
- **Sin DDL** (salvo índice del change-log, §3.4). Endpoints: en `audit`: filtro `entityId`, `GET /audit/log/filter-catalog` (declara `requestId`/`correlationId` como `notMeasured` hasta que observabilidad mapee `correlation_id`), `GET /audit/data-access/summary` (lecturas de PHI por rol y propósito, agregadas, `minSample`); en `privacy`: `GET /privacy/dsar` (`status, type, from, to`), `GET dsar/:id` (sin `result_file_id` descargable desde acá); en `system_ops`: `GET /admin/governance/change-log` (§3.4). Roles: `AUDIT_READ_ROLES` se mantiene para la bitácora cruda; el resumen agregado admite además `GOVERNANCE_ADMIN` (D-2).
- **Pantalla** `governance/audit`: pestañas «Acciones · Accesos a datos · Cambios de gobierno · DSAR». Cada fila con `requestId` si existe, «sin dato: la bitácora no lo guarda» si no.

### 3.8 Certificación de datasets y KPI

```sql
CREATE TABLE IF NOT EXISTS "data_catalog"."catalog_certifications" (
    "id" uuid NOT NULL,
    "target_kind" varchar NOT NULL,           -- OBJECT | READ_MODEL | REPORT | KPI
    "object_id" uuid, "read_model_definition_id" uuid, "report_definition_id" uuid, "kpi_code" varchar,
    "status" varchar NOT NULL,                -- REQUESTED | CERTIFIED | REVOKED | EXPIRED
    "basis_json" jsonb NOT NULL,              -- {annotationApproved, ownerPresent, qualityScore, openHigh, lineageOfficial}
    "requested_by_user_id" uuid NOT NULL, "requested_at" timestamptz NOT NULL,
    "certified_by_user_id" uuid, "certified_at" timestamptz, "expires_at" timestamptz,
    "revoked_by_user_id" uuid, "revoked_at" timestamptz, "reason" text,
    "created_at" timestamptz NOT NULL, "updated_at" timestamptz NOT NULL,
    "row_version" integer NOT NULL DEFAULT 1,
    CONSTRAINT "pk_catalog_certifications" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_catalog_certifications_live"
  ON "data_catalog"."catalog_certifications" ("target_kind", COALESCE("object_id","read_model_definition_id","report_definition_id",'00000000-0000-0000-0000-000000000000'::uuid), COALESCE("kpi_code",''))
  WHERE status IN ('REQUESTED','CERTIFIED');
```

- **Precondiciones para certificar** (el servicio las calcula y las guarda en `basis_json`; si una falla, 422 con `violations`): ficha `APPROVED`, steward activo, puntaje ≥ umbral (D-8: 80), 0 incidencias HIGH abiertas, linaje oficial presente. Expira a los N días (D-8: 180) por job diario (`EXPIRED`). Quien pide no certifica (`SELF_CERTIFY` 403).
- **Endpoints**: `GET certifications`, `POST certifications` (REQUESTED), `POST certifications/:id/certify|revoke`. Roles: pedir `DATA_STEWARD`; certificar `GOVERNANCE_ADMIN`/`DATA_PLATFORM_ADMIN`.
- Pantalla: pestaña «Certificación» en la ficha de tabla y en `reports/readiness`.

### 3.9 Deriva de esquema y de permisos; readiness de reportes y de release

- **Deriva de esquema**: existe estática (`catalogo/deriva`) y viva (`catalog_change_events`). Nuevo: `POST /admin/catalog/changes/:id/acknowledge` — requiere persistir estado. Opción mínima sin DDL en la tabla inmutable: tabla `catalog_change_acknowledgements (change_event_id UNIQUE, user_id, reason, created_at)`. Pantalla «Deriva»: pestañas «Esquema (vivo) · Modelo vs ORM · Permisos · Almacenes» (esta última lee `projection_drift_events` si `cross_store` expone GET; si no, S3 «sin fuente»).
- **Deriva de permisos**: existe (`permission-drift.service.ts`). Añadir al reporte los roles **duplicados por concepto** (`GOVERNANCE_ADMIN` vs `DATA_GOVERNANCE_ADMIN`) como hallazgo.
- **Readiness de reportes** (`GET /admin/governance/readiness/reports`): por `report_definitions` activa → `report_data_sources.read_model_definition_id` → `read_model_definitions.maximum_staleness_seconds` vs último `read_model_refresh_runs.completed_at` (frescura) · certificación viva · steward · `required_permission_id` existe en `authz.permissions` · incidencias HIGH sobre tablas del linaje del read model. Semáforo con motivo por fila; `null` ≠ 0.
- **Readiness de release** (`GET /admin/governance/readiness/release`): gates = deriva de esquema sin reconocer, deriva de permisos > 0, PII `NEEDS_REVIEW`/`AUTO_DETECTED` ≥ PERSONAL, incidencias HIGH abiertas, planes QA `PENDING_APPROVAL` (`qa_execution`), `operational_readiness_reviews` abiertas (requiere GET en `platform_ops`; si no lo exponen, gate «sin fuente»). Pantalla `governance/readiness`: pestañas «Release · Reportes».

### 3.10 Jobs y alertas

- `GET /admin/governance/jobs` (unión tipada, sólo lectura): `catalog_scan_runs`, `quality_rule_runs`, `retention_executions`, `read_model_refresh_runs`, `reconciliation_runs`, corridas de clasificación (hoy no persisten: proponer que `POST classification/run` escriba una fila en `catalog_scan_runs` con `mode='CLASSIFICATION'`, o tabla `classification_runs`; D-9). Columnas: tipo, estado, pedido por, inicio, duración, lease, contadores, error, `requestId`.
- `GET /admin/governance/alerts` derivado (sin tabla): incidencias HIGH abiertas > 24 h, jobs FAILED últimas 24 h, leases vencidos, cambios de esquema sin reconocer, PII sin ficha aprobada, políticas con `valid_to` próximo, legal holds por vencer, `encryption_keys.next_rotation_at` vencido. Cada alerta enlaza a su pestaña.

### 3.11 Búsqueda global

`GET /admin/governance/search?q=&kinds=` sobre `catalog_objects` (schema.nombre, comentario, business_name), `catalog_columns`, `catalog_glossary_terms`, políticas (code/name), `catalog_operations` (route_template), `catalog_processes`, dominios. `ILIKE` con límite por tipo y `nextCursor` por tipo; índices trigram `gin_catalog_objects_search_trgm`, `gin_catalog_columns_name_trgm`, `gin_glossary_terms_search_trgm` exigen `CREATE EXTENSION pg_trgm` (D-10: ¿está habilitada en la base desplegada? no verificado). Sin la extensión: `ILIKE` sobre índices btree normales y declarar en la respuesta `notMeasured: fullText`. Front: el buscador del shell del portal (`portal-search.ts`) mezcla pantallas + resultados de datos, agrupados por tipo.

### 3.12 Matriz de roles (propuesta; la API la aplica con `@Roles` + verificación de steward en el servicio)

| Capacidad | SUPERADMIN | SECURITY_ADMIN | GOVERNANCE_ADMIN | DATA_PLATFORM_ADMIN | DATA_STEWARD | DPO | AUDITOR |
|---|---|---|---|---|---|---|---|
| Ver catálogo, PII, linaje, calidad, jobs | ✔ (comodín) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Ver políticas, change-log, dominios | ✔ | ✔ | ✔ | ✔ | ✔ (sólo lectura) | ✔ | ✔ (D-2) |
| Ver bitácora cruda `/audit/log` | ✔ | ✔ | ✘ (403) → D-2 | ✘ | ✘ | ✔ | ✔ |
| Pedir escaneo, correr clasificación | ✔ | ✘ | ✔ | ✔ | ✔ | ✘ | ✘ |
| Editar fichas, glosario, reglas de calidad | ✔ | ✘ | ✔ | ✔ | ✔ (sus dominios) | ✘ | ✘ |
| Revisar/aprobar fichas y términos | ✔ | ✘ | ✔ | ✔ | ✔ (no los propios) | ✘ | ✘ |
| Resolver incidencias | ✔ | ✘ | ✔ | ✔ | ✔ (sus objetos) | ✘ | ✘ |
| Dominios y stewards | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ |
| Proponer revisión de política | ✔ | ✔ | ✔ | ✔ | ✘ | ✔ (anonimización/retención) | ✘ |
| Aprobar política retención/residencia/cifrado | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Aprobar política escritura/anonimización | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ |
| Declarar PII en `field_registry` | ✔ | ✔ | ✔ | ✘ | ✘ | ✔ | ✘ |
| Certificar | ✔ | ✘ | ✔ | ✔ | pedir | ✘ | ✘ |
| Usuarios, roles, sesiones | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ |

Regla transversal: **quien propone no aprueba** (identidad, no rol), como ya hace `SELF_REVIEW`. El front sólo oculta lo que daría 403; nunca es la autoridad. Los roles de gobierno se asignan **sin tenant** (`data_catalog.roles.ts:11-13`); el menú del front debe incluir `AUDITOR` y `DATA_STEWARD` (§1.3).

### 3.13 Pantallas: estructura del portal (una tarjeta con pestañas por sección)

Reorganizar `PORTAL_NAV` (`portal-nav.ts:26-147`) a los pilares de Atlas, cada pantalla **una tarjeta a lo ancho con pestañas** (`composition-rules.md:140`), 9 estados `ViewState` en cada pestaña (S1 autorización antes de pedir; S3 con próxima acción; S7 con `asOf` del último escaneo; S9 con `requestId`):

| Pantalla | Pestañas | Fuente |
|---|---|---|
| Inicio (gobierno) | Postura · Alertas · Jobs | coverage, alerts, jobs |
| Sistemas | Endpoints · Mapa de rutas · Procesos · Diagrama | `catalog_operations` (vivo) + inventario |
| Catálogo | Tablas · Columnas PII · Glosario · Dominios | objects, pii/columns, glossary, domains |
| Ficha de tabla | Observado · Ficha · Columnas · Linaje · Calidad · Certificación · Historia · Evidencia | objects/:id/*, lineage, quality, certifications |
| Linaje | Grafo · Oficial · Impacto · Nodos | lineage/* |
| Calidad | Incidencias · Reglas · Corridas · Puntaje | quality/* |
| Políticas | Retención · Anonimización · Residencia · Escritura · Legal holds · Cifrado y respaldo | policies/* |
| Revisión | Fichas · Términos · Políticas · Certificaciones · Asignadas a mí | review-queue |
| Auditoría | Acciones · Accesos a datos · Cambios de gobierno · DSAR | audit/*, change-log, dsar |
| Acceso | Usuarios · Roles y permisos · Deriva de permisos · Sesiones | authz/*, permission-drift, iam sessions |
| Deriva | Esquema vivo · Modelo vs ORM · Permisos · Almacenes | changes, deriva, drift |
| Readiness | Release · Reportes | readiness/* |
| Exportar | Catálogo · PII · Políticas · Auditoría | exports/* |

Las dos entradas de menú (`superadmin/data-catalog`, `superadmin/portal`) se funden en una («Gobierno de datos»); `superadmin/data-catalog` queda como redirección (como los `LEGACY_PORTAL_PATHS`, `portal.routes.ts:13-30`).

---

## 4. Qué se reaprovecha del contrato H4 y qué cambia

Se mantienen tal cual: reglas comunes (401/403/400 nunca 500, cursor opaco, `limit` 1..200, sólo metadatos; `H4-gobernanza.md:6`), rutas `GET /admin/governance/{policies, policies/:type/:id, change-log, entity-registry, entity-registry/:id/fields}` (§3.1 del contrato), `GET /admin/catalog/pii/{summary,columns}` (§3.2), `GET /admin/portal/linaje/{nodos,aristas}` → se **mueven** a `admin/catalog/lineage/{nodes,edges}` sobre `catalog_lineage_edges` (§3.6), `GET /audit/log?entityId` y `filter-catalog` (§3.5). Cambian: las reglas de calidad **documental** `CAT-*` del contrato (§3.3) pasan a ser reglas del motor de calidad con `rule_kind = CATALOG` (sin DDL propio: se evalúan sobre `catalog_*`) para que convivan con las de valores y tengan incidencias con estado — lo que el contrato marcaba `BLOQUEADO` (§5) acá se desbloquea con el DDL de §3.3.

---

## 5. Cómo se prueba que funciona de verdad (contra Postgres real)

Prerrequisito: base con el esquema aplicado (`MODEL/SQL/apply_all.sql` + los módulos 11/67 regenerados), API y worker `data_catalog` arriba (`API/docker-compose.yml:333` perfil `local-db`; **no verificado** que exista en esta máquina: H4 reportó `pg_isready` sin respuesta). Cada prueba deja evidencia: petición y respuesta literales (sin PHI), `SELECT` de persistencia, captura tras **recarga**. Un toast no prueba nada.

| # | Escenario | Pasos | Evidencia esperada |
|---|---|---|---|
| P1 | Escaneo de catálogo | `POST /admin/catalog/scans` con `Idempotency-Key` → 202 → esperar `SUCCEEDED` en `GET scans/:id` → `SELECT count(*) FROM data_catalog.catalog_objects WHERE schema_name='iam'` | Coincide con `SELECT count(*) FROM pg_class JOIN pg_namespace … WHERE nspname='iam'`; repetir el `POST` con la misma clave devuelve el mismo `scanId`, `created:false`; dos `POST` concurrentes ⇒ uno 202 y otro 409 |
| P2 | Clasificar columna → revisión → auditoría | `POST classification/run` → una columna `email` queda `AUTO_DETECTED/PERSONAL`; `PUT columns/:id/annotation {sensitivity:'PHI_IDENTIFIER', submit:true, expectedVersion}` como steward → `NEEDS_REVIEW`; aparece en `review-queue`; `POST annotations/:id/review` con el **mismo** usuario → 403 `SELF_REVIEW`; con otro → `APPROVED` | `catalog_annotation_revisions` tiene N+1 filas inmutables (un `UPDATE` directo falla por `forbid_mutation`); `audit.audit_log` tiene `CATALOG_ANNOTATION_SAVED` y `CATALOG_ANNOTATION_REVIEWED` con `entity_id` de la ficha; `GET pii/columns` la muestra con `approved:true` tras recargar |
| P3 | Regla de calidad violada a propósito | Crear regla `NOT_NULL` sobre una columna nullable de una tabla de prueba; insertar 3 filas con NULL; `POST rules/:id/run` (202) → worker la corre | `quality_rule_runs.failed_rows = 3`; `quality_issues` tiene **una** fila `OPEN` (`occurrences=1`); segunda corrida ⇒ misma fila, `occurrences=2`, evento `REOCCURRED`; `POST issues/:id/acknowledge` dos veces ⇒ 200 ambas, un solo evento `ACKNOWLEDGED`; corregir los NULL, correr, `POST resolve {reason}` ⇒ `RESOLVED`; tercera violación ⇒ **nueva** incidencia `OPEN`; `GET scores` baja y vuelve a subir; la pantalla muestra lo mismo tras F5 |
| P4 | Política de retención aplicada | Crear revisión de retención (`retention_period_days=1`) → `submit` → aprobar con otro usuario → `retention_policies` actualizada, revisión `APPROVED`, anterior `SUPERSEDED`; `POST /internal/governance/retention-executions/run` sobre una entidad con adaptador | `retention_executions` con `status SUCCEEDED` y `total_deleted` > 0; `record_revisions` con las filas afectadas; `GET policies/RETENTION/:id` muestra `enforcement.lastExecution`; `governance_change_log` tiene la aprobación con `previous/new_snapshot_json`; `GET change-log?targetId=` la devuelve |
| P5 | Linaje = FK reales | Tras P1, `GET lineage/edges?origin=OBSERVED_FK&from=TABLE:iam.users` | Conjunto igual a `SELECT … FROM pg_constraint WHERE contype='f' AND conrelid='iam.users'::regclass`; `GET impact/TABLE/iam.users?direction=downstream&depth=2` incluye los read models cuyo `read_model_dependencies.source_object_name='users'`; borrar una FK en la base de prueba y reescanear ⇒ la arista pasa a `NOT_OBSERVED`, nunca desaparece |
| P6 | Autorización negativa | Token `DATA_STEWARD` → `POST /admin/governance/domains` ⇒ 403; token `AUDITOR` → `PUT annotation` ⇒ 403; token con `GOVERNANCE_ADMIN` **acotado a un tenant** → `GET /admin/catalog/objects` ⇒ 403 (regla `data_catalog.roles.ts:11-13`); `GET objects/:id` con un uuid de otra fuente/inexistente ⇒ 404 **sin** distinguir existencia (S6); sin token ⇒ 401; `?foo=1` ⇒ 400 | Respuestas literales con `requestId`; `audit.audit_log` no registra la mutación rechazada como éxito |
| P7 | Readiness y alertas | Dejar una incidencia HIGH abierta y una ficha PII `NEEDS_REVIEW` | `GET readiness/release` devuelve `NOT_READY` con ambos gates y sus enlaces; `GET alerts` las lista; resolver ambas ⇒ `READY`; sin ninguna fuente de QA ⇒ gate `null` con motivo, no «verde» |
| P8 | Front 9 estados | Playwright contra `ng serve` + API real (sin `networkidle`): cada pestaña nueva en S2→S3/S4/S5/S6/S7/S9 forzados (sin datos, 403, 404, API caída) | Capturas en serie, `data-testid` por estado, 0 errores de consola; S7 muestra «datos del escaneo de hace N min» |

Revisores: `visual-reviewer`, `frontend-reviewer`, `regression-auditor` (`.claude/agents/`); quien implementa no aprueba.

---

## 6. Hitos, CA/DoD y microtareas (`Hn.Sn.Mn`, todo `TODO`)

Orden de dependencias: **modelo → API → front** dentro de cada hito; los hitos van del cimiento (lectura de lo que ya hay) al motor (calidad) y de ahí a lo transversal. Tamaño: S ≤ 1 día, M 2–4 días, L > 4 días (un agente).

### H1 — Modelo: DDL de gobierno (L)
**CA**: dado el `.puml` de los módulos 67 y 11 con las entidades de §3, cuando se corre `gen_ddl.py` + `gen_integrity.py` + `gen_entities.py`, entonces `SQL/67_data_catalog/*.sql` y `SQL/11_system_ops/*.sql` contienen las tablas e índices con los nombres de §3, las tablas inmutables tienen `trg_forbid_update`, y la API compila con las entidades generadas sin DDL a mano.
**DoD**: `apply_all.sql` aplica limpio en una base vacía; `check_ddl_sources.py` sin diferencias; `_generation_report.md` regenerado; PR al modelo.
- H1.S1.M1 Añadir a `diagram_67_data_catalog.puml`: `catalog_stewardships`, `catalog_objects.domain_id`, `catalog_glossary_terms/_revisions/_links`, `quality_rules/_rule_runs/_issues/_issue_events/_score_snapshots`, `catalog_lineage_edges`, `catalog_certifications`, `catalog_change_acknowledgements` con sus `INDEX_SET`.
- H1.S1.M2 Añadir a `diagram_11_system_ops.puml`: `governance_policy_revisions` e índice `ix_governance_change_log_target_recorded`.
- H1.S1.M3 Marcar inmutables (`UPDATE: forbidden`) revisiones, eventos de incidencia y revisiones de política; regenerar SQL, integridad y entidades; FK diferidas a `iam.users` y `system_ops.data_domains` en `90_fk_deferred.sql`.
- H1.S1.M4 Patch dated en `SQL/patches/2026-11-xx_v4280_gobierno_de_datos.sql` para bases ya desplegadas (sólo `CREATE … IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

### H2 — API: lectura de lo que ya existe (M)
**CA**: dado un token con rol de lectura, cuando pide `GET /admin/governance/{policies,policies/:type/:id,change-log,entity-registry,entity-registry/:id/fields,domains,legal-holds,retention-executions}`, `GET /admin/catalog/pii/{summary,columns,reconciliation}`, `GET /audit/log?entityId`, `GET /audit/log/filter-catalog`, `GET /privacy/dsar`, `GET /admin/governance/review-queue`, `GET /admin/governance/jobs`, entonces recibe sólo metadatos paginados, 400 ante parámetro inválido, 403 fuera de rol, y `notMeasured` donde no hay fuente.
**DoD**: specs de controlador con guards reales (matriz 401/403/200/400), specs de repositorio contra Postgres real (P1, P6 parcial), `audit-trail-coverage.spec.ts` verde (no se añaden mutaciones), `openapi` regenerado.
- H2.S1.M1 `system_ops/controllers/governance-read.controller.ts` + repositorio SQL parametrizado (contrato H4 §3.1 + dominios + legal holds + ejecuciones).
- H2.S1.M2 `data_catalog` `pii/*` (contrato H4 §3.2 + `reconciliation`).
- H2.S1.M3 `audit`: `entityId`, `filter-catalog`, `data-access/summary` agregado; `privacy`: `GET dsar[/:id]`.
- H2.S2.M1 `review-queue` agregador (fichas objeto+columna `NEEDS_REVIEW`; preparado para términos, políticas, certificaciones).
- H2.S2.M2 `jobs` unión tipada; `D-9` corridas de clasificación persistidas.
- H2.S2.M3 Deriva de permisos: hallazgo «roles duplicados por concepto».

### H3 — API: mutaciones de gobierno con aprobación (L)
**CA**: dado un usuario con rol de propuesta, cuando crea un dominio, asigna un steward, propone una revisión de política, edita un término del glosario o declara PII, entonces la fila queda persistida con `row_version`, el `governance_change_log`/`audit_log` registra la acción, repetir la misma petición es idempotente, la aprobación por el mismo usuario da 403, y la aprobación por otro aplica el cambio en una transacción.
**DoD**: P2, P4 y P6 pasan contra Postgres real; cada ruta mutante con `@Audited`; specs de concurrencia (`expectedVersion` ⇒ 409).
- H3.S1.M1 Dominios y stewardships (§3.1): servicio + controlador + verificación de steward reutilizable (`StewardshipGuardService`).
- H3.S1.M2 Glosario vivo (§3.2) + importación única de `glosario.json`.
- H3.S2.M1 Revisiones de política (§3.4): `submit/approve/reject`, aplicación transaccional, `enforcement` en la ficha.
- H3.S2.M2 `pii/columns/:id/declare` (§3.5) y `changes/:id/acknowledge` (§3.9).
- H3.S3.M1 Unificación de roles (D-1): alias en guard o migración de `DATA_GOVERNANCE_ADMIN` → `GOVERNANCE_ADMIN` con seed y deriva.

### H4 — API: motor de calidad + worker (L)
**CA**: dada una regla declarativa guardada, cuando el worker la ejecuta (programada o `POST run`), entonces hay una corrida con lease, contadores y muestra de ids, la violación abre **una** incidencia por fingerprint, las transiciones `acknowledge/resolve/ignore` son idempotentes y auditadas, y el puntaje por objeto/dominio refleja el estado.
**DoD**: P3 completa contra Postgres real; prueba de compilador de reglas por `rule_kind` (sin SQL libre); prueba de concurrencia (dos workers, un lease); `statement_timeout` probado.
- H4.S1.M1 `domain/quality/rule-compiler.ts` (8 tipos) + validación de `params_json`.
- H4.S1.M2 `quality-run.service.ts` (lease, fence, upsert de incidencias, eventos) + `POST /internal/catalog/quality/run-next` + job `quality-tick`.
- H4.S2.M1 Controlador `admin/governance/quality/*` (reglas, corridas, incidencias, scores) + roles/steward.
- H4.S2.M2 Reglas `CATALOG` (ex `CAT-*` del contrato H4) como `rule_kind` sin tabla objetivo.
- H4.S3.M1 Snapshot diario de puntaje (job) + `GET scores`.

### H5 — API: linaje, certificación, readiness, alertas, búsqueda, exportaciones (L)
**CA**: dado un escaneo `SUCCEEDED`, cuando corre el rebuild de linaje, entonces `catalog_lineage_edges` iguala las FK reales y los `read_model_dependencies`, el impacto devuelve niveles tabla → read model → ruta/reporte, y certificar exige las precondiciones de §3.8; readiness y alertas devuelven `null` con motivo donde no hay fuente; la búsqueda devuelve resultados por tipo; las exportaciones quedan selladas en `analytics_governance_log`.
**DoD**: P5, P7; prueba de que una arista `MANUAL` sobrevive al rebuild; prueba de expiración de certificación.
- H5.S1.M1 Rebuild de linaje (FK, `catalog_operation_impacts`, `read_model_dependencies`, `frontend_page_views`, `report_data_sources`) + endpoints §3.6.
- H5.S1.M2 Certificaciones §3.8 + job de expiración.
- H5.S2.M1 `readiness/reports`, `readiness/release` (§3.9); gates `null` cuando `platform_ops`/`qa` no exponen lectura.
- H5.S2.M2 `alerts` (§3.10), `search` (§3.11; D-10), `exports/*.csv` sellados.
- H5.S3.M1 Servir `systems/endpoints` desde `catalog_operations` con paridad verificada contra el JSON (diff automático).

### H6 — Front: shell del portal y fichas (L)
**CA**: dado un usuario con rol de lectura, cuando entra a «Gobierno de datos», entonces ve la navegación de §3.13, cada pantalla es una tarjeta a lo ancho con pestañas, cada pestaña implementa los 9 estados con S7 mostrando la antigüedad del último escaneo y S9 el `requestId`, y las rutas viejas redirigen.
**DoD**: Vitest de cada página (estados forzados); Playwright P8 contra API real; `visual-reviewer` aprueba capturas; `yarn lint/typecheck/build` verdes; sin Tailwind, sólo tokens.
- H6.S1.M1 Reorganizar `PORTAL_NAV`, fusionar `superadmin/data-catalog` en el portal (redirección), incluir `AUDITOR` y `DATA_STEWARD` en `navigation.platform.ts`.
- H6.S1.M2 Clientes `core/data-access/governance/` (policies, domains, glossary, quality, lineage, certifications, readiness, alerts, search, exports) con tipos del contrato.
- H6.S2.M1 Ficha de tabla unificada (8 pestañas) sobre `catalog-object-detail`.
- H6.S2.M2 Pantallas Catálogo, Linaje (ECharts `graph` + tabla alterna), Políticas, Dominios, Glosario.
- H6.S3.M1 Calidad, Revisión unificada, Auditoría (4 pestañas), Acceso (+ Sesiones), Deriva, Readiness, Exportar, Inicio con postura/alertas/jobs. Dataviz según `SKILL.md` (paleta validada con `scripts/validate_palette.js`, modo oscuro propio).

### H7 — Evidencia, revisión cruzada y PRs (M)
**CA**: dado el conjunto H1–H6, cuando se corre la batería P1–P8 contra Postgres real, entonces cada afirmación de «funciona» enlaza una evidencia (request/response/SELECT/captura tras recarga) y los tres revisores firman.
**DoD**: `evidencia/` con salidas literales; `REPORTE.md` de la franja; dos PRs por repo (dev y test por cherry-pick desde rama creada desde `test`), orden modelo → API → front; `openapi/ENDPOINTS.md` regenerado.

---

## 7. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Reglas de calidad ejecutan SQL sobre tablas de negocio con PHI | Fuga de valores en muestras o logs | Sólo ids en `sample_ids_json`; nunca `SELECT *`; identificadores desde el catálogo, nunca del cuerpo; `statement_timeout`; rol de BD de sólo lectura para el worker (D-11, no verificado si existe) |
| Carga sobre la base primaria (escaneo + reglas) | Latencia en producción | Programación nocturna por defecto, `schedule_minutes` mínimo 60, cap de corridas concurrentes = 1 por worker, `LIMIT` en muestras |
| Tablas inmutables + retención | No se puede «corregir» una revisión | Es la intención; la corrección es una revisión nueva (como ya hace `catalog_annotation_revisions`) |
| Sin Postgres en la máquina de trabajo (H4 lo reportó) | Todo vuelve a ser maqueta | Bloqueante explícito: H2+ no se declara hecho sin P1–P6; levantar `docker compose --profile local-db` o apuntar a la base de `test` |
| Dos roles de gobierno (`GOVERNANCE_ADMIN` / `DATA_GOVERNANCE_ADMIN`) | 403 inesperados, matriz inconsistente | D-1 antes de H3 |
| El inventario estático y el catálogo vivo divergen durante la transición | Dos verdades en pantalla | H5.S3.M1 con diff automático; mientras, etiquetar la fuente en cada pestaña |
| `pg_trgm` no habilitada | Búsqueda lenta o `CREATE EXTENSION` falla | Degradar a `ILIKE` y declararlo en `notMeasured` |
| Conflictos con `dev` (TRASPASO §PASO 0 habla de add/add en 35 archivos del front) | Rehacer trabajo | Partir de `origin/dev` actual; no reutilizar la rama `stoic-johnson` |

## 8. Ambigüedades y supuesto tomado

1. «Datos personales» = sensibilidad `≥ PERSONAL`; `PSEUDONYMIZED` opt-in (igual que H4 §6.1).
2. La incidencia que deja de fallar **no se cierra sola** (D-6): se marca «puede resolverse» y una persona la resuelve con motivo. Supuesto para que el ciclo de vida sea auditable.
3. `CUSTOM_SQL` no se admite en v1 (D-5).
4. Umbral de certificación 80 y vigencia 180 días (D-8).
5. Las rutas `POST/PATCH` actuales de `system_ops` se conservan como vía de emergencia auditada de `SECURITY_ADMIN` y además crean una revisión `APPROVED` automática con `change_reason='DIRECT_WRITE'` (D-7).
6. Las decisiones de revisión del glosario reutilizan `catalog_review_decisions` con una columna nueva `target_kind` (D-4) para no multiplicar tablas.
7. El repo de Atlas no está en la máquina; su comportamiento se toma de las citas de H4 y del nombre de ruta (no verificado).

## 9. Decisiones que necesitan al usuario

- **D-1 Roles**: unificar `GOVERNANCE_ADMIN` (data_catalog) y `DATA_GOVERNANCE_ADMIN` (authz/cross_store) en uno; y si `AUDITOR`/`GOVERNANCE_ADMIN` pueden leer políticas y change-log (D-2: hoy la bitácora cruda es sólo `AUDITOR, DPO, SECURITY_ADMIN`).
- **D-3 Dónde vive la API de gobierno**: extender `system_ops` (`admin/governance/*`) o concentrar todo en `data_catalog` (`admin/catalog/*`). Propuesta: lectura/mutación de políticas y dominios en `system_ops`; catálogo, calidad, linaje, glosario, certificación en `data_catalog`.
- **D-5/D-6/D-8 Calidad y certificación**: sin SQL libre, resolución humana de incidencias, umbral 80 / 180 días.
- **D-10/D-11 Infra**: `pg_trgm` y un rol de BD de sólo lectura para el worker de calidad.

## 10. Tamaño relativo

H1 L · H2 M · H3 L · H4 L · H5 L · H6 L · H7 M. Mínimo viable para «gobierno real» (no maqueta): H1 + H2 + H3.S1 + H4 + H6.S1/S2 con P1–P4 y P6 verdes.
