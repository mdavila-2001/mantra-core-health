import { HttpErrorResponse } from '@angular/common/http';
import { concatMap, from, map, of, toArray, catchError, type Observable } from 'rxjs';

import type { SiteOpeningHours } from '../../../../core/data-access/pharmacy/opening-hours.types';
import { pharmacyErrorMessage } from '../../pharmacy-error-message';

/** What happened in ONE site when a bulk change was applied to it. */
export interface ResultadoDeSede {
  readonly siteId: string;
  readonly siteName: string;
  /** `null` when saved; the readable reason otherwise. */
  readonly motivo: string | null;
}

/** The server reason for a 409/422, or the usual fallback message. */
export function motivoDe(error: unknown, porDefecto: string): string {
  if (error instanceof HttpErrorResponse && (error.status === 409 || error.status === 422)) {
    const cuerpo = error.error as { message?: unknown } | null;
    if (typeof cuerpo?.message === 'string') {
      return cuerpo.message;
    }
  }
  return pharmacyErrorMessage(error, porDefecto);
}

/**
 * Applies `operacion` to each site **in series** (one request at a time) and
 * collects each outcome. There is no bulk endpoint: the API still decides site
 * by site (overlap, window, permission), so a failure in one site neither stops
 * the others nor hides behind a generic "done".
 */
export function aplicarASedes(
  sedes: readonly SiteOpeningHours[],
  operacion: (sede: SiteOpeningHours) => Observable<unknown>,
  porDefecto: string,
): Observable<readonly ResultadoDeSede[]> {
  return from(sedes).pipe(
    concatMap((sede) =>
      operacion(sede).pipe(
        map((): ResultadoDeSede => ({
          siteId: sede.siteId,
          siteName: sede.siteName,
          motivo: null,
        })),
        catchError((error: unknown) =>
          of<ResultadoDeSede>({
            siteId: sede.siteId,
            siteName: sede.siteName,
            motivo: motivoDe(error, porDefecto),
          }),
        ),
      ),
    ),
    toArray(),
  );
}
