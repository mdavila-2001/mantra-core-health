# Plan — P51: alta pública de laboratorio contra la API real

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-api, mantra-core-health (front) ·
  Predecesor: `26211c60` (PR #846, `diagnosticUnit.branches`), P54 (columnas `description` y
  `location_url` de `directory.branches`, ya en `dev`).
- Resultado observable: el cuerpo que arma `RegisterLaboratory` (`/auth/register/laboratory`) con
  los catálogos públicos `dynamic-enums`, enviado a `POST /iam/auth/register-organization`, responde
  201 y deja una unidad **de laboratorio** con su central y sus sucursales (con descripción y enlace
  de mapa) visibles en `GET /tenants/{id}/branches`.
- Kill-test: el test de integración `laboratory-registration.int-spec.ts` en rojo, o una unidad
  creada sin tipo explícito y sin modalidades de imagen que quede `DU_TYPE_IMAGING`.

## Alcance
- IN (API): `diagnostic-unit-modalities.ts` (resolución del tipo), `tenant-type-profile.service.ts`
  (regla de sucursales con el tipo resuelto), `diagnostic-unit-provisioning.service.ts`,
  `common/dto/tenant-type-profile.dto.ts` (`DiagnosticUnitBranchDto` + `description`/`locationUrl`),
  `iam-organization-self-registration.service.ts` (sucursales del laboratorio en
  `directory.branches`), OpenAPI regenerado, tests unitarios e integración.
- IN (front): `iam.client.ts` (`description`/`locationUrl` siempre, no sólo con simulador), JSDoc de
  `iam.types.ts`, simulador `auth.handlers.ts` alineado al contrato real, specs, nota en
  `PENDIENTES-BACKEND.md`.
- OUT: modelo/esquema (no hace falta columna nueva: `directory.branches` ya tiene `description` y
  `location_url`), alta de imagenología (sigue maqueta), alta de farmacia (P50), sucursales públicas
  (P37), la regla de «no operar sin papeles» del punto 6 (ver Decisiones D-5).
- Ambigüedades registradas: ver «Decisiones» (todas tomadas esta noche sin confirmación; confirmar
  con el dueño del producto, Pablo).

## Decisiones (sin confirmación, conservadoras y reversibles)
- **D-1 Tipo de unidad por omisión.** Sin `diagnosticUnitTypeConceptId`, la API **infiere**: si se
  declara alguna modalidad de imágenes → imágenes; en cualquier otro caso (modalidad de laboratorio,
  sucursales, o nada) → **laboratorio**. El tipo explícito siempre manda. Descartado: dejar imágenes
  por omisión (es la causa del bug) y laboratorio fijo por omisión (rompería un alta de imagenología
  que declara sólo modalidades, contrato probado en `imaging-center-registration.int-spec.ts`).
- **D-2 País y jurisdicción.** Siguen **obligatorios** en el contrato (422 `missing`, probado). El
  front los **deriva** por código (`BO`, `JURISDICTION_NATIONAL`) de los `dynamic-enums` públicos,
  igual que el tipo y la modalidad. Descartado: que la API los invente para el alta pública (cambia
  un contrato probado y toca a P50).
- **D-3 Representante.** `idNumber` obligatorio (el form ya lo pide); poder notariado obligatorio
  salvo `UNIPERSONAL` (como hoy en API y form). Descartado: relajarlo como la farmacia (P50/D2) —
  más restrictivo y reversible; se puede relajar después sin romper clientes.
- **D-4 Sucursales.** `diagnosticUnit.branches[]` acepta `description` (≤1000) y `locationUrl`
  (≤2000, sólo http/https validado en servidor), mismas reglas que `pharmacy.branches[]`. Cada
  sucursal sigue naciendo como sede de práctica + sede de unidad (toma de muestras) y **además** se
  registra en `directory.branches` (con coordenadas, descripción y enlace), igual que la farmacia,
  porque eso es lo que lista la pestaña Sucursales del portal. La central entra también si trae
  coordenadas.
- **D-5 Punto 6 (no operar sin SEPREC/licencia/SEDES).** Fuera de este cierre: la unidad nace
  `DU_VERIF_PENDING` y el tenant `UNVERIFIED`; queda registrado como pendiente en el reporte.

## H1 — Alta de laboratorio contra la API real
**CA:** Dado el cuerpo del front (conceptos leídos de `dynamic-enums`), cuando se envía, entonces 201,
unidad `DU_TYPE_LAB`, central + N sucursales como sedes y como `directory.branches` con descripción
y enlace; un `locationUrl` `javascript:` es 400; sucursales en una unidad de imágenes es 422.
**DoD:** `yarn jest` dirigido · `yarn test:integration laboratory-registration` · typecheck · lint
de lo tocado · OpenAPI regenerado.
**Estado:** HECHO (ver REPORTE; sin prueba visual)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `resolveDiagnosticUnitType` (D-1) + uso en validador y provisión | sin tipo y sin imagen → LAB | `jest diagnostic-unit-modalities tenant-type-profile diagnostic-unit-provisioning` | HECHO |
| H1.S1.M2 | `DiagnosticUnitBranchDto.description/locationUrl` | `javascript:` → 400 | test de integración | HECHO |
| H1.S1.M3 | Sucursales del laboratorio en `directory.branches` | aparecen en `GET /tenants/{id}/branches` | test de integración | HECHO |
| H1.S1.M4 | Integración con el cuerpo del front, catálogos reales y negativos | 201/400/422/401 | `yarn test:integration test/integration/laboratory-registration.int-spec.ts` | HECHO |
| H1.S1.M5 | OpenAPI regenerado | diff sólo en el DTO | script del repo | HECHO |
| H1.S2.M1 | Front: `description`/`locationUrl` siempre en `iam.client.ts` | spec del cliente | `ng test --include register-laboratory.spec` | HECHO |
| H1.S2.M2 | Front: simulador con el contrato real (idNumber, poder, url http) | spec del handler | `ng test --include auth.handlers.laboratory.spec` | HECHO |
| H1.S2.M3 | Front: nota P51 en `PENDIENTES-BACKEND.md` | — | lectura | DESCARTADO (el archivo vive sólo en la rama `mockup`; la nota va en este reporte) |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P50 toca el mismo servicio de autorregistro | conflicto de merge | método propio, sin tocar el de farmacia |
| Caché de metadata de MikroORM compartida por `node_modules` symlink | integración no arranca | `node_modules` local con symlinks y `.cache` propio |
