import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type { MyOrganization } from '../../../core/data-access/directory/directory.types';
import { rolesAlcanzan } from '../../../core/navigation/navigation.types';
import { SECCION_DENEGADA_ROUTE } from '../../../core/navigation/section-roles.guard';
import { tracedGuard } from '../../../core/observability/routing/guard-tracing';

/**
 * Quién puede abrir el alta de sucursal y de membresía de una organización.
 *
 * ## Por qué no es `seccionRolesGuard`
 *
 * Esas dos rutas cuelgan de `administration/organizations`, cuya sección pide
 * `SECURITY_ADMIN`, y el guard de sección las cerraba a todo el resto. Pero la
 * API las abre a más gente: `POST /tenants/{id}/branches` y
 * `POST /tenants/{id}/memberships` llaman a
 * `TenantAdministrationService.assertCanAdminister`, que deja pasar a la
 * plataforma (`SECURITY_ADMIN`/`SUPERADMIN`) **y** al OWNER o ADMIN de esa
 * organización. Un guard no niega lo que la API permite: el dueño de una
 * clínica quedaba fuera de su propia alta de sucursal.
 *
 * ## Qué decide y qué no
 *
 * - Plataforma: pasa sin preguntar.
 * - Quien no tiene la organización en su sesión: no pasa — la API le
 *   respondería 403 de todos modos.
 * - Quien la tiene: pasa si `GET /tenants/me` dice `canAdminister`, que es la
 *   misma regla de la API dicha por la propia API. Un STAFF no pasa.
 * - Si esa lectura falla no se puede afirmar nada, y se deja pasar: la API
 *   sigue siendo la autoridad y el formulario muestra su 403 si llega.
 *
 * Ocultar o cerrar una ruta no es seguridad: es no ofrecer una puerta que va
 * a estar cerrada.
 */
export const organizacionAdministrableGuard: CanActivateFn = tracedGuard(
  'organizacionAdministrableGuard',
  (route) => {
    const session = inject(SessionStore);
    const router = inject(Router);
    const directory = inject(DirectoryClient);
    const denegado = router.createUrlTree([SECCION_DENEGADA_ROUTE]);

    if (rolesAlcanzan(['SECURITY_ADMIN'], session.roles())) {
      return true;
    }

    const tenantId = route.paramMap.get('tenantId') ?? '';
    if (tenantId === '' || !session.tenants().includes(tenantId)) {
      return denegado;
    }

    return directory.listMyOrganizations().pipe(
      map((organizaciones: readonly MyOrganization[]) =>
        organizaciones.some((o) => o.id === tenantId && o.canAdminister) ? true : denegado,
      ),
      catchError(() => of(true)),
    );
  },
);
