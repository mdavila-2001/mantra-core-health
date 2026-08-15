# Carril R2-2 · Crear agenda por fases, con barra de avance

**Punto del reclamo, textual:**

> Crear agenda es necesario que se arregle por fase si o si. NO debe ser todo de uno, se te dijo
> que sea como una barra de avance.

**Repos:** frontend (el backend ya está entero — ver abajo). **Rama:** `carril-r2-2/alta-agenda-por-fases`.
**Coordinación:** postear el bloque en `COORDINACION-AGENTES.md` antes de tocar nada.

## La buena noticia: el backend ya está partido en fases

`src/modules/scheduling/controllers/scheduling.controller.ts` expone la creación de una agenda en
cinco comandos separados, en este orden:

| Línea | Endpoint | Qué es |
|---|---|---|
| `:130` | `POST /scheduling/resources` | El recurso agendable (el consultorio, el profesional, el equipo) |
| `:142` | `POST /scheduling/booking-policies` | La política de reserva: anticipación, cancelación, sobreturno |
| `:154` | `POST /scheduling/resources/:id/templates` | La plantilla horaria: qué días, qué franjas, qué duración |
| `:167` | `POST /scheduling/templates/:id/generate-slots` | Generar los cupos reales del período |
| `:184` | `POST /scheduling/resources/:id/exceptions` | Las excepciones: feriados, licencias, bloqueos |

**Las fases no hay que inventarlas: ya existen en la API.** El backend nunca pidió que se
mandara todo junto — fue el frontend el que nunca construyó la pantalla.

## Lo que hay hoy en el frontend

`src/app/core/data-access/scheduling/scheduling.client.ts` implementa **sólo la lectura y la
reserva**: `listResources` (`:63`), `listSlots` (`:92`), `searchBookings` (`:121`), `getBooking`
(`:148`), `placeHold` (`:161`), `confirmHold` (`:177`), `cancelBooking` (`:194`),
`checkInBooking` (`:226`).

**Ninguno de los cinco comandos de alta está en el cliente.** No hay `createResource`, no hay
`generateSlots`, no hay `createTemplate`. La sección Agenda (`features/agenda/`) muestra citas y
cupos ya existentes, y el único formulario de escritura que tiene es `booking-new/` — que es
*reservar un turno*, otra cosa.

**Si lo que el cliente vio como «crear agenda todo de una» fue `booking-new/`:** esa pantalla
tiene sus dos pasos —retener el cupo, después confirmar— resueltos **dentro de una sola vista**,
con un `@if (retencion())` que intercambia el bloque (`booking-new.html:77-151`). Nunca dice en
qué paso está ni cuántos faltan. Con o sin el alta de agenda, esa pantalla también entra en este
carril: es el mismo defecto, y es el que el cliente tiene a mano para probar.

**Lo primero que hace este carril**, antes de escribir código: confirmar con el cliente **cuál de
las dos pantallas** llamó «crear agenda». Si es la reserva, la parte A alcanza y la B es de
todos modos lo que falta para que la sección exista. Si es el alta, es la B. Se hacen las dos —
comparten el mismo componente nuevo y no tiene sentido separarlas — pero el orden lo decide esa
respuesta.

## La pieza que falta y que las dos partes comparten: el paso a paso

En `src/app/shared/components/` hay un átomo `progress/` (`progress.ts`, `.types.ts`, `.html`,
`.css`, `.spec.ts`) — una barra, sin semántica de pasos. **No hay stepper, no hay wizard**:
`grep -ri "stepper\|wizard" src/app/shared` no devuelve ningún componente.

**Archivo nuevo, y es el corazón del carril:**

```
src/app/shared/components/organisms/step-flow/step-flow.ts + .html + .css + .types.ts + .spec.ts
```

Un organismo que recibe la lista de pasos y el índice actual, y resuelve:

- **La barra de avance que el cliente pidió**, reusando el átomo `progress/` — no una barra
  nueva.
- El rótulo de cada paso y cuál está activo, cuál terminado, cuál falta.
- Navegación adelante/atrás, con el paso siguiente deshabilitado hasta que el actual valide.
- Accesibilidad: el cambio de paso se anuncia (mismo criterio que `appAnuncio` ya usa en el
  repo), y el foco se mueve al encabezado del paso nuevo.
- **Reanudable:** el paso vigente viaja en la URL (query param), como ya hace `glossary` con su
  búsqueda. Un alta de agenda de cinco pasos que se pierde al refrescar es peor que una sola
  pantalla larga.

Es `shared/`, así que se escribe con la misma disciplina que el resto de los organismos: sin
lógica de agenda adentro, sólo pasos.

## Parte A · La reserva, por pasos de verdad

`src/app/features/agenda/booking-new/booking-new.ts` + `.html` — se refactoriza, no se reescribe:
la lógica de retención, vencimiento y confirmación ya es correcta y está probada
(`booking-new.spec.ts`). Lo que cambia es la envoltura: los dos pasos que hoy se intercambian con
un `@if` pasan a ser dos pasos declarados de `step-flow`, con la barra arriba.

Los estados que ya resuelve —sin perfil de paciente, sin contexto de cupo, retención vencida,
cupo que ya no está— **se conservan tal cual**. Son correctos y cada uno tiene su test.

## Parte B · El alta de agenda, las cinco fases

**Cliente — se extiende `scheduling.client.ts`** agregando los cinco métodos al final, sin tocar
los ocho existentes:

```
createResource()        → POST /scheduling/resources
createBookingPolicy()   → POST /scheduling/booking-policies
createTemplate()        → POST /scheduling/resources/:id/templates
generateSlots()         → POST /scheduling/templates/:id/generate-slots
createException()       → POST /scheduling/resources/:id/exceptions
```

Los DTOs salen de los `@Body()` reales del controller, no de suposiciones: leelos en
`scheduling.controller.ts` y sus `dto/` antes de tipar.

**Pantalla nueva:**

```
src/app/features/agenda/schedule-new/schedule-new.ts + .html + .css + .spec.ts
```

Cinco pasos sobre `step-flow`, uno por endpoint, en el orden del cuadro de arriba. Reglas que no
son negociables porque son la diferencia entre «por fases» y «todo de una con adornos»:

1. **Cada paso confirma contra la API cuando se cierra**, no al final. El paso 1 crea el recurso
   de verdad; el 2 recibe el `resourceId` que devolvió el 1. Un formulario de cinco secciones que
   dispara cinco POST al apretar «Guardar» es exactamente lo que el cliente rechazó.
2. **Un paso ya confirmado no se pierde.** Si el paso 4 falla, los pasos 1-3 siguen creados y la
   pantalla lo dice; se reintenta el 4, no todo.
3. **Los pasos 2 y 5 son opcionales y lo declaran.** Política de reserva y excepciones se pueden
   saltear y agregar después; el paso lo ofrece explícitamente en vez de pedir datos vacíos.
4. **El paso 4 informa qué generó**: cuántos cupos, en qué rango. Es el único paso cuyo resultado
   el usuario no puede deducir de lo que tipeó.

**Archivos existentes que tocás:**

| Archivo | Qué le agregás |
|---|---|
| `src/app/features/agenda/agenda.routes.ts` | La ruta hija `schedule/new`, junto a la de `booking-new` que ya está |
| `src/app/features/agenda/agenda.html` | Un botón «Crear agenda» en la cabecera de la sección, que lleva a la ruta nueva |
| `src/app/core/data-access/scheduling/scheduling.client.ts` | Los cinco métodos nuevos, al final del archivo |

`navigation.map.ts` **no se toca**: la sección `schedule` ya existe (`:88-104`) con los roles
correctos (`SCHEDULING_ADMIN`, `SCHEDULING_AGENT`, `PRACTITIONER`) — esto es una pantalla dentro
de ella, no una sección nueva.

**Lo que NO tocás:** `agenda.ts` y su lógica de ventanas/tabs, `booking-status.ts`, los ocho
métodos de lectura del cliente de scheduling, y todo el backend — el módulo `scheduling` no
necesita una línea.

## Definición de hecho

- Crear una agenda son **cinco pantallas encadenadas con una barra de avance visible**, cada una
  con su propio guardado, y se puede volver atrás.
- Cortar en el paso 3 y volver mañana no obliga a rehacer los pasos 1 y 2.
- Reservar un turno también muestra en qué paso va.
- El `step-flow` tiene su `.spec.ts` propio: es `shared/`, lo va a reusar el próximo carril que
  necesite un alta larga.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build`.
