import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { seccionRolesGuard } from '../../core/navigation/section-roles.guard';
import { APP_TITLE } from '../../core/navigation/navigation.types';

/* ============================================================================
    Las rutas de internación (F2/F3), en un solo lugar.

    Las cuatro secciones del menú las declara `core/navigation/navigation.map.ts`;
    el ingreso y la ficha de una internación son pantallas hijas. Quién puede
    qué lo decide la API (`/practice/infrastructure-access/me` y cada endpoint):
    estas rutas sólo exigen sesión y organización.
    ========================================================================== */

/** Secciones con pantalla propia, diferidas. */
export const INPATIENT_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'inpatient/bed-board': () => import('./bed-board/bed-board').then((m) => m.BedBoard),
  'inpatient/cleaning': () => import('./cleaning-queue/cleaning-queue').then((m) => m.CleaningQueue),
  'inpatient/census': () => import('./census/census').then((m) => m.Census),
  'inpatient/indicators': () => import('./indicators/indicators').then((m) => m.Indicators),
};

/** El ingreso y la ficha de una internación (cuelgan del armazón). */
export function inpatientRoutes(options: { readonly chunkFailed: () => Type<unknown> }): Routes {
  return [
    {
      path: 'inpatient/admissions/new',
      title: `${APP_TITLE} - Nuevo ingreso`,
      canActivate: [seccionRolesGuard],
      loadComponent: () => import('./admission-new/admission-new').then((m) => m.AdmissionNew).catch(() => options.chunkFailed()),
    },
    {
      path: 'inpatient/stays/:encounterId',
      title: `${APP_TITLE} - Internación`,
      canActivate: [seccionRolesGuard],
      loadComponent: () => import('./stay/stay').then((m) => m.Stay).catch(() => options.chunkFailed()),
    },
  ];
}
