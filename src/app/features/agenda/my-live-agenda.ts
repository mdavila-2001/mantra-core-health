import {
  catchError,
  concatMap,
  defer,
  first,
  from,
  map,
  of,
  tap,
  toArray,
  type Observable,
} from 'rxjs';

import type { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  PublishedTemplatePage,
} from '@core/data-access/scheduling/scheduling.types';
import { agendaResourcesMy, liveTemplateOf } from './my-resource';

/** One of the practitioner's agendas: its organization, the agenda and its templates. */
export interface MyAgenda {
  readonly tenantId: string;
  readonly resource: AgendaResource;
  readonly page: PublishedTemplatePage;
}

/**
 * The practitioner's agenda to show: the first one with a schedule in force,
 * looking in `tenantIds` in order — the active organization first. With none in
 * force anywhere, the active organization's first own agenda (its retired
 * schedules can still be reactivated), or `null` if there is none.
 *
 * Two reasons this exists instead of «the first own agenda of the active
 * organization»:
 * - a publication that failed half-way leaves an empty agenda that can come
 *   first, and the schedule in force was hidden behind it;
 * - «¿Dónde publica?» lets the practitioner publish in an affiliated
 *   organization, and the screen only looked in the active one, so a published
 *   schedule read as «Todavía no publicó su horario».
 *
 * Only the active organization's failure is the caller's failure (it is the
 * screen's S5/S9); another organization failing just means «not there».
 */
export function findMyAgenda(
  scheduling: SchedulingClient,
  tenantIds: readonly string[],
  practitionerProfileId: string,
): Observable<MyAgenda | null> {
  return defer(() => {
    let fallback: MyAgenda | null = null;
    return from(tenantIds).pipe(
      concatMap((tenantId, index) => {
        // The active organization is asked as always, without declaring it.
        const scope = index === 0 ? undefined : { tenantId };
        const agendas$ = agendaResourcesMy(scheduling, tenantId, practitionerProfileId, scope).pipe(
          concatMap((resources) => from(resources)),
          concatMap((resource) =>
            scheduling
              .listTemplates(resource.id, scope)
              .pipe(map((page): MyAgenda => ({ tenantId, resource, page }))),
          ),
          toArray(),
        );
        return index === 0
          ? agendas$.pipe(tap((agendas) => (fallback = agendas[0] ?? null)))
          : agendas$.pipe(catchError(() => of<MyAgenda[]>([])));
      }),
      concatMap((agendas) => from(agendas)),
      first((agenda) => liveTemplateOf(agenda.page) !== null, null),
      map((found) => found ?? fallback),
    );
  });
}
