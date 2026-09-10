# Lo que el frontend espera del backend

**Actualizado:** 2026-08-23 — **P15 a P18 son nuevos**, del plan de UX del 22/08. Antes: 2026-08-12 (tarde) · **P14 tiene diagnóstico nuevo y procedimiento de cierre —
ver su sección: el modelo YA tiene las columnas; lo que falta es aplicar un patch en cada
entorno con base viva.** P6 a P13 siguen cerrados y comprobados **contra la API viva** en
`localhost:3000`, con la imagen reconstruida — no leyendo el código.

| | Cómo se cerró |
| --- | --- |
| **P6** alta administrativa de profesional | construido · `POST /iam/users/assisted-practitioner-registration` |
| **P7 · P8** catálogos y sus bindings | **ya estaban resueltos**; el sondeo anterior usó identificadores equivocados |
| **P9** fusión reversible más tarde | construido · `GET /profiles/patients/merge-events` |
| **P10** colecciones de `iam`/`directory` | **ya estaban resueltas** (PR #38) |
| **P11** cita clínica en la reserva | construido · expuesta en las dos lecturas |
| **P12** perfil profesional de la sesión | construido · claim `hpid` |
| **P13** nada creaba citas clínicas | construido · las crea la confirmación de la reserva |

Dos de los siete no eran defectos sino **errores de comprobación míos**, y quedan anotados como tales:
un 404 pedido con el identificador equivocado no prueba que algo no exista.

Este archivo existe para no reconstruir de memoria qué falta. Lo resuelto queda anotado igual: saber
que algo dejó de ser un problema es tan útil como saber que lo sigue siendo.

---

## Abierto · P26 · La alergia no sabe en qué cita se detectó, y no tiene catálogos

**Levantado el 2026-09-10**, construyendo el alta de alergias. El cliente lo pidió como calco del
diagnóstico:

> «Debe aparecer un campo select para colocar la enfermedad detectada en base a una cita ya
> existente y/o finalizada. **Lo mismo para alergias.**»

### 1 · Falta la columna del encuentro

`clinical.allergy_intolerances` tiene custodio, paciente, sustancia, tipo, categoría, criticidad,
estado clínico y verificación — **y ningún `encounter_id`**. `CreateAllergyIntoleranceDto` tampoco
lo acepta.

| Capa | Qué hace falta |
| --- | --- |
| Modelo | `encounter_id uuid NULL` (FK → `clinical.encounters`) en `clinical.allergy_intolerances`. Camino obligatorio: `.puml` → `gen_ddl.py` → `SQL/` → patch → `gen_entities.py`. **Nunca un `ALTER` a mano** (ADR-0021). |
| DTO de alta | `encounterId?` con `@IsUUID()`. |
| DTO de lectura | `encounterId?` en `AllergyItemDto`. |

La pantalla **ya lo manda**; contra la API de hoy da 400.

### 2 · No hay ningún catálogo de alergia

Esto es lo más grande, y es lo que impedía que el formulario existiera.

`dynamic-enum-catalog.ts` **no declara un solo `target` de
`clinical.allergy_intolerances.*` ni de `clinical.allergy_reactions.*`**. Los conceptos de alergia
del backend son **cinco sueltos** (`ALG_ACTIVE`, `ALG_CONFIRMED`, `ALG_TYPE`,
`ALG_CATEGORY_MEDICATION`, `ALG_HIGH`), sin conjunto de valores que los agrupe.

Sin catálogo no hay selector, y sin selector no hay formulario: por eso el contrato estaba entero
desde el principio y **ninguna pantalla lo usaba**.

Hacen falta cinco bindings, con sus conjuntos:

| Target | Conjunto |
| --- | --- |
| `clinical.allergy_intolerances.substance_concept_id` | Alérgenos que no son medicamentos (los medicamentos ya salen del vademécum) |
| `clinical.allergy_intolerances.type_concept_id` | Alergia / intolerancia |
| `clinical.allergy_intolerances.category_concept_id` | Medicamento, alimento, ambiental, biológico |
| `clinical.allergy_intolerances.criticality_concept_id` | Baja / alta / no determinable |
| `clinical.allergy_reactions.manifestation_concept_id` | Manifestaciones clínicas |

### ⚠️ Los códigos de la maqueta son provisionales y están declarados como tales

El simulador acuña `VS_ALLERGY_TYPE`, `VS_ALLERGY_MANIFESTATION` y `VS_ALLERGY_SUBSTANCE` con
listas cortas —ocho manifestaciones, diez sustancias— para que el formulario se pueda ver y probar.
**No son un catálogo clínico publicado**, y el comentario del propio fixture lo dice, con el mismo
criterio que `bo-occupations.catalog.ts`.

El real tiene que salir de una fuente —un subconjunto de SNOMED CT, o el que el equipo clínico
apruebe— con su procedencia declarada, igual que las 43 fichas estándar. **No lo inventamos acá.**

Al reemplazarlos hay migración de datos: los identificadores se derivan del código.

---

## Abierto · P25 · Sólo diagnósticos y procedimientos aceptan adjuntos

**Levantado el 2026-09-10.** El cliente lo pidió como regla transversal:

> «En todos los formularios debe de poderse poner un adjunto, un gestor para subir archivos de
> todo tipo y formato **y en varias cantidades**, incluso en la medicación, para referencias o
> relaciones.»

### Lo que hay

`OwnerType` (`common/dto/enums.ts`) declara cinco: `USER`, `PATIENT`, `TENANT`, `CONDITION`,
`PROCEDURE`. Y hay dos rutas de dominio: `POST /clinical/conditions/:id/attachments` y
`POST /clinical/procedures/:id/attachments`.

### Lo que falta

**Tres tipos de dueño y dos rutas.** La receta y la alergia no tienen dónde colgar un archivo, y
son justamente los dos que el cliente nombró.

| Capa | Qué hace falta |
| --- | --- |
| Conceptos | `OWNER_MEDICATION_REQUEST`, `OWNER_ALLERGY_INTOLERANCE`, `OWNER_ENCOUNTER` en `common/constants/concepts.ts`, con el mismo `def('common:owner-type:…')`. **No toca el `.puml`**: `file_links.owner_type_concept_id` es FK a terminología y el concepto se siembra al arrancar — lo dice el propio comentario de `files.types.ts`. |
| Enum | Los tres valores en `OwnerType`. |
| Rutas | `POST /clinical/medication-requests/:id/attachments` y `POST /clinical/allergy-intolerances/:id/attachments`, con su `attachFile()` **calcado de `procedures.service.ts`**: busca el recurso → 404 si no está → `filesService.createLink`. Son diez líneas cada una. |

El genérico `POST /common/files/:id/links` **no alcanza** para dato clínico: no exige rol ni
verifica que el dueño exista. Es a propósito —sirve a cualquier contexto— y por eso cada dominio
liga por el suyo.

### «De todo tipo y formato»: se amplía con firmas, no se abre

`UPLOAD_MIME_ALLOWLIST` admite hoy ocho tipos —PDF, JPEG, PNG, WebP, GIF, DOCX, XLSX y texto— y el
tipo se detecta por **firma de bytes** (`sniffMimeType`), no por extensión. Eso es lo que impide
subir un ejecutable renombrado `.pdf`, y la regla `40-security.md` lo exige.

Ampliarlo es agregar **firma + entrada** por cada formato nuevo: DICOM (`DICM` en el byte 128),
HEIC/HEIF, TIFF, MP4/MOV (`ftyp`), MP3, WAV, ZIP, PPTX, CSV/RTF. Lo que **no** se debe hacer es
aceptar cualquier cosa sin sniffing.

Mientras tanto la pantalla **dice la lista real** en su ayuda en vez de prometer «todo tipo»: una
promesa que el servidor va a romper con un 422 es peor que un límite dicho.

### Varios archivos por petición no hace falta

El frontend sube **en secuencia** —el backend recibe uno por petición,
`FileInterceptor('file', { files: 1 })`— y el vínculo es por archivo. Si más adelante se quiere una
sola transacción, `POST /charts/documents` ya recibe `files[]`.

### Estado del frontend

El subidor ya toma tandas de hasta diez, deduce la categoría del tipo del archivo, muestra
«Adjuntando 3 de 7…» y no cancela la tanda por uno que falle. La maqueta sirve las dos rutas
nuevas. **Contra la API de hoy responden 404** hasta que existan.

---

## Abierto · P24 · La receta no puede llevar un motivo escrito

**Levantado el 2026-09-10.** El cliente lo pidió textual:

> «Se debería de poder poner o escoger en una lista en la que salgan los diagnósticos ya
> existentes **y una opción de poder escribir un título de diagnóstico propio**, porque puede
> existir el caso que sólo se fue a hacer recetar y no necesitaría diagnóstico existente previo,
> sobre todo casos psiquiátricos.»

### Lo que ya existe

`indicationConditionId` (Patch v4.1.6): la receta apunta a una condición **registrada**, el
servidor comprueba que sea del mismo paciente y responde 422 si no. Está en el DTO de alta y en
`MedicationRequestItemDto`.

### Lo que falta

**Una columna de texto.** `clinical.medication_requests` tiene `indication_condition_id` y ningún
campo de texto para el motivo. Sin ella, la mitad del pedido —el caso psiquiátrico, y el de quien
sólo fue a que le receten— no tiene dónde guardarse.

| Capa | Qué hace falta |
| --- | --- |
| Modelo | `indication_text varchar(200) NULL` en `clinical.medication_requests`. Camino obligatorio: `.puml` → `gen_ddl.py` → `SQL/` → patch para bases vivas → `gen_entities.py`. **Nunca un `ALTER` a mano** (ADR-0021). |
| DTO de alta | `indicationText?` con `@MaxLength(200)` en `CreateMedicationRequestDto` y en `EditMedicationRequestDraftDto`. |
| DTO de lectura | `indicationText?` en `MedicationRequestItemDto`. |
| Servicio | **Excluyente con la condición, y el concepto gana** si llegaran los dos — el mismo criterio que `occupation_free_text` frente a `occupation_concept_id` en `persons`. |
| PDF | La receta impresa muestra uno u otro bajo «Diagnóstico». |

### Estado del frontend

La pantalla **ya lo manda** (`indicationText`) y la maqueta lo guarda y lo muestra. **Contra la API
de hoy da 400**: `forbidNonWhitelisted` rechaza la petición entera por la clave que el DTO no
declara. Es el mismo muro de P19, P20 y P22.

### Dos cosas que este trabajo destapó y NO son pendientes

- **La lectura ya traía el diagnóstico y el frontend lo tiraba.** `MedicationRequestItemDto`
  publica `indicationConditionId` desde v4.1.6 y el tipo de vista `MedicationRequest` no lo
  declaraba: el dato llegaba y nadie podía leerlo con tipos. Corregido acá, sin tocar el backend.
- **«La receta a la que pertenece esa medicación» no existe como entidad.** En este modelo **cada
  `medication_request` es una línea**; lo que agrupa varias es el encuentro y su fecha, y eso es lo
  que la tabla muestra ahora en «Receta de». Un **número de receta** compartido por varias líneas
  sería una entidad nueva (`prescriptions` con sus `lines`), no un campo: es decisión de modelo y
  de negocio, no un arreglo de pantalla. **Queda planteado, sin resolver.**

---

## Abierto · P23 · Cambiar un horario que tiene citas es imposible hoy

**Levantado el 2026-09-10**, arreglando «la cita no acaba a la hora que debería». Es la causa
raíz de ese reporte, y no está en el frontend.

### Lo que pasa

Cambiar el horario creaba una plantilla **más** y dejaba viva la anterior; nadie llamaba a
`DELETE /scheduling/templates/:id`. Como `generate-slots` es idempotente **por instante de
inicio** —lo dice su contrato y lo hace el simulador—, el cupo de las 08:00 sobrevivía con su
fin viejo: pasar las consultas de 30 a 45 minutos dejaba el turno de las 08:00 terminando a las
08:30.

El frontend ya lo arregla llamando al retiro **antes** de publicar. Y ahí aparece el muro.

### El muro

`retireTemplate` (`scheduling-catalog.service.ts:963`) rechaza con **409** en cuanto hay **una**
cita viva —`ACTIVE_BOOKING_STATES` = `BOOKING_CONFIRMED` + `BOOKING_CHECKED_IN`, sin filtro de
fecha—. En la maqueta con datos de demostración son **42**. Un profesional en ejercicio siempre
tiene citas confirmadas, así que **nunca** puede cambiar su horario.

### Por qué el 409 se contradice con la propia operación

El retiro **conserva los cupos con cita** y devuelve `keptSlots` para decirlo. Es decir: la
operación ya está diseñada para no tocar los turnos comprometidos, y aun así se niega a correr
cuando existen. Las dos cosas no pueden ser ciertas a la vez.

Las otras dos rutas tampoco alcanzan:

| Ruta | Por qué no sirve |
| --- | --- |
| `PATCH /scheduling/templates/:id` | Cambia las reglas y **no toca los cupos materializados** (lo dice su propia descripción). Regenerar después no arregla nada: los instantes viejos ya existen y se cuentan como `skipped`. La grilla publicada sigue siendo la vieja. |
| `POST /scheduling/resources/:id/close-slots` | Cierra cupos **dejando una excepción** que cubre su rango — y esa excepción bloquearía también los cupos nuevos. |

### Lo que hace falta, en orden de preferencia

1. **Acotar el 409 a las citas del rango que se deja de publicar.** Retirar conserva las citas;
   frenar por una cita de dentro de tres meses cuando el cambio rige desde mañana no protege a
   nadie.
2. O una ruta que **suelte los cupos libres futuros de una plantilla sin retirarla**
   —`POST /scheduling/templates/:id/release-free-slots?from=`—, que es exactamente lo que
   «cambiar mi horario» necesita y hoy sólo existe como efecto secundario del retiro.
3. O que `generate-slots` acepte `replace=true` para una ventana: borra los libres y crea los
   nuevos en una transacción.

Mientras tanto el frontend **muestra el motivo del servidor tal cual** y enlaza a «Mi agenda»
para resolver esas citas, en vez de publicar en silencio un horario que no rige.

### Un defecto del simulador que esto destapó

`mock-router.ts` emitía los errores **sin el `code` del contrato**, y `readApiError`
(`core/http/api-error.ts`) descarta todo cuerpo sin un `code` conocido. Resultado: **cualquier**
409, 422 o 403 de la maqueta llegaba a la pantalla como «No pudimos completar la operación.
(sin-id)». Corregido en esta tanda: los seis ayudantes declaran su código.

---

## Abierto · P22 · No hay forma de dar de alta al paciente que llega al mostrador

**Levantado el 2026-09-09**, en la rama `mockup`, construyendo «paciente nuevo» dentro de
`/schedule/appointment/new`. Es el punto **1.1 del registro de procesos del cliente** —la recepción
del paciente que no tiene usuario— y hoy no tiene endpoint que lo reciba entero.

### Lo que ya existe, y por qué no alcanza

`POST /iam/users/assisted-registration` es exactamente esta vía: la admite `CLINICIAN`, no fija
contraseña y devuelve un token de activación de un solo uso. Pero **crea la cuenta y nada más** — lo
dice su propio DTO: «no hay fila en `profiles.persons`, así que las partes del nombre sólo sobreviven
compuestas en `iam.users.display_name`». Sin persona no hay dónde poner la cédula
(`common.identifiers`), ni el celular, ni la ocupación, ni el tutor.

`POST /profiles/patients` tampoco: su `CreatePatientDto` acepta código de paciente, nombre visible,
fecha de nacimiento y dos conceptos de género. **Ni cédula, ni celular, ni ocupación.** Y exige el
`patientCode`, que es único en toda la instalación y que el navegador no puede garantizar — el
servidor ya lo acuña él mismo en el alta que la propia persona hace de sí misma (`PAT-<uuid>`).

### Lo que hay que hacer, y por qué es barato

**Extender `AssistedRegistrationDto` con el bloque de filiación que `RegisterPatientDto` ya declara**
y que su servicio cree persona + perfil + identificador + teléfono + tutor en la misma transacción.
No es un endpoint nuevo ni un contrato inventado: los campos existen palabra por palabra en el alta
que la persona hace de sí misma, y los ayudantes que los persisten **ya están extraídos**
(`createGuardianRelatedPerson`, `createResidenceAddress`, `composeAccountDisplayName`). Hoy hay dos
altas de paciente que declaran la misma persona de dos maneras distintas, y una está vacía.

| Campo | §1.1 | Dónde ya está declarado |
| --- | --- | --- |
| `name` · `middleName` · `lastName` · `motherLastName` | 1.1.1–2 | `RegisterPatientDto` |
| `nationalId` | 1.1.3 | ídem |
| `issuerAdministrativeAreaConceptId` | 1.1.4 | ídem (`VS_BO_DEPARTMENT`) |
| `birthDate` | 1.1.5 | ídem |
| `occupationConceptId` · `occupationFreeText` | 1.1.6–7 | ídem (`VS_BO_OCCUPATION`) |
| `phone` | 1.1.10 | ídem |
| `guardianName` · `guardianPhone` · `guardianRelationshipConceptId` | 1.1.11 | ídem |

### Lo que la maqueta hace mientras tanto

La pantalla manda ese bloque a `POST /profiles/patients` y, con el perfil devuelto, agenda. **Contra
la API de hoy da 400**: `forbidNonWhitelisted` rechaza la petición entera por las claves que el DTO
no declara. Son además **dos transacciones**, así que si la cita falla queda una persona sin cita.
Las dos cosas se arreglan solas el día que el registro asistido reciba el bloque: una llamada, una
transacción.

### Tres decisiones que no son técnicas

1. **El correo es obligatorio y el paciente de mostrador puede no tener.** Hoy el correo *es* la
   identidad de login y lo que evita duplicados. Que el celular ocupe ese lugar exige cambio de
   modelo **y un canal de entrega que no existe**: la API sólo tiene `IN_APP` y `EMAIL`, no hay SMS
   ni WhatsApp por donde mandar el enlace de activación.
2. **El tutor se puede vincular pero no formalizar.** `POST /authz/care-relationships` admite
   `CLINICIAN`; `POST /authz/legal-representations` es **sólo `SECURITY_ADMIN`**. Con el nombre y el
   celular del tutor como persona relacionada alcanza para §1.1.11; para la representación legal, no.
3. **Las 896 ocupaciones del SEGIP no existen.** Está investigado en `bo-occupations.catalog.ts`: el
   manual responde 404 y el reglamento del RUIP dice que «Ocupación» es declarativa y no requiere
   respaldo. Hoy hay 64 provisionales; la lista buena es la COB-2023 del INE (606), cuyo patch no
   está aplicado. Sustituirlas arrastra migración: los identificadores se derivan del código.

---

## Abierto · P21 · Nadie avisa que se liberó un horario

**Levantado el 2026-09-09**, en la rama `mockup`. No bloquea nada: la maqueta lo
simula entero y la API puede seguir sin esto. Lo que no puede es fingir que ya
existe.

### Qué pide el registro

Punto 3.4 del módulo Paciente, textual:

> «Si no encuentras cita en el día que necesitas y confirmas para otra fecha
> PUEDES RECIBIR UNA NOTIFICACION DE LA APP DONDE TE INFORME QUE UN PACIENTE
> DESCONFIRMO Y EXISTE UN HORARIO DISPONIBLE (ayudando con esto al paciente a
> poder tener una opción rápida y directa)»

### Qué hace falta, y son tres cosas

1. **Detectar que el cupo quedó libre.** Dos caminos llevan al mismo estado: un
   `desconfirmar` explícito, y una reserva que sigue confirmada pasados N
   minutos de su hora sin que la consulta se iniciara. El segundo es el que la
   maqueta simula, porque es el que se puede observar sin que nadie apriete
   nada. Los diez minutos son de `horario-liberado.ts`; el número es del
   propietario, no del modelo.
2. **Saber a quién le interesa.** El registro lo dice: a quien no consiguió el
   día que quería y reservó para otra fecha. Hoy no hay dónde guardar «quería el
   martes»: `scheduling.waiting_list` existe pero nadie la escribe desde el alta
   de una reserva. La maqueta lo aproxima con «tiene una cita futura con esa
   profesional», que es lo más cercano con el dato que hay — y es una
   aproximación, no la regla.
3. **Empujarlo.** El módulo 35 ya declara `notification_requests` y el canal
   `IN_APP`, así que la notificación en sí no es trabajo nuevo: es un productor
   que la emita cuando (1) ocurra y para quien (2) diga.

### Lo que el front ya tiene, y no hay que volver a hacer

La campana lee `GET /notifications/me` y sabe abrir un destino
(`notification-routes.ts`). Un aviso con `category: 'SCHEDULING'`, su
`destination` al cupo y `payloadJson.kind = 'SLOT_RELEASED'` entra por ahí sin
tocar una línea de pantalla.

### Y lo que hay que apagar cuando esto exista

`features/notifications/aviso-de-hueco-libre.ts` **sondea cada veinte
segundos**, y eso es de maqueta: arranca sólo con `mockBackend`. Contra la API
real el empujón es del servidor, y sondear sería multiplicar una consulta por
pestaña abierta para enterarse tarde igual. El día que el canal empuje, ese
archivo se borra.

---

## Abierto · P20 · El alta de profesional no recibe el consultorio propio

**Levantado el 2026-09-09**, en la rama `mockup`. Misma forma que P19 y **el
mismo bloqueo**: con `forbidNonWhitelisted` una clave que el DTO no declara
rechaza el alta entera.

### Por qué el dato viaja en el alta y no por su ruta

El consultorio propio **ya existe de punta a punta**: `POST /practitioners/me/sites`
(ALV-005/006), con `NewOwnSite` + `NewOwnSiteAddress`, y «Mi perfil → dónde
trabajo» lo usa para registrarlo. Lo que no se puede es llamarlo desde el alta:
esa ruta es `/me`, exige sesión, y **el registro termina en el login** — no
inicia sesión solo. Así que el dato tiene que viajar adentro del alta, y el
backend reutilizar el servicio que ya tiene.

### Por qué importa que esté en el alta y no sólo en el perfil

Quien ejerce puede atender en varios lugares, pero los demás son de otro: para
figurar en una clínica hace falta que **esa clínica acepte la vinculación**
(`practitioner_affiliations`, estado declarado → activo). Hasta que eso pase, su
agenda no tiene dónde publicarse. El consultorio propio es el único lugar que no
depende de que nadie confirme nada, y por eso quien se registra para empezar a
atender lo necesita el primer día — no después de que alguien lo acepte.

Es el punto 12/13/22 del módulo médico del registro de procesos («Dirección de
trabajo», «Ubicación GPS Trabajo», «Ubicación GPS de cada consultorio de
atención»).

### Qué hace falta

```
ownSite?: {
  name: string
  timeZone?: string
  address?: {
    lines: string[]
    city?: string
    municipalityConceptId?: string
    administrativeAreaConceptId?: string
    latitude?: number    // exige longitude
    longitude?: number   // exige latitude
  }
}
```

Es **exactamente** `NewOwnSite`, que el backend ya valida en su controlador de
sedes. Del lado del servicio, `IamPractitionerSelfRegistrationService` tiene que
llamar al mismo caso de uso que atiende `POST /practitioners/me/sites` — el que
crea o reutiliza la práctica personal del profesional. No hace falta tocar el
modelo.

### Lo que queda por decidir, y no lo decide el front

Si crear el consultorio debe **crear también su recurso de agenda**. Hoy la
agenda trabaja sobre recursos (`scheduling`), cada uno con su sede, y una sede
sin recurso no ofrece turnos. Quien conozca `scheduling` tiene que decir si el
recurso nace con la sede o si se crea al publicar el primer horario. **El front
no lo asume**: manda la sede y nada más.

---

## Abierto · P19 · El alta de profesional no recibe el domicilio

**Levantado el 2026-09-08**, en la rama `mockup`. **Bloquea el pase a `dev`**: no
es un dato que se pierda, es un alta que no ocurre.

### Qué pasa

`RegisterPractitionerDto` acepta `residenceMunicipalityConceptId` y nada más. La
pantalla del alta ahora pregunta también la calle y el punto del mapa —el mismo
bloque que el alta de paciente— y los manda como `homeAddressLines`,
`homeLatitude` y `homeLongitude`.

`main.ts` monta el `ValidationPipe` con `forbidNonWhitelisted: true`. Una clave
que el DTO no declara **no se descarta: rechaza la petición entera con 400**. Así
que contra la API de hoy, un profesional que escriba su dirección no puede
registrarse.

En la rama `mockup` esto no se nota —el simulador contesta todo y no valida—, y
por eso queda escrito acá y no sólo en el código.

### Qué hace falta

Los tres campos **ya existen en `RegisterPatientDto`**, con sus validadores y su
regla de par (latitud y longitud viajan juntas o no viajan). Son copiables tal
cual:

```
homeAddressLines?: string
homeLatitude?:  number   // exige homeLongitude
homeLongitude?: number   // exige homeLatitude
```

Y del lado del servicio, `IamPractitionerSelfRegistrationService` tiene que
escribirlos donde ya los escribe el del paciente: `common.addresses`, que tiene
las columnas —no hace falta tocar el modelo, ni `.puml`, ni DDL—.

### Lo que NO entra acá

La **zona** de residencia (AC-05-8) sigue sin preguntarse en ninguno de los dos
registros, y esa sí es esquema: `common.addresses` no tiene columna de zona.

---

## Abierto · P15 a P18 · Los cuatro huecos que dejó el plan de UX del 22/08/2026

**Levantados el 2026-08-23**, construyendo los frentes B, D y H del plan
`PLAN-UX-DIRECTORIOS-PERFILES-2026-08-23.md`. Los cuatro tienen la misma forma:
la pantalla se construyó igual, hasta donde la API permite, y **dice en voz
alta lo que no puede hacer** en vez de simularlo. Cuando el endpoint exista, en
cada caso se borra un aviso y se enciende una función.

### P15 · No hay forma de retirar una plantilla de agenda

`M41 scheduling` publica horarios y no los modifica: existen
`POST /scheduling/resources/:id/templates` y su lectura, y **no** hay
`PUT`/`DELETE` ni forma de marcar una plantilla como retirada.

Consecuencia en pantalla: «Cambiar mi horario» **agrega** el horario nuevo, y
los cupos que el anterior ya materializó siguen ofreciéndose. Un médico que
mueve sus martes a los jueves sigue teniendo turnos abiertos los martes.

Lo que la pantalla hace mientras tanto: avisa antes de publicar y manda a
cerrarlos con el bloqueo por rango. Es una vuelta manual sobre un problema que
el backend puede resolver de raíz.

**Lo que haría falta:** poder retirar una plantilla —o darle `validTo`
retroactivo— y que eso cierre sus cupos libres futuros.

### P16 · La ficha pública no sabe decir dónde atiende alguien

El cliente lo pidió textual: «en el perfil público del profesional falta los
lugares donde atiende». El dato **existe** —`GET /scheduling/slots` agrupa los
cupos por sede, y `GET /practitioners/:id/sites` devuelve las sedes— pero los
dos exigen sesión, y `/p/:slug` es anónima. `PublicProfileDetailDto` sirve
`city` y `address`: una sola dirección, no las sedes.

**Lo que haría falta:** que la respuesta pública traiga los lugares de
atención —nombre, dirección y, si se puede, los días que atiende en cada uno—.
Sin horarios en vivo: alcanza con «Atiende en: Clínica X (lun/mié), Consultorio
Y (vie)».

#### Estado (09/09/2026): la pantalla ya está, el contrato falta

La rama `mockup` lo construyó entero de este lado. `PublicProfileDetail` declara
`practiceSites` y la ficha las lista —el consultorio propio primero y con su
distintivo, un pin por sede en el mapa—, así que el día que la API lo mande no
hay que tocar una línea de pantalla.

La forma que se espera, dentro de `GET /public/profiles/:prefix/:slug`:

```
practiceSites: {
  id: string
  name: string
  addressText: string | null
  location: { lat: number, lng: number } | null
  isOwn: boolean      // consultorio propio, no sede de una organización
}[]
```

`isOwn` no es cosmético: el consultorio propio es el único lugar que existe sin
que una organización haya aceptado nada (ver P20), y para quien elige a quién
consultar no es lo mismo que una clínica con recepción y cobro de por medio.

**Sigue siendo compatible hacia atrás.** El cliente rellena `practiceSites: []`
cuando la respuesta no lo trae (`toProfile` en `public-directory.client.ts`), y
sin sedes la ficha cae al respaldo de `city`/`address` que ya tenía. O sea: esto
se puede mergear a `dev` antes que el backend, y no rompe nada.

### P17 · La foto del perfil no se puede subir desde la aplicación

`OwnPublicProfile` y el perfil profesional **leen** `avatarFileId` y
`photoFileId`, pero ninguno de los dos cuerpos de escritura los acepta:
`UpsertOwnPublicProfile` no tiene `avatarFileId` y
`PATCH /profiles/practitioners/me` sólo admite cuatro campos —título,
biografía, si acepta pacientes y telemedicina—. Tampoco sirve `file_links`: sus
`owner_type` son `USER`, `PATIENT` y `TENANT`.

O sea: hoy **nadie** puede ponerle foto a un perfil desde el frontend. El
cliente pidió «Agregar tu foto» y lo único honesto que se pudo construir es el
aviso de que la ficha se ve sin foto.

**Lo que haría falta:** aceptar el identificador del archivo en alguna de las
dos escrituras.

### P18 · No hay lectura de colección de notas clínicas

`M15 chart` tiene `POST /charts/notes` y
`PUT /charts/notes/:id/versions` —se escriben y se versionan— y ninguna
lectura de colección: no existe un `GET` por profesional ni por fecha. Sólo se
llega a una nota entrando al expediente de su paciente.

Consecuencia: la sección «Evoluciones» del panel del médico lista **una fila
por atención** —desde `GET /scheduling/bookings`, que es lo que sí se puede
leer— y trae el texto de cada evolución **bajo demanda** al abrir una fila: una
petición por clic contra `GET /charts/patients/:id/chart`, no N al cargar.

Lo que sigue faltando es **atar una nota a su atención**. Dentro de esa lectura
las notas de *esa* atención se reconocen por su día calendario, porque el
contrato no ata una nota a una reserva: `ChartNote.encounterId` la ata a un
encuentro, y el encuentro no viaja en la reserva. Dos atenciones de la misma
persona el mismo día se muestran con las mismas notas, y es una estimación
admitida a falta de la lectura.

**Lo que haría falta:** `GET /charts/notes` acotado por profesional y ventana
de fechas, devolviendo la última versión de cada nota, y el `encounterId` (o el
`appointmentId`) en la reserva para poder cruzarlos sin estimar por fecha.

---

## Abierto · P14 · El autorregistro de paciente devuelve 500: la base no tiene las columnas del nombre

**Levantado el 2026-08-12** contra la API viva, preparando el entorno del viernes.
**Bloquea el paso 1 del guion del consumidor**, que es la única puerta de entrada de quien
prueba el producto sin que nadie lo acompañe.

```
POST /iam/auth/register-patient
→ 500  {"code":"INTERNAL","message":"Error interno del servidor"}

Log de la API (reqId 527):
InvalidFieldNameException: column "name" of relation "persons" does not exist
```

### Alcance medido (2026-08-12, contra la API viva) — **la API no está rota**

El 500 aparece **sólo con el payload nuevo**. El DTO conserva `displayName` como «forma anterior
de declarar el nombre», y por ese camino el registro funciona:

| Payload | Resultado |
| --- | --- |
| `name` · `middleName` · `lastName` · `motherLastName` — **el que manda el front hoy** | **500 INTERNAL** |
| `displayName` | **201 OK** |

**Y el resto del recorrido del consumidor funciona.** Verificado de punta a punta con una cuenta
creada por el camino viejo:

| Paso | Resultado |
| --- | --- |
| Login con documento | ✅ |
| Claims del token | ✅ `roles=[USER, PATIENT]` · **`pid` presente** · 1 organización |
| Panel (`/profiles/patients/me/summary`) | ⚠️ 403 `IDENTITY_VERIFICATION_REQUIRED` — por diseño, con su puerta |
| Agendas · horarios libres | ✅ 9 recursos · 5 cupos |
| Retener → confirmar (canal `PORTAL`) | ✅ cita creada |
| «Mis turnos» | ✅ 1 turno |

O sea: **B1 y B2 del plan de M1 están efectivamente cerrados**, y lo único que rompe es el
puente entre el formulario y la base.

### Dos salidas, para decidir antes del corte

1. **Arreglo canónico** — `.puml` → `gen_ddl.py` → patch en `SQL/patches/` → base. Es lo correcto.
2. **Workaround en el front** — que el registro vuelva a mandar `displayName`. Chico y reversible.

> ### ⚠️ Mientras el patch no exista, **reconstruir la base es perder el entorno**
>
> Donde hoy el registro con cuatro partes funciona, la base tiene las columnas **por un camino que
> no quedó en `SQL/`**: el DDL canónico (`SQL/05_profiles/02_tables.sql`) sigue declarando sólo
> `display_name`, y **no hay ningún patch** en `SQL/patches/` (el último es del 2026-08-06). Un
> `rebuild_stack.py` las borra y el 500 aparece también ahí.

**La causa es deriva de las cuatro capas.** El cambio del «nombre en cuatro partes» se hizo en
la API y en el frontend, pero **nunca llegó a `SQL/` ni a la base**:

| Capa | Qué dice |
| --- | --- |
| DTO / API | escribe `name`, `middleName`, `lastName`, `motherLastName` |
| Frontend | los pide en el formulario y los manda (PR #41) |
| **`SQL/05_profiles/02_tables.sql`** | **sólo declara `display_name`** |
| **Base viva** | `information_schema` confirma: en `profiles.persons` la única columna de nombre es `display_name` |

Comprobación directa contra la base:

```sql
select column_name from information_schema.columns
where table_schema='profiles' and table_name='persons'
  and column_name in ('name','middle_name','last_name','mother_last_name','display_name');
-- (1 row)  display_name
```

**Por qué no lo vio nadie hasta ahora** — y esto importa más que el defecto:

- Las **1 639 pruebas del frontend** pasan porque `HttpTestingController` finge la respuesta:
  ninguna toca la base.
- El **CI de la API está rojo por lint desde el 2026-08-11**, y con él **los 20 pasos siguientes
  del pipeline están saltados**, incluidas las pruebas que habrían tocado esto. Es exactamente lo
  que la tarea D2 del plan advierte: «hoy nadie sabe si la API pasa sus pruebas».
- **`seed:dev` no lo detecta**: crea pacientes por la vía administrativa, no por el autorregistro.
  Su corrida da 524/524 conformes y aun así este camino está roto.

**Qué haría falta** (no se hizo acá: toca el modelo y sus generadores, no el frontend): declarar
las columnas en el `.puml` de `profiles`, regenerar `SQL/` con `gen_ddl.py`, y materializarlas en
la base. La regla del proyecto es explícita — `SQL/` **no se edita a mano**, se regenera.

### Diagnóstico corregido y cierre (2026-08-12, tarde — Marcelo)

**El modelo YA tenía las columnas.** El desdoble del nombre se propagó por las 4 capas el
**2026-08-10**: `.puml` de profiles, `SQL/05_profiles/02_tables.sql`, el patch
`SQL/patches/2026-08-10_v4011_person_name_components.sql` y la entidad `Persons` (que está en
`dev` de la API — no es una edición a mano). Lo que nadie vio: **`SQL/` y `Mantra Core Health
Context/` no son repos git**, así que ese trabajo nunca salió de la máquina donde se hizo. La
tabla de arriba es correcta para toda copia de `SQL/` anterior al 08-10 — que es exactamente lo
que tiene cualquier otro entorno. El P4 de este archivo venía avisando este riesgo.

**Cómo se cierra en un entorno con base viva (el del viernes incluido)** — dos patches
idempotentes, en orden, con el rol `mantra`; NO hace falta rebuild y no se pierde nada sembrado:

```bash
docker exec -i mantra-redesa-postgres-1 psql -U mantra -d mantra_redesa_health \
  -v ON_ERROR_STOP=1 < SQL/patches/2026-08-10_v4011_person_name_components.sql
docker exec -i mantra-redesa-postgres-1 psql -U mantra -d mantra_redesa_health \
  -v ON_ERROR_STOP=1 < SQL/patches/2026-08-12_v4011_persons_photo_file_id.sql
```

(El segundo es `photo_file_id` → `common.files`, cerrado hoy; re-aplicarlos da no-ops, está
verificado.) Los archivos de `SQL/` actualizados viajan por el canal en un zip — hasta que
`SQL/` tenga distribución versionada, **todo cambio del modelo viaja con su patch y se anuncia**.
Si el entorno se reconstruye desde cero con la copia nueva de `SQL/`, los patches no hacen falta.

**Verificado ejecutando (2026-08-12):** sobre base parcheada, `POST /iam/auth/register-patient`
con los 4 nombres → **201**, login con ese documento → 200, `display_name` compuesto desde las
partes; fidelidad `dry-run` → `6 diferencias (tabla-ausente=6)` y **cero** `columna-ausente`.
El primer paso del guion del consumidor queda destrabado en cuanto el entorno del viernes
aplique los patches.

> **Nota de método:** el `smoke` **borra el administrador de arranque**, así que la secuencia de
> J2 no es de dos pasos sino de tres: `yarn smoke` → `yarn postman:bootstrap` → `yarn seed:dev`.
> Sin el del medio, `seed:dev` muere en su primera llamada con `401 UNAUTHENTICATED` y siembra cero.

---

## Resuelto · P6 · El alta de un profesional por un administrador ya existe

**Levantado el 2026-08-04 desde J3 · cerrado el 2026-08-11** · `POST /iam/users/assisted-practitioner-registration`, `@Roles('SECURITY_ADMIN')`.

Se construyó como se había pedido: **equivalente a `assisted-registration` pero para profesionales**. Comparte transacción e invariantes con el autorregistro —el registro CTI atómico de la regla 11— porque es la misma alta; se parametrizó en vez de duplicarse.

| | Autorregistro | Alta administrativa |
| --- | --- | --- |
| Autorización | `@Public()`, 10/min | `SECURITY_ADMIN` |
| Contraseña | la fija el titular | **no se manda**: token de activación de un solo uso |
| Estado de la cuenta | `ACTIVE` | `PENDING` con `mustChangePassword` |
| Trazabilidad | — | `reason` obligatorio (C-18) |
| Matrícula | `PENDING` | `PENDING` — registrar no habilita a ejercer |

Verificado en vivo: 201 con `activationToken`, su caducidad y `verificationStatus: PENDING`.

---

## Resuelto · P7 y P8 · Los campos de catálogo ya tienen catálogo, y se sabe cuál

**Levantados el 2026-08-08 · cerrados por el PR `#38`** · Se daban por abiertos y **no lo estaban**:
la comprobación del 2026-08-11 los encontró funcionando. Queda anotado el error de sondeo porque
volver a levantarlos costaría el mismo tiempo dos veces.

`DYNAMIC_ENUM_CATALOG` declara las enumeraciones bien conocidas —entre ellas `administrative-gender`
y `sex-at-birth`, que eran justo las que faltaban— y `DynamicEnumSeedService` las materializa con
uuid5 deterministas.

| Comprobación en vivo | Resultado |
| --- | --- |
| `GET /terminology/value-sets?code=administrative-gender` | 200, con su conjunto |
| `GET /system-context/dynamic-enums?target=profiles.persons.administrative_gender_concept_id` | 200, **4 opciones** con su `display` |
| `GET /system-context/dynamic-enums/bindings` | 200, **45 bindings** registrados |

> **Por qué parecían abiertos.** El primer sondeo usó `?code=ADMINISTRATIVE_GENDER` —el código real es
> `administrative-gender`, en minúscula y con guion— y `profiles.person_profiles.…` como target,
> cuando la tabla es `profiles.persons`. Los dos devolvieron vacío y 404, que se leyeron como
> «no existe». **Un 404 con el identificador equivocado no prueba nada**, y conviene recordarlo.

Lo que **sí** sigue pendiente es consumirlos: el alta de paciente sigue sin los selectores de género
y sexo al nacer. No es un bloqueo de backend — es trabajo de front que ya tiene contra qué
construirse (IT3 del plan).

---

## Resuelto · P9 · Una fusión ya no es irreversible al cerrar la pantalla

**Levantado el 2026-08-08 · cerrado el 2026-08-11** · `GET /profiles/patients/merge-events`, `SECURITY_ADMIN`.

`reverse` exige el `eventId` y ese identificador **sólo existía en la respuesta del POST que lo creaba**: al salir de la pantalla, unir dos historias clínicas dejaba de tener vuelta atrás. Quien se diera cuenta del error al día siguiente no tenía camino.

El filtro por paciente busca en **los dos lados** de la fusión: quien revisa un registro no sabe si el que mira sobrevivió o fue el absorbido.

Consumido de este lado: `ProfilesClient.listMergeEvents`. Y el aviso de la pantalla de fusión —que decía que al salir se perdía el camino de vuelta— dejó de decirlo, porque ya no es cierto.

---

## Resuelto · P10 · `iam` y `directory` ya tienen lecturas de colección

**Levantado el 2026-08-08 · cerrado por el PR `#38`** · Comprobado en vivo el 2026-08-11:
`GET /iam/users` → 200 y `GET /admin/tenants` → 200.

Siguen sin lectura de colección `delegated_access` y `auth_providers`, que el original nombraba
junto a estos dos. No bloquean el recorrido de la demo.

### Una corrección al plan de la semana, que sigue vigente

El `PLAN-SEMANA-WEB-Y-MOVIL.md` cuenta a **`common`** entre los módulos «con lectura» (1 `GET`).
Ese `GET` es `/common/files/:id/content` — **una descarga de archivo, no un listado**.

---

## Resuelto · P11 · El encuentro ya se puede vincular al turno que lo originó

**Levantado el 2026-08-10 desde P1 · cerrado el mismo día** · PR `mantra-core-health-api#42`.

El dato existía en la entidad y no salía por ninguna lectura: `BookingItemDto` no exponía
`appointmentId`, así que el portal no podía decirle al check-in de qué turno venía el encuentro.
Ahora lo exponen **las dos** lecturas de reserva —el listado y el detalle—, porque si sólo lo trajera
una, el detalle contradiría a la fila que lo abrió.

Consumido de este lado: la agenda lo lleva al expediente en `?cita=`, y el check-in lo manda como
`appointmentId`. Viaja `null` con normalidad y entonces el parámetro no se agrega.

> ⚠️ **Queda un pendiente distinto, y es de dominio — ver P13.** El vínculo está tendido de punta a
> punta, pero hoy no se llena nunca.

---

## Resuelto · P12 · La sesión ya sabe cuál es su perfil profesional

**Levantado el 2026-08-10 desde P1 · cerrado el mismo día** · PR `mantra-core-health-api#42`.

Se resolvió con el **claim `hpid`**, simétrico del `pid` de paciente que ya existía, y por la misma
cadena sobre la otra tabla de perfil. Es lo más barato: no agrega una petición a cada arranque de
sesión, y no había ninguna lectura que devolviera el dato —el controlador de profesionales sólo
expone `POST`—.

Como `pid`, **no es una credencial**: quién puede ver una agenda lo siguen decidiendo `roles` y el
tenant del request. Se omite en toda cuenta sin perfil profesional, y convive con `pid` cuando quien
atiende es además paciente de la casa.

Consumido de este lado: la agenda se abre en la del profesional que entró —cruzando `hpid` con el
`resourceRefId` del recurso— y lo dice en el campo, porque una agenda ajena y la propia se ven igual.
El recurso de la URL sigue mandando, para que un enlace compartido abra lo que dice.

### Un detalle que apareció al verificarlo

El `resourceRefType` **no coincide entre el contrato y los datos**: el DTO ejemplifica
`health_practitioner_profiles` —el nombre real de la tabla— y los 15 recursos sembrados traen
`practitioner_profiles`. El frontend acepta los dos y lo dice en el código. Conviene unificarlo del
lado de los seeds, pero no bloquea nada.

---

## Resuelto · P13 · La confirmación de una reserva ya crea su cita clínica

**Levantado el 2026-08-11 al verificar P11 · cerrado el mismo día.**

`clinical.appointments` tenía 0 filas y nada la escribía, así que el vínculo de P11 iba a estar siempre vacío. Ahora la confirmación de una reserva crea la cita y la enlaza.

**Al confirmar y no en el check-in**, de las tres opciones que se habían planteado: una cita *es* el turno visto desde lo clínico; el registro de que alguien llegó es el encuentro, que es otra tabla. Crearla en el check-in la haría nacer después del encuentro que la referencia.

El profesional de la cita sale del recurso, pero sólo si el recurso es de un profesional: copiar el id de una sala sería una clave foránea rota.

> **Un defecto que sólo apareció ejecutando:** la primera confirmación contra la base real dio `422 fk_appointment_bookings_appointment_id`. Crear la entidad no basta — hay que `flush` antes de referenciarla, porque `appointment_id` es una columna uuid plana. Ninguna prueba con dobles lo veía.

Verificado en la base: 1 cita clínica, 1 reserva enlazada, 1 encuentro atado, donde antes había 0.

---

## Resuelto en esta sesión · las violaciones de validación no se leían

**No era del backend: era nuestro, y llevaba semanas.** Este archivo ya lo documentaba —ver la
línea del catálogo de errores, `400 VALIDATION_FAILED + details.violations[]`— pero
`core/http/error-to-view-state.ts` leía `details.messages`, una clave que la API no emite.

Consecuencia: **ningún mensaje de validación por campo llegó nunca a una pantalla**. Todo `400` se
veía como el genérico «Error de validación», en toda la aplicación. La prueba que cubría ese camino
no lo detectaba porque fabricaba su propio cuerpo con la clave equivocada.

Corregido leyendo `violations` (con `messages` de reserva) y con una prueba cuyo cuerpo está copiado
literal de la respuesta real de `POST /iam/users/assisted-registration` sin `reason`.

---

## Resuelto — ya no bloquea

**El esquema de la base.** Era el bloqueo más grande del proyecto. El commit `41206d2` versionó el
DDL: `apply_all.sql` + 350 archivos SQL + 23 de NoSQL.

**`dev` volvió a compilar.** Tres commits habían entrado con archivos nuevos sin `git add`.

**El compose ya pasa `ORM_SCHEMA_SYNC`** a los contenedores con default `dry-run`.

**Auto-registro de profesionales y de organización**, y el tipo de tenant obligatorio con validación
cruzada — justo lo que hace falta para un formulario condicional.

**El catálogo de errores (P2).** Ver abajo: estaba, y desbloqueó la tarjeta 17 entera menos un punto.

**La recuperación de contraseña.** Llegó, las dos pantallas están escritas y el flujo entero se
verificó contra la base real: pedir el enlace, leerlo, cambiar la clave, entrar con la nueva, y que
la vieja y el token usado dejen de servir.

**Los cuatro pedidos al backend.** Los 403 indistinguibles, la falta de logout, el token sin nombre
y los tenants sin nombre: los cuatro cerrados. Ver abajo.

---

## Lo que quedó resuelto en esta sesión, y cómo

### P2 · El catálogo de errores estaba entregado

Esta lista decía que era «lo único que bloquea» la tarjeta 17. **No lo era.**
`src/common/errors/error-codes.ts` declara un enum de **once códigos estables**, y
`AllExceptionsFilter` homogeneiza *toda* respuesta de error en la misma envoltura. El comentario del
enum lo dice con todas las letras:

> «Son parte del contrato de la API: el cliente puede ramificar sobre `error.code` sin parsear
> mensajes, que están pensados para humanos y pueden cambiar de redacción o idioma.»

Verificado también contra la API corriendo, no sólo leyendo:

```text
POST /iam/auth/login  {}                    -> 400 VALIDATION_FAILED + details.violations[]
POST /iam/auth/login  {credenciales malas}  -> 401 UNAUTHENTICATED
```

La tarjeta 17 está hecha (`core/http/api-error.ts`), con ocho de sus nueve casos cubiertos y
probados contra esos cuerpos reales.

**Una nota de forma que ya se cerró:** `correlationId` estaba declarado `string` en
`ErrorResponseBody` y salía **como número** (`"correlationId": 9451`), porque `pino-http` numera las
peticiones y un cast silenciaba la contradicción. Arreglado en el filtro (PR #25 de la API): ahora
se normaliza a texto ahí, que es donde vive el contrato publicado. De paso quedaron cubiertos el
`x-request-id` repetido —que Express entrega como array— y los `NaN`.

El cliente sigue aceptando el número igual: es una respuesta ajena, y un despliegue viejo detrás de
un proxy no debería costarnos el identificador con el que soporte encuentra el log.

### La recuperación de contraseña llegó

`POST /iam/auth/forgot-password` y `POST /iam/auth/reset-password`, ambos públicos. El enlace
«¿Olvidaste tu contraseña?» del login ya apunta a pantallas reales.

**Está bien resuelto y conviene que quede dicho por qué:** `forgot-password` responde 202 y el mismo
mensaje siempre, exista o no la cuenta. Eso es lo correcto —un «no encontramos ese correo»
convertiría un formulario público en un oráculo de qué personas tienen cuenta en una plataforma de
salud— y el frontend lo respeta: la pantalla muestra ese mensaje y no deduce nada del resultado.

**Ya está vivo.** El contenedor se reconstruyó y las dos rutas responden. Verificado desde el
navegador, a través del proxy: pedir el enlace devuelve 202 y la pantalla esconde el formulario.

---

## Lo que estaba abierto, y cómo quedó

### Los cuatro puntos abiertos se cerraron esta madrugada

Los cuatro estaban bien planteados y los cuatro eran del backend. Están hechos y verificados contra
la API viva, no sólo compilando.

**1. Los dos 403 ya se distinguen por un campo estable.** Era «lo único que bloquea», y con razón:
para la persona son estados opuestos —rol insuficiente es un muro sin salida, identidad sin
verificar es una puerta— y separarlos comparando el texto del mensaje ataba la interfaz a una
redacción que el propio catálogo declara cambiable.

`VerifiedIdentityGuard` ahora lanza `IDENTITY_VERIFICATION_REQUIRED`, un código nuevo del enum, y
además trae `details.reason` para los tres subcasos (`identity-not-verified`, `no-person-linked`,
`no-authenticated-user`). `RolesGuard` sigue con `FORBIDDEN`. Comprobado en la misma corrida, con
un paciente real:

```text
GET  /profiles/patients/me/summary  -> 403 IDENTITY_VERIFICATION_REQUIRED (identity-not-verified)
POST /terminology/value-sets        -> 403 FORBIDDEN
```

**Se puede borrar `FORBIDDEN_IDENTITY_HINTS`** de `core/http/api-error.ts`: era justamente la
constante aislada que esperaba este código.

**2. `POST /iam/auth/logout` existe.** Revoca la sesión del `sid` del token **y su refresh token**,
que era lo que de verdad sobrevivía al cierre. Es idempotente —cerrar algo ya cerrado devuelve
`{revoked: false}` y no falla— y comprueba que la sesión sea de quien la cierra, para que un token
válido no pueda cerrar la sesión de otro nombrando su `sid`. Verificado: tras el logout, reusar el
refresh token devuelve 401.

**3. El token ya trae nombre.** Claim `name`, poblado en el login **y en el refresco** —si sólo lo
pusiera el login, la interfaz perdería el nombre en la primera rotación—. Va en el token y no en un
`/me`: es un campo más de algo que ya se recibe, así que no reintroduce la petición por request que
la ausencia de `/me` evitaba.

**4. Los tenants ya se pueden mostrar por su nombre.** Claim `tenantNames`, un mapa `id -> nombre`.
`tenants` sigue siendo la lista de uuid, porque es lo que valida el interceptor de tenant: esto es
sólo para poder pintarlos. Prefiere el nombre comercial sobre el legal, con el código como último
recurso para que la lista nunca tenga una entrada en blanco.

Ambos claims **se omiten si están vacíos**: viajan en la cabecera de cada petición y un claim vacío
ocupa lugar sin decir nada.

```text
name:        "Administrador Postman"
tenantNames: { "1befcfea-…": "Mantra Core Default Tenant" }
```

### P3 · El `$expand` de value sets — hecho y verificado

Autenticado, **sin exigir rol de administración**, paginado por cursor. El cliente
(`core/data-access/terminology/`) está escrito y probado. Comprobado de punta a punta a través del
proxy: 25 opciones en 3 páginas, sin duplicados ni saltos, cursor corrupto → 400, sin token → 401.

**Un detalle que costó un 404 y conviene no repetir:** el `$` de la ruta va **literal**, no como
`%24`. Express enruta sobre el path sin decodificar, así que `%24expand` no casa con `:id/$expand`.

De paso apareció un fallo de fondo que nadie había visto: **ninguna expansión podía devolver un solo
miembro**. `importConcepts` creaba los conceptos sin estado y la expansión sólo selecciona los
activos, así que todo el camino documentado terminaba en `includedMembers: 0` **sin ningún error**.
Corregido en los dos extremos; ahora importar 25 y publicar da 25.

### P1 · El bootstrap del primer `SECURITY_ADMIN` — hecho y verificado

`BootstrapAdminSeedService` en `src/common/seed/`, corriendo desde el `OnApplicationBootstrap` del
orquestador de seeds, con `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` y
`BOOTSTRAP_ADMIN_ALLOW_PRODUCTION` documentadas en `.env.example`. Se niega en
`NODE_ENV=production` salvo autorización explícita. Verificado en el arranque real: la línea
«Administrador de arranque disponible» sale en el log y el login con esa cuenta devuelve 200.

`yarn postman:bootstrap` pasó a ser un disparador manual del **mismo** servicio, no una segunda
implementación.

### Sigue abierto · P4 · La propuesta de layout de repos se ejecutó en vez de proponerse

El commit `41206d2` versionó el DDL dentro del repo de la API, que es ejecutar la opción (b) de las
tres que había que proponer. El resultado es bueno y desbloqueó el proyecto, así que **no es un
reproche**: es que la decisión era de Marcelo y ahora está tomada de hecho. Si el `SQL/` canónico del
workspace cambia, hay que acordar cómo se sincroniza esa copia — que era justamente el riesgo que la
opción (b) tenía anotado.

### Sigue abierto · P5 · Revisión de los PRs del frontend

Permanente. Pablo es el único par de ojos activo del frontend, y hay trabajo publicado esperando.

---

## Consumido por el frontend

Los cuatro cierres están en uso y verificados contra la API viva, no sólo compilando:

| Entregado | Dónde se usa |
| --- | --- |
| `IDENTITY_VERIFICATION_REQUIRED` + `details.reason` | `core/http/api-error.ts` — la heurística sobre texto **se borró** |
| `POST /iam/auth/logout` | `AuthService.logout()` — tras cerrar sesión, reusar el refresh token da 401 |
| Claim `name` | El encabezado dice «Administrador Postman», no el uuid |
| Claim `tenantNames` | La elección de organización muestra nombres, no identificadores |

**Un matiz sobre el `reason`:** los tres subcasos no llevan al mismo lugar. `identity-not-verified`
y `no-authenticated-user` ofrecen el trámite de verificación; **`no-person-linked` no**, porque
verificar la identidad de una persona que todavía no está vinculada a la cuenta no es algo que quien
mira pueda hacer. Ofrecérselo sería un callejón con cartel de salida.
