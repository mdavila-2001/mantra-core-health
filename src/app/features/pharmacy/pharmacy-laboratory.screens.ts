import type { Type } from '@angular/core';

/**
 * Pantallas diferidas de Farmacia y Laboratorio clínico (administración de unidades comerciales).
 * Desacopladas de app.routes.ts bajo la reforma estructural lean.
 */
export const PHARMACY_LABORATORY_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administration/pharmacy-orders': () =>
    import('../organization/pharmacy-inbox/pharmacy-inbox').then((m) => m.PharmacyInbox),
  'administration/pharmacy-campaigns': () =>
    import('../organization/pharmacy-campaigns/pharmacy-campaigns').then(
      (m) => m.PharmacyCampaigns,
    ),
  'administration/pharmacy-catalog': () =>
    import('./catalog/pharmacy-catalog-hub').then((m) => m.PharmacyCatalogHub),
  'administration/pharmacy': () =>
    import('./summary/pharmacy-summary').then((m) => m.PharmacySummaryPage),
  // "Horario y turnos" is a tab of Sucursales: its old route redirects
  // (`SECCIONES_REDIRIGIDAS` in `app.routes.ts`).
  'administration/pharmacy-branches': () =>
    import('./branches/pharmacy-branches-hub').then((m) => m.PharmacyBranchesHub),
  'administration/laboratory': () =>
    import('../laboratory/summary/laboratory-summary').then((m) => m.LaboratorySummaryPage),
  'administration/laboratory-orders': () =>
    import('../laboratory/orders/laboratory-orders-page').then((m) => m.LaboratoryOrdersPage),
  'administration/laboratory-prices': () =>
    import('../laboratory/prices/laboratory-prices').then((m) => m.LaboratoryPrices),
  'administration/center-schedule': () =>
    import('../laboratory/center-schedule/center-schedule').then((m) => m.CenterSchedulePage),
  'administration/laboratory-branches': () =>
    import('../organization/organization-branches/organization-branches').then(
      (m) => m.OrganizationBranches,
    ),
};
