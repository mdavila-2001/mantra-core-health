# Pendientes de backend — campos de elección del generador (`forms`)

**Estado (2026-10-05):** implementado en `mantra-core-health-redesa-api`
(commit `b74203f3`). El cliente y el simulador ya los implementaban; ahora el
backend real también — con una salvedad de esquema, ver «Lo que cambió del
plan original» más abajo.

## Por qué

`forms.dynamic_field_definitions` declara hoy un `data_type` del catálogo
`terminology.technical_data_type` y nada más. Con eso, el generador de
formularios sólo sabe pedir **texto, número, sí/no y fecha**.

Es justo lo que un formulario clínico menos usa. «¿Fuma?» no es un texto libre:
es *nunca / ex fumador / fumador*. La clase funcional NYHA es una escala cerrada
de cuatro. Los factores de riesgo son una lista de la que se marcan varios.
Servidas como texto libre, las tres dejan de ser comparables entre consultorios
—que es exactamente lo que el formulario estándar existe para lograr— y no hay
forma de contarlas después.

El tipo técnico que corresponde ya existe: `code`. Lo que falta es **de dónde
salen los códigos**.

## Por qué no un `value_set`

`forms.field_assignments.value_set_id` ya existe y apunta al catálogo de
terminología. No sirve para este caso: un value set lo arma un administrador en
el módulo de terminología, y lo que se pidió acá es que **el doctor escriba sus
propias opciones** sin pedirle nada a nadie. Obligar a dar de alta un value set
para poner tres opciones en un campo propio es el rodeo que este generador
existe para evitar.

Los campos del **estándar** sí pueden seguir usando `value_set_id`: los arma
quien administra y viven en el catálogo. Los dos caminos conviven.

## Lo que cambió del plan original

Este documento proponía guardar la opción elegida en `value_concept_id` (la
columna que ya usa `dataType: "code"`). **No se puede**: esa columna es
`uuid` con FK a `terminology.catalog_concepts`, y una opción tecleada a mano
como «Ex fumador» no es un concepto — la base rechazaría el insert por tipo
y por la FK.

Se agregó una columna nueva, `field_values.value_code` (texto, sin FK),
exclusiva con `value_concept_id` dentro del mismo `value[x]`: un campo `code`
llena una u otra según declare `valueSetId` (value set administrado,
`value_concept_id`) u `options` propias (texto libre, `value_code`), nunca
las dos. `buildValueColumns` decide cuál mirando si el campo tiene
`valueSetId`.

Es, igual que el resto de este documento, un adelanto de la entidad al
esquema (`database/README.md` de la API: el DDL canónico se edita en
`mantra-core-health-model` y se vendorea acá) — se materializa de forma
aditiva por `ORM_SCHEMA_SYNC=safe` hasta que alguien promueva la columna al
repo del modelo.

## Lo que falta

### 1. Guardar las opciones de una definición propia — ✅ hecho

```
POST /forms/field-definitions
{ "code", "name", "dataType": "code", "options": string[], "multiple"?: boolean }
```

`options` es texto libre, en el **orden en que se ofrecen**: es el orden en que
se van a leer en la ficha. `multiple` distingue «una sola respuesta» de «varias»
—en la pantalla, «Opción múltiple» frente a «Casillas de verificación»—; es
cardinalidad, no tipo, y por eso viaja aparte y no como otro `dataType`.

Esquema real: `options jsonb` y `cardinality_min`/`cardinality_max` (estos
dos ya existían) en `dynamic_field_definitions`, no una tabla aparte — no
hacía falta referenciar cada opción por id.

Las tres validaciones que el front ya aplicaba, el servidor las repite
(`ChartTemplatesService.validateChoiceField` / `FormsFieldsService.
validateChoiceField` — duplicada a propósito entre los dos módulos, ver el
comentario en el código):

- `dataType: "code"` sin `options` (ni `valueSetId`) se rechaza: un campo
  codificado sin nada entre qué elegir no se puede responder.
- menos de **dos** opciones se rechaza: elegir entre una no es elegir.
- una opción vacía o repetida se rechaza.

Falta todavía: `POST /charts/templates` acepta `options`/`multiple`/
`allowOther`/`description` en el campo inline (es el camino que usa el
generador real), pero **no** hay un `POST /forms/field-definitions` suelto
que el frontend ya pueda llamar aparte de crear la plantilla entera —existe
en la API, con las mismas validaciones, pero nadie en este repo lo invoca
todavía. Conectarlo es trabajo de frontend, no de backend.

### 1b. Lo demás que una pregunta declara (lo de Google Forms) — ✅ hecho, con una excepción

El generador ofrece, además de las opciones, lo que cualquier editor de
formularios ofrece por pregunta. Todo viaja en la **definición** —es de la
pregunta, no del formulario donde está colgada— y el simulador ya lo persiste:

```
POST  /forms/field-definitions
PATCH /forms/field-definitions/:id
{
  "description"?:    string | null,   // la ayuda que se lee bajo la pregunta
  "allowOther"?:     boolean,         // ofrece «Otro» con texto libre
  "cardinalityMin"?: number | null,   // casillas: marcar al menos N
  "cardinalityMax"?: number | null    // casillas: marcar como máximo N
}
```

- `description` se sirve como `hint` del campo. En el `PATCH`, `null` la
  **quita**; ausente, no la toca. Implementado tal cual.
- `allowOther` sólo tiene sentido con `dataType: "code"` y se valida contra
  eso. Lo que faltaba de verdad —que el backend acepte un valor fuera del set
  cuando el campo lo permite— **está**: `FormsValuesService.validateCodeValue`
  acepta cualquier texto no vacío cuando `allowOther: true`, y si no, exige
  que esté entre `options`.
- `cardinalityMin`/`cardinalityMax`: la columna y la validación de «al menos
  N, como máximo N» **ya existían** de una ronda anterior (no las agregó esta
  pasada); lo que faltaba y se agregó fue que viajen también por el camino
  inline de `POST /charts/templates`.
- **Lo que NO se implementó:** que el servidor rechace una cantidad de
  respuestas marcadas por fuera de `cardinalityMin`/`cardinalityMax` al
  **capturar** un valor (`POST /forms/instances/:id/values`). Hoy valida que
  cada opción capturada esté en la lista (o sea «Otro» permitido), pero no
  cuenta cuántas filas llegaron para el mismo campo contra esos topes. El
  front sigue siendo quien acota eso; que el servidor lo repita queda
  pendiente.

### 1c. Las cuadrículas (19/09)

El propietario pidió, además del `Sí / No` en botones, los dos tipos de
**cuadrícula** que ofrece cualquier editor de formularios: la de opción única
—una respuesta por fila— y la de casillas —varias—, «con las mismas
restricciones». Son la misma pregunta repetida sobre varios sujetos: la clase
funcional sobre ocho síntomas, una escala de frecuencia sobre seis hábitos.
Servidas como ocho preguntas sueltas, la escala se repite ocho veces y hay que
releerla en cada una.

**No son un `dataType` nuevo.** El dato guardado sigue siendo uno de los códigos
ofrecidos: `code`, igual que «Opción múltiple». Lo que las distingue es tener
filas, y eso viaja aparte —como ya viaja `multiple`—:

```
POST  /forms/field-definitions
PATCH /forms/field-definitions/:id
{
  "dataType": "code",
  "options": string[],                  // las COLUMNAS
  "rows"?: string[],                    // las FILAS; tenerlas es ser cuadrícula
  "multiple"?: boolean,                 // varias respuestas POR FILA
  "requireEachRow"?: boolean,           // «Requerir una respuesta en cada fila»
  "oneResponsePerColumn"?: boolean      // «Limitar a una respuesta por columna»
}
```

- `rows` se reemplaza **entera**, con la misma regla que `options`, y una lista
  **vacía la quita**: es como un campo deja de ser cuadrícula al volver a
  «Opción múltiple». Por eso el front la manda siempre que el campo sea de
  elección, incluso vacía; si sólo se mandara cuando hay filas, quedarían
  colgadas de un campo que ya no las dibuja y volverían a aparecer al recargar.
- `requireEachRow` **no es** `required` de la asignación. `required` exige que
  la pregunta tenga alguna respuesta; una cuadrícula obligatoria con una sola
  fila contestada ya lo cumple. Esto exige las ocho.
- `oneResponsePerColumn` es la de ordenar sin empates. El front la hace cumplir
  **apagando** la columna ya usada en las demás filas, y la valida además como
  red por si un valor viene de antes de que la restricción existiera.
- Con las dos puestas y más filas que columnas la cuadrícula **no se puede
  terminar de responder**. El editor lo avisa al armarla; el servidor debería
  rechazarlo.

Sugerencia de esquema: junto a `options jsonb`, un `rows jsonb` y dos columnas
booleanas. Si se prefiere una tabla `dynamic_field_options` con `ordinal`, las
filas piden su propio eje —`axis` con `row`/`column`—, no una tabla más.

#### Lo capturado

Una cuadrícula responde **una fila por vez**, así que lo natural contra el
contrato actual de `POST /forms/instances/:id/values` es **una fila por
respuesta**, con la fila identificada y su columna como valor —y varias filas
con el mismo `ordinal` distinto en la de casillas—. Un único valor con un objeto
`{ fila: columna }` dentro obligaría a parsearlo en cada lectura y dejaría fuera
lo que `field_values` sabe hacer.

El servidor debería rechazar una fila que no esté declarada y una columna que no
esté entre las opciones, por lo mismo que con un campo de elección: si no, el
campo cerrado no cierra nada.

### 1d. El `Sí / No` se contesta con dos botones, y eso cambia qué se guarda

No es sólo maqueta. Una casilla marcada dice «sí» y desmarcada **no dice nada**:
«contestó que no» y «no se preguntó» se guardaban igual, que en una ficha
clínica no es un detalle. Con dos botones el campo tiene tres estados —`true`,
`false` y sin responder— y `required` vuelve a significar algo: con una casilla,
`false` pasa el obligatorio sin que nadie haya contestado.

No hace falta nada nuevo del contrato: `dataType: "boolean"` ya lo admite. Lo
que sí hace falta es que el backend **no** trate «ausente» como `false` al
capturar el valor.

### 2. Corregirlas — ✅ hecho, con la decisión tomada

```
PATCH /forms/field-definitions/:id
{ "name"?, "dataType"?, "options"?, "multiple"?, "allowOther"?, "description"? }
```

`options` se reemplaza **entera**, nunca por índice — implementado tal cual.

La pregunta de verdad sí se decidió, de las tres salidas que este documento
dejaba planteadas: se tomó la **2** («se rechaza quitar una opción con
respuestas y se dice por qué»), no la 1 («se marca como retirada pero sigue
existiendo»). Motivo: la 1 es la correcta para un registro clínico a largo
plazo, pero exige que `options` deje de ser `string[]` plano —cada opción
necesita un `retired: boolean` propio, lo que es una forma de dato distinta,
no sólo una columna más— y eso es otra decisión de esquema, no una de
validación. La 2 no exige nada nuevo y nunca deja un valor capturado
apuntando a una opción que desapareció, que es la garantía que de verdad
importa. Si más adelante hace falta poder retirar una opción respondida sin
perder el historial, ahí sí conviene encarar el cambio de forma de `options`.

`FieldValuesRepository.findCodesInUseByField` es la consulta que lo
respalda: antes de reemplazar `options`, compara lo que se va a quitar
contra lo que ya tiene al menos una respuesta.

### 3. Devolverlas al leer la plantilla — ✅ hecho

```
GET /charts/templates/:id
→ fields: [{ …, "options"?, "multiple"?, "allowOther"?, "description"?,
             "cardinalityMin"?, "cardinalityMax"? }]
```

`ChartTemplatesService.resolveSchema` las lee de vuelta de la misma entidad
en la que `createTemplate` las escribió.

### 4. Aceptarlas al capturar un valor — hecho a medias

`POST /forms/instances/:id/values` recibe `dataType: "code"` y valida que el
valor esté entre las opciones declaradas (o sea el texto de «Otro», si el
campo lo permite) — rechaza si no, en captura, corrección e importación.

**La vía de «una fila por opción marcada» no necesitó código nuevo**: el
contrato de captura ya es una lista de `{ fieldId, dataType, value, ordinal
}`, así que un campo `multiple` simplemente manda varias entradas con el
mismo `fieldId` y distinto `ordinal` — es exactamente lo que el motor ya
hacía para cualquier campo repetible.

**Lo que sigue sin hacer:** el servidor no cuenta cuántas opciones llegaron
para un mismo campo contra `cardinalityMin`/`cardinalityMax` — ver la nota
en §1b. Es la validación de «al menos N, como máximo N» de las casillas, y
hoy sólo la aplica el front.

## Mientras tanto

`src/app/core/mock/handlers/surveys-forms.handlers.ts` sigue siendo el
simulador (guarda `options`, `multiple`, `rows` y las dos restricciones de
cuadrícula), y la pantalla puede seguir recorriéndose contra él. Contra el
backend real, las claves **ya no se ignoran**: `options`/`multiple`/
`allowOther`/`description`/`cardinalityMin`/`cardinalityMax` viajan, se
validan y se guardan — ver el commit `b74203f3` de
`mantra-core-health-redesa-api`. Lo único que falta del lado del frontend es
conectar la pantalla del generador contra el endpoint real en vez del mock,
que es trabajo de este repo, no del backend.

Los campos de elección del catálogo sembrado
(`src/app/core/mock/handlers/clinical.handlers.ts`) están puestos con nombres
clínicos reales —NYHA, factores de riesgo, tipo de lactancia— para que lo que se
ve al abrir la pantalla sea lo que un doctor reconoce, y no «Opción 1 / Opción
2».

### 5. Dependencias entre campos («¿cuál?» debajo de un «sí») — 2026-10-02

**Las fichas del catálogo ya las tienen en el backend real** (API `justin/fichas-clinicas-v2`):
cada campo puede traer `showWhen: { fieldId, equals }` en `GET /charts/templates`, con la
semántica de `enableWhen` de HL7 FHIR (operador `=`, comportamiento `SHOW`). La siembra las
guarda en el `default_value_json` de la clave `__catalog__` (`fieldPresentation`) junto con
`section`, `options`, `multiple`, `allowOther` y `description`, porque
`forms.dynamic_field_definitions` no tiene columnas para nada de eso.

Lo que **falta** es lo mismo para los campos **propios** de una organización: el generador no
deja todavía declarar «mostrar este campo sólo si…». El backend ya tiene el contrato
(`POST /forms/fields/:id/dependencies`, `CreateFieldDependencyDto` con `EQ`/`SHOW`) y la tabla
`forms.field_dependencies`; falta que `GET /charts/templates` las lea y las publique en el mismo
`showWhen`, y que el editor las ofrezca.

Reglas que el cliente ya aplica y el servidor debería respetar al capturar:

- un campo oculto **no se envía** y su `required` no cuenta;
- con un padre de varias respuestas, la condición se cumple si la respuesta **incluye** el valor;
- un campo cuyo padre está oculto también está oculto.
