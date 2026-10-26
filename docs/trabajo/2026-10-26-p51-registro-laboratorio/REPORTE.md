# Reporte — P51: alta pública de laboratorio contra la API real

> **AVANCE: 7 / 8 — 87,5 %.** (la octava, H1.S2.M3, quedó DESCARTADA con motivo; ninguna en rojo propia)

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` (API y front)
- Peldaño alcanzado: API `TESTED` + integración real contra Postgres (`mantra_p51`), con la
  regla de sucursales y la autorización ejercitadas por HTTP; front `TESTED` (specs del cliente,
  la pantalla y el simulador) y typecheck en verde. **Sin prueba visual** (no hubo cambio visual).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Sin `diagnosticUnitTypeConceptId` el tipo se infiere: alguna modalidad de imagen → imágenes; si no → **laboratorio** (D-1). Validador y provisión usan el mismo `resolveDiagnosticUnitType` | `yarn test tenant-type-profile.service.spec diagnostic-unit-provisioning.service.spec` | PASS 47/47 — `evidencia/unitarios.txt` |
| H1.S1.M2 | `DiagnosticUnitBranchDto` acepta `description` (≤1000) y `locationUrl` (sólo http/https); `javascript:` → 400 sin cuenta creada | integración | PASS — `evidencia/integracion.txt` |
| H1.S1.M3 | Sucursales del laboratorio (y la central con punto) también en `directory.branches`; `GET /tenants/{id}/branches` las lista con descripción y enlace al owner; 403 a otra organización; 401 sin sesión | integración | PASS |
| H1.S1.M4 | Integración con el cuerpo que arma el front y los 4 conceptos leídos por código de `GET /system-context/dynamic-enums`; negativos: 400 url, 422 sucursales en imágenes, 422 S.R.L. sin poder, 400 sin cédula; la suite vecina de imagenología sigue verde | `yarn test:integration '(imaging-center\|laboratory)-registration'` | PASS 14/14 |
| H1.S1.M5 | OpenAPI regenerado (`openapi.json`/`.yaml`) | `yarn docs:openapi:generate` | EXIT 0 — `evidencia/front-typecheck-openapi.txt` |
| H1.S2.M1 | Front: `description`/`locationUrl` viajan siempre (ya no sólo al simulador) | `ng test --include register-laboratory.spec ...` | PASS 84/84 (3 archivos) |
| H1.S2.M2 | Simulador con el contrato real: descripción ≤1000 (límite), url no http(s) → 400, sucursales en unidad de imágenes → 422 | `ng test --include auth.handlers.laboratory.spec` | PASS (en los 84) |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S2.M3 | DESCARTADO | `PENDIENTES-BACKEND.md` no existe en `dev` (vive en la rama `mockup`); el cierre queda en este reporte y en el JSDoc de `RegisterLaboratory`. |
| Punto 6 del P51 (no operar sin SEPREC/licencia/SEDES) | TODO (fuera de este cierre, D-5) | Generalizar a `DIAGNOSTIC_CENTER` el `PharmacyOperatingRequirementsService` que P50 introduce en la verificación del tenant, cuando esté en la rama. Hoy la unidad nace `DU_VERIF_PENDING` y el tenant `UNVERIFIED`. |

## Evidencia
```text
$ ... yarn test:integration 'test/integration/(imaging-center|laboratory)-registration'
Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
(respuestas observadas: 400 locationUrl `matches`, 422 «Las sucursales sólo se declaran en una
 unidad de laboratorio clínico», 422 «Falta el poder notariado…», 400 idNumber, 403
 TENANT_SCOPE_CONFLICT en GET /tenants/{ajeno}/branches, 401 sin token)

$ yarn test tenant-type-profile.service.spec.ts diagnostic-unit-provisioning.service.spec.ts
Tests:       47 passed, 47 total

$ yarn ng test --watch=false --include (laboratorio: handler, pantalla, cliente)   [front]
 Test Files  3 passed (3)
      Tests  84 passed (84)

$ yarn typecheck   [front]  → EXIT 0
$ yarn docs:openapi:generate   [API] → EXIT 0
$ yarn typecheck   [API, tras merge de la rama compartida] → EXIT 2:
src/modules/iam/application/services/iam-practitioner-self-registration.service.spec.ts(522,20):
  error TS7006: Parameter 'fila' implicitly has an 'any' type.     ← de 5167bb81 (P29), no de P51
$ yarn eslint <archivos tocados>   [API y front] → sin errores
```
Detalle en `evidencia/integracion.txt`, `evidencia/unitarios.txt`,
`evidencia/front-typecheck-openapi.txt`.

## No cubierto
- **Prueba en navegador** del alta (`/auth/register/laboratory`) contra la API levantada: no se
  levantó `ng serve` + API. El cuerpo del front sí se ejercitó contra la API real reproduciéndolo
  en la integración (mismas claves y conceptos por código), pero no el `HttpClient` del navegador.
- Subida real de PDF (poder notariado) en el alta de una S.R.L.: sólo se probó el 422 sin poder.
- `yarn lint` global y suites completas: no se corrieron (sólo eslint de lo tocado).
- La inferencia D-1 con `diagnosticUnit` sin modalidades ni sucursales (sólo central): cubierta en
  unitario, no en integración.

## Desvíos del plan
- La creación de `directory.branches` del laboratorio se hizo en `TenantTypeProfileService`
  (módulo `directory`, dueño de la tabla) y no en el servicio de autorregistro de `iam`: evita
  pisar el código de farmacia que P50 cambia en ese archivo y vale para las tres puertas de alta.
- `harness.ts`: se agregó `directory.branches` a `TENANT_ESCRIBE_EN` (sin eso la limpieza de la
  suite fallaba con 23503).
- OpenAPI: el regenerado incluye también `licenseFileId`/`sedesLicenseFileId` de P29, que ya
  estaban en el código de la rama y no en el derivado.

## Riesgos residuales
- **Cambio de contrato D-1**: un `diagnosticUnit` sin tipo y sin modalidades de imagen ahora nace
  laboratorio (antes imágenes). El alta de imagenología del front es maqueta sin red y declara
  modalidades de imagen; un cliente que dependiera del viejo default cambiaría de tipo.
- Doble registro de una sucursal de laboratorio (sede de práctica + `directory.branches`) sin
  vínculo entre filas: editarla en la pestaña Sucursales no renombra la sede de la unidad.
- `codeOf` (código de sucursal desde el nombre) duplicado con el de farmacia en `iam`; unificar
  cuando P50 entre.
- Entorno: la integración sólo arrancó con `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1` (con `@swc/jest`
  MikroORM no detecta TypeScript y descubre 0 entidades → `MetadataError CatalogConcepts`) y con
  un `node_modules` local de symlinks para no usar la caché de metadata compartida.

## Decisiones y ambigüedades (confirmar con Pablo)
- **D-1** tipo inferido (imágenes si hay modalidad de imagen; si no, laboratorio). Descartado:
  default imágenes (el bug) y default laboratorio fijo (rompía un alta de imagenología probada).
- **D-2** país y jurisdicción siguen obligatorios; el front los resuelve por código (`BO`,
  `JURISDICTION_NATIONAL`) de `dynamic-enums`. Descartado: que la API los derive.
- **D-3** cédula del representante obligatoria; poder obligatorio salvo `UNIPERSONAL`.
  Descartado: relajarlo como farmacia (P50) — se puede relajar después sin romper clientes.
- **D-4** `description`/`locationUrl` con las reglas de `pharmacy.branches[]`, guardadas en
  `directory.branches`.
- **D-5** el punto 6 (no operar sin papeles) queda fuera de este cierre.

## Actualización — punto 6 (D-5) cerrado

> **AVANCE: 4 / 4 — 100 %** de este agregado (además de las 7 / 8 previas).

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H2.S1.M1 | `PharmacyOperatingRequirementsService` parametrizado por clase (`PHARMACY`/`LABORATORY`); laboratorio = SEPREC + licencia + SEDES | `yarn test src/modules/directory src/modules/diagnostic_units` | PASS 378/378 |
| H2.S1.M2 | Verificación de la plataforma: laboratorio sin papeles → 422 `details.missing`; con papeles → 200 y papeles VERIFICADO | `yarn test:integration '(imaging-center\|laboratory)-registration'` | PASS 16/16 |
| H2.S1.M3 | `GET /tenants/:id/laboratory-readiness` (403 otra org, 401 sin sesión, 422 si no es laboratorio) | ídem | PASS |
| H2.S1.M4 | `verify-and-publish` de unidad de laboratorio con org. sin verificar → 422 `TENANT_NOT_VERIFIED` | ídem + unitarios | PASS |

Farmacia (P50) sin regresión: `pharmacy-registration.int-spec.ts` 3/3. Typecheck API EXIT 0 (con heap de 6 GB). OpenAPI y referencia de endpoints regenerados. Commits: `85d4efdd`, `4e4cea5d`.

Decisiones: «laboratorio» = `DIAGNOSTIC_CENTER` con unidad de laboratorio clínico; los tres papeles no dependen del tipo societario; la unidad se publica solo con la organización verificada (sin dependencia circular entre módulos).

No cubierto: la verificación por autoridad externa (`identity-verification-effects.service.ts`, `verifyTenant`) no evalúa papeles (tampoco en farmacia); no hay pantalla de requisitos en el frontend; el escenario de integración deja una organización como residuo declarado (WORM `audit.audit_log`) y solo corre contra una base descartable.
