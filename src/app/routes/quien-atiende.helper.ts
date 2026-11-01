import type { Routes } from '@angular/router';
import { ROLES_DE_QUIEN_ATIENDE } from '../core/navigation/navigation.map';
import { ROLES_ROUTE_DATA } from '../core/navigation/navigation.types';
import { seccionRolesGuard } from '../core/navigation/section-roles.guard';

/**
 * Secciones de «Mi cuenta» que sólo tienen sentido para quien atiende.
 */
export const SECCIONES_DE_QUIEN_ATIENDE: ReadonlySet<string> = new Set(['my-account/verifications']);

/** La declaración que cierra una hija de «Mi perfil» a quien atiende. */
export function soloDeQuienAtiende(): Pick<Routes[number], 'canActivate' | 'data'> {
  return {
    canActivate: [seccionRolesGuard],
    data: { [ROLES_ROUTE_DATA]: ROLES_DE_QUIEN_ATIENDE },
  };
}
