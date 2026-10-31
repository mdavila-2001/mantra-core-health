import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../core/navigation/navigation.types';

/**
 * La pantalla «Mutabilidad de datos» del grupo «Gobierno y acceso» del portal, relativa a
 * `superadmin/portal`. Se spreadea en `PORTAL_GOVERNANCE_ROUTES`; los roles los hereda del marco
 * y la API decide cada petición (`GET /admin/governance/mutability`).
 */
export const PORTAL_MUTABILITY_ROUTES: Routes = [
  {
    path: 'governance/mutability',
    title: `${APP_TITLE} - Mutabilidad de datos`,
    loadComponent: () => import('./mutability-page').then((m) => m.MutabilityPage),
  },
];
