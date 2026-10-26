import type { Route, Routes } from '@angular/router';
import type { Type } from '@angular/core';

import { seccionRolesGuard } from '../../../core/navigation/section-roles.guard';
import { APP_TITLE } from '../../../core/navigation/navigation.types';

/** Lo que `app.routes.ts` ya tiene y estas rutas reutilizan, sin importarlo de vuelta (evita un ciclo). */
export interface AffiliationRouteHelpers {
  /** La declaración que cierra una hija de «Mi perfil» a quien atiende (`soloDeQuienAtiende`). */
  readonly practitionerOnly: () => Pick<Route, 'canActivate' | 'data'>;
  /** El componente de recuperación cuando falla la descarga de un fragmento (`chunkFallido`). */
  readonly chunkFailed: () => Type<unknown>;
}

/**
 * Las pantallas de afiliación médico-centro (CM-07).
 *
 * - `my-account/affiliations` y `my-account/my-procedures` cuelgan de «Mi perfil»: se llega por los botones del
 *   perfil, no desde el menú, y sólo las abre quien atiende («Mi perfil» no declara roles, así que la restricción
 *   va en la ruta).
 * - `administration/my-organization/affiliations` cuelga de «Mi organización», que declara `ANY_ROLE`: el rol que
 *   importa es la membresía en la organización, que el guard no ve; la autoridad es la API.
 */
export function affiliationRoutes({ practitionerOnly, chunkFailed }: AffiliationRouteHelpers): Routes {
  return [
    {
      path: 'my-account/affiliations',
      title: `${APP_TITLE} - Invitaciones y solicitudes`,
      ...practitionerOnly(),
      loadComponent: () =>
        import('../../account/my-profile/affiliation-invitations/affiliation-invitations')
          .then((m) => m.AffiliationInvitations)
          .catch(() => chunkFailed()),
    },
    {
      path: 'my-account/my-procedures',
      title: `${APP_TITLE} - Procedimientos que hago`,
      ...practitionerOnly(),
      loadComponent: () =>
        import('../../account/my-profile/my-procedures/my-procedures')
          .then((m) => m.MyProcedures)
          .catch(() => chunkFailed()),
    },
    {
      path: 'administration/my-organization/affiliations',
      title: `${APP_TITLE} - Médicos del centro`,
      canActivate: [seccionRolesGuard],
      loadComponent: () =>
        import('./practitioner-affiliations')
          .then((m) => m.PractitionerAffiliations)
          .catch(() => chunkFailed()),
    },
  ];
}
