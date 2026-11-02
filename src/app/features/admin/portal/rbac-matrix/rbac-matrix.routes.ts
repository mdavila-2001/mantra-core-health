import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../core/navigation/navigation.types';

/**
 * La matriz RBAC por módulo, relativa a `superadmin/portal`. Los roles los hereda el marco y la
 * API decide cada petición (`GET /authz/catalog/modules` es `SECURITY_ADMIN`).
 *
 * Se registra junto a `PORTAL_PERMISSIONS_ROUTES`:
 * `...PORTAL_RBAC_MATRIX_ROUTES` en `portal.routes.ts`, y la entrada de menú
 * `{ label: 'Matriz RBAC por módulo', path: 'governance/rbac-matrix', … }` en el grupo «Gobierno y acceso».
 */
export const PORTAL_RBAC_MATRIX_ROUTES: Routes = [
  {
    path: 'governance/rbac-matrix',
    title: `${APP_TITLE} - Matriz RBAC por módulo`,
    loadComponent: () => import('./rbac-matrix-page').then((m) => m.RbacMatrixPage),
  },
];
