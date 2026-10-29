# Plan — P29: la matrícula lleva su archivo (alta pública incluida)

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-api, mantra-core-health (front) ·
  Modelo: sin cambios (ver hallazgos) · Predecesor: modelo v4.2.12 (`2026-09-13_v4212_jurisdiction_authorizations_file_id.sql`)
- Resultado observable: un médico que se registra adjunta el PDF de su matrícula (y el del registro
  del SEDES) en el alta pública, y ese archivo queda en `profiles.jurisdiction_authorizations.file_id`,
  reclamado a su nombre; desde «Editar perfil» ya podía hacerlo.
- Kill-test: alta con `licenseFileId` → `SELECT file_id FROM profiles.jurisdiction_authorizations` devuelve NULL.

## Hallazgos (descubrimiento, contra `dev` del 2026-10-26)

La sección P29 de `PENDIENTES-BACKEND.md` está desactualizada en su mayor parte:

| Capa | Estado encontrado | Evidencia |
|---|---|---|
| `.puml` | `file_id : uuid <<FK>>` en `jurisdiction_authorizations` (v4.2.12) | `diagram_05_profiles.puml:239-259` |
| DDL | columna, índice y FK diferida generados | `SQL/05_profiles/02_tables.sql:207`, `04_indexes.sql:189`, `90_fk_deferred.sql:484` |
| Patch | `SQL/patches/2026-09-13_v4212_jurisdiction_authorizations_file_id.sql`, idempotente | presente |
| Base `mantra_p29` | columna + `fk_jurisdiction_authorizations_file_id` + índice | `\d profiles.jurisdiction_authorizations` |
| Entidad | `fileId` mapeado | `src/modules/profiles/entities/jurisdiction_authorizations.entity.ts` |
| API alta desde el perfil | `CreateJurisdictionAuthorizationDto.fileId`, validado con `attachableFiles.assertUsableBy` (dueño + DOCUMENT) en la transacción | `profiles-practitioners.service.ts:1902-1957` |
| API edición | `UpdateOwnLicenseDto.fileId`, misma validación | `profiles-practitioners.service.ts:2565-2580` |
| API lectura | `PractitionerLicenseDto.fileId` sólo al titular | `profiles-practitioners.service.ts:1160-1171` |
| Front «Editar perfil» | sube por `FilesClient.upload` y manda `fileId` en alta y edición | `practitioner-profile-edit.ts:2655-2725` |

**Lo que sí falta (el hueco real de P29):** el **alta pública** (`POST /iam/auth/register-practitioner`)
ofrece en el front un selector para el respaldo de la matrícula y otro para el del SEDES
(`respaldosDeHabilitacion`, `register-practitioner.html:448-470`), pero `RegisterPractitionerDto` no
tiene dónde llevarlos y el front nunca los sube: el archivo se acepta, se muestra y **se tira en
silencio** al crear la cuenta — exactamente el defecto que la sección P29 describe.

## Alcance
- IN (API): `register-practitioner.dto.ts` (`licenseFileId`, `sedesLicenseFileId`),
  `iam-practitioner-self-registration.service.ts` (reclamo en la transacción + `fileId` en la fila),
  su spec, un test de integración real, OpenAPI/inventario si el repo los versiona.
- IN (front): `iam.types.ts`, `register-practitioner.ts` (subir y enviar), mock `auth.handlers.ts`
  (mismo contrato), comentario desactualizado de `profiles.types.ts`, specs.
- OUT: modelo (ya está), endpoints de `profiles` (ya están; P28 trabaja ahí), el desajuste
  PDF/JPG/PNG del selector frente a la subida pública solo-PDF (preexistente, también en títulos: se anota).
- Decisiones (sin respuesta posible esta noche):
  1. El SEDES entra junto con la matrícula: es otra fila de la misma tabla y el front ya le ofrece selector.
     Alternativa descartada: sólo la matrícula nacional (dejaría el segundo selector tirando el archivo).
  2. `sedesLicenseFileId` sin `sedesLicenseNumber` → 422 `PreconditionFailed`: un archivo sin la
     habilitación que respalda no tiene fila donde quedar. Alternativa descartada: ignorarlo (pérdida silenciosa).
  3. Mismas reglas de reclamo que el título del alta (PDF, categoría DOCUMENT, dueño = usuario recién creado).

## H1 — El alta pública guarda el archivo de la matrícula y del SEDES
**CA:** Dado un PDF precargado con `/iam/auth/upload-registration-document`, cuando el médico se
registra con `licenseFileId` (y/o `sedesLicenseFileId`), entonces la matrícula queda con ese `file_id`,
el archivo pasa a ser suyo, y un id inexistente, ya reclamado o de otro tipo hace fallar el alta entera.
**DoD:** unit + integración + typecheck + lint · front: specs dirigidos.
**Estado:** HECHO (sin prueba de navegador: ver REPORTE «No cubierto»)

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | DTO acepta `licenseFileId` / `sedesLicenseFileId` (uuid, opcionales) | uuid inválido → 400 | `yarn jest register-practitioner.dto` | HECHO |
| H1.S1.M2 | Servicio reclama y guarda `fileId` en ambas filas; SEDES sin número → 422 | spec en verde | `yarn jest iam-practitioner-self-registration` | HECHO |
| H1.S1.M3 | Integración real contra `mantra_p29`: claim + `file_id` + negativo (archivo ajeno/ya reclamado) | PASS | `yarn test:integration <archivo>` | HECHO |
| H1.S1.M4 | OpenAPI / inventario regenerados si se versionan | diff sólo del campo | script del repo | HECHO |
| H1.S2.M1 | Front sube los respaldos y manda los ids; mock con el mismo contrato | spec en verde | `yarn vitest run register-practitioner` | HECHO |
| H1.S2.M3 | (no previsto) `IamClient.registerPractitioner` arma el cuerpo campo por campo y descartaba los dos ids | spec del cliente en verde | `yarn ng test --include iam.client.spec.ts` | HECHO |
| H1.S2.M2 | Typecheck/lint front | exit 0 | `yarn typecheck`, `yarn lint` | HECHO |

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P28 toca `profiles` | conflicto de merge | este cambio vive en `iam` y en el alta del front |
| Selector acepta JPG/PNG, la subida pública sólo PDF | el alta falla con un JPG (no pierde datos) | preexistente en títulos; se anota en el reporte |
