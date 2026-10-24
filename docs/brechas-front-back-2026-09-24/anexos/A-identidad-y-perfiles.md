# Hallazgos: contratos front↔back de identidad, cuentas y perfiles

- Fecha: 2026-09-24. Auditoría de solo lectura (no se editó ni se commiteó nada en los repos).
- Front: `mantra-core-health`. El working tree está en `mockup` @ `9b3e0101`. `origin/mockup` @ `95472903` va 2 commits adelante, solo en work-history, y esos se leyeron con `git show origin/mockup:`. `origin/dev` es la rama que habla con la API real.
  - **Dato clave:** `git diff origin/dev origin/mockup -- src/app/core/data-access` solo difiere en `triage-ia`. Los clientes de iam, profiles, identity, directory, authz, delegated-access y notifications **son idénticos en dev y en mockup**. Lo que agregó `mockup` en este dominio es de pantalla: aviso D-06 al tocar el mapa, D-05/D-07, la pestaña «Mis puntos» y el padrón de work-history. Los contratos rotos de abajo ya están en `dev` del front.
- API: `mantra-core-health-redesa-api`, `origin/dev` @ `7541797c`. `ValidationPipe` global con `whitelist + forbidNonWhitelisted + transform` en `src/main.ts:158-165`. Cualquier clave no declarada en el DTO rechaza el cuerpo entero con **400**, también dentro de los DTO anidados con `@ValidateNested`.
- **PR abierto que cambia el cuadro:** API **#453** `justin/medical-module-execution-20260924` (OPEN, sin mergear en `dev`). Cierra ID-01, ID-02, ID-03, ID-04, ID-05 y ID-06, y la mitad de ID-09. **No** cierra ID-07, ID-08, ID-13 ni la matrícula de ID-09. Abajo, cada hallazgo dice «dev: abierto · #453: sí/no».
- Método: se cruzaron los clientes `src/app/core/data-access/**` y los `datos()` de cada formulario de `features/` con los DTO y controllers de `src/modules/**` en `origin/dev`. Los campos se compararon con un extractor propio y se revisaron a mano. Las columnas se verificaron en `mantra-core-health-model/SQL/05_profiles/02_tables.sql`.
- **No se ejecutó la API ni el front.** Todo lo de acá es evidencia de código, peldaño DISCOVERED. Donde digo «→ 400» me baso en la regla del `ValidationPipe` y en la ausencia de la clave en el DTO, no en una respuesta observada.

---

## Índice por severidad

| ID | Título | Severidad | Tipo | dev | #453 |
|---|---|---|---|---|---|
| ID-01 | Alta médica: `workEmail` no existe en el DTO (→400) y el correo de acceso llega con la semántica invertida | Bloqueante demo | contrato-body | abierto | cierra |
| ID-02 | Alta médica: `workAddressLines`/`workLatitude`/`workLongitude` → 400 | Bloqueante demo | contrato-body | abierto | cierra |
| ID-03 | Alta médica: `credentials[].fileId` (PDF del título) → 400 | Bloqueante demo | contrato-body | abierto | cierra |
| ID-04 | Tope de especialidades: el front permite 4, la API 3 (→400 en el alta, 422 en el perfil) | Alta | contrato-body | abierto | cierra |
| ID-05 | `PATCH /profiles/practitioners/me`: NIT, razón social y dirección laboral → 400; la lectura no los devuelve | Alta | contrato-body + contrato-respuesta | abierto | cierra |
| ID-06 | `PATCH /profiles/practitioners/me/credentials/:id` no existe | Alta | ruta-faltante | abierto | cierra |
| ID-07 | `PATCH`/`DELETE /profiles/practitioners/me/specialties/:id` no existen | Alta | ruta-faltante | abierto | **no** |
| ID-08 | `PATCH`/`DELETE /profiles/practitioners/me/jurisdiction-authorizations/:id` no existen | Alta | ruta-faltante | abierto | **no** |
| ID-09 | El `fileId` del diploma y de la matrícula entra y no se devuelve en la lectura | Media | contrato-respuesta | abierto | cierra solo el diploma |
| ID-10 | Universidad, país y ciudad del título: se preguntan y se descartan; la ciudad no existe en el modelo | Media | dato-inexistente-en-modelo | abierto | no |
| ID-11 | Alta de paciente: la empresa escrita a mano («Otra») se pierde en silencio | Media | contrato-body | abierto | no |
| ID-12 | Correo del médico: sin correo institucional, el personal se guarda como TRABAJO | Media | otro (semántica) | abierto | parcial |
| ID-13 | P28: sexo al nacer, CI y departamento emisor del médico no se pueden corregir | Media | contrato-body | abierto | no |
| ID-14 | `activity.monthlyEncounters` y `activity.quality` los inventa el mock: la API no los tiene | Media | dato-inexistente-en-modelo | abierto | no |
| ID-15 | `GET /profiles/patients/:id` es solo `SECURITY_ADMIN`, pero lo usan pantallas clínicas | Media | autorización | abierto | no |
| ID-16 | Historial laboral «solo padrón»: la API no recibe `healthFacilityConceptId` y la regla vive solo en el front | Media | contrato-body | abierto | no |
| ID-17 | Altas de laboratorio y de centro de imagenología no llaman a la API, que ya soporta `DIAGNOSTIC_CENTER` | Media | otro (integración) | abierto | n/a |
| ID-18 | ~25 roles que el menú y los `@Roles` usan no se siembran en `authz.roles` | Media | autorización | abierto | n/a |
| ID-19 | `delegated_access` solo tiene escrituras: los formularios piden UUID pegados a mano | Baja | ruta-faltante | abierto | n/a |
| ID-20 | El mock no valida whitelist y descarta campos que la API sí persiste | Baja | otro (mock) | abierto | n/a |
| ID-21 | Tipos del front más laxos que el DTO (alta de paciente) | Baja | contrato-body (latente) | abierto | n/a |
| ID-22 | El paciente no puede corregir el departamento emisor ni la empresa, aunque la API lo acepta | Baja | otro (front incompleto) | abierto | n/a |
| ID-23 | Tipos declarados que la API rechazaría (`NewPatientProfile`, `UpdatePractitionerAffiliation.departmentText`) | Baja | contrato-body (latente) | abierto | n/a |
| ID-24 | Sin cambio de contraseña, sesiones ni MFA para el usuario logueado, ni en el front ni en la API | Baja | ruta-faltante | abierto | n/a |

---

## ID-01 · Alta médica: `workEmail` no existe en el DTO (→400) y el correo de acceso llega con la semántica invertida
- **Severidad:** Bloqueante demo, contra la API real. **Tipo:** contrato-body.
- **Evidencia front:**
  - `src/app/features/auth/register-practitioner/register-practitioner.ts:2386-2387` define `correoPersonal = raw.personalEmail` y `correoTrabajo = raw.email`.
  - `:2408` manda `email: correoPersonal`.
  - `:2452` manda `workEmail: correoTrabajo` si no está vacío.
  - `src/app/core/data-access/iam/iam.client.ts:298` agrega `workEmail`.
  - `iam.types.ts:364-373` lo reconoce: «Pendiente en la API: `RegisterPractitionerDto` todavía no lo declara».
- **Evidencia API (dev):**
  - `src/modules/iam/dto/register-practitioner.dto.ts:58-87`: `email` se documenta como «correo de trabajo; es la identidad de login» y `personalEmail` es opcional. **No hay `workEmail`**.
  - `src/modules/iam/services/iam-practitioner-self-registration.service.ts:173-174` guarda `dto.email` con `CONTACT_USE_WORK`.
- **Modelo:** `common.contact_points` (sistema × uso), `iam.users`.
- **Efecto:** todo médico que carga un correo institucional recibe 400 `property workEmail should not exist`. Si no lo carga, el correo personal queda guardado como de trabajo (ver ID-12).
- **Qué hacer:**
  - Backend: mergear #453. Ya declara `workEmail?: string` con `@IsEmail` y redefine `email` como correo de acceso (`register-practitioner.dto.ts` y service, líneas 146-177 en la rama).
  - Front: nada.
- **Archivos:** `src/modules/iam/dto/register-practitioner.dto.ts`, `src/modules/iam/services/iam-practitioner-self-registration.service.ts`.
- **CA:**
  - Dado un alta con `email` personal y `workEmail` institucional, cuando se envía `POST /iam/auth/register-practitioner`, entonces responde 201, el login funciona con el personal y `GET /profiles/practitioners/me/summary` devuelve `workEmail` = institucional y `personalEmail` = personal.
  - Dado un alta con `workEmail` mal formado, cuando se envía, entonces responde 400 `VALIDATION_FAILED` sobre `workEmail`.

## ID-02 · Alta médica: dirección laboral → 400
- **Severidad:** Bloqueante demo. **Tipo:** contrato-body.
- **Evidencia front:**
  - `register-practitioner.ts:859` (control `workAddressLines`) y `:2435-2438` (manda `workAddressLines`, `workLatitude` y `workLongitude`).
  - `iam.client.ts:247-253`.
  - Commit `0796a68a feat: collect practitioner work address at signup`.
- **Evidencia API (dev):** `register-practitioner.dto.ts` declara solo `homeAddressLines`, `homeLatitude` y `homeLongitude` (líneas 346-383). No hay campos `work*`.
- **Modelo:** `common.addresses` (uso WORK). Tiene las columnas, no hace falta cambiar el modelo.
- **Qué hacer:** mergear #453, que agrega los tres campos con la regla del par (`@ValidateIf`) y los persiste con uso WORK (commits `aa609a86` y `982ed2b9`).
- **CA:**
  - Dado un alta con calle y punto de trabajo, cuando se envía, entonces 201 y existe una fila en `common.addresses` con uso WORK, `lines` y coordenadas.
  - Dado un alta con `workLatitude` sin `workLongitude`, entonces 400.

## ID-03 · Alta médica: PDF del título (`credentials[].fileId`) → 400
- **Severidad:** Bloqueante demo, cuando se adjunta un diploma. **Tipo:** contrato-body.
- **Evidencia front:**
  - `register-practitioner.ts:671-689` (`credencialesDeclaradas()` agrega `fileId`) y `:2330-2366` (sube el PDF por `POST /iam/auth/upload-registration-document` antes del alta).
  - `iam.types.ts:406-415` (`NewRegistrationCredential.fileId`).
  - Commit `da2a7769`.
- **Evidencia API (dev):** `register-practitioner.dto.ts:648-687`. `RegisterPractitionerCredentialDto` solo tiene `credentialTypeConceptId`, `number` e `issuingInstitutionText`. `@ValidateNested({each:true})` en `:630-634` aplica la whitelist al elemento anidado, así que devuelve 400 `credentials.0.property fileId should not exist`.
- **Modelo:** `profiles.professional_credentials.file_id` existe (FK a `common.files`).
- **Qué hacer:** mergear #453 (commit `6cc04818 feat(iam): attach professional credentials during signup`). Agrega `fileId?: uuid` y hace el claim del upload anónimo dentro de la transacción.
- **CA:**
  - Dado un PDF subido por `upload-registration-document` y su `fileId` en `credentials[0]`, cuando se registra el médico, entonces 201 y `professional_credentials.file_id` = ese id.
  - Dado un `fileId` que no es un upload anónimo pendiente, entonces 422 y no se crea ninguna cuenta.

## ID-04 · Tope de especialidades: el front permite 4, la API 3
- **Severidad:** Alta. **Tipo:** contrato-body.
- **Evidencia front:**
  - `register-practitioner.ts:96`: `MAX_ADDITIONAL_SPECIALTIES = 3` más la principal da 4.
  - `:2453-2455` manda `specialtyConceptIds`.
  - `iam.types.ts:250-255` dice «una principal y hasta tres adicionales».
  - En el editor del perfil, el commit `51179903 fix: cap practitioner specialties at four` agrega de a una con `addSpecialty` (`practitioner-profile-edit.ts:1334`).
- **Evidencia API (dev):**
  - `register-practitioner.dto.ts:262-270`: `@ArrayMaxSize(3)`, así que 4 especialidades dan 400.
  - `src/modules/profiles/services/medical-specialty-catalog.service.ts:18`: `MAX_SPECIALTIES_PER_PRACTITIONER = 3`.
  - `profiles-practitioners.service.ts:1787` y `:1875` rechazan la cuarta desde el perfil con 422.
- **Modelo:** `profiles.practitioner_specialties`. No hay tope en DDL: es regla de negocio.
- **Qué hacer:** mergear #453 (commit `5ff4bfe8`), que sube ambos a 4.
- **CA:**
  - Dado un alta con 4 especialidades distintas del catálogo, entonces 201 y la primera queda `is_primary=true`.
  - Dado un alta con 5, entonces 400.
  - Dado un médico con 4 vigentes, cuando `POST /profiles/practitioners/:id/specialties` agrega una quinta, entonces 422.

## ID-05 · `PATCH /profiles/practitioners/me`: NIT, razón social y dirección laboral → 400; la lectura no los devuelve
- **Severidad:** Alta. **Tipo:** contrato-body y contrato-respuesta.
- **Evidencia front:**
  - `src/app/core/data-access/profiles/profiles.client.ts:469-511` declara `taxId`, `taxHolderName`, `workAddressLines`, `workLatitude` y `workLongitude`.
  - `features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.ts:1135-1146` y `:1190-1195` los manda cuando cambian.
  - `:1000-1001` los siembra desde `perfil.taxId` y `perfil.taxHolderName`.
  - Tipos: `profiles.types.ts:405-414` (`taxId`, `taxHolderName`, `workAddress`).
- **Evidencia API (dev):**
  - `src/modules/profiles/dto/update-practitioner-profile.dto.ts:63-321` no tiene `taxId`, `taxHolderName` ni `work*`, así que hay 400 en cuanto el médico toca NIT o dirección laboral.
  - `read-practitioner-profile.dto.ts:191-380` (`PractitionerProfileSummaryDto`) no devuelve `taxId`, `taxHolderName` ni `workAddress`, así que el editor siempre nace vacío.
- **Modelo:** el NIT va a `common.identifiers`, como en el paciente, que ya lo tiene en `UpdateOwnPatientProfileDto:266-286`. La dirección va a `common.addresses` con uso WORK.
- **Qué hacer:** mergear #453 (commit `27055a6d fix(profiles): persist practitioner fiscal identity`, más los campos `work*` en el DTO de update y `workAddress` y `taxId` en la lectura).
- **CA:**
  - Dado un médico logueado, cuando hace `PATCH /profiles/practitioners/me` con `{taxId:"1234567011", taxHolderName:"X"}`, entonces 200 y la relectura devuelve los mismos valores.
  - Dado `{taxId:""}`, entonces el NIT se quita.
  - Dado `{workAddressLines:"...", workLatitude:-17.7, workLongitude:-63.1}`, entonces 200 y `workAddress` vuelve con esos valores.

## ID-06 · No existe la ruta para corregir un título propio
- **Severidad:** Alta. **Tipo:** ruta-faltante.
- **Evidencia front:**
  - `profiles.client.ts:830`: `updateOwnCredential` hace `PATCH /profiles/practitioners/me/credentials/:id`.
  - `practitioner-profile-edit.ts:1797`.
  - El mock la simula: `core/mock/handlers/profiles.handlers.ts:1024`.
- **Evidencia API (dev):** `profiles-practitioners.controller.ts` solo tiene `@Delete('practitioners/me/credentials/:credentialId')` (`:471`). El `PATCH` da 404.
- **Modelo:** `profiles.professional_credentials`.
- **Qué hacer:** mergear #453. Agrega `@Patch('practitioners/me/credentials/:credentialId')` con `UpdateOwnCredentialDto`: tipo, número, institución, fecha y `fileId`, solo en estado PENDIENTE. Así queda `docs/pendientes-backend-perfil-profesional.md` §2.
- **CA:**
  - Dado un título propio pendiente, cuando `PATCH …/me/credentials/:id` con `{number:"X-2"}`, entonces 204 y la relectura muestra `X-2`.
  - Dado un título verificado, entonces 422.
  - Dado un título de otro profesional, entonces 404.

## ID-07 · No existen las rutas para corregir o retirar una especialidad propia
- **Severidad:** Alta. **Tipo:** ruta-faltante.
- **Evidencia front:**
  - `profiles.client.ts:845` (`updateOwnSpecialty` → `PATCH …/me/specialties/:id`) y `:856` (`removeOwnSpecialty` → `DELETE`).
  - Usadas en `practitioner-profile-edit.ts:1689` y `:1808`.
  - El mock las simula en `profiles.handlers.ts:1045` y `:1054`.
- **Evidencia API:** en dev solo existe `@Patch('practitioners/me/specialties/:specialtyId/primary')` (`profiles-practitioners.controller.ts:529`). En #453 tampoco están (`git show …:profiles-practitioners.controller.ts`: solo `/primary` en `:562`). Hoy dan 404.
- **Modelo:** `profiles.practitioner_specialties`.
- **Qué hacer:**
  - Backend: crear `PATCH /profiles/practitioners/me/specialties/:specialtyId` con `{specialtyConceptId?, boardCertified?}` y 204, sin `isPrimary`. Crear `DELETE` con 204. En los dos casos, el sujeto sale de la sesión y lo ajeno da 404.
  - Front: `55e948a4` quitó el toggle de certificación. Confirmar si `boardCertified` sigue haciendo falta en el contrato.
- **Archivos:** `src/modules/profiles/controllers/profiles-practitioners.controller.ts`, `dto/update-own-specialty.dto.ts` (nuevo), `services/profiles-practitioners.service.ts`.
- **CA:**
  - Dado una especialidad propia, cuando se hace `DELETE`, entonces 204 y desaparece de `me/summary`. Si era la principal, el perfil queda sin principal.
  - Dado una especialidad ajena, entonces 404.
  - Dado un `PATCH` con `{isPrimary:true}`, entonces 400 (no es whitelist).

## ID-08 · No existen las rutas para corregir o retirar una matrícula propia
- **Severidad:** Alta. **Tipo:** ruta-faltante.
- **Evidencia front:**
  - `profiles.client.ts:866` (`updateOwnLicense`) y `:879` (`removeOwnLicense`).
  - Usadas en `practitioner-profile-edit.ts:1699` y `:1816`.
  - Mock: `profiles.handlers.ts:1069` y `:1078`.
- **Evidencia API:** no existen en dev ni en #453. Solo existe `POST /profiles/practitioners/:profileId/jurisdiction-authorizations` (`controller:306`).
- **Modelo:** `profiles.jurisdiction_authorizations`, que ya tiene `file_id` (`02_tables.sql:191-209`).
- **Qué hacer:**
  - `PATCH …/me/jurisdiction-authorizations/:licenseId` con `{licenseNumber?, regulatoryAuthority?, validFrom?, fileId?}` y 204, solo mientras no esté verificada (si no, 422).
  - `DELETE` con 204.
- **CA:**
  - Dado una matrícula propia pendiente, cuando `PATCH` con `{licenseNumber:"MP-9"}`, entonces 204 y la relectura la muestra.
  - Dado una matrícula verificada, entonces 422.
  - Dado una matrícula ajena, entonces 404.

## ID-09 · El `fileId` del diploma y de la matrícula entra y no se devuelve en la lectura
- **Severidad:** Media. **Tipo:** contrato-respuesta.
- **Evidencia front:**
  - `profiles.types.ts:192-200` (`PractitionerCredential.fileId`) y `:231-234` (`PractitionerLicense.fileId`). El botón de descarga depende de ese dato.
  - El mock lo devuelve.
- **Evidencia API (dev):** `read-practitioner-profile.dto.ts:77-115` (credencial) y `:119-139` (matrícula) no tienen `fileId`, aunque `AddOwnCredentialDto:75` y `CreateJurisdictionAuthorizationDto:100` lo aceptan. #453 lo agrega solo a la credencial (`read-practitioner-profile.dto.ts:94` en la rama). **La matrícula sigue sin devolverlo.**
- **Modelo:** `professional_credentials.file_id` y `jurisdiction_authorizations.file_id`. Existen los dos.
- **Qué hacer:** agregar `fileId?: uuid` a `PractitionerLicenseDto` y mapearlo en el servicio. La descarga va por `GET /common/files/:id/content`, que ya existe.
- **CA:**
  - Dado una matrícula creada con `fileId`, cuando `GET /profiles/practitioners/me/summary`, entonces `licenses[i].fileId` = ese id.
  - Dado ese `fileId`, cuando el dueño hace `GET /common/files/:id/content`, entonces 200 con el PDF.

## ID-10 · Universidad, país y ciudad del título: se preguntan y se descartan
- **Severidad:** Media. **Tipo:** dato-inexistente-en-modelo.
- **Evidencia front:**
  - `register-practitioner.ts:796-798`: controles `professionalTitleUniversity`, `professionalTitleCountry` y `professionalTitleCity`.
  - `:1262-1281`: se muestran en el formulario.
  - `:2370-2463`: `datosProfesional()` **no los manda**. El comentario de `:2457-2459` dice «Nombre, país y ciudad permanecen locales».
  - `:300-330` documenta que la ciudad no tiene columna y que `VS_COUNTRY` no tiene miembros.
- **Evidencia API y modelo:**
  - `professional_credentials` tiene `issuing_institution_text` e `issuing_country_concept_id`, pero **no tiene ciudad** (`02_tables.sql:134-156`).
  - `AddOwnCredentialDto` (`own-credential.dto.ts:22-75`) y `RegisterPractitionerCredentialDto` no exponen `issuingCountryConceptId`.
  - La subtarea 1.6 (`PROMPT_SUBTAREA_1_6_UNIVERSIDAD_TITULOS.md`) pedía `university`, `degreeCountryConceptId`, `degreeCityText`, `diplomaFileId`, `academicTitles[]` e `issuingCityText`: ninguno existe en dev. `issuingCityText` **no tiene columna**, así que sería dato inventado.
- **Qué hacer:**
  - Front: enviar la universidad del título principal como `issuingInstitutionText` de una credencial tipo título universitario, o dejar de preguntar lo que no se guarda.
  - Backend: exponer `issuingCountryConceptId` en `AddOwnCredentialDto` y en `RegisterPractitionerCredentialDto`, y sembrar `VS_COUNTRY`.
  - La ciudad exige cambio de modelo (`.puml` → `gen_ddl.py` → `SQL/` → ORM) o sacarla del formulario. Es decisión de producto.
- **CA:**
  - Dado un alta con universidad del título principal, cuando se registra, entonces existe una credencial con `issuing_institution_text` = esa universidad.
  - Dado un país elegido, entonces `issuing_country_concept_id` queda guardado y la relectura lo devuelve.
  - Ningún campo que el formulario muestra se descarta sin aviso.

## ID-11 · Alta de paciente: la empresa escrita a mano («Otra») se pierde en silencio
- **Severidad:** Media. **Tipo:** contrato-body.
- **Evidencia front:** `src/app/features/auth/register-patient/register-patient.ts:2489` manda `workEmployerConceptId: empresa` **aunque la opción elegida sea `employer:bo:OTRA`**, y `:2497-2498` manda además `workEmployerFreeText`. La ocupación, en cambio, omite el concepto cuando es «Otra» (`:2486`).
- **Evidencia API:** `src/modules/iam/services/iam-patient-self-registration.service.ts:282-284` hace `workEmployerFreeText: dto.workEmployerConceptId ? undefined : dto.workEmployerFreeText`. Con el concepto OTRA presente, el texto se descarta.
- **Modelo:** `profiles.persons.work_employer_concept_id` y `work_employer_free_text`.
- **Qué hacer:**
  - Front: replicar la regla de la ocupación: si `empresaEsOtra()`, no mandar `workEmployerConceptId`.
  - O backend: tratar el concepto OTRA como «usar el texto libre».
- **CA:**
  - Dado un alta con empresa «Otra» y texto «Consultores S.R.L.», cuando se registra, entonces `persons.work_employer_free_text` = «Consultores S.R.L.».
  - Dado una empresa del catálogo, entonces `work_employer_free_text` es NULL.

## ID-12 · Correo del médico: sin correo institucional, el personal se guarda como TRABAJO
- **Severidad:** Media. **Tipo:** otro (semántica).
- **Evidencia front:** `register-practitioner.ts:756-761`: el correo de trabajo es opcional. `:2408` manda el personal en `email` y nunca manda `personalEmail`.
- **Evidencia API:**
  - dev: `iam-practitioner-self-registration.service.ts:173-174` guarda `email` como `CONTACT_USE_WORK`.
  - #453 (`iam-practitioner-self-registration.service.ts:146-177` de la rama): «Sin `workEmail`, `email` sigue guardándose como trabajo».
  - Resultado: el editor (`practitioner-profile-edit`) muestra el correo personal en «Correo de trabajo» y deja «Correo personal» vacío.
- **Modelo:** `common.contact_points.use_concept_id`.
- **Qué hacer:**
  - Opción A: el front manda también `personalEmail = email`.
  - Opción B: con #453, el backend usa `personalEmail ?? email` como HOME siempre que el alta venga del formulario nuevo.
  - Hay que decidir un contrato y documentarlo.
- **CA:**
  - Dado un alta sin correo institucional, cuando se relee el perfil, entonces `personalEmail` = el correo de acceso y `workEmail` está ausente.

## ID-13 · P28: sexo al nacer, CI y departamento emisor del médico no se pueden corregir
- **Severidad:** Media. **Tipo:** contrato-body.
- **Evidencia front:** `practitioner-profile-edit.ts:881-898` muestra `nationalId` y el departamento en solo lectura. El `PATCH` no los incluye (`:1090-1105`). `PENDIENTES-BACKEND.md` P28.
- **Evidencia API:** `UpdateOwnPractitionerProfileDto` (dev y #453) no tiene `sexAtBirth`, `nationalId` ni `issuerAdministrativeAreaConceptId`. `PractitionerProfileSummaryDto` no devuelve `sexAtBirth`. El paciente sí puede: `UpdateOwnPatientProfileDto:159` y `:332`.
- **Modelo:** `profiles.persons.sex_at_birth_concept_id` y `common.identifiers.issuer_administrative_area_concept_id`. Existen.
- **Qué hacer:** replicar en el DTO del médico lo que ya acepta el del paciente (`sexAtBirth`, `issuerAdministrativeAreaConceptId`) y devolver `sexAtBirth` en la lectura. Corregir la CI pasa por un trámite de verificación de identidad: definir si se admite editarla.
- **CA:**
  - Dado un médico, cuando hace `PATCH me` con `{sexAtBirth:"FEMALE"}`, entonces 200 y la relectura lo devuelve.
  - Dado un departamento fuera de `VS_BO_DEPARTMENT`, entonces 422.

## ID-14 · `activity.monthlyEncounters` y `activity.quality` los inventa el mock
- **Severidad:** Media. **Tipo:** dato-inexistente-en-modelo (de contrato).
- **Evidencia front:**
  - `profiles.types.ts:296-348` define `monthlyEncounters` y `PractitionerQualityMetrics` (pacientes únicos, recurrentes, puntualidad, duración media, rating).
  - `features/account/my-profile/practitioner-profile/practitioner-profile.ts:436-437` los dibuja.
  - El mock los fabrica: `core/mock/handlers/profiles.handlers.ts:447-456` (`serieMensualDemo()`, `CALIDAD_DEMO`).
- **Evidencia API:** `read-practitioner-profile.dto.ts:172-187`. `PractitionerActivityDto` tiene solo `encounters`, `medicationRequests`, `clinicalNotes` y `documents`.
- **Modelo:** ninguna tabla guarda esos agregados. Se podrían derivar de `scheduling` y `clinical`, pero no hay contrato.
- **Qué hacer:** decidir si el backend los calcula (nuevo campo opcional en `PractitionerActivityDto`) o si el front los oculta sin mock. Contra la API real, la sección sale vacía, que es degradación silenciosa.
- **CA:**
  - Dado la API real, cuando se abre el perfil del médico, entonces la sección de calidad no muestra cifras que la API no envió: estado vacío explícito.
  - Si se implementa: dado N encuentros en el mes M, entonces `monthlyEncounters` contiene `{month:M, count:N}`.

## ID-15 · `GET /profiles/patients/:id` es solo `SECURITY_ADMIN`, pero lo usan pantallas clínicas
- **Severidad:** Media. **Tipo:** autorización.
- **Evidencia front:** `profiles.client.ts:173` (`getPatient`), usado en:
  - `features/clinical-record/consultation/consultation.ts:761`
  - `clinical-record/patient-chart/patient-chart.ts:1568`
  - `clinical-record/request-access/request-access.ts:67`
  - `quotations/quotation-form/quotation-form.ts:587`

  Todas con `catchError(() => of(null))`: el médico ve «Paciente» sin nombre.
- **Evidencia API:** `src/modules/profiles/controllers/profiles-patients.controller.ts:342-343`: `@Get('patients/:profileId') @Roles('SECURITY_ADMIN')`.
- **Modelo:** `profiles.persons` y `patient_profiles`.
- **Qué hacer:**
  - Opción A: exponer una lectura mínima (nombre y código) para `CLINICIAN`/`PRACTITIONER` con relación de cuidado vigente (`authz.care_relationships`).
  - Opción B: el front toma el nombre del `summary` clínico, si lo trae.
- **CA:**
  - Dado un médico con relación de cuidado vigente, cuando pide el nombre del paciente, entonces 200 solo con datos de identificación mínimos.
  - Dado un médico sin relación, entonces 403 o 404.

## ID-16 · Historial laboral «solo padrón»: la API no recibe `healthFacilityConceptId`
- **Severidad:** Media. **Tipo:** contrato-body.
- **Evidencia front:** `origin/mockup:…/work-history/work-history.ts`:
  - Commit `170e571f`: el alta «sólo admite elegir del padrón».
  - `:729-737` manda solo `organizationName` (el nombre canónico), `roleTitle`, fechas y `practiceSiteId`.
  - El id del establecimiento elegido (`establecimiento()`, `:276`) no viaja.
  - `profiles.types.ts:669-678` declara `departmentText`, que no se usa.
- **Evidencia API:** `src/modules/profiles/dto/affiliation.dto.ts:22` (`CreateAffiliationDto`) no tiene `healthFacilityConceptId` ni `departmentText`. La entidad sí: `entities/practitioner_affiliations.entity.ts:69-80`.
- **Modelo:** `practitioner_affiliations.health_facility_concept_id` y `department_text` existen.
- **Efecto:** la regla «solo del padrón» es solo de UI. Cualquier cliente puede inventar un hospital por API, y el índice de unicidad por establecimiento nunca se usa.
- **Qué hacer:**
  - Backend: aceptar `healthFacilityConceptId` (validado contra el value set del padrón) y `departmentText`.
  - Front: mandar el id elegido.
- **CA:**
  - Dado un vínculo elegido del padrón, cuando se da de alta, entonces `health_facility_concept_id` = el concepto elegido.
  - Dado un concepto fuera del padrón, entonces 422.
  - Dado dos altas al mismo establecimiento con fechas superpuestas, entonces 409 por `ux_practitioner_affiliations_same_health_facility`.

## ID-17 · Altas de laboratorio y de centro de imagenología no llaman a la API
- **Severidad:** Media. **Tipo:** otro (integración pendiente).
- **Evidencia front:**
  - `features/auth/register-laboratory/register-laboratory.ts:51` y `:857-863`: «Es la MAQUETA: nada sale a la red».
  - `register-imaging-center/register-imaging-center.ts:53` y `:1003-1009`, ídem.
  - `iam.client.ts:320-326`: `registerOrganization` fija `tenantType: 'PAYER'`.
- **Evidencia API (dev):**
  - `src/modules/directory/directory.concepts.ts:144` y `:169-171`: `DIAGNOSTIC_CENTER` («imágenes o laboratorio clínico»).
  - `iam/dto/register-organization.dto.ts:530`: `diagnosticUnit?: DiagnosticUnitProfileDto`.
  - `:743`: la respuesta trae `diagnosticUnitId`.
  - La subtarea 1.5 está **cerrada del lado de la API**.
- **Modelo:** `directory.tenants`, `diagnostic_units.diagnostic_units` y `diagnostic_unit_sites`.
- **Qué hacer:**
  - Front: parametrizar `registerOrganization` por `tenantType` y agregar el bloque `diagnosticUnit` (tipo, modalidades, sede primaria).
  - Mapear los 7 adjuntos a `legalDocuments`. El DTO tiene 5 claves fijas, así que hay que verificar cuáles del formulario no tienen lugar.
  - Laboratorio: confirmar con producto si usa `DIAGNOSTIC_CENTER` con `diagnosticUnitTypeConceptId` de laboratorio.
- **CA:**
  - Dado el alta de imagenología completa, cuando se envía, entonces 201 y existen un tenant `DIAGNOSTIC_CENTER`, su unidad diagnóstica y su sede.
  - Dado un alta sin país ni jurisdicción, entonces 422 `missing`.

## ID-18 · ~25 roles que usan el menú y los `@Roles` no se siembran
- **Severidad:** Media. **Tipo:** autorización.
- **Evidencia front:** `core/navigation/navigation.map.ts` muestra secciones por rol: `PLATFORM_ADMIN`, `IDENTITY_ADMIN`, `SCHEDULING_ADMIN`, `SCHEDULING_AGENT`, `CASHIER`, `FINANCE`, `DPO`, `BILLING`, `PAYMENTS_ADMIN`, etc. `SUPERADMIN` funciona como comodín (`navigation.types.ts:271`).
- **Evidencia API:**
  - `iam/services/role-mapping.ts` define solo 4 roles globales: `USER`, `PATIENT`, `PRACTITIONER` y `SECURITY_ADMIN`.
  - Los sembrados en `authz.roles` (`authz/authz.seed.ts`, `pharma_lab/pharma_lab.roles.ts`, `data_catalog/data-catalog.roles.ts`) son 14 códigos, **ninguno** de los de arriba.
  - Sin embargo aparecen en `@Roles`: por ejemplo `PLATFORM_ADMIN` en 178 decoradores e `IDENTITY_ADMIN` en 12.
  - `common/auth/roles.guard.ts:29` da comodín a `SUPERADMIN`.
- **Efecto:** fuera de `SUPERADMIN`, nadie puede recibir esos roles salvo creándolos a mano (`POST /authz/roles`). Las secciones del menú y los endpoints quedan inalcanzables. **Sin confirmar** si algún entorno los crea por seed externo.
- **Qué hacer:** sembrar los roles de sistema que usan los `@Roles` con una semilla declarativa por módulo (`<modulo>.roles.ts`), o retirar del menú y de los decoradores los que no se van a asignar.
- **CA:**
  - Dado un `SECURITY_ADMIN`, cuando `GET /authz/roles`, entonces aparecen todos los códigos que usan los `@Roles`.
  - Dado un usuario con `IDENTITY_ADMIN` asignado, cuando refresca el token, entonces el claim `roles` lo contiene y ve la sección de verificación de identidad.

## ID-19 · `delegated_access` solo tiene escrituras
- **Severidad:** Baja. **Tipo:** ruta-faltante.
- **Evidencia front:** `features/delegated-access/practitioner-delegate-form/practitioner-delegate-form.ts:31` y `:72-74`: «el backend no expone» listados, así que se pegan UUID.
- **Evidencia API:** en `src/modules/delegated_access/controllers/*` todas las rutas son `POST`/`PATCH`. No hay ningún `GET`. Los contratos coinciden campo a campo: se verificaron 11 DTO.
- **Qué hacer:** agregar `GET` de delegaciones, asignaciones y sets de permisos por tenant, y reemplazar los campos UUID por selectores.
- **CA:**
  - Dado un tenant con delegaciones, cuando `GET /practitioner-delegates?tenantId=`, entonces lista paginada.
  - El formulario deja de pedir UUID a mano.

## ID-20 · El mock no valida whitelist y descarta campos que la API persiste
- **Severidad:** Baja. **Tipo:** otro (fidelidad del mock).
- **Evidencia front:**
  - `core/mock/handlers/auth.handlers.ts:93-120`: `register-patient` y `register-practitioner` aceptan cualquier cuerpo y no guardan nada. Por eso ID-01 a ID-04 no se ven en `mockup`.
  - `profiles.handlers.ts:641-671`: el `PATCH /profiles/patients/me` del mock ignora `sexAtBirth`, `occupationFreeText`, `taxId` y `taxHolderName`, que el front manda y la API guarda. El mock muestra «no guardó» donde la API sí guarda.
  - `:420-422`: el mock deriva el NIT del médico como `nationalId + "011"`, un dato inventado.
- **Qué hacer:** que el mock rechace con 400 las claves que no están en el DTO (lista blanca generada desde OpenAPI) y guarde lo que la API guarda.
- **CA:**
  - Dado el mock, cuando el front manda una clave que el DTO no declara, entonces 400 igual que la API.
  - Dado `PATCH patients/me {taxId}`, entonces la relectura del mock lo devuelve.

## ID-21 · Tipos del front más laxos que el DTO (alta de paciente)
- **Severidad:** Baja. **Tipo:** contrato-body (latente).
- **Evidencia front:** `iam.types.ts:42-198` define `email?`, `birthDate?`, `phone?`, `sexAtBirth?` e `issuerAdministrativeAreaConceptId?` como opcionales. El formulario los exige (`register-patient.ts:540-574`), así que hoy no rompe.
- **Evidencia API:** `iam/dto/register-patient.dto.ts` los declara **obligatorios** (`email!`, `birthDate!`, `phone!`, `sexAtBirth!`, `issuerAdministrativeAreaConceptId!`). El commit `ee60a8d2` cerró la subtarea 1.4.
- **Qué hacer:** alinear el tipo, para que el compilador impida construir un alta que la API rechaza.
- **CA:** dado `PatientRegistration` sin `phone`, cuando compila, entonces error de tipos.

## ID-22 · El paciente no puede corregir el departamento emisor ni la empresa
- **Severidad:** Baja. **Tipo:** otro (front incompleto).
- **Evidencia front:** `profiles.types.ts:939-958` (`OwnPatientProfileChanges`) no tiene `issuerAdministrativeAreaConceptId`, `workEmployer*`, `workMunicipalityConceptId` ni `guardian*`. `OwnPatientProfile` (`:864-938`) no lee `workEmployer*`.
- **Evidencia API:** `UpdateOwnPatientProfileDto:332`, `:369`, `:410-424` y `:444-474` los aceptan. `OwnPatientProfileResponseDto` devuelve `workEmployerConceptId` y `workEmployerFreeText`.
- **Qué hacer:** exponerlos en el editor del paciente, en las pestañas «Datos personales» y «Contacto».
- **CA:** dado un paciente, cuando cambia el departamento emisor y guarda, entonces `PATCH` 200 y la relectura lo muestra.

## ID-23 · Tipos declarados que la API rechazaría
- **Severidad:** Baja. **Tipo:** contrato-body (latente).
- **Evidencia front:**
  - `profiles.types.ts:26-59` (`NewPatientProfile`) declara `name`, `middleName`, `lastName`, `motherLastName`, `nationalId`, `issuer…`, `phone`, `occupation*` y `guardian*`. `CreatePatientDto` (`profiles/dto/create-patient.dto.ts:12-77`) no los tiene. Hoy `admin/patients/patient-new/patient-new.ts:209-228` no los manda, pero el tipo lo permite.
  - `UpdatePractitionerAffiliation.departmentText` (`profiles.types.ts:673`): `UpdateAffiliationDto` no lo tiene.
- **Qué hacer:** quitar los campos del tipo o agregarlos al DTO. P22 ya se resolvió por `POST /scheduling/appointments/walk-in`.
- **CA:** un `NewPatientProfile` con `nationalId` no compila.

## ID-24 · Sin cambio de contraseña, sesiones ni MFA para el usuario logueado
- **Severidad:** Baja. **Tipo:** ruta-faltante, en los dos lados.
- **Evidencia:**
  - En `features/account/*` no hay pantalla de seguridad.
  - La API solo tiene `forgot-password`, `reset-password`, `logout` y `logout-all` (`iam-auth.controller.ts`).
  - `GET /iam/users/:id/sessions`, `mfa-factors` y `devices` son rutas administrativas.
  - No existe `/iam/me/password`.
- **Qué hacer:** decisión de producto. Si entra: `POST /iam/auth/change-password` (contraseña actual y nueva) y `GET /iam/me/sessions`.
- **CA:** dado un usuario logueado, cuando cambia su contraseña con la actual correcta, entonces 200 y se revocan las otras sesiones.

---

## Contratos verificados que **sí** coinciden (no son hallazgos)

- **Login, refresh, logout, verify-email, activate, resend-verification, forgot/reset-password:** body idéntico a `LoginDto`, `RefreshTokenDto`, `ActivateAccountDto`, `ResendVerificationDto`, `ForgotPasswordDto` y `ResetPasswordDto`.
- **Alta de paciente (`register-patient`):** las 30 claves que manda el front están en `RegisterPatientDto`, salvo el defecto semántico de ID-11.
- **Alta de aseguradora (`register-organization`):** `organization{…, payer, legalDocuments, legalRepresentative, executives}` y `owner{…}` coinciden. `fullName` en representante y gerencias está deprecated pero se acepta.
- **Admin de usuarios:** `POST /iam/users`, `POST /iam/users/assisted-registration` y `GET /iam/users` coinciden.
- **identity_assurance:** las 7 rutas self-service y las 13 de administración coinciden campo a campo. `checks:plan` **sí existe**: `identity-cases.controller.ts:126`, `@Post(':id/checks\\:plan')`, path-to-regexp 8.4.2, cubierta por el int-spec `identity-verification-cycle.int-spec.ts:83`. El `null` del inventario es un falso negativo del matcher.
- **directory:** `NewTenant`, `NewChildTenant`, `NewBranch`, `NewMembership`, `NewBranchAssignment` y `OrganizationEdit` coinciden con sus DTO.
- **authz:** care-relationships `request`/`respond`/`mine` coinciden.
- **auth-providers:** los 14 DTO coinciden. El `PUT …/protocol-configs` del mock sobra, pero el cliente usa `POST`.
- **Preferencias de notificación:** `GET` y `PUT /notifications/preferences/me` coinciden. El `PATCH` del mock sobra.
- **Resto de profiles y práctica:** dependientes (`POST`/`GET /profiles/patients/me/dependents`), foto del paciente (`PUT`/`DELETE …/me/photo`), foto del médico (`PUT …/:profileId/photo`), onboarding, afiliaciones (`CreateAffiliationDto` y `UpdateAffiliationDto`), sedes propias con QR bancario y loyalty («Mis puntos», `RedeemPointsDto`).

## Estado de los pendientes previos de este dominio (según el código de `origin/dev` del API)

| Pendiente | Estado hoy | Evidencia |
|---|---|---|
| P14: alta de paciente 500 por columnas de nombre | **Cerrado en el modelo** (runtime sin confirmar) | `mantra-core-health-model/SQL/05_profiles/02_tables.sql:5-35` (`persons` tiene `name`, `middle_name`, `last_name`, `mother_last_name`) |
| P17: foto de perfil | **Cerrado** | `PUT /profiles/patients/me/photo` (`profiles-patients.controller.ts:157`) y `PUT /profiles/practitioners/:profileId/photo` (`profiles-practitioners.controller.ts:257`) |
| P19 / subtarea 1.2: domicilio en el alta médica | **Cerrado** | `register-practitioner.dto.ts:346-383`; service `:725-727` pasa `lines`, `latitude` y `longitude` |
| P20: consultorio propio en el alta | **Cerrado** | `register-practitioner.dto.ts:600-607` (`ownSite`); service `:769-777` (`OwnSiteProvisioningService`) |
| P22: alta de mostrador | **Cerrado** (por otra vía) | `POST /scheduling/appointments/walk-in`; front `agenda/appointment-new/appointment-new.ts:599-625` |
| P27: quitar el punto del mapa | **Cerrado** | `UpdateOwnPatientProfileDto` y `UpdateOwnPractitionerProfileDto` aceptan `null` en el par |
| P28: editar lo declarado en el alta (médico) | **Abierto** | ID-13 (sexo, CI, departamento). El correo de trabajo se deja fuera a propósito |
| P29: archivo de la matrícula | **A medias** | Escritura cerrada (`CreateJurisdictionAuthorizationDto:100`, columna `file_id`). Lectura abierta (ID-09) |
| Pend. perfil profesional §1: `fileId` en la lectura | **Abierto** (#453 cierra solo el diploma) | ID-09 |
| Pend. perfil profesional §2: `PATCH` del título | **Abierto** en dev (#453 lo cierra) | ID-06 |
| Pend. perfil profesional §3: `PATCH`/`DELETE` de especialidad | **Abierto** (ni #453) | ID-07 |
| Pend. perfil profesional §4: `PATCH`/`DELETE` de matrícula | **Abierto** (ni #453) | ID-08 |
| Padrón de universidades | **Abierto** (sin catálogo en ninguna capa) | `pendientes-backend-perfil-profesional.md` §final; front `core/profesion/instituciones-educativas.ts` |
| Subtarea 1.3: ocupación y empleador | **Cerrado** en la API | `RegisterPractitionerDto:546-565`; `UpdateOwnPractitionerProfileDto:264-321`; lectura `:312-337`. El front del médico ya no pregunta ocupación (ver 1.6). Queda el defecto ID-11 del paciente |
| Subtarea 1.4: departamento emisor obligatorio | **Cerrado** | `RegisterPatientDto` `issuerAdministrativeAreaConceptId!`; `RegisterPractitionerDto:305-315` con `@ValidateIf`; `assertIsAdministrativeArea` en `iam-patient-self-registration.service.ts:210` y en el service del médico `:947` |
| Subtarea 1.5: centro de imagenología | **Cerrado en la API, abierto en el front** | ID-17 |
| Subtarea 1.6: universidad y títulos múltiples | **A medias** | `credentials[]` sí (tipo, número, institución). `fileId` solo en #453. País, ciudad, `university` y `diplomaFileId` no (ID-03, ID-10) |
| F-34: resumen del paciente sin exigir identidad | **Cerrado** | `profiles-patients.service.ts:424-437` |
| `/identity/me/verification-types` y `checks:plan` | **Existen** | ver «coinciden» |
| P6, P10, P12 (alta admin de médico, colecciones iam/directory, claim `hpid`) | **Cerrados** | rutas presentes en el inventario |
| `ESTADO-Y-PENDIENTES.md` (API) | Fecha de corte 2026-07-30. En este dominio solo trae cierres (afiliaciones, roles clínicos efectivos, recuperación de contraseña); no hay pendiente abierto propio | `ESTADO-Y-PENDIENTES.md:23-54` y `:112-131` |

## No cubierto
- No se levantó la API ni se ejercitó ninguna ruta. Los «→400/404» son deducción de DTO y controllers, no respuesta observada.
- No se auditaron el cuerpo de `PUT /tenants/:id/public-profile`, el padrón `linkable-organizations`, `searchPatients` ni `community/profiles/me`. Tampoco las lecturas de `iam/users/:id/*`, que el front no usa.
- La pertenencia a `VS_*` de los catálogos (ocupación, empleador, país) no se contrastó contra la base viva.
- ID-18: no se verificó si algún entorno siembra esos roles por fuera del código de `dev`.
