import type { Type } from '@angular/core';

/**
 * Pantallas diferidas del módulo de seguros y aseguradoras.
 * Desacopladas de app.routes.ts bajo la reforma estructural lean.
 */
export const INSURANCE_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'administration/insurance': () =>
    import('./insurance-catalog/insurance-catalog').then((m) => m.InsuranceCatalog),
  'administration/brokers': () =>
    import('./broker-directory/broker-directory').then((m) => m.BrokerDirectory),
  'administration/insurance-claims': () =>
    import('./insurance-claims/insurance-claims').then((m) => m.InsuranceClaims),
  'administration/insurance-analytics': () =>
    import('./insurance-analytics/insurance-analytics').then((m) => m.InsuranceAnalytics),
  'administration/insurance-campaigns': () =>
    import('./insurance-campaigns/insurance-campaigns').then((m) => m.InsuranceCampaigns),
  'administration/received-claims': () =>
    import('./received-claims/received-claims').then((m) => m.ReceivedClaims),
  'administration/insurer-practitioner-requests': () =>
    import('./practitioner-requests/practitioner-requests').then(
      (m) => m.InsurerPractitionerRequests,
    ),
  'administration/insurance-patients': () =>
    import('./insurance-patients/insurance-patients').then((m) => m.InsurancePatients),
};
