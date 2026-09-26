# Plan — Tarea 4 · Campañas preventivas de la aseguradora: certificación y cierre de brechas

- Fecha: 2026-09-26 · Repos afectados: `mantra-core-health-api` (dev) · `mantra-core-health` (dev **y** mockup) · `Mantra Core Health Vault` · `mantra-core-health-model` (solo docs) · Predecesor: Tarea 4 mergeada hoy (modelo PR #31 · API PR #469 · front PR #710) y subtarea 3.3 (API #455, front #638/#639).
- Resultado observable: una operadora de aseguradora crea, **edita** y pausa campañas en `/admin/insurance/campaigns`; su afiliado ve la tarjeta «Campaña Preventiva Vigente · Prevención Bonificada 100%» en `/my-account/overview` y `/my-account/insurance` y pulsa `btn-redeem-campaign`; todo eso **contra Neon con las tablas reales**, con la traza de auditoría de CA-02, en claro y oscuro, en escritorio y móvil, y **también en la maqueta `mockup`** sin backend.
- Kill-test (hoy fallan los tres): `to_regclass('insurance.insurance_campaigns')` en Neon → NULL · `curl -o /dev/null -w '%{http_code}' localhost:3000/insurance/campaigns/active` → 404 · `git ls-tree -r origin/mockup --name-only | grep -c insurance-campaigns` → 0.

## Contexto

El prompt pide implementar la Tarea 4 desde cero. **La Fase 0 demostró que ya está mergeada en `dev`** (hoy 26/09, aprobada por Jsaldias39): modelo v4.2.23 (`insurance.insurance_campaigns` + `insurance_campaign_partners`, `diagram_26_insurance.puml:209-244`), API con 5 rutas bajo `/insurance-campaigns` y front con consola en `/administration/insurance-campaigns`, widget en `/dashboard` y en «Mi cuenta › Seguros», 21/21 Playwright con simulador. Re-implementar duplicaría trabajo aprobado (regla 00.2). **Decisión del usuario: certificar y cerrar brechas**, alineando nombres y comportamientos al texto del prompt.

Una auditoría de solo lectura (6 lentes, 58 brechas candidatas, 2 refutadores por brecha, 3 refutadas) más la verificación propia dejaron estas brechas reales, con evidencia:

| # | Brecha | Evidencia |
|---|---|---|
| 1 | **Neon no tiene las tablas** ni los 15 conceptos `insurance:CAMPAIGN_*`; el patch solo se aplicó a un PG desechable. Los endpoints mergeados fallan contra la base viva. | `to_regclass` → AUSENTE; `insurance` tiene 29 tablas vs 31 en `SQL/`; imagen Docker `mantra-redesa-api:local` del 25/09 01:17, anterior al merge |
| 2 | **0 notas en la bóveda** (16 faltan: 2 E tablas, 2 E idxset, 12 FK); hub M26 en 58/29; `materializacion-fisica-bd.md` termina en v4.2.22. Por eso `orm:catalog` no se regeneró: `schemas.catalog.ts:41` declara 29 tablas y no hay filas de campañas (B-10). | `git ls-tree origin/dev` bóveda: 0 · `src/orm/catalog/` grep 0 |
| 3 | Value sets de las 4 columnas `*_concept_id` **no publicados** en `dynamic-enum-catalog.ts` ni designaciones `es`. | grep `campaign` = 0 en ambos |
| 4 | Rutas de la API `/insurance-campaigns/*` vs prompt `/insurance/campaigns`, `/active` (no existe), `/my-benefits` (existe como `patient/:patientProfileId`). | `insurance-campaigns.controller.ts:43,47,58,75,89,100` |
| 5 | **No hay edición** de campaña (solo alta + `PATCH :id/status`); contrato la deja fuera (`insurer-preventive-campaigns.md:132`). | `dto/insurance-campaigns.dto.ts:188-192` |
| 6 | CA-02: campaña de otra aseguradora → **404 sin auditoría** (contrato:78); los 403 de rol/membresía/tenant **no se auditan**; aliados con `networkProviderMembershipId` de otra red **no se validan**. | `service.ts:257-261,370-413,444-453,224-233` |
| 7 | Roles: `INSURANCE_ADMIN` no existe; `INSURANCE_OPERATOR` con membresía STAFF (la cuenta demo) recibe 403 al crear. | `service.ts:396-403`; precedente `insurance-analytics.service.ts:100-108` |
| 8 | CA-04: una ACTIVE vencida sigue con `status: ACTIVE` en listado/detalle y entra en `?status=ACTIVE`. Solo el afiliado la filtra. | `repository.ts:172-199,258-285` |
| 9 | Sin `insurance-campaigns.controller.spec.ts` (ValidationPipe) ni **int-spec** contra Postgres real; `test:integration` no arrancaba (`MetadataError: Metadata for entity CatalogConcepts not found`, ts-morph). | `git ls-files`; `docs/trabajo/2026-09-24-insurance-exclusions-settlement-contracts/REPORTE.md:56,70` |
| 10 | Front: rutas `/administration/insurance-campaigns`, `/dashboard`, `/my-account?pestana=seguros` vs prompt; testid `btn-campaign-action`; rótulos «100% Cubierto por tu Seguro»/«Beneficios preventivos de tu seguro»; sin métricas por campaña. | `app.routes.ts:163,58,194`; `patient-campaigns-widget.html:3,62`; `insurance-campaign.labels.ts:83` |
| 11 | E2E: archivo `carril-insurance-campaigns.spec.ts` (nombre distinto), **sin axe**, sin teclado/foco, sin tema oscuro, `@axe-core/playwright` no instalado; sin corrida contra API real; doble revisión «ACEPTABLE CON RESERVAS» sin tercera pasada (`VERIFIED_FUNCTIONAL_ONLY`). | `playwright/carril-insurance-campaigns.spec.ts:13,59-61`; `package.json:99`; `evidencia/doble-revision.md:47-58` |
| 12 | **Sin PR a `mockup`**: `origin/mockup` (5e52dab1) no tiene ningún archivo de campañas. | `git ls-tree` |
| 13 | Cierre documental: sin `evidencia/pr/`, PLAN previo con estados viejos, sin ficha en `REGISTRO-DEFECTOS.md` (CatalogConcepts, deuda T4, B-10 ya cerrado en la bóveda por `b660a187`), sin `docs/tareas/subtarea-4.*`. | ver H5 |
| 14 | **`dev` de la API no pasa `yarn typecheck`** (exit 2): `docs/trabajo/2026-09-25-auditoria-produccion-backend/reproducciones.spec.ts:113,184` usa `riskScore: 90` y `payment-flow.dto.ts:239` exige `string`. Del PR #468, no de campañas. | corrida propia, 6 min 19 s |

**Decisiones tomadas con el usuario (26/09):** certificar, no re-implementar · **alinear todo** (rutas, endpoints, testid, rótulos) · entran **edición, métricas básicas y `/active` público** · **aplicar v4.2.23 a Neon** · CA-02 **403 + auditoría literal** (revierte contrato:78) · alta/edición **inline** (se registra el desvío del «modal»).

## Alcance

- IN: todo lo de la tabla de brechas; ramas nuevas desde `origin/dev` (y desde `origin/mockup` para la maqueta); PRs en bóveda, API, front→dev, front→mockup y docs del modelo; `PLAN.md`/`REPORTE.md`/`evidencia/` en `docs/trabajo/2026-09-26-campanas-aseguradora/` de API y front; walkthrough transversal en `docs/tareas/`.
- OUT (registrado, no se toca aunque se vea): `fixed_copay_amount` y `ALL_ALLIED_PROVIDERS` del prompt (**el modelo no los tiene**; el % cubre 100 %/parcial y el DTO exige 1..20 aliados: cambiarlo es promoción de modelo v4.2.3x aparte) · vouchers/canje en mostrador/DEPLETED de `PROMPT_SUBTAREA_4_1` · cron que persista `EXPIRED` (se resuelve con `effectiveStatus`) · pantalla nueva para `/active` (solo API + cliente + mock) · autocompletar CIE-10 y selector de aliados desde la red · `db:vendor --delete` de `database/SQL` (deriva ajena previa) · cobertura global `test:cov` 73,56 % < 74 % (roja en `dev` antes) · Tarea 3 en mockup.
- Ambigüedades registradas (supuesto → a quién confirmar):
  1. Ruta canónica de API `insurance/campaigns` **y alias deprecado** `insurance-campaigns` un ciclo (`@Controller(['insurance/campaigns','insurance-campaigns'])`, precedente NestJS 11 y `insurance/analytics`), para no dejar un 404 entre el merge de la API y el del front → Justin.
  2. `INSURANCE_ADMIN` ≡ membresía OWNER/ADMIN del tenant aseguradora (no se crea rol IAM); `INSURANCE_OPERATOR` con membresía activa **puede mutar** (el prompt lo nombra) → Justin.
  3. Edición permitida en `DRAFT` y `PAUSED` (una ACTIVE se pausa primero); `code` inmutable; `campaignType` inmutable fuera de DRAFT → producto.
  4. `/active` público sin token (`@Public()`), filtro opcional `?carrierId=`, sin identificadores internos; recibe `Cache-Control: public` del interceptor → seguridad.
  5. `/my-account/overview` renderiza el panel del paciente y `/my-account/insurance` «Mi cuenta» con la pestaña Seguros **como rutas reales** (no redirect), y las rutas viejas redirigen a las nuevas → front.
  6. Objetivo táctil ≥ 44 px se exige en 390×844; en 1440×900 rige el sistema (botón `md` = 40 px) → diseño.
  7. Capturas en `docs/trabajo/<fecha>/evidencia/` (convención del repo, regla 35), no en `evidence/` literal.
  8. Identidad git de API y front hoy es `t <t@t>`: se fija a `Marcelo Dávila <dmarcelo201@gmail.com>` (la de modelo y bóveda) **solo en esos dos repos, `--local`** → usuario.
  9. Títulos de PR adaptados para no afirmar «implementa» lo ya mergeado: se conserva el prefijo semántico del prompt.
  10. El patch a Neon se aplica por el **endpoint directo** (sin `-pooler`), como corresponde a DDL; la API sigue en el pooler.

## Estado de partida verificado (Fase 0, 26/09)

| Repo | HEAD dev | Estado |
|---|---|---|
| API | `710e6f1a` = remoto | limpio · `yarn typecheck` **exit 2** (brecha 14) |
| Front | `10f3ca16` = remoto | limpio salvo `playwright/fixtures/carga-masiva/` sin rastrear · `tsc` app/cypress/playwright **exit 0** (1 min) |
| Modelo | `83b1d6c` = remoto | rama local `marcelo/feat-aseguradoras-datos-completos` (ya mergeada); v4.2.23 en dev; patch idéntico al de `database/SQL` de la API |
| Bóveda | `378c960e` = remoto | ídem rama local; 0 notas de campañas |
| Neon | PG 18.6 | sin tablas de campañas; sí v4.2.14/22; sin v4.2.29/30 (deriva ajena) |
| Docker | `mantra-redesa-api-1` up | apunta a Neon; imagen anterior al merge; sin Postgres local |
| gh | `mdavila-2001` | revisores pedibles: `jsaldias39`, `PabloArauzCaballero` |

## Orden de ejecución y ramas (una cosa a la vez: regla 70)

`H0 → H1 (Neon, bóveda, catálogo) → H2 (API) → H3 (front dev; su `.real` necesita H1+H2 desplegados en Docker) → H4 (mockup, una sola vez, con los commits finales de dev) → H5`. Un solo runner de tests/build a la vez; Playwright `--workers=1`; un solo subagente (revisor visual independiente) a la vez; nada en background.

| Repo | Rama | PR |
|---|---|---|
| Bóveda | `marcelo/feat-insurance-prevention-campaigns-docs` (desde `origin/dev`) | → dev, **primero** |
| API | `marcelo/feat-insurance-prevention-campaigns-api` | → dev, segundo |
| Front | `marcelo/feat-insurance-prevention-campaigns-ui` | → dev, tercero |
| Front | `marcelo/feat-insurance-prevention-campaigns-mockup` (desde `origin/mockup`) | → mockup, cuarto (empujar = desplegar la demo) |
| Modelo | `marcelo/feat-insurance-prevention-campaigns-model-docs` | → dev, docs (`physical-materialization.md`) |

Revisores: `--reviewer jsaldias39,PabloArauzCaballero`. Commits atómicos `feat(insurance-campaigns): …` / `test(insurance-campaigns): …` / `docs(…)`, stage archivo por archivo, nunca `git add -A`, nunca commit sobre `dev`/`mockup`.

---

## H0 — Arranque honesto: ramas, identidad, plan en disco y `dev` verde
**CA:** Dado el estado de partida, cuando alguien abre las ramas, entonces existen `PLAN.md` en API y front, la identidad git es la del autor, y `yarn typecheck` de la API sale 0 en la rama.
**DoD:** salidas en `evidencia/00-partida/`.
**Estado:** TODO

### H0.S1 — Preparar los repos
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H0.S1.M1 | Fijar identidad git `--local` en API y front | `git config user.email` = `dmarcelo201@gmail.com` en ambos | `git -C mantra-core-health-api config user.email && git -C mantra-core-health config user.email` | TODO |
| H0.S1.M2 | Crear las 4 ramas de trabajo desde `origin/dev` (bóveda, API, front) y `origin/mockup` (front) | `git branch --show-current` = la rama esperada en cada repo | `for r in …; do git -C $r branch --show-current; done` | TODO |
| H0.S1.M3 | Escribir `docs/trabajo/2026-09-26-campanas-aseguradora/PLAN.md` (este plan, formato regla 20) en API y front | el archivo existe antes del primer edit de código | `ls mantra-core-health-api/docs/trabajo/2026-09-26-campanas-aseguradora/PLAN.md mantra-core-health/docs/trabajo/2026-09-26-campanas-aseguradora/PLAN.md` | TODO |
| H0.S1.M4 | Corregir `reproducciones.spec.ts:113,184` (`riskScore: '90'`) en commit aparte `fix(dev): typecheck en verde antes de la Tarea 4` | `yarn typecheck` API exit 0 | `cd mantra-core-health-api && yarn typecheck; echo $?` → `0` | TODO |
| H0.S1.M5 | Guardar evidencia de partida (`git log -1` de los 4 repos, `gh pr view 31/469/710`, `to_regclass` en Neon = NULL) | carpeta con 3 archivos | `ls docs/trabajo/2026-09-26-campanas-aseguradora/evidencia/00-partida/` | TODO |

---

## H1 — La base viva y la quinta capa dicen la verdad
**CA:** Dado Neon y la bóveda, cuando la API arranca y `orm:catalog` se regenera, entonces las dos tablas existen con sus 15 conceptos, la bóveda tiene sus 16 notas y el catálogo ORM declara 31 tablas de `insurance` sin tocar otros módulos.
**DoD:** conteos antes/después en `evidencia/01-neon/`, `evidencia/01-catalogo/`.
**Estado:** TODO

### H1.S1 — Patch v4.2.23 en Neon (autorizado el 26/09)
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Medir antes: tablas `insurance`, FKs, índices, `to_regclass` | archivo `antes.txt` con 29 tablas | `psql … -c "select count(*) from information_schema.tables where table_schema='insurance'"` → `29` | TODO |
| H1.S1.M2 | Aplicar el patch por el endpoint directo: `"C:\Program Files\PostgreSQL\18\bin\psql" "host=ep-shy-snow-acyd0u4s.sa-east-1.aws.neon.tech … sslmode=require" -v ON_ERROR_STOP=1 -f mantra-core-health-model/SQL/patches/2026-09-25_v4223_insurance_preventive_campaigns.sql` | exit 0 y sección de verificación del patch en verde | salida literal en `evidencia/01-neon/patch.txt`; `to_regclass` × 2 no nulos; tablas `insurance` = **31**; `ck_insurance_campaigns_valid_period` = 1 | TODO |
| H1.S1.M3 | Segunda pasada del patch (idempotencia) | exit 0 sin cambios | mismo comando → `NOTICE … already exists`/0 filas nuevas | TODO |
| H1.S1.M4 | Reconstruir la imagen de la API en Docker con `dev` (`docker compose build api && docker compose up -d api`) para que siembre los conceptos | `psql -c "select count(*) from terminology.catalog_concepts where code like 'insurance:CAMPAIGN_%'"` = **15** | consulta + `docker inspect --format '{{.Created}}'` posterior al merge | TODO |
| H1.S1.M5 | Fidelidad: arrancar la API local en `ORM_SCHEMA_SYNC=dry-run` acotado o consultar el log del contenedor | ninguna `tabla-ausente` de `insurance_campaign*` | `docker logs mantra-redesa-api-1 \| grep -E "Fidelidad\|Deriva"` | TODO |

### H1.S2 — Bóveda: 16 notas, hub y materialización
Plantillas: `SALUD/Entidades/E insurance.network_provider_memberships.md`, `E insurance.idxset_network_provider_memberships.md`, `SALUD/FK/FK insurance.network_provider_memberships.provider_network_id.md` (frontmatter, tags `#modulo/26 #schema/insurance #entidad|#fk`, wikilinks). FKs a documentar (12): `insurance_carrier_id`, `campaign_type_concept_id`, `target_condition_concept_id`, `status_concept_id`, `created_by_user_id`, `updated_by_user_id` (campaigns) · `insurance_campaign_id`, `partner_role_concept_id`, `partner_type_concept_id`, `network_provider_membership_id`, `created_by_user_id`, `updated_by_user_id` (partners); `partner_tenant_id` no lleva FK (decisión registrada).
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Crear `E insurance.insurance_campaigns.md` y `E insurance.insurance_campaign_partners.md` con columnas/tipos del `.puml` | 2 notas con `## Columnas` y `## Índices` completos | `ls "SALUD/Entidades" \| grep -c "E insurance.insurance_campaign"` → `2` | TODO |
| H1.S2.M2 | Crear las 2 notas `E insurance.idxset_*` (14 índices, incl. `uq_insurance_campaigns_carrier_code`, `ix_…_carrier_status_validity`) | 2 notas | `ls "SALUD/Entidades" \| grep -c idxset_insurance_campaign` → `2` | TODO |
| H1.S2.M3 | Crear las 12 notas `FK insurance.insurance_campaign*.md` con destino y cardinalidad del `.puml` (`||--o{`) | 12 notas, 0 FKs inventadas | `ls SALUD/FK \| grep -c "^FK insurance.insurance_campaign"` → `12` | TODO |
| H1.S2.M4 | Hub `SALUD/Módulos/M26 insurance.md`: 58→62 entidades, 29→31 conjuntos, enlaces; backlinks en `E insurance.insurance_carriers` y `E insurance.network_provider_memberships` | 0 notas huérfanas nuevas | `grep -c "insurance_campaign" "SALUD/Módulos/M26 insurance.md"` ≥ 4 | TODO |
| H1.S2.M5 | Sección `### v4.2.23` en `SALUD/Arquitectura/materializacion-fisica-bd.md` (después de v4.2.22, línea ~1094) con deltas medidos en H1.S1 | sección presente con conteos | `grep -n "v4.2.23" SALUD/Arquitectura/materializacion-fisica-bd.md` | TODO |
| H1.S2.M6 | Enlaces rotos = 0 (script del vault o `obsidian-cli`) | 0 | comando de la skill `verify` para la bóveda | TODO |
| H1.S2.M7 | Commit + push + PR bóveda → dev | PR `MERGEABLE` | `gh pr view <n> --json mergeable,mergeStateStatus` | TODO |

### H1.S3 — Catálogo ORM y catálogo de datos (API), acotados
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Con `SALUD_VAULT` apuntando a la bóveda actualizada, `yarn orm:catalog` y **acotar el diff** a `insurance.*.idx.ts`, `insurance.*.fk.ts`, `schemas.catalog.ts` (29→31); revertir cualquier otro archivo (B-10) | `git diff --stat -- src/orm/catalog` solo toca `insurance*` + `schemas.catalog.ts` | salida del `git diff --stat` en evidencia | TODO |
| H1.S3.M2 | `yarn docs:data:sync` → `docs/data/entity-catalog.md` gana las 2 filas | diff solo esas filas | `git diff --stat -- docs/data/entity-catalog.md` | TODO |
| H1.S3.M3 | Publicar en `dynamic-enum-catalog.ts` los 4 value sets (targets `insurance.insurance_campaigns.status_concept_id`, `.campaign_type_concept_id`, `insurance_campaign_partners.partner_role_concept_id`, `.partner_type_concept_id`) y sus designaciones `es` | tests de seed en verde | `yarn test src/common/seed` → PASS | TODO |
| H1.S3.M4 | `yarn orm:audit`/`node tools/catalog/audit-fidelity.mjs`: 0 `entidadesFaltantes`/`fkEnCatalogo` para campañas | 0 | salida en evidencia | TODO |

---

## H2 — La API cumple el contrato del prompt y se prueba contra Postgres real
**CA:** Dado un operador de aseguradora A, cuando usa `/insurance/campaigns` (crear, listar, editar, `/active`, `/my-benefits`), entonces persiste en Neon, un intento sobre B responde 403 y deja fila en `audit.audit_log`, una vencida no aparece como vigente, y campos no autorizados responden 400.
**DoD:** `yarn typecheck` 0 · `yarn lint` 0 · `yarn test src/modules/insurance` verde · int-spec PASS contra Neon · OpenAPI/Postman regenerados sin diff en CI.
**Estado:** TODO

### H2.S1 — Rutas y roles
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | `@Controller(['insurance/campaigns','insurance-campaigns'])` (canónica primero; alias marcado `@deprecated` en contrato §7) | ambas rutas responden; test de orden de rutas ampliado (`insurance-controllers.spec.ts:438`) | `yarn test src/modules/insurance/controllers` → PASS | TODO |
| H2.S1.M2 | `GET my-benefits` (antes de `:id`): perfil desde `actor.patientProfileId` (claim `pid`); 403 si falta; delega en `listActiveForPatient`; conserva `patient/:patientProfileId` | 200 con las mismas filas que `patient/:pid` propio | test de controlador + servicio | TODO |
| H2.S1.M3 | `GET active` público: `@Public()`, `?carrierId` opcional, filas `status=ACTIVE` y `valid_from ≤ hoy(La_Paz) ≤ valid_to`, DTO sin ids internos (+ nombre de aseguradora) | sin token → 200; vencida excluida | tests de servicio (repo mockeado) + caso en int-spec | TODO |
| H2.S1.M4 | Roles: `administrableCarrier` acepta `INSURANCE_OPERATOR` con membresía activa (patrón `insurance-analytics.service.ts:100-108`); contrato §2 documenta `INSURANCE_ADMIN` ≡ OWNER/ADMIN | STAFF+OPERATOR crea (201); STAFF sin rol 403; paciente 403 | `yarn test src/modules/insurance/services/insurance-campaigns.service.spec.ts` | TODO |

### H2.S2 — CA-02: 403 auditado y aliados validados
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Repo: `existsAnywhere(id)`; `getById`/`changeStatus`/`update`: si el id existe en **otra** aseguradora → `auditTrail.record(…INSURANCE_CAMPAIGN_ACCESS_DENIED, entity 'insurance_campaign', entityId id, tenantId intentado, success:false)` en transacción propia y **403**; si no existe → 404 | 403 + fila; 404 sin fila | tests de servicio con `auditTrail.record` espiado | TODO |
| H2.S2.M2 | Auditar todos los 403 de `tenantOf`/`administrableCarrier`/`readableCarrier` (catch `ForbiddenException` → record con `tenantId` intentado → rethrow) | cada 403 deja una fila | tests de servicio (4 casos: sin tenant, STAFF, no aseguradora, X-Tenant-Id ajeno) | TODO |
| H2.S2.M3 | Validar `networkProviderMembershipId` contra `network_provider_memberships m join provider_networks n … where n.insurance_carrier_id = ?` → 422 si es ajena (create y update) | membresía ajena 422; propia 201 | test de servicio + caso en int-spec | TODO |
| H2.S2.M4 | Actualizar `docs/contracts/insurer-preventive-campaigns.md` (§7 rutas, línea 78 revertida con motivo, D-nuevas: edición, active, my-benefits, roles, effectiveStatus, alias) | contrato coherente con el código | `grep -n "403" docs/contracts/insurer-preventive-campaigns.md` | TODO |

### H2.S3 — Edición y vencimiento (CA-04)
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S3.M1 | `UpdateInsuranceCampaignDto` (parcial: title, description, campaignType, targetConditionCode, copayBonusPercentage, validFrom/To, partners[1..20]); `code` **no** admitido (400 por whitelist) | DTO rechaza `code`/`insuranceCarrierId` | controller spec (H2.S4.M1) | TODO |
| H2.S3.M2 | `PATCH :id`: solo en `DRAFT`/`PAUSED` (422 en ACTIVE/EXPIRED); mismas validaciones que create; aliados reemplazados en la misma transacción; `row_version` por `@Version`; audita `INSURANCE_CAMPAIGN_UPDATED` | DRAFT edita 200; ACTIVE 422; ajena 403+fila | `yarn test src/modules/insurance` | TODO |
| H2.S3.M3 | `effectiveStatus` en `InsuranceCampaignResponseDto` (`EXPIRED` si `valid_to < ref` y estado ACTIVE/PAUSED); `?status=ACTIVE` excluye vencidas en `listRowsByCarrier`; `activate` de vencida sigue 422 | vencida: `status ACTIVE`, `effectiveStatus EXPIRED`, fuera de `?status=ACTIVE` | tests de servicio + int-spec | TODO |

### H2.S4 — Pruebas: controller spec e int-spec real
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S4.M1 | `controllers/insurance-campaigns.controller.spec.ts` con `new ValidationPipe({whitelist, forbidNonWhitelisted, transform}).transform(...)` (plantilla `dto/claims.dto.spec.ts:42-44`): campos extra (`insuranceCarrierId`, `tenantId`, `status`, `code` en PATCH), % > 100 o 3 decimales, code en minúsculas, fecha no ISO, partners 0/21, `'DRAFT'` en status, limit 0/101 | cada caso → `BadRequestException` | `yarn test src/modules/insurance/controllers/insurance-campaigns.controller.spec.ts` → PASS | TODO |
| H2.S4.M2 | Causa raíz del `MetadataError CatalogConcepts`: borrar `node_modules/.cache/mikro-orm`, revisar `orm.config.ts:61,68,78-81` (`entitiesTs`, `TsMorphMetadataProvider`, `metadataCache`), correr **un** int-spec existente (`insurance-plan-administration`) contra Neon | arranca y pasa | `yarn test:integration --runTestsByPath test/integration/insurance-plan-administration.int-spec.ts` → PASS (o `BLOQUEADO` con traza y alternativa `dist`) | TODO |
| H2.S4.M3 | `test/integration/insurance-campaigns.int-spec.ts` (plantilla `insurance-plan-administration.int-spec.ts:15-140`: `register('A')/('B')` PAYER, `member(...)`, `X-Tenant-Id`, SQL directo, `deleteRegisteredOrganizations`, **sin `reset`**): A crea (201) y la fila está en `insurance.insurance_campaigns`; B no la lista; GET/PATCH desde B → 403 y fila `INSURANCE_CAMPAIGN_ACCESS_DENIED` en `audit.audit_log`; STAFF sin rol → 403 auditado; ACTIVE vencida fuera de `/active` y de `?status=ACTIVE`; `PATCH :id` en DRAFT persiste aliados; membresía ajena 422 | 8 casos PASS contra Neon | `yarn test:integration --runTestsByPath test/integration/insurance-campaigns.int-spec.ts` → PASS, salida en `evidencia/02-int-spec.txt` | TODO |
| H2.S4.M4 | Regresión del módulo: `yarn test src/modules/insurance` y `yarn lint` | verde, 0 errores | salidas en evidencia | TODO |

### H2.S5 — Artefactos y PR de la API
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S5.M1 | Regenerar OpenAPI/endpoints/Postman/docs de módulos (`yarn docs:openapi:generate`, `postman:generate`, sync; requiere Neon) | `git diff --exit-code` sobre artefactos generados pasa **después** de commitear | comandos y `git status --short openapi docs/postman docs/modules` | TODO |
| H2.S5.M2 | `REGISTRO-DEFECTOS.md`: fichas nuevas (MetadataError CatalogConcepts; deuda T4 cerrada/abierta) y B-10 **cerrado** citando `b660a187` | 3 entradas | `grep -n -E "CatalogConcepts\|insurance_campaign\|B-10" REGISTRO-DEFECTOS.md` | TODO |
| H2.S5.M3 | Commits atómicos, push, PR → dev con `--reviewer jsaldias39,PabloArauzCaballero` y cuerpo con evidencia + «cambio de contrato: alias deprecado» | `mergeable: MERGEABLE`, `mergeStateStatus` ≠ DIRTY | `gh pr view <n> --json number,url,isDraft,mergeable,mergeStateStatus,reviewDecision` + `gh pr checks <n>` → `evidencia/pr/` | TODO |

---

## H3 — El front `dev` refleja el prompt y se prueba contra la API real
**CA:** Dado el front en `dev`, cuando la operadora entra a `/admin/insurance/campaigns` y el afiliado a `/my-account/overview` o `/my-account/insurance`, entonces ve consola con edición y métricas, tarjeta «Campaña Preventiva Vigente» con «Prevención Bonificada 100%» y `btn-redeem-campaign`, sin violaciones axe, navegable por teclado, en claro y oscuro, en 1440×900 y 390×844, y **contra la API real** para CA-01/02/04.
**DoD:** `yarn typecheck` 0 · `yarn lint` 0 · prefijos (3 scripts) · unit specs · Playwright PASS (maqueta y `.real`) · doble revisión con tercera pasada.
**Estado:** TODO

### H3.S1 — Rutas y navegación
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | `app.routes.ts:163` → `admin/insurance/campaigns` (misma `loadComponent`/guards) y `administration/insurance-campaigns` → `redirectTo`; `app.routes.server.ts` con el mismo `RenderMode` | ambas URLs abren la consola | `yarn test --watch=false --include src/app/app.routes.spec.ts` + `node scripts/check-route-prefixes.mjs` → 0 colisiones | TODO |
| H3.S1.M2 | `my-account/overview` (ruta real que monta `Dashboard`/patient-home con su guard) y `my-account/insurance` (MyProfile con pestaña Seguros preseleccionada por `data`) | ambas rutas muestran el widget | specs de rutas + `patient-home.spec.ts` | TODO |
| H3.S1.M3 | `navigation.map.ts:809`, `navigation.subgroups.ts:211`, `access-tree.ts:250` y listas cerradas (`navigation.service.spec.ts:668`, `shell-layout.spec.ts:856`, `access-tree.spec.ts`) a la ruta nueva | menú de aseguradora apunta a `/admin/insurance/campaigns` | `yarn test --watch=false --include src/app/core/navigation/**` | TODO |

### H3.S2 — Cliente, proxies y simulador
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S2.M1 | `insurance.client.ts:386,407,426,445` → `/insurance/campaigns`; nuevos `update()`, `listActive()`, `listMyBenefits()`; tipos (`effectiveStatus`, `UpdateInsuranceCampaign`) | spec del cliente verde | `yarn test --watch=false --include src/app/core/data-access/insurance/insurance.client.spec.ts` | TODO |
| H3.S2.M2 | `proxy.conf.json`, `proxy.conf.docker.json`, `deploy/api-locations.conf`: `+ /insurance/campaigns` (conservar `/insurance-campaigns` mientras viva el alias) | 3 verificadores en verde | `node scripts/check-api-prefixes.mjs && node scripts/check-client-prefixes.mjs && node scripts/check-route-prefixes.mjs` | TODO |
| H3.S2.M3 | `insurance-campaigns.handlers.ts`: rutas nuevas, `PATCH :id` (reglas DRAFT/PAUSED), `GET active`, `GET my-benefits`, `effectiveStatus`; espejo de 403/422 | handler spec verde | `yarn test --watch=false --include src/app/core/mock/handlers/insurance-campaigns.handlers.spec.ts` | TODO |

### H3.S3 — Consola: edición y métricas
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S3.M1 | Acción «Editar» en filas DRAFT/PAUSED que reusa el formulario inline en modo edición (`code` deshabilitado; `campaignType` deshabilitado fuera de DRAFT), envía `PATCH` y refresca la fila; errores 403/422 mapeados al campo | editar título y % de una DRAFT persiste en la lista | `insurance-campaigns.spec.ts` (+6 casos) | TODO |
| H3.S3.M2 | Columnas «Aliados» (n) y «Días restantes» (`validTo − hoy La_Paz`; «Vencida» si `effectiveStatus=EXPIRED`) en la tabla; funciones puras con spec | valores correctos para 3 fixtures | spec unitario | TODO |
| H3.S3.M3 | Rótulo derivado de estado usa `effectiveStatus` de la API (no cálculo local duplicado) | ACTIVE vencida = «Vencida» sin «Pausar» | spec existente ajustado | TODO |

### H3.S4 — Widget del afiliado
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S4.M1 | Título de tarjeta «Campaña Preventiva Vigente» (`patient-campaigns-widget.html`), sello `copayBonusLabel(≥100)` → «Prevención Bonificada 100%» (`insurance-campaign.labels.ts:83`) | textos presentes | `yarn test --watch=false --include src/app/features/insurance/patient-campaigns/patient-campaigns-widget.spec.ts --include src/app/features/dashboard/patient-home/patient-home.spec.ts` | TODO |
| H3.S4.M2 | `data-testid="btn-redeem-campaign"` (`widget.html:62`) sin cambiar la navegación; specs y carril actualizados | `git grep -c btn-redeem-campaign -- src playwright` ≥ 3 y `btn-campaign-action` = 0 | comando | TODO |
| H3.S4.M3 | Widget consume `listMyBenefits()` (sin `patientProfileId` en la URL) | request al path nuevo | spec del widget | TODO |

### H3.S5 — E2E en maqueta: nombre, axe, teclado, oscuro
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S5.M1 | `git mv playwright/carril-insurance-campaigns.spec.ts playwright/carril-insurance-prevention-campaigns.spec.ts`; rutas y testids nuevos; viewports **1440×900, 768×1024, 390×844** | 21 escenarios previos PASS | `E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/carril-insurance-prevention-campaigns.spec.ts --workers=1 --reporter=list` | TODO |
| H3.S5.M2 | Escenario «editar campaña» y «métricas visibles» en los 3 anchos | PASS | mismo comando | TODO |
| H3.S5.M3 | `yarn add -D @axe-core/playwright`; `new AxeBuilder({page}).analyze()` tras cargar consola, `/my-account/overview`, `/my-account/insurance`, en **claro y oscuro** (`page.emulateMedia({colorScheme})`, sin preferencia en `localStorage`); 0 violaciones `serious`/`critical` | 0 violaciones | mismo comando; salida en `evidencia/03-axe.txt` | TODO |
| H3.S5.M4 | Escenario de teclado: `Tab` hasta «Nueva campaña» y hasta `btn-redeem-campaign`, `Enter` activa, `:focus-visible` con outline no nulo; objetivo táctil ≥ 44 px en 390 | PASS | mismo comando | TODO |
| H3.S5.M5 | Capturas `{escena}-{escritorio\|movil}-{claro\|oscuro}.png` en `docs/trabajo/2026-09-26-campanas-aseguradora/evidencia/` (7 escenas × 2 × 2), **una sola invocación** (Playwright borra `outputDir` al arrancar) | 28 PNG | `ls evidencia/*.png \| wc -l` → `28` | TODO |

### H3.S6 — E2E contra la API real (CA-01/02/04)
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S6.M1 | `playwright/carril-insurance-prevention-campaigns.real.spec.ts` (patrón `correcciones-c14-c23.real.spec.ts`: `contextoDeApi()`, `apiViva()`, se salta sin `E2E_API_URL`): registra aseguradora sintética por API, entra por UI, crea campaña en `/admin/insurance/campaigns` → **201 y `GET` la devuelve** (CA-01) | PASS con `ng serve --configuration e2e-real` y API Docker reconstruida en :3000 | `E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/carril-insurance-prevention-campaigns.real.spec.ts --workers=1 --reporter=list` | TODO |
| H3.S6.M2 | En el mismo spec, por `request.newContext()`: segunda aseguradora → `GET`/`PATCH` de la campaña ajena **403** y fila en `audit.audit_log` (leída por API o SQL) (CA-02); campaña con `validTo` ayer → ausente en `/active` (CA-04) | PASS | mismo comando | TODO |
| H3.S6.M3 | CA-03 real (afiliado con cobertura CURRENT ve la tarjeta): **solo si** la cobertura se puede crear por API en el spec; si no, queda `A MEDIAS` con «No cubierto: CA-03 contra API real» y se cubre en maqueta | PASS o registro explícito | mismo comando / REPORTE | TODO |

### H3.S7 — Doble revisión (regla 35) y PR
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H3.S7.M1 | Primera pasada (quien implementa) sobre las 28 capturas; correcciones; recaptura | nota por captura | `evidencia/doble-revision.md` | TODO |
| H3.S7.M2 | Segunda pasada **por agente independiente** (uno solo, sin background) con las 10 preguntas de `critical-double-review`; corregir; recapturar | 0 `RECHAZADA` | ídem | TODO |
| H3.S7.M3 | Tercera pasada independiente sobre la recaptura final (cierra la reserva de #710) | veredicto `APROBADA` o `ACEPTABLE CON RESERVAS` con lista | `grep -n Veredicto evidencia/doble-revision.md` | TODO |
| H3.S7.M4 | `yarn typecheck`, `yarn lint`, suite unitaria completa (`yarn test --watch=false`; si hay contagio de TestBed, aislar y documentar), 3 verificadores de prefijos, `check-contrast.mjs` | todo 0/verde | salidas en evidencia | TODO |
| H3.S7.M5 | Commits atómicos, push, PR → dev (`--reviewer jsaldias39,PabloArauzCaballero`) | `MERGEABLE`; checks clasificados (CI del front conocido inestable) | `gh pr view … --json …` + `gh pr checks` → `evidencia/pr/` | TODO |

---

## H4 — La maqueta `mockup` muestra lo mismo sin backend
**CA:** Dado `origin/mockup`, cuando se abre la demo, entonces la consola y la tarjeta funcionan con los handlers precargados (5 campañas: activa, borrador, pausada, vencida, ajena) en 1440×900 y 390×844.
**DoD:** typecheck 0 · handler spec · carril PASS en mockup · PR → mockup `MERGEABLE`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Rama desde `origin/mockup`; `git cherry-pick -x aacb3a58 4f93ecb1 2bb47dcf` (sin `081244c9`, **nunca merge de dev**: 106 commits) | 3 commits aplicados | `git log --oneline origin/mockup..HEAD` | TODO |
| H4.S1.M2 | Resolver conflictos previstos: `insurance.types.ts` y `insurance.client.spec.ts` (pegar al final), `my-profile.html` (widget antes de `app-insurance-portability-card`), `handlers/index.ts` (conservar `registerDiagnosisVerification`, `registerMedicalNotes`) | `yarn typecheck` 0 | comando | TODO |
| H4.S1.M3 | Cherry-pick de los commits finales de H3 (rutas, edición, métricas, rótulos, testid, handlers, carril) en orden | `yarn typecheck` 0 | comando | TODO |
| H4.S1.M4 | Guardia de borrados: `git diff --name-only --diff-filter=D $(git merge-base origin/dev origin/mockup) origin/dev -- src/` → nada de eso desaparece en la rama (promotions/, fixtures loyalty/where-to-buy/checkout, order-alternatives/) | 0 archivos de mockup borrados | `git diff --name-only --diff-filter=D origin/mockup HEAD -- src/` → vacío | TODO |
| H4.S1.M5 | `yarn test --watch=false --include src/app/core/mock/handlers/insurance-campaigns.handlers.spec.ts` y carril en mockup (`mockBackend: true`) en 1440 y 390, con capturas | PASS | `E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/carril-insurance-prevention-campaigns.spec.ts --workers=1 --reporter=list` | TODO |
| H4.S1.M6 | PR → `mockup` (body: «paridad Tarea 4; empujar a mockup = desplegar la demo; si el build falla no reintenta») | `MERGEABLE` | `gh pr view …` → `evidencia/pr/` | TODO |

---

## H5 — Cierre: reportes, defectos, walkthrough, memoria
**CA:** Dado alguien que no vio la sesión, cuando lee `REPORTE.md`, entonces sabe qué se cerró, qué quedó a medias con las cuatro respuestas, y dónde está cada evidencia y cada PR.
**DoD:** archivos en disco; `stop_gate` sin carril abierto.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | `REPORTE.md` (regla 40: AVANCE primero, Completado/A medias/Pendiente, Evidencia, No cubierto, Desvíos, Riesgos, Decisiones) en API y front `docs/trabajo/2026-09-26-campanas-aseguradora/`, con sección «Desvíos respecto del prompt de Tarea 4» | 3 secciones obligatorias presentes | `grep -c "^## " REPORTE.md` ≥ 8 | TODO |
| H5.S1.M2 | Actualizar la tabla «Estado de avance» de los `PLAN.md` previos (`2026-09-25-insurance-preventive-campaigns/PLAN.md:192-201`) en API y front | estados reales | `sed -n '192,201p'` | TODO |
| H5.S1.M3 | `evidencia/pr/` en API y front: `gh pr view` de #31, #469, #710 y de los PRs nuevos | archivos presentes | `ls evidencia/pr/` | TODO |
| H5.S1.M4 | `docs/tareas/subtarea-4.1-campanas-preventivas/walkthrough.md` (plantilla `subtarea-3.2-antiduplicacion-estudios/walkthrough.md`: Estado, Resumen, PRs, Qué cambió por capa, Verificación por rung, Bugs, Deuda) | secciones presentes | `grep -n -E "^## (PRs\|Verificación\|Deuda)"` | TODO |
| H5.S1.M5 | Modelo: `Mantra Core Health Context/docs/architecture/physical-materialization.md` espejo de la sección v4.2.23 de la bóveda; PR docs → dev | PR `MERGEABLE` | `gh pr view` | TODO |
| H5.S1.M6 | `pr-mergeable-gate` final sobre los 5 PRs (re-consultar tras cada merge de base) | 5 × `MERGEABLE` | salidas en `evidencia/pr/` | TODO |
| H5.S1.M7 | Memoria del proyecto: nota `subtarea-4-1-campanas-preventivas` (PRs, decisiones, trampas: `/admin/*` sí es viable en rutas del front; Neon sin v4.2.23 hasta hoy; alias deprecado) + índice `MEMORY.md` | archivo + línea en índice | `ls memory/ \| grep subtarea-4-1` | TODO |

---

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `test:integration` sigue sin arrancar (MetadataError ts-morph) | int-spec (DoD A.4) `BLOQUEADO` | H2.S4.M2 primero; alternativa documentada: correr desde `dist` (`docs/trabajo/2026-09-24-…/REPORTE.md:56,70`); si persiste, `BLOQUEADO` con traza, nunca «pasó» |
| Patch sobre Neon por el pooler (PgBouncer, modo transacción) corta el DDL | patch a medias | usar el endpoint directo; `ON_ERROR_STOP=1`; idempotente (segunda pasada) |
| Int-spec crea organizaciones PAYER en Neon | basura en base viva | patrón `deleteRegisteredOrganizations` en `afterAll`; sin `reset:true` (evita el `TRUNCATE … CASCADE` del harness) |
| Alias `insurance-campaigns` duplica operaciones en OpenAPI/Postman | ruido en artefactos y en `check-client-prefixes` | documentar `@deprecated` con fecha de retiro; ambos prefijos declarados en proxies |
| `orm:catalog` toca otros módulos (B-10 residual) | diff ajeno | acotar el commit a `insurance*` + `schemas.catalog.ts`; revertir el resto |
| Suite unitaria completa del front con contagio de TestBed / timeouts de axe | falsos rojos | aislar con `--include`; documentar (memoria `suite-front-contagio-testbed`) |
| Playwright borra `outputDir` por invocación | capturas perdidas | correr el archivo completo en una sola invocación |
| Contenedor API con imagen vieja | `.real` mide código anterior | `docker compose build api && up -d api`; ejercitar `/insurance/campaigns/active` antes del E2E |
| Puerto 4200 ocupado por un `ng serve` huérfano | E2E contra build viejo | verificar puerto y matar PID (memoria `taskstop-no-mata-yarn-start`) |
| CI del front inestable (checks `QUEUED`/externos) | PR no «verde» | clasificar con `gh run view --log-failed`; `MERGEABLE` sin conflictos es la condición de entrega documentada |
| Merge a `mockup` despliega la demo y un build roto no reintenta | demo vieja sin aviso | gancho `pre-push` local; `yarn typecheck` + build antes de empujar |
| `gen_seeds.py`: tablas en `INTENTIONALLY_EMPTY` (`gen_seeds.py:3620`) | nada; consistente (las siembra la aseguradora) | registrar |

## Verificación final (gates de la skills-router §4)

1. `evidence-and-verification`: cada DoD corrido con salida literal en `evidencia/`.
2. `security-guardrails` / `data-privacy-phi`: `/active` sin ids internos ni PHI; auditoría sin datos clínicos; `yarn redesa:guardrails` (en Linux si es posible; en Windows registrar la diferencia de conteo).
3. `visual-proof` + `critical-double-review`: 28 capturas, tres pasadas, `doble-revision.md`.
4. `pr-mergeable-gate`: 5 PRs con `gh pr view`/`gh pr checks` pegados.
5. `qa-evidence-reporting`: `REPORTE.md` con «No cubierto» explícito (CA-03 real si no se pudo; cobertura global; deriva ajena de `database/SQL`).
6. Escalera: cerrar `REGRESSION_VERIFIED` solo con targeted + regresión de `insurance` (API) y navegación/insurance (front) en verde.
