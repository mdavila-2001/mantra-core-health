import type { Type } from '@angular/core';
import type { Route, Routes } from '@angular/router';

import { authGuard } from '../../core/auth/auth.guard';
import { seccionRolesGuard } from '../../core/navigation/section-roles.guard';
import { ROLES_ROUTE_DATA } from '../../core/navigation/navigation.types';
import { ROLES_INSIGHTS } from '../reporting/reporting-access';

/**
 * AloVida Insights como **portal propio**, bajo `/insights` y fuera del armazón
 * de administración (precedente: `/reports`).
 *
 * Los dos guards leen los roles escritos aquí, en `data`: la tarjeta del selector
 * y el menú son cortesía; quien escriba la dirección a mano se topa con este guard
 * primero y con la API después. `BUSINESS_ADMIN` no figura: es un portal de
 * plataforma, no de cada organización.
 *
 * Recibe `chunkFallido` en vez de importarlo porque vive en `app.routes.ts`
 * (mismo patrón que `publicPrescriptionShareRoutes`); así esta ruta no depende
 * del archivo que la contiene.
 */
export function insightsPortalRoute(chunkFallido: () => Type<unknown>): Route {
  return {
    path: 'insights',
    canActivate: [authGuard, seccionRolesGuard],
    data: { [ROLES_ROUTE_DATA]: ROLES_INSIGHTS },
    loadComponent: () =>
      import('./insights-shell').then((m) => m.InsightsShell).catch(() => chunkFallido()),
    loadChildren: () =>
      import('./insights.routes')
        .then((m) => m.INSIGHTS_RUTAS)
        .catch((): Routes => [{ path: '**', component: chunkFallido() }]),
  };
}
