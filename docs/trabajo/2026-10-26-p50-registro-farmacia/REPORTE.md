# Reporte — P50: el registro público de farmacia, de punta a punta

> **AVANCE: 16 / 16 — 100 %.** (las 14 del plan + 2 agregadas en ejecución)

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` en los tres repos
- Peldaño de evidencia: modelo `RUNS` (parche aplicado), API `VERIFIED` contra la base real
  (integración HTTP con persistencia), frontend `TESTED` (unitarios del cliente, simulador, componente
  y deriva de contrato; sin prueba visual ni E2E contra la API real).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `pharmacy.pharmacies.primary_practice_site_id` (FK a `practice.practice_sites`) en `diagram_24`, DDL regenerado, parche v4252 idempotente | `gen_ddl.py` + parche ×2 | PASS — `evidencia/modelo-parche.txt` |
| H1.S1.M2 | Entidad regenerada (`gen_entities.py 24`) | `git diff --stat` | PASS |
| H1.S2.M1 | DTO: `organization.taxIdentifier`, `pharmacy.address`, coordenadas «ambas o ninguna», `pharmacyId` | integración escenario 1 (cuerpo exacto del front) | PASS |
| H1.S2.M2 | `pharmacy` con otro tipo → 422 | unit + integración escenario 2 | PASS |
| H1.S2.M3 | Poder opcional al registrar una farmacia | unit self-registration | PASS |
| H1.S3.M1 | `PharmacyProvisioningService`: farmacia DRAFT + práctica `PR_TYPE_PHARMACY` + central y sucursales como sede física y `pharmacy_sites` + central enlazada | unit | PASS |
| H1.S3.M2 | El alta lo usa en la misma transacción y devuelve `pharmacyId` | integración escenario 1 | PASS |
| H1.S3.M3 | Seis categorías por defecto (P47) | unit + integración escenario 1 | PASS |
| H2.S1.M1 | `PharmacyOperatingRequirementsService` (requisitos + marcado VERIFICADO) | unit (9 casos) | PASS |
| H2.S1.M2 | Verificación de farmacia incompleta → 422 `details.missing` | unit + integración 3.1 | PASS |
| H2.S1.M3 | Autorización con ámbito (`roleAuthorizesInTenant`) y antes del lookup | unit + integración 3.3b | PASS |
| H2.S2.M1 | `POST /tenants/:id/affiliation-documents` | integración 3.3–3.5 | PASS |
| H2.S2.M2 | `GET /tenants/:id/pharmacy-readiness` | integración 3.2 y 3.5 | PASS |
| H2.S3.M1 | OpenAPI, endpoints, inventario y Postman regenerados | `yarn docs:openapi:generate` etc. | PASS (1434 paths) |
| H3.S1.M1 | Cliente: `pharmacy.address` siempre; punto y sucursales si hay | `iam.client.spec`, `register-pharmacy.spec`, `contract-drift.spec` | PASS |
| H3.S1.M2 | Simulador con el contrato de la API | `auth.handlers.pharmacy.spec` | PASS |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| UI «Ficha» para completar papeles | TODO (fuera de P50) | Pantalla sobre `POST /tenants/:id/affiliation-documents` y `GET /tenants/:id/pharmacy-readiness` (contrato ya publicado) |

## Evidencia
```text
API unit (directory, pharmacy, practice, self-registration): Test Suites 78 passed · Tests 946 passed  (evidencia/api-unit.txt)
API typecheck: EXIT 0                                                                                 (evidencia/api-typecheck.txt)
API integración pharmacy-registration.int-spec.ts contra mantra_p50: Suites 1 passed · Tests 3 passed (evidencia/api-integracion-final.txt, -post-merge.txt)
Front ng test dirigido: Test Files 6 passed · Tests 105 passed                                       (evidencia/front-tests.txt)
Front typecheck EXIT 0 · pre-push build de producción ✔                                              (evidencia/front-*.txt)
Modelo: parche v4252 aplicado dos veces sin error                                                     (evidencia/modelo-parche.txt)
```
Escenarios de integración: alta con el cuerpo exacto del front → 201, farmacia DRAFT, práctica
`PR_TYPE_PHARMACY`, «Casa central» con dirección y punto, `pharmacy_sites` CASA-CENTRAL y
SUCURSAL-EQUIPETROL, `directory.branches`, 6 categorías; `pharmacy` con HOSPITAL → 422 sin crear nada;
verificar sin papeles → 422 con los seis; requisitos: owner 200, otra organización 403; papeles: otra
organización 403, `SECURITY_ADMIN` acotado a otro tenant 403, tenant inexistente sin permiso 403 (no 404);
owner sube los seis 201, SEDES repetido 409, `ready: true`, verificación 200 → farmacia ACTIVE/VERIFIED,
documentos con `verified_by`/`verified_at`, NIT como número del documento tributario.

## No cubierto
- Prueba visual y E2E del alta contra la API real (no se levantó `ng serve`/Playwright; máquina
  compartida al límite de memoria). La pantalla no cambió de aspecto: cambió el cuerpo que sale.
- Pantalla para completar papeles (sólo API).
- Catálogo ORM `src/orm/catalog/foreign-keys/pharmacy.fk.ts`: sale de notas FK de la bóveda (repo aparte,
  compartido); no se agregó la nota ni se corrió `yarn orm:catalog`. La FK está en DDL y base.
- `gen_ddl.py all` reescribía comentarios de otros módulos según la bóveda local: se versionó sólo el 24.
- Suites completas de API y front no corridas (sólo dirigidas, por el brief).

## Desvíos del plan
- Integración corrida con `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1` (con `dist/` presente MikroORM descubría
  entidades JS: «Metadata for entity CatalogConcepts not found») y `--testTimeout=900000` por CLI: la
  primera corrida murió en `beforeAll` a los 180 s con la máquina saturada
  (`evidencia/api-integracion-timeout-entorno.txt`); las siguientes tardaron 36–60 s. Sin tocar config.
- Completar papeles y verificar son `@Audited`: el tenant verificado queda fijado por `audit.audit_log`
  (WORM). La suite sigue el patrón de lane16 (`assertPermanentResidueTarget`) e informa el residuo.
- Dos microtareas agregadas por el orquestador (seguridad, categorías de P47).

## Riesgos residuales
- Farmacias anteriores a P50 no tienen central enlazada: la verificación las rechaza
  (`HEADQUARTERS_LOCATION`) y no hay endpoint para enlazarla todavía.
- La sucursal vive en `directory.branches` (portal) y en `pharmacy_sites` (stock); editar una no toca la otra.
- `TenantAdministrationService.canAdminister/assertCanRead` mantienen el atajo de plataforma sin
  `scopedRoles` para el resto de los endpoints; P50 sólo corrigió sus dos rutas.

## Decisiones y ambigüedades
- Papeles y SEDES: **obligatorios para operar, no para registrarse** (D2). «Operar» = `PHARMACY_ACTIVE`
  vía `POST /admin/tenants/:id/verification`. Descartado: exigirlos en el alta. A confirmar con producto.
- Seis papeles, con la excepción CL-43 (unipersonal sin constitución ni poder).
- El punto de la casa central también es requisito para operar.
- Al verificar, la plataforma atestigua los papeles: quedan `VERIFICADO` con quién y cuándo.
- Completar papeles: sólo owner/admin (o plataforma con ámbito), sólo con el tenant PENDING; repetido 409.
- Cédula del representante sigue obligatoria (DTO compartido; el front ya la pide). Poder opcional en el
  alta sólo para PHARMACY.
- La central nace siempre («Casa central») y se enlaza en `pharmacies.primary_practice_site_id` (patrón P51).
- Concepto nuevo `PR_TYPE_PHARMACY` (sembrado al arrancar).
- Servicio de requisitos generalizable por P51: `PharmacyOperatingRequirementsService`
  (`src/modules/directory/services/pharmacy-operating-requirements.service.ts`).
