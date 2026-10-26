import { type Observable, map } from 'rxjs';

import type { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaSlot,
  SlotHold,
} from '../../../core/data-access/scheduling/scheduling.types';

/**
 * Horario flexible, sin turnos fijos (P36), visto desde la pantalla de reserva.
 *
 * Una hora flexible **no es un cupo**: la API la calcula al leer y el cupo nace
 * al retenerla. Por eso esta pantalla no la reencuentra por id sino por agenda e
 * inicio —que viajan por query string con `flexible=1`— y retiene con el
 * endpoint propio. Confirmar y solicitar son el mismo ciclo que una consulta.
 *
 * Vive aparte para que `booking-new.ts` no crezca: son dos lecturas puras sobre
 * el cliente, sin estado propio.
 */

/** Query param que marca la reserva de una hora flexible. */
export const FLEXIBLE_PARAM = 'flexible';

/**
 * Reencuentra la hora pedida en las horas libres del horario flexible.
 *
 * Que venga en la respuesta es la única prueba de que todavía está libre. Se
 * sintetiza un {@link AgendaSlot} para que el resumen sea el de una consulta.
 *
 * @returns La hora como cupo, o `null` si ya no está libre.
 */
export function releerHoraFlexible(
  scheduling: SchedulingClient,
  slotId: string,
  resourceId: string,
  desde: Date,
  margenMs: number,
): Observable<AgendaSlot | null> {
  return scheduling
    .getFlexibleAvailability(resourceId, {
      from: new Date(desde.getTime() - margenMs),
      to: new Date(desde.getTime() + margenMs),
    })
    .pipe(
      map((disponibilidad) => {
        const hora = disponibilidad.items.find(
          (item) => item.startAt.getTime() === desde.getTime(),
        );
        if (hora === undefined) return null;
        return {
          id: slotId,
          resourceId,
          scheduleTemplateId: hora.templateId,
          startAt: hora.startAt,
          endAt: hora.endAt,
          capacity: 1,
          remainingCapacity: 1,
          statusConceptId: '',
          serviceConceptId: null,
        };
      }),
    );
}

/**
 * Retiene la hora: crea su cupo y devuelve la retención con la forma de una
 * consulta, para que el resto del ciclo no tenga que distinguirla.
 */
export function retenerHoraFlexible(
  scheduling: SchedulingClient,
  resourceId: string,
  inicio: Date,
  pacienteId: string,
): Observable<SlotHold> {
  return scheduling
    .placeFlexibleHold(resourceId, { startAt: inicio, patientProfileId: pacienteId })
    .pipe(
      map((retencion) => ({
        id: retencion.id,
        holdToken: retencion.holdToken,
        expiresAt: retencion.expiresAt,
        // El cupo de una hora flexible es de un solo lugar y nace ya tomado.
        remainingCapacity: 0,
      })),
    );
}
