# Defectos reportados durante el turno

> Regla 50: un defecto se reporta **apenas aparece**, no al cierre. Regla 80.4.2: se **reproduce**
> antes de clasificarlo. Regla del reparto: **quien lo encuentra no lo arregla** si el archivo es
> de otro.
>
> Turno: línea B (Marcelo), noche del 2026-09-20 · corte `68dcb562`.

---

## ~~D-01 · El selector de «qué se midió» ofrece estados administrativos~~ — **RETIRADO**

> [!important] Este defecto **no existe**. Lo reporté mal y el navegador lo desmintió.
>
> **Qué afirmé:** que `clinical.observations.code_concept_id` no tenía patrón en la tabla `ENUMS`
> del simulador y caía al fallback `VS_RECORD_STATUS`, así que el desplegable ofrecería
> «Activo, Inactivo, Pendiente…».
>
> **Qué es verdad:** los cuatro mapeos **existen**, en `misc.handlers.ts`, filas 55-58 de `ENUMS`
> — exactamente los cuatro que yo «proponía agregar»:
>
> ```ts
> [/observations\.code_concept_id/, 'VS_OBSERVATION_CODE', 'Medición'],
> [/observations\.quantity_unit_concept_id/, 'VS_OBSERVATION_UNIT', 'Unidad'],
> [/observations\.category_concept_id/, 'VS_OBSERVATION_CATEGORY', 'Categoría'],
> [/observations\.interpretation_concept_id/, 'VS_OBSERVATION_INTERPRETATION', 'Interpretación'],
> ```
>
> **Cómo se destapó:** la corrida de Playwright imprimió lo que el desplegable ofrece de verdad:
>
> ```
> OPCIONES DE CABECERA OFRECIDAS: ["Elegí qué medir"," Presión arterial sistólica ",
>  " Presión arterial diastólica "," Frecuencia cardíaca "," Temperatura corporal "," Peso ",
>  " Talla "," Índice de masa corporal "," Glucemia en ayunas "," Saturación de oxígeno ",
>  " Hemoglobina glicosilada "]
> ```
>
> **El error de método:** clasifiqué a partir de un `grep` que volvió vacío, sin ejecutar nada. La
> regla 80.4.2 pide **reproducir antes de clasificar** y no lo hice. Un `grep` que no encuentra algo
> demuestra que mi patrón no casó, **no** que la cosa no esté. Queda acá en vez de borrarse, porque
> un defecto retirado en silencio es indistinguible de uno que nunca se revisó.
>
> **Nada que hacer. No se le pidió nada a Ender por esto.**

<details>
<summary>El reporte original, conservado para que se pueda auditar el error</summary>

| Campo | Valor |
|---|---|
| **Dueño** | **Ender** — `src/app/core/mock/handlers/misc.handlers.ts` es suyo |
| **Clase** | `PRODUCT_BUG` (en la maqueta) — **equivocada** |
| **Encontrado** | 2026-09-21, haciendo el discovery de C-14 |
| **Preexistente** | **Sí.** No lo introduce este carril; afecta a `observation-block` desde antes |
| **Severidad** | Alta para recorrer: el paso «el médico registra una observación» no se puede completar con sentido |

### Qué pasa

`ConceptSelect` pide las opciones a `GET /system-context/dynamic-enums?target=…`. El manejador del
simulador (`misc.handlers.ts:307`) busca el `target` en una tabla de patrones y, **si ninguno casa,
cae a `VS_RECORD_STATUS`**:

```ts
const [, valueSet, name] = ENUMS.find(([patron]) => patron.test(target)) ?? [
  null,
  'VS_RECORD_STATUS',
  'Estado',
];
```

**No hay ningún patrón para `clinical.observations.*`.** Verificado:

```
$ grep -n "observations\." src/app/core/mock/handlers/misc.handlers.ts
(sin resultados)
```

Resultado: el campo «Qué se midió» de la casilla **Observación** ofrece el catálogo equivocado.

| Debería ofrecer (`VS_OBSERVATION_CODE`) | Ofrece hoy (`VS_RECORD_STATUS`) |
|---|---|
| Presión arterial sistólica · Presión arterial diastólica · Frecuencia cardíaca · Temperatura corporal · Peso · Talla · Índice de masa corporal · Glucemia en ayunas · Saturación de oxígeno · Hemoglobina glicosilada | Activo · Inactivo · Pendiente · Verificado · Sin verificar · Rechazado · Revocado |

### Por qué es grave, y por qué no se ve

**Un catálogo equivocado se ve como un catálogo, no como un error.** La pantalla no avisa nada: el
desplegable carga, tiene opciones y se puede elegir una. Lo que queda guardado es una observación
cuyo «qué se midió» es «Pendiente».

Y esto **ya pasó antes, con el mismo mecanismo**. El comentario de `misc.handlers.ts:38-52` lo
cuenta para el diagnóstico: sin patrón, «Elegí un diagnóstico» ofrecía «Activo, Inactivo,
Pendiente…», los cinco casos de demostración salían «aplicados parcialmente» y nadie veía por qué.
Se arregló con **una línea**. La de observaciones nunca se agregó.

### Pasos para reproducirlo

1. `yarn start`, entrar como `medica@alovida.mock`.
2. Abrir una consulta de un paciente e iniciar el encuentro.
3. Abrir la casilla **Observación**.
4. Desplegar «Qué se midió».
5. **Observado:** Activo, Inactivo, Pendiente, Verificado… **Esperado:** Presión arterial, Peso, Talla…

### Qué lo arregla

Una línea en la tabla `ENUMS`, con el mismo patrón que ya usan los otros catálogos clínicos
(la tabla en el patrón, porque `code_concept_id` existe en media docena de tablas):

```ts
[/observations\.code_concept_id/, 'VS_OBSERVATION_CODE', 'Medición'],
```

Y por el mismo motivo conviene revisar los otros tres del mismo bloque, que también caen al
fallback y cuyos conjuntos **ya existen en los fixtures**:

```ts
[/observations\.quantity_unit_concept_id/, 'VS_OBSERVATION_UNIT', 'Unidad'],
[/observations\.category_concept_id/, 'VS_OBSERVATION_CATEGORY', 'Categoría'],
[/observations\.interpretation_concept_id/, 'VS_OBSERVATION_INTERPRETATION', 'Interpretación'],
```

**No se aplicó desde este carril**: `core/mock/**` está reservado a Ender y la regla del reparto
dice que quien necesite un cambio ahí lo pide, no lo escribe.

### Qué bloquea de C-14, y qué no

**No bloquea la cuadrícula.** El mecanismo —elegir la cabecera de un catálogo, cargar la fila,
releerla, una por sesión— es independiente de qué conceptos traiga el catálogo, y está cubierto
por las pruebas de `note-grid.spec.ts`, que sirven el catálogo desde un doble declarado
(regla 65). Lo que queda pendiente de verificar contra lo real es **el contenido del
desplegable**, que va a ser el correcto en cuanto entre esa línea.
</details>

---

## D-02 · La hoja de internación se guarda sin decir que es una internación

| Campo | Valor |
|---|---|
| **Dueño** | **Dueño del modelo** — no se puede cerrar desde el frontend |
| **Clase** | `PRODUCT_BUG` |
| **Encontrado** | 2026-09-21, haciendo la matriz de C-23 |
| **Preexistente** | Sí |
| **Sólo en la API real** | Sí. La maqueta aplica `datos.typeConceptId ?? TIPO_EPISODIO` (`clinical.handlers.ts:264`), así que ahí no se ve |
| **Confirmado 2026-09-21 (sesión 2)** | Contra Neon: `POST /clinical/care-episodes` sin `typeConceptId` → `201`; el `summary` releído confirma el campo **ausente**. `clinical-c14-c23-notas-e-internacion.int-spec.ts`, caso «D-02» |

`clinical.care_episodes` tiene `type_concept_id` (`care_episodes.entity.ts:40`), el DTO lo acepta
(`care-episode.dto.ts:40-46`), el cliente lo tipa (`clinical.types.ts:261`) y el servicio lo guarda
tal cual **sin aplicar ningún valor por omisión** (`care-episodes.service.ts:63`).

El formulario **nunca lo manda**, así que toda internación del sistema queda con
`type_concept_id = NULL` — teniendo `EP_HOSPITALIZATION` sembrado desde siempre
(`clinical.concepts.ts:18-21`). El episodio no registra qué clase de episodio es.

**No se puede cerrar desde acá, y no por falta de tiempo.** Mandar el tipo exige elegirlo de un
catálogo, y **no existe ningún conjunto de valores de tipo de episodio**: en la API hay un concepto
suelto y en la maqueta un uuid suelto (`TIPO_EPISODIO`, `fixtures/clinica.ts:151`), ninguno de los
dos dentro de un `VS_*`. La única forma de mandarlo hoy sería escribir el uuid a mano en el
frontend, que es lo que la regla de terminología prohíbe — y lo que el propio `ConceptSelect`
explica en su documentación: «un `*_concept_id` tecleado a mano es un dato inválido que el backend
va a rechazar, o —peor— un uuid de otro conjunto que va a aceptar».

**Queda como propuesta de modelo**, con el value set y el binding, en
[`matriz-internacion.md`](./matriz-internacion.md) §4.1. Es el cambio más barato de toda la matriz
y el que más devuelve: no toca ninguna tabla.

---

## D-03 · `POST /clinical/encounters/:id/close` da 500: deriva de esquema real

| Campo | Valor |
|---|---|
| **Dueño** | **Dueño del modelo/infra** — no se puede cerrar desde el frontend |
| **Clase** | `PRODUCT_BUG` |
| **Encontrado** | 2026-09-21 (sesión 2), sembrando datos para el kill-test de C-14 contra la API real |
| **Preexistente** | Sí — es la base de Neon la que le falta la columna, no algo que este carril introdujo |
| **Ambiente** | Sólo se ve contra la API real. No hay equivalente en la maqueta: el simulador siempre responde `200` al cierre |

`EncountersService.close()` intenta actualizar `clinical.encounters` incluyendo la columna
`content_hash`, que la **entidad ORM declara** pero **esta base de Neon no tiene materializada**.
Postgres rechaza el `UPDATE` completo:

```
InvalidFieldNameException: column "content_hash" of relation "encounters" does not exist
code: 42703 (undefined_column)
    at ChangeSetPersister.persistManagedEntity (…UnitOfWork.js)
```

Cuerpo que devuelve la API (sanitizado, sin `stack`):

```json
{"code":"INTERNAL","message":"Error interno del servidor","correlationId":"3972",
 "path":"/clinical/encounters/102b34e7-a45d-4b5a-b421-1e40cf6e3d58/close"}
```

### Cómo se reprodujo

```
$ curl -X POST http://localhost:3000/clinical/encounters/<id>/close \
    -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{}'
→ 500

$ docker logs mantra-redesa-api-1 --since 10m | grep '"reqId":3972'
→ InvalidFieldNameException (arriba)
```

### Impacto

**Ningún encuentro se puede cerrar hoy contra este ambiente.** Efecto lateral medido: dos
encuentros del mismo paciente pueden quedar simultáneamente «en curso» (uno sembrado, otro abierto
por la UI), y `encuentroActual` (`consultation.ts`, `encuentrosEnCurso()[0]`) elige uno sin garantía
de cuál — la cuadrícula puede terminar creyendo que «esta consulta» ya tiene su fila cuando en
realidad es una anterior. Se lo rodeó en el spec real **sin cerrar el encuentro**
(`sembrarObservacionPrevia`, `playwright/support/api-real-clinica.ts`), no arreglándolo.

### Qué lo arregla

Aplicar a esta base de Neon el patch de `SQL/` que agrega `clinical.encounters.content_hash` (fuera
de alcance: escribir DDL o aplicar patches es del dueño del modelo, regla 97.1.3). Alternativa más
rápida si la columna es prescindible en este entorno: que `EncountersService.close()` no la incluya
en el `UPDATE` cuando la fidelidad del esquema detecte que no existe — decisión de la API, no mía.

---

## D-04 · Un médico sin relación asistencial pudo internar a un paciente ajeno

| Campo | Valor |
|---|---|
| **Dueño** | **Dueño de la API** — `clinical-encounters.controller.ts` |
| **Clase** | Hallazgo, **sin veredicto** — no se afirma `FAIL` de regla 40 sin que el dueño confirme que es autorización, no un permiso deliberado |
| **Encontrado** | 2026-09-21 (sesión 2), explorando el contrato de `care-episodes` para el int-spec |
| **Preexistente** | Sí |

`POST /clinical/care-episodes` lleva `@Roles('CLINICIAN', 'PRACTITIONER')` pero **no**
`@UseGuards(ClinicalRecordAccessGuard)` — a diferencia de `clinical/observations`,
`clinical/service-requests`, `clinical/diagnostic-reports` y `clinical-read`, que sí lo llevan
(`clinical-observations.controller.ts:43`, `clinical-orders.controller.ts:73,85`,
`clinical-read.controller.ts:45`). Un médico registrado sin ninguna relación asistencial ni turno
con un paciente pudo abrir un episodio de cuidado para él:

```
$ curl -X POST http://localhost:3000/clinical/care-episodes -H "Authorization: Bearer <token-médico-sin-relación>" \
    -d '{"patientProfileId":"<paciente-ajeno>","tenantId":"<tenant>","responsiblePractitionerId":"<hpid>"}'
→ 201 {"id":"3689771a-…","status":"902abacd-…","startAt":"2026-09-21T13:26:18.008Z",…}
```

**No se corrigió.** El archivo es del dueño de la API, y la regla de la aceptación es «se reporta,
no se arregla» — máxime tratándose de un guard de autorización que puede tener una razón que este
carril no conoce (por ejemplo, si `care-episodes` se pensó como acción de emergencia sin relación
previa). **Se reporta con evidencia y se deja la decisión a su dueño.**

---

## D-05 · Una internación con fecha de inicio futura se acepta sin rechazo del servidor

| Campo | Valor |
|---|---|
| **Dueño** | **Dueño de la API** |
| **Clase** | Hallazgo, **sin veredicto** |
| **Encontrado** | 2026-09-21 (sesión 2), en el mismo int-spec |
| **Preexistente** | Sí |

```
$ curl -X POST http://localhost:3000/clinical/care-episodes -H "Authorization: Bearer <token>" \
    -d '{"patientProfileId":"<pid>","tenantId":"<tenant>","responsiblePractitionerId":"<hpid>",
        "startAt":"2026-09-22T13:26:10.335Z"}'
→ 201
```

El front **sí** rechaza una fecha de inicio futura (`admission-block.ts`, `inicioEnElFuturo()`,
regla 60 §3 del propio `PLAN.md`), pero el contrato la acepta igual. Regla 60.4 (validar toda
mutación server-side): si el front es la única barrera, cualquier cliente que hable el protocolo
directo la salta. **No se corrigió**: es una decisión de validación del dueño de la API, y podría
ser deliberada (una internación "programada" es un caso de uso legítimo que este lote no conoce).

---

## D-06 · El buscador de «Medicamento» ofrece Activo/Inactivo, no medicamentos

| Campo | Valor |
|---|---|
| **Dueño** | **Ender** — `src/app/core/mock/handlers/misc.handlers.ts` es suyo |
| **Clase** | `PRODUCT_BUG` (en la maqueta) |
| **Encontrado** | 2026-09-21 (sesión 2), recorriendo C-20/C-21/C-22 de #557 para el dictamen H6 |
| **Preexistente** | Sí — el bloque de medicación no cambió esto en #557; el hueco está en el manejador del catálogo, que #557 no toca |
| **Mismo mecanismo que D-01, esta vez real** | El D-01 de C-14 se **retiró**: reporté un `grep` vacío sin reproducir y el navegador lo desmintió (`VS_OBSERVATION_CODE` sí estaba mapeado). Acá se reprodujo **antes** de escribir el defecto, exactamente por la lección de esa retractación |

### Qué pasa

`ConceptSelect`/`ReferenceCombobox` piden las opciones a
`GET /system-context/dynamic-enums?target=…`. El manejador del simulador
(`misc.handlers.ts:307-313`) busca el `target` en la tabla `ENUMS` y, **si ningún patrón casa,
cae a `VS_RECORD_STATUS`**:

```ts
const [, valueSet, name] = ENUMS.find(([patron]) => patron.test(target)) ?? [
  null,
  'VS_RECORD_STATUS',
  'Estado',
];
```

**No hay ningún patrón para `medication_requests.medication_concept_id`** en la tabla `ENUMS`
(31 entradas, líneas 31-128): verificado leyendo el archivo entero, no con un `grep` que puede
fallar por un typo. El campo «Medicamento» de la casilla de medicación busca sobre el catálogo
equivocado.

| Debería ofrecer (medicamentos, `conceptos.ts:920-934`) | Ofrece hoy (`VS_RECORD_STATUS`) |
|---|---|
| Paracetamol 500 mg comprimidos · Ibuprofeno 400 mg comprimidos · Loratadina 10 mg · Sulfato ferroso 300 mg · Ciprofloxacino 500 mg · Insulina NPH 100 UI/ml | Activo (`ST-ACTIVE`) · Inactivo (`ST-INACTIVE`) |

### Cómo se reprodujo (en `dictamen-h6-recorrido.spec.ts`, caso «D-06»)

```
1. Abrir la casilla de medicación con un encuentro en curso.
2. Escribir «Paracetamol» en «Medicamento».
   Observado: «Ningún medicamento coincide». Esperado: la opción del catálogo.
3. Escribir «Activo» en el MISMO campo.
   Observado: aparece la opción «Activo» con el hint «ST-ACTIVE».
```

El paso 3 es la prueba de que el catálogo **no está vacío ni con fallo de red** — está cargado,
y es el equivocado. Un catálogo equivocado se ve como un catálogo, no como un error: no hay
alerta, no hay traza de consola, la pantalla ofrece un desplegable con opciones y se puede
«elegir» una que no significa nada.

### Qué bloquea, y qué no

**No bloquea C-15, C-16, C-17, C-18 ni C-19** (no necesitan elegir un medicamento real: leen
o escriben otros campos del formulario). **Bloquea C-20 completo** (no se puede elegir un
medicamento con posología de fábrica si no se puede elegir ningún medicamento), **C-22 completo**
(el CA exige elegir medicamento y dejar el motivo vacío) y **la mitad de C-21** que este carril
recorrió (crear una receta nueva para ver el menú de acciones exige, primero, elegir un
medicamento).

### Qué lo arregla

Una línea en la tabla `ENUMS`, mismo patrón que ya usan los demás catálogos clínicos (regla del
proyecto: la tabla va en el patrón porque `*_concept_id` se repite en media docena de tablas):

```ts
[/medication_requests\.medication_concept_id/, 'VS_MEDICAMENTO', 'Medicamento'],
```

El nombre exacto del value set (`VS_MEDICAMENTO` es un supuesto de este reporte, no una cita) lo
decide quien tenga el fixture real de medicamentos (`conceptos.ts` los declara con builder propio,
no con `conjunto(...)` genérico — hay que confirmar cuál `internalCode` les corresponde antes de
escribir la línea).

**No se aplicó desde este carril**: `core/mock/**` está reservado a Ender y la regla del reparto
dice que quien necesite un cambio ahí lo pide, no lo escribe.
