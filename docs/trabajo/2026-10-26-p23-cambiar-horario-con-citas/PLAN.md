# Plan — P23: cambiar un horario que tiene citas

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-api, mantra-core-health (front) · Modelo: sin cambios
  de esquema · Predecesor: M4 · H1.S2.M2 (26/09, el retiro ya no responde 409 con citas vivas) y la etapa C
  (24/10, `?affectedBookings=cancel` + `GET templates/:id/live-bookings`).
- Fuente del pedido: `PENDIENTES-BACKEND.md` (rama `mockup` del front), sección «Abierto · P23».
- Resultado observable: un profesional con citas confirmadas cambia su horario desde «Cambiar mi horario»
  (`/schedule/agenda/new` en modo cambio): el horario viejo se retira conservando sus citas, el nuevo se publica
  con la duración nueva, ningún turno viejo se sigue ofreciendo, y ninguna cita se pierde ni queda doble —
  contra la API real y contra el simulador, con el mismo contrato.
- Kill-test: retirar un horario con una cita viva responde 409 (API o simulador), o tras el cambio
  `GET /scheduling/slots?onlyAvailable=true` ofrece un cupo del horario retirado.

## Descubrimiento (hechos, con ruta)

1. La API **ya no** responde 409: `retire-template.use-case.ts` conserva las citas vivas y las informa en
   `liveBookings`/`liveBookingIds` (M4 · H1.S2.M2), y con `?affectedBookings=cancel` las cancela con aviso.
   El int-spec `test/integration/fx4-retirar-horario-publicado.int-spec.ts` lo fija.
2. El **simulador** del front sigue con el contrato viejo: `core/mock/handlers/scheduling.handlers.ts`
   `DELETE /scheduling/templates/:id` responde 409 con citas comprometidas, no implementa
   `GET /scheduling/templates/:id/live-bookings` (el cliente cae al 404 → «conservar» → 409) ni
   `affectedBookings=cancel`, y no devuelve `liveBookings`/`liveBookingIds`/`truncated`/`cancelledBookings`.
   En la maqueta, cambiar el horario sigue siendo imposible.
3. Defecto real de la API destapado al revisar «sin duplicar»: `SchedulingCatalogRepository.retireTemplate`
   conserva los cupos con historia pero los deja `SLOT_OPEN`. Un cupo conservado cuya cita se cancela (o que
   sólo tiene historia cancelada, o capacidad > 1) **se sigue ofreciendo** en `GET /scheduling/slots`
   con la hora y la duración del horario retirado, al lado del cupo nuevo del mismo instante: el defecto
   original («el turno de las 08:00 sigue terminando a las 08:30») y una doble reserva posible.
4. Carrera: el retiro lee las citas de los cupos **sin bloquearlos**; una retención o reserva concurrente sobre
   un cupo «libre» termina en violación de FK (`slot_holds`/`appointment_bookings` → `bookable_slots`) y el
   retiro entero falla. `findSlotsOfTemplateForUpdate` existe y las retenciones toman el cupo `FOR UPDATE`
   (`place-hold.use-case.ts` vía `findSlotForUpdate`).
5. `cancel-booking`, `reschedule-booking` y `propose-schedule` no reabren un cupo `SLOT_BLOCKED`;
   `slotHoldRefusal` rechaza retener un `SLOT_BLOCKED`; los listados de disponibles filtran `SLOT_OPEN`.
6. Defecto del simulador de la sección (errores sin `code`): los seis ayudantes de `mock-router.ts` ya declaran
   su código en `dev`. Quedan cuerpos sin `code` fuera de ellos: el 500 simulado de
   `mock-backend.interceptor.ts` y tres respuestas de `surveys-forms.handlers.ts` (422/403).

## Decisión (opción elegida de la sección)

Opción **1** de la sección, llevada al extremo que ya eligió M4: el 409 no se acota, **desaparece** — retirar
conserva toda cita viva (y la informa), sin importar su fecha. Es la más preferida, ya está en la API, es
reversible (no hay esquema) y es coherente con la etapa C. Se descartan la 2 (`release-free-slots`) y la 3
(`generate-slots?replace=true`): duplicarían con otra ruta lo que el retiro ya hace. Lo que faltaba para que
fuera **seguro** es lo de los hallazgos 3 y 4, y alinear el simulador (2 y 6).

## Alcance
- IN (API): `scheduling-catalog.repository.ts#retireTemplate` (bloqueo de cupos + cupos conservados a
  `SLOT_BLOCKED`), su spec unitario, descripción de `keptSlots`, un int-spec nuevo contra la base real,
  inventario de scheduling si queda desactualizado.
- IN (front): simulador de plantillas (retiro sin 409, `live-bookings`, `affectedBookings=cancel`, cupos
  conservados cerrados, generación que omite instantes con cita viva), ayudantes de error sin `code`,
  tipo `RetiredTemplate` completo, comentarios que todavía describen el 409, specs.
- OUT: `generate-slots` de la API (lo toca P36; ya omite instantes con cita confirmada del profesional vía
  `commitments`), recursos que no son profesionales (salas/equipos), solicitudes pendientes en cupos
  conservados, el campo `available` de la agenda que ignora el estado, el inventario ya desactualizado de otros
  módulos.
- Ambigüedades registradas: ¿un cupo conservado de un horario retirado puede volver a ofrecerse si su cita se
  cancela? Supuesto: **no** (queda `SLOT_BLOCKED`); reofrecerlo publicaría un turno del horario que el
  profesional retiró. A confirmar con el propietario.

## H1 — Cambiar el horario con citas es seguro en la API
**CA:** Dado un profesional con una cita confirmada a las 14:00 en un horario de 30 min, cuando retira y publica
uno de 45 min, entonces la cita sigue confirmada en su cupo, el cupo viejo no se ofrece, el 14:00 nuevo no se
genera encima de la cita, y si la cita se cancela su cupo viejo no vuelve a ofrecerse.
**DoD:** unit del repositorio en verde · int-spec P23 en verde contra `mantra_p23` · typecheck · lint dirigido.
**Estado:** HECHO (sin prueba visual: ver REPORTE)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Retiro bloquea los cupos de la plantilla `FOR UPDATE` antes de leer citas | spec: `find` con `lockMode PESSIMISTIC_WRITE` | `yarn test scheduling-catalog.repository` | HECHO |
| H1.S1.M2 | Cupos conservados quedan `SLOT_BLOCKED` | spec: los conservados cambian de estado, los soltados se borran | `yarn test scheduling-catalog.repository` | HECHO |
| H1.S2.M1 | Int-spec «cambiar horario con citas» (camino real + negativo de autorización + concurrencia retención/retiro) | todos los `it` en verde | `yarn test:integration p23-cambiar-horario` | HECHO |
| H1.S2.M2 | typecheck + lint de lo tocado + inventario de scheduling | exit 0; scheduling fuera de la lista de desactualizados | `yarn typecheck`, `eslint`, `yarn inventario:verificar` | HECHO |

## H2 — El simulador sirve el mismo contrato y la pantalla cambia el horario en la maqueta
**CA:** Dado el simulador con citas de demostración, cuando «Cambiar mi horario» publica, entonces no hay 409,
se pregunta por las citas (cancelar y avisar / conservar) y el horario nuevo queda publicado.
**DoD:** specs del simulador y de los componentes en verde · typecheck del front.
**Estado:** HECHO (sin prueba visual: ver REPORTE)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | `DELETE templates/:id` del simulador: sin 409, conserva y cierra cupos con cita, informa `liveBookings`, `affectedBookings=cancel` | spec del handler | `yarn vitest run scheduling.handlers` | HECHO |
| H2.S1.M2 | `GET templates/:id/live-bookings` en el simulador | spec del handler | `yarn vitest run scheduling.handlers` | HECHO |
| H2.S1.M3 | `generate-slots` del simulador omite instantes que pisan una cita viva (`omittedByCommitments`) | spec del handler | `yarn vitest run scheduling.handlers` | HECHO |
| H2.S2.M1 | Errores del simulador sin `code` (500 simulado, surveys) declaran su código | spec del interceptor/handler | `yarn vitest run mock-backend surveys-forms` | HECHO |
| H2.S3.M1 | `RetiredTemplate` con `liveBookings`/`liveBookingIds`/`truncated`; comentarios del 409 corregidos | typecheck | `yarn typecheck` | HECHO |
| H2.S3.M2 | Specs del cliente, `block-cancellations` y `agenda-create` en verde | vitest | `yarn vitest run …` | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P36 toca `generate-slots` del simulador y de la API | conflicto al unir | API: no se toca `generate-slots`. Front: cambio mínimo en el bucle; merge a mano uniendo ambos |
| Sin navegador para prueba visual | sin `VERIFIED` visual | Declarado «No cubierto» |
