# Plan — C4 · Reconsulta: una cita real agendada desde la consulta

- Fecha: 2026-09-25 · Repos afectados: `mantra-core-health` (worktree `wt-clinica-c4`) · Predecesor: `origin/mockup` @ `bf2c3545`
- Rama: `claude/clinica-c4-reconsulta`
- Resultado observable: en la consulta, «Reconsulta» abre un bloque con calendario (cupos libres del
  recurso del doctor, desde mañana hasta +90 días), motivo precargado «Reconsulta: <motivo de la
  cita>» editable y «Agendar». Crea una cita real: en «Consultas médicas» la fila lleva el sello
  **Reconsulta** y «de la cita del <fecha>»; en el detalle «Qué es» dice «Reconsulta»; en «Mis
  citas» del paciente el mismo sello y «Tu médico te citó de nuevo por la consulta del <fecha>».
  Una segunda reconsulta de la misma cita se rechaza.
- Kill-test: si la reconsulta no aparece en `/my-account/appointments` de `paciente@alovida.mock`
  con el sello, C4 no está hecho.

## Alcance

- **IN** (archivos reservados de la ficha §0 del prompt):
  - `src/app/core/data-access/scheduling/follow-up.types.ts` (**nuevo**, tipos propios con `// TODO C8`)
  - `src/app/core/mock/fixtures/agenda.ts` (`ReservaSimulada.followUpOf`, seed de una reconsulta)
  - `src/app/core/mock/handlers/scheduling.handlers.ts` (+ `.spec.ts`)
  - `src/app/core/data-access/scheduling/scheduling.client.ts` (+ `.spec.ts`) — **sólo**
    `createDirectAppointment` con `followUpOf` y la lectura de `followUpOf`
  - `src/app/features/clinical-record/patient-chart/follow-up-block/**` (**nuevo**)
  - `src/app/features/agenda/agenda.{ts,html,css,spec.ts}` — **sólo** el sello y `CitaVisible.reconsultaDe`
  - `src/app/features/agenda/my-agenda/detalle-de-la-cita.ts` (+ `.spec.ts`)
  - `src/app/features/account/appointments/appointments.{ts,html,css,spec.ts}` — **sólo** sello y texto
  - `playwright/clinica-c4-reconsulta.spec.ts`
  - `docs/trabajo/2026-09-25-encuentro-clinico/c4/**`
- **OUT** (no se toca aunque haga falta): «Completar la cita» (`agenda.ts:2376`), `booking-new`,
  `appointment-new`, `walk-in`, plantillas y cupos, `consultation/**`, `conceptos.ts`, todo lo
  clínico de C1–C3 y C5, `account/medical-record/**` (C6). `agenda.ts` no se reescribe.

## Ambigüedades registradas y supuestos tomados

| # | Ambigüedad | Supuesto tomado | A quién confirmar |
|---|---|---|---|
| A-1 | El contrato pide `typeConceptId = TIPO_CITA['APT-RECONSULTA']`, pero **`APT-RECONSULTA` no existe** en `core/mock/fixtures/conceptos.ts` (líneas 537-542: sólo `APT-PRIMERA`, `APT-CONTROL`, `APT-URGENCIA`) y ese archivo es de C0, que no publicó. | Derivo el mismo id que produciría C0 —`uuid('concept-APT-RECONSULTA')`, que es exactamente lo que hace `definir()` en `conceptos.ts:69`— desde mi `follow-up.types.ts`, con `// TODO C8`. Cuando C0 agregue la entrada al value set, el id coincide byte a byte y no hay migración. El rótulo de pantalla es el literal «Reconsulta», no una búsqueda en el catálogo, así que nada muestra un uuid crudo mientras el concepto no esté registrado. | Marcelo (C0) |
| A-2 | La casilla `consulta-casilla-reconsulta` que abre el bloque vive en `consultation.ts`/`.html`, que están en `ARCHIVOS DE OTROS`. | El bloque se entrega **standalone y probado**, con la misma firma de entradas/salidas que los otros diez bloques (`[patientProfileId]`, `[encounterId]`, `(cambio)`), listo para un `@case ('reconsulta')`. El cableado queda como hand-off explícito para el dueño de `consultation/**`. El Playwright se escribe contra los `data-testid` acordados y **no se ejecuta** (ni podría pasar hasta que el cableado exista). | dueño de C1 / `consultation/**` |
| A-3 | El prompt pide `app-alert variant="success"`. | La API real del componente es `tone` (`alert.ts:38`), no `variant`. Se usa `tone="success"`. | — |
| A-4 | «Calendario»: reusar `app-date-picker` o `app-appointment-calendar`. | `app-date-picker` (organismo, con `minDate`/`maxDate`), que es lo que ya usa `admission-block` para elegir una fecha. `app-appointment-calendar` pinta turnos existentes, no elige días libres. | — |
| A-5 | `scripts/pw-guard.mjs` no existe en este árbol (artefacto de C0). | H4.M1 se escribe sin ejecutar; H4.M2 (capturas) queda sin ejecutar. Declarados `A MEDIAS` con la causa real, sin inventar evidencia visual. | Justin (el que corre la regresión centralizada) |

## H1 — Arranque y encuadre

**CA:** existe el plan en disco con las 12 microtareas, el baseline está tomado y el alcance declarado.
**DoD:** `PLAN.md` en `docs/trabajo/2026-09-25-encuentro-clinico/c4/`; baseline de `typecheck` y de los specs que voy a tocar.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| C4.H1.M1 | Arranque, estándar, baseline, `PLAN.md` | El plan existe y el baseline está capturado | `corepack yarn typecheck` → 0 · `PLAN.md` en disco | HECHO |

## H2 — El contrato: seed, handler y cliente

**CA:** Dado el mock levantado, cuando el front pide `POST /scheduling/appointments/direct` con
`followUpOf`, entonces la reserva nace `BK-CONFIRMED` con tipo reconsulta y las lecturas de
`bookings` la devuelven con `followUpOf`; y la reserva origen expone `followUpBookingId`.
**DoD:** specs dirigidos de handlers y cliente en verde, salida en `evidencia/`.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| C4.H2.M1 | Seed de agenda: `ReservaSimulada.followUpOf: FollowUpOrigin \| null` + una reserva futura `APT-RECONSULTA` de `MEDICA` colgada de una completada pasada del mismo paciente | El seed es determinista y `agendas-cobertura.spec.ts` sigue verde | `corepack yarn test --watch=false --include='src/app/core/mock/fixtures/agendas-cobertura.spec.ts'` | HECHO |
| C4.H2.M2 | Handler de cita directa con `followUpOf`; lecturas con `followUpOf` / `followUpBookingId` | Los 6 casos pasan: ok · 404 · 422 paciente · 422 pasado · 403 recurso · 409 segunda | `corepack yarn test --watch=false --include='src/app/core/mock/handlers/scheduling.handlers.spec.ts'` | HECHO |
| C4.H2.M3 | Cliente: `createDirectAppointment` manda `followUpOf` sólo si viene; `Booking` lo lee | El cuerpo de la petición lleva `followUpOf` exacto y nada más | `corepack yarn test --watch=false --include='src/app/core/data-access/scheduling/scheduling.client.spec.ts'` | HECHO |

## H3 — El bloque y los sellos

**CA:** Dado un doctor en una consulta abierta desde una cita, cuando abre el bloque de reconsulta,
elige día y cupo y escribe el motivo, entonces «Agendar» crea la cita y el bloque muestra el éxito
con fecha y hora; sin cupo no guarda; sin `bookingId` explica de dónde se agenda; ya agendada
ofrece reprogramar; el 409 se ve en el bloque.
**DoD:** specs del bloque, de `agenda`, de `detalle-de-la-cita` y de `appointments` en verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| C4.H3.M1 | `follow-up-block`: lectura de la cita origen y los tres estados | Los tres estados se renderizan | `corepack yarn test --watch=false --include='src/app/features/clinical-record/patient-chart/follow-up-block/follow-up-block.spec.ts'` | HECHO |
| C4.H3.M2 | Día + cupos (`app-radio-group` «Mañana / Tarde») + motivo (`app-textarea` precargado) + «Agendar» | Sin cupo elegido el botón está deshabilitado y no escribe | mismo spec | HECHO |
| C4.H3.M3 | Éxito y `(cambio)` | Éxito con fecha/hora y enlace a Consultas médicas; el 409 se ve | mismo spec | HECHO |
| C4.H3.M4 | Agenda del doctor: sello `cita-reconsulta-sello` + «de la cita del <fecha>»; detalle «Qué es» = «Reconsulta» | Se ve con la seed | `corepack yarn test --watch=false --include='src/app/features/agenda/agenda.spec.ts'` y el spec de `detalle-de-la-cita` | HECHO |
| C4.H3.M5 | Mis citas del paciente: sello `mis-citas-reconsulta-sello` + frase | Se ve con `paciente@alovida.mock` | `corepack yarn test --watch=false --include='src/app/features/account/appointments/appointments.spec.ts'` | HECHO |

## H4 — Prueba de navegador

**CA:** el recorrido del §6 del prompt está escrito y es ejecutable en cuanto exista el cableado de la casilla.
**DoD:** `playwright/clinica-c4-reconsulta.spec.ts` en disco; ejecución **bloqueada** por límite de recursos y por `pw-guard` ausente.
**Estado:** A MEDIAS — el spec existe y typechequea; no se ejecutó (sin `pw-guard`, sin navegador, límite de recursos del turno)

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| C4.H4.M1 | Playwright `clinica-c4-reconsulta.spec.ts` | El spec existe y typechequea | `corepack yarn typecheck` (incluye `playwright/`) | A MEDIAS |
| C4.H4.M2 | Capturas cinco viewports, claro/oscuro; doble revisión crítica | — | capturas | A MEDIAS |

## H5 — Cierre

**CA:** gates sin rojos nuevos, PR abierto contra `mockup` y mergeable, `REPORTE.md` con P42.
**DoD:** `typecheck` + `lint` sin rojos nuevos; `gh pr view` pegado.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| C4.H5.M1 | Gates, commits, push, PR contra `mockup`, `REPORTE.md` con **P42** | `mergeable=MERGEABLE`, reporte con las tres secciones | `corepack yarn typecheck` · `corepack yarn lint` · `gh pr view <n> --json …` | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `APT-RECONSULTA` ausente de `conceptos.ts` (A-1) | El tipo de cita no se resuelve en el catálogo de terminología | Id derivado con la misma semilla + rótulo literal en pantalla + `// TODO C8` |
| La casilla que abre el bloque es de otro carril (A-2) | El recorrido de navegador no se puede cerrar | Bloque standalone con la firma de los otros diez; hand-off escrito |
| `agenda.ts` tiene 2 949 líneas y muchos specs | Regresión invisible | Se tocan sólo `CitaVisible.reconsultaDe`, `aCitaVisible` y la celda de motivo; `agenda.spec.ts` dirigido |
| Husos y «desde mañana / +90 días» | Cupos ofrecidos fuera de rango | Los límites se calculan con `Date` y milisegundos, nunca comparando strings de fecha |
| Sin navegador ni `pw-guard` | No hay peldaño `VERIFIED` | Se declara el peldaño real (`TESTED`) y se nombra lo no cubierto |
