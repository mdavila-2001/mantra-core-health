import { type Observable, catchError, forkJoin, map, of } from 'rxjs';

import type { SchedulingClient } from './scheduling.client';
import type { AgendaSlot, FlexibleStart } from './scheduling.types';

/** Prefijo del id de una hora flexible vista como cupo: no hay cupo todavía. */
export const FLEXIBLE_START_ID = 'flexible';

/** Una ventana de horarios libres de una agenda. */
export interface FreeStartsQuery {
  readonly resourceId: string;
  readonly from: Date;
  readonly to: Date;
  /** Tope de cupos fijos (`GET /scheduling/slots`). */
  readonly limit: number;
}

/** ¿Es una hora de horario flexible (P36) y no un cupo fijo? */
export function isFlexibleStart(slot: Pick<AgendaSlot, 'id'>): boolean {
  return slot.id.startsWith(`${FLEXIBLE_START_ID}|`);
}

/** La hora flexible con la forma de un cupo libre de un solo lugar. */
function asSlot(resourceId: string, start: FlexibleStart): AgendaSlot {
  return {
    id: `${FLEXIBLE_START_ID}|${resourceId}|${start.startAt.toISOString()}`,
    resourceId,
    scheduleTemplateId: start.templateId,
    startAt: start.startAt,
    endAt: start.endAt,
    capacity: 1,
    remainingCapacity: 1,
    statusConceptId: '',
    serviceConceptId: null,
  };
}

/**
 * Los horarios libres de una agenda: sus cupos fijos **y** las horas de su
 * horario flexible (P36), en una sola lista ordenada.
 *
 * Un día marcado «Horario flexible» no tiene cupos: sus horas las calcula la API
 * al leer (`GET /scheduling/resources/:id/flexible-availability`). Quien sólo
 * leía `GET /scheduling/slots` veía ese día vacío —«Sin horarios libres»— aunque
 * el médico atendiera. Es lo mismo que ya hace «Mis citas» del paciente.
 *
 * Que la lectura flexible falle no esconde los cupos fijos: se sigue con ellos.
 * La de cupos fijos sí falla entera, como antes.
 */
export function listFreeStarts(
  scheduling: SchedulingClient,
  query: FreeStartsQuery,
): Observable<readonly AgendaSlot[]> {
  const desde = new Date(Math.max(query.from.getTime(), Date.now()));
  const flexibles: Observable<readonly FlexibleStart[]> =
    query.to.getTime() > desde.getTime()
      ? scheduling.getFlexibleAvailability(query.resourceId, { from: desde, to: query.to }).pipe(
          map((disponibilidad) => disponibilidad.items),
          catchError(() => of<readonly FlexibleStart[]>([])),
        )
      : of([]);

  return forkJoin([
    scheduling.listSlots({
      resourceId: query.resourceId,
      from: query.from,
      to: query.to,
      onlyAvailable: true,
      limit: query.limit,
    }),
    flexibles,
  ]).pipe(
    map(([pagina, horas]) =>
      [...pagina.items, ...horas.map((hora) => asSlot(query.resourceId, hora))].sort(
        (a, b) => a.startAt.getTime() - b.startAt.getTime(),
      ),
    ),
  );
}
