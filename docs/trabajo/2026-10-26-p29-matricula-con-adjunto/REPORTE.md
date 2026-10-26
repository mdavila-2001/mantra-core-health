# Reporte — P29: la matrícula lleva su archivo (alta pública incluida)

> **AVANCE: 7 / 7 — 100 %.**

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` (API y front)
- Peldaño de evidencia: API `TESTED` (unitarios + integración real contra Postgres + typecheck);
  front `TESTED` (specs del componente y del cliente, typecheck y build de producción).
  Sin prueba de navegador → no llega a `VERIFIED` (ver «No cubierto»).

## Hallazgo principal

La sección P29 de `PENDIENTES-BACKEND.md` estaba **desactualizada**: el modelo (`.puml` v4.2.12,
DDL, patch `2026-09-13_v4212_jurisdiction_authorizations_file_id.sql`), la base, la entidad, el
alta/edición/lectura de matrícula en `profiles` y el editor del perfil del médico ya llevaban
`file_id`. El hueco real que quedaba era el **alta pública del médico**
(`POST /iam/auth/register-practitioner`): el formulario ofrecía «Respaldos de la habilitación»
(matrícula y SEDES), aceptaba el archivo y **lo tiraba en silencio** al crear la cuenta. Eso es
lo que este trabajo cierra. El modelo no se tocó.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `RegisterPractitionerDto` acepta `licenseFileId` y `sedesLicenseFileId` (uuid, opcionales) | `yarn test …register-practitioner.dto.spec.ts` | PASS — `evidencia/api-unit.txt` |
| H1.S1.M2 | El alta reclama cada PDF para la cuenta nueva (sólo PDF, categoría DOCUMENT) en la misma transacción y lo deja en `jurisdiction_authorizations.file_id`; SEDES sin número o mismo archivo para las dos → 422 antes de escribir | `yarn test …iam-practitioner-self-registration.service.spec.ts` | PASS (135 entre ambos specs) — `evidencia/api-unit.txt` |
| H1.S1.M3 | Integración real: dos PDFs quedan en su fila, a nombre del titular; el titular los ve en `me/summary` y los descarga; la ficha ajena no trae `fileId`; **otra cuenta recibe 403** al pedir el archivo y **422** al intentar colgarlo de su alta, sin cuenta a medias; SEDES sin número → 422; id inexistente → rechazo sin cuenta | `jest --config test/jest-integration.json test/integration/practitioner-license-registration-files.int-spec.ts` | PASS 2/2 — `evidencia/api-integration.txt` |
| H1.S1.M4 | OpenAPI y referencia de endpoints regenerados con la herramienta del repo | `yarn docs:openapi:generate` + `generate-endpoint-markdown.mjs` | OAS_EXIT=0, MD_EXIT=0 (commit `5c76a139`) |
| H1.S2.M1 | El alta del front sube los dos PDFs con `uploadRegistrationDocument` y manda los ids; reintento no re-sube; cambiar el archivo olvida el id; falla de subida no crea cuenta; simulador con las mismas dos precondiciones | `yarn ng test --include register-practitioner.spec.ts --include iam.client.spec.ts` | 181/181 PASS — `evidencia/front-spec.txt` |
| H1.S2.M3 | (no previsto) `IamClient.registerPractitioner` descartaba los dos campos (cuerpo armado campo por campo); corregido con su spec | ídem | PASS |
| H1.S2.M2 | Typecheck front y API, build de producción del front, eslint dirigido | `yarn typecheck` (ambos), `yarn build`, `yarn eslint <archivos>` | TSC_EXIT=0 ×2, BUILD_EXIT=0, eslint exit 0 — `evidencia/` |

## A medias

ninguna

## Pendiente

ninguna

## Evidencia

```text
$ yarn test (API) iam-practitioner-self-registration.service.spec.ts register-practitioner.dto.spec.ts
Test Suites: 2 passed, 2 total
Tests:       135 passed, 135 total

$ MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 … jest --config test/jest-integration.json --testTimeout=3600000 \
    test/integration/practitioner-license-registration-files.int-spec.ts   (base mantra_p29 recién clonada)
Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Time:        1534.667 s

$ NODE_OPTIONS=--max-old-space-size=6144 yarn typecheck   (API, sobre la cabeza mergeada 703c7d56)
TSC_EXIT=0

$ yarn ng test --watch=false --include register-practitioner.spec.ts --include iam.client.spec.ts
 Test Files  2 passed (2)
      Tests  181 passed (181)

$ yarn typecheck (front)        → TSC_EXIT=0
$ yarn build (front)            → Application bundle generation complete. BUILD_EXIT=0
```

## No cubierto

- **Prueba de navegador**: no se levantó `ng serve` ni Playwright contra la pantalla de alta; el
  cambio no toca la plantilla (el selector ya existía), pero la secuencia UI → subida → alta →
  recarga del perfil no se observó en un navegador real. El flujo HTTP sí está cubierto por la
  integración real y por los specs del componente.
- `yarn lint` global (front y API): se corrió eslint sólo sobre los archivos tocados.
- El precedente `practitioner-credential-registration-files.int-spec.ts` no se re-corrió en verde:
  ver «Riesgos» (siembra no idempotente en un segundo arranque).
- La ruta de alta asistida (`AssistedPractitionerRegistrationDto` hereda los dos campos) no tiene
  test propio con archivo.

## Desvíos del plan

- El DoD de H1.S2.M2 decía `yarn lint`; se corrió eslint dirigido a los archivos tocados.
- Se agregó H1.S2.M3 (cliente HTTP) al descubrirlo con el spec del componente en rojo.
- La integración se corrió con `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1` y `--testTimeout` por CLI (no se
  tocó código de test): sin la variable el worker de jest no detecta TypeScript y MikroORM no
  descubre ninguna entidad («Metadata for entity CatalogConcepts not found»); y el primer arranque
  contra una base recién clonada siembra durante ~25 min con la máquina compartida.

## Riesgos residuales

- **Siembra no idempotente (preexistente, fuera de alcance):** un segundo `bootstrapTestApp` sobre
  la misma base falla en «formularios clínicos estándar» con `pk_dynamic_field_sections` duplicada
  (`ClinicalFormsSeedService.seedForm`). Por eso la integración se corrió sobre una base recién
  clonada de `mantra_base`. Afecta a cualquier suite que arranque la app dos veces.
- El selector del alta acepta PDF/JPG/PNG, pero `upload-registration-document` sólo admite PDF:
  un JPG hace fallar la subida y el alta no sigue (no se pierde nada). Mismo desajuste que los
  títulos; preexistente.

## Decisiones y ambigüedades

1. **El SEDES entra junto con la matrícula** — es otra fila de la misma tabla y el front ya le
   ofrecía selector. Descartado: sólo la matrícula nacional (dejaba el segundo selector tirando el
   archivo). Confirmar con el dueño del producto.
2. **`sedesLicenseFileId` sin `sedesLicenseNumber` → 422**, y un mismo archivo para las dos → 422.
   Descartado: ignorar el archivo (pérdida silenciosa).
3. **Mismas reglas de reclamo que el PDF de un título del alta** (PDF, DOCUMENT, dueño = cuenta nueva).
4. **El modelo no se tocó**: ya declaraba `file_id` (v4.2.12) y la base lo tiene.
