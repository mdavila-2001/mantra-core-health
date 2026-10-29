import type { Type } from '@angular/core';

/**
 * Las pantallas de internación (franja F2) que se descargan al entrar. Viven acá
 * y `app.routes.ts` las esparce en su tabla de pantallas diferidas: ese archivo
 * está congelado por `scripts/check-max-lines.mjs` y no puede crecer.
 */
export const INPATIENT_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'inpatient/bed-board': () => import('./bed-board/bed-board').then((m) => m.BedBoard),
  'inpatient/cleaning': () => import('./cleaning-queue/cleaning-queue').then((m) => m.CleaningQueue),
};
