/* ============================================================================
    The clinical day's zone, for `DatePipe`.

    The columns group by the clinical day (`dia-clinico.ts`, `DEFAULT_TIME_ZONE`,
    `America/La_Paz`), but a `DatePipe` without a zone prints in the browser's:
    with the browser in UTC, a record at 23:30 on 4 Nov in La Paz sat in the
    «4 nov» column under a «5 nov» header. `DatePipe` takes an offset, not an
    IANA name; Bolivia has no daylight saving time, so the offset is derived
    once from the zone (`-0400`) and holds all year.
    ========================================================================== */

import { DATE_PIPE_DEFAULT_OPTIONS, type DatePipeConfig } from '@angular/common';
import type { Provider } from '@angular/core';

import { DEFAULT_TIME_ZONE } from '../../../inpatient/inpatient-presentation';

/** `±hhmm` of a zone at an instant, as `DatePipe` reads it. */
export function desfaseDeLaZona(zona = DEFAULT_TIME_ZONE, instante = new Date()): string {
  const nombre = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' })
    .formatToParts(instante)
    .find((p) => p.type === 'timeZoneName')?.value;
  const partes = /GMT([+-])(\d{2}):(\d{2})/.exec(nombre ?? '');
  return partes === null ? '+0000' : `${partes[1]}${partes[2]}${partes[3]}`;
}

/** Every date the network prints, in the clinical day's zone. */
export const FECHAS_DEL_DIA_CLINICO: Provider = {
  provide: DATE_PIPE_DEFAULT_OPTIONS,
  useFactory: (): DatePipeConfig => ({ timezone: desfaseDeLaZona() }),
};
