import type { Type } from '@angular/core';
import type { Route, Routes } from '@angular/router';

import { authGuard } from '../../core/auth/auth.guard';
import { APP_TITLE, ROLES_ROUTE_DATA } from '../../core/navigation/navigation.types';
import { seccionRolesGuard } from '../../core/navigation/section-roles.guard';
import { ROLES_ADMINISTRACION, ROLES_REPORTERIA } from './reporting-access';

/** A dónde van `/reports/**` cuando la maqueta de reportería está apagada: el panel de observabilidad. */
export const REPORTS_REDIRECT = '/superadmin/observability';

function redirigeTodo(destino: string): Routes {
  return [
    { path: '', pathMatch: 'full', redirectTo: destino },
    { path: '**', redirectTo: destino },
  ];
}

/**
 * Las rutas de la maqueta comercial de reportería (`/portal-selector`, `/reports`), detrás de la bandera
 * `environment.reportingMockEnabled`.
 *
 * - **Apagada** (por defecto): `/reports/**` redirige a `/superadmin/observability` y `/portal-selector` a `/`.
 *   La maqueta pinta datos de ejemplo y consulta rutas que la API no tiene (frente 01, D-01 a D-06).
 * - **Encendida**: las rutas de siempre, con `authGuard` y `seccionRolesGuard` sobre los roles escritos en `data`.
 *   Ocultar una tarjeta no es seguridad: quien escriba la dirección a mano se topa con este guard y con la API.
 *
 * Recibe `chunkFallido` en vez de importarlo porque vive en `app.routes.ts` (mismo patrón que `insightsPortalRoute`).
 */
export function mockRoutes(chunkFallido: () => Type<unknown>, encendida: boolean): Routes {
  if (!encendida) {
    // Con hijas y no con `redirectTo` en la propia ruta: así `/reports/**` entero (no sólo `/reports`) redirige, y la
    // ruta vieja sigue delante del armazón como lo estaba la real.
    return [
      { path: 'portal-selector', children: redirigeTodo('/') },
      { path: 'reports', children: redirigeTodo(REPORTS_REDIRECT) },
    ];
  }
  const selector: Route = {
    path: 'portal-selector',
    title: `${APP_TITLE} - Elegir portal`,
    canActivate: [authGuard, seccionRolesGuard],
    data: { [ROLES_ROUTE_DATA]: [...ROLES_ADMINISTRACION, ...ROLES_REPORTERIA] },
    loadComponent: () =>
      import('../portal-selector/portal-selector').then((m) => m.PortalSelector).catch(() => chunkFallido()),
  };
  const reportes: Route = {
    path: 'reports',
    canActivate: [authGuard, seccionRolesGuard],
    data: { [ROLES_ROUTE_DATA]: ROLES_REPORTERIA },
    loadChildren: () =>
      import('./reporting.routes')
        .then((m) => m.REPORTING_ROUTES)
        .catch((): Routes => [{ path: '**', component: chunkFallido() }]),
  };
  return [selector, reportes];
}
