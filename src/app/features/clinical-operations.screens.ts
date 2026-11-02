import type { Type } from '@angular/core';

/**
 * Pantallas diferidas del ámbito clínico, agenda, operaciones y laboratorio.
 * Extraído para reducir la deuda de líneas en app.routes.ts (REFORMA LEAN <= 300).
 */
export const CLINICAL_OPERATIONS_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  schedule: () => import('./agenda/agenda').then((m) => m.Agenda),
  diagnostics: () => import('./diagnostics/diagnostics').then((m) => m.Diagnostics),
  interventions: () =>
    import('./interventions/interventions').then((m) => m.Interventions),
  'medical-records': () =>
    import('./clinical-record/clinical-record').then((m) => m.ClinicalRecord),
  'my-primary-patients': () =>
    import('./primary-practitioner/my-primary-patients/my-primary-patients').then(
      (m) => m.MyPrimaryPatients,
    ),
  'administration/my-practice': () =>
    import('./practice/my-practice/my-practice').then((m) => m.MyPractice),
  'my-support': () => import('./support-access/my-support/my-support').then((m) => m.MySupport),
  'combined-agenda': () =>
    import('./support-access/combined-agenda/combined-agenda').then((m) => m.CombinedAgenda),
  'support-inbox': () =>
    import('./support-access/support-inbox/support-inbox').then((m) => m.SupportInbox),
  'administration/delegated-access': () =>
    import('./delegated-access/delegated-access-home/delegated-access-home').then(
      (m) => m.DelegatedAccessHome,
    ),
  'administration/identity-providers': () =>
    import('./auth-providers/auth-providers-home/auth-providers-home').then(
      (m) => m.AuthProvidersHome,
    ),
  'administration/identity-assurance': () =>
    import('./identity-assurance/identity-admin-home/identity-admin-home').then(
      (m) => m.IdentityAdminHome,
    ),
  'administration/health-context': () =>
    import('./health-context/health-context-home/health-context-home').then(
      (m) => m.HealthContextHome,
    ),
  'administration/geolocation': () =>
    import('./geo/geo-home/geo-home').then((m) => m.GeoHome),
  'administration/services-catalog': () =>
    import('./admin/services-catalog/services-catalog').then((m) => m.ServicesCatalog),
  'my-services': () => import('./my-services/my-services').then((m) => m.MyServices),
  'my-quotations': () =>
    import('./quotations/quotation-list/quotation-list').then((m) => m.QuotationList),
  'my-medical-groups': () => import('./groups-hub/groups-hub').then((m) => m.GroupsHub),
  'administration/clinical-forms': () =>
    import('./admin/clinical-forms/clinical-forms').then((m) => m.ClinicalForms),
  questionnaires: () => import('./forms-hub/forms-hub').then((m) => m.FormsHub),
  'my-account/questionnaires': () =>
    import('./account/questionnaires/questionnaires').then((m) => m.Questionnaires),
  glossary: () => import('./glossary/glossary').then((m) => m.Glossary),
  'form-builder': () => import('./forms-hub/forms-hub').then((m) => m.FormsHub),
  'administration/pharma-lab': () =>
    import('./pharma-lab/pharma-lab-home/pharma-lab-home').then((m) => m.PharmaLabHome),
  'my-visits': () =>
    import('./pharma-lab/visitor-visits/visitor-visits').then((m) => m.VisitorVisits),
  'lab-visits': () =>
    import('./pharma-lab/doctor-visits/doctor-visits').then((m) => m.DoctorVisits),
  billing: () => import('./billing/billing').then((m) => m.Billing),
};
