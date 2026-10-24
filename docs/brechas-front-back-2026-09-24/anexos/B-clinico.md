# Hallazgos — dominio clínico (contratos front ↔ API)

Auditoría de solo lectura, 2026-09-24. Front `mantra-core-health` rama `mockup` (9b3e0101; en clinical/chart/diagnostics/forms/surveys es idéntica a `origin/dev`, salvo triage-ia, symptom-check, body-map y register-laboratory que solo existen en `mockup`). API `mantra-core-health-redesa-api` rama `dev` (7541797c). ValidationPipe global con `whitelist: true, forbidNonWhitelisted: true` (`src/main.ts:160-161`) → campo extra = 400. Todo por lectura de código; **nada se ejercitó en runtime** contra la API viva.

Hallazgos por parte: A (CL-01..19) núcleo clínico, recetas, condiciones, alergias, encuentros; B (CL-20..36) chart M15: notas versionadas, plantillas, documentos, planes; C (CL-40..56) diagnostics, diagnostic-units, procedures, health-context; D (CL-60..79) forms, surveys, triage IA, consent. Los huecos de numeración (37-39, 57-59) son intencionales.

Advertencias transversales:
- El modelo vigente parece estar en `mantra-core-health-model/`; el `SQL/` de la raíz del workspace está desactualizado (sin confirmar el alcance exacto).
- `mantra-core-health-redesa-api/database/SQL/` reapareció, contra ADR-0021 (fuera de alcance, reportado).

## Tabla resumen (73 hallazgos: 3 Bloqueante demo · 26 Alta · 23 Media · 21 Baja)

| ID | Título | Severidad | Parte |
|---|---|---|---|
| CL-01 | Registrar una alergia desde la consulta da 400 | Bloqueante demo | A-clinico |
| CL-02 | La receta se guarda sin prescriptor: PDF y verificación pública salen sin médico ni matrícula | Alta | A-clinico |
| CL-03 | «Otro motivo» escrito a mano en la receta da 400 | Alta | A-clinico |
| CL-04 | «Aspectos médicos» del paciente: ruta y tabla inexistentes | Alta | A-clinico |
| CL-05 | Adjuntos de receta, alergia y encuentro: 404 / 400 | Alta | A-clinico |
| CL-06 | El QR de la receta lleva a una página que no existe | Alta | A-clinico |
| CL-07 | Escrituras sobre un encuentro cerrado rompen su sello SHA-256 | Alta | A-clinico |
| CL-08 | Check-in y apertura de internación sin control de acceso por paciente | Alta | A-clinico |
| CL-09 | `POST /cds/check-interactions` abierto a cualquier rol y escribe alertas en cada intento | Media | A-clinico |
| CL-10 | El motivo del cambio de estado clínico no se guarda | Media | A-clinico |
| CL-11 | La lectura del resumen no trae lo que la pantalla muestra | Media | A-clinico |
| CL-12 | El simulador no reproduce la máquina de estados de receta (D-05), condición ni encuentro | Media | A-clinico |
| CL-13 | El mock deja leer cualquier historia; la API exige atención en curso/hoy o relación asistencial | Media | A-clinico |
| CL-14 | Corregir una receta emitida: la API lo permite, el front no lo ofrece | Media | A-clinico |
| CL-15 | Emitir sin `Idempotency-Key`: un reintento se lee como «estado viejo» | Baja | A-clinico |
| CL-16 | Bloqueo optimista y enmienda de observaciones sin usar | Baja | A-clinico |
| CL-17 | Recetas favoritas: API y mock sin cliente ni pantalla | Baja | A-clinico |
| CL-18 | Evoluciones: no hay lectura de notas por profesional (P18) — la fila se estima por fecha | Media | A-clinico |
| CL-19 | Política de firma D-05 sin superficie de administración | Baja | A-clinico |
| CL-20 | El front no firma las notas clínicas: toda evolución queda en BORRADOR para siempre | Alta (bloqueante demo según caso) | B-chart |
| CL-21 | El mock deja versionar una nota firmada y deja cambiar cualquier campo con la versión nueva | Media | B-chart |
| CL-22 | La ruta `POST /charts/notes/:id/versions` existe solo en el mock | Baja | B-chart |
| CL-23 | P18 ya está cerrado en la API y el front sigue estimando las evoluciones por fecha | Media | B-chart |
| CL-24 | Las plantillas: el front espera `options`, `multiple`, `allowOther`, `rows`… y la API no los emite | Alta | B-chart |
| CL-25 | Tres catálogos que el mock inventa: intención y actividad del plan de cuidados, y categoría documental | Alta | B-chart |
| CL-26 | La clase de actividad del plan se escribe y nunca se vuelve a leer | Media | B-chart |
| CL-27 | Los documentos del expediente no se pueden abrir: el front descarta `files` y no usa la descarga de chart | Alta | B-chart |
| CL-28 | Registrar un documento son N+1 peticiones sin atomicidad: si falla la última, los archivos quedan huérfanos | Baja | B-chart |
| CL-29 | El autor de una nota o versión es un campo libre del body, no la sesión | Alta | B-chart |
| CL-30 | El paciente no tiene ninguna ruta para leer sus notas liberadas, planes ni documentos: la «historia unificada» no los incluye | Alta | B-chart |
| CL-31 | Hay un PDF oficial del encuentro en la API y el front arma el suyo en el cliente | Media | B-chart |
| CL-32 | No hay lectura del historial de versiones de una nota | Media | B-chart |
| CL-33 | La API cofirma modificando una versión ya firmada; el `<<IMMUTABLE>>` no está garantizado en la base | Media | B-chart |
| CL-34 | El mock filtra plantillas por `specialtyConceptId` y el cliente manda `specialtyId` | Baja | B-chart |
| CL-35 | Los estados de nota del mock no coinciden con los conceptos de la API | Baja | B-chart |
| CL-36 | Los documentos nacen «solo para el profesional» y el front no deja elegir visibilidad ni confidencialidad | Baja | B-chart |
| CL-40 | El paciente no puede descargar el PDF de su resultado de laboratorio | Bloqueante demo | C-diagnostics |
| CL-41 | El mock de `GET /diagnostic-results/me/:id/shares` devuelve un arreglo pelado y el panel «compartido con» falla siempre en mockup | Alta | C-diagnostics |
| CL-42 | El alta de laboratorio y de centro de imagenología no manda nada, aunque `register-organization` ya soporta `DIAGNOSTIC_CENTER` | Alta | C-diagnostics |
| CL-43 | Un laboratorio unipersonal no puede cumplir el contrato de documentos legales | Alta | C-diagnostics |
| CL-44 | La administración del laboratorio solo la puede usar un administrador de plataforma, no el dueño del laboratorio | Alta | C-diagnostics |
| CL-45 | La búsqueda de centros no devuelve `cities` y el mapa de departamentos del directorio no aparece en `dev` | Media | C-diagnostics |
| CL-46 | Dos caminos de liberación de informes: `POST /clinical/diagnostic-reports/:id/release` no deja el resultado visible para el paciente | Alta | C-diagnostics |
| CL-47 | El circuito del laboratorio (acesión, espécimen, orden de trabajo, analizador, verificación, informe) no tiene pantalla, y los especímenes no tienen ninguna lectura | Media | C-diagnostics |
| CL-48 | Compartir un resultado exige tipear el UUID de la cuenta del profesional | Media | C-diagnostics |
| CL-49 | El módulo health-context exige roles que no existen en ningún seed | Media | C-diagnostics |
| CL-50 | `reason` del share se acepta y se descarta en silencio | Baja | C-diagnostics |
| CL-51 | `minAmount` viaja sin moneda y el front pone la moneda literal | Baja | C-diagnostics |
| CL-52 | El mock de procedimientos no distingue las respuestas del integrante y conserva una ruta `/decline` que no existe | Baja | C-diagnostics |
| CL-53 | El mock de compartir conserva `DELETE …/shares/:shareId`, que la API no tiene | Baja | C-diagnostics |
| CL-54 | El bloque de intervenciones de la ficha queda vacío para un médico sin rol quirúrgico | Media | C-diagnostics |
| CL-55 | El Swagger de `CaseDetailDto.operativeSteps` omite `description`, que el front tipa como obligatorio | Baja | C-diagnostics |
| CL-56 | El mock inventa estudios de imagen y preparación | Baja | C-diagnostics |
| CL-60 | El editor de encuestas no puede editar nada contra la API real | Bloqueante demo | D-forms |
| CL-61 | Generador de formularios: editar, quitar y reordenar campos propios no existe | Alta | D-forms |
| CL-62 | Declarar un campo de elección o duplicarlo da 400 (el doc dice que «se ignora») | Alta | D-forms |
| CL-63 | Opciones, «Otro», cuadrículas y descripción no existen en el modelo de `forms` | Alta | D-forms |
| CL-64 | `GET /charts/templates/:id` no devuelve opciones ni metadatos del campo | Media | D-forms |
| CL-65 | Capturar un campo de elección rompe: `code` exige un concept id y un escalar | Alta | D-forms |
| CL-66 | Completar un formulario son 3 transacciones y el reintento queda bloqueado (409) | Alta | D-forms |
| CL-67 | La instancia de formulario no registra qué plantilla se completó | Media | D-forms |
| CL-68 | Cualquier sesión (incluido un paciente) puede declarar campos globales y reescribir etiquetas | Alta | D-forms |
| CL-69 | El PATCH de definición que pide el front reescribe la historia clínica | Alta | D-forms |
| CL-70 | Nueva versión de encuesta: el mock copia las preguntas, la API la abre vacía | Media | D-forms |
| CL-71 | Deriva menor del simulador de encuestas | Baja | D-forms |
| CL-72 | `PATCH /surveys/templates/:id` (título, consigna, plazo) sin pantalla y sin API | Baja | D-forms |
| CL-73 | Triage IA: `POST /v1/triage/analyze` no existe en la API y su ruteo en producción no está versionado | Media | D-forms |
| CL-74 | Contrato de la respuesta de triage no verificable | Baja | D-forms |
| CL-75 | Dictado y texto de síntomas salen a terceros sin base legal registrada | Media | D-forms |
| CL-76 | El resultado del chequeo de síntomas no se persiste en ningún lado | Baja | D-forms |
| CL-77 | El módulo `consent` no tiene cliente ni lecturas; el consentimiento informado se guarda como formulario | Alta | D-forms |
| CL-78 | Estado de los documentos de pendientes (dominio forms/surveys/consent) | Baja | D-forms |
| CL-79 | Asignar una encuesta pide tipear a mano el UUID del servicio | Baja | D-forms |



---

## Parte · Parte A · Contratos del núcleo clínico (front ↔ API)

Alcance: `core/data-access/clinical/*`, `core/mock/handlers/clinical.handlers.ts` (+ `misc.handlers.ts` favoritas) y pantallas que los consumen
(`features/clinical-record/**`, `features/account/questionnaires/medical-aspects`, `features/account/medical-record`, `features/progress-notes`,
`dashboard/patient-home`, `nearby-places`, `rate-encounter-dialog`). API: `mantra-core-health-redesa-api` rama `dev` @ `7541797c`,
módulos `src/modules/clinical/` y `src/modules/clinical_ext/`. DDL real: `mantra-core-health-redesa-api/database/SQL/` (la carpeta `SQL/` de la raíz
del workspace es un snapshot v4.0.10 y NO tiene las columnas v4.1.x).

Hechos base verificados:
- `src/main.ts:160-161` → `whitelist: true, forbidNonWhitelisted: true` (clave extra = 400).
- `git diff origin/dev origin/mockup` sobre `core/data-access/clinical`, `features/clinical-record`, `features/account/questionnaires`,
  `features/progress-notes` y `clinical.handlers.ts` = **vacío**: todo lo de abajo ya está en `dev`, la rama que habla con la API real.
- Rutas del dominio que el front llama y la API **no** tiene: `GET|PUT /clinical/me/medical-aspects`, `POST /clinical/medication-requests/:id/attachments`,
  `POST /clinical/allergy-intolerances/:id/attachments` (y en el mock `POST /charts/notes/:id/versions`, alias sin uso real).

---

#### CL-01 · Registrar una alergia desde la consulta da 400
- **Severidad:** Bloqueante demo · **Tipo:** contrato-body
- **Front:** `features/clinical-record/patient-chart/allergy-block/allergy-block.ts:243` y `:258` — `...(encuentro === null ? {} : { encounterId: encuentro })`. Dentro de «Atención» `encounterId()` siempre tiene valor, así que el alta **siempre** lleva la clave. (El tipo `NewAllergyIntolerance`, `clinical.types.ts:531-539`, no la declara: el spread de literal esquiva el chequeo de TS.)
- **API:** `clinical/dto/allergy.dto.ts:41-110` — `CreateAllergyIntoleranceDto` no declara `encounterId` → 400 por `forbidNonWhitelisted`. El mock lo acepta y lo guarda (`clinical.handlers.ts:466,485`).
- **Modelo:** `database/SQL/08_clinical/02_tables.sql` `clinical.allergy_intolerances` no tiene `encounter_id` (tampoco el `.puml`). Es **P26, abierto**.
- **Qué hacer:** backend — `.puml` (`encounter_id uuid NULL` FK → `clinical.encounters`) → `gen_ddl.py` → `database/SQL` + patch → entidad → `encounterId?` `@IsUUID()` en `CreateAllergyIntoleranceDto` y en `AllergyItemDto` + mapeo en `clinical-read.service.ts:613-623`. Front, mientras tanto — no mandar `encounterId` en `dev` (dejarlo sólo en `mockup`) y declararlo en `NewAllergyIntolerance`/`Allergy` cuando exista.
- **Archivos:** `Mantra Core Health Context/modules/diagram_08_clinical.puml`, `database/SQL/08_clinical/02_tables.sql` + `database/SQL/patches/<fecha>_allergy_encounter.sql`, `clinical/entities/allergy_intolerances.entity.ts`, `clinical/dto/allergy.dto.ts`, `clinical/dto/clinical-read.dto.ts`, `clinical/services/allergy-intolerances.service.ts`, `clinical/services/clinical-read.service.ts`; front `clinical.types.ts`, `allergy-block.ts`.
- **Gherkin:**
  - Dado un encuentro en curso, cuando el médico registra una alergia con reacciones, entonces la API responde 201 y la alergia aparece en el resumen con su `encounterId`.
  - Dado un `encounterId` de otro paciente, cuando se registra la alergia, entonces responde 422 y no se crea nada.
  - Dado el alta sin `encounterId`, cuando se registra, entonces responde 201 (el campo es opcional).

#### CL-02 · La receta se guarda sin prescriptor: PDF y verificación pública salen sin médico ni matrícula
- **Severidad:** Alta · **Tipo:** contrato-body / dato
- **Front:** `medication-block.ts:917-941` arma el cuerpo de `createMedicationRequest` **sin `prescriberProfileId`** (0 apariciones en el archivo, también en `origin/dev`). El mock lo rellena con la sesión (`clinical.handlers.ts:306`) y esconde el defecto.
- **API:** `clinical/services/medications.service.ts:233` — `prescriberProfileId: dto.prescriberProfileId` sin default al actor. Consecuencias: `prescription-pdf.service.ts:506-507` y `:602-603` sólo resuelven prescriptor/matrícula si hay `prescriberProfileId` → PDF sin firma profesional y `GET /public/prescriptions/:id/verify` con `prescriberLicense: null`; `assertFirmaElPrescriptor` (`:171-184`) cae al `createdByUserId`. Además el DTO acepta **cualquier** `prescriberProfileId` sin validar que sea el actor (se puede prescribir «en nombre de» otro; la firma luego lo bloquea, pero la receta queda a nombre ajeno).
- **Modelo:** `clinical.medication_requests.prescriber_profile_id` (nullable).
- **Qué hacer:** backend — en `prescribe()` usar `dto.prescriberProfileId ?? actor.practitionerProfileId` y rechazar 403/422 si difiere del actor (salvo SUPERADMIN); front — mandar el `hpid` de la sesión (`auth` ya lo expone, ver P12 resuelto).
- **Archivos:** `clinical/services/medications.service.ts`, `medication-block.ts`.
- **Gherkin:**
  - Dado un médico con perfil profesional, cuando prescribe sin indicar prescriptor, entonces la receta queda con `prescriber_profile_id` = su perfil.
  - Dada una receta emitida, cuando se descarga el PDF, entonces muestra nombre y matrícula del prescriptor y `verify` devuelve `prescriberLicense` no nulo.
  - Dado un `prescriberProfileId` de otro profesional, cuando un médico prescribe, entonces la API responde 403.

#### CL-03 · «Otro motivo» escrito a mano en la receta da 400
- **Severidad:** Alta · **Tipo:** contrato-body / dato-inexistente-en-modelo
- **Front:** `medication-block.ts:66` (`OTRO_MOTIVO`), `:391`, `:939-941` manda `indicationText`; `clinical.types.ts:438` lo advierte.
- **API:** `clinical/dto/medication.dto.ts:12-155` — `CreateMedicationRequestDto` no declara `indicationText` → 400. Tampoco `EditMedicationRequestDraftDto`, ni `MedicationRequestItemDto` (`clinical-read.dto.ts:130-207`).
- **Modelo:** `clinical.medication_requests` no tiene `indication_text` (grep en `database/` y `src/` = 0). **P24 abierto.** El mock lo inventa (`clinical.handlers.ts:319-321`).
- **Qué hacer:** backend según P24 (`indication_text varchar(200) NULL` por el camino `.puml` → DDL → patch → entidad → DTO alta/edición/lectura → PDF; excluyente con `indicationConditionId`, gana el concepto). Front — hasta entonces ocultar la opción «Otro motivo» en `dev`.
- **Archivos:** `diagram_08_clinical.puml`, `database/SQL/08_clinical/02_tables.sql` + patch, `clinical/entities/medication_requests.entity.ts`, `clinical/dto/medication.dto.ts`, `clinical/dto/clinical-read.dto.ts`, `clinical/services/medications.service.ts`, `clinical/services/clinical-read.service.ts`, `clinical/services/prescription-pdf.service.ts`.
- **Gherkin:**
  - Dado «Otro motivo» con texto, cuando se prescribe, entonces 201 y el resumen devuelve `indicationText`.
  - Dados `indicationConditionId` e `indicationText` juntos, cuando se prescribe, entonces se guarda sólo la condición.
  - Dado un texto de 201 caracteres, cuando se prescribe, entonces 400.

#### CL-04 · «Aspectos médicos» del paciente: ruta y tabla inexistentes
- **Severidad:** Alta · **Tipo:** ruta-faltante / dato-inexistente-en-modelo
- **Front:** `features/account/questionnaires/medical-aspects/medical-aspects.ts:162` (`getOwnMedicalAspects`) y `:200` (`saveOwnMedicalAspects`); cliente `clinical.client.ts:143-161`; tipos `clinical.types.ts:745-770` (`bloodType`, `allergiesText`, `chronicConditionsText`, `currentMedicationsText`, `surgeriesText`, `familyHistoryText`, `habitsText`).
- **API:** no existe (`grep medical-aspects src` = 0). Contra la API: 404 en la pestaña «Aspectos médicos».
- **Modelo:** ninguna tabla guarda una declaración de texto libre del titular. Lo más cercano ya modelado: `clinical.family_member_history`, `clinical.social_history` (hábitos), `clinical.allergy_intolerances` (con `verification_status` no confirmado), `clinical.observations` (grupo sanguíneo) y `clinical.procedures` (cirugías). El mock inventa el registro plano en `clinical.handlers.ts:144-220` (persistido en localStorage).
- **Qué hacer:** decisión de modelo (temperatura 0: no inventar): (a) nueva entidad `clinical.patient_reported_health_statements` (una fila por titular, texto libre, `row_version`, auditoría) por `.puml`; o (b) mapear cada campo a las tablas existentes marcándolas como «declarado por el paciente». Luego `GET/PUT /clinical/me/medical-aspects` resolviendo al titular por el vínculo de cuenta (sin id en la ruta), un caso de uso = una transacción. Front: nada que cambiar si se respeta el contrato actual (ausente = no tocar, `''` = borrar).
- **Archivos:** `diagram_08_clinical.puml` (o módulo que corresponda), DDL + patch, entidad, `clinical/dto/medical-aspects.dto.ts`, `clinical/services/medical-aspects.service.ts`, `clinical/controllers/clinical-medical-aspects.controller.ts`, `clinical.module.ts`.
- **Gherkin:**
  - Dado un paciente sin declaración, cuando hace `GET /clinical/me/medical-aspects`, entonces 200 con `{}`.
  - Dado `PUT` con sólo `habitsText`, cuando se guarda, entonces los demás campos no cambian y `updatedAt` se actualiza.
  - Dado un usuario sin perfil de paciente, cuando llama a la ruta, entonces 403.

#### CL-05 · Adjuntos de receta, alergia y encuentro: 404 / 400
- **Severidad:** Alta · **Tipo:** ruta-faltante / contrato-body
- **Front:** `clinical.client.ts:478-494`; `medication-block.ts:411`; `allergy-block.ts:198`; `patient-chart.ts:1154-1182` — receta y alergia ligan por rutas propias; el encuentro cae al genérico `POST /common/files/:id/links` con `ownerType: 'ENCOUNTER'`, y el listado usa `ownerType` `MEDICATION_REQUEST`/`ALLERGY_INTOLERANCE`/`ENCOUNTER`.
- **API:** no existen `medication-requests/:id/attachments` ni `allergy-intolerances/:id/attachments` (controller `clinical-records.controller.ts` sólo tiene `conditions/:id/attachments` `:108` y `procedures/:id/attachments` `:248`) → 404. `common/dto/enums.ts:8-16` `OwnerType` = USER, PATIENT, TENANT, CONDITION, PROCEDURE; `common/dto/files.dto.ts:199` (`CreateFileLinkDto`) y `:479-482` (`ListFileLinksQueryDto`) validan `@IsEnum(OwnerType)` → **400** para ENCOUNTER y para listar adjuntos de receta/alergia.
- **Modelo:** `common.file_links.owner_type_concept_id` (FK a terminología; no toca `.puml`). **P25 abierto** (y P25 no menciona que el listado también falla).
- **Qué hacer:** backend según P25 — conceptos `OWNER_MEDICATION_REQUEST`, `OWNER_ALLERGY_INTOLERANCE`, `OWNER_ENCOUNTER`, tres valores en `OwnerType`, dos rutas `:id/attachments` calcadas de `procedures.service.ts` (con `assertPuedeEscribirHistoria`), y una tercera para encuentros en vez del genérico.
- **Archivos:** `common/dto/enums.ts`, `common/constants/concepts.ts`, `clinical/controllers/clinical-records.controller.ts`, `clinical/controllers/clinical-encounters.controller.ts`, `clinical/services/medications.service.ts`, `clinical/services/allergy-intolerances.service.ts`, `clinical/services/encounters.service.ts`; front `patient-chart.ts` (dejar de usar el genérico para encuentros).
- **Gherkin:**
  - Dada una receta existente y un archivo subido, cuando se hace `POST /clinical/medication-requests/:id/attachments`, entonces 201 y `GET /common/files/links?ownerType=MEDICATION_REQUEST&ownerId=:id` lo lista.
  - Dada una receta inexistente, cuando se adjunta, entonces 404.
  - Dado un médico sin acceso al paciente, cuando adjunta a su alergia, entonces 403.

#### CL-06 · El QR de la receta lleva a una página que no existe
- **Severidad:** Alta · **Tipo:** ruta-faltante (front)
- **Front:** no hay ruta `verify/rx/:id` en `app.routes.ts` (sólo `verify/portability/:manifestHash`, `:1910`), ni en `origin/dev`; tampoco hay cliente para `GET /public/prescriptions/:id/verify`. El mock sí sirve el endpoint (`clinical.handlers.ts:375-389`) sin consumidor.
- **API:** `clinical/services/prescription-pdf.service.ts:535` — `qrUrl = ${webAppBaseUrl}/verify/rx/${request.id}`; endpoint público `clinical/controllers/clinical-prescriptions-public.controller.ts:46` (`@Public`, sin PHI, `{id,status,issuedAt,contentHash,prescriberLicense}` — `prescription-pdf.service.ts:174-180`).
- **Modelo:** `clinical.medication_requests` (estado, `issued_at`), matrícula en `profiles.jurisdiction_authorizations`.
- **Qué hacer:** front — página pública `features/public-prescription-verify/` en `verify/rx/:id` (sin sesión, SSR-safe) + `PublicPrescriptionsClient.verify(id)`; la forma del mock debe calcar `PrescriptionVerificationResult` (hoy devuelve `status: 'ISSUED'|'DRAFT'`; confirmar contra `PrescriptionStatusLabel`).
- **Archivos:** `app.routes.ts`, `core/data-access/public/prescriptions.client.ts` (nuevo), `features/public-prescription-verify/*` (nuevo).
- **Gherkin:**
  - Dada una receta emitida, cuando alguien escanea el QR, entonces ve «Receta válida», fecha de emisión, sello y matrícula, sin datos del paciente.
  - Dada una receta invalidada, cuando se abre el enlace, entonces ve «Sin validez».
  - Dado un id inexistente, cuando se abre el enlace, entonces ve «Receta no encontrada» (404 de la API).

#### CL-07 · Escrituras sobre un encuentro cerrado rompen su sello SHA-256
- **Severidad:** Alta · **Tipo:** invariante
- **Front:** `diagnosis-block.ts:252,445,484` (y los bloques de receta `medication-block.ts:570`, alergia, observación, plan) permiten elegir una «cita ya existente y/o finalizada» como `encounterId`; `patient-chart.ts:1441` cambia el estado clínico de cualquier condición.
- **API:** al cerrar, `encounters.service.ts:319-320` calcula `contentHash`/`sealedAt` sobre condiciones (`clinicalStatusConceptId`, `verificationStatusConceptId`), recetas (`rowVersion`), planes y documentos (`encounter-seal.payload.ts`). Ningún servicio rechaza después altas con ese `encounterId` ni cambios de estado/firma/emisión de lo sellado (`grep ENCOUNTER_FINISHED|sealedAt` sólo aparece en `encounters.service.ts` y `chart/services/encounter-pdf.service.ts`). El sello queda desactualizado en silencio.
- **Modelo:** `clinical.encounters.content_hash`, `sealed_at` (patch `2026-09-16_v4216_encounters_content_hash.sql`).
- **Qué hacer:** decidir la regla (sin confirmar cuál quiere producto): (a) 422 al escribir con `encounterId` de un encuentro FINISHED/sellado, o (b) permitir «addendum» con un nuevo sello versionado (append-only) en vez de mutar el existente. En ambos casos, el front debe dejar de ofrecer encuentros finalizados como destino o avisarlo como addendum.
- **Archivos:** `clinical/services/conditions.service.ts`, `medications.service.ts`, `observations.service.ts`, `allergy-intolerances.service.ts`, `chart/services/*` (notas/planes/documentos), posible tabla de addenda por `.puml`; front `diagnosis-block.ts`, `medication-block.ts`.
- **Gherkin:**
  - Dado un encuentro cerrado y sellado, cuando se registra un diagnóstico con su `encounterId`, entonces la API responde 422 (o crea un addendum con sello nuevo, según la regla elegida) y el hash original no cambia.
  - Dada una condición incluida en un sello, cuando se cambia su estado clínico, entonces la verificación del sello sigue coincidiendo con el contenido sellado.

#### CL-08 · Check-in y apertura de internación sin control de acceso por paciente
- **Severidad:** Alta · **Tipo:** autorización
- **Front:** `consultation/consultation.ts:665-671`, `admission-block.ts:261-270`.
- **API:** `clinical/controllers/clinical-encounters.controller.ts:49-97` — `@Roles('CLINICIAN','PRACTITIONER')` y **sin `ClinicalRecordAccessGuard`**; `care-episodes.service.ts:30-90` y `encounters.service.ts` `checkIn` no llaman `assertPuedeEscribirHistoria` (sólo `close` lo hace, `:269`). Cualquier clínico puede abrir encuentros/internaciones de cualquier paciente, en el `tenantId` que mande en el cuerpo (validación de pertenencia al tenant: sin confirmar).
- **Modelo:** `clinical.encounters`, `clinical.care_episodes`.
- **Qué hacer:** backend — `@UseGuards(ClinicalRecordAccessGuard)` en `care-episodes` y `encounters/check-in` (el guard ya lee `patientProfileId` del cuerpo) + validar que `tenantId` sea un tenant del actor. El mock (`puedeLeer`, `clinical.handlers.ts:43-51`) tampoco lo modela.
- **Archivos:** `clinical/controllers/clinical-encounters.controller.ts`, `clinical/services/care-episodes.service.ts`, `clinical/services/encounters.service.ts`.
- **Gherkin:**
  - Dado un médico sin turno hoy ni relación asistencial con el paciente, cuando hace check-in, entonces 403.
  - Dado un médico con turno hoy, cuando abre la internación, entonces 201.
  - Dado un `tenantId` al que el actor no pertenece, cuando hace check-in, entonces 403.

#### CL-09 · `POST /cds/check-interactions` abierto a cualquier rol y escribe alertas en cada intento
- **Severidad:** Media · **Tipo:** autorización / invariante
- **Front:** `medication-block.ts:1066-1100` (antes de prescribir; falla abierto).
- **API:** `clinical_ext/controllers/cds.controller.ts:31,89-99` — sin `@Roles` ni guard de paciente; `cds.service.ts:250-281` crea filas en `clinical_ext.clinical_alerts` (`alertsRepo.create`, `:263`) aunque la receta después se cancele. Un PATIENT autenticado puede generar alertas sobre otro paciente.
- **Modelo:** `clinical_ext.clinical_alerts`, `clinical_ext.drug_interactions`. Datos: 5 interacciones y 17 medicamentos del vademécum de desarrollo (`REGISTRO-DEFECTOS.md` B-13, `MANTRA_DEV_VADEMECUM`). El mock inventa la regla `DDI-0042` y alerta con **cualquier** par de sustancias (`clinical.handlers.ts:584-591`) → la demo en `mockup` muestra interacciones que la API real no daría.
- **Qué hacer:** backend — `@Roles('CLINICIAN','PRACTITIONER')` + `ClinicalRecordAccessGuard`; decidir si el chequeo previo persiste alertas o sólo las calcula (p. ej. persistir al prescribir). Mock — alertar sólo con pares de un fixture calcado de las 5 interacciones sembradas.
- **Archivos:** `clinical_ext/controllers/cds.controller.ts`, `clinical_ext/services/cds.service.ts`, `core/mock/handlers/clinical.handlers.ts`.
- **Gherkin:**
  - Dado un usuario PATIENT, cuando llama a `/cds/check-interactions`, entonces 403.
  - Dado un par sin interacción registrada, cuando se chequea, entonces `count: 0` y no se crea ninguna fila de alerta.

#### CL-10 · El motivo del cambio de estado clínico no se guarda
- **Severidad:** Media · **Tipo:** invariante
- **Front:** `patient-chart.ts:1418-1441` — el diálogo dice «El motivo queda en la historia clínica» y lo exige.
- **API:** `clinical/dto/condition.dto.ts:136-142` `reasonText` `@IsString()` sin `@IsNotEmpty`/`@MaxLength` (acepta `''`); `conditions.service.ts:264-345` sólo lo **loguea** (`:338`); el snapshot de historia (`historyRepo.append`) es de la condición, sin el motivo. No hay columna para él.
- **Modelo:** `clinical.conditions` (sin `status_reason_text`, a diferencia de `medication_requests.status_reason_text`); historia en `audit.*_history`.
- **Qué hacer:** backend — persistir el motivo (columna `status_reason_text` por `.puml`, o en el registro de historia/auditoría inmutable) y `@IsNotEmpty() @MaxLength(500)`; devolverlo en la lectura de la condición si la pantalla lo muestra.
- **Archivos:** `diagram_08_clinical.puml` + DDL/patch, `clinical/entities/conditions.entity.ts`, `clinical/dto/condition.dto.ts`, `clinical/services/conditions.service.ts`.
- **Gherkin:**
  - Dado un cambio ACTIVE→INACTIVE con motivo, cuando se aplica, entonces el motivo queda recuperable en la historia de la condición.
  - Dado `reasonText: ''`, cuando se envía, entonces 400.

#### CL-11 · La lectura del resumen no trae lo que la pantalla muestra
- **Severidad:** Media · **Tipo:** contrato-respuesta
- **Front:** `clinical.types.ts:65` afirma «El backend lo devuelve» para `MedicationRequest.encounterId`; `patient-chart.ts:508-517` lo usa para «Receta de»/vínculo «Encuentro». El mock devuelve la fila entera (incluye `encounterId`, `reactions`, `lateralityConceptId`, `indicationText`).
- **API:** `clinical-read.dto.ts:130-207` (`MedicationRequestItemDto`) y `clinical-read.service.ts:624-643` **no** proyectan `encounterId` (la columna existe); `AllergyItemDto` (`:85-126`) sin reacciones; `ConditionItemDto` (`:4-81`) sin `lateralityConceptId` (la columna existe).
- **Modelo:** `clinical.medication_requests.encounter_id`, `clinical.allergy_reactions.*`, `clinical.conditions.laterality_concept_id`.
- **Qué hacer:** backend — agregar `encounterId` a `MedicationRequestItemDto` (aditivo, trivial), `lateralityConceptId` a `ConditionItemDto` y `reactions[]` a `AllergyItemDto`; front — corregir el comentario y tolerar ausencia hasta el despliegue.
- **Archivos:** `clinical/dto/clinical-read.dto.ts`, `clinical/services/clinical-read.service.ts`, front `clinical.types.ts`.
- **Gherkin:**
  - Dada una receta creada en un encuentro, cuando se lee el resumen, entonces la receta trae `encounterId` y la tabla muestra «Receta de <consulta>».
  - Dada una alergia con dos reacciones, cuando se lee el resumen, entonces trae ambas manifestaciones.

#### CL-12 · El simulador no reproduce la máquina de estados de receta (D-05), condición ni encuentro
- **Severidad:** Media · **Tipo:** otro (fidelidad del mock) / contrato-respuesta
- **Front/mock:** `clinical.handlers.ts:330-340` — `sign` pone `RX-ACTIVE` (la API deja DRAFT hasta emitir), `issue` emite **sin firma** y sin exigir DRAFT (la API responde 422 con política D-05, `medications.service.ts:386-424`); por eso el aviso `recetaSinFirma` (`medication-block.ts:1037-1043`) nunca aparece en la maqueta. `:422-431` `change-status` acepta cualquier transición y no rechaza «resolver crónica» (API `conditions.service.ts:42-67,280-301`) ni exige motivo. `:274-297` check-in sin 409 por cita finalizada y cierre doble sin 422 (API `encounters.service.ts:206-215,275-280`). `:258-272` sin 409 por episodio activo (API `care-episodes.service.ts:48-57`). Estados devueltos como literales (`'DRAFT'`, `'ACTIVE'`, `'IN_PROGRESS'`, `'FINISHED'`, `'PROVISIONAL'`, `'FINAL'`) cuando la API devuelve uuids de concepto; la condición nace `PROVISIONAL` en el mock y `CONFIRMED` en la API (`conditions.service.ts:207-208`); la alergia usa el estado de **condición** (`ESTADO_CONDICION['COND-ACTIVE']`, `:484`) en vez de `ALLERGY_ACTIVE`.
- **API:** referencias citadas.
- **Modelo:** `clinical.prescription_signature_policies` (27 políticas comodín sembradas).
- **Qué hacer:** mock — replicar guardas (DRAFT-only en sign/issue, 422 `PRECONDITION_FAILED` sin firma, tabla de transiciones de condición, 409/422 de encuentro y episodio) y devolver uuids de concepto. No toca la API.
- **Archivos:** `core/mock/handlers/clinical.handlers.ts`, `core/mock/fixtures/conceptos.ts`, specs `clinical.handlers.spec.ts`.
- **Gherkin:**
  - Dada una receta sin firmar en la maqueta, cuando se emite, entonces responde 422 `PRECONDITION_FAILED` y la pantalla ofrece «Firmar».
  - Dada una condición crónica activa, cuando se la pasa a resuelta, entonces 422.
  - Dado un encuentro cerrado, cuando se cierra otra vez, entonces 422.

#### CL-13 · El mock deja leer cualquier historia; la API exige atención en curso/hoy o relación asistencial
- **Severidad:** Media · **Tipo:** autorización / otro
- **Front:** `clinical.handlers.ts:43-51` (`puedeLeer` → `true` para cualquier practicante). `features/progress-notes/progress-notes.ts:335` abre `getChart` de atenciones de días anteriores.
- **API:** `clinical-read.service.ts:186-230` + `estaAtendiendo` `:365-388` (consulta en curso, turno hoy o `care_relationships` vigente; las relaciones sólo nacen por el flujo `authz/care-relationships/request|respond`, no al reservar). Contra la API, una evolución de un paciente de la semana pasada sin relación vigente → **403**.
- **Modelo:** `authz.care_relationships`, `scheduling.bookings`.
- **Qué hacer:** decisión de producto (sin confirmar): crear relación asistencial vigente al completar una atención, o dejar que el médico lea las notas **que él escribió** aunque no haya relación. Mock — reproducir la regla para que la demo muestre el 403/S5 real.
- **Archivos:** `clinical/services/clinical-read.service.ts` o `scheduling` (alta de relación), `core/mock/handlers/clinical.handlers.ts`.
- **Gherkin:**
  - Dado un médico que atendió al paciente hace 5 días sin relación vigente, cuando abre su evolución, entonces ve el estado «sin acceso» con próxima acción (o la ve, según la regla elegida), igual en mock y API.
  - Dado un médico con turno hoy, cuando abre el expediente, entonces 200.

#### CL-14 · Corregir una receta emitida: la API lo permite, el front no lo ofrece
- **Severidad:** Media · **Tipo:** otro (ruta existe sin cliente)
- **Front:** `medication-block.ts:1011` — «para corregirla hay que invalidarla o reemplazarla», pero `ClinicalClient` no tiene `edit`, `invalidate`, `replace`, `renew` ni `medication-records`.
- **API:** `clinical-records.controller.ts:144,156,191,203,217` (`medication-records`, `:id/edit`, `:id/invalidate`, `:id/replace`, `:id/renew`); DTOs `medication.dto.ts:158-527`. Versionado inmutable correcto en el servidor (`replaces_request_id`/`replaced_by_request_id`/`renewed_from_request_id`, historia sellada).
- **Modelo:** `clinical.medication_requests` (vínculos de corrección, `status_reason_text`), `clinical.medication_records`.
- **Qué hacer:** front — métodos en `ClinicalClient` + acciones «Editar borrador», «Invalidar» (motivo obligatorio), «Reemplazar», «Renovar» en el bloque de medicación; mock con las mismas guardas.
- **Archivos:** `clinical.client.ts`, `clinical.types.ts`, `medication-block.ts/html`, `clinical.handlers.ts`.
- **Gherkin:**
  - Dada una receta emitida, cuando el prescriptor la reemplaza con motivo, entonces la original queda REPLACED con `replacedByRequestId` y la nueva nace en DRAFT con `replacesRequestId`.
  - Dada una receta emitida, cuando se intenta editar, entonces 422.

#### CL-15 · Emitir sin `Idempotency-Key`: un reintento se lee como «estado viejo»
- **Severidad:** Baja · **Tipo:** contrato-body (cabecera)
- **Front:** `clinical.client.ts:327-336` no manda cabecera; `medication-block.ts:1030-1044`.
- **API:** `clinical-records.controller.ts:179-189` (`@Headers('idempotency-key')`), `medications.service.ts:379-409` (replay idempotente; sin clave, el reintento da 422 «Solo un borrador puede emitirse»). Columna `clinical.medication_requests.issue_idempotency_key` (UNIQUE parcial v4.0.9).
- **Qué hacer:** front — generar un uuid por intento de emisión (reusado en reintentos) y mandarlo en `Idempotency-Key`.
- **Gherkin:**
  - Dada una emisión cuya respuesta se perdió, cuando se reintenta con la misma clave, entonces 200 con la misma receta emitida.

#### CL-16 · Bloqueo optimista y enmienda de observaciones sin usar
- **Severidad:** Baja · **Tipo:** otro
- **Front:** `consultation.ts:706` cierra sin `expectedRowVersion` (el cliente lo admite, `clinical.client.ts:247-257`); no existe cliente para `PATCH /clinical/observations/:id/amend` (`clinical-observations.controller.ts:56`, `AmendObservationDto` `observation.dto.ts:343-371`) aunque `ObservationRegistration.rowVersion` se trae para eso.
- **Qué hacer:** front — pasar `rowVersion` del encuentro leído (la lectura del resumen no lo trae: agregar `rowVersion` a `EncounterItemDto`, backend) y exponer la enmienda con nota obligatoria.
- **Gherkin:**
  - Dado un encuentro modificado por otra sesión, cuando se cierra con la versión vieja, entonces 409 y la pantalla pide recargar.

#### CL-17 · Recetas favoritas: API y mock sin cliente ni pantalla
- **Severidad:** Baja · **Tipo:** otro
- **Front:** no hay cliente; sólo el mock `misc.handlers.ts:384-418`, que además muestra a **cualquier** practicante las favoritas de la médica del fixture (`:388`).
- **API:** `clinical_ext/controllers/prescription-favorites.controller.ts:43,57,68` (`GET/POST/DELETE /prescription-favorites`, sin `@Roles`, filtra por perfil del vínculo); DTO `prescription-favorite.dto.ts:12-163` coincide con los campos del mock (`quantityDecimal` sale como string en ambos).
- **Modelo:** `clinical_ext.prescription_favorites` (patch `2026-08-21_v417_prescription_favorites.sql`).
- **Qué hacer:** front — `PrescriptionFavoritesClient` + «Guardar como favorita / usar favorita» en el bloque de medicación; mock filtrar sólo por `userId` del actor.
- **Gherkin:**
  - Dado un médico con una favorita, cuando abre «Usar favorita», entonces el formulario se completa con medicamento, dosis, vía y frecuencia.
  - Dado otro médico, cuando lista favoritas, entonces no ve las ajenas.

#### CL-18 · Evoluciones: no hay lectura de notas por profesional (P18) — la fila se estima por fecha
- **Severidad:** Media · **Tipo:** ruta-faltante
- **Front:** `progress-notes.ts:335` (una lectura de expediente por clic) y filtro por día calendario (`:420`, `:498-499`).
- **API:** `chart` no expone `GET /charts/notes` (grep en `chart/controllers` = 0); la reserva no trae `encounterId`.
- **Modelo:** `chart.clinical_notes` / versiones con `encounter_id`; `clinical.encounters.appointment_id`.
- **Qué hacer:** backend — `GET /charts/notes?practitionerId&from&to` (última versión por nota, con `encounterId`) y `encounterId` en la lectura de reservas. **P18 abierto.**
- **Gherkin:**
  - Dadas dos atenciones del mismo paciente el mismo día, cuando se abre cada una en Evoluciones, entonces cada una muestra sólo sus notas.

#### CL-19 · Política de firma D-05 sin superficie de administración
- **Severidad:** Baja · **Tipo:** otro
- **Front:** ningún cliente usa `/clinical/prescription-signature-policies`.
- **API:** `clinical-prescription-policies.controller.ts:27-77` (`POST`, `GET`, `POST :id/deactivate`; roles `CLINICIAN`,`SECURITY_ADMIN`). Hoy la regla depende de las 27 políticas comodín sembradas.
- **Qué hacer:** front — pantalla admin del tenant para ver/crear/desactivar la política (quién exige firma, por tipo de medicamento/canal/jurisdicción).
- **Gherkin:**
  - Dado un admin de seguridad, cuando desactiva la política del tenant, entonces emitir sin firmar responde 200.

---

### Estado de los pendientes documentados (dominio clínico núcleo), verificado contra `dev`

| Ítem | Doc | Estado hoy | Evidencia |
|---|---|---|---|
| P24 `indication_text` | PENDIENTES-BACKEND.md:486 | **Abierto** | `medication.dto.ts` sin la clave; `grep indication_text database src` = 0 → CL-03 |
| P25 adjuntos receta/alergia | PENDIENTES-BACKEND.md:430 | **Abierto** (+ ENCOUNTER no contemplado) | `common/dto/enums.ts:8-16`; sin rutas → CL-05 |
| P26 `encounter_id` + catálogos de alergia | PENDIENTES-BACKEND.md:372 | **Abierto** | `allergy.dto.ts`, DDL sin columna → CL-01 (catálogos: sin confirmar, no revisado `dynamic-enum-catalog.ts`) |
| P18 lectura de notas | PENDIENTES-BACKEND.md:890 / PLAN-EVOLUCIONES:29 | **Abierto** | sin `GET /charts/notes` → CL-18 |
| P11 encuentro↔turno / P12 perfil en sesión | PENDIENTES-BACKEND.md:1108,1125 | Cerrados | `CheckInEncounterDto.appointmentId`, `primaryPractitionerId` (`encounter.dto.ts:125-138`) |
| PLAN-EVOLUCIONES fases 1–5 | PLAN-EVOLUCIONES:5 | Cerradas (front) | tabla de estado del plan |
| B-9 `clinical_course_concept_id` | REGISTRO-DEFECTOS.md:345 | Cerrado | columna en `database/SQL/08_clinical/02_tables.sql` (conditions) |
| B-13 vademécum dev | REGISTRO-DEFECTOS.md:101 | Cerrado (fuentes), **contenido sigue siendo dev** | afecta CL-09 |
| D-3 «el titular recibe 403 en su resumen» | memoria 2026-08-17 | Probablemente cerrado — **sin confirmar en runtime** | `assertOwnRecord` compara `perfil.profileId === link.personId` + representación (`clinical-read.service.ts:510-545`) |
| MCH-007 política de escritura por id | commit `37dc2777` | Cerrado para rutas por id | `encounters.service.ts:269` — pero NO cubre check-in/episodio → CL-08 |


---

## Parte · Parte B · Dominio chart (M15): notas versionadas, plantillas, documentos, planes de cuidado, lectura del expediente

Auditoría de solo lectura, 2026-09-24. Front `mantra-core-health` en la rama `mockup` (9b3e0101); en los archivos chart **no hay diferencias** entre `origin/dev` y `origin/mockup` (`git diff origin/dev...origin/mockup` no toca `chart-*`, `clinical.handlers.ts` /charts ni `patient-chart`). API `mantra-core-health-redesa-api` en `dev` (7541797c). ValidationPipe global con `whitelist: true, forbidNonWhitelisted: true` (`src/main.ts:160-161`), así que un campo de más devuelve 400.

### Matriz de rutas (front ↔ API)

| Método y ruta | Cliente del front | API (`src/modules/chart/controllers/`) | Body | Respuesta |
|---|---|---|---|---|
| POST /charts/notes | chart-notes.client.ts:40 | chart-notes.controller.ts:92 (+ClinicalRecordAccessGuard) | OK: el tipo del front es un subconjunto de `CreateNoteDto` | OK (`NoteVersionResponseDto`) |
| PUT /charts/notes/:noteId/versions | chart-notes.client.ts:51-58 | chart-notes.controller.ts:106 | OK (`AddVersionDto`) | OK |
| POST /charts/notes/:id/versions (solo en el mock) | ninguno | **no existe** | – | – |
| GET /charts/patients/:id/chart | clinical.client.ts:199 | chart-read.controller.ts:51 | – | Casi: el front descarta `documents[].files` (CL-27) |
| POST /charts/care-plans | chart-care-plans.client.ts:47 | chart-care-plans.controller.ts:43 | OK (fechas como `YYYY-MM-DD`) | OK |
| POST /charts/documents | chart-documents.client.ts:40 | chart-documents.controller.ts:49 | OK | OK |
| GET /charts/templates(?specialtyId) | chart-templates.client.ts:41 | chart-templates.controller.ts:83 | – | El front espera campos que la API no emite (CL-24) |
| GET /charts/templates/:id | chart-templates.client.ts:46 | chart-templates.controller.ts:98 | – | Igual que la anterior |
| POST /charts/templates | chart-templates.client.ts:51 (ninguna pantalla lo llama) | chart-templates.controller.ts:61 (SECURITY_ADMIN) | OK | OK |
| POST /charts/templates/:id/assignments | chart-templates.client.ts:67 | chart-templates.controller.ts:48 (SECURITY_ADMIN) | OK | OK |

Rutas que la API tiene y **ningún cliente del front usa**:
- `GET /charts/notes` (lista por profesional y por fechas, commit f361b42f)
- `POST /charts/notes/:noteId/versions/:versionId/sign`
- `POST /charts/notes/:noteId/versions/:versionId/cosign`
- `POST /charts/notes/:noteId/amendments`
- `POST /charts/notes/versions/:versionId/release`
- `POST /charts/notes/versions/:versionId/withhold`
- `POST /charts/notes/versions/:versionId/exam-findings`
- `PATCH /charts/care-plans/:planId/activities/:activityId`
- `GET /charts/documents/:documentId/files/:fileId/content`
- `GET /charts/encounters/:id/pdf`

---

#### CL-20 · El front no firma las notas clínicas: toda evolución queda en BORRADOR para siempre
- **Severidad:** Alta (Bloqueante demo si la demo muestra «nota firmada» o «visible para el paciente» contra la API real).
- **Tipo:** invariante / ruta sin consumir.
- **Front:** `features/clinical-record/patient-chart/free-note-block/free-note-block.ts:54-57` lo reconoce: «No firma ni exporta a PDF». `persistir()` (189-205) solo llama a `createNote` y `appendVersion`. `chart-notes.client.ts` no tiene `sign`, `amend`, `release` ni `withhold`.
- **API:** existe todo: `chart-notes.controller.ts:120` (sign), `:133` (cosign), `:146` (amendments), `:158` (release), `:170` (withhold). `chart-notes.service.ts:149-154` rechaza versionar lo que no está en DRAFT.
- **Mock que lo disimula:** `core/mock/fixtures/clinica.ts:357-367` siembra por paciente una nota «completa», firmada (`signedAt`) y `releasedToPatient: true`. Contra la API real ese estado **no se puede alcanzar desde el front**. La pantalla (`patient-chart.ts:589-593`) muestra «Visible para la persona» solo con datos del mock.
- **Modelo:** `chart.clinical_note_versions` (status_concept_id, signed_by_profile_id, signed_at, content_hash), `chart.clinical_note_signatures <<IMMUTABLE>>`, `chart.note_release_events <<LOG>>`, `clinical_note_headers.current_released_version_id` y `patient_release_status_concept_id`.
- **Qué hacer:**
  - Front: agregar `signVersion`, `amendNote`, `releaseVersion` y `withholdVersion` a `ChartNotesClient`, con el botón «Firmar» en el bloque de nota. Una nota firmada se deja de versionar: se enmienda con motivo obligatorio (`amendmentReasonText`).
  - Mock: emular esas 4 rutas y hacer que la nota sembrada firmada nazca del mismo flujo.
- **Archivos:**
  - `core/data-access/chart-notes/chart-notes.client.ts` y `chart-notes.types.ts`
  - `features/clinical-record/patient-chart/free-note-block/*`
  - `core/mock/handlers/clinical.handlers.ts` (bloque «notas clínicas»)
- **Gherkin:**
  - Dado un borrador de nota del médico, cuando pulsa «Firmar», entonces se llama `POST /charts/notes/:id/versions/:vid/sign` con `signerProfileId` = su perfil y la nota pasa a SIGNED.
  - Dada una nota firmada, cuando el médico intenta editarla, entonces el front ofrece «Enmendar», que exige un motivo, y no hace `PUT …/versions`.
  - Dada una nota firmada y liberada, cuando se relee el expediente, entonces `releasedToPatient` es `true`, venga del mock o de la API real.

#### CL-21 · El mock deja versionar una nota firmada y deja cambiar cualquier campo con la versión nueva
- **Severidad:** Media.
- **Tipo:** invariante (el mock contradice a la API).
- **Front (mock):** `core/mock/handlers/clinical.handlers.ts:627-644`. `agregarVersion` hace `notas.actualizar(n.noteId, {...datos, …})` con `datos: Partial<NotaSimulada>`:
  - no comprueba `lifecycleStatusConceptId === DRAFT`;
  - acepta cualquier clave del body: `patientProfileId`, `signedAt`, `releasedToPatient`… Puede **mover la nota de paciente**, que es justo lo que `AddVersionDto` impide;
  - con la API real esas claves de más dan 400.
- **API:** `chart-notes.service.ts:149-154` responde 422 (`PreconditionFailedException`) si la nota no está en borrador, y `AddVersionDto` (`dto/notes.dto.ts:121-169`) solo admite el autor y los 5 textos SOAP.
- **Modelo:** `clinical_note_versions <<IMMUTABLE>>`; `uq_clinical_note_versions_clinical_note_id_version_number`.
- **Qué hacer (mock):**
  - quedarse solo con las claves de `AddVersionDto` y responder 400 si llega otra;
  - responder 422 si la nota no está en DRAFT;
  - guardar las versiones anteriores en lugar de pisarlas.
- **Archivos:** `core/mock/handlers/clinical.handlers.ts`, `core/mock/handlers/clinical.handlers.spec.ts`.
- **Gherkin:**
  - Dada una nota firmada en el mock, cuando llega `PUT /charts/notes/:id/versions`, entonces responde 422 «use una enmienda».
  - Dado un body con `patientProfileId`, cuando llega `PUT …/versions`, entonces el mock responde 400, igual que la API.

#### CL-22 · La ruta `POST /charts/notes/:id/versions` existe solo en el mock
- **Severidad:** Baja.
- **Tipo:** ruta-faltante (del lado del mock: está de más).
- **Front:** `clinical.handlers.ts:644` (`router.post('/charts/notes/:id/versions', agregarVersion)`, «por si alguna pantalla vieja lo usa»). El cliente usa PUT (`chart-notes.client.ts:55`). No encontré ningún llamador de POST.
- **API:** no existe; solo `@Put(':noteId/versions')` (`chart-notes.controller.ts:106`). Contra la API real sería un 404.
- **Qué hacer:** borrar la ruta POST del mock, para que una pantalla que la use falle igual en el mock que en la API.
- **Archivos:** `core/mock/handlers/clinical.handlers.ts:644`.
- **Gherkin:**
  - Dado el mock, cuando alguien hace `POST /charts/notes/:id/versions`, entonces recibe 404, igual que la API.
  - Dado el inventario `mock-missing.json`, cuando se regenera, entonces esa ruta ya no aparece.

#### CL-23 · P18 ya está cerrado en la API y el front sigue estimando las evoluciones por fecha
- **Severidad:** Media.
- **Tipo:** otro (pendiente cerrado en el back, sin adoptar en el front; documentación desactualizada).
- **Front:**
  - `features/progress-notes/progress-notes.ts:117-128` dice que «no existe `GET /charts/notes?practitionerId&from&to`»; la lista sale de `GET /scheduling/bookings` y las notas de cada fila se leen desde `GET /charts/patients/:id/chart`, emparejadas **por día calendario** (dos atenciones del mismo paciente el mismo día muestran las mismas notas).
  - `shared/utils/progress-notes-pdf/progress-notes-pdf.ts:15-21`: el PDF de Evoluciones «no trae el texto de las evoluciones».
  - `PENDIENTES-BACKEND.md:890-911` (P18) sigue «Abierto».
  - `PLAN-EVOLUCIONES-Y-ATENCION.md:19-22` descarta el handler mock «del endpoint que no existe».
- **API:** `GET /charts/notes` existe (`chart-notes.controller.ts:73-89`, commit f361b42f):
  - query `ListChartNotesQueryDto` (`practitionerId`, `patientProfileId`, `from`, `to`, `cursor`, `limit` ≤ 100), definida en `dto/notes.dto.ts:469-517`;
  - responde `{items[] (con patientProfileId y encounterId), count, limit, nextCursor}`;
  - acotado al profesional de la sesión (403 si pide las notas de otro y no es SUPERADMIN).
- **Modelo:** `chart.clinical_note_headers` (encounter_id), `clinical_note_versions`. El vínculo encuentro↔reserva lo resolvió P11 («Resuelto»).
- **Qué hacer:**
  - Front: agregar `listNotes()` a `ChartNotesClient`; que Evoluciones y su PDF se alimenten de ahí, emparejando por `encounterId` y no por fecha; incluir el texto de la nota en el PDF.
  - Mock: agregar `GET /charts/notes` con paginado por cursor.
  - Docs: mover P18 a «Resuelto» con la cita del commit.
- **Archivos:**
  - `core/data-access/chart-notes/chart-notes.client.ts` y `chart-notes.types.ts`
  - `features/progress-notes/progress-notes.ts`
  - `shared/utils/progress-notes-pdf/progress-notes-pdf.ts`
  - `core/mock/handlers/clinical.handlers.ts`
  - `PENDIENTES-BACKEND.md`, `PLAN-EVOLUCIONES-Y-ATENCION.md`
- **Gherkin:**
  - Dado un médico con 3 notas en los últimos 30 días, cuando abre Evoluciones, entonces se hace `GET /charts/notes?from=…&to=…` y se ven las 3 con su texto, sin ninguna llamada por fila a `/charts/patients/:id/chart`.
  - Dadas dos atenciones del mismo paciente el mismo día, cuando se abre cada fila, entonces cada una muestra solo las notas de su `encounterId`.
  - Dado más de `limit` resultados, cuando se pide la página siguiente, entonces se envía `cursor=nextCursor`.

#### CL-24 · Las plantillas: el front espera `options`, `multiple`, `allowOther`, `rows`… y la API no los emite
- **Severidad:** Alta (los campos de selección propios del constructor de formularios pierden sus opciones contra la API real).
- **Tipo:** contrato-respuesta / dato inexistente en el modelo.
- **Front:**
  - `core/data-access/chart-templates/chart-templates.types.ts:49` (`options`), `:57` (`multiple`), `:72` (`allowOther`) y `:100` (`rows`), además de `description`, `cardinalityMin/Max`, `requireEachRow` y `oneResponsePerColumn`;
  - el mock los fabrica en `clinical.handlers.ts` (función `plantilla()`: `...(options === undefined ? {} : { options, multiple })`);
  - los usan `features/form-builder/form-builder.ts` y `specialty-form-block.ts`.
- **API:** `ChartTemplateFieldDto` (`dto/templates.dto.ts:223-282`) solo trae `assignmentId, fieldId, code, name, dataType, valueSetId?, required, ordinal?, own`. Ni `chart-templates.service.ts` ni `forms/dto/*` tienen `options`, `allowOther` ni `rows` (grep vacío).
- **Modelo:**
  - `chart.specialty_chart_templates` y `forms.*` (field_definitions/assignments) no tienen columnas de opciones;
  - la lista cerrada se modela con `value_set_id` → terminología;
  - las 43 fichas estándar sembradas (`src/common/seed/data/clinical-forms/**`) no traen ningún `options` (0 archivos), así que solo afecta a los campos propios.
- **Qué hacer:** decidir el camino del modelo; no inventar columnas.
  - (a) Front: construir las opciones desde `valueSetId` con `$expand`.
  - (b) Back: si se necesitan opciones libres por campo, promoverlas por el `.puml` → `SQL/` → ORM → DTO.
  - Esto se cruza con el fork de forms/surveys (`PATCH /forms/field-definitions`), que es quien define los campos propios.
- **Archivos:** `chart-templates.types.ts`, `form-builder.ts`, `specialty-form-block.ts`, API `dto/templates.dto.ts` y `services/chart-templates.service.ts` (si se elige b).
- **Gherkin:**
  - Dado un campo propio de selección creado en el constructor, cuando se lee `GET /charts/templates/:id` en la API real, entonces el campo trae su catálogo (vía `valueSetId` o `options`) y el médico lo ve como desplegable.
  - Dado un campo sin catálogo, cuando se dibuja, entonces el front no ofrece una lista vacía.

#### CL-25 · Tres catálogos que el mock inventa: intención y actividad del plan de cuidados, y categoría documental
- **Severidad:** Alta (contra la API real los tres selectores quedan vacíos o caen en error).
- **Tipo:** dato-inexistente-en-modelo.
- **Front:**
  - `care-plan-block.ts:34` (`chart.care_plans.intent_concept_id`) y `:37` (`chart.care_plan_activities.activity_concept_id`);
  - `document-block.ts:47` (`chart.document_records.category_concept_id`);
  - `concept-select.ts:142-159` pide `GET /system-context/dynamic-enums?target=…` y, si falla, esconde las opciones;
  - el mock contesta con value sets propios: `core/mock/handlers/misc.handlers.ts:89-91` (`VS_CARE_PLAN_INTENT`, `VS_CARE_PLAN_ACTIVITY`, `VS_DOCUMENT_CATEGORY`) y `fixtures/conceptos.ts:764-775`.
- **API:**
  - `src/common/seed/dynamic-enum-catalog.ts` solo declara targets `chart.*` para `clinical_note_headers` (líneas 1229, 1242, 1255);
  - `grep` de esos 3 VS en API, bóveda y seeds: **0 resultados**;
  - con un target desconocido, `dynamic-enums.service` lanza `ResourceNotFoundException` (según sus specs).
  - La API sí usa conceptos por defecto (`CHART.CAREPLAN_INTENT_PLAN` = `CP_INTENT_PLAN`, `CHART.ACTIVITY_DEFAULT` = `CPACT_GENERAL`, `CHART.DOC_CATEGORY_GENERAL` en `chart.concepts.ts:105-114`), pero no expone catálogo.
- **Modelo:** `care_plans.intent_concept_id`, `care_plan_activities.activity_concept_id` (NOT NULL) y `document_records.category_concept_id` (NOT NULL), en `diagram_15_chart.puml:111,126,142`.
- **Qué hacer:**
  - Back: declarar los 3 value sets en la bóveda (`VS_OWNER`) y los bindings de dynamic-enum, y sembrarlos con `gen_seeds.py`, por el camino canónico.
  - Mock: dejar de inventar códigos (`CP-ACT-*`, `DOC-CAT-*`) o marcarlos «provisionales», como P26.
- **Archivos:**
  - API: `src/common/seed/dynamic-enum-catalog.ts`, `chart.concepts.ts`
  - bóveda: `SALUD/…` notas de value set
  - `salud-db/gen_seeds.py`
  - front: `core/mock/handlers/misc.handlers.ts`, `core/mock/fixtures/conceptos.ts`
- **Gherkin:**
  - Dada la API real, cuando se abre «Nuevo plan de cuidados», entonces `GET /system-context/dynamic-enums?target=chart.care_plan_activities.activity_concept_id` responde 200 con al menos 1 opción.
  - Dado un documento sin categoría elegida, cuando se registra, entonces queda con `CHART.DOC_CATEGORY_GENERAL` y la pantalla lo etiqueta con su nombre legible.

#### CL-26 · La clase de actividad del plan se escribe y nunca se vuelve a leer
- **Severidad:** Media.
- **Tipo:** contrato-respuesta.
- **Front:** `care-plan-block.ts:251` envía `activityConceptId`. `CarePlanActivity` (`core/data-access/clinical/clinical.types.ts:307-313`) no lo tiene, y el mock sí lo devuelve en la lectura (`fixtures/clinica.ts:418-423`).
- **API:** `CarePlanActivityItemDto` (`dto/chart-read.dto.ts:106-130`) solo trae `id, statusConceptId, detailText, scheduledAt`. En cambio, `encounter-pdf.service.ts:113,170` sí usa `activityConceptId`.
- **Modelo:** `chart.care_plan_activities.activity_concept_id` (NOT NULL).
- **Qué hacer:** Back: agregar `activityConceptId` a `CarePlanActivityItemDto` y al mapper de `chart-read.service.ts`. Front: sumarlo al tipo y mostrarlo.
- **Archivos:** API `dto/chart-read.dto.ts`, `services/chart-read.service.ts`; front `clinical.types.ts`, `clinical.client.ts` (`toCarePlan`), `patient-chart.ts`.
- **Gherkin:**
  - Dado un plan creado con una actividad de clase «Estudio», cuando se relee el expediente, entonces la actividad sigue mostrando «Estudio».
  - Dado un plan antiguo sin clase elegida, cuando se lee, entonces viene la clase por defecto `CPACT_GENERAL` con su etiqueta.

#### CL-27 · Los documentos del expediente no se pueden abrir: el front descarta `files` y no usa la descarga de chart
- **Severidad:** Alta (se sube un informe y después no hay cómo verlo).
- **Tipo:** contrato-respuesta / ruta sin consumir.
- **Front:**
  - `ChartDocument` (`clinical.types.ts:328-337`) no tiene `files`, y `toDocument` lo tira;
  - el mock (`fixtures/clinica.ts:430-438`, `documentosDe`) tampoco devuelve `files`, aunque la API lo declara obligatorio;
  - `document-block.ts:204-283` sube los archivos y los vincula, pero ninguna pantalla vuelve a ofrecerlos.
- **API:**
  - `ChartDocumentItemDto.files!: ChartDocumentFileItemDto[]` (`dto/chart-read.dto.ts:258`);
  - `GET /charts/documents/:documentId/files/:fileId/content` (`chart-documents.controller.ts:68`) autoriza con `assertPuedeLeerHistoria` (`chart-documents.service.ts:169`).
- **Modelo:** `chart.document_record_files` (file_id, content_role_concept_id, ordinal).
- **Qué hacer:**
  - Front: agregar `files` al tipo; poner un botón «Ver/descargar» por archivo contra `/charts/documents/:id/files/:fileId/content`, no contra `/common/files`, para que aplique la autorización clínica.
  - Mock: devolver `files: [...]` y servir la ruta de contenido.
- **Archivos:** `clinical.types.ts`, `clinical.client.ts`, `chart-documents.client.ts`, `patient-chart.ts/html`, `core/mock/fixtures/clinica.ts`, `core/mock/handlers/clinical.handlers.ts`.
- **Gherkin:**
  - Dado un documento con un PDF adjunto, cuando el médico abre la pestaña Documentos, entonces ve un enlace por archivo y al pulsarlo se descarga desde `/charts/documents/:id/files/:fileId/content`.
  - Dado un profesional sin vínculo asistencial con el paciente, cuando pide ese contenido, entonces recibe 403.

#### CL-28 · Registrar un documento son N+1 peticiones sin atomicidad: si falla la última, los archivos quedan huérfanos
- **Severidad:** Baja.
- **Tipo:** invariante (un caso de uso, una transacción).
- **Front:** `document-block.ts:263-283` sube cada archivo con `POST /common/files/upload` (un archivo por petición) y después hace `createDocument` (`:221-232`).
- **API:** `chart-documents.service.ts:61-115` es transaccional dentro de su parte: valida cada `fileId` con `assertUsableBy` y crea el registro y sus archivos. La subida previa queda fuera de la transacción, por diseño de `common/files`.
- **Modelo:** `common.files`, `chart.document_record_files`.
- **Qué hacer:** aceptarlo como diseño (hay dos casos de uso: subir y vincular), pero:
  - Front: si `createDocument` falla, reintentar con los mismos `fileId` sin volver a subir.
  - Back: si `common/files` tiene purga de huérfanos, confirmarlo (sin confirmar).
- **Archivos:** `document-block.ts`.
- **Gherkin:**
  - Dado que la subida de 2 archivos salió bien y `POST /charts/documents` falló, cuando el usuario pulsa «Reintentar», entonces se reenvían los mismos `fileId` sin subirlos de nuevo.
  - Dados archivos subidos que no se vinculan en X horas, cuando corre la purga, entonces se eliminan (sin confirmar que exista).

#### CL-29 · El autor de una nota o versión es un campo libre del body, no la sesión
- **Severidad:** Alta.
- **Tipo:** autorización.
- **Front:** `free-note-block.ts:170-205` manda `authorProfileId` = `getOwnPractitionerProfile().profileId`, que es lo correcto, pero nada impide mandar otro.
- **API:**
  - `chart-notes.service.ts:98` (create) y `:160` (addVersion) guardan `dto.authorProfileId` sin compararlo con el perfil del actor;
  - en cambio, sign y cosign sí lo comparan (`assertFirmaConPerfilPropio`, `:194`, `:250`, `:546`);
  - `care-plans` acepta `authorProfileId` opcional, con el mismo problema (`chart-care-plans.service.ts:77`).
- **Modelo:** `clinical_note_versions.author_profile_id` (FK) y `recorded_by_user_id`.
- **Qué hacer:** Back: rechazar con 403 si `authorProfileId` no es el perfil profesional de la sesión, o derivarlo de la sesión. Aplicar lo mismo a amend (`:342`) y a care-plans.
- **Archivos:** API `services/chart-notes.service.ts`, `services/chart-care-plans.service.ts` y sus specs.
- **Gherkin:**
  - Dado el médico A autenticado, cuando hace `POST /charts/notes` con `authorProfileId` del médico B, entonces recibe 403 y no se crea ninguna fila.
  - Dado el médico A, cuando agrega una versión con su propio perfil, entonces recibe 201.

#### CL-30 · El paciente no tiene ninguna ruta para leer sus notas liberadas, planes ni documentos: la «historia unificada» no los incluye
- **Severidad:** Alta (choca con el propósito «el paciente, dueño de su historia»).
- **Tipo:** ruta-faltante.
- **Front:**
  - `features/account/medical-record/medical-record.ts:384,460-467` arma el PDF de historia con `getSummary` + órdenes + resultados;
  - `DocumentoDeHistoria` (`shared/utils/clinical-pdf/clinical-pdf.types.ts:204-215`) solo tiene `atenciones, recetas, formularios, ordenes, resultados`: sin evoluciones, sin planes y sin documentos.
- **API:**
  - `/charts/*` es solo `CLINICIAN`/`PRACTITIONER` (`chart-read.controller.ts:33`);
  - no hay `/charts/me/...`;
  - fuera de `chart/`, nadie lee `clinical_note_headers` (grep).
  - La liberación existe (`releaseVersion` pone `current_released_version_id`), pero no tiene lector del lado del paciente.
- **Modelo:**
  - `chart.patient_timeline_view <<VIEW>>` (con `patient_visibility_concept_id`);
  - `clinical_note_headers.current_released_version_id`;
  - `document_records.patient_visibility_concept_id` (por defecto `VISIBILITY_PROVIDER_ONLY`, `chart-documents.service.ts:92`).
- **Qué hacer:**
  - Back: `GET /charts/me/notes` (solo versiones liberadas) y `GET /charts/me/documents` (solo `patient_visibility` visible), con rol PATIENT, o un bloque aditivo en `/clinical/patients/:id/summary`.
  - Front: sumarlos al PDF de historia y a «Mi historia».
  - Depende de CL-20, porque sin firma y liberación no hay nada liberado.
- **Archivos:** API `controllers/` (nuevo `chart-me.controller.ts`), `services/chart-read.service.ts`, `dto/chart-read.dto.ts`; front `clinical.client.ts`, `medical-record.ts`, `clinical-pdf.types.ts`, `clinical-pdf.ts`, mock `clinical.handlers.ts`.
- **Gherkin:**
  - Dada una nota firmada y liberada, cuando el paciente pide `GET /charts/me/notes`, entonces la ve con su versión liberada y nunca un borrador.
  - Dada una versión retenida (withhold), cuando el paciente lista, entonces no aparece.
  - Dado el paciente, cuando descarga su historia en PDF, entonces el PDF incluye las evoluciones liberadas.

#### CL-31 · Hay un PDF oficial del encuentro en la API y el front arma el suyo en el cliente
- **Severidad:** Media.
- **Tipo:** otro (duplicación / valor legal).
- **Front:** `patient-chart.ts:1504` y `medical-record.ts:428` usan `downloadVisitPdf` (jsPDF en el cliente); no existe ningún `GET /charts/encounters/:id/pdf` en los clientes.
- **API:** `chart-encounters.controller.ts:43-80`: `GET /charts/encounters/:id/pdf`, «PDF oficial de un encuentro cerrado (con sello)»; 422 si el encuentro no está cerrado; roles CLINICIAN/PRACTITIONER.
- **Modelo:** `clinical.encounters` (cierre y sello) y `chart.*`.
- **Qué hacer:** decisión de producto:
  - usar el PDF oficial para el médico, que es el que tiene sello;
  - o documentar que el PDF del cliente es una vista y no un documento con valor legal.
  - Para el paciente, falta la ruta (CL-30).
- **Archivos:** `clinical.client.ts` (nuevo `downloadEncounterPdf`), `patient-chart.ts`, mock `clinical.handlers.ts`.
- **Gherkin:**
  - Dado un encuentro cerrado, cuando el médico pulsa «Descargar PDF», entonces se descarga el PDF sellado desde `/charts/encounters/:id/pdf`.
  - Dado un encuentro abierto, cuando lo pide, entonces ve el mensaje del 422 («el encuentro no está cerrado»).

#### CL-32 · No hay lectura del historial de versiones de una nota
- **Severidad:** Media.
- **Tipo:** ruta-faltante.
- **Front:** `chart-notes.client.ts:19-22` y `free-note-block.ts:49-50` prometen que «la versión previa queda con su número y su autor», pero ninguna pantalla puede mostrarla. `ChartNoteItemDto` solo trae la versión vigente.
- **API:** no existe `GET /charts/notes/:noteId/versions`. `chart-read.dto.ts:10-103` solo expone `currentVersionId` y `versionNumber`.
- **Modelo:** `clinical_note_versions` (supersedes_version_id, amendment_reason_text, signed_by_profile_id); `clinical_note_signatures`.
- **Qué hacer:** Back: `GET /charts/notes/:noteId/versions` (con autor, estado, firma y motivo de enmienda), bajo `ClinicalRecordAccessGuard` a partir de la cabecera. Front: vista «historial» en el bloque de notas.
- **Archivos:** API `controllers/chart-notes.controller.ts`, `services/chart-notes-read.service.ts`, `dto/notes.dto.ts`; front `chart-notes.client.ts`, `free-note-block.*`.
- **Gherkin:**
  - Dada una nota con 3 versiones y una enmienda, cuando el médico abre «Historial», entonces ve 4 filas ordenadas, con autor, fecha y el motivo de la enmienda.
  - Dado un profesional sin acceso al paciente, cuando pide el historial, entonces recibe 403.

#### CL-33 · La API cofirma modificando una versión ya firmada; el `<<IMMUTABLE>>` no está garantizado en la base
- **Severidad:** Media.
- **Tipo:** invariante.
- **Front:** no aplica, porque el front no firma (CL-20).
- **API:**
  - `chart-notes.service.ts:222-226` (sign) hace UPDATE sobre la fila de versión (status, signedBy, signedAt, contentHash). Es aceptable como sellado de un DRAFT.
  - `:299-300` (cosign) vuelve a actualizar `statusConceptId` y `releaseEligibilityConceptId` de una versión **ya firmada**.
  - `SQL/15_chart/` no tiene `05_constraints.sql`: no hay trigger WORM para `clinical_note_versions <<IMMUTABLE>>`, `clinical_note_signatures <<IMMUTABLE>>` ni `note_release_events <<LOG>>` (solo `10_audit` lo tiene, según v4.0.10).
- **Modelo:** `diagram_15_chart.puml:48` (IMMUTABLE), `:70` (IMMUTABLE), `:81` (LOG).
- **Qué hacer:**
  - Back/modelo: aclarar en el `.puml` qué transición del sellado está permitida (DRAFT→SIGNED).
  - Que la cofirma registre solo en `clinical_note_signatures` y derive el estado, en lugar de mutar la versión.
  - Promover los triggers WORM del módulo 15 por `gen_integrity.py`, en tarjeta aparte, siguiendo el patrón de v4.0.10.
  - Sin confirmar si `gen_integrity` ya cubre el módulo 15 en otra carpeta.
- **Archivos:** `Mantra Core Health Context/modules/diagram_15_chart.puml`, `salud-db/gen_integrity.py`, `SQL/15_chart/05_constraints.sql` (nuevo, generado), API `services/chart-notes.service.ts`.
- **Gherkin:**
  - Dada una versión firmada, cuando se intenta `UPDATE chart.clinical_note_versions SET subjective_text=…`, entonces la base lo rechaza.
  - Dada una cofirma, cuando se completa, entonces existe una fila nueva en `clinical_note_signatures` y el contenido y el hash de la versión no cambiaron.

#### CL-34 · El mock filtra plantillas por `specialtyConceptId` y el cliente manda `specialtyId`
- **Severidad:** Baja.
- **Tipo:** contrato (mock ↔ cliente).
- **Front:** el cliente envía `specialtyId` (`chart-templates.client.ts:34-40`) y el mock lee `query.get('specialtyConceptId')` (`clinical.handlers.ts:699`), así que siempre devuelve las 43. Hoy todas las llamadas son sin filtro (`forms-catalog.ts:179`, `form-builder.ts:349`, `specialty-form-block.ts:529`): es un defecto latente.
- **API:** `@Query('specialtyId')` (`chart-templates.controller.ts:85-88`).
- **Qué hacer:** que el mock lea `specialtyId`.
- **Archivos:** `core/mock/handlers/clinical.handlers.ts:699`.
- **Gherkin:** dado `GET /charts/templates?specialtyId=<cardio>` en el mock, cuando responde, entonces solo trae las plantillas de cardiología.

#### CL-35 · Los estados de nota del mock no coinciden con los conceptos de la API
- **Severidad:** Baja.
- **Tipo:** dato-inexistente-en-modelo (en el mock).
- **Front (mock):** `fixtures/clinica.ts:357` usa `ESTADO['ST-COMPLETED']` y `ESTADO['ST-DRAFT']`, de `VS_RECORD_STATUS`, como `lifecycleStatusConceptId`.
- **API:** `chart.concepts.ts:27-35` usa `NOTE_LIFECYCLE_DRAFT`, `NOTE_LIFECYCLE_SIGNED` y `NOTE_LIFECYCLE_AMENDED`, con target `chart.clinical_note_headers.lifecycle_status_concept_id` (`dynamic-enum-catalog.ts:1242`). No existe el estado «Completada» para una nota.
- **Qué hacer:** que el mock siembre con los códigos del catálogo de chart (DRAFT/SIGNED/AMENDED).
- **Archivos:** `core/mock/fixtures/clinica.ts`, `core/mock/fixtures/conceptos.ts`.
- **Gherkin:** dada una nota firmada en el mock, cuando se muestra su estado, entonces dice «Firmada» (el mismo texto que la API), no «Completada».

#### CL-36 · Los documentos nacen «solo para el profesional» y el front no deja elegir visibilidad ni confidencialidad
- **Severidad:** Baja (relacionado con CL-30).
- **Tipo:** contrato-body (campos opcionales que la pantalla nunca manda).
- **Front:** `NewChartDocument` declara `patientVisibilityConceptId` y `confidentialityConceptId` (`chart-documents.types.ts`), pero `document-block.ts:222-232` no los manda.
- **API:** los valores por defecto `VISIBILITY_PROVIDER_ONLY` y `DOC_CONFIDENTIALITY_NORMAL` están en `chart-documents.service.ts:89-92`.
- **Modelo:** `document_records.patient_visibility_concept_id` y `confidentiality_concept_id`.
- **Qué hacer:** Front: un switch «Visible para el paciente» (cuando exista CL-30). Back: exponer el dynamic-enum de visibilidad (sin confirmar el target).
- **Archivos:** `document-block.ts/html`.
- **Gherkin:** dado un informe marcado «Visible para el paciente», cuando se registra, entonces viaja `patientVisibilityConceptId` = VISIBLE y el paciente lo ve en «Mi historia».

---

### Estado de los pendientes documentados (dominio chart)

- **Cerrados en `dev` pero aún marcados como abiertos:**
  - `PENDIENTES-BACKEND.md` **P18** («No hay lectura de colección de notas clínicas»): cerrado en la API por `GET /charts/notes` (`chart-notes.controller.ts:73`, commit f361b42f). El front no lo adoptó (CL-23).
  - `PLAN-EVOLUCIONES-Y-ATENCION.md:19-22` y `:29-33` repiten la premisa desactualizada.
- **Siguen abiertos:**
  - La nota se ata a la atención por fecha: se resuelve adoptando `GET /charts/notes` + `encounterId`; P11 ya está resuelto.
  - El front no firma, no exporta ni versiona tras firmar (`free-note-block.ts:54-57`): CL-20.
- **API `ESTADO-Y-PENDIENTES.md` / `REGISTRO-DEFECTOS.md`:** no hay entradas específicas de chart/M15 (grep de chart/notas/plantilla/expediente sin resultados que apliquen). B-9/B-10 son de conditions y surveys: fuera de este alcance.

### Sin confirmar
- El código HTTP de `GET /system-context/dynamic-enums` con un target desconocido (se infiere 404 por los specs de `dynamic-enums.service`). No se probó contra la API viva.
- Si existe una purga de `common.files` huérfanos (CL-28).
- Si `AssignTemplateDto` sin `practiceId` ni `practitionerProfileId` (lo que manda `forms-catalog.ts:218`) asigna por tenant o falla. El servicio no lo rechaza explícitamente.
- Nada se verificó en runtime: la evidencia es lectura de código y grep.


---

## Parte · Parte C — Diagnóstico, unidades diagnósticas, procedimientos y health-context

Auditoría de solo lectura, 2026-09-24. Front `mantra-core-health` en `mockup` (9b3e0101); API `mantra-core-health-redesa-api` en `dev` (7541797c).
Lo que se compara: ruta, body contra DTO (con `ValidationPipe` `whitelist + forbidNonWhitelisted + transform + enableImplicitConversion`, confirmado en `src/main.ts:158-165`), forma de la respuesta, datos del mock contra el modelo e invariantes.

> **La fuente del modelo cambió de lugar.** El `.puml` y el DDL vigentes están en `mantra-core-health-model/` (`Mantra Core Health Context/`, `SQL/`). El `SQL/` de la raíz del workspace **está desactualizado**: por ejemplo, no tiene `clinical.service_requests.previous_diagnostic_report_id` ni `duplicate_override_reason`, y el modelo sí. Todas las comprobaciones de modelo de este informe usan `mantra-core-health-model/`.
> Fuera de alcance, pero hay que decirlo: `mantra-core-health-redesa-api/database/SQL/` volvió a existir. ADR-0021 y `check_ddl_sources.py` prohíben esa carpeta.

### Resumen de rutas del alcance

| Ruta del front | API (dev) | Body | Respuesta |
|---|---|---|---|
| GET /diagnostics/patients/:id/orders | diagnostics-orders.controller.ts:41 | — | OK |
| GET /diagnostics/patients/:id/imaging-studies | diagnostics-imaging.controller.ts:65 | — | OK |
| GET /diagnostics/work-orders | diagnostics-lab.controller.ts:56 | query OK | OK |
| POST /clinical/service-requests | clinical-orders.controller.ts:72 | OK | OK |
| POST /clinical/service-requests/duplicate-check | clinical-orders.controller.ts:58 | OK | OK |
| GET /diagnostic-results/me · /me/orders · /me/:reportId | diagnostics-patient-results.controller.ts:76/109/136 | — | OK (el mock rompe /shares, ver CL-41) |
| GET·POST /diagnostic-results/me/:reportId/shares | :179 / :157 | OK (`reason` se descarta, ver CL-50) | OK |
| POST …/shares/:shareId/revoke | :200 | {} | OK |
| GET /diagnostic-units · /search · /:id | diagnostic-units.controller.ts:85/124/142 | query OK | falta `cities` (CL-45) |
| GET /diagnostic-units/administration · /:id/administration | :104 / :159 (SECURITY_ADMIN) | — | OK |
| POST verify-and-publish · study-offerings · price-schedules · study-prices · close; DELETE study-offerings | diagnostic-units / diagnostic-pricing controllers | OK (subconjuntos del DTO) | OK |
| GET /procedure-cases · /:id · /:id/team-members | periop.controller.ts:103/121/263 | query OK | OK |
| POST …/team-members/:memberId/accept · /respond | periop.controller.ts:285/315 | OK | OK |
| GET·POST /dental-procedures, GET /dental-procedures/catalog | dental.controller.ts:62/73/86 | OK | OK |
| 12 rutas de /health-context/* | health-context.controller.ts:64-251 | OK, campo por campo | OK |

**Falsos positivos del inventario (`client-calls.json`).** `GET /diagnostic-units/search` y `GET /diagnostic-units/administration` aparecen emparejadas con `/:id`, y `GET /diagnostic-results/me/:reportId` con `/me/orders`. En la API, las rutas literales se declaran **antes** que la ruta con parámetro, a propósito: `diagnostic-units.controller.ts:95-124` y `diagnostics-patient-results.controller.ts:97-109` lo documentan. No hay choque de rutas; el error es del matcher del inventario.

---

#### CL-40 · El paciente no puede descargar el PDF de su resultado de laboratorio
- **Severidad:** Bloqueante demo, para la demo con API real. Es el propósito «el paciente, dueño de su historia».
- **Tipo:** autorización.
- **Evidencia front:** `src/app/features/account/diagnostic-results/diagnostic-results.ts:270-291`. `descargar()` llama a `FilesClient.downloadUrl()` y hace `window.open(url)`.
- **Evidencia API:**
  - `common/services/files.service.ts:563-651`. `generateDownloadUrl` exige `canActorReadOwnFile`.
  - `common/services/file-access.ts:47-55`. Solo pasa quien **subió** el archivo, o `SECURITY_ADMIN`/`SUPERADMIN`. El PDF del informe lo sube el laboratorio, así que el paciente recibe **403**.
  - `common/controllers/common-files.controller.ts:115-123`. Aun con la URL firmada (`/common/files/:id/content?versionId&expires&signature`), `GET :id/content` exige `@CurrentUser` e **ignora la firma**. `window.open` no manda el bearer y la respuesta es **401**.
  - El Swagger de `GET /diagnostic-results/me/:reportId` promete «Cada `fileId` se descarga por `GET /common/files/{id}/content`» (`diagnostics-patient-results.controller.ts:139-142`). Esa promesa es falsa para el titular.
- **Modelo:** `diagnostics.diagnostic_report_files(file_id)`, `common.files(created_by_user_id)`, `diagnostics.diagnostic_release_events(visibility_concept_id)`.
- **Qué hacer:**
  - Backend, una de dos:
    - (a) Crear `GET /diagnostic-results/me/:reportId/files/:fileId/content`. Autoriza por titularidad del informe y por versión liberada y visible (reusar `projectReleasedResults`), no por autoría del archivo. También sirve para el profesional con un share vigente (`RESULT_READ_PERMISSION_ID`).
    - (b) Hacer que `:id/content` acepte la firma HMAC sin bearer, validando `expires`.
  - Front: bajar el contenido con `HttpClient` (blob o `data:`), igual que `imageDataUrl`, en vez de `window.open` de una URL que necesita cabecera.
- **Archivos:**
  - `diagnostics/controllers/diagnostics-patient-results.controller.ts`
  - `diagnostics/services/diagnostics-patient-results.service.ts`
  - (opcional) `common/controllers/common-files.controller.ts`
  - front: `core/data-access/diagnostics/diagnostics.client.ts` (nuevo `downloadOwnResultFile`) y `features/account/diagnostic-results/diagnostic-results.ts`
- **Gherkin:**
  - Dado un informe liberado y visible para el paciente, con un PDF subido por el laboratorio, cuando el paciente pide su archivo, entonces recibe 200 con `Content-Type: application/pdf`.
  - Dado un informe no liberado, cuando el paciente pide su archivo, entonces recibe 404 y no sabe si el archivo existe.
  - Dado un profesional con un share vencido, cuando pide el archivo, entonces recibe 403.

#### CL-41 · El mock de `GET /diagnostic-results/me/:id/shares` devuelve un arreglo pelado y el panel «compartido con» falla siempre en mockup
- **Severidad:** Alta. Rompe la demo en `mockup`.
- **Tipo:** contrato-respuesta (del mock).
- **Evidencia front:**
  - `core/mock/handlers/diagnostics.handlers.ts:663` devuelve `compartidos.filtrar(...)`, un `T[]` (`mock-store.ts:265`). `isMockReply` no lo envuelve (`mock-router.ts:98-106`).
  - `core/data-access/diagnostics/diagnostics.client.ts:228-235` hace `body.items.map(toShare)`, lanza TypeError y sale el toast «No pudimos leer con quién está compartido.» (`diagnostic-results.ts:307-312`).
- **Evidencia API:** `diagnostics-patient-results.controller.ts:179-189` devuelve `DiagnosticResultSharesResponseDto {reportId, items[]}` (`dto/patient-results.dto.ts:256-262`). La API está bien.
- **Modelo:** no aplica. Los shares son grants de `authz` (`diagnostics-patient-results.service.ts:402-414`).
- **Qué hacer:** solo front. El mock devuelve `{ reportId: params.id, items: [...] }`. Agregar un spec del handler que fije la forma.
- **Archivos:** `core/mock/handlers/diagnostics.handlers.ts`, `core/mock/handlers/diagnostics.handlers.spec.ts`.
- **Gherkin:**
  - Dado un resultado compartido una vez en mockup, cuando abro «Compartido con», entonces veo la fila y no aparece ningún toast de error.
  - Dado un resultado sin compartidos, cuando abro el panel, entonces veo la lista vacía sin error.

#### CL-42 · El alta de laboratorio y de centro de imagenología no manda nada, aunque `register-organization` ya soporta `DIAGNOSTIC_CENTER`
- **Severidad:** Alta.
- **Tipo:** ruta-faltante (en el front; la API existe).
- **Evidencia front:**
  - `features/auth/register-laboratory/register-laboratory.ts:850-863`: «hoy **no existe** un endpoint de alta de laboratorio». `submit()` solo pone `enviada=true`.
  - Lo mismo en `features/auth/register-imaging-center/register-imaging-center.ts` (cabecera, línea 53: «Es la MAQUETA: nada sale a la red»).
  - Lo agregado en `mockup` frente a `dev` es solo UI: el aviso D-06 de dirección vaciada por el mapa.
- **Evidencia API:**
  - `iam/dto/register-organization.dto.ts:380-560`. `tenantType` acepta `DIAGNOSTIC_CENTER`, con un bloque `diagnosticUnit` (`directory/dto/tenant-type-profile.dto.ts`: `diagnosticUnitTypeConceptId`, `modalityConceptIds`, `walkInAvailable`, `homeCollectionAvailable`, `primarySite{name,timeZone,address{lines,city,latitude,longitude,…}}`), `legalDocuments`, `legalRepresentative` y `executives`.
  - La respuesta trae `diagnosticUnitId` (:743).
  - Es `POST /iam/auth/register-organization`, que el front ya usa para otros tipos.
- **Modelo:** `directory.tenants`, `diagnostic_units.diagnostic_units`, `diagnostic_units.diagnostic_unit_sites`, documentos de afiliación.
- **Qué hacer:**
  - Front: cablear las dos altas a `register-organization` con `tenantType: 'DIAGNOSTIC_CENTER'`.
  - Subir los PDF antes con `POST /iam/auth/upload-registration-document`.
  - Mandar el GPS de la central en `diagnosticUnit.primarySite.address.latitude/longitude`.
  - **Las sucursales no entran en el alta.** El DTO solo tiene `primarySite`, y `POST /diagnostic-units/:id/sites` exige `SECURITY_ADMIN` (ver CL-44). Decidir si el backend acepta `sites[]` en el alta o si las sucursales se cargan después de la verificación.
- **Archivos:**
  - front: `register-laboratory.ts`, `register-imaging-center.ts`, el cliente de iam.
  - API, si se aceptan sucursales: `directory/dto/tenant-type-profile.dto.ts` y `iam-organization-self-registration.service.ts`.
- **Gherkin:**
  - Dado un laboratorio que completa el alta con central geolocalizada, cuando envía, entonces se crea un tenant `PENDING/UNVERIFIED` con su unidad diagnóstica y la respuesta trae `diagnosticUnitId`.
  - Dado un alta con dos sucursales, cuando envía, entonces las sucursales no se pierden en silencio: o se crean o el front avisa que se cargan tras la verificación.

#### CL-43 · Un laboratorio unipersonal no puede cumplir el contrato de documentos legales
- **Severidad:** Alta.
- **Tipo:** contrato-body.
- **Evidencia front:** `register-laboratory.ts:259-264` (JSDoc). Para una unipersonal, la constitución y el poder **no** se exigen («no constituye sociedad y el titular se representa a sí mismo»).
- **Evidencia API:**
  - `iam/dto/register-organization.dto.ts:30-94`. `RegisterOrganizationLegalDocumentsDto` es «todo o nada»: `constitutionFileId!` con `@IsUUID()` sin `@IsOptional`, así que faltar uno es un 400.
  - `:328-338`. `legalRepresentative.powerOfAttorneyFileId!` es obligatorio.
  - Para no recibir 400, una unipersonal tendría que omitir el bloque entero y perder NIT, SEPREC, licencia y SEDES.
- **Modelo:** documentos de afiliación (`AffiliationDocumentRole`). Sin confirmar si el `.puml` declara obligatoriedad por tipo societario.
- **Qué hacer:** backend. Volver `constitutionFileId` y `powerOfAttorneyFileId` condicionales (`@ValidateIf(o => legalEntityType !== 'UNIPERSONAL')`), o partir el bloque en documentos individuales opcionales y hacer la regla por tipo en el servicio (422).
- **Archivos:** `iam/dto/register-organization.dto.ts`, `iam/services/iam-organization-self-registration.service.ts` y su spec.
- **Gherkin:**
  - Dada una organización `UNIPERSONAL` sin constitución ni poder, cuando se registra con los otros cuatro PDF, entonces recibe 201 y los cuatro documentos quedan registrados.
  - Dada una `SRL` sin constitución, cuando se registra, entonces recibe 422 con el documento faltante.

#### CL-44 · La administración del laboratorio solo la puede usar un administrador de plataforma, no el dueño del laboratorio
- **Severidad:** Alta.
- **Tipo:** autorización.
- **Evidencia front:** `core/navigation/navigation.map.ts:1009-1017`. La ruta `administration/medical-laboratory` («Configurá sucursales, equipos, estudios, precios y personal de tu laboratorio») declara `roles: ['SECURITY_ADMIN']`.
- **Evidencia API:**
  - `diagnostic_units/controllers/diagnostic-units.controller.ts:104,159,172,186,199…`: `@Roles('SECURITY_ADMIN')` en todas las lecturas y escrituras administrativas.
  - `iam/services/iam-organization-self-registration.service.ts:69-73`: el dueño que se autorregistra nace solo con rol global `USER` más la membresía `DIR.ROLE_OWNER`, y «`SECURITY_ADMIN` … no se concede».
- **Modelo:** `directory.tenant_memberships`, `authz.user_role_assignments`. Sin confirmar si existe en el modelo un rol de negocio tipo «administrador de unidad diagnóstica».
- **Qué hacer:**
  - Backend: rol de tenant (por ejemplo, derivado de `ROLE_OWNER` en `AuthzEffectiveRolesService`, o un `DIAGNOSTIC_UNIT_ADMIN` sembrado en authz) acotado por `requireTenantId()`, y aceptarlo en esas rutas.
  - Front: agregar ese rol a la ruta.
- **Archivos:** `diagnostic-units.controller.ts`, `diagnostic-pricing.controller.ts`, `diagnostic-unit-sites.controller.ts`, `authz` (seed de roles o effective-roles), `navigation.map.ts`.
- **Gherkin:**
  - Dado el dueño de un laboratorio verificado, cuando abre «Laboratorio médico», entonces ve solo sus unidades y puede cargar un estudio.
  - Dado el dueño del laboratorio A, cuando pide `/diagnostic-units/{idDeB}/administration`, entonces recibe 403 o 404.

#### CL-45 · La búsqueda de centros no devuelve `cities` y el mapa de departamentos del directorio no aparece en `dev`
- **Severidad:** Media.
- **Tipo:** contrato-respuesta.
- **Evidencia front:**
  - `core/data-access/diagnostic-units/diagnostic-units.types.ts:140-150`: `cities?` es opcional, «hoy sólo lo sirve la maqueta… TODO: exponerlo en `catalog.dto.ts`».
  - `features/laboratory-directory/laboratory-directory.ts:237-253`: sin `cities` el mapa no se dibuja.
  - El mock lo inventa en `diagnostics.handlers.ts:704` (`cities: ciudadesDe(u)`).
- **Evidencia API:** `diagnostic_units/dto/catalog.dto.ts:136-160`. `DiagnosticUnitSearchItemDto` = `tenantId, rating, ratingCount, minAmount` más los campos del directorio; **no** tiene `cities`.
- **Modelo:** el dato existe. Ciudad de la dirección de `diagnostic_unit_sites → practice_sites` (el alta ya recibe `address.city`).
- **Qué hacer:** backend. Agregar `cities: string[]` (distintas, de las sedes activas) al ítem de búsqueda, y opcionalmente `minAmountCurrency` (ver CL-51).
- **Archivos:** `diagnostic_units/dto/catalog.dto.ts`, el servicio de búsqueda del catálogo y su spec.
- **Gherkin:**
  - Dado un centro con sedes en La Paz y El Alto, cuando busco, entonces el ítem trae `cities: ["La Paz","El Alto"]`.
  - Dado el directorio contra la API real, cuando cargo `/laboratory-directory`, entonces el mapa de departamentos aparece y filtra.

#### CL-46 · Dos caminos de liberación de informes: `POST /clinical/diagnostic-reports/:id/release` no deja el resultado visible para el paciente
- **Severidad:** Alta.
- **Tipo:** invariante (una fuente de verdad para la liberación).
- **Evidencia front:** `core/data-access/clinical/clinical.client.ts:548-595`. `createDiagnosticReport` y `releaseDiagnosticReport` son un «contrato sin pantalla»: ninguna vista los llama. El mock (`clinical.handlers.ts:514-519`) tampoco toca la colección `informes` de `diagnostics.handlers.ts`, así que liberar en mockup no hace aparecer nada en «Mis resultados».
- **Evidencia API:**
  - `clinical/services/diagnostic-reports.service.ts:147-153`. Solo cambia `lifecycleStatusConceptId`, `resultReleaseStatusConceptId` y `currentReleasedVersionId`.
  - En cambio, `diagnostics/services/diagnostics-patient-results.service.ts:606-640` (`projectReleasedResults`) decide la visibilidad por `diagnostic_report_versions` + `diagnostic_release_events.visibility_concept_id`, que escribe `POST /diagnostics/reports/:reportId/versions/:versionId/release` (`diagnostics-reports.controller.ts:51`).
  - Resultado: lo liberado por la vía clínica no aparece en `GET /diagnostic-results/me`. Confirmado leyendo el código; sin confirmar en runtime.
- **Modelo:** `clinical.diagnostic_reports(result_release_status_concept_id, current_released_version_id)` y `diagnostics.diagnostic_release_events`.
- **Qué hacer:** backend. Que `clinical…/release` delegue en el release de `diagnostics`, que crea el evento con su visibilidad, en la misma transacción. Otra opción: deprecarlo y documentar que el camino es `diagnostics/reports/.../release`.
- **Archivos:** `clinical/services/diagnostic-reports.service.ts`, `diagnostics/services/diagnostics-reports.service.ts`, int-spec nuevo.
- **Gherkin:**
  - Dado un informe con versión, cuando se libera por cualquiera de las dos rutas, entonces aparece en `GET /diagnostic-results/me` del titular.
  - Dada una liberación con visibilidad «solo profesional», cuando el paciente lista, entonces no la ve.

#### CL-47 · El circuito del laboratorio (acesión, espécimen, orden de trabajo, analizador, verificación, informe) no tiene pantalla, y los especímenes no tienen ninguna lectura
- **Severidad:** Media. Bloquea mostrar el circuito de punta a punta: nadie en la UI puede producir un resultado.
- **Tipo:** ruta-faltante (lecturas en la API y pantallas en el front).
- **Evidencia front:**
  - `diagnostics.client.ts:48-56` declara que no se construyen a propósito.
  - No existe cliente para `POST /diagnostics/specimens|accessions|work-orders|analyzer-runs|results/:id/verifications|reports/:id/versions|…/release|critical-results`.
  - El mock inventa la cola de `ordenesDeTrabajo` (`diagnostics.handlers.ts:89`) y los informes ya liberados como fixture.
- **Evidencia API:**
  - `diagnostics-specimens.controller.ts:41-89`: solo `POST`. No hay `GET` de espécimen, acesión, contenedores ni cadena de custodia.
  - `diagnostics-lab.controller.ts:56` es la única lectura (work-orders).
- **Modelo:** `diagnostics.specimens`, `laboratory_accessions`, `accession_specimens`, `specimen_containers`, `specimen_chain_of_custody_events`, `laboratory_work_orders(_tests)`, `analyzer_runs`, `result_verifications`, `diagnostic_report_versions`, `diagnostic_release_events` (todas en `mantra-core-health-model/SQL/20_diagnostics/02_tables.sql`).
- **Qué hacer:**
  - Backend: `GET /diagnostics/accessions/:id` (con especímenes y contenedores) y `GET /diagnostics/specimens/:id` (con custodia).
  - Front: una pantalla de laboratorio, la cola más el detalle de la orden, que acesione, cargue el resultado, suba el PDF y libere.
- **Archivos:** API `diagnostics-specimens.controller.ts` y `diagnostics-specimens.service.ts`; front, un feature nuevo de laboratorio y `DiagnosticsLabClient`.
- **Gherkin:**
  - Dada una orden de laboratorio, cuando el bioquímico acesiona y registra el espécimen, entonces `GET /diagnostics/accessions/:id` devuelve el espécimen con su custodia.
  - Dado un resultado verificado y liberado, cuando el paciente abre «Mis resultados», entonces lo ve.

#### CL-48 · Compartir un resultado exige tipear el UUID de la cuenta del profesional
- **Severidad:** Media. En la demo es inutilizable: nadie conoce un `userId`.
- **Tipo:** otro (UX y contrato).
- **Evidencia front:** `features/account/diagnostic-results/diagnostic-results.html:149-155`. Campo «Cuenta del profesional», placeholder «Identificador de la cuenta», texto libre que va a `practitionerUserId` (`diagnostic-results.ts:321-331`).
- **Evidencia API:** `dto/patient-results.dto.ts:209-231`. `practitionerUserId` es `@IsUUID()` y no hay endpoint de «profesionales con los que puedo compartir».
- **Modelo:** `authz.care_relationships` (v4.0.8) y `profiles.practitioner_profiles(user_id)`.
- **Qué hacer:**
  - Front: reemplazar el campo por un selector alimentado por `GET /authz/care-relationships` (los profesionales del paciente) o por la guía de profesionales, que resuelve `userId`.
  - Backend: si la guía no expone `userId`, exponerlo, o aceptar `practitionerProfileId` y resolver el usuario en el servidor. Sin confirmar qué devuelve hoy `/directory`.
- **Archivos:** `diagnostic-results.html`, `diagnostic-results.ts`; opcionalmente `ShareDiagnosticResultDto`.
- **Gherkin:**
  - Dado un paciente con dos profesionales vinculados, cuando abre «Compartir», entonces elige uno de una lista por nombre.
  - Dado que elige a su médica y un vencimiento futuro, cuando confirma, entonces se crea el share y aparece en la lista.

#### CL-49 · El módulo health-context exige roles que no existen en ningún seed
- **Severidad:** Media.
- **Tipo:** autorización.
- **Evidencia front:** `core/navigation/navigation.map.ts:921-935`. `administration/health-context` declara «los cinco roles humanos de `HealthContextController`».
- **Evidencia API:** `health_context/controllers/health-context.controller.ts:65-251` usa `SOURCE_ADMIN`, `CONTEXT_CURATOR`, `QUALITY_REVIEWER`, `CONTEXT_CONSUMER` y `PLATFORM_ADMIN`. Ninguno aparece en `authz.seed.ts`, en `authz-clinical-roles-seed.service.ts` ni en `mantra-core-health-model/` (grep: 0 fuera del propio módulo). Sin confirmar si `SUPERADMIN` atraviesa `@Roles`: `authz-effective-roles.service.ts:10` sugiere que sí.
- **Modelo:** `authz.roles` / value set de roles. Sin confirmar si el `.puml` del módulo 44 declara esos actores.
- **Qué hacer:** backend. Sembrar esos roles en authz, declarados en el modelo, o mapearlos a roles existentes. Mientras tanto, front: la sección solo es alcanzable por `SUPERADMIN`, y hay que decirlo.
- **Archivos:** `authz/authz.seed.ts` o el seed de roles, la nota de value set en el vault, `navigation.map.ts`.
- **Gherkin:**
  - Dado un usuario con `CONTEXT_CURATOR` asignado en authz, cuando hace `POST /health-context/contexts`, entonces recibe 201.
  - Dado un usuario sin esos roles, cuando abre `/administration/health-context`, entonces la sección no aparece en su menú.

#### CL-50 · `reason` del share se acepta y se descarta en silencio
- **Severidad:** Baja.
- **Tipo:** dato-inexistente-en-modelo.
- **Evidencia front:** `diagnostics.client.ts:252-256` lo manda si existe. La pantalla hoy no lo carga (`diagnostic-results.ts:330`).
- **Evidencia API:**
  - `dto/patient-results.dto.ts:226-231` declara `reason?`.
  - `diagnostics-patient-results.service.ts:402-414` crea el grant sin él.
  - El mock tampoco lo guarda.
- **Modelo:** el grant de `authz` no tiene columna de motivo en este flujo (sin confirmar una columna equivalente en `authz.access_grants`).
- **Qué hacer:** o persistirlo (modelo primero) o sacarlo del DTO para que no mienta.
- **Archivos:** `dto/patient-results.dto.ts`, `diagnostics.client.ts`, `diagnostics.types.ts`.
- **Gherkin:**
  - Dado un share con `reason`, cuando lo listo, entonces veo el motivo, o el POST responde 400 si el campo ya no existe.

#### CL-51 · `minAmount` viaja sin moneda y el front pone la moneda literal
- **Severidad:** Baja.
- **Tipo:** contrato-respuesta.
- **Evidencia front:** `features/laboratory-directory/laboratory-directory.ts:599-620`: «La moneda va literal porque la búsqueda **no la devuelve**».
- **Evidencia API:** `catalog.dto.ts` expone `minAmount` sin `currency`. El detalle sí tiene `currency` por precio (`DiagnosticUnitAdminPriceDto`).
- **Modelo:** `diagnostic_units.price_schedules(currency_concept_id)`.
- **Qué hacer:** backend. `minAmountCurrency` (concepto o código ISO). Front: usarlo.
- **Archivos:** `catalog.dto.ts`, el servicio del catálogo, `laboratory-directory.ts`.
- **Gherkin:**
  - Dado un centro con tarifa en USD, cuando busco, entonces la tarjeta dice «Desde USD …» y no «Bs».

#### CL-52 · El mock de procedimientos no distingue las respuestas del integrante y conserva una ruta `/decline` que no existe
- **Severidad:** Baja.
- **Tipo:** contrato-respuesta (del mock) / ruta-faltante (solo en el mock).
- **Evidencia front:**
  - `core/mock/handlers/procedures.handlers.ts:151-162`. `respond` pone **siempre** `RECHAZADO`, ignora `response` (`DECLINE|REQUEST_CHANGE|UNAVAILABLE`) y no valida `reasonText`.
  - Existe `POST …/team-members/:memberId/decline`, que el cliente no llama: `procedures.client.ts:128-166` usa `accept` y `respond`.
- **Evidencia API:**
  - `periop.controller.ts:315-337` y `dto/periop.dto.ts:470-500`. `RespondTeamMemberDto {response ∈ DECLINE|REQUEST_CHANGE|UNAVAILABLE, reasonText 1..2000}`.
  - No hay ruta `/decline`.
- **Modelo:** `procedures_perioperative.procedure_team_members(status_concept_id)`. Sin confirmar los tres conceptos de estado distintos.
- **Qué hacer:** solo front. Borrar `/decline` del mock, mapear cada `response` a su estado y devolver 400 si falta `reasonText`.
- **Archivos:** `procedures.handlers.ts`, más un spec nuevo.
- **Gherkin:**
  - Dado un integrante invitado, cuando responde `REQUEST_CHANGE` con motivo, entonces su estado no es «rechazado».
  - Dado un `respond` sin `reasonText`, cuando se envía en mockup, entonces recibe 400, igual que la API.

#### CL-53 · El mock de compartir conserva `DELETE …/shares/:shareId`, que la API no tiene
- **Severidad:** Baja.
- **Tipo:** ruta-faltante (solo en el mock; el front usa `revoke`).
- **Evidencia front:** `diagnostics.handlers.ts:671-675`. El cliente usa `POST …/revoke` (`diagnostics.client.ts:268-277`).
- **Evidencia API:** no existe `DELETE`. `revoke` en `diagnostics-patient-results.controller.ts:200`, a propósito, porque no se borra nada.
- **Qué hacer:** borrar la ruta `DELETE` del mock. Así `mock-missing.json` deja de listarla.
- **Archivos:** `diagnostics.handlers.ts`.
- **Gherkin:**
  - Dado el mock, cuando alguien hace `DELETE /diagnostic-results/me/x/shares/y`, entonces recibe 404, igual que la API.

#### CL-54 · El bloque de intervenciones de la ficha queda vacío para un médico sin rol quirúrgico
- **Severidad:** Media. En mockup se ve y en dev no.
- **Tipo:** autorización.
- **Evidencia front:**
  - `features/clinical-record/patient-chart/procedures-block/procedures-block.ts:114,558` degrada ante 403.
  - `navigation.map.ts:475-479` limita `interventions` a `SURGEON|ANESTHESIOLOGIST|PERIOP_NURSE|SURGERY_SCHEDULER|PERIOP_ADMIN`.
  - El mock no aplica roles a `/procedure-cases` (`procedures.handlers.ts:101-141`).
- **Evidencia API:** `periop.controller.ts:103-130,263-272`. `@Roles` quirúrgicos en `GET /procedure-cases`, `/:id` y `/team-members`. Un `PRACTITIONER` o `CLINICIAN` recibe 403 al leer los procedimientos de **su** paciente.
- **Modelo:** `procedures_perioperative.procedure_cases`, `authz.user_role_assignments`.
- **Qué hacer:**
  - Backend: abrir la lectura por paciente (`GET /procedure-cases?patientProfileId=`) a `CLINICIAN`/`PRACTITIONER` con `ClinicalRecordAccessGuard`, como el resto del expediente.
  - O front: el mock tiene que imitar el 403 para que la demo no prometa lo que dev no da.
  - Sin confirmar qué roles tienen los usuarios demo de dev.
- **Archivos:** `periop.controller.ts`, `procedures.handlers.ts`.
- **Gherkin:**
  - Dado un médico tratante con acceso a la ficha, cuando abre el bloque de intervenciones de su paciente, entonces ve los casos del paciente.
  - Dado un médico sin relación de cuidado, cuando pide los casos, entonces recibe 403.

#### CL-55 · El Swagger de `CaseDetailDto.operativeSteps` omite `description`, que el front tipa como obligatorio
- **Severidad:** Baja.
- **Tipo:** contrato-respuesta (documentación).
- **Evidencia front:** `core/data-access/procedures/procedures.types.ts:31-41`, `description: string`.
- **Evidencia API:** `periop-cases.service.ts:1043-1054` sí la devuelve. `dto/periop.dto.ts:~860` no la declara, así que el cliente OpenAPI generado la perdería.
- **Modelo:** `procedures_perioperative.operative_steps.description text NOT NULL`.
- **Qué hacer:** agregar `description: string` al tipo del DTO.
- **Archivos:** `procedures_perioperative/dto/periop.dto.ts`.
- **Gherkin:**
  - Dado el contrato OpenAPI generado, cuando lo leo, entonces `operativeSteps[].description` es obligatorio.

#### CL-56 · El mock inventa estudios de imagen y preparación
- **Severidad:** Baja.
- **Tipo:** dato-inexistente-en-modelo (parcial).
- **Evidencia front:**
  - `diagnostics.handlers.ts:609-613`. Toda orden de ECO, RX, TAC o RMN genera un `imaging_study` con un `studyInstanceUid` fabricado, aunque el estudio no se haya hecho.
  - `:648`. `preparationInstructions` es un literal («Ayuno de 8 a 12 horas…») asociado a dos códigos.
- **Evidencia API:** `imaging_studies` solo existe si se hizo STOW (`POST /dicomweb/studies`). La preparación sale de la oferta publicada.
- **Modelo:** `diagnostics.imaging_studies(dicom_study_instance_uid)` y `diagnostic_units.diagnostic_study_offerings(preparation_instructions)`: las columnas existen, pero la relación orden→estudio es inventada.
- **Qué hacer:** el mock deriva el estudio solo de órdenes completadas y toma la preparación de la oferta del fixture de unidades.
- **Archivos:** `diagnostics.handlers.ts`.
- **Gherkin:**
  - Dada una orden de RX pendiente, cuando listo los estudios de imagen del paciente en mockup, entonces no aparece.

---

### Estado de los pendientes documentados de este alcance (en `dev`)

**Cerrados, con evidencia:**
- ESTADO-Y-PENDIENTES:368-373, lecturas del circuito quirúrgico: `GET /procedure-cases`, `/:id` y `/:id/team-members` existen (`periop.controller.ts:103,121,263`).
- ESTADO-Y-PENDIENTES:137-150, C-14: `accept` existe (`:285`). Spec 164: `respond` existe (`:315`).
- ESTADO-Y-PENDIENTES:381-382, lecturas de diagnóstico: `GET /diagnostics/work-orders` y `/diagnostics/patients/:id/imaging-studies` existen.
- Orden de rutas de `diagnostic-units` (`administration`/`search` antes de `:id`): cerrado. Ver la nota del inventario arriba.

**Abiertos:**
- REGISTRO-DEFECTOS:599 (B-15): `procedures_perioperative` sigue sin lecturas para casi todas sus 38 entidades. Hay 3 GET contra 24 escrituras, y no hay GET de valoración preoperatoria, plan anestésico, PACU ni implantes.
- ESTADO-Y-PENDIENTES:443: `procedures_perioperative` sin int-spec propio de eventos. No verificado en runtime en esta auditoría.
- `PENDIENTES-BACKEND.md` no tiene ningún P# de diagnóstico, laboratorio, procedimientos ni health-context. Los hallazgos CL-40 a CL-49 no están registrados en ningún documento de pendientes.
- La auditoría no incluye evidencia de runtime (no se levantó la API). Los veredictos salen de leer el código de ambos lados y quedan marcados donde corresponde.


---

## Parte · Parte D — forms · surveys · triage IA · consent (CL-60 … CL-79)

Base auditada: front `mantra-core-health` rama `mockup` (9b3e0101) + `origin/dev`; API
`mantra-core-health-redesa-api` rama `dev` (7541797c). ValidationPipe global confirmado en
`src/main.ts:160-161` (`whitelist: true`, `forbidNonWhitelisted: true`) → **toda clave que el DTO
no declare = 400**. Modelo: `Mantra Core Health Context/modules/diagram_09_forms.puml`,
`diagram_65_surveys.puml`, `SQL/09_forms`, `SQL/65_surveys`.

Rutas del front sin par en la API (confirmadas contra los `@Get/@Post/...` de los controllers):
`PATCH /forms/field-definitions/:id`, `PATCH /forms/assignments/:id`,
`DELETE /forms/assignments/:id`, `PUT /forms/assignments/order`, `PATCH /surveys/templates/:id`,
`PATCH|DELETE /surveys/templates/:id/questions/:questionId`,
`PUT /surveys/templates/:id/questions/order`, `POST /v1/triage/analyze` (servicio externo).
El mock `POST /surveys/templates/:id/publish` no lo usa ningún cliente (el cliente publica por
`/versions/:n/publish`, que sí existe).

---

#### CL-60 · El editor de encuestas no puede editar nada contra la API real
- **Severidad:** Bloqueante demo · **Tipo:** ruta-faltante
- **Front:** `src/app/features/questionnaires/survey-detail/survey-detail.ts:305` crea siempre
  `{questionText:'Pregunta nueva', answerType:'TEXT'}` y todo lo demás pasa por
  `updateQuestion` (`:322`), `deleteQuestion` (`:344`), `reorderQuestions` (`:374`);
  cliente `src/app/core/data-access/surveys/surveys.client.ts:165-167, 186-188, 206-208`.
- **API:** no existe. `src/modules/surveys/controllers/surveys-templates.controller.ts` sólo
  declara `POST /` (51), `GET /` (62), `GET /:id` (71), `POST /:id/questions` (81),
  `POST /:id/versions` (93), `POST /:id/versions/:versionNumber/publish` (104),
  `POST /:id/deactivate` (117), `GET /:id/responses` (135).
- **Efecto:** contra el backend real cada pregunta queda «Pregunta nueva / TEXT» para siempre
  (PATCH → 404), no se puede borrar ni reordenar. Con el mock funciona entero.
- **Modelo:** `surveys.survey_questions` (`position`, `question_text`, `answer_type_concept_id`,
  `required`, `options jsonb`, `scale_min`, `scale_max`, `row_version`) — el modelo **sí** soporta
  todo; sólo faltan los casos de uso. No hay dato inventado.
- **Qué hacer (backend):** 3 rutas en `SurveysTemplatesController` + métodos en
  `SurveysTemplatesService` reutilizando `loadOwnedTemplate` y la guarda de borrador que ya usa
  `addQuestion` (`surveys-templates.service.ts:182-195`, 422 si publicada). DTOs
  `UpdateQuestionDto` (todo opcional, mismas validaciones que `AddQuestionDto`) y
  `ReorderQuestionsDto { questionIds: uuid[] }`. Al cambiar `answerType`, anular
  `options/scale_*` que el tipo nuevo no usa; `DELETE` y `PUT order` renumeran `position` en la
  misma transacción. `@Version()` sobre `row_version`.
- **Archivos:** `src/modules/surveys/controllers/surveys-templates.controller.ts`,
  `services/surveys-templates.service.ts`, `dto/update-question.dto.ts` (nuevo),
  `dto/reorder-questions.dto.ts` (nuevo), `dto/index.ts`, specs. Front: nada (el cliente ya apunta
  ahí).
- **Gherkin:**
  - *Dado* una encuesta en borrador con 4 preguntas, *cuando* hago `DELETE …/questions/{2ª}`,
    *entonces* recibo 200 y el `GET` devuelve 3 preguntas con `position` 1,2,3.
  - *Dado* una versión publicada, *cuando* hago `PATCH …/questions/{id}`, *entonces* recibo 422
    y la pregunta no cambia.
  - *Dado* una pregunta `SINGLE_CHOICE` con opciones, *cuando* la paso a `TEXT`, *entonces* el
    `GET` la devuelve sin `options`.

#### CL-61 · Generador de formularios: editar, quitar y reordenar campos propios no existe
- **Severidad:** Alta · **Tipo:** ruta-faltante
- **Front:** `src/app/core/data-access/forms/forms.client.ts:158-168` (PATCH definición),
  `:180-190` (PATCH asignación), `:200-204` (DELETE asignación), `:216-226` (PUT order); usados en
  `src/app/features/form-builder/form-builder.ts:710, 714, 783, 827`.
- **API:** no existe. `forms-fields.controller.ts` sólo `POST field-definitions` (39),
  `POST fields/:id/dependencies` (52), `PUT fields/:id/localizations/:lang` (64),
  `POST fields/:id/access-rules` (77); `forms-assignments.controller.ts` sólo `GET /` (62),
  `GET budget` (110), `POST /` (131).
- **Efecto:** contra la API real el alta de un campo funciona (siempre nace `string` «Pregunta sin
  título», `form-builder.ts:563-566`) pero **cualquier edición posterior da 404**: no se puede
  renombrar, cambiar tipo, hacer obligatorio, quitar ni reordenar. Como un campo de elección se
  arma editando uno recién creado, en la práctica **no se pueden crear campos de elección**.
- **Modelo:** `forms.field_assignments` tiene `required`, `ordinal`, `valid_from/valid_to`,
  `state_concept_id` → PATCH/DELETE (lógico, `valid_to`/estado) y reorden son viables sin
  tocar el modelo. La definición (`dynamic_field_definitions`) ver CL-69.
- **Qué hacer:** backend `PATCH /forms/assignments/:id` (`required`, y quizá `visible/editable`),
  `DELETE /forms/assignments/:id` = baja lógica (`valid_to=now`, estado retirado — nunca DELETE
  físico si hay `field_values` que la referencian por `assignment_id`),
  `PUT /forms/assignments/order { targetResourceConceptId, assignmentIds[] }` sólo sobre
  asignaciones `tenant_id = tenant actual` (las del estándar: 403). Todo con `@Roles('CLINICIAN',
  'PRACTITIONER','SECURITY_ADMIN')` como el `POST`. PATCH de definición: ver CL-69 antes de
  implementarlo.
- **Archivos:** `src/modules/forms/controllers/forms-assignments.controller.ts`,
  `services/forms-assignments.service.ts`, `repositories/assignments.repository.ts`,
  `dto/update-assignment.dto.ts` y `dto/reorder-assignments.dto.ts` (nuevos).
- **Gherkin:**
  - *Dado* un campo propio del tenant, *cuando* hago `PATCH /forms/assignments/:id
    {required:true}`, *entonces* 200 y `GET /charts/templates/:id` lo devuelve `required:true`.
  - *Dado* un campo del formulario estándar (`own:false`), *cuando* intento `DELETE`, *entonces*
    403 y el campo sigue.
  - *Dado* un campo propio con valores capturados, *cuando* lo quito, *entonces* deja de ofrecerse
    pero sus valores históricos siguen legibles en `GET /forms/instances/:id`.

#### CL-62 · Declarar un campo de elección o duplicarlo da 400 (el doc dice que «se ignora»)
- **Severidad:** Alta · **Tipo:** contrato-body
- **Front:** `forms.types.ts:138-169` agrega a `CreateFieldDefinitionInput` `options`, `multiple`,
  `description`, `allowOther`, `rows`, `requireEachRow`, `oneResponsePerColumn`;
  `form-builder.ts:579-611` (`duplicarCampo`) los manda; `form-builder.ts:1211-1235`
  (`aCuerpoDeDefinicion`) los manda también en el PATCH.
- **API:** `src/modules/forms/dto/create-field-definition.dto.ts:80-187` sólo declara `code`,
  `name`, `dataType`, `sensitivityConceptId`, `semanticConceptId`, `valueSetId`,
  `unitValueSetId`, `cardinalityMin/Max`, `regex`, `validationRules`. Con
  `forbidNonWhitelisted` cualquiera de las 7 claves extra → **400**.
- **Falso en la documentación:** `mantra-core-health/docs/pendientes-backend-formularios.md`
  («Mientras tanto»): «Contra el backend real, las claves viajan y **se ignoran** … No rompe
  nada». Es incorrecto: rompe con 400. Duplicar cualquier campo con descripción o de elección
  falla.
- **Qué hacer:** front: no mandar claves no declaradas mientras el backend no las acepte (filtrar
  por un flag de capacidad o sólo en `mockup`); corregir el doc. Backend: ver CL-63 (dónde vive
  cada dato en el modelo) antes de ensanchar el DTO.
- **Archivos:** `src/app/features/form-builder/form-builder.ts`,
  `src/app/core/data-access/forms/forms.types.ts`, `docs/pendientes-backend-formularios.md`.
- **Gherkin:**
  - *Dado* la API real, *cuando* duplico un campo con descripción, *entonces* el `POST
    /forms/field-definitions` no recibe claves fuera del DTO y responde 201.
  - *Dado* `POST /forms/field-definitions` con `options`, *cuando* el backend no las soporta,
    *entonces* la pantalla explica que los campos de elección no están disponibles (no un 400
    genérico).

#### CL-63 · Opciones, «Otro», cuadrículas y descripción no existen en el modelo de `forms`
- **Severidad:** Alta · **Tipo:** dato-inexistente-en-modelo
- **Front/mock:** `surveys-forms.handlers.ts:478-489, 515-578` persiste en la definición
  `options`, `multiple`, `allowOther`, `rows`, `requireEachRow`, `oneResponsePerColumn`,
  `description`; `chart-templates.types.ts:49-117` los espera en cada campo.
- **Modelo:** `diagram_09_forms.puml` `dynamic_field_definitions` no tiene ninguna de esas
  columnas. Lo que el modelo sí declara: opciones → `value_set_id` (terminología) y el valor
  capturado → `field_values.value_concept_id` (FK a `terminology.concepts`,
  `SQL/09_forms/90_fk_deferred.sql:257`); «varias respuestas» → `cardinality_max`; ayuda bajo la
  pregunta → `field_definition_localizations.help_text` (ya expuesto por
  `PUT /forms/fields/:id/localizations/:lang`, `forms-fields.controller.ts:64`); repetición por
  fila de cuadrícula → `field_values.instance_group_id` (sin confirmar que sea la semántica
  pretendida). `allowOther` (texto libre en un campo `code`) y `oneResponsePerColumn` no tienen
  lugar en el modelo.
- **Decisión pendiente (no técnica):** el doc propone `options jsonb` en texto libre, lo que
  contradice el modelo (valores codificados vía value set). Regla de temperatura-0: no se
  inventa columna; o se promueve al `.puml` (módulo 09) con las 4 capas, o el generador crea un
  value set local del tenant por campo.
- **Qué hacer:** decidir con el dueño del modelo; si se promueve, `.puml` → `SQL/09_forms` →
  entidades → DTO. Mientras tanto `description` puede ir ya por localizaciones.
- **Archivos:** `Mantra Core Health Context/modules/diagram_09_forms.puml`, `salud-db/gen_ddl.py`
  (regenerar), `src/modules/forms/entities/dynamic_field_definitions.entity.ts`, DTOs.
- **Gherkin:**
  - *Dado* un campo `code` creado con opciones, *cuando* se lee la plantilla, *entonces* las
    opciones vuelven en el mismo orden en que se declararon.
  - *Dado* un campo con descripción, *cuando* se guarda, *entonces* queda en
    `field_definition_localizations.help_text` del idioma de la sesión.

#### CL-64 · `GET /charts/templates/:id` no devuelve opciones ni metadatos del campo
- **Severidad:** Media · **Tipo:** contrato-respuesta
- **Front:** `src/app/core/data-access/chart-templates/chart-templates.types.ts:25-125`
  (`ChartTemplateField` con `options`, `multiple`, `description`, `allowOther`,
  `cardinalityMin/Max`, `rows`, `requireEachRow`, `oneResponsePerColumn`).
- **API:** `src/modules/chart/dto/templates.dto.ts:222-252` (`ChartTemplateFieldDto`: sólo
  `assignmentId, fieldId, code, name, dataType, valueSetId, required, ordinal, own`).
- **Efecto:** un campo de elección vuelve como texto; la vista previa del generador y el bloque de
  captura lo dibujan como input libre. Además los 43 JSON sembrados
  (`src/common/seed/data/clinical-forms/**`) no traen opciones (NYHA se siembra como `integer`).
- **Qué hacer:** si se resuelve CL-63, agregar `cardinalityMin/Max` (ya existen en la entidad),
  `helpText` (localización) y las opciones resueltas del value set al DTO.
- **Archivos:** `src/modules/chart/dto/templates.dto.ts`, `services/chart-templates.service.ts`.
- **Gherkin:**
  - *Dado* un campo con `value_set_id`, *cuando* leo la plantilla, *entonces* cada opción viene
    con `conceptId` y etiqueta.
  - *Dado* un campo con `cardinality_max > 1`, *cuando* leo la plantilla, *entonces*
    `cardinalityMax` viene informado.

#### CL-65 · Capturar un campo de elección rompe: `code` exige un concept id y un escalar
- **Severidad:** Alta · **Tipo:** contrato-body
- **Front:** `src/app/features/clinical-record/patient-chart/specialty-form-block/specialty-form-block.ts:1022-1037`
  manda `value` crudo del control: texto de la opción («Ex fumador»), un array (casillas) o un
  objeto `{fila: columna}` (cuadrícula); `ordinal` = índice del campo en la plantilla.
- **API:** `src/modules/forms/services/value-columns.ts:76` → `code` se guarda en
  `valueConceptId` (uuid con FK a `terminology.concepts`); `scalarString` (`:4-20`) lanza 422
  «debe ser escalar» para arrays/objetos. Texto no-uuid en `value_concept_id` → error de
  Postgres (22P02/23503; código HTTP devuelto sin confirmar, probable 500).
- **Semántica:** `ordinal` en la API es «orden dentro del campo (cardinalidad)»
  (`capture-values.dto.ts`), no la posición del campo en el formulario.
- **Qué hacer:** front: una fila por opción marcada con `ordinal` 0..n y el `conceptId` de la
  opción; `ordinal` 0 para campos de un valor. Backend: validar que `value_concept_id` pertenezca
  al value set del campo (422 tipificado, no 500).
- **Archivos:** `specialty-form-block.ts`, `src/modules/forms/services/forms-values.service.ts`,
  `value-columns.ts`.
- **Gherkin:**
  - *Dado* un campo de casillas con 2 opciones marcadas, *cuando* guardo, *entonces* se envían 2
    valores con `ordinal` 0 y 1 y responde 201.
  - *Dado* un `value` de tipo `code` que no es un concept del value set, *cuando* se captura,
    *entonces* 422 con mensaje, nunca 500.

#### CL-66 · Completar un formulario son 3 transacciones y el reintento queda bloqueado (409)
- **Severidad:** Alta · **Tipo:** invariante
- **Front:** `specialty-form-block.ts:993-1000` encadena `POST /forms/instances` →
  `POST /forms/instances/:id/values` → `POST /forms/instances/:id/close`.
- **API:** cada paso es su propia `em.transactional` (`forms-instances.service.ts:76`,
  `forms-values.service.ts:63`, `forms-instances.service.ts:133`), y `openInstance` rechaza con
  **409** una segunda instancia para el mismo `resourceId`+`schemaVersion`
  (`forms-instances.service.ts:88-99`).
- **Efecto:** si falla la captura (p.ej. CL-65), queda una instancia abierta vacía; el reintento da
  409 y la ficha ya no se puede completar en ese encuentro. Además **un encuentro sólo admite un
  formulario** por versión: anamnesis + consentimiento en la misma consulta → el segundo da 409.
  Viola «un caso de uso = una transacción».
- **Qué hacer:** backend: caso de uso atómico `POST /forms/instances:complete`
  `{resourceId, definitionSetVersionId?, values[]}` que abre+captura+cierra en una transacción;
  o que `openInstance` sea idempotente (devolver la abierta existente). Revisar la clave de
  unicidad: debería incluir la plantilla (ver CL-67).
- **Archivos:** `src/modules/forms/services/forms-instances.service.ts`,
  `controllers/forms-instances.controller.ts`, `repositories/form-instances.repository.ts`;
  front `specialty-form-block.ts`.
- **Gherkin:**
  - *Dado* una captura que falla por un valor inválido, *cuando* reintento con valores válidos,
    *entonces* el formulario se guarda (sin 409).
  - *Dado* un encuentro con la anamnesis guardada, *cuando* completo el consentimiento en el mismo
    encuentro, *entonces* se guarda como otra instancia.

#### CL-67 · La instancia de formulario no registra qué plantilla se completó
- **Severidad:** Media · **Tipo:** dato-inexistente-en-modelo
- **Front:** `specialty-form-block.ts:994` abre con `{ resourceId }` solamente; la lectura
  (`:746-755`) re-pinta por `fieldName`.
- **API/modelo:** `OpenInstanceDto.definitionSetVersionId` existe (`open-instance.dto.ts`) pero el
  front no lo manda; `forms.form_instances` en el `.puml` no tiene columna de plantilla/set
  (sólo `schema_version`). Las plantillas de chart no están ligadas a `field_definition_sets`
  (sin confirmar).
- **Qué hacer:** decidir el vínculo instancia→plantilla (set versionado inmutable,
  `field_definition_set_versions <<IMMUTABLE>>`) y mandarlo al abrir.
- **Archivos:** `specialty-form-block.ts`, `forms.types.ts` (`OpenFormInstanceInput`), servicio de
  chart-templates.
- **Gherkin:**
  - *Dado* un formulario guardado, *cuando* lo leo meses después, *entonces* sé qué plantilla y
    versión se usó aunque la plantilla haya cambiado.

#### CL-68 · Cualquier sesión (incluido un paciente) puede declarar campos globales y reescribir etiquetas
- **Severidad:** Alta · **Tipo:** autorización
- **API:** `src/modules/forms/controllers/forms-fields.controller.ts:27-29` — el controller no tiene
  `@Roles` de clase; `POST field-definitions` (39), `POST fields/:id/dependencies` (52) y
  `PUT fields/:id/localizations/:lang` (64) no tienen `@Roles` (sólo `access-rules` lo tiene, 78).
  El comentario del front lo asume: «declarar sólo pide sesión» (`forms.client.ts:124-126`).
- **Riesgo:** `dynamic_field_definitions` es **global** (sin `tenant_id` en el modelo): un paciente
  autenticado puede crear definiciones y, peor, `PUT …/localizations` cambia `label`/`help_text`
  de un campo del **estándar** para toda la plataforma.
- **Qué hacer:** `@Roles('CLINICIAN','PRACTITIONER','SECURITY_ADMIN')` en las tres; localizaciones
  de campos del estándar sólo `SECURITY_ADMIN`.
- **Archivos:** `src/modules/forms/controllers/forms-fields.controller.ts`, spec.
- **Gherkin:**
  - *Dado* una sesión con rol PATIENT, *cuando* hace `POST /forms/field-definitions`, *entonces*
    403.
  - *Dado* un profesional, *cuando* hace `PUT /forms/fields/{campo estándar}/localizations/es`,
    *entonces* 403.

#### CL-69 · El PATCH de definición que pide el front reescribe la historia clínica
- **Severidad:** Alta · **Tipo:** invariante
- **Front:** `forms.client.ts:147-168` («esto cambia el campo dondequiera que esté colgado. Es lo
  correcto»); mock `surveys-forms.handlers.ts:515-578` cambia `dataType`/`options` sin mirar si
  hay valores; `docs/pendientes-backend-formularios.md` §2 deja abierta «qué pasa con los valores ya
  capturados».
- **Modelo:** `dynamic_field_definitions` sin `tenant_id` (compartida entre tenants), con
  `schema_version` y `field_values` que guardan el valor en la columna `value_*` según el tipo.
  Cambiar `dataType` de un campo con valores deja datos en la columna equivocada; quitar/renombrar
  una opción deja valores huérfanos de significado.
- **Qué hacer:** backend: permitir PATCH de definición sólo si (a) no hay `field_values` y (b)
  todas sus asignaciones son del tenant del actor; en otro caso 409 y el front crea una
  definición nueva y reasigna (versionado, no update). Retirar opción = marcarla retirada, nunca
  borrarla (opción 1 del doc).
- **Archivos:** `forms-fields.service.ts`, nuevo `dto/update-field-definition.dto.ts`;
  front `form-builder.ts:704-715`.
- **Gherkin:**
  - *Dado* un campo con valores capturados, *cuando* intento cambiar su `dataType`, *entonces*
    409 y los valores previos siguen legibles.
  - *Dado* un campo asignado también en otro tenant, *cuando* intento renombrarlo, *entonces* 409
    (o 403) y el otro tenant no ve cambios.

#### CL-70 · Nueva versión de encuesta: el mock copia las preguntas, la API la abre vacía
- **Severidad:** Media · **Tipo:** contrato-respuesta
- **Front:** `survey-detail.ts:444-451` («Abre una versión nueva en borrador, para corregir el
  cuestionario»); mock `surveys-forms.handlers.ts:185-191` sólo mueve `latestVersionId` y **deja
  las preguntas** en el objeto → en el simulador la nueva versión aparece con todo el
  cuestionario anterior, editable.
- **API:** `src/modules/surveys/services/surveys-templates.service.ts:127-171` crea la versión con
  `responseWindowDays` y **ninguna pregunta** (no hay copia de `survey_questions`).
- **Efecto:** en la demo real «corregir» una encuesta publicada = reescribirla desde cero (y, por
  CL-60, sin poder editar las preguntas).
- **Qué hacer:** backend: copiar `survey_questions` de la versión anterior a la nueva en la misma
  transacción (la vieja sigue inmutable). Mock: si se decide que no copie, alinear.
- **Archivos:** `surveys-templates.service.ts`, `repositories/*` de surveys; mock handler.
- **Gherkin:**
  - *Dado* una versión 1 publicada con 5 preguntas, *cuando* creo la versión 2, *entonces* el
    `GET` devuelve la v2 en borrador con las 5 preguntas copiadas y la v1 intacta.

#### CL-71 · Deriva menor del simulador de encuestas
- **Severidad:** Baja · **Tipo:** otro
- **Front/mock:** `surveys-forms.handlers.ts:320-324` lee `appointmentBookingIds[]` pero el
  cliente manda `appointmentBookingId` (`surveys.client.ts:297-300`, API
  `issue-invitations.dto.ts:21-22`); `:292-298` ruta `POST /surveys/templates/:id/publish` que
  ningún cliente usa y que la API no tiene; `:299-304` ignora el cuerpo con la vigencia;
  `:342-347` devuelve `invitationId/submittedAt` además de `id` (API `IdResponseDto`).
- **Qué hacer:** alinear el handler al DTO y borrar la ruta muerta.
- **Archivos:** `src/app/core/mock/handlers/surveys-forms.handlers.ts`.
- **Gherkin:**
  - *Dado* el simulador, *cuando* emito invitaciones para una reserva, *entonces* lee
    `appointmentBookingId` y devuelve un id por asignación vigente.

#### CL-72 · `PATCH /surveys/templates/:id` (título, consigna, plazo) sin pantalla y sin API
- **Severidad:** Baja · **Tipo:** ruta-faltante
- **Front:** `surveys.client.ts:146-148` (`updateSurvey`) — ningún componente lo llama (grep en
  `features/`). **API:** no existe.
- **Modelo:** `survey_templates.title/description` y `survey_versions.response_window_days` (este
  último por versión: editar el plazo sólo debe tocar la versión en borrador).
- **Qué hacer:** decidir si entra; si no, quitar el método muerto.
- **Gherkin:** *Dado* un borrador, *cuando* corrijo el título, *entonces* 200 y en versión
  publicada el plazo no cambia.

#### CL-73 · Triage IA: `POST /v1/triage/analyze` no existe en la API y su ruteo en producción no está versionado
- **Severidad:** Media (Alta si la demo muestra la lectura por IA) · **Tipo:** ruta-faltante
- **Front (sólo `mockup`; `origin/dev` no tiene `aiBaseUrl`):**
  `src/app/core/data-access/triage-ia/triage-ia.client.ts:52-62` (usa `HttpBackend`, sin
  interceptores ni mock, timeout 4 s, **cualquier error → `null` en silencio**);
  `src/environments/environment.ts:29` `aiBaseUrl ?? '/ai'`; `proxy.conf.mjs:35-43` reenvía `/ai`
  a `https://ai.173.249.39.237.sslip.io` sólo en `yarn start`.
- **API:** no existe en `mantra-core-health-redesa-api` (el servicio es «AlovidaAIService», otro
  repo, **no presente en el workspace**; el contrato citado `docs/contracts/openapi.json` de ese
  repo no se pudo verificar → sin confirmar). En producción depende de una regla de Traefik
  para `/ai` que no está en este repo (`docker-compose.yml` no la declara) → sin confirmar.
- **Efecto:** si `/ai` no está ruteado en el despliegue, la pantalla degrada al motor local sin
  ningún aviso; nadie se entera de que la IA no participa.
- **Qué hacer:** versionar la regla de ruteo `/ai` junto al despliegue; agregar un health-check o
  una marca visible/telemetría cuando la lectura IA no llegó; copiar el contrato OpenAPI al front
  (o test de contrato).
- **Archivos:** despliegue (Traefik/Coolify, fuera del repo), `triage-ia.client.ts`,
  `symptom-check.ts:229-238`.
- **Gherkin:**
  - *Dado* el despliegue de demo, *cuando* hago `POST /ai/v1/triage/analyze {text}`, *entonces*
    200 con `symptoms[]` y `urgency`.
  - *Dado* el servicio caído, *cuando* el paciente analiza síntomas, *entonces* ve el resultado
    local y queda registrado un evento de telemetría «ia-no-disponible».

#### CL-74 · Contrato de la respuesta de triage no verificable
- **Severidad:** Baja · **Tipo:** contrato-respuesta
- **Front:** `triage-ia.client.ts:66-90` exige `urgency ∈ {urgente, prioritaria, programada}` (en
  castellano), `kind ∈ {curated, anatomy}`, `zones[]` con los mismos ids que `ZONAS_DEL_CUERPO`
  (`zonas.datos.ts`) y especialidades por **nombre** (`triage-ia.types.ts:10-13`), no por
  `concept_id`. Cualquier desvío se descarta en silencio.
- **API:** externa, sin confirmar. Especialidades por nombre contradicen la regla del proyecto
  (conceptos por `*_concept_id`); la pantalla lo compensa mapeando por nombre normalizado contra
  una sola página de profesionales (`symptom-check.ts:524-540`) — especialidades fuera de esa
  página caen a búsqueda por texto.
- **Qué hacer:** que el servicio devuelva el `code` de `VS_MEDICAL_SPECIALTY` junto al nombre;
  test de contrato.
- **Gherkin:** *Dado* una respuesta con una especialidad del catálogo, *cuando* el paciente pulsa
  «ver profesionales», *entonces* navega con `especialidad=<conceptId>`.

#### CL-75 · Dictado y texto de síntomas salen a terceros sin base legal registrada
- **Severidad:** Media · **Tipo:** otro (privacidad)
- **Front (sólo `mockup`):** `src/app/features/symptom-check/dictado.ts:32` usa
  `SpeechRecognition ?? webkitSpeechRecognition` (en Chrome el audio se procesa en servidores de
  Google); el texto se envía al servicio de IA externo sin sesión (`triage-ia.client.ts:39-43`);
  `src/server/security-headers.ts` pasó a `microphone=(self)`.
- **Modelo:** `consent.processing_legal_bases` / `consent.consents` existen (módulo 07) y no se
  registra nada. Síntomas son dato de salud.
- **Qué hacer:** aviso explícito antes de dictar/enviar; decidir base legal; opcional: registrar
  consentimiento del paciente logueado.
- **Gherkin:** *Dado* un paciente que pulsa «Dictar», *cuando* es la primera vez, *entonces* ve
  qué servicio procesa su voz y debe aceptarlo antes de grabar.

#### CL-76 · El resultado del chequeo de síntomas no se persiste en ningún lado
- **Severidad:** Baja · **Tipo:** dato-inexistente-en-modelo (informativo)
- No hay entidad de triage en el modelo (grep `triage|symptom` en `modules/*.puml`: sólo menciones
  en `diagram_32_workflow` y `diagram_36_qa_lab`). La pantalla navega a resultados con query params
  (`symptom-check.ts:507-510`) y no deja rastro en la historia. Si el producto quiere «llevar lo
  que conté al médico», falta modelo (no inventar tabla: promover al `.puml`).
- **Gherkin:** *Dado* un paciente que completa el chequeo, *cuando* reserva con el especialista
  sugerido, *entonces* (si se decide) el profesional ve el resumen del chequeo en la reserva.

#### CL-77 · El módulo `consent` no tiene cliente ni lecturas; el consentimiento informado se guarda como formulario
- **Severidad:** Alta (legal) · **Tipo:** autorización / ruta-faltante
- **Front:** no hay `core/data-access/consent/`; la única llamada de consentimiento es
  `POST /geo/tracked-subjects/:id/revoke-consent` (`geo.client.ts`). El «consentimiento
  informado» se completa como plantilla transversal de `forms` (`specialty-form-block.ts:170-180`;
  seed `src/common/seed/data/clinical-forms/transversal/consentimiento-informado.json`).
- **API:** `src/modules/consent/controllers/*` — **cero `GET`**; todas las escrituras con
  `@Roles('SECURITY_ADMIN')` salvo `practitioner-access-requests` (`:32` PRACTITIONER/CLINICIAN,
  `:47`,`:59` PATIENT). `treatment-informed-consents.controller.ts:26` sólo SECURITY_ADMIN → un
  médico no puede registrar el consentimiento de tratamiento donde el modelo lo espera.
- **Modelo:** `consent.treatment_informed_consents` (módulo 07) queda vacío; el consentimiento real
  vive en `forms.field_values` sin firma ni vínculo al procedimiento.
- **Qué hacer:** decidir fuente de verdad; si es `consent`, habilitar `CLINICIAN/PRACTITIONER` en
  `POST treatment-informed-consents`, agregar lecturas por paciente/encuentro y cliente en front;
  el formulario transversal pasa a generar ese registro.
- **Archivos:** `src/modules/consent/controllers/treatment-informed-consents.controller.ts`,
  servicio y DTO; front nuevo `core/data-access/consent/consent.client.ts`.
- **Gherkin:**
  - *Dado* un médico en un encuentro, *cuando* registra el consentimiento informado, *entonces*
    queda una fila en `consent.treatment_informed_consents` ligada al paciente y al encuentro.
  - *Dado* un paciente, *cuando* consulta sus consentimientos, *entonces* ve los vigentes y
    retirados.

#### CL-78 · Estado de los documentos de pendientes (dominio forms/surveys/consent)
- **Severidad:** Baja · **Tipo:** otro
- `docs/pendientes-backend-surveys.md` (4 rutas): **abierto** — ninguna existe en
  `surveys-templates.controller.ts` (CL-60, CL-72).
- `docs/pendientes-backend-formularios.md` §1–§4 (opciones, 1b, cuadrículas, PATCH, lectura,
  captura): **abierto entero**; §«Mientras tanto» **incorrecto** (400, no «se ignoran» — CL-62).
  §1d (`boolean` con tres estados): la API no convierte ausente en `false`
  (`value-columns.ts` sólo escribe lo enviado) → **cerrado por construcción** (sin prueba runtime).
- `REGISTRO-DEFECTOS.md` R-7 / B-7 (schema `surveys` inexistente, 500 en «Mis cuestionarios»):
  **cerrado** — módulo 65 en `diagram_65_surveys.puml` y `SQL/65_surveys/`; el `TODO(F-14)` ya no
  existe en `src/modules/surveys`.
- `REGISTRO-DEFECTOS.md:592` «`forms` 0/13 GET»: **desactualizado / cerrado en parte** — hoy hay
  `GET /forms/instances`, `/forms/instances/:id`, `/forms/me/instances[/:id]`,
  `/forms/assignments`, `/forms/assignments/budget`, `/forms/definition-sets[/:id]`.
- `ESTADO-Y-PENDIENTES.md:208` fuga cross-tenant del presupuesto de `forms`: **cerrado** según el
  propio documento (el GET budget filtra por `getCurrentTenantId()`,
  `forms-assignments.controller.ts:124-127`).
- `PENDIENTES-BACKEND.md` P25 («en todos los formularios un adjunto»): **abierto** — el generador
  no ofrece `binary` (lo filtra por diseño, `forms.types.ts:113-121`) y no hay ruta de adjuntos
  por instancia de formulario.

#### CL-79 · Asignar una encuesta pide tipear a mano el UUID del servicio
- **Severidad:** Baja · **Tipo:** otro
- **Front:** `survey-detail.ts:414-427` manda `targetType:'SERVICE'` y `targetId` del input de
  texto (`formularioAsignacion.targetId.trim()`). **API:** `create-assignment.dto.ts:20-41` pide
  `@IsUUID()`; `CARE_TYPE` se rechaza (spec `surveys-assignments.service.spec.ts:164-177`).
- **Qué hacer:** selector de servicios del catálogo (`/billing/service-catalog/...`), no un campo
  libre; ocultar `CARE_TYPE` del tipo del front (`surveys.types.ts:24`).
- **Gherkin:** *Dado* una encuesta publicada, *cuando* la asocio, *entonces* elijo el servicio de
  una lista y no escribo un identificador.
