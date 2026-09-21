# ADR-0013: Elegir un valor de una lista se hace con un `select`

## Estado

**Aceptado** — 2026-09-20. Nace de la corrección C-21: *«Todo lo que sean
opciones deben ser selects.»*

Convive con la corrección C-10 del mismo día y del mismo autor, que para el
modal de cupos de la agenda pide lo contrario: *«ES NECESARIO QUE SEA TOGGLE
BUTTONS EN LUGAR DE LOS QUE RADIO BUTTON»*. La contradicción es aparente y esta
decisión la resuelve por escrito: no hablan de la misma situación.

## Contexto

Medición sobre el corte `68dcb562`:

```text
$ git grep -o "<app-chip" -- 'src/app/**/*.html'          58 en 26 plantillas
$ git grep -o "<app-radio-group" -- 'src/app/**/*.html'   16 en 11 plantillas
$ git grep -o "radio-otro" -- 'src/app/**/*.html'          5 en  2 plantillas
$ git grep -o "segmented-control" -- 'src/app/**/*.html'  13 en  9 plantillas
```

**92 controles de opciones que no son un `select`.** El inventario por dueño
está en el reparto del turno; acá interesa el patrón, no el conteo.

> El comando de la corrección cuenta el nombre suelto y da **533**, porque
> `<app-chip>` y `</app-chip>` suman dos por cada chip. Los dos números se
> publicaron juntos. Repartir 533 habría inflado el encargo de cada uno por seis.

El problema que la corrección nombra es real y no es de gusto: **la misma
pregunta se contesta de cuatro maneras distintas según la pantalla**. En un
formulario hay radios, en el de al lado chips, en el tercero un control
segmentado. Quien usa el sistema tiene que volver a aprender dónde tocar cada
vez.

## Decisión

### 1 · Elegir un valor de un conjunto → `select`

Es el caso de C-21 y es el **valor por omisión**. Si la pregunta es «¿cuál de
estos?», el control es un `app-select`. Da igual que el conjunto tenga tres
opciones o veinte: lo que lo define es que son alternativas del mismo tipo y se
elige una.

Ejemplos: el tipo de un título, el formato de una exportación, una pregunta de
opción única de una encuesta, el departamento emisor de un documento.

**Un `select` no se elige por ser más corto**; se elige porque es el control que
este sistema usa para eso, y la coherencia es lo que la corrección pide.

### 2 · Alternar entre dos estados del mismo eje → toggle, **no** `select`

Sí/no, activo/inactivo, con receta/sin receta. Acá **no hay una lista**: hay una
afirmación que está encendida o apagada. Un desplegable de dos opciones esconde
la mitad de la respuesta detrás de un clic y obliga a abrirlo para saber qué se
contestó.

Es lo que pide C-10 para el modal de cupos, y **no contradice a C-21**: alternar
no es elegir de una lista.

La frontera es una pregunta, no un número: *¿las opciones son valores distintos
del mismo campo, o son el sí y el no de una misma afirmación?* «Mañana / tarde /
noche» son tres valores → `select`. «Atiendo por telemedicina» es una afirmación
→ toggle.

### 3 · Esconder las opciones perdería información → se dibujan enteras, y se declara

Tres formas de que eso pase, y sólo tres:

- **Una escala.** «Del 1 al 5» no es una lista: el orden y la distancia entre
  los puntos **son** el dato. Colapsada en un desplegable deja de ser una escala
  y pasa a ser cinco palabras sueltas.
- **Un atajo de filtro sobre un conjunto corto y conocido.** Lo pidió el cliente
  el 22/08/2026 (§A3 del plan de UX, «Chips de filtro») para los cuatro
  directorios, y el argumento sigue en pie: un desplegable **esconde** las
  opciones hasta que alguien lo abre, así que quien entra al directorio de
  laboratorios no se entera de que puede acotar por categoría. Es opt-in
  explícito —`FilterDef.asChips`— y el valor por omisión de `app-filter-bar`
  **ya es el desplegable**.
- **Un chip que sólo muestra.** Una especialidad, un idioma, «atendés por
  telemedicina»: no son opciones, son datos. No se convierten porque no hay nada
  que elegir. Esto no es una excepción a C-21; es que C-21 no habla de ellos.

Toda excepción de este grupo se escribe **en el código, al lado del control**,
con su motivo y su fecha. Sin eso no es una excepción: es una omisión.

## Cómo se decide en tres preguntas

```text
¿La persona elige algo?
├─ No  → es un dato. Chip, insignia o texto. C-21 no aplica.
└─ Sí  → ¿es el sí/no de una misma afirmación?
         ├─ Sí → toggle (C-10)
         └─ No → ¿esconder las opciones pierde información
                  (es una escala, o es el atajo que el cliente pidió ver)?
                  ├─ Sí → se dibuja entero, con el motivo escrito al lado
                  └─ No → `app-select`   ← el caso normal (C-21)
```

## Consecuencias

- **Lo que se convierte** es lo que cae en el caso 1. En el territorio del
  perfil médico y de `shared/`, eso es la pregunta de opción única de la
  encuesta y el formato de la exportación de portabilidad.
- **Lo que no se convierte queda declarado.** La escala y el sí/no de la
  encuesta, los chips de filtro de los directorios, y los chips que sólo
  muestran.
- **Un componente que usan muchas pantallas no cambia su comportamiento por
  omisión**: se le publica una opción nueva. `app-paginated-form` lo montan 52
  plantillas, y el tipo de control sale de la definición del campo, no de la
  plantilla: cambiarlo ahí cambiaría 52 formularios de golpe, incluidos los de
  otros dueños.
- Cada dueño aplica esta decisión **en sus archivos reservados**. El inventario
  con el número de cada uno está en el reparto del turno.

## Lo que queda sin confirmar

**La corrección, leída al pie de la letra, contradice un pedido anterior del
mismo cliente que ya está implementado.** C-21 dice «todo lo que sean opciones
deben ser selects»; el pedido del 22/08 pide chips de filtro en los cuatro
directorios, y esos chips **son** opciones. Acá se resolvió que el pedido del
22/08 sobrevive como excepción declarada, porque su argumento —esconder las
opciones hace que nadie sepa que existen— sigue siendo cierto y porque
retirarlo no es lo que C-21 buscaba corregir.

**Es un supuesto de lectura, no un hecho**, y hay que confirmárselo al
propietario. Si la respuesta es que C-21 también alcanza a los directorios, son
dos pantallas de otros dueños y el cambio es quitar un `asChips`.
