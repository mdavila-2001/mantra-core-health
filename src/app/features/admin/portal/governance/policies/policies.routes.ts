import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../../core/navigation/navigation.types';

/**
 * Las pantallas de políticas y datos personales del grupo «Gobierno y acceso» del portal,
 * relativas a `superadmin/portal`. Se spreadean en `PORTAL_GOVERNANCE_ROUTES`; los roles los
 * hereda del marco y la API decide cada petición.
 */
export const PORTAL_POLICIES_ROUTES: Routes = [
  {
    path: 'governance/policies',
    title: `${APP_TITLE} - Políticas de gobierno`,
    loadComponent: () => import('./policies-page').then((m) => m.PoliciesPage),
  },
  {
    path: 'governance/policies/:id',
    title: `${APP_TITLE} - Política de gobierno`,
    loadComponent: () => import('./policy-detail-page').then((m) => m.PolicyDetailPage),
  },
  {
    path: 'governance/pii',
    title: `${APP_TITLE} - Datos personales`,
    loadComponent: () => import('../pii/pii-page').then((m) => m.PiiPage),
  },
];
