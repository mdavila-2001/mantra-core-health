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

`src/app/core/mock/handlers/surveys-forms.handlers.ts` guarda `options` y
`multiple` en la definición y los cuelga de la plantilla, así que la pantalla se
puede recorrer entera contra el simulador. Contra el backend real, las claves
viajan y **se ignoran**: el campo se crea como `code` sin opciones y la tarjeta
vuelve sin ellas. No rompe nada, pero tampoco guarda lo que se escribió.

Los campos de elección del catálogo sembrado
(`src/app/core/mock/handlers/clinical.handlers.ts`) están puestos con nombres
clínicos reales —NYHA, factores de riesgo, tipo de lactancia— para que lo que se
ve al abrir la pantalla sea lo que un doctor reconoce, y no «Opción 1 / Opción
2».
