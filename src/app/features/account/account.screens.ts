import type { Type } from '@angular/core';

/**
 * Pantallas diferidas del módulo de «Mi cuenta» y autoservicio de paciente/usuario.
 * Desacopladas de app.routes.ts bajo la reforma estructural lean.
 */
export const ACCOUNT_SCREENS: Readonly<Record<string, () => Promise<Type<unknown>>>> = {
  'my-account': () => import('./my-account/my-account').then((m) => m.MyAccount),
  'my-account/dependents': () =>
    import('./dependents/dependents').then((m) => m.Dependents),
  'my-account/security': () =>
    import('./security/security').then((m) => m.AccountSecurity),
  'my-account/privacy': () =>
    import('./privacy/privacy').then((m) => m.AccountPrivacy),
  'my-account/appointments': () =>
    import('./appointments/appointments').then((m) => m.Appointments),
  'my-account/medical-record': () =>
    import('./medical-record/medical-record').then((m) => m.MedicalRecord),
  'my-account/diagnostic-results': () =>
    import('./diagnostic-results/diagnostic-results').then((m) => m.DiagnosticResults),
  'my-account/diagnostic-orders': () =>
    import('./diagnostic-orders/diagnostic-orders').then((m) => m.DiagnosticOrders),
  'my-account/quotations': () =>
    import('./quotations/quotations').then((m) => m.Quotations),
  'my-account/pharmacy-orders': () =>
    import('./pharmacy-orders/pharmacy-orders').then((m) => m.PharmacyOrders),
  'my-account/pharmacy': () =>
    import('./pharmacy/store-front/store-front').then((m) => m.StoreFront),
  'my-account/promotions': () =>
    import('./promotions/promotions').then((m) => m.Promotions),
  'my-account/spending': () =>
    import('./spending/spending').then((m) => m.Spending),
  'my-account/invoices': () =>
    import('./my-invoices/my-invoices').then((m) => m.MyInvoices),
  'my-account/requests': () =>
    import('./my-requests/my-requests').then((m) => m.MyRequests),
  'my-account/identity': () =>
    import('../identity-verification/identity-hub/identity-hub').then((m) => m.IdentityHub),
  'my-account/verifications': () =>
    import('./my-verifications/my-verifications').then((m) => m.MyVerifications),
  'my-account/identity/cases': () =>
    import('../identity-assurance/verification-cases/verification-cases').then(
      (m) => m.VerificationCases,
    ),
};
