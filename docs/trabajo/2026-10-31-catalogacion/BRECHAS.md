# Catalogación — brechas medidas contra el estado real (2026-10-31)

> **Alcance de este documento:** auditoría de SOLO LECTURA. No se tocó código, no hubo `git commit/push`.
> Todo número sale de un comando o de una lectura con ruta; lo que no pude medir está en la sección 7.
> Peldaño de evidencia (regla 30): `DISCOVERED` (peldaño 1). Nada de lo que sigue afirma que algo "funciona":
> afirma qué existe en disco, cuánto y con qué calidad.

Repos: API `/home/user/mantra-core-health-api` (rama `claude/upbeat-darwin-rm3rn2`, árbol con cambios ajenos
sin commitear en `authz`), MODELO `/home/user/mantra-core-health-model`, FRONT `/home/user/mantra-core-health`,
referencia `/home/user/AtlasBackend` + `/home/user/AtlasAdminPortal`, bóveda `/home/user/mantra_core_technologies_health_docs`.

---

## 0. Resumen en una pantalla

| Dimensión | Hoy | Lo que exige el cliente |
|---|---|---|
| Tablas modeladas vs catálogo estático | 1 343 (+87 en bases `pay`) vs **1 230** (91,6 % de las del modelo) | 100 % |
| Columnas con descripción | **23,7 %** (3 989/16 851), y el 87,4 % de ellas son 4 frases genéricas → contenido propio ≈ **3,0 %** | explicación de sistema y de negocio por columna |
| Tablas con propósito | 100 % con texto, **0 % aprobado**; 113 son la misma plantilla | texto real y revisado |
| Operaciones (endpoints) | 1 672 decoradores vs 1 642 operaciones con detalle; **12 controllers (63 rutas) sin inventariar** | 100 % |
| Explicación de negocio/sistema por operación | 1 642/1 642 `AUTO_DETECTADA` (0 revisadas por persona) | explicación curada |
| Mutabilidad (append-only/borrable/retención/hold) | **1,9 %** de las tablas con barrera física (25/1 343); el catálogo estático dice `NO_DECLARADO` en 1 090 y `SIN_FUENTE` en retención/PII/responsable en el 100 % | gobierno completo por tabla |
| `system_ops.entity_registry` (el lugar natural de la mutabilidad) | existe, con API de alta; **0 tablas reales registradas** y el seed del modelo trae 10 filas de relleno | 1 fila por tabla |
| Seeders del catálogo | idempotentes los que existen (inventario → `catalog_operation*`); **sin seeder** para glosario, linaje oficial, mayordomía, certificaciones, calidad, dominios, clasificaciones, políticas | todos |
| Atlas | Mantra gana en amplitud estática; Atlas gana en narrativa curada persistida (222 tablas), cola de revisión unificada, glosario/linaje oficiales con API, registro de versiones de esquema con aprobación | igualar o superar |

---

## 1. Inventario HOY

### 1.1 Tablas y columnas — cuatro fuentes que no coinciden

| Fuente | Tablas | Columnas | Cómo se midió |
|---|---:|---:|---|
| Modelo SQL base (`SQL/NN_*/02_tables.sql`) | **1 343** en 62 schemas | **18 739** | parseo propio de `CREATE TABLE … ( … );` (script en el scratchpad `model_tables.json`) |
| Modelo, bases `pay` (`SQL/pay/*/ddl.sql`, sin schema) | 87 en 12 bases | n/m | `grep -ciE '^\s*create table'` por archivo (13+3+9+11+11+2+3+6+16+4+6+3) |
| Parches del modelo (`SQL/patches/*.sql`, 127 archivos) | 0 tablas nuevas fuera de la base | — | todas las `CREATE TABLE "s"."t"` de parches ya están en `02_tables.sql` |
| CSV del modelo `docs/data-catalog/tables.csv` / `columns.csv` | 1 313 | 18 263 | `csv.DictReader`; le faltan 30 tablas del modelo (data_catalog v4281, observability, `authz.ui_visibility_*`, `system_ops.bulk_import_*`, `governance_policy_revisions`, `telemetry.client_error_events`) |
| Entidades de la API (`src/**/*.entity.ts`) | 1 287 | — | `find … \| wc -l` |
| **Catálogo estático de la API** (`inventario/catalogo/*.json`, 61 schemas) | **1 230** | **16 851** (+8 267 índices, +7 069 relaciones) | `inventario/catalogo/indice.json` `.resumen`, recontado con python |
| `schema-descriptions.generated.ts` | **0 tablas, 0 columnas** (67 filas, una por *schema*) | — | ver 2.3 |
| Catálogo vivo (`data_catalog.catalog_objects/columns`) | **no medido** (sin base) | — | `pg_isready` → "no response" |

**Diferencias concretas (modelo base − catálogo estático):**

- **113 tablas del modelo no están en el catálogo estático** (1 655 columnas): `marketing` 22, `delegated_access` 20,
  `data_catalog` 17, `observability` 12, `practice` 5, `diagnostic_units` 5, `system_ops` 3, `accounting` 3,
  `community` 3, `pharmacy` 3, y 15 más sueltas. El catálogo no tiene ninguna tabla que el modelo no tenga (0 sobrantes).
- **57 tablas comunes tienen distinto nº de columnas** (p. ej. `consent.treatment_informed_consents` 45 en el modelo vs 17 en el
  catálogo; `authz.permissions` 26 vs 18; `common.addresses` 24 vs 20). Sobre las 1 230 comunes: 17 084 columnas del
  modelo vs 16 851 del catálogo.
- Causa: `inventario/catalogo/deriva-bd.json` declara que la base de referencia se armó con
  `apply_all.sql + apply_deferred.sql (sin SQL/patches)` en PostgreSQL 16.15; el catálogo se generó
  antes de los parches v4.2.4x–v4.2.81.
- El catálogo estático deriva su lista de tablas de las entidades del ORM y 43 tablas que sí tocan operaciones
  (p. ej. `data_catalog.catalog_operations`, `vector_rag.*`, `time_series.*`, `accounting.practitioner_simple_*`) quedan fuera de él.
- Esquemas del modelo con tablas y **sin** ficha de schema: `medical_groups`, `observability`, `pharma_lab`, `surveys`.
  Fichas de schema sin schema relacional en el modelo (son stores no relacionales): `deployment`, `document_store`,
  `integrity`, `platform`, `portal_catalog`, `redis_runtime`, `search_platform`, `time_series`, `vector_rag`.

**Las tablas propias del catálogo en el modelo (30) frente a las que tienen entidad/API (13):**
`data_catalog` tiene 30 tablas en `SQL/67_data_catalog`+v4281; la API tiene 13 entidades en
`src/modules/data_catalog/entities/`. **Sin entidad, sin repositorio y sin endpoint** (17):
`catalog_certifications`, `catalog_change_acknowledgements`, `catalog_glossary_terms`, `catalog_glossary_term_links`,
`catalog_glossary_term_revisions`, `catalog_lineage_edges`, `catalog_stewardships`, `quality_issues`,
`quality_issue_events`, `quality_rules`, `quality_rule_runs`, `quality_score_snapshots` (+ las 5 `catalog_operation*/catalog_process*`
que sí tienen entidad pero se listan arriba como "faltan en el catálogo estático"). Evidencia:
`grep -rln "catalog_glossary\|catalog_lineage_edges\|catalog_stewardships\|catalog_certifications\|quality_rules" src test` solo devuelve
módulos ajenos (`health_data`, `lakehouse`, `governance_admin` sobre `health_data_quality_*`).
Es decir: el modelo ya diseñó el gobierno de datos completo (v4281, `SQL/patches/2026-10-31_v4281_gobierno_de_datos.sql`), la API no.

### 1.2 Endpoints, operaciones, contratos

| Medida | Valor | Comando / fuente |
|---|---:|---|
| Controllers (`*.controller.ts`) | 309 archivos / 311 clases | `find src -name '*.controller.ts'` |
| Decoradores `@Get/@Post/@Put/@Patch/@Delete` | **1 672** | `find … -exec grep -hE "^\s*@(Get\|Post\|Put\|Patch\|Delete)\(" {} +` |
| Operaciones con detalle (`inventario/endpoints/*.json`, 73 archivos) | **1 642** (1 633 `CONTRATO` + 9 `CONTRATO_AUSENTE`) | python sobre los JSON |
| Operaciones en `indice.json` / `mapa.json` | **1 627** | `indice.json .resumen.total` — 15 menos que el detalle (incoherencia interna del inventario) |
| Controllers del código sin ninguna operación inventariada | **12 (63 rutas)** | comparación de nombres de clase código ↔ `codigo.controlador`: `AdmissionsController` 14, `AuthzGovernanceController` 10, `ClinicalImportController` 8, `AdminServiceCatalogController` 7, `PharmacyIntegrationSyncController` 5, `AdminDataQualityController` 5, `PharmacyBulkController` 4, `GovernanceReadController` 3, `OwnAdmissionController` 3, `AdminPrivacyRequestsController` 2, `AuthzModulesCatalogController` 1, `PharmacySiteAvailabilityController` 1 |
| Operaciones del inventario con ruta que ya no existe en el código | ≥ 39 claves (método+ruta) sin par, incl. 5 `DESCONOCIDO`, y `/insurance-campaigns*` vs `/insurance/campaigns*` | comparación normalizada de rutas (aproximada: mi parser de prefijos no resuelve todo) |

Cobertura de **contrato por operación** (sobre 1 642):

| Contrato | Con | % | Nota |
|---|---:|---:|---|
| Cuerpo de petición (DTO + campos) | 1 015 | 61,8 % global / **87,8 % de las 1 156 mutantes** (POST/PUT/PATCH/DELETE) | 141 mutantes sin cuerpo declarado: sin verificar cuántas son acciones sin payload |
| Parámetros (path/query) | 1 108 | 67,5 % | |
| Respuesta (DTO + campos) | 1 447 | 88,1 % | 195 sin DTO de respuesta |
| Respuestas posibles (códigos de error con causas) | 1 627 | 99,1 % | |
| Descripción de **campos** del cuerpo | 4 344/6 909 | 62,9 % | |
| Descripción de **campos** de la respuesta | 8 695/13 623 | 63,8 % | |
| Pruebas enlazadas (`pruebas`) | 940 | 57,2 % | |
| Casos de uso del README enlazados | 554 | 33,7 % | |
| Eventos / trabajos enlazados | 102 | 6,2 % | |
| Datos personales (`datosPersonales`) | 0 | **0 %** — `SIN_FUENTE` en las 1 642 | |

**Tablas afectadas por operación:**

- 1 565/1 642 operaciones (**95,3 %**) declaran tablas; 77 (4,7 %) están marcadas `sinTablas` (curado en `tools/inventario/curado/sin-tablas.json`).
- 11 279 vínculos operación→tabla: `LEE` 8 158, `ESCRIBE` 3 062 (`CREA` 2 131, `ACTUALIZA` 924, `GUARDA` 7), `BORRA` 59.
  Confianza: `DIRECTA` 9 175 (81,3 %), `POR_SQL` 1 173, `POR_TIPO` 847, `POR_REGISTRO` 84.
- Visto desde las tablas: **947/1 230 (77,0 %)** del catálogo estático son tocadas por ≥ 1 endpoint; 283 no (workers, seeds, jobs, tablas de relleno).
  `solo LEE` 64, con `BORRA` 46.

**Flujos / procesos:**

- `inventario/flujos/procesos.json`: **74** procesos (**72** `MODULO` + **2** `CRITICO`: `critico:scheduling`, `critico:consent`), 757 etapas,
  12 máquinas de estado, 10 hallazgos, `mapa.json` 1 627 rutas.
- Cada operación pertenece a un flujo (100 %), pero solo **562 (34,2 %)** a un caso de uso real (554 del README + 15 curados);
  las otras **1 088 (66,3 %)** están agrupadas "por controlador" (`AGRUPACION_POR_CONTROLADOR`), o sea sin flujo de negocio propio.
- Solo hay 2 procesos transversales entre módulos; Atlas tiene 41 fixtures de proceso de negocio (`workflow-catalog/definitions/processes`).

**Módulo `data_catalog` hoy:** 3 controllers, **41** rutas (el README del módulo dice 37, desfasado), 13 entidades, 6 servicios;
las 41: 2 SYSTEM + 21 `admin/catalog/*` + 16 `admin/portal/*` + 2 más que el README no cuenta (columnas/evidencia, clasificación).
Fuente: `find src/modules/data_catalog -name '*.controller.ts' -exec grep -hE …` → 41.

---

## 2. Explicación de sistema y de negocio: cuánto hay, de dónde sale, qué calidad tiene

### 2.1 Tablas

| Campo | Cobertura | Origen | Calidad |
|---|---|---|---|
| `proposito` (negocio) | 1 230/1 230 con texto | comentarios del `.puml` del módulo (`Mantra Core Health Context/modules/diagram_NN_*.puml`) | estado único `DOMAIN_CURATED_DRAFT` en las 1 230: **0 aprobadas**. 1 230 textos distintos, pero **113 son la misma plantilla** ("Preserva versiones o estados históricos de <X>…", tablas `audit.*_history`). El CSV del modelo declara además 54 tablas `PENDING_REVIEW` sin texto (`docs/data-catalog/tables.csv`) |
| Explicación de sistema (tabla) | 0 | no existe como campo de tabla en el catálogo estático | — |
| `gobierno.appendOnly` | 140 `DECLARADO_EN_README` (130 `audit`, 2 geo, 2 object_storage, 2 messaging, 1 polyglot, 1 system_ops, 1 auth_providers…) / 1 090 `NO_DECLARADO` | `tools/inventario/lib/catalogo-fuentes.mjs:26` (`leerAppendOnly`) lee frases "**Append-only**:" de los `README.md` de módulo | declaración de prosa, no de DDL; ver §3 |
| `gobierno.pii`, `financiera`, `criticaParaAuditoria`, `retencion`, `responsable` | **0 %** (`SIN_FUENTE` en las 1 230) | — | — |
| Dominio | 1 230 (11 dominios) | `docs/architecture/semantic-data-analysis.md:31` | real |

### 2.2 Columnas

- Con `descripcion`: **3 989/16 851 = 23,7 %** (fuentes: `JSDOC_ESTANDAR` 2 727, `JSDOC_ENTIDAD` 1 208, `MODELO_PUML` 54; `indice.json`).
- **Calidad:** de esas 3 989, **3 487 (87,4 %) son cuatro frases** ("Identificador único de la instancia." 1 075; "Fecha y hora en que se creó el
  registro." 928; "Versión usada para controlar actualizaciones concurrentes." 760; "Fecha y hora de la última actualización." 724).
  Solo 477 textos distintos en total ⇒ contenido propio ≈ **502 columnas = 3,0 %**.
- `SIN_DATO`: 12 862 (76,3 %). Tablas con todas las columnas descritas: **3** de 1 230.
- `clasificacion` de columna: `SIN_FUENTE` en las 16 851.

### 2.3 Schemas

`src/modules/data_catalog/domain/schema-descriptions.generated.ts` (736 líneas, generado por `tools/catalog/generate-schema-descriptions.mjs`
desde `SALUD/Módulos/M*.md`): 67 fichas, **solo por schema**. `business: null` en 8 (accounting, billing, clinical, clinical_ext, deployment,
integrity, platform, portal_catalog). El campo `system` es una frase armada con métricas ("Módulo 16 del modelo: 42 tablas o vistas
modeladas…"), no una explicación de sistema.

### 2.4 La fuente más rica que existe y no se usa: la bóveda

`/home/user/mantra_core_technologies_health_docs/SALUD/Entidades/` tiene 2 551 notas; cada una trae `Negocio`, `Ejemplo concreto`,
**`Por qué no debe eliminarse del modelo`** y `Sistema`. Medido (normalizando nombres/números): `Por qué no debe eliminarse` → 31 plantillas
cubren 2 465 notas (la mayor, 1 190); `Sistema` → 11 plantillas cubren 2 468; `Negocio` → 229 plantillas, 2 349 notas en plantillas de ≥ 3.
(La mezcla de entidades y conjuntos de índices en ese recuento no pude separarla limpiamente.) El propio
`tools/catalog/README.md` lo reconoce ("De 2 601 notas, 111 variantes de «Negocio» cubren 2 580 textos… 26 tablas completas con texto propio").
`yarn catalog:import-vault` lo lleva a `/admin/catalog/*` como borrador `IMPORTED_VAULT`, pero es **manual** (`--apply --schema`, con credenciales y API viva).
Ni el catálogo estático ni un seeder lo consumen.

### 2.5 Operaciones

`explicacion.negocio` y `explicacion.sistema` están en estado `AUTO_DETECTADA` en **1 642/1 642**; el texto de negocio sale del `summary`
de OpenAPI + el dominio ("Registro de activos fijos de una práctica. Dominio: Financiero y ERP."); el de sistema es una descripción mecánica
(controller:línea, roles, servicio, tablas). Es útil como mapa, **no** es explicación de negocio revisada. `revision` = `AUTO_DETECTADA` en todas.

---

## 3. MUTABILIDAD — lo que se sabe con evidencia y lo que no

### 3.1 Dónde vive hoy la información (fuentes reales)

| # | Fuente | Qué dice | Fuerza |
|---|---|---|---|
| F1 | Trigger `integrity.forbid_mutation()` / `forbid_truncate()` (`SQL/_integrity/00_integrity_functions.sql:7-20`), enganchado en `SQL/NN_*/05_constraints.sql`, parches y `SQL/pay/*/ddl.sql` | barrera física de UPDATE y/o DELETE (y TRUNCATE) | **DB, fuerte** |
| F2 | `REVOKE … FROM mantra_app` dentro de `DO $$ IF EXISTS (rol mantra_app)` (parches v4279/v4280/v4281, `2026-08-05_tenant_rls.sql:161`) | privilegio real del rol de la app | **DB, fuerte** pero condicional a que el rol exista |
| F3 | `REVOKE … FROM PUBLIC` (`SQL/NN_*/05_constraints.sql`, 71 sentencias contando funciones) | casi nominal: la app no accede vía `PUBLIC` | débil |
| F4 | Estereotipos `.puml`: `<<IMMUTABLE>>` 48 tablas, `<<APPEND_ONLY>>` 4, `<<HISTORY>>` 124 (123 `audit.*_history`), `<<LOG>>` 137, `<<VERSIONED>>` 12 (excluyendo el módulo 33) | **intención** de diseño | declarado, no impuesto |
| F5 | Matriz de integridad (módulo 33, `SQL/_integrity/integrity-matrix.md:40,127,161-166,202`): `UPDATE_DELETE forbidden` | 7 tablas con regla explícita | declarado |
| F6 | `README.md` de módulo, "**Append-only**:" | 140 tablas en el catálogo estático (130 `audit`) | prosa |
| F7 | `system_ops.entity_registry` (`SQL/11_system_ops/02_tables.sql:36`): `is_append_only`, `is_soft_delete`, `has_history`, `history_table`, `retention_policy_id`, `write_policy_id`, `contains_pii/phi`, `owner_team` | **el lugar previsto para esto**, 1 fila por tabla | registro (hoy vacío) |
| F8 | `system_ops.write_policies` (`:79`): `insert/update/delete_mode_concept_id` con conceptos `SO_WRITE_ALLOWED / APPEND_ONLY / SOFT_DELETE / BLOCKED` (`src/modules/system_ops/system_ops.concepts.ts`); `requires_reason`, `requires_approval`, `dual_control` | taxonomía de modos de escritura **ya existe** | modelo, sin datos |
| F9 | `system_ops.retention_policies` (`:99`): `retention_period_days`, `legal_basis`, `disposition` (`SO_DISP_DELETE / ANONYMIZE / ARCHIVE`), `jurisdiction`; `retention_executions`, `record_revisions` | retención | modelo |
| F10 | `system_ops.legal_holds` (`:235`): `target_type` (TABLA / REGISTRO), `target_id`, `status`, `starts_at`, `ends_at` | legal hold | modelo + servicio |
| F11 | Columnas: `deleted_at` en **2** tablas (`community.direct_messages`, `common.files`), `archived_at` en 2 (`community.conversation_participants`, `messaging.in_app_notifications`), `valid_to/effective_to` en 259, `row_version` en 845, sin `updated_at` ni `row_version` en 488 | pistas estructurales | pista, nunca hecho |
| F12 | Comportamiento del código (`inventario/endpoints`): 46 tablas con operación `BORRA` (59 vínculos) | "se borra por endpoint" | evidencia de código |
| F13 | Código de retención: `identity_assurance.identity_evidence_records` (`src/modules/identity_assurance/identity-evidence-lifecycle.config.ts:161`, `identity-evidence-hold-resolver.service.ts`), `src/worker/jobs/time_series/apply-retention.job.ts` (`drop_chunks`), `src/worker/jobs/files/storage-lifecycle.job.ts` | retención/purga/hold **reales** para 3 casos | código |

### 3.2 Lo que se sabe CON evidencia, tabla por tabla

**(a) Barrera física en la base principal — 25 tablas (1,9 % de 1 343)** (trigger F1; todas carecen de `updated_at`/`row_version`):

| Modo | Tablas |
|---|---|
| UPDATE y DELETE prohibidos (6) | `audit.audit_log`; `delegated_access.access_decision_log` (+TRUNCATE; y `REVOKE … FROM mantra_app`); `insurance.claim_adjudication_versions`, `insurance.claim_appeal_decisions`, `insurance.claim_reversals`; `pharmacy_inventory.inventory_ledger_entries` |
| Solo UPDATE prohibido, DELETE permitido por retención (19) | `audit.data_access_log` ("DELETE: retention purge only (UC-10-09)", `10_audit/05_constraints.sql:16-24`); `delegated_access.shared_access_link_uses`; `clinical_ext.cds_rule_versions`; `telemetry.client_error_events`; 8 de `data_catalog` (`catalog_annotation_revisions`, `catalog_change_acknowledgements`, `catalog_change_events`, `catalog_evidence_items`, `catalog_glossary_term_revisions`, `catalog_review_decisions`, `quality_issue_events`, `quality_score_snapshots`); 7 de `observability` (`alert_evaluations`, `dependency_probe_runs`, `error_events`, `http_request_minute_series`, `slow_request_samples`, `sql_statement_minute_series`, `worker_tick_minute_series`) |
| Inmutabilidad **parcial por ciclo de vida** (1) | `system_ops.governance_policy_revisions`: trigger propio `guard_governance_policy_revision` (`patches/2026-10-31_v4281_gobierno_de_datos.sql:792-822`): lo propuesto no cambia, la decisión no se reescribe, el estado no retrocede, DELETE prohibido |

**(b) Barrera física en las bases `pay` — 18 tablas** (`SQL/pay/*/ddl.sql`, función local `forbid_mutation()` + `*_no_truncate`):
`connector_api_attempts`, `connector_callback_events`, `contract_acceptances`, `contract_versions`, `fee_schedule_channels`,
`fee_schedule_versions`, `ledger_legs`, `ledger_rejections`, `ledger_statement_lines`, `ledger_transactions`, `reveal_audit`,
`risk_assessments`, `risk_rule_sets`, `settlement_audit`, `webhook_delivery_attempts` (UPDATE+DELETE+TRUNCATE); y `connector_charges`,
`connector_refunds`, `connector_transfers` con triggers de *monotonía* (`connector_money_flags_monotone`, `connector_charges_send_claims_monotone`) + TRUNCATE prohibido.

**(c) Privilegio real revocado a `mantra_app` — 14 tablas:** `observability` ×7 y `telemetry.client_error_events` (UPDATE, TRUNCATE),
`delegated_access.access_decision_log` (UPDATE, DELETE, TRUNCATE), `data_catalog` ×4 (UPDATE, TRUNCATE; `catalog_glossary_term_revisions`,
`quality_issue_events`, `quality_score_snapshots`, `catalog_change_acknowledgements`), `system_ops.governance_policy_revisions` (DELETE, TRUNCATE).
Hay un `REVOKE … FROM PUBLIC` adicional en las otras; no he verificado qué privilegios tiene el rol real en una base desplegada.

**(d) Declaradas inmutables/append-only y SIN barrera (intención sin impuesto):**

- `<<IMMUTABLE>>`/`<<APPEND_ONLY>>` (52 tablas, tras unificar `health_data_platform`→`health_data`): **solo 6 tienen trigger** (`access_decision_log`,
  3 de `insurance`, `inventory_ledger_entries`, `client_error_events`); **46 sin barrera**, p. ej. `chart.clinical_note_signatures`, `chart.clinical_note_versions`,
  `consent.consent_events`, `consent.consent_evidence`, `diagnostics.diagnostic_report_versions`, `diagnostics.result_verifications`,
  `diagnostics.specimen_chain_of_custody_events`, `identity_assurance.identity_assertions`, `forms.field_value_provenance`,
  `platform_ops.change_approvals`, los 9 `procedures_perioperative.*` (operative_reports, operative_findings, procedure_outcomes…), `health_data.health_provenance_records`, `telemetry.user_activity_events`.
- **123 tablas `audit.*_history`** (`<<HISTORY>>`, y "append-only" según el README del módulo `audit`): **0 con trigger o REVOKE**. Solo `audit_log` y `data_access_log` lo tienen.
- Las 19 tablas que SÍ están protegidas en `data_catalog`/`observability`/`clinical_ext`/`shared_access_link_uses` **no están declaradas** en ningún estereotipo ni en el README (la barrera se agregó en parches sin tocar el `.puml`) → el modelo se contradice a sí mismo en ambas direcciones.

**(e) Conflictos modelo ↔ código (a resolver ANTES de imponer triggers):** tablas declaradas inmutables/append-only cuyo código hace `ACTUALIZA`/`BORRA`
(`inventario/endpoints`, confianza `POR_TIPO`/`POR_REGISTRO`, es decir **inferido, no probado**):
`chart.clinical_note_versions` (`chart-notes.service.ts:558`), `diagnostics.diagnostic_report_versions` (`diagnostics-reports.service.ts:190`, "release"),
`forms.field_definition_set_versions` (`forms-schema.service.ts:164`, "publish"), `procedures_perioperative.operative_reports` (`periop-intraop.service.ts:648`, "sign"),
`common.file_versions` (ACTUALIZA `files.service.ts:483` y BORRA por SQL en `identity-evidence-disposition.repository.ts:147`), `audit.conditions_history`,
`audit.medication_requests_history`, `audit.appointment_bookings_history` (`ACTUALIZA` `POR_REGISTRO`: probablemente es el INSERT de la copia; no verificado),
`audit.data_access_log` (BORRA — legítimo, es la purga por retención). Muchos son **ciclo de vida de una versión** (liberar, firmar, publicar): son `LIFECYCLE_ONLY`, no `APPEND_ONLY`.

**(f) Borrado duro por endpoint (F12):** 46 tablas, entre ellas catálogos operativos (`scheduling.*` ×4, `profiles.*` ×5, `terminology.*` ×4, `graph_intelligence.*` ×7, `vector_rag.*` ×3),
`common.files`, `identity_assurance.identity_evidence_records`. Para ninguna hay hoy una política de retención ni de hold en el registro.

**(g) Soft-delete:** solo `common.files` y `community.direct_messages` (`deleted_at`) y archivado en 2 más (F11). **No hay `is_deleted`** en el modelo.
El soft-delete por estado (`state_concept_id`/`status`) existe pero **no se puede afirmar sin una `write_policy`** (no inferir).

**(h) Retención y legal hold con efecto real:** 1 entidad con ciclo propio (`identity_evidence_records`: `RETENTION`/`PURGE`, política por código, `legal_holds`/holds de archivo/objeto resueltos por
`IdentityEvidenceHoldResolverService`), `time_series` (política `TS_RETENTION_POLICIES`, `drop_chunks`), almacenamiento de archivos. El barrido genérico
`POST /internal/governance/retention-executions/run` (`RetentionExecutionService`) **no puede disponer ninguna entidad**: `RETENTION_DISPOSITION_EXECUTORS` está en `useValue: []`
(`src/modules/system_ops/system_ops.module.ts:79`, comentario "Hoy ninguna entidad de negocio tiene uno"). Resultado: política de retención y legal hold son
catálogo sin tabla a la que apliquen salvo el caso de identidad.

### 3.3 Lo que NO se sabe (y no debe inventarse)

- Para **~1 200 de las 1 343 tablas** no hay ninguna fuente F1–F9 que diga si se pueden actualizar, borrar o purgar. Hay 845 con `row_version` (sugiere UPDATABLE) y 488 sin `updated_at`/`row_version` (sugiere append-only/derivada), pero **solo 25** de esas 488 están impuestas: las otras 463 son candidatas sin decidir.
- `retención`, `PII/PHI`, `responsable` por tabla: **0 datos** (catálogo estático `SIN_FUENTE` ×1 230; `entity_registry` vacío).
- Qué `retention_period_days`, base legal y jurisdicción corresponden a cada tabla: son **decisión de cumplimiento** (regla 97.5.4: parámetros regulatorios no se infieren). Hay que registrarlos como ambigüedad con responsable, no derivarlos.
- Estado real en una base desplegada (triggers instalados, privilegios del rol, holds activos): no medido (§7).

### 3.4 Taxonomía mínima propuesta (reutiliza lo que el modelo ya tiene; no crea conceptos nuevos)

Dos ejes + un nivel de evidencia, en vez de un enum único (una tabla puede ser a la vez purgable y `APPEND_ONLY`):

**Eje 1 — `write_mode` (mapea 1:1 a `system_ops.write_policies` / `SYSOPS.WRITE_MODE_*`; `is_append_only`, `is_soft_delete` del registro):**

| Valor | Significado | Se deriva de (en este orden de fuerza) |
|---|---|---|
| `APPEND_ONLY` | INSERT sí; UPDATE, DELETE y TRUNCATE no | F1 con `UPDATE OR DELETE` + F2; si no, F5/F4 → queda `DECLARED` |
| `APPEND_ONLY_PURGEABLE` | UPDATE no; DELETE solo por retención | F1 `BEFORE UPDATE` solo + DELETE otorgado a `mantra_app` (`audit.data_access_log`, `observability.*`, `data_catalog.*_events`) |
| `LIFECYCLE_ONLY` | solo se mueve el estado/decisión, lo propuesto es inmutable | trigger propio (F1 variante, `governance_policy_revisions`) o `write_policy.update=ALLOWED con requires_approval`; **nunca por inferencia** |
| `UPDATABLE` | INSERT/UPDATE; DELETE no | existe `row_version`/`updated_at` **y** ningún `BORRA` en código **y** no hay F1/F4; se marca `INFERRED`, no `ENFORCED` |
| `UPDATABLE_DELETABLE` | INSERT/UPDATE/DELETE duro | F12 `BORRA` con confianza `DIRECTA`/`POR_SQL` |
| `SOFT_DELETE` | se marca, no se borra | F11 (`deleted_at`/`archived_at`) **o** `write_policy.delete=SOFT_DELETE` |
| `UNKNOWN` | sin evidencia | todo lo demás (no rellenar) |

**Eje 2 — `disposition` (mapea a `retention_policies` + `SYSOPS.DISPOSITION_*`):** `KEEP` / `PURGE_BY_RETENTION` / `ANONYMIZE` / `ARCHIVE`, más `retention_policy_code` y `legal_basis`
solo cuando existe fila en `retention_policies` o código que lo ejecute (F13). Sin política → `UNKNOWN` (no `KEEP`).

**Eje 3 — `legal_hold`:** `HOLD_AWARE` (existe resolver/ejecutor que consulta `legal_holds` para esa entidad: hoy solo identidad) / `HOLD_CAPABLE_NOT_ENFORCED`
(la tabla es objetivo posible de `legal_holds.target_type=TABLE` pero ningún barrido la consulta) / `NONE`. Más el conteo vivo de holds `ACTIVE` (`catalog.repository` ya cuenta holds en `legal-hold.repository`).

**Nivel de evidencia (obligatorio en cada valor, para no mentir):** `ENFORCED_DB` (trigger o REVOKE a `mantra_app`) > `ENFORCED_CODE` (única vía de escritura en el código) > `DECLARED_MODEL` (puml/matriz) > `DECLARED_DOC` (README) > `INFERRED` (estructura de columnas) > `UNKNOWN`.
La UI y la API deben mostrar siempre valor **y** nivel; mostrar "No" por ausencia es lo que Atlas retiró en `entity-governance-summary.tsx:40-42` por engañoso.

Chequeos de contradicción que el catálogo debe calcular y exponer: `DECLARED_MODEL` sin `ENFORCED_DB` (46 tablas hoy + 123 history), `ENFORCED_DB` sin declaración (19), `APPEND_ONLY` con `BORRA/ACTUALIZA` en código (9 hoy).

---

## 4. Seeders — cómo se siembra hoy el catálogo y si repiten limpio

| Dato | Mecanismo | Idempotente (evidencia) | Veredicto |
|---|---|---|---|
| `catalog_objects/columns/change_events` | **no es seed**: escaneo de `pg_catalog` por la sonda `scan-tick` (`src/worker/jobs/data_catalog/scan-tick.job.ts`) → `POST /internal/catalog/scans/run-next` | `planScan` (`domain/catalog/scan-diff.ts`) + índice único parcial de un escaneo activo + `claimScan`/fencing (README del módulo); `scan-diff.spec.ts` | diseño idempotente; **no ejecutado** (sin DB) |
| `catalog_operations / _impacts / catalog_processes / _steps / _step_operations` | `InventoryImportService` (`POST /internal/catalog/inventory/import`, tras un escaneo OK) leyendo `inventario/` | `import-plan.spec.ts:318-347` ("una segunda corrida con el mismo inventario no escribe nada") + `test/integration/data-catalog-inventory-import.int-spec.ts:364` ("no toca ninguna fila"; compara `row_version`/`updated_at`). Lock `pg_advisory_xact_lock` (`catalog-inventory.repository.ts:55`), huella `technical_hash` | idempotente **por diseño y por prueba escrita**; unitaria ejecutada: 91 pruebas verdes (§7) |
| `data_catalog.catalog_annotations` (fichas de tabla/columna) | (1) `catalog:import-vault` manual → API (`IMPORTED_VAULT`, borrador); (2) clasificación automática `AUTO_CLASSIFIER` (`classification.rules.ts`) tras cada escaneo | README de `tools/catalog`: idempotente por hash de nota; `column-classifier.spec.ts` | el (1) **no es seeder**: requiere bóveda + credenciales + `--apply`; sin él las fichas están vacías |
| Descripciones de schema | `schema-descriptions.generated.ts` (`yarn catalog:schemas --check`) | determinista por SHA-256 de la bóveda | OK, pero solo nivel schema |
| Roles del catálogo | `data_catalog.roles.ts` (5 roles GLOBAL) sembrados por la API | `data_catalog.roles.spec.ts` | OK |

**Sin seeder (el catálogo vivo no puede arrancar con contenido):**

- `catalog_glossary_terms*` — (`src/common/seed/glossary-*.ts` es el **glosario médico** de `terminology`, no el glosario de datos); la API de 66 términos del portal sale de `inventario/glosario.json`, no de la tabla.
- `catalog_lineage_edges`, `catalog_stewardships`, `catalog_certifications`, `quality_rules`, `quality_rule_runs`, `quality_issues*`, `quality_score_snapshots`: sin entidad ni seeder.
- `system_ops.data_domains`, `data_classifications`, `entity_registry`, `field_registry`, `write_policies`, `retention_policies`, `anonymization_rules`, `legal_holds`, `partition_specs`: **ningún seeder en `src/common/seed`** (`grep -rln "retention_policies\|write_policies\|data_classifications\|data_domains\|entity_registry" src/common/seed` → vacío; solo hay conceptos en `system_ops.concepts.ts`).
- El paquete de seeds del modelo (`seedsGenerales/modules/11_system_ops.seeds.json`, `boot` 125 filas) **no lo carga la API** y trae relleno: `entity_registry` con 10 filas cuyo `schema_name`/`table_name` es **"Core Entity Registry", "Standard Entity Registry"…** (no son tablas reales), 8 con `is_append_only=true`; `retention_policies` con `retention_period_days = 1`.
  Cargarlo tal cual contaminaría el registro con datos ficticios presentados como reales (regla 00 §2.1 / 97.4.1). Que el modelo lo marque `boot` es un riesgo en sí.
- `inventario/` (catálogo estático, operaciones, flujos) se regenera con `yarn inventario:*` a mano y viaja en la imagen; no hay gate que falle cuando el código se movió (`yarn inventario:verificar` ejecutado hoy: **falla** con 150 archivos de endpoints y 81 de catálogo desfasados, §7).

---

## 5. Comparación con Atlas (AtlasBackend + AtlasAdminPortal)

Hechos verificados. "Mantra no tiene" = no hay equivalente persistido/expuesto hoy.

### 5.1 Lo que Atlas tiene y Mantra no

| # | Capacidad de Atlas | Evidencia en Atlas | Estado en Mantra |
|---|---|---|---|
| A1 | **Narrativa curada por tabla (5 preguntas)**: `business_why_exists`, `business_why_not_delete`, `business_decision_contribution`, `business_usage_example`, `systems_explanation`, + `narrative_source` (`CURATED`/`DOMAIN_TEMPLATE`) con índice parcial para medir la deuda documental | `src/database/migrations/20260727120000-add-entity-business-narrative-columns.ts` (comentario 11-35, DDL 38-55); **222 narrativas** escritas a mano en `src/modules/systems-ops/entity-narratives/*.fixtures.ts` (`grep -ho "whyExists:" … \| wc -l` = 222) | `catalog_annotations` tiene los campos (`purpose`, `existence_rationale`, `deletion_impact`…, `SQL/67_data_catalog/02_tables.sql:110`) pero **0 fichas sembradas**; 26 tablas con texto propio en la bóveda; sin marca CURATED/TEMPLATE medible por tabla (sí hay `/admin/catalog/coverage`) |
| A2 | **Catálogo de campos persistido con significado por columna**: `business_name`, `business_meaning`, `technical_meaning`, `why_store`, `who_uses`, `audit_usage`, `analysis_usage`, `decision_usage`, `backend_write_behavior`, `data_nature`, `classification_code`, `sensitivity_level`, `contains_pii/financial/risk…`, `quality_rules_json`, `validation_rule_json`, `retention_policy_code`, `source_kind`, `payload_paths_json` | `20260705113000-add-systems-business-metadata-governance.ts:121-170` (`system_data_field_catalog`) | `catalog_columns` (técnico, 24 cols) + ficha de columna (34 cols) vacía; estático 3 % con contenido propio |
| A3 | **Cola de revisión unificada** (endpoints, requisitos de tools, entidades, impactos de datos, impactos de campos, columnas) con `PATCH …/review` | `systems-review.controller.ts:59,70,85,100,115,130,145`; tabla `system_catalog_review_events` | solo `POST /admin/catalog/annotations/:id/review` (tabla/columna) |
| A4 | **Impacto endpoint↔tabla↔campo persistido y consultable en ambos sentidos** (`impact/by-endpoint`, `impact/by-table`; tablas `system_endpoint_data_entity_impacts`, `system_endpoint_field_impacts`, `system_endpoint_payload_contracts`, `system_endpoint_tool_requirements`) | `systems-catalog.controller.ts:236,245`; `20260705113000-add-systems-ops-rich-metadata-tables.ts:73` | `catalog_operation_impacts` (import del inventario) + linaje estático `GET /admin/portal/linaje` + `…/objects/:id/impact` (solo FKs); no hay "por campo" |
| A5 | **Glosario de negocio y linaje oficial con API y portal** | `internal-metadata.controller.ts:65,75,93,101,110,124`; portal `AtlasAdminPortal/src/features/{business-glossary,lineage-official,business-metadata,governed-views}` | tablas en el modelo (`catalog_glossary_terms`, `catalog_lineage_edges`, `catalog_stewardships`, `catalog_certifications`) **sin entidad/API/seed**; glosario del portal = JSON estático de 66 términos |
| A6 | **Registro de versiones de esquema con aprobación de cambios**: `schema_versions → schema_tables → schema_columns → schema_relationships`, `change-log` con `PATCH …/approve` | `schema-management.controller.ts:84-208`; `20260706040000-phase-4a-create-schema-tables.ts:18-24` | `catalog_change_events` (cambios detectados por escaneo, WORM) sin flujo de aprobación; `catalog_change_acknowledgements` (modelo) sin API |
| A7 | **Descubrimiento y refresco de endpoints por API** (`POST endpoints/discover`, `endpoints/catalog-seed/refresh`, `data-entities/infer-impacts`, `tools/infer-requirements`) | `systems-catalog.controller.ts:104,113,146,155` | inventario offline (`yarn inventario:*`), importado por `inventory/import`; sin refresco por API y desfasado (§1.2) |
| A8 | **Federación de catálogos de plataforma** (`blocks/federate`) | `systems-network.controller.ts:38-72`, `platform-catalog-federation.*` | no aplica hoy |
| A9 | **Reglas y issues de calidad con portal** | `data-quality.controller.ts`, `internal-portal.controller.ts:91-103`; portal `data-quality-rules`, `data-quality-issues` | `governance_admin` opera sobre `health_data_quality_*`; `data_catalog.quality_*` (6 tablas) sin API |
| A10 | Reglas operativas del dominio (`system_operational_rule_catalog`) | migración `…add-systems-ops-rich-metadata-tables.ts:203` | `catalog_annotations.process_supported/source_of_truth/producers/consumers` (campos), sin datos |
| A11 | Registro de tablas con `is_append_only` + `is_tenant_scoped` **derivado de la estructura** (sin `_updated_at` ⇒ append-only; con `_tenant_id` ⇒ tenant-scoped) | `20261001220000-resync-schema-catalog-from-introspection.ts:106-130` | no hay; ver nota |

### 5.2 Lo que Mantra tiene y Atlas no (para no copiar a ciegas)

- Escaneo vivo de `pg_catalog` con lease/fencing, deriva por `technical_hash`, WORM de revisiones/decisiones/evidencia/eventos (`catalog_*`), segregación de funciones en la revisión (`SELF_REVIEW` 403), edición con `expectedVersion`.
- Catálogo estático de **1 230 tablas / 16 851 columnas / 8 267 índices / 7 069 relaciones** con deriva ORM↔DDL, **1 642 operaciones con DTO de petición y respuesta, errores posibles y tablas con confianza**, 74 procesos/757 etapas/12 máquinas de estado (Atlas: 41 fixtures de proceso; narrativa solo para 222 tablas).
- Clasificación automática de columnas (Safe Harbor/LGPD art. 11) y deriva de permisos (`/admin/catalog/permission-drift`).
- `system_ops.entity_registry/write_policies/retention_policies/legal_holds` **ya modelados** (Atlas no los tiene).

### 5.3 Mutabilidad: Mantra puede superar a Atlas, no igualarlo

Atlas tampoco tiene gobierno de mutabilidad real: **retiró** el bloque "Reglas operativas (append only, update, delete, hard delete, aprobación)" porque "el catálogo no guarda esas reglas y la pantalla las enseñaba como «No» para toda tabla"
(`AtlasAdminPortal/src/features/data-catalog/entity-governance-summary.tsx:40-42`), y su `is_append_only` en `schema_tables` es una heurística estructural (migración citada en A11). Solo conserva `retention_policy_code` y `is_audit_critical`.
Mantra ya tiene el modelo (`entity_registry`, `write_policies`, triggers WORM, `legal_holds`); le falta **poblarlo con evidencia y exponerlo**.

---

## 6. Brechas priorizadas y plan de cierre

Reglas que condicionan el plan: el esquema fluye modelo → DDL → entidades (97.1); todo `ALTER` va por el modelo (`salud-db/gen_ddl.py` / `gen_entities.py`); sin datos ficticios (97.4); un doble no es el colaborador real (65).

### P0 — datos que hoy son falsos o inexistentes

1. **Inventario desfasado (la base de todo).** Regenerar y gatear.
   - Regenerar `yarn inventario:endpoints|flujos|catalogo|deriva-bd`; incluir parches en la base de referencia de `tools/inventario/deriva-bd.mjs` (hoy "sin SQL/patches") para recuperar las 113 tablas / 57 diferencias de columnas.
   - Cubrir los 12 controllers (63 rutas) sin operación; arreglar el desfase `indice.json` 1 627 vs detalle 1 642; resolver los `DESCONOCIDO`.
   - Gate en CI/manual: `yarn inventario:verificar` + comparar nº de decoradores vs `resumen.total`. Archivos: `tools/inventario/endpoints.mjs`, `catalogo.mjs`, `lib/catalogo-fuentes.mjs`, `lib/inventario-endpoints.mjs`.
2. **Mutabilidad v1 (prioridad máxima del cliente).** Ver 6.A.
3. **Relleno en `seedsGenerales/11_system_ops`:** cambiar el generador (`salud-db/gen_seeds.py`, no el JSON) para que `entity_registry` boot salga **vacío o con tablas reales**, y `retention_policies` sin `retention_period_days=1`. Registrar como ambigüedad con Cumplimiento los períodos reales (97.5.4).

### 6.A Plan de mutabilidad (pasos accionables)

| Paso | Qué | Archivos probables |
|---|---|---|
| M1 | Extractor de evidencia **estático**: parsear triggers `forbid_mutation/forbid_truncate`, `guard_*`, `REVOKE … FROM mantra_app` de `SQL/**/*.sql` (modelo) + estereotipos `.puml` + matriz del módulo 33 + `deleted_at/archived_at/valid_to/row_version` + operaciones `BORRA`. Emite `gobierno.mutabilidad = {writeMode, nivelEvidencia, fuentes[]}` por tabla. Copiar como dato, no leerlo en runtime del repo del modelo | `tools/inventario/lib/mutabilidad.mjs` (nuevo), `tools/inventario/lib/catalogo-fuentes.mjs` (donde hoy está `leerAppendOnly`), `tools/inventario/catalogo.mjs`, `inventario/catalogo/*.json` |
| M2 | Extractor **vivo**: en el escaneo, leer de la base real `pg_trigger` (funciones `integrity.forbid_*`) y `has_table_privilege('mantra_app', …, 'UPDATE'/'DELETE'/'TRUNCATE')` por tabla; guardar el nivel `ENFORCED_DB` verificado. Si hay que persistir columnas nuevas en `catalog_objects` → **primero el modelo** (parche + `gen_ddl.py` + `gen_entities.py`) | `src/modules/data_catalog/infrastructure/repositories/scan.queries.ts`, `domain/catalog/scan-diff.ts`, modelo `SQL/67_data_catalog` |
| M3 | **Poblar `system_ops.entity_registry`/`write_policies`** con un seeder idempotente (ID estable `schema.tabla`, 2.ª corrida = 0 inserts) desde la salida de M1/M2, con nivel de evidencia en `notes`; las tablas `UNKNOWN` se registran como `UNKNOWN`, no como `UPDATABLE`. Reusa `GovernanceCatalogService` | `src/common/seed/` (nuevo `entity-registry-seed.service.ts` + spec), `src/modules/system_ops/services/governance-catalog.service.ts`, `system_ops.concepts.ts` (conceptos `SO_WRITE_*` ya existen) |
| M4 | **Exponer** en la ficha: bloque Mutabilidad (valor + nivel + fuentes + contradicciones), filtros "append-only / borrable / soft-delete / con retención / con hold / sin evidencia" y cobertura de mutabilidad en `/admin/catalog/coverage`. Hoy `catalog.repository.ts:662-690` y `catalog-read.service.ts:204-221` ya devuelven `isAppendOnly/isSoftDelete/hasHistory` pero 0 filas | API: `catalog-read.service.ts`, `catalog-response.dto.ts:128`, `portal-response.dto.ts`; front: `features/admin/data-catalog/object-detail/catalog-object-detail.html:92`, `features/admin/portal/tables/tables-page.{html,ts}` (hoy el filtro `appendOnly` usa el README) y `portal/tables/table-detail-page.html` |
| M5 | **Resolver contradicciones** antes de imponer nada: 46 declaradas sin barrera + 123 `_history`: decisión por tabla (¿trigger?, ¿`LIFECYCLE_ONLY`?). Imponer por parche del modelo solo donde el código no haga UPDATE (los 9 conflictos de §3.2e primero). Cada parche con deriva verde y prueba de UPDATE/DELETE rechazado | modelo `SQL/patches/…`, `05_constraints.sql`; API `test/integration/*` |
| M6 | **Retención y hold con efecto**: registrar al menos `PURGE_BY_RETENTION` en las tablas que el código ya purga (`audit.data_access_log`, `observability.*`, `identity_evidence_records`, `time_series`) y conectar un `RetentionDispositionExecutor` real (hoy `[]`, `system_ops.module.ts:79`); el hold se verifica en el mismo camino | `src/modules/system_ops/services/retention-disposition.executor.ts`, `retention-execution.service.ts` |

### P1 — explicación y contratos

4. **Explicación de tabla/columna real.** (a) Importar la bóveda (`Entidades/`) al seed estático como borrador **marcando plantilla vs. propia** (la bóveda tiene 31 plantillas de "por qué no se elimina"); (b) escribir a mano el top de tablas críticas (clínicas, consentimiento, auditoría, dinero) hasta igualar las 222 de Atlas; (c) columnas: sacar el JSDoc estándar de la métrica de cobertura (o sea, 3 % real) y exigir texto propio para PK/FK/estado/PII. Archivos: `tools/inventario/lib/catalogo-fuentes.mjs`, `tools/catalog/import-vault-annotations.mjs`, `inventario/catalogo/*.json`.
5. **PII/financiera/retención/responsable por tabla**: poblar `data_classifications` + `field_registry` con la salida de `classification.rules.ts` (ya existe) y exponer; hoy `SIN_FUENTE` ×1 230.
6. **Operaciones**: `explicacion` curada para las ~200 de riesgo `ALTO`; reducir las 1 088 "por controlador" a flujos de negocio (mapear al menos los 2 `CRITICO` actuales a los flujos clínicos y de dinero); `datosPersonales` desde `field_registry`.

### P2 — paridad con Atlas

7. Entidades + repositorios + endpoints + seeds para las 12 tablas de gobierno de v4281 (glosario, linaje oficial, mayordomía, certificaciones, calidad, acuses de cambio): `src/modules/data_catalog/{entities,infrastructure/repositories,presentation}`, generando con `gen_entities.py 67`.
8. Cola de revisión unificada (operaciones, impactos, columnas) y flujo de aprobación de cambios de esquema sobre `catalog_change_events`/`catalog_change_acknowledgements`.
9. Refresco por API del inventario (`inventory/import` ya existe: falta el disparo desde el deploy/CI).
10. Actualizar `src/modules/data_catalog/README.md` (dice 37 rutas; hay 41).

---

## 7. Lo que NO pude medir (y por qué)

- **Estado vivo del catálogo** (`catalog_objects`, fichas, holds `ACTIVE`, cobertura real, triggers/privilegios instalados): no hay PostgreSQL (`pg_isready` → "no response"). Los números del catálogo vivo (tablas observadas, % de fichas aprobadas) son **desconocidos**.
- **Idempotencia ejecutada:** SÍ la unitaria. `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js src/modules/data_catalog/domain/catalog/import-plan.spec.ts src/modules/data_catalog/domain/classification` (bajo `flock /tmp/claude-0/heavy.lock`) → `Test Suites: 2 passed, 2 total · Tests: 91 passed, 91 total` (incluye "una segunda corrida con el mismo inventario no escribe nada", `import-plan.spec.ts:330`). Es la prueba del **plan puro**; la integración contra Postgres real (`data-catalog-inventory-import.int-spec.ts:364`) y los seeds NO se ejecutaron (sin base). Peldaño: `TESTED` para el plan, `DISCOVERED` para la escritura real.
- **`yarn inventario:verificar` ejecutado** (mismo `flock`): `endpoints.mjs --verificar` → exit 1, "El inventario escrito no coincide con el código (**150 archivo(s)**)"; `catalogo.mjs --verificar` → exit 1, "no coincide con el modelo y el código (**81 archivo(s)**)". Confirma con la herramienta oficial que el inventario **hoy está desfasado** (no es solo mi comparación). `flujos.mjs --verificar` no había terminado al cerrar (salida en el scratchpad `verificar.out`).
- **Conteo de rutas código ↔ inventario** exacto: mi parser de prefijos de `@Controller` es aproximado; el dato firme es la comparación por clase de controller (12 controllers/63 rutas) y 1 672 vs 1 642. `yarn inventario:verificar` daría el dato oficial.
- **Columnas del modelo** (18 739): conteo propio por líneas `"col" tipo` dentro de `CREATE TABLE`; el CSV del modelo da 18 263 para 1 313 tablas (consistente con +30 tablas) pero no lo cotejé columna a columna.
- **Bóveda**: el recuento de plantillas mezcla notas de entidades y de conjuntos de índices (2 475 vs 1 304 entidades oficiales); la conclusión (texto casi todo plantilla) es robusta, el número exacto no.
- **Privilegios reales de `mantra_app`**: solo vi las sentencias de los parches (condicionales a que el rol exista); no sé si el rol de despliegue es el dueño de las tablas (en cuyo caso `REVOKE` no lo limita, solo el trigger).
- **Bases `pay`**: conté 87 tablas y 18 con barrera; no cotejé columnas ni su integración con el catálogo (están fuera de él).
- **Front**: solo comprobé qué muestra de mutabilidad (`tables-page.html:47`, `catalog-object-detail.html:92`); no medí cobertura de pantallas contra el contrato ni hice prueba visual.
- No ejecuté ningún comando que modifique datos; los únicos archivos escritos son este informe y archivos temporales en el scratchpad.

## 8. Decisiones y ambigüedades a confirmar

| Ambigüedad | Supuesto tomado aquí | A quién confirmar |
|---|---|---|
| ¿`audit.*_history` debe ser WORM físico? (README dice append-only; el modelo solo lo protege en `audit_log`/`data_access_log`) | se informa como "declarada sin barrera"; no se impone | dueño del módulo `audit` / Seguridad |
| ¿Las tablas `<<IMMUTABLE>>` con ciclo de vida (liberar, firmar, publicar) son `APPEND_ONLY` o `LIFECYCLE_ONLY`? | `LIFECYCLE_ONLY` hasta decidir | dominios clínicos (chart, diagnostics, forms, periop) |
| Períodos de retención, base legal y jurisdicción por tabla | no se infieren (97.5.4) | Cumplimiento / DPO |
| ¿El `REVOKE … FROM PUBLIC` cuenta como barrera? | no | Infraestructura (roles de despliegue) |
| ¿Se carga el seed `11_system_ops` del modelo? | no, por contener relleno | dueño del modelo (`gen_seeds.py`) |
