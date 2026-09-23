# Matriz de la hoja de internación — campo × fuente × soporte del contrato

> **H4** del lote. Responde a **C-23**: «El formulario de internacion esta totalmente mal pesimo,
> investigar que debe tener segun nomra y ajustarlo al proyecto.»
>
> La procedencia de cada fuente está en [`fuentes-normativas-internacion.md`](./fuentes-normativas-internacion.md).
> Acá está el cruce. **Ningún campo aparece sin fuente**; los que no la tienen no están en la tabla,
> y están listados al final con su nombre y el motivo.

## 0. La respuesta corta, antes de la tabla

**El formulario no está mal por pedir poco. Está apuntado al recurso equivocado.**

El bloque escribe en `POST /clinical/care-episodes` → `clinical.care_episodes`, que es —campo por
campo— un **`EpisodeOfCare`** de FHIR: el *contenedor* que agrupa los encuentros de un problema.
Lo que una persona reconoce como «hoja de internación» —procedencia, sala, cama, dieta, destino al
alta, diagnóstico de ingreso— vive en **`Encounter.hospitalization`** y **`Encounter.location`**,
y **eso no existe en el modelo**: los 66 `.puml` no tienen ni una tabla de camas, salas o admisión.

Así que la respuesta a «qué debe tener según norma» tiene dos mitades, y sólo una es de esta noche:

| | |
|---|---|
| **Lo que entra hoy** | 2 campos de 14. Ambos son **lecturas que se tiraban**, no columnas nuevas |
| **Lo que exige modelo** | 10 campos, todos en `Encounter`, ninguno con columna donde caer |
| **Lo que no se puede ni proponer** | 2 campos sin fuente: no se escriben |

## 1. La matriz

**Fuentes:** `FHIR-Enc` = HL7 FHIR R4 `Encounter` · `FHIR-Epi` = HL7 FHIR R4 `EpisodeOfCare` ·
`CR` = skill `clinical-records` del estándar de la casa · `RM-0090` = Norma Técnica del Expediente
Clínico (Bolivia) — **contenido `UNKNOWN`, ver §3**.

**Obligatoriedad:** sale de la cardinalidad que declara la fuente, no de mi criterio.

| # | Campo | Fuente | Obligatoriedad según la fuente | ¿Lo soporta el contrato hoy? | Dónde |
|---|---|---|---|---|---|
| 1 | Paciente | `FHIR-Epi.patient` | **Obligatorio** (1..1) | **Sí** | `care_episodes.patient_profile_id` · ya se manda |
| 2 | Organización custodia | `FHIR-Epi.managingOrganization` | Opcional (0..1) | **Sí** | `care_episodes.tenant_id` · ya se manda |
| 3 | Estado | `FHIR-Epi.status` | **Obligatorio** (1..1) | **Sí** | `care_episodes.status_concept_id` · lo pone el servidor (`CLIN.EPISODE_ACTIVE`) |
| 4 | Período (inicio) | `FHIR-Epi.period` | Opcional (0..1) | **Sí** | `care_episodes.start_at` · **era el único campo del formulario** |
| 5 | **Profesional a cargo** | `FHIR-Epi.careManager` | Opcional (0..1) | **Sí, y se mandaba a ciegas** | `responsible_practitioner_id` · **ahora se muestra** (H5) |
| 6 | **Cuándo se registró** (≠ cuándo empezó) | `CR` §2.3 | **Obligatorio** por diseño de registro clínico | **Sí, y se descartaba** | `care_episodes.created_at`, ya venía en la lectura · **ahora se muestra** (H5) |
| 7 | Tipo de episodio | `FHIR-Epi.type` | Opcional (0..\*) | **Columna sí, catálogo no** | `type_concept_id` existe y **nadie lo manda** → ver §2 |
| 8 | Clase del encuentro (internado / ambulatorio) | `FHIR-Enc.class` | **Obligatorio** (1..1) | Parcial | `encounters.class_concept_id` existe, pero es del encuentro, no del episodio |
| 9 | Diagnóstico de ingreso | `FHIR-Enc.diagnosis` con `use` = *admission* · `FHIR-Epi.diagnosis` (0..\*) | Opcional en ambos | **No** | Ninguna columna. `clinical.conditions` existe pero no se ata al episodio con un rol |
| 10 | Procedencia / de dónde llega | `FHIR-Enc.hospitalization.admitSource` (0..1) · `.origin` (0..1) | Opcional | **No** | No existe `hospitalization` en el modelo |
| 11 | Sala y cama | `FHIR-Enc.location` (0..\*) con `physicalType` | Opcional | **No** | El modelo no tiene camas ni salas: `rg -li "_beds\|_wards" *.puml` → **0 tablas** |
| 12 | Servicio o unidad | `FHIR-Enc.serviceType` (0..1) | Opcional | **No** | Sin columna |
| 13 | Prioridad / urgencia del ingreso | `FHIR-Enc.priority` (0..1) | Opcional | **No** | Sin columna |
| 14 | Preferencia de dieta | `FHIR-Enc.hospitalization.dietPreference` (0..\*) | Opcional | **No** | Sin columna |
| 15 | Destino al alta | `FHIR-Enc.hospitalization.dischargeDisposition` (0..1) · `.destination` (0..1) | Opcional | **No** | Sin columna. Y **no hay endpoint para cerrar el episodio** |
| 16 | Reingreso | `FHIR-Enc.hospitalization.reAdmission` (0..1) | Opcional | **No** | Sin columna |
| 17 | Equipo tratante | `FHIR-Epi.team` (0..\*) | Opcional | **No** | Sin columna |
| 18 | Historial de estados | `FHIR-Epi.statusHistory` (0..\*) | Opcional | **No** | Sin columna. Hoy no se sabe cuándo cambió de estado |

**Conteo:** 18 filas · **6 soportadas** (1–6) · 1 a medias (7) · 1 desplazada de recurso (8) ·
**10 sin ningún lugar donde caer** (9–18).

## 2. El caso 7, que merece párrafo aparte

`care_episodes.type_concept_id` **existe en las cuatro capas**:

```
care_episodes.entity.ts:40   @Property({ fieldName: 'type_concept_id', type: 'uuid', nullable: true })
care-episode.dto.ts:40-46    @ApiPropertyOptional(...) @IsOptional() @IsUUID() typeConceptId?: string;
clinical.types.ts:261        readonly typeConceptId?: string;
diagram_08_clinical.puml     type_concept_id : uuid <<FK>>
```

…y **el formulario nunca lo manda**. El servicio lo guarda tal cual, sin aplicar ningún valor por
omisión (`care-episodes.service.ts:63`), así que **toda internación de la base real queda con
`type_concept_id = NULL`** — teniendo `EP_HOSPITALIZATION` sembrado desde siempre
(`clinical.concepts.ts:18-21`). El expediente no registra que la internación *es* una internación.

**Y aun así no se puede corregir esta noche**, por una razón que es la misma que el estándar de la
casa repite en tres reglas: **no existe ningún conjunto de valores de tipo de episodio.**

- En el paquete de conceptos de la API hay **un** concepto suelto (`EP_HOSPITALIZATION`), no un
  value set.
- En la maqueta hay un uuid suelto, `TIPO_EPISODIO = uuid('concept-episode-type-inpatient')`
  (`core/mock/fixtures/clinica.ts:151`), que **no pertenece a ningún `VS_*`** — se verificó contra
  la lista completa de conjuntos de los fixtures.
- Sin value set no hay `target` de terminología, y sin `target` un `app-concept-select` no tiene de
  dónde sacar opciones.

La única forma de mandarlo hoy sería **escribir el uuid a mano en el frontend**, que es exactamente
lo que la regla de terminología prohíbe y lo que `ConceptSelect` explica en su propia documentación:
«un `*_concept_id` tecleado a mano es un dato inválido que el backend va a rechazar, o —peor— un
uuid de otro conjunto que va a aceptar».

**Queda como propuesta de modelo (§4), no como campo del formulario.** Está registrado como
**D-02** en [`defectos-reportados.md`](./defectos-reportados.md).

> En la **maqueta** esto no se ve: su manejador aplica `datos.typeConceptId ?? TIPO_EPISODIO`
> (`clinical.handlers.ts:264`), así que ahí los episodios sí tienen tipo. El defecto sólo aparece
> contra la API real. Es un caso de libro de simulador más piadoso que el servidor.

## 3. Lo que la norma local diría, y no se sabe

La **RM Nº 0090** (26/02/2008, Ministerio de Salud y Deportes) es de cumplimiento obligatorio en
todo el Sistema Nacional de Salud y **distingue expedientes de hospitalización, consulta externa y
emergencia**, así que una hoja de internación con requisitos propios existe en la norma.

**Su lista de campos es `UNKNOWN`:** el PDF oficial devolvió **403** y las demás referencias son
secundarias, que no sirven como fuente normativa.

Consecuencia honesta para esta matriz: **la columna «obligatoriedad» de las filas 9 a 18 está
tomada de FHIR, que las declara casi todas opcionales.** Es perfectamente posible que la norma
boliviana haga obligatoria alguna —el diagnóstico de ingreso es el candidato evidente—. **No se
supone.** Cerrar esto es de una persona (doctor o negocio) y de un paso: el PDF oficial, o la hoja
de papel que se usa hoy.

## 4. Propuesta de modelo para lo que no cabe

**No se escribió ni una línea de DDL**, y no por falta de tiempo: la dirección del cambio en este
proyecto es `.puml` → `gen_ddl.py` → `SQL/` → BD → entidades, y `check_ddl_sources.py` aborta el
rebuild si aparece un `CREATE TABLE` fuera de `SQL/`. Esto es el insumo de quien sea dueño del
modelo, no un cambio a medio aplicar.

**Dónde iría:** `mantra-core-health-model/Mantra Core Health Context/modules/diagram_08_clinical.puml`,
que ya contiene `care_episodes` (línea 56) y `encounters`.

### 4.1 Lo más barato y lo que más devuelve — un value set

```
VS_CARE_EPISODE_TYPE   (nuevo)
  EP_HOSPITALIZATION   Internación          ← ya existe como concepto suelto
  EP_AMBULATORY        Ambulatorio
  EP_EMERGENCY         Urgencia
  EP_HOME_CARE         Atención domiciliaria
```

Con su nota `SALUD/Patch v4.x/Value sets/vs_care_episode_type.md` (quinta frontera de
`gen_seeds.py`) **si el dueño es el paquete**; si el dueño es la API vía `dynamic-enum-catalog.ts`,
**sin nota** (regla v4.1.9). Más la línea del binding en la maqueta, que es de Ender.

**Esto solo cierra la fila 7 y el defecto D-02**, y no toca ninguna tabla.

### 4.2 Lo que exige tablas nuevas — el encuentro hospitalario

Siguiendo la estructura del estándar, que es lo que la skill `healthcare-interoperability-fhir`
recomienda antes de inventar una forma propia:

```
encounter_hospitalizations        (1:1 con encounters — el backbone `Encounter.hospitalization`)
  encounter_id            uuid FK → clinical.encounters   NOT NULL
  admit_source_concept_id uuid FK → terminology            NULL   -- procedencia (fila 10)
  origin_location_id      uuid FK → ???                    NULL   -- de dónde llega
  diet_preference_concept_id       uuid FK → terminology   NULL   -- fila 14
  discharge_disposition_concept_id uuid FK → terminology   NULL   -- fila 15
  re_admission            boolean                          NULL   -- fila 16

encounter_locations               (N — `Encounter.location`; salas y camas, fila 11)
  encounter_id            uuid FK → clinical.encounters   NOT NULL
  location_id             uuid FK → <tabla de ubicaciones NUEVA>  NOT NULL
  physical_type_concept_id uuid FK → terminology           NULL   -- sala / cama / ala
  period_start / period_end  timestamptz                   NULL

encounter_diagnoses               (N — `Encounter.diagnosis`; fila 9)
  encounter_id            uuid FK → clinical.encounters   NOT NULL
  condition_id            uuid FK → clinical.conditions   NOT NULL
  use_concept_id          uuid FK → terminology           NULL   -- «de ingreso», «de alta»…
  rank                    integer                          NULL
```

Y dos columnas sueltas en `encounters`: `service_type_concept_id` (fila 12) y
`priority_concept_id` (fila 13).

> [!warning] Lo de arriba es un **esqueleto para discutir, no un diseño cerrado**
> Tiene por lo menos una decisión de negocio sin tomar que no me corresponde: **`encounter_locations`
> necesita una tabla de ubicaciones físicas que no existe**, y decidir si las camas de una clínica
> son `practice.practice_sites` con más granularidad, o una jerarquía propia, no es una decisión
> técnica. `Location` en FHIR es un recurso entero.
>
> Tampoco se dimensionó: nada de esto se midió en deltas de tablas, FKs ni índices, porque eso se
> hace regenerando, y regenerar es del dueño del modelo.

### 4.3 Dueño e impacto

| | |
|---|---|
| **Dueño** | Quien sea dueño del modelo (`mantra-core-health-model`, rama `dev`, entra por PR) |
| **Bloquea** | Las filas 9 a 18 de la matriz. **No bloquea** nada de lo que se entregó esta noche |
| **Riesgo de no hacerlo** | La hoja de internación va a seguir siendo una fecha, por más que se la rediseñe. **No es un problema de pantalla** |
| **Reversibilidad** | Un cambio de esquema no se deshace con un `revert`. Por eso no se tocó |

## 5. Los campos que NO se proponen, y por qué

Estos aparecen en cualquier hoja de internación de papel. **Ninguno entra**, porque ninguno tiene
fuente que lo pida entre las que se pudieron verificar:

| Campo | Por qué no |
|---|---|
| Acompañante o responsable del paciente | Sin fuente. FHIR lo modela como `RelatedPerson`, que es otro recurso y otra conversación |
| Pertenencias del paciente | Sin fuente. Es práctica administrativa, no dato clínico |
| Datos del seguro para la internación | Existe `FHIR-Enc.account` (0..\*), pero atarlo al módulo de seguros del proyecto es una decisión de producto que nadie tomó |

Si la RM Nº 0090 los exige, entran **con esa cita**. Hasta entonces, un campo obligatorio inventado
es peor que un campo que falta: el que falta se ve, el inventado se cumple.
