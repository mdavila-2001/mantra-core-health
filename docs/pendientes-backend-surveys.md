# Pendientes de backend — edición del cuestionario (`surveys`)

**Estado:** el cliente y el simulador ya los implementan. El backend real todavía no.

## Por qué

`SurveysTemplatesController` expone hoy cinco rutas: crear la encuesta, agregar
una pregunta, publicar una versión, desactivar y leer. Con eso, componer un
cuestionario es una operación **de una sola dirección**: se agregan preguntas al
final y se publica.

Eso deja sin salida el caso más común de todos — equivocarse. Una pregunta mal
redactada, con el tipo equivocado o en el orden equivocado no se puede corregir:
la única maniobra disponible es publicar así o abandonar la encuesta y crear
otra desde cero. En el editor rehecho (estilo Google Forms) esas cuatro
operaciones son la mitad del trabajo.

## Las cuatro rutas

Todas operan **sólo sobre la versión en borrador**. Sobre una versión publicada
deben devolver `422`, exactamente como ya hace `POST /questions`: una versión
publicada es inmutable para que una respuesta dada hace meses se pueda seguir
interpretando. Eso no es una restricción a levantar — es la garantía del módulo.

### 1. Corregir la encuesta

```
PATCH /surveys/templates/:id
{ "title"?: string, "description"?: string, "responseWindowDays"?: number }
→ 200 { "ok": true }
```

Todo opcional; se manda sólo lo que cambió. Una clave **ausente** no significa
«vaciá esto»: para borrar la consigna se manda `description: ""`.

### 2. Corregir una pregunta

```
PATCH /surveys/templates/:id/questions/:questionId
{ "questionText"?, "answerType"?, "required"?, "options"?, "scaleMin"?, "scaleMax"? }
→ 200 { "ok": true }
```

Dos detalles que el simulador ya respeta y conviene replicar:

- **`options` y la escala se reemplazan enteras**, no se parchean por índice.
  Un parche posicional se rompe en cuanto alguien inserta una opción en el
  medio, y el orden de las opciones importa.
- **Al cambiar de tipo hay que descartar lo que el tipo nuevo no usa.** Si una
  elección múltiple pasa a texto libre, sus opciones se borran. Si quedan
  guardadas, el `GET` las devuelve, la pantalla las ignora —manda el tipo— y
  quien edita ve un cuestionario que no coincide con lo que guardó.

### 3. Quitar una pregunta

```
DELETE /surveys/templates/:id/questions/:questionId
→ 200 { "ok": true }
```

**El servidor renumera las que quedan.** `position` es lo que la pantalla dibuja
delante de cada pregunta: borrar la 2 de 4 no debe dejar un cuestionario que va
1, 3, 4.

### 4. Reordenar el cuestionario

```
PUT /surveys/templates/:id/questions/order
{ "questionIds": string[] }
→ 200 { "ok": true }
```

Se manda **la lista entera** en el orden final, no «subí ésta un lugar». Dos
reordenamientos seguidos sobre una posición relativa se pisan y el resultado
depende de cuál llegó primero.

Conviene ser tolerante con una lista incompleta: las preguntas que el cliente no
nombró van al final en su orden previo. Un orden parcial no debería hacer
desaparecer preguntas.

## Dónde está cada cosa

| Pieza | Archivo |
|---|---|
| Cliente HTTP | `src/app/core/data-access/surveys/surveys.client.ts` |
| Tipos | `src/app/core/data-access/surveys/surveys.types.ts` (`SurveyEdit`, `SurveyQuestionEdit`) |
| Simulador | `src/app/core/mock/handlers/surveys-forms.handlers.ts` |
| Pantalla | `src/app/features/questionnaires/survey-detail/` |

Cuando las rutas existan en el backend, **no hay que tocar el cliente**: los
métodos ya apuntan a estas direcciones con estos cuerpos.
