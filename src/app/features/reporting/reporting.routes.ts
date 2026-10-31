import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';

import { VERTICALES } from '@core/data-access/reporting/reporting-labels';
import type { VerticalReporte } from '@core/data-access/reporting/reporting.types';
import { APP_TITLE } from '../../core/navigation/navigation.types';

/** La pestaña con la que abre el dashboard comercial. */
export const DEFAULT_TAB: VerticalReporte = 'resumen';

/**
 * Deja pasar solo una pestaña que existe.
 *
 * Una dirección con `:pestana` inventado (un favorito viejo, un error de
 * tipeo) no debe llegar a la pantalla ni mostrar una pestaña vacía: se manda a
 * la primera, que es donde cualquiera esperaría caer. Se valida en la ruta y no
 * en la pantalla para que el dashboard reciba siempre un valor del catálogo.
 */
export const validTabGuard: CanActivateFn = (route) => {
  const pestana = route.paramMap.get('pestana');
  const router = inject(Router);
  return (VERTICALES as readonly string[]).includes(pestana ?? '')
    ? true
    : router.createUrlTree(['/reports/commercial', DEFAULT_TAB]);
};

/**
 * Las rutas del portal de reportería, bajo `/reports`.
 *
 * Cuelgan de **su propio armazón** (`ReportingShell`) y no del `ShellLayout` de
 * la aplicación: el portal tiene su navegación, su conmutador de alcance y su
 * panel del asistente, y el menú de administración no le aporta nada.
 *
 * El acceso (`authGuard` + `seccionRolesGuard` con `ROLES_REPORTERIA`) se declara
 * en `app.routes.ts`, en la ruta padre que carga este árbol: cubre a todas las
 * hijas sin que ninguna tenga que acordarse.
 */
export const REPORTING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/reporting-shell').then((m) => m.ReportingShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: `${APP_TITLE} - Reportería`,
        loadComponent: () =>
          import('./pages/report-grid/report-grid').then((m) => m.ReportGrid),
      },
      {
        path: 'commercial',
        pathMatch: 'full',
        redirectTo: `commercial/${DEFAULT_TAB}`,
      },
      {
        path: 'commercial/:pestana',
        title: `${APP_TITLE} - Dashboard comercial`,
        canActivate: [validTabGuard],
        loadComponent: () =>
          import('./pages/commercial-dashboard/commercial-dashboard').then(
            (m) => m.CommercialDashboard,
          ),
      },
    ],
  },
];
