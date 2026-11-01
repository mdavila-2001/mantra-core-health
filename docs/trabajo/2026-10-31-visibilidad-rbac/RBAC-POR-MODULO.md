# RBAC por módulo — auditoría de la API (2026-10-31)

Contrato: [CONTRATO.md](./CONTRATO.md) §«RBAC granular por módulo» · Repo auditado: `mantra-core-health-api` (NestJS).
Peldaño de evidencia: **DISCOVERED** (lectura del código con un escáner AST; no se ejecutó la API). El escáner está en
[`evidencia/scan-rbac-por-modulo.cjs`](./evidencia/scan-rbac-por-modulo.cjs) y reproduce todas las cifras de este documento:

```bash
node docs/trabajo/2026-10-31-visibilidad-rbac/evidencia/scan-rbac-por-modulo.cjs /home/user/mantra-core-health-api > inventario.json
```

## 1. Hallazgos clave

1. **La API autoriza por código de rol, no por permiso fino.** Las 1.672 rutas HTTP de 310 controladores se protegen con
   `@Roles(...)` + `RolesGuard` (`src/common/auth/roles.guard.ts:94`). Ningún controlador evalúa un permiso de `authz.permissions`.
2. **El catálogo de permisos finos está prácticamente vacío.** Lo único que se siembra es **1 permiso**
   (`DIAGNOSTIC_RESULT_READ`, `resource = diagnostics.diagnostic_report`, `src/modules/authz/authz.seed.ts:166`); no hay semilla de
   categorías (`grep` en `src/common/seed`) ni un solo código con la forma `<modulo>.<recurso>.<acción>`. **73 de los 74 módulos con controladores no tienen ningún permiso fino
   sembrado.** Lo demás sólo existe si un `SECURITY_ADMIN` lo dio de alta a mano con `POST /authz/permissions` (el endpoint nuevo lo muestra en vivo).
3. **Quién sí consume permisos finos:** (a) el PDP (`AuthzPdpService.evaluate` busca por recurso+acción, `authz-pdp.service.ts:167`), que sólo
   llama el acceso clínico (`clinical-read.service.ts:373`); (b) la capa de vistas (`ViewPermissionGate.holds`,
   `read_models/services/view-contract-authorizer.service.ts:187,231,259`). **Consecuencia:** asignar un permiso a un rol en la matriz
   no cambia lo que un endpoint permite hoy; lo decide el `@Roles` de la ruta. La pantalla y el endpoint lo dicen en sus `notes`.
4. **Cómo autorizan las 1.672 rutas** (cifras del escáner):

   | Estado | Rutas | % |
   |---|---:|---:|
   | Sólo `@Roles` (`ROLE_ONLY`) | 1.325 | 79,3 |
   | Sin `@Roles`, sin `@Public`, sin guard (`UNDECLARED_AUTH`) | 202 | 12,1 |
   | Autoservicio `/me/...` | 68 | 4,1 |
   | Públicas (`@Public`) | 63 | 3,8 |
   | Sin `@Roles` pero con `@UseGuards` de dominio (`GUARD_ONLY`) | 14 | 0,8 |

5. **202 rutas no declaran autorización en el controlador; 96 de ellas mutan estado** (community 30, directory 10, profiles 9, insurance 9,
   telemetry 8, billing 6, common 6, practice 6, iam 5, clinical_ext 2, y 1 en integrations, pharma_lab, pharmacy_inventory, read_models, terminology).
   Dos casos se verificaron a mano y **sí** están autorizados en el servicio por membresía: `TenantsController` →
   `assertCanAdminister` (`directory/services/directory-memberships.service.ts:83`) e `InsuranceBackboneController`
   (`insurance/presentation/controllers/insurance-backbone.controller.ts:86-91`, «la barrera es la membresía OWNER/ADMIN del tenant»).
   **El resto NO se verificó**; los metadatos del controlador no lo demuestran, por eso el endpoint los clasifica como hueco de revisión
   (`UNDECLARED_AUTH`, prioridad alta si mutan) y no como falla.
6. **Roles transversales (no son un módulo):** `SYSTEM` autoriza rutas de 38 módulos, `SECURITY_ADMIN` 32, `CLINICIAN` 21, `PRACTITIONER` 18, `PATIENT` 14,
   `PLATFORM_ADMIN` 14. Un rol así no se puede acotar a un módulo con la matriz mientras la ruta se autorice por código de rol.
7. **Acciones sensibles sólo por rol:** 37 rutas `delete/export/approve/reject/assign/configure` dependen únicamente de `@Roles`
   (accounting 4, scheduling 4, authz 3, practice 3, y 1–2 en otros 19 módulos). Se listan en §4 (apéndice, columnas `delete`, `approve`…).
8. **Guards de dominio:** 103 rutas llevan `@UseGuards` (pharma_lab 41 `PharmaLabScopeGuard`, pharmacy 25 `PharmacyTenantScopeGuard`, diagnostics 14 `LabStaffGuard`/`ClinicalRecordAccessGuard`, clinical 11 y chart 4 y clinical_ext 2 `ClinicalRecordAccessGuard`,
   document_store 5 `CollectionNameGuard`, common 1 `FileLinkTargetGuard`). Esos guards acotan por pertenencia/alcance, no por permiso fino: también cuentan como «sin permiso fino».
9. **17 constantes de roles con spread** (`...PORTAL_READ_ROLES` en 32 rutas, `...OPS_READ_ROLES` 9, `...ANALYTICS_READ_ROLES` 8, `...QA_LAB_READ_ROLES` 8, …) esconden
   los roles reales al escáner estático. El endpoint en vivo sí los resuelve (lee el metadato en tiempo de ejecución).

## 2. Definición de «hueco»

| Hueco (`kind`) | Cuándo | Prioridad |
|---|---|---|
| `ROLE_ONLY` | Grupo (módulo·recurso·acción) cuyas rutas sólo tienen `@Roles` y para el que no existe un permiso fino | media si alguna ruta muta; baja si sólo lee |
| `UNDECLARED_AUTH` | Rutas sin `@Roles`, `@Public`, guard ni `/me` | alta si alguna muta; media si sólo lee |
| `GUARD_ONLY` | Rutas con guard de dominio y sin `@Roles` ni permiso fino | baja |
| `MODULE_WITHOUT_FINE_PERMISSIONS` | Módulo con rutas que autorizar y **cero** permisos finos | media |

«Tiene permiso fino» = existe en `authz.permissions` un permiso cuyo (módulo, recurso, acción) coincide con el del grupo. Un código sembrado a mano
(`DIAGNOSTIC_RESULT_READ`) se ubica por el prefijo de su `resource` y la acción sembrada (`READ`→`read`, `WRITE`→`update`, `CREATE`, `DELETE`, `APPROVE`; `EXECUTE` no tiene equivalente canónico y queda como `other`).

## 3. Tabla módulo → permisos → huecos

«Rutas en hueco» = `ROLE_ONLY` + sin declarar + `GUARD_ONLY` (todas las que no tienen respaldo en un permiso fino). Carpetas = `src/modules/<carpeta>`; `app.controller.ts` y `persistence` son la raíz de `src/`.

| Módulo | Ctrl. | Rutas | Sólo `@Roles` | Sin autorización declarada | Guard de dominio | Públicas / `/me` | Mutaciones sólo por rol | Permisos finos sembrados | Códigos propuestos | Huecos |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `accounting` | 10 | 59 | 59 | 0 | 0 | 0 | 37 | 0 | 59 | 59 rutas |
| `admin_catalogs` | 1 | 7 | 7 | 0 | 0 | 0 | 4 | 0 | 7 | 7 rutas |
| `ads` | 1 | 18 | 18 | 0 | 0 | 0 | 17 | 0 | 18 | 18 rutas |
| `app.controller.ts` | 1 | 4 | 0 | 1 | 0 | 3 | 0 | 0 | 4 | 1 rutas |
| `audio_assets` | 2 | 10 | 8 | 2 | 0 | 0 | 7 | 0 | 10 | 10 rutas |
| `audit` | 6 | 14 | 14 | 0 | 0 | 0 | 10 | 0 | 13 | 14 rutas |
| `auth_providers` | 1 | 12 | 12 | 0 | 0 | 0 | 12 | 0 | 12 | 12 rutas |
| `authz` | 10 | 42 | 42 | 0 | 0 | 0 | 27 | 0 | 41 | 42 rutas |
| `automation` | 2 | 17 | 17 | 0 | 0 | 0 | 17 | 0 | 17 | 17 rutas |
| `billing` | 6 | 38 | 20 | 18 | 0 | 0 | 16 | 0 | 38 | 38 rutas |
| `chart` | 7 | 23 | 19 | 0 | 0 | 4 | 13 | 0 | 20 | 19 rutas |
| `clinical` | 11 | 42 | 39 | 0 | 0 | 3 | 31 | 0 | 42 | 39 rutas |
| `clinical_ext` | 8 | 32 | 29 | 3 | 0 | 0 | 22 | 0 | 31 | 32 rutas |
| `clinical_import` | 1 | 8 | 8 | 0 | 0 | 0 | 2 | 0 | 8 | 8 rutas |
| `common` | 6 | 19 | 10 | 8 | 1 | 0 | 9 | 0 | 19 | 19 rutas |
| `community` | 14 | 100 | 17 | 59 | 0 | 24 | 9 | 0 | 95 | 76 rutas |
| `consent` | 11 | 27 | 27 | 0 | 0 | 0 | 18 | 0 | 25 | 27 rutas |
| `content_packs` | 1 | 2 | 2 | 0 | 0 | 0 | 1 | 0 | 2 | 2 rutas |
| `crm` | 1 | 16 | 16 | 0 | 0 | 0 | 14 | 0 | 16 | 16 rutas |
| `cross_store_consistency` | 2 | 16 | 16 | 0 | 0 | 0 | 14 | 0 | 16 | 16 rutas |
| `data_catalog` | 4 | 38 | 38 | 0 | 0 | 0 | 9 | 0 | 38 | 38 rutas |
| `delegated_access` | 5 | 12 | 12 | 0 | 0 | 0 | 10 | 0 | 12 | 12 rutas |
| `diagnostic_units` | 5 | 21 | 18 | 3 | 0 | 0 | 16 | 0 | 20 | 21 rutas |
| `diagnostics` | 7 | 31 | 18 | 0 | 13 | 0 | 11 | 1 | 30 | 31 rutas |
| `directory` | 3 | 26 | 6 | 19 | 0 | 1 | 5 | 0 | 25 | 25 rutas |
| `document_store` | 1 | 5 | 5 | 0 | 0 | 0 | 3 | 0 | 5 | 5 rutas |
| `education` | 1 | 14 | 14 | 0 | 0 | 0 | 14 | 0 | 14 | 14 rutas |
| `erp` | 1 | 17 | 17 | 0 | 0 | 0 | 17 | 0 | 17 | 17 rutas |
| `forms` | 6 | 25 | 23 | 0 | 0 | 2 | 17 | 0 | 23 | 23 rutas |
| `geo` | 5 | 11 | 10 | 0 | 0 | 1 | 9 | 0 | 11 | 10 rutas |
| `governance_admin` | 2 | 7 | 7 | 0 | 0 | 0 | 1 | 0 | 7 | 7 rutas |
| `graph_intelligence` | 2 | 15 | 15 | 0 | 0 | 0 | 14 | 0 | 15 | 15 rutas |
| `health_context` | 1 | 13 | 13 | 0 | 0 | 0 | 12 | 0 | 13 | 13 rutas |
| `health_data` | 2 | 16 | 16 | 0 | 0 | 0 | 14 | 0 | 16 | 16 rutas |
| `iam` | 4 | 40 | 17 | 5 | 0 | 18 | 9 | 0 | 39 | 22 rutas |
| `identity_assurance` | 8 | 28 | 21 | 0 | 0 | 7 | 18 | 0 | 24 | 21 rutas |
| `insurance` | 19 | 64 | 40 | 21 | 0 | 3 | 27 | 0 | 63 | 61 rutas |
| `integration_contracts` | 2 | 12 | 12 | 0 | 0 | 0 | 12 | 0 | 12 | 12 rutas |
| `integrations` | 4 | 15 | 13 | 1 | 0 | 1 | 10 | 0 | 12 | 14 rutas |
| `lakehouse` | 2 | 13 | 13 | 0 | 0 | 0 | 12 | 0 | 13 | 13 rutas |
| `marketing` | 2 | 15 | 14 | 0 | 0 | 1 | 14 | 0 | 15 | 14 rutas |
| `medical_centers` | 1 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 2 | 2 rutas |
| `medical_groups` | 1 | 9 | 9 | 0 | 0 | 0 | 5 | 0 | 9 | 9 rutas |
| `messaging` | 4 | 20 | 19 | 0 | 0 | 1 | 16 | 0 | 20 | 19 rutas |
| `object_storage` | 2 | 14 | 14 | 0 | 0 | 0 | 12 | 0 | 14 | 14 rutas |
| `ops_console` | 1 | 9 | 9 | 0 | 0 | 0 | 0 | 0 | 9 | 9 rutas |
| `organization_extensions` | 4 | 9 | 9 | 0 | 0 | 0 | 9 | 0 | 9 | 9 rutas |
| `payments` | 3 | 14 | 13 | 0 | 0 | 1 | 13 | 0 | 14 | 13 rutas |
| `persistence` | 1 | 2 | 2 | 0 | 0 | 0 | 0 | 0 | 2 | 2 rutas |
| `pharma_lab` | 12 | 76 | 73 | 3 | 0 | 0 | 44 | 0 | 76 | 76 rutas |
| `pharmacy` | 4 | 37 | 25 | 9 | 0 | 3 | 23 | 0 | 37 | 34 rutas |
| `pharmacy_inventory` | 8 | 36 | 32 | 4 | 0 | 0 | 26 | 0 | 35 | 36 rutas |
| `platform_ops` | 1 | 15 | 15 | 0 | 0 | 0 | 15 | 0 | 15 | 15 rutas |
| `polyglot_storage` | 3 | 15 | 15 | 0 | 0 | 0 | 15 | 0 | 15 | 15 rutas |
| `practice` | 9 | 37 | 27 | 10 | 0 | 0 | 23 | 0 | 37 | 37 rutas |
| `procedures_perioperative` | 2 | 32 | 32 | 0 | 0 | 0 | 27 | 0 | 32 | 32 rutas |
| `profiles` | 9 | 84 | 29 | 13 | 0 | 42 | 20 | 0 | 78 | 42 rutas |
| `promotions` | 2 | 19 | 19 | 0 | 0 | 0 | 14 | 0 | 19 | 19 rutas |
| `public` | 1 | 4 | 0 | 0 | 0 | 4 | 0 | 0 | 4 | 0 rutas |
| `qa_execution` | 2 | 9 | 9 | 0 | 0 | 0 | 6 | 0 | 9 | 9 rutas |
| `qa_lab` | 3 | 21 | 21 | 0 | 0 | 0 | 12 | 0 | 21 | 21 rutas |
| `quotations` | 1 | 3 | 1 | 2 | 0 | 0 | 1 | 0 | 3 | 3 rutas |
| `read_models` | 3 | 15 | 10 | 3 | 0 | 2 | 9 | 0 | 15 | 13 rutas |
| `redis_runtime` | 1 | 5 | 5 | 0 | 0 | 0 | 4 | 0 | 5 | 5 rutas |
| `reporting` | 1 | 12 | 12 | 0 | 0 | 0 | 12 | 0 | 12 | 12 rutas |
| `scheduling` | 8 | 66 | 65 | 1 | 0 | 0 | 44 | 0 | 66 | 66 rutas |
| `search_platform` | 1 | 3 | 3 | 0 | 0 | 0 | 3 | 0 | 3 | 3 rutas |
| `surveys` | 4 | 18 | 15 | 0 | 0 | 3 | 11 | 0 | 18 | 15 rutas |
| `system_context` | 1 | 13 | 11 | 1 | 0 | 1 | 10 | 0 | 13 | 12 rutas |
| `system_ops` | 9 | 27 | 27 | 0 | 0 | 0 | 24 | 0 | 27 | 27 rutas |
| `telemetry` | 5 | 25 | 15 | 8 | 0 | 2 | 5 | 0 | 25 | 23 rutas |
| `terminology` | 7 | 25 | 15 | 7 | 0 | 3 | 12 | 0 | 25 | 22 rutas |
| `time_series` | 2 | 14 | 14 | 0 | 0 | 0 | 13 | 0 | 14 | 14 rutas |
| `tracking` | 1 | 11 | 10 | 0 | 0 | 1 | 10 | 0 | 11 | 10 rutas |
| `vector_rag` | 2 | 16 | 16 | 0 | 0 | 0 | 14 | 0 | 16 | 16 rutas |
| `workflow` | 3 | 11 | 11 | 0 | 0 | 0 | 10 | 0 | 11 | 11 rutas |
| **Total (76 carpetas)** | 310 | 1672 | 1325 | 202 | 14 | 131 | 996 | 1 | 1638 | 1541 rutas |

Lectura: **todas** las carpetas con rutas autorizables están en hueco salvo `public` (que sólo tiene rutas públicas). La única carpeta con un permiso sembrado (`diagnostics`)
lo usa como referencia de los grants por alcance de recurso (comentario de `authz.seed.ts:149-163`), no como barrera de ruta; sus 30 códigos propuestos siguen sin respaldo.

## 4. Catálogo propuesto `<modulo>.<recurso>.<acción>` (derivado de las rutas reales, **NO sembrado**)

Reglas de derivación (idénticas a las del endpoint: el escáner transpila `authz-modules-route-derivation.ts` tal cual):
recurso = últimos dos segmentos literales de la plantilla sin ruido (`admin`, `internal`, `v1`, `me`…) ni el propio módulo; acción por el verbo HTTP
(`GET /:id`→`read`, `GET` colección→`list`, `POST` a colección→`create`, `POST /:id/<verbo>`→`update`, `PUT/PATCH`→`update`, `DELETE`→`delete`) salvo que el último segmento sea un verbo
conocido (`approve`, `reject`, `assign`, `export`, `configure`/`settings`, `audit`). Las acciones canónicas son `read, list, create, update, delete, export, approve, reject, assign, configure, audit`;
sólo aparecen las que el módulo realmente ofrece. Cada línea es `recurso: acciones`; el código es `modulo.recurso.accion`.

**Esto es una propuesta para revisión humana** (regla 97.5.4: no se infieren reglas con consecuencia regulatoria sin fuente y revisión). Hay nombres de recurso largos (`users_role_assignments`)
porque se derivan mecánicamente; un humano debe renombrarlos antes de sembrar. No se sembró nada.

**`accounting`** (59 códigos): accounts: create, list · accrual_objects: create, list · accruals_run: create · assets: list · assets_automation: update · assets_capitalize: create · assets_depreciations: list · assets_progress: update · balance_sheet: read · clearing_documents: create · depreciation_run: create · dimensions: list · exchange_rates: create · fiscal_periods_lock: update · fiscal_years: create, list · general_ledger: read · income_statement: read · journal_transactions: approve, create, list, read · journal_transactions_classify: update · journal_transactions_document_flow: read · journal_transactions_drafts: create · journal_transactions_files: create · journal_transactions_post: update · journal_transactions_reverse: update · journal_transactions_submit_review: update · liabilities_automation: update · liabilities_payments: create · liabilities_progress: update · liabilities_schedule: read · open_items: create, list · postings_determine_accounts: create · practitioner_assets: create, list · practitioner_consultation_income: create · practitioner_entries: create · practitioner_liabilities: create, list · practitioner_paid_consultations: list · simple_accounts: create, delete, list, update · simple_records: create, delete, list, update · simple_summary: read · simple_transactions: create, delete, list, update · trial_balance: read

**`admin_catalogs`** (7 códigos): catalogs_services: create, list, read, update · services_deactivate: update · services_reactivate: update · services_scopes: list

**`ads`** (18 códigos): ad_accounts_experiments: create · ad_accounts_targeting: update · ad_sets_budget_schedules: create · ad_sets_identity: update · automated_rules: read · business_managers_ad_accounts: create · business_managers_partners: create · campaigns_launch: update · datasets_events: create · event_data_policies: create · feeds_run: update · ingest_insights: create · invoices_issue: update · lead_forms_submissions: create · offline_conversion_sets_upload: create · platform_connections: create · policy_violations_appeals: create · review_events: create

**`app.controller.ts`** (4 códigos): app.controller.ts: read · health: read · liveness: read · readiness: read

**`audio_assets`** (10 códigos): content: read · deprecate: update · garbage_collect: create · generated: update · generation_failed: update · pregenerate: create · prepare_generation: update · resolve: read · status: read · verify: create

**`audit`** (13 códigos): anomaly_scan: create · compliance_audit_export: create · data_access: create, read · events: create · history: read · integrity_verify: create · log: read · moderation_decisions: create · privacy_dsar: create, update · retention_apply: create · third_party_access: create

**`auth_providers`** (12 códigos): account_link_requests: create · account_link_requests_complete: create · by_code_callback: update · federated_identities_unlink: update · identity_providers: create · identity_providers_attribute_mappings: update · identity_providers_by_code: approve · identity_providers_protocol_configs: create · identity_providers_provisioning_rules: create · identity_providers_signing_keys: create · signing_keys_rotate: update · tenant_bindings: create

**`authz`** (41 códigos): access: read · access_reviews_due: read · cache_invalidate: create · care_relationships: create, list · care_relationships_request: create · care_relationships_respond: update · care_relationships_revoke: update · clinical_access_grants: delete · clinical_access_grants_revoke: update · decisions: read · internal_users: list · legal_representations: create, list · legal_representations_revoke: update · lifecycle_offboard: update · lifecycle_reactivate: update · lifecycle_suspend: update · patients_break_the_glass: update · patients_clinical_access_grants: create · permission_categories: create · permissions: create, list · requests_mine: read · resource_scope_grants: create, delete, list · roles: create, list · roles_field_permissions: list, update · roles_permissions: list, update · tenants_access_policies: create · users_access_reviews: create, list · users_lifecycle: read · users_permission_grants: create · users_role_assignments: create, delete, list

**`automation`** (17 códigos): agent_runs_approvals: create · agent_runs_steps: create · agents: create · agents_guardrails: create · agents_memory: update · approvals_decide: update · calendar_tick: create · guardrails: create · record_automations_execute: update · runs_agent_runs: create · runs_finalize: update · tools: create · triggers: create · versions_publish: update · versions_tool_bindings: create · workflows: create · workflows_runs: create

**`billing`** (38 códigos): bills: create · charges_invoices: create · charges_payment: update · documents: create · dunning_runs_execute: create · dunning_runs_run_due: create · instances_payments: create · invoices: create, list, read · invoices_annulment: update · invoices_annulment_reversal: update · invoices_email: update · invoices_issue_from_encounter: create · kpi_snapshots_compute: create · patient_spending: read · patient_statements: list · patient_statements_generate: create · payment_plans: create · payments_made_execute: create · payments_received_apply: create · procedure_specialties_mine: read · reconciliation_clear: create · reimbursements_link: create · service_catalog: create, read, update · service_catalog_image: read · service_catalog_import_procedures: create · service_catalog_procedure_specialties: list · service_catalog_procedures: list · simulated_catalogs: list · simulated_charges: list · simulated_invoices: read · simulated_my_invoices: list, read · simulated_outbox: read · simulated_status: read

**`chart`** (20 códigos): care_plans: create · care_plans_activities: update · documents: create, list · encounters_pdf: read · files_content: read · notes: create, list · notes_amendments: create · notes_versions: update · patients: read · templates: create, list, read · templates_assignments: create · versions_cosign: update · versions_exam_findings: create · versions_release: update · versions_sign: update · versions_withhold: update

**`clinical`** (42 códigos): allergy_intolerances: create · allergy_intolerances_attachments: create, list · care_episodes: create · conditions: create · conditions_attachments: create · conditions_change_status: update · conditions_verification: update · diagnostic_reports: create · diagnostic_reports_release: update · encounters_attachments: create, list · encounters_check_in: create · encounters_close: update · immunizations: create · medical_aspects: list, update · medication_records: create · medication_requests: create · medication_requests_attachments: create, list · medication_requests_edit: update · medication_requests_invalidate: update · medication_requests_issue: update · medication_requests_renew: update · medication_requests_replace: update · medication_requests_sign: update · observations: create · observations_amend: update · patients_received_services: list · patients_summary: read · prescription_expiry_notices: create · prescription_signature_policies: create, list · prescription_signature_policies_deactivate: update · prescriptions_pdf: read · prescriptions_verify: read · procedure_centers: list · procedures: create · procedures_attachments: create · service_requests: create · service_requests_duplicate_check: create

**`clinical_ext`** (31 códigos): care_gaps_close: update · care_gaps_recompute: create · care_teams: create, list · cds: read · cds_check_interactions: create · cds_rules: create · clinical_alerts_acknowledge: update · clinical_alerts_override: update · drug_interactions: create · immunization_plan_project: update · immunization_schedules: create · members_set_responsible: update · order_sets: create · order_sets_apply: update · prescription_favorites: create, delete, list · referrals: create, list, read · referrals_cancel: update · referrals_counter_referral: update · referrals_respond: update · referrals_target_services: list · referrals_targets: list · versions_publish: update · versions_rollback: update · virtual_encounters: create · virtual_encounters_end: update · virtual_encounters_join: update

**`clinical_import`** (8 códigos): catalog: read · clinical_import: create, list, read · confirm: update · import_template: read · loaded: read · report: read

**`common`** (19 códigos): addresses: create · audio_abort: update · audio_begin: update · audio_dispatch: update · contact_points: create · contact_points_verify: update · files: create, delete · files_content: read · files_download_url: update · files_links: create, list · files_upload: create · files_versions: create · identifiers: create · storage_lifecycle_recover: create · versions_derivatives: create · versions_pending_scan: read · versions_scan_result: update

**`community`** (95 códigos): attachments_content: read · badges_expire_sweep: create · badges_revoke: update · blocks: create, delete, list · bookmarks: create, delete, list · comments: create · comments_replies: list · conversations: create, list · conversations_contacts: read · conversations_messages: create, delete, list, update · conversations_participant: update · conversations_pin: delete, update · conversations_presence: read · conversations_read: update · decisions_appeal: update · decisions_mine: read · f: read · feed: read · feed_pending: read · feed_rebuild: create · follows: create, delete, list · groups: create, list, read · groups_members: create, delete, list, update · groups_posts: create, list · l: read · media: read · media_content: read · moderation_appeals: list, read · moderation_decisions: list · moderation_queue: read · nearby: read · notifications: list · o: read · p: read · patients_reviewable_care: read · patients_reviews: create · polls: read · polls_votes: create · posts: list, read · posts_comments: list · posts_polls: create · posts_reactions: list · profiles: read, update · profiles_auto_reply: read, update · profiles_by_slug: read · profiles_organization_showcases: read · profiles_posts: create, list · profiles_reviews: create, list · profiles_stats: list · public_profiles: create · queue_decision: update · ranking_apply: create · ranking_pending: read · ratings: list, update · ratings_mine: read · ratings_summary: read · reactions: update · reports: create · reviews_responses: create · s: read · search: read · search_diagnostic_units: list · search_health: read · search_insurers: list · search_medications: list · search_organizations: list · search_pharmacies: list · search_practitioners: list · search_reindex: create · topics: list · verification_badges: create

**`consent`** (25 códigos): consent: create, list · consent_evidence: create · encounters_informed_consent: read, update · expiration_sweep: create · hipaa_authorizations: create, list · hipaa_authorizations_revoke: update · objections: list · patient_objections: create, read · practitioner_access_requests: create · practitioner_access_requests_decision: update · practitioner_access_requests_mine: read · privacy_restrictions: create · processing_legal_bases: create · provisions: update · treatment_informed_consents: create, list, read · treatment_informed_consents_evidence: update · treatment_informed_consents_post_emergency_information: update · treatment_informed_consents_withdraw: update · withdraw: update

**`content_packs`** (2 códigos): apply: update · content_packs: list

**`crm`** (16 códigos): accounts: create · accounts_360: read · accounts_team_members: create · activities: create · cases: create, read · cases_comments: create · cases_status: update · channels_opt_in: update · leads: create · leads_convert: update · leads_qualify: update · opportunities_advance_stage: update · opportunities_lose: update · opportunities_win: update · partnerships: create

**`cross_store_consistency`** (16 códigos): archive_jobs: create · cache_invalidations: create · data_movement_jobs: create · dead_letters_replay: update · deletion_requests: create, update · deletion_requests_expand: update · deletion_targets_executed: read · deletion_targets_executions: create · deletion_targets_pending: read · deletion_targets_verifications: create · deliveries_process: create · drift_repair_jobs: create · projections_dead_letters: create · projections_definitions: create · reconciliation_runs: create

**`data_catalog`** (38 códigos): annotations_review: update · catalog_coverage: read · catalog_objects: list, read · catalog_permission_drift: read · catalog_scans: create, list, read · catalog_schemas: list · catalogo_deriva: read · catalogo_tablas: list, read · classification_run: create · columns_annotation: update · columns_evidence: read, update · flujos_grafo: read · flujos_hallazgos: list, read · flujos_mapa: read · inventory_import: create · linaje_tablas: read · objects_annotation: update · objects_changes: list · objects_columns: list · objects_evidence: read, update · objects_history: read · objects_impact: read · operaciones_arbol: read · portal_flujos: list, read · portal_glosario: read · portal_linaje: read · portal_operaciones: list, read · portal_version: read · scans_run_next: create

**`delegated_access`** (12 códigos): access_requests_decision: update · authz_effective_actor: read · delegated_permission_sets: create, list · delegated_permission_sets_versions: create · expiry_sweep: create · org_user_assignments: create, update · practitioner_delegates: create · practitioner_delegates_access_requests: create · practitioner_delegates_grants: create · practitioner_delegates_revoke: update

**`diagnostic_units`** (20 códigos): accreditations: create · administration: read · diagnostic_equipment: update · diagnostic_study_offerings: delete · diagnostic_unit_accreditations_renew: update · diagnostic_unit_sites: update · diagnostic_unit_sites_equipment: update · diagnostic_units: create, list, read · practitioner_assignments: create · price_schedules: create · price_schedules_study_prices: create · reproject: update · search: read · sites: create · specialties: update · study_offerings: create · study_prices_close: update · verify_and_publish: update

**`diagnostics`** (30 códigos): accessions: create, read · analyzer_runs: create · analyzer_runs_messages: create · clinical_media: create · containers_custody_events: create · critical_results: create · critical_results_acknowledge: update · data_quality_events: create · diagnostic_results: read · diagnostic_results_orders: list · diagnostic_results_shares: create, list · dicomweb_studies: create · files_content: read · imaging_endpoints: create · imaging_studies_dose_events: create · patients_imaging_studies: list · patients_orders: list · reports_versions: create · results_verifications: create · service_requests_inbox: create · shares_revoke: update · specimens: create, read · specimens_containers: create · specimens_rejection: update · versions_release: update · work_orders: create, list

**`directory`** (25 códigos): logo_content: read · memberships_branch_assignments: create, list · memberships_offboard: update · memberships_role: update · memberships_transfer: update · tenants: create, list, read, update · tenants_affiliation_documents: create · tenants_branches: create, list, update · tenants_child_tenants: create, list · tenants_laboratory_readiness: read · tenants_logo: read, update · tenants_memberships: create, list · tenants_pharmacy_readiness: read · tenants_public_profile: update · tenants_suspend: update · tenants_verification: update

**`document_store`** (5 códigos): collections_documents: create, delete, list, read, update

**`education`** (14 códigos): assessments_attempts: create · attempts_submit: update · certificates_cme_credits: create · certificates_revoke: update · courses_assessments: create · courses_cohorts: create · courses_instructors: create · courses_publish: create · courses_reviews: create · enrollments: create · enrollments_certificate: update · enrollments_complete: update · enrollments_lesson_progress: update · versions_publish: update

**`erp`** (17 códigos): bank_accounts_verify: update · bills_invoice_match_runs: create · business_partners: create · contracts: create · contracts_amendments: create · contracts_approval_requests: create · contracts_renewals: create · contracts_terminations: create · employees_onboard: create · employees_time_off: approve, update · lease_contracts_valuations: create · payment_schedules_generate: update · purchase_orders: create · purchase_orders_goods_receipts: create · purchase_orders_service_entry_sheets: create · sales_orders: create

**`forms`** (23 códigos): assignments: create, delete, list, update · assignments_budget: read · assignments_order: update · definition_sets: create, list, read · field_definitions: create, update · fields_access_rules: create · fields_dependencies: create · fields_localizations: update · instances: create, list, read · instances_close: update · instances_values: create · migrations_run: update · values: update · values_import: create · versions_publish: update

**`geo`** (11 códigos): geofence_events: create · geofences: create · reverse: create · tracked_subjects: create · tracked_subjects_last_position: read · tracked_subjects_pings: create · tracked_subjects_revoke_consent: update · tracking_sessions: create · tracking_sessions_close: update · trips: create · trips_close: update

**`governance_admin`** (7 códigos): data_quality_issues: list, read · data_quality_rules: list, read · governance_privacy_requests: list, read · issues_resolution: update

**`graph_intelligence`** (15 códigos): analytics_community_detection: create · analytics_risk_scoring: create · edges_expire: update · edges_upsert: create · graph_access_scopes: create, update · graph_deletion_jobs: create · graph_paths: create · graph_rule_hits: update · graph_rules: read · graph_traverse: create · nodes_upsert: create · projection_definitions_runs: create · projection_runs_advance: update · projections_reconcile: create

**`health_context`** (13 códigos): agents: create · collection_runs: create · collection_runs_finish: update · collection_runs_observations: create · contexts: create, read · contexts_versions: create · schedules: create · schedules_run_due: create · sources: create · versions_publish: update · versions_quality_reviews: create · versions_supersede: update

**`health_data`** (16 códigos): candidates_decision: update · canonical_resources_bindings: create · canonical_resources_identifiers: create · canonical_resources_project: create · canonical_resources_relationships: create · canonical_resources_retire: update · deidentification_runs: create · ingestion_batches: create · ingestion_batches_close: update · ingestion_batches_records: create · patient_everything: read · quality_runs: create · r5_export: create · source_connections: create · timeline_entries: create · versions: read

**`iam`** (39 códigos): auth_activate: create · auth_change_password: create · auth_forgot_password: create · auth_login: create · auth_logout: create · auth_logout_all: create · auth_register_organization: create · auth_register_patient: create · auth_register_practitioner: create · auth_resend_verification: create · auth_reset_password: create · auth_upload_registration_document: create · auth_upload_registration_logo: create · auth_upload_registration_signature_image: create · auth_verify_email: create · credentials_federated: update · credentials_revoke: update · onboarding_drafts: delete, read, update · sessions: list · sessions_purge: create · sessions_revoke: update · token_refresh: create · users: create, list, read · users_anonymize: update · users_assisted_practitioner_registration: create · users_assisted_registration: create · users_credentials: list · users_devices: create, list · users_global_roles: create, list · users_lock: update · users_mfa_factors: create, list · users_sessions: list

**`identity_assurance`** (24 códigos): assertions_revoke: update · authorities_endpoints: create · checks_attempts: create · checks_dispatchable: read · checks_results: create · evidence_lifecycle_scan: create · evidence_storage_purge_review: create · identity_authorities: create · identity_identity_verification: create · identity_verification_cases: create, list, read · identity_verification_policies: create · identity_verification_types: list · manual_review_decision: update · practitioner_identity_verification: create · practitioner_license_verification: create · tenants_verification: update · verification_cases_assertions: create · verification_cases_checks_plan: update · verification_cases_evidence: update · verification_cases_expire_sweep: create · verification_cases_fraud_signals: create · verification_cases_manual_review: update

**`insurance`** (63 códigos): active: read · analytics_loss_ratio: read · benefits_rules: update · broker_commission_statements: create · certificates_json: read · certificates_pdf: read · claim_disputes_appeal_decisions: create · coordination_of_benefits: create · coverage_eligibility_requests: create · employer_groups: create · insurance: create, read, update · insurance_brokers: create, list, read · insurance_brokers_agreements: create · insurance_brokers_clients: list · insurance_carrier_catalog: read · insurance_carriers: create, list, read · insurance_carriers_contact_channels: update · insurance_carriers_products: create · insurance_claims: create, list, read · insurance_claims_adjudications: create · insurance_claims_disputes: create · insurance_claims_eob: update · insurance_claims_patient_invoice: update · insurance_claims_quote: create · insurance_claims_reversals: create · insurance_plans_benefits: create, update · insurance_plans_premium: update · insurance_products_plans: create · my_benefits: list · my_claims: list · patient: read · patient_coverages: create, read · patient_coverages_by_patient: read · patients: read · patients_conversation: create · patients_options: list · portability: export · portability_verify: read · practitioner_settlement_batches: create, list, read · practitioners_insurance_networks: list · prior_authorization_requests: create, read · prior_authorization_requests_determinations: create · prior_authorization_requests_inbox: read · provider_networks: create · provider_networks_memberships: create · received_claims: list · received_claims_decision: update · reconciliation_batches: create · reconciliation_batches_items: create · status: update

**`integration_contracts`** (12 códigos): auth_profiles_rotate: update · contracts_auth_profiles: create · contracts_exchanges: create · contracts_retire: update · contracts_versions: create · contracts_webhook_subscriptions: create · exchanges_attempts: create · exchanges_retry: update · integration_contracts: create · sync_cursors_advance: update · versions_activate: update · webhooks_deliveries: create

**`integrations`** (12 códigos): connections: create · connections_credentials_rotate: update · messages: create · messages_outbound: create · messages_pending_correlation: read · messages_pending_dispatch: read · messages_pending_retry: read · providers: create · providers_connections: create · providers_endpoints: create · providers_webhook_subscriptions: create · webhooks_inbound: create

**`lakehouse`** (13 códigos): catalogs: create · data_products_versions: create · dataset_releases_expired: read · dataset_releases_revoke: update · datasets: create · datasets_quality_runs: create · ingestion_curated_runs: create · projects_cohorts: create · research_dataset_releases: approve, create · research_deidentification_profiles: create · transformations_runs: create · zones: create

**`marketing`** (15 códigos): attribution_compute: create · campaigns: create · content_templates_versions: create · enrollments_advance: update · enrollments_exit: update · journeys: create · journeys_activate: update · journeys_steps: create · members_materialize: update · r: read · segments: create · segments_refresh: update · touchpoints: create · tracked_links: create · tracked_links_recipient_tokens: create

**`medical_centers`** (2 códigos): search: read · search_for_my_orders: list

**`medical_groups`** (9 códigos): eligible_members: list · exercise_notes: update · medical_groups: create, list, read · members_respond: update · patients_conditions: list · reschedule_requests: create · reschedule_requests_respond: update

**`messaging`** (20 códigos): dead_letter_redrive: update · event_deliveries_ack: update · events_dispatch: update · in_app_read: update · in_app_read_all: create · jobs_complete: update · jobs_fail: update · notifications: read · notifications_deliver: update · notifications_pending: read · notifications_preferences: read, update · notifications_requests: create · notifications_web_push: configure · providers_receipts: create · queues_claim: update · queues_jobs: create · relay_run: create · web_push_subscription: delete, update

**`object_storage`** (14 códigos): archive_jobs_build: create · large_payloads: create · objects_request_deletion: update · objects_versions: create · series_instances: read · studies_catalog: create · uploads_complete: update · uploads_initiate: update · versions_content: read · versions_integrity_checks: create · versions_legal_holds: create, delete · versions_retention_lock: update · versions_signed_url: update

**`ops_console`** (9 códigos): ops_backups: list · ops_change_requests: list · ops_deployments: list · ops_incidents: list, read · ops_readiness: read · ops_slos: list · ops_traffic: read · traffic_endpoints: list

**`organization_extensions`** (9 códigos): affiliations_terminate: update · facility_licenses_verify: update · hospitals_activate: update · hospitals_service_lines: create, delete · orgext_affiliations: create · orgext_data_boundaries: create · orgext_facility_licenses: create · orgext_hospitals: create

**`payments`** (14 códigos): callbacks: create · checkout_sessions: create · fee_schedules: create · intents: create · intents_fx_lock: update · intents_risk_assessment: update · intents_splits: create · intents_transactions: create · payouts: create · reconciliation_runs: create · settlements_import: create · transactions_cancellation_requests: create · transactions_refunds: create · transactions_status_inquiry: update

**`persistence`** (2 códigos): data_sources_metrics: list · health_data_sources: list

**`pharma_lab`** (76 códigos): blocks_lift: update · cost_allocations: create · cost_allocations_report: read · expirations_review: update · labs_close: update · labs_rating_summary: read · labs_results: list · link_events: list · materials: create, list · materials_approvals: list · materials_assets: create, list · materials_decision: update · materials_submit: update · medical_visitors: create, list · medical_visitors_products: update · medical_visitors_relink: update · medical_visitors_specialties: update · medical_visitors_unlink: update · medical_visitors_verifications: create · notices_mine: read · notices_read: update · pharma_lab: create, list, read, update · pharmacovigilance_reports: create, list, read · products: create, list, update · products_status: update · reference_concepts: list · regulatory_documents: create, list, read · regulatory_documents_access_log: read · regulatory_documents_invalidate: update · regulatory_documents_versions: create · reports_actions: create · staff: read, update · staff_permissions: update · staff_unlink: update · versions_download: update · visit_agenda: read, update · visit_agenda_blocks: create, list · visit_agenda_doctors: read · visit_records: create · visit_records_confirm: update · visit_records_inbox: read · visit_records_labs: read · visit_records_rating: update · visit_requests: create, read, reject · visit_requests_accept: update · visit_requests_cancel: update · visit_requests_inbox: read · visit_requests_mine: read · visit_requests_propose_time: update · visit_requests_request_info: update · visit_requests_reschedule: update · visit_surveys_labs: create, read · visit_surveys_pending: read · visit_surveys_responses: create, read · visitor_posts: create, list · visitor_posts_decision: update

**`pharmacy`** (37 códigos): catalog_products: list · categories_bulk: update · integration_connections_product_mappings: create · licenses_verify: update · medications: list · medications_availability: read · on_call_shifts_cancel: update · pharmacies: create, list, read · pharmacies_categories: create, delete, list, update · pharmacies_contacts: list · pharmacies_integration_connections: create · pharmacies_inventory: update · pharmacies_licenses: list · pharmacies_open_now: read · pharmacies_opening_hours: list · pharmacies_price_lists: create · pharmacies_products: create, delete, update · pharmacies_projections: create · pharmacies_sites: create · pharmacies_summary: read · price_lists_close: update · price_lists_prices: create · prices_bulk: update · products: list · products_bulk: update · sites: list · sites_bulk: update · sites_on_call_shifts: create · sites_open_24h: update · sites_prices: list

**`pharmacy_inventory`** (35 códigos): availability: read · dispensations_reverse: update · integration_connections_external_products: list · integration_connections_product_mappings: list · integration_connections_sync: update · integration_connections_sync_batches: list · inventory_sync_batches: create · inventory_sync_reconcile: update · orders_accept_substitutions: create · orders_cancel: update · orders_confirm: update · orders_conversation: update · orders_dispense: update · orders_prefer_original: update · orders_ready: update · orders_review: update · pharmacies_integration_connections: list · pharmacy_count_sessions: approve, create · pharmacy_dispensations: create · pharmacy_goods_receipts: create · pharmacy_inventory_locations: create · pharmacy_orders: create, list, read, reject · pharmacy_purchase_orders: create · pharmacy_recall_holds: create · pharmacy_reservations: create · pharmacy_suppliers: create · pharmacy_transfers: create · products_availability: update · recall_holds_release: update · reservations_expire: create · sites_stock: read

**`platform_ops`** (15 códigos): capacity_plans_measurements: create · change_requests_approvals: create · deployments_rollback: update · error_budget_burn_events: create · health_checks_runs: create · incidents_postmortem: update · ops_artifacts: create · ops_change_requests: create · ops_deployments: create · ops_incidents: update · ops_runbook_executions: create · readiness_reviews_complete: update · resilience_exercises_complete: update · runbooks_versions: create · slo_measurements: create

**`polyglot_storage`** (15 códigos): datasets_data_access_policies: create · datasets_versions: create · finops_storage_cost_snapshots: create · governance_collections: create · governance_consistency_policies: create · governance_datasets: create · governance_encryption_profiles: create · governance_placements: approve · governance_policies: create · governance_storage_backends: create · integrity_verify: update · ops_integrity_policies: create · ops_store_health_checks: create · placements_failover: update · tenants_storage_bindings: create

**`practice`** (37 códigos): accreditations: create · accreditations_verify: update · healthcare_services: create, list, update · inventory_items: create · inventory_items_movements: create · organization: read · practice: create, list · practitioners_role_assignments: list, reject · practitioners_sites: create, delete, list, update · role_assignments: approve, create, list, reject · role_assignments_accept: update · role_assignments_end: update · role_assignments_invitations: create · role_assignments_self_request: update · role_assignments_support_assignments: create · role_assignments_suspend: update · settings: update · sites: create, delete, list · sites_bank_qr: update · sites_care_spaces: create, list · sites_clinical_units: create · sites_contact_phone: update · sites_logo: update · tenants: create

**`procedures_perioperative`** (32 códigos): charge_items_post: update · dental_procedures: create, list · dental_procedures_catalog: read · operative_reports_sign: update · pacu_stays_assessments: create · pacu_stays_discharge: update · preoperative_orders_verify: update · procedure_cases: create, list, read, update · procedure_cases_anesthesia_events: create · procedure_cases_anesthesia_plans: approve, create · procedure_cases_cancel: update · procedure_cases_confirm: update · procedure_cases_diagnoses: create · procedure_cases_findings: create · procedure_cases_implants: create · procedure_cases_medication_uses: create · procedure_cases_operative_reports: create · procedure_cases_operative_steps: create · procedure_cases_pacu_stays: create · procedure_cases_preoperative_assessments: create · procedure_cases_preoperative_orders: create · procedure_cases_specimens: create · procedure_cases_team_members: create, list · safety_checklists_responses: create · team_members_accept: update · team_members_respond: update

**`profiles`** (78 códigos): addresses_preferred: update · admission_resubmit: create · admission_withdraw: create · admissions: assign, list, read · admissions_claim: update · admissions_decision: update · admissions_expire_sweep: create · admissions_reinstate: update · admissions_release: update · admissions_request_info: update · admissions_suspend: update · credentials: list · credentials_verify: update · dependent_requests_accept: update · dependent_requests_incoming: read · documents_content: read · documents_download_url: update · items_review: update · merge_reverse: update · patients: create, list, read, update · patients_addresses: create, delete, list, update · patients_dependent_candidates: list · patients_dependent_requests: create, reject · patients_dependents: create, list · patients_identity_links: create · patients_merge: create · patients_merge_events: list · patients_photo: delete, update · patients_portal_proxies: create · patients_primary_practitioner: delete, read, update · patients_related_persons: create · patients_summary: read · persons_account_links: create · persons_decease: update · practitioner_requests_revoke: update · practitioners: create, list, update · practitioners_admission: read · practitioners_affiliations: create, delete, list, update · practitioners_credentials: create, delete, update · practitioners_jurisdiction_authorizations: create, delete, update · practitioners_linkable_organizations: list · practitioners_onboarding: read · practitioners_photo: delete, update · practitioners_primary_patients: list · practitioners_signature_assets: list, update · practitioners_specialties: create, delete, update · practitioners_specialty_counts: list · practitioners_summary: read · specialties_primary: update · tenants_practitioner_requests: approve, list, reject

**`promotions`** (19 códigos): checkout_apply_discount: update · coupons: read · coupons_batch: update · jobs_expire_points: create · loyalty: read · loyalty_points: list · loyalty_programs: create, list · memberships_recompute: update · points_earn: update · points_redeem: create, update · programs_memberships: create · promotions: create, read · redemptions: create · redemptions_reverse: update · referral_programs_referrals: create · referrals_qualify: update

**`public`** (4 códigos): f_branch_availability: update · f_branches: list · f_products: list · o_services: list

**`qa_execution`** (9 códigos): environments_target: update · plans_approvals: create · plans_cancel: update · plans_preflight: create · plans_run_next: create · qa_plans: create, list, read · qa_targets: list

**`qa_lab`** (21 códigos): cases_execute: update · qa_case_results: read · qa_defects: create, list, update · qa_environments: create, list · qa_flows: list, read · qa_runs: create, list, read · qa_schedules: create · qa_suites: list, read · runs_artifacts: create · runs_finalize: update · runs_link_release: update · schedules_run_due: create · suites_cases: create · suites_publish: update

**`quotations`** (3 códigos): quotations: create, list, read

**`read_models`** (15 códigos): backfill: update · definitions: create, delete · definitions_deprecate: update · definitions_versions: create · directory: read · health: read · invalidate: update · read_models: read · reconcile: update · refresh: update · routes_views: create · views_actions: list · views_data: read · views_preferences: update

**`redis_runtime`** (5 códigos): cache: create, delete, read · locks: create, delete

**`reporting`** (12 códigos): dashboards: create · data_sources: create · definitions: create · definitions_deprecate: update · definitions_executions: create · definitions_schedules: create · executions_distributions: create · executions_retry: update · executions_snapshot: update · scheduler_tick: create · schedules_subscriptions: create · versions_publish: update

**`scheduling`** (66 códigos): activity_types: list · appointments_direct: create · appointments_walk_in: create · booking_policies: create · bookings: list, read, reject · bookings_accept: update · bookings_cancel: update · bookings_check_in: update · bookings_complete: update · bookings_delay: update · bookings_payment_receipts: create, list, reject · bookings_payment_state: read, update · bookings_propose_schedule: update · bookings_reminders: create · bookings_request_info: update · bookings_reschedule: update · bookings_start: update · confirmation_rules: create, list, read · confirmation_rules_activate: update · confirmation_rules_deactivate: update · dispatch_reminders: create · exception_types: list · exceptions: delete, update · expire_holds: create · holds_confirm: update · holds_request: update · payment_receipts_confirm: update · payment_receipts_content: read · promote_waitlist: create · resources: create, list · resources_close_slots: create · resources_delay: update · resources_exceptions: create, list · resources_flexible_availability: read · resources_flexible_holds: create · resources_shift_slots: create · resources_slots: list · resources_templates: create, list · resources_waitlist: read · service_availability: read · service_offerings: create, list, update · service_offerings_holds: create · slots: list · slots_holds: create · templates: delete, update · templates_generate_slots: create · templates_live_bookings: list · templates_reactivate: update · tenants_agenda: read · waitlist: create, read · waitlist_candidates: list

**`search_platform`** (3 códigos): search_documents: create, delete · search_search: update

**`surveys`** (18 códigos): assignments: create · insights: list · invitations: create, list, read · invitations_responses: create · questions_order: update · templates: create, list, read, update · templates_deactivate: update · templates_questions: create, delete, update · templates_responses: list · templates_versions: create · versions_publish: update

**`system_context`** (13 códigos): contexts: create · contexts_bindings: create · contexts_refresh: update · contexts_rollback: update · definitions_bindings: create · definitions_retire: update · definitions_versions: create · dynamic_enums: list, read · dynamic_enums_bindings: list · dynamic_enums_definitions: create · versions_activate: update · versions_publish: update

**`system_ops`** (27 códigos): assessments_findings: create · assessments_remediation_plans: create · drafts_publish: update · entity_registry_retention: update · entity_registry_write_policy: update · governance_anonymization_rules: create · governance_cross_border_transfers: create · governance_drafts: create · governance_entity_registry: create · governance_field_registry: update · governance_findings: update · governance_legal_holds: create · governance_operational_frameworks: create · governance_pii_fields: list · governance_policies: list, read · governance_residency_policies: create · governance_retention_policies: create · governance_tenant_residency_bindings: create · governance_workload_assessments: create · governance_write_policies: create · legal_holds_release: update · ops_backup_policies: create · ops_restore_test_runs: create · remediation_actions_verify: update · retention_executions_run: create · workload_assessments_control_results: update

**`telemetry`** (25 códigos): activity_events: create · analytics_funnels: list · analytics_overview: read · analytics_pipeline_health: read · analytics_sessions: list, read · analytics_subjects: create · analytics_timeseries: list · analytics_web_vitals: list · client_contexts: create · conversion_events: create · disclosure_acceptances: create · disclosure_versions: create · event_schemas: create · funnels: create · funnels_report: read · onboarding_events: create · onboarding_funnel: read · onboarding_heatmap: read · session_journeys_close: update · tracking_consents: create, read · tracking_consents_withdraw: update · tracking_purposes: create · web_vitals: create

**`terminology`** (25 códigos): code_systems: create, list · code_systems_versions: create, list · codesystem_lookup: read · conceptmap_translate: create · concepts: list, read · concepts_deprecate: update · concepts_designations: create · concepts_glossary_article: read · concepts_glossary_graph: read · concepts_glossary_neighborhood: read · concepts_properties: create · concepts_relationships: create · import_template: read · tenants_catalog_policies: update · value_sets: create, list · value_sets_expand: read · value_sets_glossary_facets: list · valueset_expand: update · versions_import: update · versions_import_file: update · versions_publish: update

**`time_series`** (14 códigos): audit_daily_refresh: create · backfill_governed: update · compression_run: create · events_batch_ingest: create · metrics_batch_ingest: update · normalize_run: create · pings_batch_ingest: create · points_batch_ingest: update · readings_ingest: update · retention_policies: create · rollups_refresh: update · ts_hypertables: create, update · ts_series: read

**`tracking`** (11 códigos): eta_recompute: update · milestone_definitions: create · shipments_cancel: update · shipments_delivery_proof: update · shipments_dispatch: update · shipments_exception: update · shipments_handoffs: create · sla_scan: create · trackable_subjects: create · trackable_subjects_events: create · webhooks_carriers: create

**`vector_rag`** (16 códigos): collections: create · collections_embedding_jobs: create · collections_lifecycle: update · collections_re_embed: update · collections_reconciliation: update · deletion_jobs: create · embedding_jobs_pending: read · embedding_jobs_run: update · embedding_model_versions: create · embedding_model_versions_retire: update · rag_access_policies: create · rag_access_policies_publish: update · retrieval_sessions: create, read · retrieval_sessions_evidence: update · retrieval_sessions_feedback: update

**`workflow`** (11 códigos): aggregates_transitions: create, list · instances: create · instances_sweep_timeouts: create · state_machines: create · state_machines_publish: update · state_machines_states: create · state_machines_transitions: create · tasks_complete: update · transitions_compensate: update · transitions_retry: update

## 5. Recomendaciones (priorizadas, sin ejecutar)

1. **Decidir primero si los permisos finos se van a hacer cumplir en los controladores.** Hoy no existe un guard de permiso (`@RequirePermission` o equivalente): sembrar los códigos
   sin eso no cambia nada. Es una decisión de producto/arquitectura (a confirmar con el responsable de seguridad), fuera de este trabajo.
2. **Revisar las 96 rutas que mutan sin autorización declarada** (§1.5), empezando por `community`, `profiles`, `practice`, `billing` y `common`; confirmar en cada servicio la barrera real (membresía, propiedad) y declararla.
3. **Sembrar, con revisión, el catálogo de los módulos de mayor sensibilidad** a partir del §4: `accounting`, `authz`, `billing`, `payments`, `identity_assurance`, `consent`, `audit`, `pharmacy*`.
4. **Resolver las 17 constantes con spread** en el catálogo de roles por módulo para que el inventario estático y el vivo coincidan.
5. **Registrar el endpoint y la ruta del portal** (ver el informe de la tanda) para que el equipo vea estos mismos números en vivo, con los permisos que un admin haya creado a mano.

## 6. Qué NO cubre esta auditoría

- Es lectura de decoradores: **no** prueba que una ruta autorice bien en runtime, ni la autorización dentro de los servicios (membresía, propiedad, PDP clínico).
- No se ejecutó la API. El inventario en vivo (`GET /authz/catalog/modules`) se probó con dobles (ver el informe de la tanda); no contra una base real.
- La derivación de recurso y acción es heurística: ~1.638 códigos distintos para 1.672 rutas; algunos nombres son poco naturales y la acción de un `POST` de transición puede ser `update` aunque el negocio la llame de otro modo.
- La carpeta es el «módulo» del escáner estático; el endpoint en vivo toma el módulo de Nest que declara el controlador (con 4 alias para sub-módulos). Pueden diferir en casos límite.
- `ui_visibility` existe como carpeta pero no tenía controladores al momento del escaneo (trabajo en curso de otra tanda).
