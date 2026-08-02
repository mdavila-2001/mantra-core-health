import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { LOGIN_ROUTE } from '../http/auth.interceptor';
import { tracedGuard } from '../observability/routing/guard-tracing';
import { SessionStore } from './session.store';

/**
 * Ruta donde se elige organización cuando el token trae más de una.
 *
 * La pantalla la aporta J9; la constante vive acá porque es el guard quien
 * decide cuándo hace falta.
 */
export const TENANT_SELECTION_ROUTE = '/auth/organizacion';

/**
 * Autorización de ruta — el estado **S1** del contrato del M34.
 *
 * Corre **antes** de que la pantalla pida ningún dato sensible, que es la razón
 * de que S1 y S2 sean estados distintos: mostrar un esqueleto de contenido
 * mientras todavía no se sabe si la persona puede ver la sección ya insinúa que
 * hay algo que ver.
 *
 * Por eso decide solo con lo que hay en memoria —el token ya decodificado— y no
 * consulta a la API: una llamada acá volvería a mezclar autorizar con pedir.
 *
 * Tres caminos:
 * 1. sin sesión → al login;
 * 2. con sesión y varias organizaciones sin elegir → al selector;
 * 3. con sesión resuelta → pasa.
 */
export const authGuard: CanActivateFn = tracedGuard('authGuard', () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    return router.createUrlTree([LOGIN_ROUTE]);
  }

  if (session.needsTenantSelection()) {
    return router.createUrlTree([TENANT_SELECTION_ROUTE]);
  }

  return true;
});
