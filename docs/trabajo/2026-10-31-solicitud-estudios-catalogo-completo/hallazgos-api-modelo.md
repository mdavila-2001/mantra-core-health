# Hallazgos API + modelo — Solicitud de estudios con catálogo completo

- Fecha: 2026-10-31 · Autor: agente de planificación (solo lectura; no se tocó código ni esquema)
- Repos leídos: `mantra-core-health-model` (HEAD `d99d9d6`, rama `claude/brave-carson-h23qzh` = `dev`),
  `mantra-core-health-api` (HEAD `91f0d3d2`), y lo justo del front para entender el consumo.
- Plan previo: [`../2026-10-31-estudios-muestra-y-region-corporal/PLAN.md`](../2026-10-31-estudios-muestra-y-region-corporal/PLAN.md) (F1–F10). Este informe lo **amplía** y en dos puntos lo **corrige** (§0).
- Peldaño de evidencia: `DISCOVERED`. Nada se ejecutó contra una base: los conteos de corpus salen de leer los NDJSON versionados con `python3`/`zcat`, no de consultas SQL.

---

## 0. Correcciones al plan previo y al pedido

| # | Lo que se decía | Lo que hay | Dónde |
|---|---|---|---|
| C1 | «API NestJS/**TypeORM**» | El ORM es **MikroORM 7** (`@mikro-orm/*` ^7.1.7); las entidades se **generan** con `gen_entities.py` | `mantra-core-health-api/package.json:169-173`, `…/docs/adr/ADR-0002-orm-mikroorm.md`, `mantra-core-health-model/README.md` («entidades MikroORM») |
| C2 | Plan H1.S1.M2: guardar `body_structure_ref` (varchar con el id UBERON/FMA) | Se puede y conviene guardar un **concepto** (`body_site_concept_id` FK) si UBERON/FMA se cargan a `terminology` — ya hay un cargador con procedencia (§1.6). Un varchar sin catálogo no lo puede validar la API: el catálogo del atlas vive sólo en `public/` del front | `mantra-core-health/src/app/core/data-access/anatomy-atlas/anatomy-atlas.types.ts:1-9`, `mantra-core-health-api/tools/terminology-import/dictionaries/README.md:45-50` |
| C3 | Plan F10/Ambig. 2: «¿hay fuente para muestra por análisis?» | Existe un corpus LOINC 2.82 versionado con **1 604 paneles de laboratorio con sus miembros** y el **sistema (muestra) en castellano** en 34 577 términos, pero **sin** la propiedad `system` canónica ni mapeo a HL7 v2-0487. Ver §1.5 | `mantra-core-health-api/tools/terminology-import/lab-tests/` |
| C4 | Plan previo H3: «dos PRs, `dev` y `test` (cherry-pick)» | **Obsoleto.** `test` está dada de baja desde el 30/10/2026: un PR por cambio hacia `dev` (y uno aparte a `mockup` sólo si aplica). Lo dicen igual el front y el API | `mantra-core-health/CLAUDE.md` § Git; `mantra-core-health-api/AGENTS.md` §1.6; modelo: `README.md` § Ramas («toda PR va a `dev`») |
| C5 | Docs que dicen «92 códigos locales» en la orden | Hay **88** conceptos `STUDY_*` (47 LAB, 27 IMG, 5 CAR, 3 PAT, 6 PRO) | `src/modules/clinical/clinical.concepts.ts` (conteo `grep -c "^    STUDY_"` = 88) vs `docs/seed-research/lab-tests.md:31` |

---

## 1. Esquema actual (modelo, fuente única)

Versión del modelo: **4.2.79** (`Mantra Core Health Context/model-manifest.yaml:3`). Flujo obligatorio (ADR-0021, regla 97): `.puml` → `gen_ddl.py` → `SQL/` → base → `gen_entities.py` → entidades (`Mantra Core Health Context/docs/architecture/ddl-sources.md:32-58`; `mantra-core-health-api/docs/adr/ADR-0021-fuente-unica-de-ddl.md`). Los ALTER sobre base viva van a `SQL/patches/` a mano, fechados, idempotentes, fuera de `apply_all.sql`.

### 1.1 La orden: `clinical.service_requests`

- DDL: `SQL/08_clinical/02_tables.sql:219-243`; fuente `Mantra Core Health Context/modules/diagram_08_clinical.puml:265-300`.
- Columnas: `code_concept_id` NOT NULL (qué estudio), `category_concept_id`, `intent_concept_id`, `priority_concept_id`, `status_concept_id` NOT NULL, `requester_profile_id`, `performer_tenant_id` (único que concede acceso al ejecutor), `performer_selection_concept_id`, `performer_practitioner_profile_id`, `suggested_practice_site_id` (patch `SQL/patches/2026-10-25_centros_medicos.sql:43-50`), `previous_diagnostic_report_id` + `duplicate_override_reason` (`…/2026-09-17_v4217_service_requests_duplicate_study.sql`), `form_instance_id` (v4.2.32).
- **No hay** muestra, región, lateralidad, modalidad ni contraste (confirma F1).
- **Granularidad: una fila = un estudio** (`code_concept_id` único por fila, estilo FHIR `ServiceRequest`). **No existe tabla de ítems ni de cabecera** que agrupe varios estudios de una misma solicitud; la única hija es `clinical.service_request_notes` (`02_tables.sql:265-273`), que liga notas que motivan la orden.
- Todo lo de abajo cuelga de **una SR por estudio**, lo que condiciona el diseño (§3.b): `diagnostics.specimens.service_request_id` (`20_diagnostics/02_tables.sql:8`), `laboratory_accessions.service_request_id` (`:339`), `laboratory_work_order_tests.service_request_id` + `test_code_concept_id` (`:385-404`), `imaging_studies.service_request_id` (`:117`), `clinical.observations.based_on_service_request_id` (`08_clinical/02_tables.sql:90`), `clinical.diagnostic_reports.service_request_id` (`:249`), `insurance.insurance_claims.service_request_id` (`SQL/patches/2026-09-13_v4211_patient_order_claim_settlement.sql:10`).
- Índices: `SQL/08_clinical/04_indexes.sql:239-273` (incluye `(custodian_tenant_id, status_concept_id, updated_at DESC)` y `(custodian_tenant_id, patient_profile_id, updated_at DESC)`); **no hay índice por `performer_tenant_id` + estado**, que es la consulta de la bandeja del receptor (sólo `ix_service_requests_performer_tenant_id` simple, `:257`).
- RLS: aislamiento por custodio (`SQL/patches/2026-09-26_v4226_custodian_tenant_rls.sql`, descubrimiento dinámico de tablas con `custodian_tenant_id`) + lectura del ejecutante `service_requests_performer_read` (`…/2026-09-26_v4236_service_requests_performer_read_rls.sql:39-49`). `RLS_ENFORCE=false` por defecto (mismo patch, líneas 16-19).

### 1.2 Diagnóstico ya realizado: `diagnostics.*` (`SQL/20_diagnostics/02_tables.sql`)

| Tabla | Línea | Lo relevante |
|---|---|---|
| `specimens` | 5-28 | `specimen_type_concept_id` NOT NULL (:10), `body_site_concept_id` (:12), `container_type_concept_id`; se crea en recepción |
| `imaging_studies` | 113-137 | `modality_value_set_id` (:122, **un value set, no un concepto**), `body_site_concept_id` (:123); sin lateralidad |
| `imaging_series` | 139-152 | `modality_concept_id` NOT NULL (:143), `body_site_concept_id` (:144), `laterality_concept_id` (:145) |
| `imaging_procedure_steps` | 480-499 | `code_concept_id`, `modality_concept_id` (:486), `body_site_concept_id` (:487) |
| `laboratory_accessions` / `accession_specimens` | 334-363 | acesión por SR |
| `laboratory_work_orders` / `laboratory_work_order_tests` | 365-404 | **un renglón por prueba** con `service_request_id` + `test_code_concept_id` (:389) + `observation_id` — es donde hoy el laboratorio ya descompone en analitos, del lado del ejecutor |
| `diagnostic_report_versions/results/files` | 52-94 | informe versionado, resultados → `clinical.observations` |
| `clinical.observations` / `observation_components` | `08_clinical/02_tables.sql:85-158` | resultado por analito; `observation_components` para valores multi-componente |

Conclusión: lo realizado ya tiene modalidad/región/lateralidad y analitos; **lo pedido no**.

### 1.3 Catálogo de servicios del centro (`SQL/23_diagnostic_units/02_tables.sql`)

- `diagnostic_study_offerings` (`:81-105`): catálogo **por unidad diagnóstica** con `study_code`, `study_concept_id` NOT NULL, `modality_concept_id`, `body_site_concept_id`, `specimen_type_concept_id`, `display_name`, `preparation_instructions`, `expected_turnaround_minutes`, `requires_medical_order`, estado. Búsqueda full-text `gin_diagnostic_study_offerings_search` (`04_indexes.sql:89`).
- `diagnostic_study_components` (`:107-117`): **panel → componente**, pero **oferta → oferta** de la misma unidad (`parent_offering_id`, `component_offering_id`, `component_role_concept_id`, `ordinal`). FKs `03_fk_intra.sql:42-50`. Sin unicidad `(parent, component)`.
- `diagnostic_price_schedules` / `diagnostic_study_prices` (`:119-157`) + historial `audit.diagnostic_study_prices_history` (`10_audit/02_tables.sql:342`).
- `billing.service_catalog` (`SQL/17_billing/02_tables.sql:5-25`): catálogo de servicios **del consultorio** (`practice_id`), no de estudios.
- Esto es lo que el portal del laboratorio del front simula como «servicios» y «categorías» (`/diagnostics/lab/services`, `/diagnostics/lab/categories`).

### 1.4 Terminología (`SQL/03_terminology/02_tables.sql`)

Tablas: `terminology_sources` (:5), `code_systems` (:23), `code_system_versions` (:42), `catalog_concepts` (:60), `concept_designations` (:80), `concept_properties` (:95, `value_json` jsonb), `concept_relationships` (:109, con `ordinal`), **`concept_relationship_evidence` (:127, fuente + versión + `source_reference` + `citation_locator`)**, `value_sets` (:154), `value_set_versions` (:170), `value_set_members` (:186), `value_set_rules` (:200), `concept_maps` (:216, sin evidencia), `catalog_import_batches` (:232), `tenant_catalog_policies` (:249), `tenant_concept_config` (:267).

Unicidades que permiten seeders idempotentes (`SQL/03_terminology/04_indexes.sql`): `uq_catalog_concepts_version_code` (:59), `ux_concept_relationships_natural_key` (:93), `ux_concept_relationship_evidence_natural_key` (:99), `uq_value_set_members_version_concept` (:153).

¿Qué sistemas existen? En el **boot del modelo** (`seedsGenerales/modules/03_terminology.seeds.json`) hay 12 `code_systems` declarados — SALUD_CORE, SNOMED_CT, LOINC, ICD10, ICD11, UCUM, ATC, HL7_FHIR, **DICOM** (`http://dicom.nema.org/resources/ontology/DCM`), ISO_3166, ISO_4217, mantra-core-internal — pero **sólo SALUD_CORE (1 650) y mantra-core-internal (314) tienen conceptos**. LOINC, SNOMED y DICOM están declarados y **vacíos**. **RadLex, UBERON y FMA no existen** en el boot (0 menciones en `seedsGenerales/`, `SQL/`, `salud-db/`). 60 value sets, ninguno de imagen ni de laboratorio.

Los conceptos «de producto» los siembra **la API** al arrancar, no el modelo: `defineModuleConcepts` (UUIDv5 deterministas) + `src/common/seed/dynamic-enum-catalog.ts` → `DynamicEnumSeedService` → `system_context.dynamic_enum_bindings` (explicación en `dynamic-enum-catalog.ts:15-45`).

### 1.5 Corpus de análisis ya versionado (no cargado en ninguna base de producto)

`mantra-core-health-api/tools/terminology-import/lab-tests/` (README `:1-64`, fuentes y licencias `SOURCES.md`, verificado 2026-10-24):

- 12 fuentes con procedencia por concepto (`source`, `source_version`, `source_url`, `source_license`, `source_file_sha256`…): LOINC 2.82 (79 462 de 109 325 términos, vía tx.fhir.org + NLM CTSS), NCBI GTR, ICD-10-PCS 2027, CUPS (CO), PAMI (AR), TUSS/SIGTAP (BR), FONASA MLE (CL), NPU (IFCC), CDISC SDTM, tablas HL7 (incl. **v2-0487 completa, 315 tipos de muestra**) y UCUM. `data/` versionado (34 MB, SHA-256 en `checksums.json`).
- Escribe **sólo** en `terminology.*`, sin DDL. `concept_relationships` tipo `part-of` panel→miembro **con orden** (`lib/load-plan.mjs:21`, `lib/loinc.mjs:265`). `concept_maps` vacío a propósito: «ninguna fuente alcanzable publica una equivalencia entre sistemas, y no se inventa ninguna» (`README.md:50-51`).
- Medido sobre los NDJSON (`data/lab-tests-loinc.part0{1..5}.ndjson.gz`):

| Dominio LOINC | Pedibles (`ORDER_OBS` Order/Both) | con nombre ES | Paneles con miembros |
|---|---|---|---|
| laboratory | 42 629 | 36 951 | **1 604** |
| imaging | 7 363 | 6 560 | 6 |
| pathology | 409 | 385 | 10 |
| genetics | 2 300 | 1 939 | 75 |
| functional | 445 | 364 | 53 |

- Ejemplos verificados: `24331-1` «Lipid 1996 panel – Serum or Plasma» → 7 miembros ordenados (`2093-3` colesterol, `2571-8`, `2085-9`, …); `57021-8` «CBC W Auto Differential panel» → `58410-2` + `57023-4` (anidados).
- **Muestra:** la propiedad canónica `system` **no viene** (sólo con el zip oficial de Regenstrief, que exige cuenta: `SOURCES.md` «Soportadas pero no cargadas»). Sí viene `loinc_parts_es.system` (variante lingüística oficial es-MX/es-AR) en 34 577 términos: «suero» 7 518, «orina» 4 140, «suero/plasma» 4 044, «sangre» 1 665… **No hay mapeo publicado** de ese eje a `specimen-type` (HL7 v2-0487).
- **Imagen en LOINC:** `method_typ` = modalidad (`XR`, `CT`…) y `loinc_parts_es.system` = región («tórax»), p. ej. `36643-5` «XR Chest 2 Views», `24627-2` «CT Chest». El RSNA Playbook (modalidad/región/contraste estructurados) **no** está (requiere el zip). Calidad: la traducción ES de partes tiene errores visibles (`36643-5`: componente «vistas…^con contraste.XXX intrarterial» para una Rx de tórax simple).
- **Ningún flujo de producto consume este corpus** (`docs/seed-research/lab-tests.md:131`). Carga completa: una transacción, ≈190 000 conceptos y ≈4,6 M propiedades, `--max-old-space-size=12288` (`README.md:33-35`). Inviable como seed de arranque.
- Otras fuentes nacionales: INLASA (Bolivia) — código oficial, nombre y precio en Bs, **sin componentes** (`tools/terminology-import/import-inlasa.mjs`, `lib/glossary-es/inlasa.mjs:1-60`); Arancel de Honorarios Médicos Santa Cruz 2025 — 153 renglones de Radiología con OCR dañado y **ninguno de laboratorio clínico** (`mantra-core-health-model/markdown_convertidos/Arancel_Honorarios_Medicos_Santa_Cruz_2025_3_columnas.md:3291-3441`; especialidades contadas por `cut | sort | uniq -c`).

### 1.6 Anatomía

- Front: `public/anatomy-atlas-3d/catalog/` — 930 mallas (`parts.json`), **669 estructuras distintas: 421 UBERON, 239 FMA, 9 `BP3D:`** (sin id ontológico). Lateralidad **por malla** (`side`: 95 huesos izq + 95 der + 61 de línea media). 6 322 estructuras UBERON con `isA` en `structures-*.json`. Procedencia con SHA-256 y licencias (UBERON 2026-10-01 CC-BY 3.0; FMA vía BodyParts3D CC-BY 3.0; mallas BodyParts3D CC-BY-SA 2.1 JP) en `mantra-core-health/data/anatomy-ontology/provenance.json`. `labelEs`/definición ES: «Traducción automática sin revisión humana» (`anatomy-atlas.types.ts:40-41`).
- **Tipo de hueso:** UBERON lo da sólo parcialmente por `is_a`: `UBERON:0001446` peroné → `long bone` (`UBERON:0002495`) existe; `UBERON:0000981` fémur llega por `hindlimb long bone`; «flat bone» (`UBERON:0002514`) **no está** en el catálogo del atlas. No hay cobertura completa con fuente.
- API: 0 referencias a UBERON en `src/`. Cargador opt-in `tools/terminology-import/dictionaries/` carga UBERON y FMA a `terminology.*` con `is-a`/`part-of` y `concept_maps` UBERON→FMA **sólo por xref publicado** (`dictionaries/README.md:4,45-50,67`). No consta que se haya corrido en ninguna base.

### 1.7 Cómo se siembra hoy y parches

- Boot del modelo: `seedsGenerales/` (`gen_seeds.py`, `load_seeds.py`). Conceptos y enumeraciones de producto: seeds de la API en `src/common/seed/` (`*-seed.service.ts`, `dynamic-enum-catalog.ts`), idempotentes por id determinista (ADR-0017). ETL de terminología: `tools/terminology-import/*` con `md5('mantra:<fuente>:…')::uuid` y `ON CONFLICT DO NOTHING` (README `:1-6`).
- **Último parche: `SQL/patches/2026-10-31_v4279_revision_seguridad_gobierno.sql` → el siguiente número libre es v4.2.80.** Convención: `YYYY-MM-DD_vNNNN_<tema_snake>.sql`; cabecera `SALUD · patch v4.2.NN (<módulo> · <tema>)`, «Idempotente…», contexto, «DELTAS ESPERADOS», `BEGIN … DO $$ verificación $$ … COMMIT` (modelo: `2026-09-17_v4217_…sql:1-42`, `2026-09-26_v4236_…sql`). El README del modelo lista el orden de aplicación (`README.md` § «Parches sobre una base viva»).
- Riesgo de numeración: ya hay colisiones (`v4249` ×9, `v4264` ×2, `v4265` ×2) y la copia de despliegue `mantra-core-health-api/database/SQL/patches/` **está desfasada**: le faltan `v4275`–`v4279` y tiene `v4263_medical_facility`, `v4267_practitioner_admissions`, `secretaria_iniciador_vinculos` que el modelo no tiene (`diff` de ambos `ls`).

---

## 2. API (NestJS 11 + MikroORM 7)

### 2.1 Alta de la orden

- Controlador `src/modules/clinical/controllers/clinical-orders.controller.ts`: `@Roles('CLINICIAN','PRACTITIONER')` (:43), `POST /clinical/service-requests` con `ClinicalRecordAccessGuard` (:87-96), `POST /clinical/service-requests/duplicate-check` (:68-79), `POST /clinical/diagnostic-reports` (:104). **No hay `GET` de una orden** ni alta múltiple.
- DTO `src/modules/clinical/dto/service-request.dto.ts:24-242`: `codeConceptId` (`@IsUUID`, :75), `category` `LAB|IMAGING|OTHER` (:93-102), `basedOnNoteIds` (≤20, :108-124), ejecutor (:156-190), antiduplicación (:199-241). Respuesta `:245-333`. El backend valida con `forbidNonWhitelisted` (citado en `mantra-core-health/src/app/core/data-access/diagnostics/diagnostics.client.ts:159-160`).
- Servicio `src/modules/clinical/services/service-requests.service.ts`: `create` (:254-403) en una transacción → encuentro del paciente (:208-225), notas (:271-279), formulario (:281-287), ejecutor (`PerformerSelectionValidator.resolve`, :291-298; 422 `SUGGESTED_SITE_DOES_NOT_OFFER_PROCEDURE` en `performer-selection.validator.ts:128-139`), antiduplicación (:413-513), outbox `ServiceRequestPlaced` sólo con ids (:356-366), aviso al paciente (:373-379).
- **Brechas de validación hoy:**
  - `codeConceptId` **no se valida contra `service-request-code`**: 0 resultados de `grep "service-request-code|assertInValueSet|…"` fuera de `dynamic-enum-catalog.ts:1372`. Cualquier uuid de concepto existente pasa (sólo la FK lo frena).
  - **Categoría ↔ estudio no se cruza**: el front deduce la familia por el **prefijo del código** (`LAB_`, `IMG_`…) en `analysis-order-block/study-category.ts:28-35,55-60`; la API sólo cruza `category` con `categoryConceptId` (`service-requests.service.ts:233-251`, `service-request-category.ts:21-62`).
  - **La antiduplicación compara sólo `code_concept_id`** (`service-requests.service.ts:426-432`, `duplicate-study-detector`): con región y lateralidad, «Rx miembro superior izquierdo» seguido de «derecho» sería un falso duplicado.
- 422 con `details.reason`: `PreconditionFailedException` → HTTP 422 `PRECONDITION_FAILED` (`src/common/errors/domain.exception.ts:139-157`). **Conviven dos convenciones**: `reason` como 3.er argumento (`ClinicalErrorReason`, `clinical.error-reasons.ts:6-80`) y `reason` dentro del objeto de detalles (`DUPLICATE_STUDY_DETECTED`, `service-requests.service.ts:444-447`; `SPECIMEN_TYPE_NOT_IN_CATALOG`, `diagnostics/specimen-catalogs.ts:38-49`). Elegir una para los motivos nuevos.

### 2.2 Catálogos publicados al front

- Enumeraciones dinámicas públicas: `GET /system-context/dynamic-enums` (`src/modules/system_context/controllers/system-context.controller.ts:134`), alimentadas por `dynamic-enum-catalog.ts`:
  - `service-request-code` (`:1372-1480`): **88 estudios locales** `LAB_*` (47), `IMG_*` (27), `CAR_*`, `PAT_*`, `PRO_*`, sin preseleccionado. Justificación de «códigos locales y no LOINC»: `clinical/clinical.concepts.ts:197-221` y `Mantra Core Health Context/docs/architecture/physical-materialization.md:2005`; `docs/seed-research/lab-tests.md:31-35` remata: «enlazar un estudio local con un código de catálogo es una decisión clínica de quien gobierne el nomenclador».
  - `service-request-category` (`:1482-1495`), `-performer-selection`, `-intent`, `-priority`, `-status` (`:1497-1556`).
  - `condition-laterality` (`:1316-1325`): LEFT/RIGHT/BILATERAL (`clinical.concepts.ts:570-575`), atado sólo a `clinical.conditions.laterality_concept_id`.
  - `diagnostic-modality` (`:1613-1629`): `DU_MODALITY_LAB/XRAY/ULTRASOUND/CT/MRI/MAMMOGRAPHY/BONE_DENSITOMETRY` (`diagnostic_units/diagnostic_units.concepts.ts:90-121`), atado a `diagnostic_study_offerings.modality_concept_id`. Faltan fluoroscopía/contrastados, angiografía, medicina nuclear/PET.
  - `specimen-type` (`:1666-1672`, 35 conceptos HL7 v2-0487 + `UR24` local, `diagnostics.concepts.ts:60-65,466-506`) y `specimen-container-type`, atados sólo a `diagnostics.specimens.*`.
- Terminología genérica: `GET /terminology/value-sets` y `GET /terminology/value-sets/:id/$expand` (`@Public`, cursor, `includeProperties`, **sin filtro de texto**) en `terminology/controllers/terminology-value-sets.controller.ts:124,218-260`; `GET /terminology/concepts?q=` (búsqueda por texto, autenticado) en `terminology-concepts.controller.ts:153`.
- Catálogo del centro: `POST /diagnostic-units/:id/study-offerings` (`SECURITY_ADMIN`, con componentes) en `diagnostic_units/controllers/diagnostic-units.controller.ts:260-273`, DTO `dto/create-study-offering.dto.ts:17-55`; lectura pública `GET /diagnostic-units/:id` con `DiagnosticStudyDetailDto` (`dto/directory-read.dto.ts:129-162`) **sin componentes, sin muestra, sin región**.
- **No existe ningún endpoint de catálogo de estudios con búsqueda, paginación y componentes** para el médico.

### 2.3 Lado receptor

- **Sí existe** una bandeja real: `POST /diagnostics/service-requests/inbox` (`diagnostics/controllers/diagnostics-reception.controller.ts:43-55`), `LabStaffGuard` (`guards/lab-staff.guard.ts:19-63`: SUPERADMIN, CLINICIAN/PRACTITIONER del tenant, o membresía activa en un tenant `DIAGNOSTIC_CENTER`). POST porque la búsqueda por paciente es PHI (`dto/reception.dto.ts:14-23`). Filtra `performer_tenant_id` = tenant activo, categorías `CATEGORIES_WITH_SPECIMEN` = LAB + PATOLOGÍA (`diagnostics.concepts.ts:460-463`), estado vigente y **sin acesión** (`repositories/lab-reception.repository.ts:57-110`). Ítem: `codeConceptId`, `codeDisplay`, categoría, prioridad, estado, solicitante, organización, especímenes (`reception.dto.ts:64-117`). **Sin componentes ni muestra pedida**, porque no existen.
- **Imagenología no tiene bandeja**: queda fuera de `CATEGORIES_WITH_SPECIMEN` a propósito.
- **Una orden sólo llega al receptor si `performer_tenant_id` vino en el alta**: el único lugar que lo escribe es el alta (`service-requests.service.ts:315`; `grep "performerTenantId\s*="` no encuentra asignación posterior). Con `SR_PERF_PATIENT_CHOICE` la orden nunca aparece en ninguna bandeja.
- El portal del laboratorio del front corre contra simulador: `/diagnostics/lab/orders` y `/diagnostics/lab/orders/:orderId/transitions` (`mantra-core-health/src/app/core/mock/handlers/lab-orders.handlers.ts:26-28,139-176`), tipos `LabOrder`/`LabOrderStatus` `DRAFT|RECEIVED|PROCESSED|UPLOADED|CANCELLED|REJECTED` (`core/data-access/lab-portal/lab-portal.types.ts:261-295`). Esos estados **no existen** en la API; los equivalentes reales se derivan de SR + acesión + work order + informe.
- Cola de trabajo real: `GET/POST /diagnostics/work-orders` (`diagnostics-lab.controller.ts:63,80`), DTO con `serviceRequestId` + `testCodeConceptId` por ítem (`dto/lab.dto.ts:18-34`).

### 2.4 OpenAPI y pruebas

- Contrato: `openapi/openapi.json` (`/clinical/service-requests` en `:20402`, inbox en `:50910`) y `.yaml`; se regenera con `yarn docs:openapi:generate` (`package.json:121`); gates `tools/openapi/check-breaking.mjs` y `request-body-contract.mjs`.
- Pruebas existentes: `service-requests.service.spec.ts` (38 `it`), `service-request.dto.spec.ts` (15), `diagnostics-reception.service.spec.ts` (14); integración `test/integration/{p40-orden-basada-en-notas,patient-diagnostic-orders,lab-reception-inbox,medical-centers,patient-coverage-copays}.int-spec.ts`, `hardening/mch-027.int-spec.ts`; smoke `test/smoke/modules/clinical.smoke.ts`. ETL: `yarn test:terminology-import` (`package.json:98`).
- Deriva: `yarn inventario:deriva-bd` (`package.json:131`), `docs/inventario/catalogo/deriva.md:5`.

---

## 3. Diseño propuesto

Principios: (1) **expand-only** en esquema: columnas nullable y tablas nuevas, sin backfill; (2) **una SR por análisis** (no se rompe nada de lo que cuelga de `service_request_id`); (3) **ninguna relación entre catálogos sin fuente o sin aprobador con nombre** (regla 97.5.2), registrada en `concept_relationship_evidence`; (4) **la API es la autoridad**: todo cruce que hoy deduce el front pasa a validarse en la API.

### 3.a Catálogo (sin tablas nuevas: todo en `terminology.*`)

| Necesidad | Dónde | Fuente / procedencia |
|---|---|---|
| Análisis de laboratorio pedibles | Mantener `service-request-code` (88 locales) **y** ampliarlo con pedibles LOINC **sólo si el usuario revierte la decisión documentada** (Q1). Alternativa sin revertir: un `LAB_*` local se vuelve «desplegable» cuando tiene un enlace aprobado a un panel LOINC | LOINC 2.82, `tools/terminology-import/lab-tests/data/` (SHA-256) |
| Panel → componentes («features») | `concept_relationships` tipo `part-of` (ya los produce `lab-tests`, con `ordinal`) | LOINC PanelsAndForms (vía NLM CTSS) |
| Enlace `LAB_*` local → panel LOINC | `concept_relationships` nuevo tipo `orderable-as` (concepto en `terminology` relationship types) + **una fila de `concept_relationship_evidence` por enlace** con `terminology_source` = «Curaduría clínica Mantra» y `citation_text` = quién aprobó, cuándo y por qué | Archivo curado versionado, una fila por enlace con aprobador. Sin aprobador, sin fila |
| Muestra por análisis | **El médico la elige** de `specimen-type` (sumar target `clinical.service_requests.specimen_type_concept_id`). Se **muestra** como pista el `loinc_parts_es.system` del término («Muestra según LOINC: suero/plasma») sin preseleccionar | HL7 v2-0487 (ya sembrado); la pista es texto LOINC, no un mapeo |
| Modalidad de imagen | Value set nuevo `service-request-imaging-modality` reutilizando los conceptos `DU_MODALITY_*` **menos LAB** (así coincide con las ofertas del receptor). Ampliar con fluoroscopía/angiografía/NM sólo con fuente (DICOM CID 29 está declarado como code system vacío) | DICOM PS3.16 CID 29 si se amplía (Q4) |
| Estudio de imagen → modalidad | `concept_relationships` `has-modality` desde cada `IMG_*` con evidencia que cite el renglón del Arancel Santa Cruz 2025 (los `IMG_*` ya declaran seguir sus grupos, `clinical.concepts.ts:214-219`) | Arancel, línea citada en `citation_locator` |
| Región corporal | Cargar a `terminology` **sólo las 669 estructuras del atlas** (421 UBERON + 239 FMA; las 9 `BP3D:` quedan fuera o se decide en Q6) con ids deterministas compatibles con `dictionaries/load-dictionaries.mjs`, más sus `is-a`/`part-of`. Value set `imaging-body-structure` atado a `clinical.service_requests.body_site_concept_id` | UBERON 2026-10-01, FMA (BodyParts3D 3.0); SHA en `data/anatomy-ontology/provenance.json` |
| Lateralidad | Reutilizar los conceptos de `condition-laterality` sumando el target `clinical.service_requests.laterality_concept_id` (no hay concepto nuevo que inventar). Verificar en `createBinding` que un value set admite varios targets (el comentario de `dynamic-enum-catalog.ts:62-65` sólo prohíbe un campo en dos enumeraciones) | conceptos existentes |
| Tipo de hueso | **No se persiste**: se deriva en lectura del `is_a` de UBERON (p. ej. `long bone`) cuando existe; si no, no se muestra. Nada escrito a mano | UBERON |
| Contraste | Value set `imaging-contrast` con 3 conceptos locales (sin contraste / con contraste / sin y con contraste), **pendiente de aprobación clínica** (Q5). Sin fuente cargada que lo dé estructurado (el RSNA Playbook requiere el zip de LOINC) | decisión clínica registrada |

### 3.b Ítems de la orden — DDL tentativo (parche `v4.2.80`)

Decisión: **un renglón = una `clinical.service_requests`** (ya es así; todo el circuito, la facturación y la antiduplicación cuelgan de ella). Se agrega una **clave de solicitud** para agrupar los renglones que el médico pidió juntos (equivale a FHIR `ServiceRequest.requisition`) y una **tabla hija de componentes**. Imagen va en columnas de la propia SR (una región por renglón; bilateral = un valor de lateralidad; varias regiones = varios renglones, igual que el Arancel: «si fueran varios o bilateral se tienen que multiplicar», `Arancel…md:3378`).

Primero el `.puml` (`diagram_08_clinical.puml:265`), después `gen_ddl.py`, después este parche para bases vivas:

```sql
-- SALUD · patch v4.2.80 (clinical · detalle de la orden de estudios) sobre BD viva
-- Fecha: 2026-11-xx · Idempotente · UNA pasada · SIN backfill (no se fabrica dato clínico)
-- DELTAS ESPERADOS: columnas de clinical.service_requests 21 → 27 · tablas +1
--   (clinical.service_request_components) · FKs +7 · índices +7 · CHECK +3 · políticas RLS +1
BEGIN;

ALTER TABLE "clinical"."service_requests"
  ADD COLUMN IF NOT EXISTS "requisition_id"           uuid,  -- agrupa renglones de una misma solicitud (sin FK: identificador de grupo)
  ADD COLUMN IF NOT EXISTS "specimen_type_concept_id" uuid,  -- FK terminology.catalog_concepts · LAB/PATOLOGÍA
  ADD COLUMN IF NOT EXISTS "modality_concept_id"      uuid,  -- FK · IMAGEN
  ADD COLUMN IF NOT EXISTS "body_site_concept_id"     uuid,  -- FK · concepto UBERON/FMA
  ADD COLUMN IF NOT EXISTS "laterality_concept_id"    uuid,  -- FK
  ADD COLUMN IF NOT EXISTS "contrast_concept_id"      uuid;  -- FK

-- FKs bajo guarda (mismo patrón que v4217 :52-62), una por columna *_concept_id → terminology.catalog_concepts(id)

CREATE INDEX IF NOT EXISTS "ix_service_requests_requisition_id"
  ON "clinical"."service_requests" ("custodian_tenant_id", "requisition_id") WHERE requisition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ix_service_requests_performer_inbox"
  ON "clinical"."service_requests" ("performer_tenant_id", "status_concept_id", "created_at", "id")
  WHERE performer_tenant_id IS NOT NULL;                       -- la bandeja del receptor hoy no tiene índice compuesto
-- + ix_ por cada *_concept_id nuevo (convención del generador)

ALTER TABLE "clinical"."service_requests" DROP CONSTRAINT IF EXISTS "ck_service_requests_specimen_xor_imaging";
ALTER TABLE "clinical"."service_requests" ADD CONSTRAINT "ck_service_requests_specimen_xor_imaging"
  CHECK (specimen_type_concept_id IS NULL
         OR (modality_concept_id IS NULL AND body_site_concept_id IS NULL
             AND laterality_concept_id IS NULL AND contrast_concept_id IS NULL));
ALTER TABLE "clinical"."service_requests" ADD CONSTRAINT "ck_service_requests_laterality_requires_site"
  CHECK (laterality_concept_id IS NULL OR body_site_concept_id IS NOT NULL);
ALTER TABLE "clinical"."service_requests" ADD CONSTRAINT "ck_service_requests_contrast_requires_modality"
  CHECK (contrast_concept_id IS NULL OR modality_concept_id IS NOT NULL);
-- (los CHECK van por gen_integrity.py → 05_constraints.sql en el rebuild)

CREATE TABLE IF NOT EXISTS "clinical"."service_request_components" (
  "id"                    uuid        NOT NULL,
  "service_request_id"    uuid        NOT NULL,   -- FK clinical.service_requests
  "custodian_tenant_id"   uuid        NOT NULL,   -- copia del padre: la cubre v4226 al re-ejecutarse
  "component_concept_id"  uuid        NOT NULL,   -- FK terminology.catalog_concepts (miembro part-of del panel)
  "ordinal"               integer     NOT NULL,
  "created_at"            timestamptz NOT NULL,
  "created_by_user_id"    uuid,
  CONSTRAINT "pk_service_request_components" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ux_service_request_components_request_component"
  ON "clinical"."service_request_components" ("service_request_id", "component_concept_id");
CREATE INDEX IF NOT EXISTS "ix_service_request_components_component_concept_id"
  ON "clinical"."service_request_components" ("component_concept_id");

-- RLS: el receptor lee los componentes de órdenes que puede leer (espejo de v4236)
DROP POLICY IF EXISTS service_request_components_performer_read ON clinical.service_request_components;
CREATE POLICY service_request_components_performer_read ON clinical.service_request_components
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM clinical.service_requests sr
             WHERE sr.id = service_request_id
               AND sr.performer_tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    OR current_setting('app.system_context', true) = 'true');

-- DO $$ verificación de columnas, tabla, CHECKs y política; RAISE EXCEPTION si falta algo $$;
COMMIT;
-- Re-ejecutar después 2026-09-26_v4226_custodian_tenant_rls.sql (cubre la tabla nueva por descubrimiento dinámico).
```

Notas: (1) la coherencia «muestra sólo en LAB/PATOLOGÍA» y «imagen sólo en IMAGING» depende de `category_concept_id` (concepto), así que va en la API, no en un CHECK; (2) `custodian_tenant_id` del hijo debe igualar al del padre: validarlo en la API o con disparador (como hizo v4.2.79 con `tenant_id`); (3) `diagnostics.imaging_studies` sigue con `modality_value_set_id` (un value set, no un concepto) — no se toca, pero al realizar el estudio la API puede copiar modalidad/región/lateralidad de la SR a `imaging_series`/`imaging_procedure_steps`.

### 3.c Endpoints

**C1. Catálogo con búsqueda y paginación** — `GET /clinical/study-catalog` (sin PHI → GET con query es aceptable). Autenticado; roles CLINICIAN/PRACTITIONER y personal de centro diagnóstico.

```
GET /clinical/study-catalog?family=LAB|IMAGING|CARDIO|PATHOLOGY|PROCEDURE&q=hemog&cursor=…&limit=25&lang=es
200 {
  "items": [{
    "conceptId": "uuid", "code": "LAB_HEMOGRAMA", "codeSystem": "mantra-core-internal",
    "display": "Hemograma", "family": "LAB",
    "componentsSelectable": true, "componentCount": 26,
    "specimenHint": { "text": "sangre", "source": "LOINC 2.82 (es-MX)" } | null,
    "modalityConceptId": null,
    "provenance": { "source": "…", "version": "…" }
  }],
  "count": 1, "limit": 25, "nextCursor": null
}
```

**C2. Detalle de un estudio** — `GET /clinical/study-catalog/:conceptId` → `components[]` `{conceptId, code, display, ordinal, exampleUnits[], isPanel, children?}` (paneles anidados como `57021-8`), `allowedSpecimenTypes` (=`specimen-type`), `allowedModalities`, `contrastOptions`, `loincAttribution` (texto de licencia obligatorio en UI). 404 si el concepto no es de `service-request-code`.

**C3. Estructuras corporales** — preferir **agregar `filter`** al `$expand` existente (`terminology-value-sets.controller.ts:218`; `filter` es el parámetro estándar de FHIR `ValueSet/$expand`) antes que un endpoint nuevo. Respuesta por ítem: `conceptId`, `code` (`UBERON:…`/`FMA:…`), `display` ES (marcar si es traducción automática), `lateralizable` (derivado de que el atlas tenga mallas `left/right` para esa estructura — fuente BodyParts3D), `boneType` (del `is_a`, o `null`).

**C4. Crear la solicitud** — se mantiene `POST /clinical/service-requests` (un renglón) con campos nuevos opcionales, y se agrega `POST /clinical/requisitions` (N renglones atómicos, `Idempotency-Key`):

```
POST /clinical/requisitions
{
  "custodianTenantId": "uuid", "patientProfileId": "uuid", "encounterId": "uuid",
  "requesterProfileId": "uuid", "priorityConceptId": "uuid", "basedOnNoteIds": [],
  "performerSelectionConceptId": "uuid", "performerTenantId": "uuid?", "suggestedPracticeSiteId": "uuid?",
  "items": [
    { "codeConceptId": "LAB_HEMOGRAMA", "category": "LAB",
      "specimenTypeConceptId": "uuid", "componentConceptIds": ["uuid", "uuid"],
      "duplicateDecision": { "previousDiagnosticReportId": "uuid", "reusePreviousReport": false,
                             "duplicateOverrideReason": "…" } },
    { "codeConceptId": "IMG_RX_MIEMBRO_SUP", "category": "IMAGING",
      "imaging": { "modalityConceptId": "uuid", "bodySiteConceptId": "uuid",
                   "lateralityConceptId": "uuid", "contrastConceptId": "uuid" } }
  ]
}
201 { "requisitionId": "uuid",
      "items": [ { "id": "uuid", "codeConceptId": "…", "status": "uuid",
                   "specimenTypeConceptId": "…", "components": [{ "conceptId": "…", "display": "…", "ordinal": 1 }],
                   "imaging": { … , "bodySiteDisplay": "Mano", "lateralityDisplay": "Izquierda" } } ] }
```

Un 422 en cualquier renglón anula toda la solicitud y devuelve `details.itemIndex` + `details.field` + `details.reason`. Reusa `ServiceRequestsService.create` por renglón dentro de la misma transacción.

**C5. Leer una orden** (falta hoy) — `GET /clinical/service-requests/:id` para el custodio (con `ClinicalRecordAccessGuard`/`assertCanReadHistory`), con el detalle completo. Es lo que exige el kill-test «recargar y que vuelva con región, lateralidad y tipo de hueso».

**C6. Receptor: listar y ver órdenes con el detalle**
- Ampliar `POST /diagnostics/service-requests/inbox` (compatibilidad aditiva) con `specimenTypeConceptId`, `components[]`, `requisitionId`.
- Agregar `POST /diagnostics/service-requests/worklist` (mismo guard, mismo cuerpo PHI-safe) con `scope: "LAB" | "IMAGING"` y `state` derivado de datos reales — `PENDING` (sin acesión/sin estudio), `RECEIVED` (acesión o `imaging_studies`), `IN_PROCESS` (work order abierta), `REPORTED` (informe liberado), `CANCELLED` — para reemplazar `/diagnostics/lab/orders` del simulador. Las transiciones del simulador (`RECEIVE/PROCESS/CANCEL/REJECT`) **no** se crean como estados nuevos: se mapean a las acciones reales que ya existen (`POST /diagnostics/accessions`, `POST /diagnostics/work-orders`, `POST /diagnostics/specimens/:id/rejection`, liberación del informe). Confirmar con el dueño del front (Q9).
- `GET /diagnostics/service-requests/:id` para el receptor: 404 si `performer_tenant_id ≠ tenant activo` (no distinguir de inexistente).

### 3.d Reglas de validación cruzadas (todas 422 `PRECONDITION_FAILED` con `details.reason`, `details.field`)

| # | Regla | reason |
|---|---|---|
| V1 | `codeConceptId` ∈ `service-request-code` vigente | `STUDY_NOT_IN_CATALOG` (hoy no se valida) |
| V2 | `category` coincide con la familia del estudio (relación de catálogo, no prefijo de texto) | `SERVICE_REQUEST_CATEGORY_STUDY_MISMATCH` |
| V3 | `specimenTypeConceptId` sólo con LAB/PATOLOGÍA; ∈ `specimen-type` | `SPECIMEN_NOT_ALLOWED_FOR_CATEGORY` / `SPECIMEN_TYPE_NOT_IN_CATALOG` (reusar `specimen-catalogs.ts:18-21`) |
| V4 | `componentConceptIds` sólo si el estudio es desplegable; cada uno es miembro `part-of` (directo o anidado) de su panel; no vacío si viaja; duplicados → 400 (`@ArrayUnique`) | `COMPONENTS_NOT_SELECTABLE` / `COMPONENT_NOT_IN_PANEL` / `COMPONENTS_EMPTY` |
| V5 | Campos `imaging.*` sólo con IMAGING; modalidad obligatoria en IMAGING (Q3) | `IMAGING_FIELDS_NOT_ALLOWED` / `MODALITY_REQUIRED` |
| V6 | modalidad ∈ `service-request-imaging-modality`; si el estudio tiene `has-modality` con evidencia, debe coincidir | `MODALITY_NOT_IN_CATALOG` / `MODALITY_STUDY_MISMATCH` |
| V7 | región ∈ `imaging-body-structure`; obligatoria en IMAGING (Q3) | `BODY_SITE_NOT_IN_CATALOG` / `BODY_SITE_REQUIRED` |
| V8 | lateralidad ∈ conjunto de lateralidad; exige región; prohibida si la estructura no es lateralizable (fuente: mallas BodyParts3D) | `LATERALITY_NOT_IN_CATALOG` / `LATERALITY_REQUIRES_BODY_SITE` / `LATERALITY_NOT_APPLICABLE` |
| V9 | contraste ∈ `imaging-contrast`; exige modalidad | `CONTRAST_NOT_IN_CATALOG` / `CONTRAST_REQUIRES_MODALITY` |
| V10 | **Antiduplicación** con clave `(code_concept_id, body_site_concept_id, laterality_concept_id)` para imagen y `(code_concept_id)` + conjunto de componentes para laboratorio (Q8) | reutiliza `DUPLICATE_STUDY_DETECTED` |
| V11 | región ⊂ región del estudio (p. ej. «mano» dentro de «miembro superior») **sólo** cuando exista enlace estudio→región UBERON con evidencia; si no, no se valida y se documenta | `BODY_SITE_OUTSIDE_STUDY_REGION` (diferido) |

### 3.e Seeders idempotentes con procedencia

1. **Conceptos y enumeraciones locales** (API, boot): `defineModuleConcepts` para tipos de relación (`orderable-as`, `has-modality`) y contraste; entradas nuevas en `dynamic-enum-catalog.ts` (`service-request-imaging-modality`, `imaging-body-structure`, `imaging-contrast`) y targets nuevos en `specimen-type` y `condition-laterality`. Ids UUIDv5; agregar **al final** de las listas (el seed numera por posición: `diagnostics.concepts.ts:477-480`).
2. **LOINC — subconjunto, no el corpus**: un cargador que lea `lab-tests/data/*.ndjson.gz` (verificando `checksums.json`) y cargue sólo los paneles enlazados por (4) **más todos sus miembros a cualquier profundidad**, con los **mismos ids** `md5('mantra:loinc:…')` que `load-lab-tests.mjs` (`lab-tests/lib/load-plan.mjs:42-48`), para que una carga completa posterior no duplique. `ON CONFLICT DO NOTHING`; un `catalog_import_batches` por corrida; segunda corrida = 0 filas de catálogo. El texto de licencia LOINC viaja en `source_license`.
3. **UBERON/FMA — las 669 estructuras del atlas**: generar un JSON versionado (con SHA del `.obo` de `provenance.json`) y cargar conceptos + `is-a`/`part-of` con ids compatibles con `dictionaries/load-dictionaries.mjs` (verificar su esquema de id antes; no se leyó completo).
4. **Enlaces curados** `LAB_* → panel LOINC` e `IMG_* → modalidad`: archivo versionado con columnas `local_code, target_code, target_system, aprobado_por, fecha, cita`; el cargador **falla** si una fila no tiene aprobador. Va a `concept_relationships` + `concept_relationship_evidence` (natural keys `03_terminology/04_indexes.sql:93,99`).
5. Prueba de idempotencia en el DoD: salida de dos corridas, la segunda con 0 inserciones.

### 3.f Orden de despliegue y migración de datos

1. **Modelo**: `.puml` (08_clinical) → `gen_ddl.py all` (diff vacío fuera de lo nuevo) → `gen_integrity.py` (CHECKs) → parche `v4.2.80` → `python salud-db/check_ddl_sources.py` → aplicar en prueba (pegar `\d clinical.service_requests` y `\d clinical.service_request_components`) → re-ejecutar `v4226`. Copiar el parche a `mantra-core-health-api/database/SQL/patches/` (copia de despliegue de Coolify) y **resolver antes su desfase** (§1.7).
2. **API**: `gen_entities.py` + prettier → `yarn orm:catalog` → seeds (3.e) → DTO/servicio/validaciones con **todos los campos opcionales** → C1–C6 → `yarn docs:openapi:generate` + `check-breaking` → `yarn lint`, `yarn typecheck`, pruebas dirigidas + integración → `yarn inventario:deriva-bd`.
3. **Front** (otro informe): consume C1–C6; retira `/diagnostics/lab/orders` del simulador cuando C6 exista.
4. **Contracción** (opcional, aparte): volver obligatorios muestra/modalidad/región cuando el front ya los mande (Q3).
- **Datos existentes: sin backfill.** Las órdenes viejas quedan con columnas nulas y sin componentes; la API las expone como `componentsSpecified: false` («estudio completo, sin detalle»), igual que el criterio de v4217 («Inventar enlaces para órdenes pasadas sería fabricar un dato clínico»). Las órdenes nuevas de un panel desplegable **siempre** escriben sus componentes (si el médico no desmarca nada, se escriben todos), para que «todo» y «sin dato» no se confundan.

### 3.g Matriz de autorización

| Operación | Médico tratante (CLINICIAN/PRACTITIONER + relación asistencial) | Médico sin relación con el paciente | Personal de centro diagnóstico ejecutante (`LabStaffGuard`, `performer_tenant_id` = su tenant) | Centro diagnóstico **no** ejecutante | Paciente | Personal de apoyo / secretaria (v4.2.75–79) | SECURITY_ADMIN | Sin token |
|---|---|---|---|---|---|---|---|---|
| C1/C2/C3 leer catálogo | 200 | 200 | 200 | 200 | 403 (salvo que se decida público, como `$expand`) | 200 si su plantilla lo incluye (Q10) | 200 | 401 (C3 hoy es `@Public`) |
| C4 crear solicitud | 201 | 403/404 (`ClinicalRecordAccessGuard`) | 403 | 403 | 403 | 403 salvo delegación explícita (Q10) | 403 | 401 |
| C5 leer orden (custodio) | 200 | 404 | — | 404 | vía `GET /diagnostic-results/me/orders` existente | según delegación | 403 | 401 |
| C6 bandeja / detalle receptor | 403 si no es miembro del tenant ejecutante | 403 | 200 | 404 por orden (no distinguir) / lista vacía | 403 | 403 | 403 | 401 |
| Catálogo del centro (ofertas) | 403 | 403 | hoy 403 (sólo `SECURITY_ADMIN`, `diagnostic-units.controller.ts:261`) | 403 | 403 | 403 | 201 | 401 |

Pruebas negativas mínimas en el DoD: otro tenant, rol insuficiente, sin token, paciente, orden de otro ejecutante, y con `RLS_ENFORCE=true` (la bandeja vacía en silencio es el modo de falla documentado en v4236:16-19).

---

## 4. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Revertir sin ADR la decisión «códigos locales y no LOINC» (`clinical.concepts.ts:197-221`) | Catálogo con identificadores que «parecen interoperables y no lo son» | Q1; si se adopta LOINC, ADR nuevo en la API que supere esa nota |
| Enlaces `LAB_*`→LOINC hechos por conveniencia | Viola 97.5.2; panel equivocado = analitos equivocados | Cargador que exige aprobador por fila; evidencia en `concept_relationship_evidence` |
| Antiduplicación sólo por `code_concept_id` | Falsos duplicados (mano izq/der) que bloquean la orden con 422 | V10 antes de habilitar región |
| Órdenes con `SR_PERF_PATIENT_CHOICE` sin `performer_tenant_id` | Nunca llegan a ninguna bandeja de receptor, con o sin granularidad | Q7: flujo de asignación del ejecutor (fuera de este alcance, pero bloquea el objetivo «el receptor ve la granularidad») |
| Imagenología sin bandeja real | La pantalla «Órdenes» de imagen no tiene contra qué correr | C6 `scope: IMAGING` |
| Corpus LOINC completo como seed | 12 GB de heap, transacción única, arranques lentos | Subconjunto (3.e.2) |
| Traducciones ES de LOINC/UBERON | LOINC es-MX/AR con errores visibles (`36643-5`); UBERON ES automático sin revisión | Marcar origen en la UI; no usar el texto ES como dato validado |
| Licencias | LOINC exige aviso; BodyParts3D CC-BY-SA; UBERON/FMA CC-BY | Atribución en C2/C3 y en la pantalla |
| RLS de la tabla hija | Sin `custodian_tenant_id` quedaría fuera de v4226; sin política de lectura del ejecutor, bandeja vacía con `RLS_ENFORCE=true` | DDL de 3.b + re-ejecutar v4226 + prueba con `mantra_app` |
| Numeración y copia de despliegue desfasada | Parche aplicado en dev y no en Coolify | Resolver el `diff` de `patches/` antes de agregar v4.2.80 |
| Dos convenciones de `reason` en 422 | El front ramifica mal | Fijar una para los motivos nuevos |
| `tsc` no revisa plantillas (front) | Rotura silenciosa al ampliar tipos | Pruebas de componente + Playwright (lado front) |

---

## 5. Preguntas abiertas reales

1. **¿Se adopta LOINC como código pedible** (revirtiendo `clinical.concepts.ts:197-221`) o se mantiene el catálogo local y sólo se **enlazan** los `LAB_*` a paneles LOINC con aprobación clínica? ¿**Quién** aprueba cada enlace (nombre, rol)?
2. «**Todo el catálogo**»: ¿los 42 629 pedibles LOINC de laboratorio, sólo los 1 604 paneles con miembros, o los 47 `LAB_*` + lo que el laboratorio receptor publique en `diagnostic_study_offerings`? ¿Debe pesar el nomenclador **INLASA** (Bolivia, con precio) como lista base?
3. ¿Modalidad, región y muestra son **obligatorias** en las órdenes nuevas (y desde cuándo), o opcionales?
4. ¿Qué modalidades faltantes se agregan (fluoroscopía/contrastados, angiografía, medicina nuclear/PET) y con qué fuente (DICOM CID 29)?
5. **Contraste**: ¿alcanzan los tres valores (sin / con / sin y con), o hace falta vía (IV/oral) y agente? ¿Quién lo aprueba?
6. Las **9 mallas `BP3D:`** sin id ontológico y las 239 sólo FMA: ¿se pueden pedir? ¿Se carga FMA como code system además de UBERON?
7. ¿Quién fija `performer_tenant_id` cuando el paciente elige el laboratorio? Sin eso la orden no llega al receptor.
8. Antiduplicación con componentes: ¿pedir lípidos completos cuando hace 10 días se pidió sólo colesterol es duplicado?
9. Estados de la pantalla «Órdenes» del receptor: ¿se aceptan los estados derivados de la API (§3.c C6) en lugar de `DRAFT/RECEIVED/PROCESSED/UPLOADED/CANCELLED/REJECTED` del simulador? ¿«Cancelar» desde el receptor es un acto del receptor o del solicitante?
10. ¿El personal de apoyo (secretaria) puede crear o ver solicitudes de estudio en nombre del médico? Los 73 permisos de v4.2.78 no tienen ninguno de órdenes.
11. ¿El cambio también va a `mockup` (PR aparte por cherry-pick, según `CLAUDE.md` del front)? Hacia `test` ya no se abre PR en ningún repo.
12. ¿El tipo de hueso es requisito (el plan previo lo incluye) aunque UBERON sólo lo cubra parcialmente, o basta con mostrarlo cuando exista?
