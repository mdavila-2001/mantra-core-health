# Ayuda contextual: qué se explica, dónde y con qué

> Regla escrita el 22/08/2026 a pedido del cliente (K1 del plan de UX):
> «poner una guía de qué es cada opción que se le está pidiendo».

## El problema no era que faltara el mecanismo

Estaban los cuatro: `hint` en `form-field`, el átomo `tooltip`, la molécula
`tab-help-block` y el sistema de tutoriales con `tutorial-overlay`. Lo que
faltaba era **una regla**, así que cada pantalla elegía distinto y el resultado
era desparejo: el alta de agenda explica casi todos sus campos, y el alta de
organización no explica ninguno.

Esto es esa regla. Es corta a propósito: tres opciones a gusto de cada pantalla
es lo que produjo el desparejo.

## La jerarquía

### 1. `hint` bajo el campo — el 90 % de los casos

**Siempre que un campo pueda hacer dudar a alguien que lo ve por primera vez.**
Es el único mecanismo que se lee sin hacer nada, y el único que un lector de
pantalla anuncia junto al campo.

```html
<app-form-field
  label="¿Cuánto dura una consulta?"
  hint="Casi siempre es 1. Poné más sólo si atendés en grupo."
>
  <app-input ... />
</app-form-field>
```

Qué hace bueno a un `hint`:

- **Dice qué poner, no qué es.** «HH:MM — a qué hora empezás» sirve; «formato de
  hora» no.
- **Da el valor típico** cuando lo hay: «Casi siempre es 1».
- **Habla del efecto**, no del campo: «Lo ves sólo vos, para acordarte cuando
  mires el mes».
- No repite el rótulo con otras palabras. Un `hint` que dice lo mismo que el
  `label` ocupa un renglón y no informa.

### 2. `tooltip` — sólo para aclaraciones opcionales

Para lo que **enriquece pero no hace falta** para completar el campo: la
definición de un término, de dónde sale un número. Nunca para algo sin lo cual
la persona no sabe qué poner: un tooltip exige apuntar y esperar, y en un
teléfono muchas veces ni eso.

### 3. `tab-help-block` — el bloque de una pestaña

Cuando lo que hay que explicar es **la pestaña entera** y no un campo: qué es
la trayectoria profesional, qué diferencia hay entre declarado y verificado.
Va con un ejemplo concreto, que es lo que hace que se entienda de una lectura.

Se muestra **sólo a quien está armando la pantalla**, no a quien la mira: en
una vista previa o en la ficha que abre un paciente, la ayuda de edición es
ruido.

### 4. `tutorial-overlay` — flujos completos

Para recorridos de varias pantallas: «cómo publico mi agenda», «cómo cargo mi
perfil». Se disparan **desde la pantalla que explican**, no desde una entrada
de menú — un renglón fijo que diga «aprendé a usar esto» es la confesión de que
la aplicación no se explica sola.

### 5. El `subtitle` del `page-header` — una línea por sección

Toda pantalla de sección abre con una línea que dice de qué es. No es opcional
y no es un eco del título: si el título dice «Turnos», el subtítulo dice «Las
citas comprometidas y los cupos que quedan por ofrecer».

La vara: **¿alguien que no conoce la aplicación entiende qué hay detrás?**

## Qué NO es ayuda contextual

- **Un párrafo de teoría.** «El flujo canónico es borrador → clasificado → en
  revisión → aprobado → posteado» explica el sistema, no lo que hay que hacer.
- **Jerga traducida a jerga.** «Identificador de perfil (uuid)» no ayuda a
  nadie; «lo trae cada cita de tu agenda» sí.
- **Un aviso que no se puede accionar.** Si la ayuda termina en «pedíselo a
  quien administra», que lo diga; si no hay a quién pedírselo, es un callejón.

## Cómo se revisa una pantalla

Campo por campo, una sola pregunta: **¿un usuario nuevo sabe qué poner acá sin
preguntarle a nadie?** Si la respuesta es no, falta un `hint`.

Prioridad de la auditoría pendiente (K2 del plan): alta y edición de
organización, registro de profesional, formularios clínicos y políticas de
reserva. Después el resto.
