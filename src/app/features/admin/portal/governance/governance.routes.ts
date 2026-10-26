import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../core/navigation/navigation.types';

/**
 * Las pantallas del grupo «Gobierno y acceso» del portal, relativas a
 * `superadmin/portal`. Las direcciones son las que declara `PORTAL_NAV`; los
 * roles los hereda del marco y la API decide cada petición.
 */
export const PORTAL_GOVERNANCE_ROUTES: Routes = [
  {
    path: 'governance/audit',
    title: `${APP_TITLE} - Auditoría`,
    loadComponent: () => import('./audit/audit-page').then((m) => m.AuditPage),
  },
  {
    path: 'governance/users',
    title: `${APP_TITLE} - Usuarios y roles`,
    loadComponent: () => import('./access/access-page').then((m) => m.AccessPage),
  },
  {
    path: 'governance/permission-drift',
    title: `${APP_TITLE} - Deriva de permisos`,
    loadComponent: () =>
      import('./permission-drift/permission-drift-page').then((m) => m.PermissionDriftPage),
  },
];
