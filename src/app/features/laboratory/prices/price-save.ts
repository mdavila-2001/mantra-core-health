import { catchError, concatMap, from, map, of, toArray, type Observable } from 'rxjs';

import type { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabService,
  LabServiceChanges,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import { reasonOf, type PriceRejection } from './laboratory-prices.rules';

/**
 * Saves each changed row one after the other; one failing does not stop the
 * rest. Emits once, with the rows that were saved and the ones rejected.
 */
export function savePrices(
  lab: LabPortalClient,
  changes: readonly { service: LabService; body: LabServiceChanges }[],
): Observable<{ saved: number; rejected: PriceRejection[] }> {
  return from(changes).pipe(
    concatMap(({ service, body }) =>
      lab.updateService(service.id, body).pipe(
        map(() => null),
        catchError((error: unknown) => of({ name: service.name, reason: reasonOf(error) })),
      ),
    ),
    toArray(),
    map((results) => {
      const rejected = results.filter((result): result is PriceRejection => result !== null);
      return { saved: results.length - rejected.length, rejected };
    }),
  );
}
