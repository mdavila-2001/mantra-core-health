import type { Type } from '@angular/core';

/* ============================================================================
    Las rutas de «Admisiones», en un solo lugar.

    La sección padre la declara `core/navigation/navigation.map.ts`; la ficha
    de una admisión es una pantalla hija, no una entrada de menú. El módulo
    existe para no seguir engordando `app.routes.ts`.
    ========================================================================== */

/** La bandeja. Coincide con la sección del menú. */
export const ADMISSIONS_ROUTE = '/administration/admissions';

/** La ficha de una admisión. */
export const admissionDetailRoute = (id: string): string =>
  `${ADMISSIONS_ROUTE}/${encodeURIComponent(id)}`;

/** La sección «Admisiones»: la bandeja, que se descarga al entrar. */
export const ADMISSIONS_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administration/admissions': () =>
    import('./admissions-queue/admissions-queue').then((m) => m.AdmissionsQueue),
};

/** La ficha de una admisión (diferida, con el guard de rol de la sección). */
export const ADMISSION_DETAIL_PATH = 'administration/admissions/:admissionId';
export const loadAdmissionDetail = (): Promise<Type<unknown>> =>
  import('./admission-detail/admission-detail').then((m) => m.AdmissionDetail);
