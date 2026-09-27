# PLAN — Tarea 4 · Campañas preventivas de aseguradora (Proceso 4 · M-06)

- **Fecha:** 2026-09-25 · **Actor:** Marcelo (dev/QA lead) · **Base:** `origin/dev` de los tres repos.
- **Repos y ramas** (worktrees hermanos bajo `C:/wt/campaigns/`, obligatorio por `salud-db/paths.py` y `scripts/db/vendor-ddl.sh`):
  - `mantra-core-health-model` → `marcelo/feat-insurance-preventive-campaigns-model`
  - `mantra-core-health-api` → `marcelo/feat-insurance-preventive-campaigns-api`
  - `mantra-core-health` → `marcelo/feat-insurance-preventive-campaigns`
- **Predecesor:** Tareas 1–3 del módulo aseguradora (portabilidad, WhatsApp, exclusiones/H8). Tarea 4 es la única fila `FALTA` del anexo E (A4.1/A4.2) de la verificación 2026-09-25.
- **Decisiones del usuario (2026-09-25):** tres PRs modelo → API → front; handlers mock en archivo nuevo; CTA = navegar a turnos + aviso contextual.

## Contexto

El cliente pide (registro de procesos §6.4 «Módulo de promociones») que la aseguradora haga campañas de prevención junto a importadoras/fabricantes de medicamentos y laboratorios, para que no suban las primas ni el seguro erogue por enfermedades evitables. Hoy no existe nada de esto: ni tabla, ni endpoint, ni pantalla. Lo que hay de "campañas" es de farmacia (FAR-I7, en memoria, sin backend) y de marketing genérico (`marketing.marketing_campaigns`, rol `MARKETING_MANAGER`, sin aseguradora ni bonificación).

**Resultado observable:** una operadora de Seguros Andina crea `CMP-CARDIO-2026` (laboratorio, CIE-10 `I10`, 100 % de copago bonificado, 60 días, dos aliados) y la activa; Ana Lucía (paciente con cobertura de Seguros Andina) ve la tarjeta «100 % Cubierto por tu Seguro» en su panel y en «Mi cuenta › Seguros», y el botón la lleva a pedir turno de laboratorio con la campaña como contexto. Campañas en borrador, pausadas, vencidas o de otra aseguradora no aparecen.

**Kill-test:** si el paciente de Seguros Andina ve una campaña de La Vitalicia, o si un paciente obtiene 200 al pedir `GET /insurance-campaigns/patient/<id-ajeno>`, la tarea está mal.

## FASE 0 · Hallazgos forenses (corrigen el prompt; no se asumen)

- `REGISTRO DE PROCESOS POR MODULO.md` no existe con ese nombre. Fuente real: `mantra_core_technologies_health_docs/SALUD/📋 Registro de procesos por módulo.md` §6.4 (L608-611) y `AlovidaPromptManager/docs/verificacion/registro-de-procesos-2026-09-25/FUENTE-registro-de-procesos-2026-09-25.txt` (L527-529). Texto idéntico al citado; líneas distintas (misma A0 que Tarea 3). `REQUISITOS-CLIENTE-ALOVIDA.md:555-559` sí coincide.
- `REPLANIFICACION_ROADMAP_HARDENING_Y_ASEGURADORA.md` §H-INS-4 no existe en ningún repo ni historial. Se trabaja sin él.
- «Regla 00 §4» es "Pruebas". El requisito de PLAN previo es Regla 00 §5.1 + `20-plan-obligatorio.md` + `AGENTS.md` §2.1 (`AlovidaPromptManager/.claude/rules/`). Regla 35 nombra el archivo `evidencia/doble-revision.md` (no `double-review.md`); se usa el nombre de la regla.
- Tarea 3 no está "100 % mergeada": #457/#459/#663 están en `dev`; #663 no está en `mockup`; lotes H8 sin pantalla ni cron. No afecta a Tarea 4.
- Decisión de producto **D4** (verificación 2026-09-25): campañas dirigidas por diagnóstico del paciente requieren consentimiento específico. → La campaña se **anuncia a todos los afiliados** de la aseguradora; el CIE-10 describe la patología que previene y **nunca filtra pacientes por historia clínica**.
- Front `dev` local está 3 commits detrás de `origin/dev` (`9870b83a`, menú de aseguradora con `tenantTypes`/`activeTenantType`). Worktrees desde `origin/dev`.
- **No existe `/my-account/insurance`.** El seguro del paciente es la pestaña `pestanas[3]` de `/my-account` (deep link `/my-account?pestana=seguros`).
- El tenant activo de un paciente **no es** el de su aseguradora; la aseguradora se resuelve por `patient_coverages → insurance_plans → insurance_products → insurance_carriers`.
- Usuarios mock: `aseguradora@alovida.mock` (Patricia Suárez · Seguros Andina, tenant `TENANT_ASEGURADORA`, roles `USER`), `aseguradora.staff@alovida.mock`, `paciente@alovida.mock` (Ana Lucía Pérez Quiroga, cobertura "Seguros Andina / Plan Integral" en `core/mock/fixtures/personas.ts:335`, sin `carrierId`). Cualquier contraseña no vacía.
- CIE-10 vive en `terminology.catalog_concepts` (uuid, code system `icd10cm`); `I10` sembrado, `E11` sólo como `E11.9`, `C50` no. El E2E usa `I10`.
- **Esquema DDL-first sin migraciones MikroORM.** Flujo Regla 97: `.puml` → `salud-db/gen_ddl.py` → `SQL/` (modelo) → `yarn db:vendor` (copia a `api/database/`) → `gen_entities.py` genera las entidades de la API. Último parche v4221; v4222 usado en mensaje de commit del modelo → **v4223**. La bóveda de FK que usa `gen_ddl.py` (`WORKSPACE/Mantra Core Health Vault/SALUD/FK`) existe en la Dell como `ALOVIDA/mantra_core_technologies_health_docs/SALUD/FK` (6748 fichas) → se expone con un junction.
- Pruebas de integración HTTP de la API rotas en esta máquina (bug MikroORM/ts-morph `CatalogConcepts`) → sólo unitarios con `EntityManager` mockeado. **Nunca tocar Neon.**
- `docs:openapi:generate` levanta `AppModule` y necesita Postgres → Docker local montando `./database/SQL`.
- Sin `gh` en la Dell: PRs por API REST de GitHub con la credencial de `git credential fill`. El MCP de GitHub falló en esta sesión.

## Decisiones de diseño registradas (Regla 00 §1 / 97.4.6)

| Tema | Decisión | Por qué |
|---|---|---|
| Tabla | Nuevas `insurance.insurance_campaigns` + `insurance.insurance_campaign_partners` | `marketing_campaigns`/`promotions` son marketing de comercio (segmentos, cupones, rol MARKETING_MANAGER), sin aseguradora ni bonificación de copago; mezclar dominios viola el modelo por módulo |
| Aliados | Tabla hija con `partner_role` SPONSOR (importadora/fabricante) vs PROVIDER (laboratorio/farmacia/centro), `partner_name` obligatorio, `partner_tenant_id` referencia blanda, `network_provider_membership_id` FK opcional | El requisito distingue quién financia (importadoras) de dónde va el paciente (laboratorios); las importadoras no son tenants del sistema; reutiliza `network_provider_memberships` cuando el aliado está en la red |
| Estados | `DRAFT → ACTIVE → PAUSED ⇄ ACTIVE → EXPIRED` (EXPIRED manual, terminal); el paciente sólo ve `ACTIVE` **y** `valid_from ≤ hoy ≤ valid_to` | CA-4.3 sin cron; vencimiento efectivo por fecha, cierre administrativo por estado |
| URL API | `@Controller('insurance-campaigns')` | Literal al prompt; mayoría de controladores del módulo usan `insurance-*` |
| Endpoint paciente | `GET /insurance-campaigns/patient/:patientProfileId` con `assertOwnsPatientProfile` | CA-4.5 exige el id en la URL para probar IDOR; misma pauta que portabilidad |
| Autorización | `@Roles()` vacío en todo; el servicio decide por membresía (`assertCanAdminister` muta, `assertCanRead` lista) | Convención del módulo; el claim `tenantTypes` es sólo presentación |
| CIE-10 | Entrada `targetConditionCode: 'I10'`; el servicio resuelve a `concept_id` con SQL (join `insurance-analytics.repository.ts:583-590`); respuesta `{ code, display }` | `TerminologyModule` no exporta lookup por código; DTOs del módulo ya exponen `code` resuelto |
| CHECK | En BD vía `diagram_33_integrity.puml` (`gen_integrity.py` → `05_constraints.sql`) **y** validación 400 en DTO/servicio | El comentario "sin CHECK" del parche v429 quedó viejo desde v4.2.11 |
| Front consola | Componente único lista + formulario inline (patrón `admin/services-catalog`), no diálogo | 8 campos + repetidor de aliados no caben en `ContentDialog` a 390 px; CLAUDE.md: "forms = one centered card" |
| Front widget | `features/insurance/patient-campaigns/patient-campaigns-widget` con `input.required patientProfileId`, dos anfitriones | Dominio dueño; precedente cross-feature `SymptomCheck` en patient-home |
| Mock | `core/mock/handlers/insurance-campaigns.handlers.ts` registrado en `handlers/index.ts` | `insurance.handlers.ts` ya tiene ~1100 líneas; mismo patrón que portabilidad |
| CTA | LABORATORY/DIAGNOSTIC_IMAGING/VACCINATION → `/my-account/appointments?seccion=pedir&resource=lab&campaign=<code>` + aviso en turnos; PHARMACY → `/pharmacies-directory?campaign=<code>` sin aviso | Elegido por el usuario; `appointments.ts:380` ya expone `queryParamMap` como signal |

## Alcance

**IN (modelo):** `Mantra Core Health Context/modules/diagram_26_insurance.puml` (2 entidades, relaciones, 2 `<<INDEX_SET>>`), `diagram_33_integrity.puml` (2 CHECK), `SQL/26_insurance/{02_tables,03_fk_intra,04_indexes,05_constraints,90_fk_deferred}.sql` regenerados, `SQL/_generation_report.md`, `SQL/patches/2026-09-25_v4223_insurance_preventive_campaigns.sql`.

**IN (API):** `database/SQL/**` vendorizado idéntico; `src/modules/insurance/entities/{insurance_campaigns,insurance_campaign_partners}.entity.ts` + `index.ts` (generados por `gen_entities.py 26`); `insurance.concepts.ts`; `src/common/seed/terminology-designations.es.ts`; `dto/insurance-campaigns.dto.ts` (+`dto/index.ts`); `repositories/insurance-campaigns.repository.ts` (+index); `services/insurance-campaigns.service.ts` + `.spec.ts` (+index); `controllers/insurance-campaigns.controller.ts` (+index) + casos en `controllers/insurance-controllers.spec.ts`; `insurance.module.ts`; `README.md` del módulo; `docs/contracts/insurer-preventive-campaigns.md`; `src/orm/catalog/**` (`yarn orm:catalog`); `openapi/*`, `docs/postman/*`, `docs/endpoints/*`, `docs/modules/insurance.md`; `docs/trabajo/2026-09-25-insurance-preventive-campaigns/{PLAN.md,REPORTE.md,evidencia/}`.

**IN (front):** `core/data-access/insurance/insurance.{types,client,client.spec}.ts`; `proxy.conf.json`, `proxy.conf.docker.json`, `deploy/api-locations.conf` (prefijo `/insurance-campaigns`); `core/navigation/{navigation.map,navigation.subgroups,access-tree}.ts`; `app.routes.ts` (`PANTALLAS_DIFERIDAS`); `features/insurance/insurance-campaigns/insurance-campaigns.{ts,html,css,spec.ts}`; `features/insurance/patient-campaigns/patient-campaigns-widget.{ts,html,css,spec.ts}`; `features/dashboard/patient-home/patient-home.{ts,html}`; `features/account/my-profile/my-profile.{ts,html}`; `features/account/appointments/appointments.{ts,html,spec.ts}` (aviso `?campaign=`); `core/mock/handlers/insurance-campaigns.handlers.ts` (+`handlers/index.ts`, spec); `playwright/carril-insurance-campaigns.spec.ts`; `docs/trabajo/2026-09-25-insurance-preventive-campaigns/{PLAN.md,REPORTE.md,evidencia/doble-revision.md,evidencia/*.png,evidencia/playwright-*.txt}`.

**OUT:** segmentación por diagnóstico del paciente (D4); canje real en farmacia (no existe ruta de canje); cron de vencimiento; PR a `mockup` (sólo `dev`, como pide el prompt); métricas de impacto actuarial de la campaña; edición completa de campaña (sólo alta + cambio de estado); filtro positivo del menú por tipo de tenant (farmacia también verá la sección, como ya ocurre con «Siniestralidad»).

**Ambigüedades (asunción tomada · quién confirma):**
- **A0** Bóveda con nombre distinto → junction `C:/wt/campaigns/Mantra Core Health Vault` → `ALOVIDA/mantra_core_technologies_health_docs` antes de generar; si el diff re-etiqueta FK preexistentes como `inferida`, se aborta y se pide la regeneración al dueño del modelo · Pablo.
- **A1** Número de parche v4223 (v4222 sólo en mensaje de commit) · Justin.
- **A2** `numeric` sin precisión en el `.puml` (como el resto del módulo); precisión 2 decimales en DTO.
- **A3** Paciente sin `X-Tenant-Id` en `POST`: `requireTenantId()` podría responder 412 antes del 403 → el servicio comprueba `actor.roles.includes('PATIENT')` (y ausencia de membresía administrable) y lanza `ForbiddenException` primero, para CA-4.7 literal.
- **A4** Id del paciente en ambos anfitriones = `AuthService.patientProfileId()` (claim `pid`), no `p.id` del perfil.
- **A5** FK nuevas sin ficha en la bóveda quedan etiquetadas `inferida por convención` sólo para las columnas nuevas; no se abre PR a la bóveda.
- **A6** `partner_tenant_id` sin FK física (precedente `provider_entity_id`).
- **A7** `EXPIRED` manual; sin cron.
- **A8** Fechas `AAAA-MM-DD`, fecha civil `America/La_Paz` (`patientCoverageReferenceDate()` de `src/modules/profiles/patient-coverage-validity.ts`).
- **A9** Plataforma (`isPlatform`) pasa `assertOwnsPatientProfile`; el 403 de CA-4.5 se prueba con un segundo paciente.
- **A10** Artefactos OpenAPI/Postman requieren Postgres local vía Docker; si Docker no está disponible, se declara `A MEDIAS` en REPORTE y se pide la regeneración.
- **A11** Sección sin `hiddenForTenantTypes` (igual que `insurance-analytics`); el backend decide por membresía.
- **A12** Icono existente en `NavIcon` (`umbrella` o `heart`); no se toca el átomo.
- **A13** El mock resuelve la aseguradora del paciente por el nombre `aseguradora` de `personas.ts` ('Seguros Andina' ↔ `TENANT_ASEGURADORA`).
- **A14** Componentes nuevos con `ChangeDetectionStrategy.OnPush`.

## Protocolo de ramas, worktrees y commits

```bash
mkdir -p /c/wt/campaigns
# Junction para la bóveda (A0) — PowerShell:  New-Item -ItemType Junction -Path "C:\wt\campaigns\Mantra Core Health Vault" -Target "C:\Users\DELL\Documents\GitHub\ALOVIDA\mantra_core_technologies_health_docs"
git -C C:/Users/DELL/Documents/GitHub/ALOVIDA/mantra-core-health-model fetch origin && git -C .../mantra-core-health-model worktree add C:/wt/campaigns/mantra-core-health-model -b marcelo/feat-insurance-preventive-campaigns-model origin/dev
git -C .../mantra-core-health-api   fetch origin && git -C .../mantra-core-health-api   worktree add C:/wt/campaigns/mantra-core-health-api   -b marcelo/feat-insurance-preventive-campaigns-api   origin/dev
git -C .../mantra-core-health       fetch origin && git -C .../mantra-core-health       worktree add C:/wt/campaigns/mantra-core-health       -b marcelo/feat-insurance-preventive-campaigns       origin/dev
```
- Nunca `git switch`/`checkout` en las carpetas compartidas; nunca `git stash` (compartido entre worktrees). `yarn install` aparte en cada worktree (`corepack yarn`; jamás `npm`).
- Antes de cada commit: `git branch --show-current` y `git rev-parse --show-toplevel`. Stage archivo por archivo, nunca `git add -A`.
- Conventional Commits `feat(insurance)`, `test(insurance)`, `docs(insurance)`, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Antes de push: `git fetch origin dev && git rebase origin/dev`; primer push `-u`; nunca force.
- PRs contra `dev` con reviewers `jsaldias39,PabloArauzCaballero` vía REST (`POST /repos/<owner>/<repo>/pulls` + `POST .../requested_reviewers`), cuerpo terminado en `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. El merge lo hace una persona; el trabajo termina con los tres PRs abiertos y MERGEABLE (Regla 35.2, salida del REST guardada en `evidencia/pr/`).

## H1 · Modelo y DDL (repo modelo)

**CA:** dado el `.puml` editado, cuando corren los generadores, entonces el diff de `SQL/` contiene exactamente las 2 tablas, sus FK/índices, los 2 CHECK y la fila 26 del reporte; el parche v4223 aplica idempotente sobre una base con v4221.

| ID | Microtarea | DoD |
|---|---|---|
| H1.S1.M1 | `diagram_26_insurance.puml`: entidades `insurance_campaigns` (`id, insurance_carrier_id <<FK>>, code, title, description, campaign_type_concept_id <<FK>>, target_condition_concept_id <<FK>> nullable, copay_bonus_percentage numeric, valid_from date, valid_to date, status_concept_id <<FK>>, activated_at timestamptz, auditoría, row_version`) e `insurance_campaign_partners` (`id, insurance_campaign_id <<FK>>, partner_role_concept_id <<FK>>, partner_type_concept_id <<FK>>, partner_name, partner_tenant_id uuid (sin FK), network_provider_membership_id <<FK>> nullable, auditoría, row_version`) tras `network_provider_memberships` (~L204); relaciones junto a L268 | `python salud-db/check_ddl_sources.py` → OK |
| H1.S1.M2 | `<<INDEX_SET>>` (formato `idxset_provider_networks` L736): `uq_insurance_campaigns_carrier_code (insurance_carrier_id, code) UNIQUE`, `ix_insurance_campaigns_carrier_status_validity (insurance_carrier_id, status_concept_id, valid_from, valid_to)`, IX por concept/user ids; partners: IX por `insurance_campaign_id`, roles/tipos, membresía, user ids | idem |
| H1.S1.M3 | `diagram_33_integrity.puml` (tras `service_requests`, L46): `ck_insurance_campaigns_valid_period ("valid_from" <= "valid_to")`, `ck_insurance_campaigns_copay_bonus_range (0..100)` | `python salud-db/gen_integrity.py` → `05_constraints.sql` con los 2 CHECK |
| H1.S2.M1 | `python salud-db/gen_ddl.py 26` con la bóveda expuesta (A0); revisar `git diff --stat` | Sólo cambian `26_insurance/*`, `_generation_report.md`; 0 FK preexistentes re-etiquetadas |
| H1.S2.M2 | Parche `SQL/patches/2026-09-25_v4223_insurance_preventive_campaigns.sql` (plantilla `2026-09-11_v429_chat_auto_replies.sql`): cabecera, `BEGIN`, `CREATE TABLE IF NOT EXISTS` ×2 literales de `02_tables.sql`, índices de `04_indexes.sql`, FKs con `EXCEPTION WHEN duplicate_object`, CHECK con `DROP CONSTRAINT IF EXISTS`, `COMMIT`, bloque `DO $$ … RAISE EXCEPTION` de comprobación | `python -m pytest salud-db/tests` verde |
| H1.S3.M1 | `python salud-db/gen_entities.py 26` → escribe entidades + barrel en `C:/wt/campaigns/mantra-core-health-api/src/modules/insurance/entities/` | `git -C api status` muestra sólo 2 entidades nuevas + `index.ts`; JSDoc ajeno preservado |
| H1.S4.M1 | Commit, push, PR modelo → `dev` (cuerpo: generadores corridos, diff esperado, enlace al parche) | PR abierto, MERGEABLE |

## H2 · API — datos, dominio y endpoints

**CA:** CA-4.1, 4.3, 4.4, 4.5, 4.6, 4.7 verificables en unitarios; guardrails y CI en verde.

| ID | Microtarea | DoD |
|---|---|---|
| H2.S1.M1 | Vendorizar DDL: `bash scripts/db/vendor-ddl.sh` (si hay `rsync`) o `robocopy <model>\SQL <api>\database\SQL /MIR /XD __pycache__ /XF .DS_Store *.pyc`; idem `NoSQL` si difiere | `bash scripts/db/vendor-ddl.sh --check` → "al día"; `git status` sólo `database/SQL/26_insurance/*`, `_generation_report.md`, parche |
| H2.S1.M2 | `insurance.concepts.ts` bloque `// Campañas preventivas (Tarea 4 · M-06)`: `CAMPAIGN_DRAFT/ACTIVE/PAUSED/EXPIRED`, `CAMPAIGN_TYPE_LABORATORY/PHARMACY/DIAGNOSTIC_IMAGING/VACCINATION`, `CAMPAIGN_PARTNER_ROLE_SPONSOR/PROVIDER`, `CAMPAIGN_PARTNER_TYPE_IMPORTER/MANUFACTURER/LABORATORY/PHARMACY/MEDICAL_CENTER`; etiquetas ES en `terminology-designations.es.ts` tras `INS.BENEFIT_CATEGORY_PHARMACY` (~L4022) | `yarn typecheck` 0 |
| H2.S1.M3 | `yarn orm:catalog` → `src/orm/catalog/{indexes,foreign-keys}/insurance.*.ts` | `git diff` sólo añade entradas de las 2 tablas |
| H2.S2.M1 | `dto/insurance-campaigns.dto.ts`: `InsuranceCampaignPartnerInputDto`, `CreateInsuranceCampaignDto` (`code @Matches(/^[A-Z0-9][A-Z0-9-]{2,39}$/)`, `title @Length(3,200)`, `campaignType @IsIn`, `targetConditionCode? @MaxLength(16)`, `copayBonusPercentage @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(100)`, `validFrom/validTo @Matches(YYYY-MM-DD)`, `partners @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested`, `activate? @IsBoolean`), `UpdateInsuranceCampaignStatusDto` (`status @IsIn(['ACTIVE','PAUSED','EXPIRED'])`), `InsuranceCampaignListQueryDto` (`type?, status?, cursor?, limit? 1..100`), `InsuranceCampaignResponseDto` + `InsuranceCampaignPageDto {items,nextCursor}`, `PatientCampaignDto` (sin `insuranceCarrierId`, `partnerTenantId`, ids de usuario) — todos con `@ApiProperty` | `yarn typecheck` |
| H2.S2.M2 | `repositories/insurance-campaigns.repository.ts`: `findByCarrierAndCode`, `listByCarrier` (keyset `(created_at DESC, id DESC)` con `encodeKeysetCursor/decodeKeysetCursor` de `src/common/pagination/keyset-cursor.ts`, filtros por concept ids), `findByIdForCarrier`, `resolveIcd10Concept(tx, code)` (SQL `catalog_concepts cc JOIN code_system_versions csv JOIN code_systems cs WHERE cs.internal_code='icd10cm' AND cc.code=$1 ORDER BY csv.is_default DESC LIMIT 1`), `findValidCarrierIdsForPatient(em, pid, today)` (join de `declared-coverages-reader.ts:91-107` + vigencia de `linked-claim-access.service.ts:107-142`), `findActiveCampaignsForCarriers(em, carrierIds, today)` (`status = INS.CAMPAIGN_ACTIVE AND valid_from <= today AND valid_to >= today`, partners con `json_agg`, CIE por LEFT JOIN); todo filtrado por `insuranceCarrierId` | `yarn alovida:guardrails` sin `TENANT_SCOPE_MISSING` |
| H2.S2.M3 | `services/insurance-campaigns.service.ts` (inyecta `EntityManager`, repo, `CatalogRepository`, `TenantAdministrationService`, `ProfileOwnershipService`, `AuditTrailService`): `administrableCarrier` (copia de `insurance-backbone.service.ts:374-387`, con chequeo A3 previo), `readableCarrier` (`assertCanRead`), `create` (400 fechas, 409 código, 400 CIE desconocido, DRAFT o ACTIVE si `activate` y `validTo ≥ hoy`, `createdBy`, partners, `flush`, auditoría `INSURANCE_CAMPAIGN_CREATED`), `changeStatus` (tabla de transiciones → 412 `PreconditionFailedException`; activar vencida → 412; otro carrier → 404; `touch`), `list`, `getById`, `listActiveForPatient` (`assertOwnsPatientProfile` con auditoría de denegación copiada de `insurance-portability.service.ts:454-478`, acción `INSURANCE_CAMPAIGN_ACCESS_DENIED`; sin cobertura → `[]`) | `yarn test src/modules/insurance/services/insurance-campaigns.service.spec.ts` verde |
| H2.S2.M4 | `services/insurance-campaigns.service.spec.ts` (dobles como `insurance-backbone.service.spec.ts:10-36`, `runWithTenant`): crear DRAFT; crear+activar; fechas invertidas 400; % fuera de rango (DTO) ; CIE desconocido 400; duplicado 409; PATIENT en POST 403 (CA-4.7); transiciones válidas/inválidas 412; EXPIRED inmutable; activar vencida 412; otro carrier 404; list con `nextCursor` y filtros; paciente ajeno 403 + `auditTrail.record(success:false)` (CA-4.5); sin cobertura `[]`; segmentación por carrier (CA-4.4); respuesta paciente sin ids internos | ≥ 16 casos verdes |
| H2.S3.M1 | `controllers/insurance-campaigns.controller.ts` `@ApiTags('insurance-campaigns') @ApiBearerAuth() @Controller('insurance-campaigns')`, todos `@Roles()`: `POST /` (201), `GET /`, `GET /patient/:patientProfileId` (**antes** de `GET /:id`, `ParseUUIDPipe`), `GET /:id`, `PATCH /:id/status`; `@CurrentUser() actor`; `@ApiOperation/@ApiOkResponse` | `yarn alovida:guardrails` sin `UNSCOPED_MUTATION` nuevo |
| H2.S3.M2 | Casos en `controllers/insurance-controllers.spec.ts` (delegación de 5 métodos + `Reflect.getMetadata('requiredRoles', …) = []`, patrón L207-236/374-386); registrar en `insurance.module.ts` (controllers + providers) | `yarn test src/modules/insurance` verde |
| H2.S4.M1 | `docs/contracts/insurer-preventive-campaigns.md` (secciones de `insurer-practitioner-settlement-batches.md`: propósito, actores, D4, estados, reglas, endpoints/DTOs, ambigüedades A0–A14) + sección en `README.md` del módulo | Existen; enlazados desde REPORTE |
| H2.S4.M2 | Artefactos: `docker compose up -d postgres` (monta `./database/SQL`, nunca Neon) → `yarn build && yarn docs:openapi:generate && yarn docs:endpoints:generate && yarn postman:generate && yarn docs:modules:sync && yarn docs:validate` | `git diff --exit-code` limpio tras commit; si no hay Docker → `A MEDIAS` declarado (A10) |
| H2.S5.M1 | `yarn typecheck && yarn lint --max-warnings=0 && yarn alovida:guardrails && yarn test:cov` | Todo 0/verde, cobertura ≥ umbrales |
| H2.S5.M2 | `docs/trabajo/2026-09-25-insurance-preventive-campaigns/{PLAN.md,REPORTE.md}` (REPORTE con línea `> **AVANCE: x / y — %.**`, secciones Completado/A medias/Pendiente/Evidencia/No cubierto/Desvíos/Riesgos/Decisiones); commits; PR API → `dev` (enlaza PR modelo; aclara que `database/` refleja la rama del modelo hasta su merge) | PR MERGEABLE, salida REST en `evidencia/pr/` |

## H3 · Front — cliente, navegación y consola de la aseguradora

**CA:** CA-4.1 en `/administration/insurance-campaigns` contra el mock; CA-4.6 reflejado en validaciones en tiempo real y 400/409 mapeados a la UI.

| ID | Microtarea | DoD |
|---|---|---|
| H3.S1.M1 | `insurance.types.ts`: `CampaignType`, `CampaignStatus`, `CampaignPartnerRole/Type`, `CampaignPartner`, `InsuranceCampaign`, `CampaignQuery`, `CampaignPage`, `CreateCampaignInput`, `PatientCampaign`; `insurance.client.ts`: `listCampaigns` (copiar `listClaims` L302-326), `createCampaign`, `updateCampaignStatus`, `getActivePatientCampaigns(patientProfileId)`; wire → `maybeDateOnly` | `insurance.client.spec.ts` +4 casos con `HttpTestingController` |
| H3.S1.M2 | Prefijo `/insurance-campaigns` en `proxy.conf.json` (~L88-102), `proxy.conf.docker.json` (~L50-64), `deploy/api-locations.conf` (junto a `insurance/portability`) | `node scripts/check-api-prefixes.mjs && node scripts/check-client-prefixes.mjs` OK |
| H3.S2.M1 | `navigation.map.ts`: sección `administration/insurance-campaigns` («Campañas preventivas», grupo Administración, `roles: [ANY_ROLE]`, `requiresTenant: true`, `hiddenFor: ['PATIENT','PRACTITIONER']`, `availability: 'disponible'`, `module: 'M26 insurance'`, summary) tras `insurance-analytics` (L791-801 en origin/dev); `navigation.subgroups.ts` bloque «Seguros» (L201-212); `access-tree.ts` (tras L249); `app.routes.ts` `PANTALLAS_DIFERIDAS['administration/insurance-campaigns']` | `yarn ng test --include='src/app/app.routes.spec.ts' --include='src/app/core/navigation/**/*.spec.ts' --watch=false` verde |
| H3.S3.M1 | `features/insurance/insurance-campaigns/insurance-campaigns.{ts,html,css}` (OnPush): `PageHeader`; filtros `Select` tipo/estado sincronizados a la URL (`services-catalog.ts:139-181`); `DataTable` `data-testid="campaigns-table"` con cursor (`historialDeCursor`), columnas código/título/tipo/CIE/bonificación/vigencia/estado (`Badge` `data-testid="campaign-status-<id>"`: Borrador/Activa/Pausada/Finalizada, y «Vencida» derivado si `validTo < hoy`), acción de estado por fila; botón «Nueva campaña» → `signal mostrarAlta` → card centrada con `FormSection/FormField/Input/Select/FormActions`, `fb.nonNullable.group`, `FormArray` de aliados (rol, tipo, nombre), `dateRangeValidator`/`apiErrorMessage` de `insurance-catalog/insurance-form.helpers.ts`, `Toast` al crear, 409 → `Alert`; testids `campaign-form-code|title|type|icd10|bonus|valid-from|valid-to|partner-role-<i>|partner-type-<i>|partner-name-<i>|add-partner|activate|submit` | Render manual en `yarn dev` con `aseguradora@alovida.mock` |
| H3.S3.M2 | `insurance-campaigns.spec.ts`: tabla desde cliente mockeado; filtro → URL; submit válido → `createCampaign` con `activate`; fechas invertidas bloquean submit; 409 → alerta visible | `yarn ng test --include='src/app/features/insurance/insurance-campaigns/**/*.spec.ts' --watch=false` verde |

## H4 · Front — widget del afiliado, CTA y mock

**CA:** CA-4.2, 4.3, 4.4 contra el mock: Ana Lucía ve sólo `CMP-CARDIO-2026`; el botón navega con contexto.

| ID | Microtarea | DoD |
|---|---|---|
| H4.S1.M1 | `core/mock/handlers/insurance-campaigns.handlers.ts` (`registrarCampanasDeSeguros`, tras `registerInsurancePortability` en `handlers/index.ts:47`): `Coleccion` `'mock-insurance-campaigns'` con `uuid(seed)`, `isoDia`; semillas: `CMP-CARDIO-2026` ACTIVE Seguros Andina (`isoDia(0)..isoDia(60)`, I10, 100 %, aliados Laboratorio Central AloVida [PROVIDER/LABORATORY] y Farmacias Aliadas [PROVIDER/PHARMACY]), `CMP-DIABETES-2026` DRAFT, `CMP-FLU-2025` ACTIVE vencida (`validTo = isoDia(-10)`), `CMP-VITALICIA-OSTEO` ACTIVE de La Vitalicia; rutas `GET /insurance-campaigns` (`perteneceALaAseguradora` → `forbidden`; filtros; `paginar`), `POST` (`administraCatalogo`; `validation` fechas/porcentaje; `conflict` código), `GET /:id`, `PATCH /:id/status` (transiciones → `preconditionFailed`), `GET /patient/:pid` (`request.user.patientProfileId !== pid` → `forbidden`; carrier por `aseguradora` de `personas.ts`; sólo ACTIVE en ventana) | `insurance-campaigns.handlers.spec.ts` (patrón `insurance.handlers.spec.ts:29-58`): 403 ajeno, sólo 1 campaña para Ana Lucía, 409 duplicado |
| H4.S2.M1 | `features/insurance/patient-campaigns/patient-campaigns-widget.{ts,html,css}` (`app-patient-campaigns-widget`, OnPush, `input.required<string>() patientProfileId`, `input emptyMessage`): `ViewState` con `loading/empty/ready` + `errorToViewState`; `Card` por campaña `data-testid="campaign-card"` con título, patología (`targetCondition.display`), `Badge` `data-testid="campaign-badge-coverage"` («100% Cubierto por tu Seguro» si bonus = 100, si no «N % de bonificación en copago»), aliados, «Vigente hasta …»; `AppButtonLink` `data-testid="btn-campaign-action"` («Agendar chequeo preventivo» / «Ver farmacias aliadas») con `routerLink`+`queryParams` según tipo (LAB/DIAG/VACC → `MIS_TURNOS_ROUTE` `{seccion:'pedir', [RESOURCE_PARAM]:'lab', campaign: code}`; PHARMACY → `/pharmacies-directory` `{campaign: code}`) | `patient-campaigns-widget.spec.ts`: card+badge+queryParams; vacío con `emptyMessage`; error con retry |
| H4.S2.M2 | Integración `patient-home.html` tras la card de síntomas: `@if (auth.patientProfileId(); as pid) { @defer (on viewport) { <app-patient-campaigns-widget [patientProfileId]="pid" /> } @placeholder { … } }` + import; `my-profile.html` pestaña `pestanas[3]` tras `<app-insurance-portability-card>` (~L466) con `emptyMessage="Tu seguro no tiene campañas activas hoy."` | `patient-home.spec.ts` y `my-profile.spec.ts` siguen verdes (`compileComponents` por `@defer`) |
| H4.S3.M1 | `appointments.ts`: `campaign = computed(() => this.params()?.get('campaign') ?? null)` + `<app-alert>` en la sección «pedir»: «Estás reservando por la campaña preventiva <code> de tu seguro» | `appointments.spec.ts` +1 caso con `?campaign=` |
| H4.S4.M1 | `corepack yarn typecheck && corepack yarn lint` | typecheck 0; lint sin hallazgos nuevos (252 `prefer-on-push` preexistentes) |

## H5 · E2E, evidencia y PR front

**CA:** los 4 escenarios del prompt pasan en 1440/768/390 contra `yarn dev` (mock), targets táctiles ≥ 44 px (<780) / 40 px, sin desborde horizontal.

| ID | Microtarea | DoD |
|---|---|---|
| H5.S1.M1 | `playwright/carril-insurance-campaigns.spec.ts` (serial): reutilizar `entrar/irA/estable` de `support/sesion.ts`, actores de `carril-insurance-analytics.spec.ts:24-35`, `VIEWPORTS`/`altoMinimoTactil`/`screenshotWithoutOverflow` de `carril-insurance-whatsapp.spec.ts:47-70`; nunca `networkidle`. Escenarios × viewport: (1) aseguradora crea `CMP-CARDIO-E2E` con `activate` → fila con badge «Activa»; (2) paciente en `/` ve `campaign-card` con «100% Cubierto por tu Seguro», no ve DRAFT/vencida/La Vitalicia; `/my-account?pestana=seguros` muestra la misma; (3) click `btn-campaign-action` → URL con `seccion=pedir`, `resource=lab`, `campaign=CMP-CARDIO-2026` y aviso visible; (4) `btn-campaign-action` y `campaign-form-submit` ≥ alto mínimo; `scrollWidth <= innerWidth`. Capturas a `docs/trabajo/2026-09-25-insurance-preventive-campaigns/evidencia/*.png` | `E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/carril-insurance-campaigns.spec.ts --workers=1` → 12/12 PASS; salida en `evidencia/playwright-campaigns.txt` |
| H5.S2.M1 | `evidencia/doble-revision.md` (Regla 35): primera pasada (autor), segunda pasada adversarial por subagente independiente con las 10 preguntas de `critical-double-review` §3, veredicto por captura (RECHAZADA/ACEPTABLE CON RESERVAS/APROBADA), recaptura si hay corrección | Archivo enlazado desde REPORTE.md |
| H5.S2.M2 | `docs/trabajo/.../{PLAN.md,REPORTE.md}` del front; commits; `git rebase origin/dev`; push; PR front → `dev` (enlaza PRs modelo y API; anota que en `dev` el front corre con `mockBackend: true`) | PR MERGEABLE, salida REST en `evidencia/pr/` |

## Secuencia de ejecución

1. Junction de la bóveda + 3 worktrees + `yarn install` en API y front (H0).
2. PLAN.md en API y front (Regla 20) — antes de cualquier código.
3. H1 completo → PR modelo.
4. H2 (API) y H3+H4 (front contra mock) en paralelo; H2.S1.M1 depende de H1.S2.
5. H5 → PR front. PR API cuando H2.S5 esté verde.
6. Orden de merge (humano): modelo → API → front.

## Verificación end-to-end

- **Modelo:** `python salud-db/check_ddl_sources.py`; `python -m pytest salud-db/tests`; `git diff --stat` acotado al módulo 26 + parche.
- **API:** `bash scripts/db/vendor-ddl.sh --check`; `yarn typecheck`; `yarn lint --max-warnings=0`; `yarn alovida:guardrails`; `yarn test src/modules/insurance` (incluye `insurance-campaigns.service.spec.ts` y `insurance-controllers.spec.ts`); `yarn test:cov`; artefactos regenerados con Postgres Docker y `git diff --exit-code`.
- **Front:** `node scripts/check-api-prefixes.mjs`; `node scripts/check-client-prefixes.mjs`; `corepack yarn typecheck`; `corepack yarn lint`; `yarn ng test --include='src/app/features/insurance/**/*.spec.ts' --include='src/app/core/mock/handlers/insurance-campaigns.handlers.spec.ts' --include='src/app/app.routes.spec.ts' --watch=false`; `yarn dev` + Playwright 12/12 en 3 viewports; revisión visual con `aseguradora@alovida.mock` y `paciente@alovida.mock`.
- **Cierre:** tres PRs abiertos contra `dev`, MERGEABLE, con reviewers; REPORTE.md con AVANCE y doble revisión enlazada; memoria del proyecto actualizada con el estado del carril.

## Riesgos y bloqueos previstos

| Riesgo | Mitigación |
|---|---|
| Regeneración del DDL re-etiqueta 191 FK (bóveda no encontrada) | Junction A0 y revisar `git diff --stat` antes de seguir; abortar si toca FK ajenas |
| `gen_entities.py 26` reescribe entidades existentes | Comparar diff; si altera JSDoc/campos ajenos, revertir esos archivos y conservar sólo los 2 nuevos + `index.ts` |
| Sin Docker → OpenAPI/Postman sin regenerar → CI roja en `git diff --exit-code` | Declarar `A MEDIAS` (A10) y pedir regeneración a quien tenga stack; nunca Neon |
| `requireTenantId()` responde 412 antes del 403 en CA-4.7 | Chequeo A3 al inicio del servicio |
| `dev` y `mockup` se mueven cada pocas horas | `git fetch && rebase origin/dev` antes de cada push |
| Perfil de Chrome del MCP ocupado por otra sesión | La evidencia visual sale de Playwright (`yarn pw`), no del MCP |
| Bundle inicial del panel del paciente (tope 1 MB) | Widget en `@defer (on viewport)` |
| Conflicto con listas cerradas del menú de aseguradora (`navigation.service.spec`, `shell-layout.spec` esperan 8 rutas) | Actualizar esas listas a 9 en el mismo commit y anotarlo en el PR |

## Estado de avance (Regla 20 · estados: TODO, EN CURSO, HECHO, A MEDIAS, BLOQUEADO, DESCARTADO)

| Hito | Estado |
|---|---|
| H0 · worktrees, junction de bóveda, instalación | EN CURSO |
| H1 · Modelo y DDL | TODO |
| H2 · API | TODO |
| H3 · Front consola aseguradora | TODO |
| H4 · Front widget, CTA y mock | TODO |
| H5 · E2E, evidencia y PR front | TODO |
