> **AVANCE: 10 / 12 — 83,3 %.**

# Reporte — C4 · Reconsulta: una cita real agendada desde la consulta

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/clinica-c4-reconsulta` (desde `origin/mockup` @ `bf2c3545`)
- Peldaño de evidencia alcanzado: **TESTED** (regla 30, peldaño 4). No hay `VERIFIED`:
  en este turno no se levantó ningún navegador ni servidor. Ver «No cubierto».

## Completado

| ID | Qué se logró (observable) | Comando de verificación | Resultado |
|---|---|---|---|
| C4.H1.M1 | Plan en disco con las 12 microtareas, alcance, y cinco ambigüedades registradas con su supuesto; baseline de `typecheck` limpio | `corepack yarn typecheck` | PASS · `evidencia/00-baseline-typecheck.txt` |
| C4.H2.M1 | `ReservaSimulada.followUpOf` y una reconsulta futura sembrada, colgada de una consulta ya atendida de la paciente principal. El origen **se busca**, no se fija por índice | `corepack yarn test --watch=false --include='src/app/core/mock/fixtures/agendas-cobertura.spec.ts'` | PASS · 1/1 · `evidencia/01-seed-agendas-cobertura.txt` |
| C4.H2.M2 | `POST /scheduling/appointments/direct` acepta `followUpOf` con sus cinco caminos; las dos lecturas devuelven `followUpOf` (con el `startAt` del origen resuelto) y `followUpBookingId` | `corepack yarn test --watch=false --include='src/app/core/mock/handlers/scheduling.handlers.spec.ts'` | PASS · **24/24** (10 previos + 14 nuevos) · `evidencia/02-handler-reconsulta.txt` |
| C4.H2.M3 | `createDirectAppointment` manda `followUpOf` **sólo si viene**, con sus dos campos y nada más; `searchBookings` / `getBooking` leen el vínculo y convierten el instante del origen | `corepack yarn test --watch=false --include='src/app/core/data-access/scheduling/scheduling.client.spec.ts'` | PASS · **42/42** (33 previos + 9 nuevos) · `evidencia/03-cliente-reconsulta.txt` |
| C4.H3.M1 | `app-follow-up-block` con los tres estados: sin cita de origen, ya agendada, y el formulario | `corepack yarn test --watch=false --include='.../follow-up-block/follow-up-block.spec.ts'` | PASS · **14/14** · `evidencia/04-follow-up-block.txt` |
| C4.H3.M2 | Día (`app-date-picker`, mañana → +90 días) · cupos libres en `app-radio-group` agrupados «Mañana / Tarde» con hora y sede · motivo `app-textarea` precargado · «Agendar» deshabilitado sin cupo **y sin escribir aunque se lo empuje** | mismo spec | PASS · `evidencia/04-follow-up-block.txt` |
| C4.H3.M3 | Éxito con fecha/hora y «Ver en Consultas médicas»; el 409 se ve en el bloque (en ámbar, no como error); `(cambio)` se emite una vez y la consulta de origen se **relee** | mismo spec | PASS · `evidencia/04-follow-up-block.txt` |
| C4.H3.M4 | Agenda del doctor: `app-badge` «Reconsulta» con `data-testid="cita-reconsulta-sello"` junto al motivo + «de la cita del <fecha>». Detalle de la cita: «Qué es» = «Reconsulta» + «De la cita del» | `... --include='src/app/features/agenda/agenda.spec.ts'` y `... --include='.../my-agenda/detalle-de-la-cita.spec.ts'` | PASS · **125/125** (121 previos + 4) y **5/5** (spec nuevo) · `evidencia/05-sellos-agenda-detalle-miscitas.txt` |
| C4.H3.M5 | Mis citas del paciente: `data-testid="mis-citas-reconsulta-sello"` + «Tu médico te citó de nuevo por la consulta del <fecha>» | `... --include='src/app/features/account/appointments/appointments.spec.ts'` | PASS · **84/84** (79 previos + 5) · `evidencia/05-sellos-agenda-detalle-miscitas.txt` |
| C4.H5.M1 | Gates sin rojos nuevos, cuatro commits, push y PR contra `mockup` | `corepack yarn typecheck` · `corepack yarn lint` · `gh pr view` | PASS · `evidencia/06-gates-typecheck-lint.txt` · `evidencia/07-pr.txt` |

## A medias

### C4.H4.M1 — Playwright `clinica-c4-reconsulta.spec.ts`

1. **Qué anda:** el spec existe (`playwright/clinica-c4-reconsulta.spec.ts`), typechequea dentro
   de `corepack yarn typecheck` —que incluye `playwright/`— y cubre el recorrido del §6 del
   prompt: médica → `/schedule` → «Iniciar la consulta» (llega `?cita=`) →
   `consulta-casilla-reconsulta` → `reconsulta-fecha` → `reconsulta-cupo` →
   `reconsulta-guardar` → éxito → `/schedule` con `cita-reconsulta-sello` → paciente →
   `/my-account/appointments` con `mis-citas-reconsulta-sello`, más el caso negativo del 409 y
   la matriz de cinco viewports.
2. **Qué no anda:** **no se ejecutó ni una sola vez.** Dos causas, las dos reales:
   (a) `scripts/pw-guard.mjs` —el DoD literal de esta microtarea— **no existe en este árbol**:
   es un artefacto del carril C0, que no publicó; (b) el turno tenía prohibido levantar
   servidores o navegadores (tres agentes en paralelo sobre la misma máquina).
   Hay además una tercera, que es de producto: los tres casos que arrancan en
   `consulta-casilla-reconsulta` **no pueden pasar todavía**, porque esa casilla la monta
   `consultation/**`, que es de otro carril (ver «Decisiones y ambigüedades», A-2).
3. **Qué falta exactamente:** (i) que el dueño de `consultation/**` monte el
   `@case ('reconsulta')` con `<app-follow-up-block [patientProfileId] [encounterId] [bookingId]
   (cambio)>`; (ii) `node scripts/pw-guard.mjs --port 4214 --spec
   playwright/clinica-c4-reconsulta.spec.ts --serve` cuando C0 entregue el guard, o
   `corepack yarn pw --grep "C4"` con el servidor levantado a mano en el 4214.
4. **Dónde quedó:** `playwright/clinica-c4-reconsulta.spec.ts`, rama
   `claude/clinica-c4-reconsulta`. Compila y typechequea; el resto del árbol está en verde.

### C4.H4.M2 — Capturas de cinco viewports, claro/oscuro, y doble revisión crítica

1. **Qué anda:** el CSS de las tres superficies nuevas está escrito **sólo con tokens**
   (`node scripts/check-css-tokens.mjs` no reporta ninguno inventado en los archivos de C4) y
   es mobile-first: el bloque apila y suelta a partir de `40rem`, el sello de la agenda cae bajo
   el motivo hasta `48.75rem`, y la frase de Mis citas ocupa el renglón entero como el motivo.
   El spec de Playwright ya tiene la matriz de los cinco anchos escrita.
2. **Qué no anda:** **no hay ninguna captura.** Sin navegador no se tomó ni se miró nada, así
   que tampoco hubo primera ni segunda pasada de `critical-double-review`.
3. **Qué falta exactamente:** correr la matriz de viewports del spec en los dos temas, guardar
   las imágenes en `evidencia/capturas/`, y escribir `evidencia/doble-revision.md` con las dos
   pasadas y la nota por pantalla (regla 35.1).
4. **Dónde quedó:** nada en disco más allá del CSS y del spec. **No se declara ninguna
   afirmación visual**: el peldaño del área visual es `WRITTEN`, no `VERIFIED`.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| Cableado de `consulta-casilla-reconsulta` | BLOQUEADO (fuera de alcance) | Es de `consultation/**` (C1). El bloque está entregado con la firma de los otros diez del expediente; falta el `@case ('reconsulta')` y la entrada en `CasillaDeConsulta` / `CASILLAS` / `ORDEN_DE_CASILLAS`. |
| `APT-RECONSULTA` en el value set `VS_APPOINTMENT_TYPE` | BLOQUEADO (fuera de alcance) | Es de `conceptos.ts` (C0). Mientras tanto el id se deriva con la misma semilla, así que al llegar coincide y no migra nada. |
| Subir los tipos de `follow-up.types.ts` a `scheduling.types.ts` | TODO (C8) | Que C0 publique los tipos congelados. Cada declaración lleva su `// TODO C8`. |
| Backend **P42** | TODO | Ver abajo. Todo C4 vive hoy contra el simulador. |

## Evidencia

Índice de `evidencia/`: `00-baseline-typecheck.txt` · `01-seed-agendas-cobertura.txt` ·
`02-handler-reconsulta.txt` · `03-cliente-reconsulta.txt` · `04-follow-up-block.txt` ·
`05-sellos-agenda-detalle-miscitas.txt` · `06-gates-typecheck-lint.txt` · `07-pr.txt`.

```text
corepack yarn test --watch=false --include=src/app/core/mock/handlers/scheduling.handlers.spec.ts
 Test Files  1 passed (1)
      Tests  24 passed (24)

corepack yarn test --watch=false --include=src/app/core/data-access/scheduling/scheduling.client.spec.ts
 Test Files  1 passed (1)
      Tests  42 passed (42)

corepack yarn test --watch=false --include=src/app/features/clinical-record/patient-chart/follow-up-block/follow-up-block.spec.ts
 Test Files  1 passed (1)
      Tests  14 passed (14)

corepack yarn test --watch=false --include=src/app/features/agenda/agenda.spec.ts
 Test Files  1 passed (1)
      Tests  125 passed (125)

corepack yarn test --watch=false --include=src/app/features/agenda/my-agenda/detalle-de-la-cita.spec.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)

corepack yarn test --watch=false --include=src/app/features/account/appointments/appointments.spec.ts
 Test Files  1 passed (1)
      Tests  84 passed (84)

corepack yarn typecheck
(sin ninguna línea «error TS»)

corepack yarn lint
x 6 problems (6 errors, 0 warnings)   <- los seis son PREEXISTENTES, en cuatro archivos
                                         que C4 no toca. Cero errores nuevos.
```

## No cubierto

- **Todo el comportamiento en navegador.** Ningún camino se ejercitó sobre la aplicación
  corriendo: no se levantó `yarn start`, ni Playwright, ni se tomó una captura. Lo que está
  demostrado son **pruebas unitarias con el backend simulado por `HttpTestingController`**, que
  cubren una capa y no la integración.
- **El kill-test no se corrió.** «La reconsulta aparece en `/my-account/appointments` de
  `paciente@alovida.mock` con el sello» está cubierto por el spec de `appointments` con datos
  inyectados y por la seed, pero **no se observó en pantalla**.
- **La casilla que abre el bloque**, por ser de otro carril (arriba).
- **El tema oscuro** no se miró. El CSS usa sólo tokens semánticos, que es la condición para
  que funcione en los dos temas, pero eso es un argumento, no una verificación.
- **La suite completa** (`yarn test` sin `--include`) y `yarn build`: prohibidos por el límite
  de recursos del turno. La regresión centralizada la corre quien coordina.
- **Accesibilidad**: no se corrió ninguna herramienta ni se navegó por teclado. El grupo de
  horarios usa `app-radio-group` (que ya trae `role="radiogroup"` y su etiquetado por
  `FORM_CONTROL_CONTEXT`), y el rótulo «Mañana / Tarde» es un separador visual dentro del grupo,
  **no** un `<label>`: eso es una decisión, no una medición.

## Desvíos del plan

1. **`app-alert` no tiene `variant`, tiene `tone`.** El prompt pedía
   `app-alert variant="success"`; la API real del componente (`alert.ts:38`) es `tone`. Se usó
   `tone="success"`. El componente manda sobre el enunciado.
2. **El calendario es `app-date-picker`, no `app-appointment-calendar`.** El prompt dejaba
   elegir. `app-appointment-calendar` pinta turnos existentes; `app-date-picker` elige un día y
   acepta `minDate` / `maxDate`, que es literalmente «desde mañana hasta +90 días». Es además el
   que ya usa `admission-block` para lo mismo.
3. **Los rechazos nuevos corren sólo con `followUpOf` presente.** El enunciado los lista sin
   condición; aplicarlos a toda cita directa habría cambiado el comportamiento de
   `appointment-new` y del mostrador, que son de otros. Queda declarado en el código.
4. **`followUpOf` gana un campo de lectura, `startAt`.** El contrato de escritura sigue siendo
   `{ bookingId, encounterId }`. Sin la fecha del origen resuelta por el servidor, cada pantalla
   necesitaría una petición por fila para poder decir «de la cita del 12 de septiembre», o
   quedarse sin poder nombrarla. Va declarado en `follow-up.types.ts` con su `// TODO C8` y
   entra en **P42**.
5. **La frase de Mis citas se arma en la plantilla, no en TypeScript.** Se escribió primero como
   función con `formatDate(..., 'es-BO')` y el spec la reventó con
   `NG0701: Missing locale data for the locale "es-BO"`: el idioma lo registra `app.config.ts` al
   arrancar la aplicación, y un helper que lo clava explota donde nadie lo registró. Ahora
   `TurnoVisible` expone `reconsultaDe: Date | null` y la plantilla usa el `date` del idioma de
   la aplicación. **Este desvío salió de un test en rojo, no de una preferencia.**
6. **Un spec nuevo fuera de la lista literal de archivos reservados:**
   `src/app/features/agenda/my-agenda/detalle-de-la-cita.spec.ts`. La ficha reserva
   «`detalle-de-la-cita.ts` (+ spec)» y ese spec no existía; se creó.

## Riesgos residuales

- **El bloque no es alcanzable desde la aplicación** hasta que se monte la casilla. Mientras
  tanto, el único camino por el que un humano ve una reconsulta es la **sembrada**.
- **El id de `APT-RECONSULTA` es una apuesta verificable, no un hecho.** Coincidirá con el de
  C0 si C0 usa `definir()` con el código `APT-RECONSULTA`, que es cómo se derivan los otros
  conceptos del archivo. Si C0 eligiera otro código, la seed y el handler habría que
  reapuntarlos —una constante, un lugar—.
- **La reconsulta de una reconsulta está permitida** (hay un test que lo fija). Es lo coherente:
  la regla del negocio es «una reconsulta por consulta», no «una cadena de una sola». Si el
  propietario quisiera cortar la cadena, es una regla nueva, no un defecto.
- **La duración se toma del cupo elegido.** Si un cupo llegara con `endAt <= startAt`, se cae a
  30 minutos. No se vio ninguno así.

## Decisiones y ambigüedades

| # | Ambigüedad | Supuesto tomado | A quién confirmar |
|---|---|---|---|
| A-1 | `APT-RECONSULTA` no existe en `conceptos.ts` (C0 no publicó) y ese archivo no es de C4 | Id derivado con la misma semilla que usaría `definir()` (`uuid('concept-APT-RECONSULTA')`), en `fixtures/agenda.ts`, con `// TODO C8`. El rótulo de pantalla es el literal «Reconsulta», no una búsqueda en el catálogo, así que nada muestra un uuid crudo mientras el concepto no esté registrado | Marcelo (C0) |
| A-2 | La casilla `consulta-casilla-reconsulta` vive en `consultation/**`, que es de otro carril | El bloque se entrega standalone con la firma de los otros diez (`[patientProfileId]`, `[encounterId]`, `(cambio)`) más `[bookingId]`, listo para un `@case ('reconsulta')`. El cableado queda como hand-off | dueño de C1 / `consultation/**` |
| A-3 | El prompt pide `app-alert variant="success"` | La API es `tone`. Se usó `tone="success"` | — |
| A-4 | «Calendario»: `app-date-picker` o `app-appointment-calendar` | `app-date-picker`, por `minDate` / `maxDate` y por precedente en `admission-block` | — |
| A-5 | `scripts/pw-guard.mjs` no existe en el árbol | H4.M1 escrito sin ejecutar; H4.M2 sin ejecutar. Declarados `A MEDIAS` con la causa real, sin inventar evidencia visual | Justin (regresión centralizada) |
| A-6 | ¿Los rechazos nuevos aplican a toda cita directa o sólo a la reconsulta? | Sólo cuando `followUpOf` viene, para no cambiar `appointment-new` ni el mostrador | dueño de la agenda |

---

## Pendiente de backend — **P42** (listo para pegar)

> **P42 · Reconsulta: el vínculo entre una cita y la consulta de la que salió.**
> Origen: carril C4 del paquete «Encuentro clínico» (2026-09-25). Hoy todo esto vive **sólo en
> el simulador del frontend** (`core/mock/handlers/scheduling.handlers.ts`); la API real no
> conoce ninguna de estas piezas.
>
> **1. Esquema — `scheduling.appointment_bookings.follow_up_of_booking_id`**
> Columna nueva, `uuid NULL`, FK a `scheduling.appointment_bookings(id)`. Es el vínculo, y va en
> **un solo lado**: la reconsulta apunta a la consulta de la que salió. El sentido inverso se
> **deriva al leer**; guardarlo en los dos dejaría dos verdades que se pueden contradecir —una
> cancelación que actualizara un lado y no el otro bastaría para que la cita origen siguiera
> diciendo que ya tiene reconsulta—. Índice sobre la columna: se consulta en cada lectura de la
> agenda. Recordar que el DDL se genera desde el `.puml` (regla 97.1): la columna se declara en
> el modelo, no con un `ALTER TABLE` a mano.
>
> **2. Terminología — concepto `ACT_FOLLOW_UP`**
> Entrada nueva en el value set de tipos de cita (`VS_APPOINTMENT_TYPE` en el simulador, con
> los códigos `APT-*`). La reconsulta nace con ese `type_concept_id`. Como todo catálogo
> cerrado, va como concepto codificado y **no** como enum de TypeScript ni etiqueta a mano
> (regla 97.4.7). Del lado del frontend el rótulo visible es el literal «Reconsulta», así que el
> concepto no bloquea la pantalla: bloquea poder clasificar y contar reconsultas.
>
> **3. Regla de negocio — «una reconsulta por consulta»**
> `POST /scheduling/appointments/direct` con `followUpOf` responde:
> - **403** si el `resourceId` no es una agenda del profesional de la sesión;
> - **404** si la cita de origen no existe;
> - **422** si el paciente no es el de esa cita, o si `startAt` no es futuro;
> - **409** si esa consulta ya tiene una reconsulta **por venir** y no cancelada —una ya pasada
>   no bloquea: citar de nuevo a alguien que ya volvió es legítimo—.
>
> La unicidad tiene que ser **de la escritura, no de un `if` previo** (regla 96.3.2): dos
> peticiones simultáneas con el mismo origen no pueden crear dos reconsultas. Un índice único
> parcial sobre `follow_up_of_booking_id` filtrado por «no cancelada y futura» no es inmutable
> —«futura» depende de `now()`—, así que la garantía va por bloqueo del origen dentro de la
> transacción (`SELECT ... FOR UPDATE` sobre la cita de origen) o por un único parcial sobre los
> estados vivos. Lo que **no** alcanza es comprobar y después insertar.
>
> Los cuatro rechazos corren **sólo cuando `followUpOf` viene**: una cita puntual sin
> reconsulta se sigue creando exactamente como hoy, que es lo que esperan `appointment-new` y
> el turno de mostrador.
>
> **4. Contrato — `BookingItemDto`**
> `GET /scheduling/bookings` y `GET /scheduling/bookings/:id` tienen que devolver:
> - `followUpOf: { bookingId, encounterId, startAt } | null` — **`startAt` es el del origen, ya
>   resuelto por el servidor.** Sin él, la agenda y «Mis citas» necesitan una petición por fila
>   para poder decir «de la cita del 12 de septiembre», o se quedan sin poder nombrarla. Es el
>   único campo del vínculo que no viaja en la escritura.
> - `followUpBookingId: string | null` — la reconsulta viva de esta cita, derivada al leer.
>
> Los dos respetan la misma compuerta de privacidad que `patientName` y `reasonText`: viajan al
> titular y al profesional de esa agenda. Ausente no es `null`: ausente es «no te corresponde
> verlo», `null` es «se buscó y no hay».
>
> **5. Lo que el frontend ya tiene y va a borrar cuando esto exista**
> `src/app/core/data-access/scheduling/follow-up.types.ts` — cada declaración lleva
> `// TODO C8: subir a scheduling.types.ts`. El simulador implementa el contrato completo de
> arriba y sus 24 pruebas lo fijan (`core/mock/handlers/scheduling.handlers.spec.ts`), así que
> sirve de especificación ejecutable para la API.
