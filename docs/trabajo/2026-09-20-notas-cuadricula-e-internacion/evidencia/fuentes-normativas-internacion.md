# Fuentes normativas de la hoja de internación — procedencia y `UNKNOWN`

> Insumo de **H1.S3** y espina de la matriz de **H4**. Responde a **C-23** («investigar que debe
> tener segun nomra») y a la ambigüedad **Q-D8**, que el propio pedido registró porque el cliente
> no nombró ninguna norma.
>
> **Regla que gobierna este documento:** ningún campo entra «porque suena a norma». O tiene fuente
> con nombre, referencia, fecha y condición de uso (regla 97.4.2), o se declara `UNKNOWN`
> (regla 97.5.4). El precedente es **B-13** del `REGISTRO-DEFECTOS.md` de la API: lo que pasa
> cuando se inventan fuentes.

Fecha de consulta de todo lo de acá: **2026-09-21**.

## 1. Primero se buscó dentro de la casa (regla 00 §8)

Lo de la casa gana sobre cualquier cosa traída de afuera. Esto es lo que hay y lo que no.

| Dónde se buscó | Comando / ruta | Resultado |
|---|---|---|
| Bóveda, notas de internación | `rg -li "internación\|admisión\|hospitalización" "Mantra Core Health Vault/SALUD"` | 25 archivos. El único normativo es `🧩 Patch v4.1.0 — Historial laboral, consultorios e internación.md` |
| Qué dice esa nota | punto 8 de v4.1.0 | Cubre **abrir el episodio y poder leerlo**, nada más: «`POST /clinical/care-episodes` desde siempre / **Ninguna lectura devolvía los episodios**». Es una corrección de lectura, **no** una especificación de hoja de admisión |
| Backlog ecosistémico | `rg -i "internación\|hoja de admisi\|cama\|acompañante" …/alovida-backlog-ecosistemico.md` | **Sin coincidencias** |
| Modelo canónico, 66 `.puml` | `rg -li "_beds\|_wards\|admission\|bed_id\|ward_id" *.puml` | 3 archivos, y **ninguno es una tabla**: `present_on_admission` (booleano de diagnóstico perioperatorio, módulo 53) y dos comentarios en prosa |

**Conclusión de la casa:** el proyecto **no tiene** especificación propia de qué lleva una hoja de
internación, ni estructura donde ponerla (no hay cama, sala, servicio ni admisión en el modelo).
Por eso hubo que mirar afuera — y no al revés.

## 2. Fuente citable · HL7 FHIR R4

| Dato de procedencia | Valor |
|---|---|
| **Nombre** | HL7 FHIR — *Encounter* y *EpisodeOfCare* |
| **Referencia** | FHIR **v4.0.1 (R4)**. `https://hl7.org/fhir/R4/encounter.html` · `https://hl7.org/fhir/R4/episodeofcare.html` |
| **Estado declarado en la página** | «Mixed Normative and STU» (Standard for Trial-Use) |
| **Fecha de consulta** | 2026-09-21 |
| **Condición de uso** | Especificación pública de HL7. Es un **estándar de interoperabilidad**, no una norma legal boliviana: dice cómo se estructura el dato para intercambiarlo, **no** qué exige el Estado. No sustituye a §3 |
| **Por qué esta y no otra** | La skill `healthcare-interoperability-fhir` lo dice en una línea: si la hoja de admisión tiene un recurso estándar detrás, alinearse es mejor que inventar una estructura. Y el proyecto ya la usa como vara — `clinical-records` §3 cita `entered-in-error` de FHIR, y `clinical.types.ts` modela el valor de la observación en las mismas familias excluyentes |

### 2.1 Lo que el estándar dice, y por qué reencuadra C-23

Las dos lecturas juntas dan el hallazgo más importante del turno: **en FHIR, la hoja de admisión
no vive en el episodio.**

- **`EpisodeOfCare`** es, textual de la página, «the container that can link a series of Encounters
  together for problems/issues». Sus elementos son `identifier` (0..\*), `status` (1..1),
  `statusHistory` (0..\*), `type` (0..\*), `diagnosis` (0..\*), `patient` (1..1),
  `managingOrganization` (0..1), `period` (0..1), `referralRequest` (0..\*), `careManager` (0..1),
  `team` (0..\*), `account` (0..\*).
- **`Encounter`** «records the details of an activity directly relating to the patient», y es quien
  lleva **`hospitalization`** (0..1) con `preAdmissionIdentifier`, `origin`, `admitSource`,
  `reAdmission`, `dietPreference` (0..\*), `specialCourtesy` (0..\*), `specialArrangement` (0..\*),
  `destination`, `dischargeDisposition`; más `class` (1..1), `serviceType` (0..1), `priority`
  (0..1), `diagnosis` con `use` —cuya documentación nombra explícitamente el rol *admission*— y
  `location` (0..\*) con `physicalType`, que es donde viven sala y cama.

Y ahora el cruce con lo nuestro: **`clinical.care_episodes` es un `EpisodeOfCare` casi completo.**

| `EpisodeOfCare` (FHIR R4) | `clinical.care_episodes` | ¿Lo manda el formulario hoy? |
|---|---|---|
| `patient` (1..1) | `patient_profile_id` | Sí |
| `managingOrganization` (0..1) | `tenant_id` | Sí |
| `status` (1..1) | `status_concept_id` | Lo pone el servidor (`CLIN.EPISODE_ACTIVE`) |
| `period` (0..1) | `start_at` / `end_at` | Sí, el inicio |
| `careManager` (0..1) | `responsible_practitioner_id` | Sí, del claim |
| **`type` (0..\*)** | **`type_concept_id`** | **NO — y la columna existe** |
| `diagnosis` (0..\*) | — | No hay columna |
| `statusHistory`, `referralRequest`, `team`, `account`, `identifier` | — | No hay columna |

**El formulario no está «mal» por pedir poco: está apuntado al recurso equivocado.** Lo que el
doctor reconoce como hoja de internación —procedencia, sala, cama, dieta, destino al alta— es
`Encounter.hospitalization` y `Encounter.location`, y eso **no existe en el modelo**. Lo único
que el estándar pone en el episodio y nosotros tenemos sin usar es **`type`**.

## 3. Fuente identificada pero de contenido `UNKNOWN` · norma boliviana

| Dato de procedencia | Valor |
|---|---|
| **Nombre** | Norma Técnica para el Manejo del Expediente Clínico |
| **Referencia** | **Resolución Ministerial Nº 0090**, del **26 de febrero de 2008**. Citada también como «Norma Técnica N° 64» |
| **Emisor** | Ministerio de Salud y Deportes, Estado Plurinacional de Bolivia |
| **Alcance declarado** | «De observancia y cumplimiento obligatorio en todo el Sistema Nacional de Salud» |
| **Fecha de consulta** | 2026-09-21 |
| **Cómo se supo** | Búsqueda web. Referencias secundarias coincidentes: repositorio UMSA, SSU-CBBA, SINEC, Studocu |

> [!warning] Su contenido es `UNKNOWN`, y así queda
> **No se pudo leer el documento.** El PDF alojado en `ssucbba.org` devolvió **HTTP 403
> Forbidden**, y las demás referencias son secundarias (repositorios académicos, Scribd, un blog),
> que **no sirven como fuente normativa** bajo la regla 97.4.2: no tienen las cuatro marcas de
> procedencia y no son el texto oficial.
>
> Lo que sí quedó confirmado es que la norma **distingue tipos de expediente para hospitalización,
> consulta externa y emergencias** — o sea que una hoja de internación con requisitos propios
> existe en la norma. **Cuál es su lista de campos, no lo sé, y no lo voy a suponer.**

### 3.1 Qué haría falta para cerrar este `UNKNOWN`

Cualquiera de estas dos cosas, y es trabajo de una persona, no de una sesión:

1. El **PDF oficial** de la RM Nº 0090 bajado del Ministerio de Salud y Deportes, o
2. La **hoja de internación en papel** que el doctor usa hoy en su institución, que es la
   materialización concreta de la norma y además dice qué se llena de verdad.

**Dueño:** doctor / negocio — es exactamente a quién Q-D8 lo asigna. **Bloquea:** sólo la columna
«fuente» de los campos que hoy no tienen ninguna; **no bloquea** el trabajo del turno, porque lo
que entra hoy entra por el contrato y por FHIR.

## 4. Lo que NO se va a escribir, y por qué

Estos campos aparecen en cualquier hoja de internación que uno haya visto, y **ninguno se propone
como requisito** porque no tengo fuente que lo pida:

`número de cama` · `servicio o unidad` · `acompañante responsable` · `procedencia` ·
`diagnóstico de ingreso` · `tipo de dieta` · `datos del seguro` · `pertenencias del paciente` ·
`motivo de ingreso en palabras`

Algunos de ellos tienen un lugar en FHIR y por eso aparecen en la matriz de H4 **con esa fuente y
sólo esa** (`admitSource`, `location.physicalType`, `dietPreference`, `dischargeDisposition`,
`diagnosis.use = admission`). Los que no tienen ni eso —acompañante, pertenencias, seguro— quedan
fuera de la matriz hasta que exista la fuente. **Un campo obligatorio inventado es peor que un
campo que falta**, porque el que falta se ve y el inventado se cumple.

## 5. Resumen para quien tenga que decidir

| Pregunta | Respuesta |
|---|---|
| ¿La casa tiene su propia norma de hoja de internación? | **No**, y tampoco estructura donde ponerla |
| ¿Hay un estándar internacional aplicable? | **Sí**, FHIR R4, verificado y citado |
| ¿Hay norma legal boliviana aplicable? | **Sí, existe** (RM Nº 0090, 26/02/2008), pero **su contenido es `UNKNOWN`** |
| ¿Se puede hacer algo hoy sin esperar? | **Sí**: `type` está en el estándar, está en el modelo y no se usa |
| ¿Se puede cerrar C-23 del todo hoy? | **No**, y no por falta de tiempo: la mayor parte de la hoja pide `Encounter.hospitalization`, que el modelo no tiene |
