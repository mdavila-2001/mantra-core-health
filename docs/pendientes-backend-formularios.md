# Pendientes de backend — campos de elección del generador (`forms`)

**Estado:** el cliente y el simulador ya los implementan. El backend real
todavía no.

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

## Lo que falta

### 1. Guardar las opciones de una definición propia

```
POST /forms/field-definitions
{ "code", "name", "dataType": "code", "options": string[], "multiple"?: boolean }
```

`options` es texto libre, en el **orden en que se ofrecen**: es el orden en que
se van a leer en la ficha. `multiple` distingue «una sola respuesta» de «varias»
—en la pantalla, «Opción múltiple» frente a «Casillas de verificación»—; es
cardinalidad, no tipo, y por eso viaja aparte y no como otro `dataType`.

Sugerencia de esquema: una columna `options jsonb` y `cardinality_max` en
`dynamic_field_definitions`, o una tabla `dynamic_field_options` con su
`ordinal` si se quiere poder referenciar cada opción por id más adelante.

Validaciones que el front ya aplica y que el servidor debería repetir, porque es
el que manda:

- `dataType: "code"` sin `options` (ni `valueSetId`) se rechaza: un campo
  codificado sin nada entre qué elegir no se puede responder.
- menos de **dos** opciones se rechaza: elegir entre una no es elegir.
- una opción vacía o repetida se rechaza.

### 1b. Lo demás que una pregunta declara (lo de Google Forms)

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

- `description` se sirve como `hint` del campo (y por lo tanto en el
  `aria-describedby` del control). En el `PATCH`, `null` la **quita**: «no
  viene» significa «no cambió».
- `allowOther` sólo tiene sentido con `dataType: "code"`. Lo que se captura
  cuando el paciente elige «Otro» es **el texto escrito**, no un código
  «otro»: en un campo de una sola respuesta es el valor; en uno de varias es
  un elemento más del array, después de los de la lista. Se reconoce por no
  estar entre las opciones. El backend tiene que aceptar ese valor fuera del
  set aunque el campo sea `code` — hoy `field_values` lo rechazaría.
- `cardinalityMin` / `cardinalityMax` ya existen en el contrato de creación y
  son los topes de «validación de respuesta» de las casillas: al menos, como
  máximo, y **exactamente** cuando los dos coinciden. Sólo aplican con
  `multiple: true`; el front no los manda en «una sola». `null` en el `PATCH`
  quita el tope. La cantidad nunca supera las opciones ofrecidas (más «Otro»
  si lo hay): el front lo acota, el servidor debería rechazarlo.

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

### 2. Corregirlas

```
PATCH /forms/field-definitions/:id
{ "name"?, "dataType"?, "options"?, "multiple"? }
```

`options` se reemplaza **entera**, nunca por índice: el orden importa y un
parche por posición se rompe en cuanto alguien inserta una en el medio. Es la
misma regla que ya sigue `PATCH /surveys/templates/:id/questions/:questionId`.

Falta decidir —y es la pregunta de verdad, no una de implementación— **qué pasa
con los valores ya capturados** cuando se quita o se renombra una opción que
alguien ya respondió. Tres salidas, en orden de preferencia:

1. La opción se marca como retirada y deja de ofrecerse, pero sigue existiendo
   para poder leer lo respondido. Es lo correcto en un registro clínico.
2. Se rechaza quitar una opción con respuestas y se dice por qué.
3. Se permite y lo respondido queda apuntando a un código que ya no está
   descrito. **Esto no.**

Mientras no se decida, el simulador permite quitarla: es una base en memoria y
no hay historia clínica que preservar.

### 3. Devolverlas al leer la plantilla

```
GET /charts/templates/:id
→ fields: [{ …, "options"?: string[], "multiple"?: boolean }]
```

Sin esto la pantalla no puede dibujar lo que ya se guardó: un campo de elección
volvería como texto y las opciones escritas desaparecerían de la vista sin un
solo error.

### 4. Aceptarlas al capturar un valor

`POST /forms/instances/:id/values` recibe `dataType: "code"` y el valor. Para un
campo de varias respuestas, lo capturado es **un array**; hoy el contrato
declara un valor único con `ordinal`, así que la vía natural es una fila por
opción marcada, con su `ordinal`, y no un array en una sola.

El servidor debería rechazar un valor que no esté entre las opciones declaradas:
si no, el campo cerrado no cierra nada.

## Mientras tanto

`src/app/core/mock/handlers/surveys-forms.handlers.ts` guarda `options`,
`multiple`, `rows` y las dos restricciones de cuadrícula en la definición y los
cuelga de la plantilla, así que la pantalla se puede recorrer entera contra el
simulador. Contra el backend real, las claves
viajan y **se ignoran**: el campo se crea como `code` sin opciones y la tarjeta
vuelve sin ellas. No rompe nada, pero tampoco guarda lo que se escribió.

Los campos de elección del catálogo sembrado
(`src/app/core/mock/handlers/clinical.handlers.ts`) están puestos con nombres
clínicos reales —NYHA, factores de riesgo, tipo de lactancia— para que lo que se
ve al abrir la pantalla sea lo que un doctor reconoce, y no «Opción 1 / Opción
2».
