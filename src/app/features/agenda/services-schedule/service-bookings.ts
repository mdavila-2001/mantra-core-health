import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import type { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { Booking } from '@core/data-access/scheduling/scheduling.types';
import type { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '@core/data-access/terminology/terminology.types';

import { AWAITING_RESPONSE_CODES, sufijoDeCodigo } from '../booking-status';
import { misRecursosDeAgenda } from '../mi-recurso';

/** Cuántas semanas hacia adelante se juntan las solicitudes y los turnos. */
export const SERVICE_BOOKINGS_WEEKS = 8;

/** Tope por sede: una pantalla de gestión, no un histórico. */
const MAX_PER_RESOURCE = 200;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Las reservas de servicios del profesional, con sus estados ya traducidos. */
export interface ServiceBookings {
  readonly bookings: readonly Booking[];
  /** Las etiquetas de los estados, para que quien pinta las acciones las conozca. */
  readonly labels: ConceptLabels;
}

/** Si una reserva es de un servicio y no de una consulta. */
export function isServiceBooking(booking: Booking): boolean {
  return booking.service !== undefined && booking.service !== null;
}

/** Si la reserva espera que el profesional la acepte o la rechace. */
export function awaitsResponse(booking: Booking, labels: ConceptLabels): boolean {
  const concept = labels.get(booking.statusConceptId);
  return concept !== undefined && AWAITING_RESPONSE_CODES.has(sufijoDeCodigo(concept.code));
}

/**
 * Las solicitudes y turnos de **otros servicios** del profesional en sesión,
 * desde hoy hasta {@link SERVICE_BOOKINGS_WEEKS} semanas adelante, en todas sus
 * sedes.
 *
 * ## Por qué hace falta
 *
 * Una reserva de servicio es una reserva como cualquier otra: si el servicio
 * exige aprobación nace «solicitada», y hasta acá sólo se podía aceptar
 * encontrándola en el calendario del día que tocaba. Esto la junta en un solo
 * lugar. Las canceladas y rechazadas no vienen: no hay nada que gestionar.
 */
export function loadServiceBookings(
  scheduling: SchedulingClient,
  terminology: TerminologyClient,
  tenantId: string,
  practitionerProfileId: string,
  now: Date = new Date(),
): Observable<ServiceBookings> {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + SERVICE_BOOKINGS_WEEKS * 7 * ONE_DAY_MS);
  return misRecursosDeAgenda(scheduling, tenantId, practitionerProfileId).pipe(
    switchMap((resources) =>
      resources.length === 0
        ? of<readonly Booking[]>([])
        : forkJoin(
            resources.map((r) =>
              scheduling
                .searchBookings({ resourceId: r.id, from, to, limit: MAX_PER_RESOURCE })
                .pipe(map((page) => page.items)),
            ),
          ).pipe(map((pages) => pages.flat())),
    ),
    map((all) =>
      all.filter(isServiceBooking).sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0)),
    ),
    switchMap((bookings) =>
      terminology.readConceptLabels(bookings.map((b) => b.statusConceptId)).pipe(
        // Sin catálogo la lista igual se muestra; sólo no se sabe cuál espera respuesta.
        catchError(() => of<ConceptLabels>(new Map())),
        map((labels) => ({ bookings, labels })),
      ),
    ),
  );
}
