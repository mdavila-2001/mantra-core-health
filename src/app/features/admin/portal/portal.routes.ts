import type { Routes } from '@angular/router';

import { APP_TITLE } from '../../../core/navigation/navigation.types';

/**
 * Las pantallas del portal, relativas a `superadmin/portal`. El marco las
 * contiene (`RUTAS_ANIDADAS['superadmin/portal']` en `app.routes.ts`); cada
 * una se descarga al entrar.
 */
export const PORTAL_RUTAS: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: `${APP_TITLE} - Centro del portal`,
    loadComponent: () => import('./hub/portal-hub').then((m) => m.PortalHub),
  },
];
