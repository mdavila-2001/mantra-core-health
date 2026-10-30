import type { Type } from '@angular/core';
import type { Routes } from '@angular/router';

import { seccionRolesGuard } from '../../core/navigation/section-roles.guard';
import { APP_TITLE } from '../../core/navigation/navigation.types';

/**
 * La dirección a la que lleva `/rx/:token` (FAR-01) con sesión de farmacia:
 * `PHARMACY_OPEN_PRESCRIPTION_ROUTE` de `prescription-share.paths.ts` más el
 * token. La prueba de rutas fija que las dos digan lo mismo.
 */
export const OPEN_PRESCRIPTION_PATH = 'administration/pharmacy-orders/rx/:token';

/**
 * «Abrir receta» de la farmacia (FAR-02, REQ-FAR-02-008).
 *
 * Hija de la bandeja (`administration/pharmacy-orders`), dentro del armazón
 * con sesión. Lleva `seccionRolesGuard` como el detalle de mostrador: la
 * sección es solo de organizaciones `PHARMACY` y el guard la cierra por
 * prefijo a quien no lo es (S1 antes de pedir nada). No pisa a
 * `administration/pharmacy-orders/:orderId`: tiene un segmento más.
 *
 * @param chunkFailed - El componente de recuperación cuando falla la descarga
 *   de un fragmento (`chunkFallido` de `app.routes.ts`, que no se importa de
 *   vuelta para no armar un ciclo).
 */
export function prescriptionDispenseRoutes(chunkFailed: () => Type<unknown>): Routes {
  return [
    {
      path: OPEN_PRESCRIPTION_PATH,
      title: `${APP_TITLE} - Abrir receta`,
      canActivate: [seccionRolesGuard],
      loadComponent: () =>
        import('./open-prescription/open-prescription')
          .then((m) => m.OpenPrescription)
          .catch(() => chunkFailed()),
    },
  ];
}
