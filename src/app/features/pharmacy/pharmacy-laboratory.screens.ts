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
  'administration/pharmacy-hours': () =>
    import('./opening-hours/pharmacy-opening-hours').then((m) => m.PharmacyOpeningHoursPage),
  'administration/pharmacy-branches': () =>
    import('../organization/organization-branches/organization-branches').then(
      (m) => m.OrganizationBranches,
    ),
  'administration/laboratory': () =>
    import('../laboratory/summary/laboratory-summary').then((m) => m.LaboratorySummaryPage),
  'administration/laboratory-orders': () =>
    import('../laboratory/orders/laboratory-orders').then((m) => m.LaboratoryOrders),
  'administration/laboratory-prices': () =>
    import('../laboratory/prices/laboratory-prices').then((m) => m.LaboratoryPrices),
  'administration/center-schedule': () =>
    import('../laboratory/center-schedule/center-schedule').then((m) => m.CenterSchedulePage),
  'administration/laboratory-branches': () =>
    import('../organization/organization-branches/organization-branches').then(
      (m) => m.OrganizationBranches,
    ),
};
