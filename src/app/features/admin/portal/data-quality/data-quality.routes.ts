import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../core/navigation/navigation.types';

/**
 * Las pantallas de calidad de datos y de solicitudes de privacidad, relativas a
 * `superadmin/portal`. Los roles los hereda el marco del portal y la API decide cada
 * petición: ocultar un botón no autoriza nada.
 */
export const PORTAL_DATA_QUALITY_ROUTES: Routes = [
  {
    path: 'data-quality/issues',
    title: `${APP_TITLE} - Incidencias de calidad de datos`,
    loadComponent: () => import('./issues/issues-page').then((m) => m.IssuesPage),
  },
  {
    path: 'data-quality/rules',
    title: `${APP_TITLE} - Reglas de calidad de datos`,
    loadComponent: () => import('./rules/rules-page').then((m) => m.RulesPage),
  },
  {
    path: 'data-quality/rules/:ruleId',
    title: `${APP_TITLE} - Regla de calidad de datos`,
    loadComponent: () => import('./rules/rule-detail-page').then((m) => m.RuleDetailPage),
  },
  {
    path: 'governance/privacy-requests',
    title: `${APP_TITLE} - Solicitudes de privacidad`,
    loadComponent: () => import('../privacy/privacy-requests-page').then((m) => m.PrivacyRequestsPage),
  },
  {
    path: 'governance/privacy-requests/:requestId',
    title: `${APP_TITLE} - Solicitud de privacidad`,
    loadComponent: () =>
      import('../privacy/privacy-request-detail-page').then((m) => m.PrivacyRequestDetailPage),
  },
];
