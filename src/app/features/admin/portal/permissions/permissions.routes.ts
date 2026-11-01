import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../../core/navigation/navigation.types';

/**
 * Las pantallas de gobierno de permisos (H5), relativas a `superadmin/portal`.
 * Los roles los hereda del marco y la API decide cada petición.
 *
 * Se registran junto a `PORTAL_GOVERNANCE_ROUTES` (el grupo «Gobierno y acceso»):
 * ver el informe de la tanda para las entradas de menú que les corresponden.
 */
export const PORTAL_PERMISSIONS_ROUTES: Routes = [
  {
    path: 'governance/roles',
    title: `${APP_TITLE} - Roles y permisos`,
    loadComponent: () => import('./roles/roles-page').then((m) => m.RolesPage),
  },
  {
    path: 'governance/field-permissions',
    title: `${APP_TITLE} - Permisos por campo y alcance`,
    loadComponent: () => import('./fields/field-permissions-page').then((m) => m.FieldPermissionsPage),
  },
  {
    path: 'governance/who-can',
    title: `${APP_TITLE} - Quién puede qué`,
    loadComponent: () => import('./who-can/who-can-page').then((m) => m.WhoCanPage),
  },
  {
    path: 'governance/access-reviews',
    title: `${APP_TITLE} - Ciclo de vida y revisión de accesos`,
    loadComponent: () => import('./reviews/access-reviews-page').then((m) => m.AccessReviewsPage),
  },
];
