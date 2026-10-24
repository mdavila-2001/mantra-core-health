# H2.S1.M2 — Cotejo del árbol de `POST /scheduling/slots/{id}/holds` contra el servicio

Fecha: 2026-10-21 · Fuente leída: `src/modules/scheduling/services/scheduling-bookings.service.ts` (`placeHold`, líneas 346 a 421) · Árbol: `inventario/arboles/scheduling.json` · Dibujo: [`H2-S1-M2-holds-arbol.png`](./H2-S1-M2-holds-arbol.png) (mirado, ver abajo)

| Línea del código | Qué hace | Nodo del árbol | Coincide |
|---|---|---|---|
| 356 | `this.em.transactional(async (tx) => …)` | `TRANSACCION` | sí |
| 357 | `findSlotForUpdate(tx, slotId)` | `LLAMADA …findSlotForUpdate` → `LEE scheduling.bookable_slots` | sí |
| 358-360 | `!slot` → `ResourceNotFoundException('Slot no encontrado')` | `SI !slot` → `404 NOT_FOUND` | sí |
| 361-365 | slot bloqueado → `PreconditionFailedException('El slot está bloqueado')` | `422 PRECONDITION_FAILED` | sí (422 y no 412: la excepción es la del proyecto) |
| 366-370 | `remainingCapacity <= 0` → `ConflictException('El slot no tiene cupos disponibles')` | `409 CONFLICT` | sí |
| 373 | `resolvePolicy(tx, slot.scheduleTemplateId)` | `LLAMADA resolvePolicy` → `LEE schedule_templates`, `LEE booking_policies` | sí |
| 388-401 | `yaPaso \|\| demasiadoSobreLaHora` → 422 con dos frases | `422` con «Ese horario ya pasó. / Ese turno empieza demasiado pronto…» | sí (ambas ramas del condicional) |
| 403-420 | máximo de citas activas por paciente → `ConflictException` | `SI policy?.maxActivePerPatient && dto.patientProfileId` → `LEE appointment_bookings` → `409` | sí |
| 424-432 | `createHold(...)` | `LLAMADA createHold` → `CREA scheduling.slot_holds` | sí |
| 434 | `slot.remainingCapacity -= 1` | `ACTUALIZA scheduling.bookable_slots` | sí (POR_TIPO: variable tipada como la entidad) |
| 435-436 | si llega a 0 → estado `SLOT_HELD` | `SI slot.remainingCapacity === 0` → `ACTUALIZA bookable_slots` | sí |
| 349-352 | `logger.info(...)` | — | correcto: no decide ni escribe, se poda |

Respuestas derivadas: 201 (éxito), 400 (UUID inválido), 401, 403 (rol y tenant), 404, 409 (dos causas), 422 (dos causas), 429 (límite global). Comprobado en `flujos.test.mjs`: «POST /scheduling/slots/{id}/holds: árbol cotejado con el servicio».

**Diferencia con el CA del plan.** El plan esperaba «`FOR UPDATE` → `ESCRIBE slot_holds/slots`». El árbol no modela el bloqueo pesimista: lo muestra sólo por el nombre de la llamada (`findSlotForUpdate`) y registra la lectura como `LEE`. La escritura de `slot_holds` y `bookable_slots` sí está. El CA se cumple en lo que afirma el README (anti-doble-reserva por bloqueo) sólo de forma indirecta; queda declarado en «No cubierto».

**Inspección visual del dibujo.** Se renderizó con mermaid 11.4.1 en Chromium y se miró la imagen: el orden de los nodos sigue el del código, las ramas de error terminan en su nodo rojo y los dos 422 y los dos 409 aparecen como nodos distintos. El nodo de acceso agrupa sesión, rol, tenant y UUID con su estado de fallo. Una sola vista, escritorio, un solo tema: no es la prueba visual del portal (esa es H5).
