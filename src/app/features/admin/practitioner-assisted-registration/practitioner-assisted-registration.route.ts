import type { Route } from '@angular/router';

import { APP_TITLE } from '../../../core/navigation/navigation.types';
import { seccionRolesGuard } from '../../../core/navigation/section-roles.guard';
import { ErrorRecovery } from '../../error-recovery/error-recovery';

/**
 * Alta asistida de un médico por el administrador de seguridad.
 *
 * Cuelga de `administration/users` (M01 iam). Lleva `seccionRolesGuard` porque
 * `POST /iam/users/assisted-practitioner-registration` es sólo de
 * `SECURITY_ADMIN`: el guard no autoriza —la API sí—, evita mostrar una
 * pantalla que va a devolver 403.
 *
 * Vive en su propio archivo y no en `app.routes.ts` porque ese archivo tiene un
 * techo de líneas (`check-max-lines`) que no se sube.
 */
export const PRACTITIONER_ASSISTED_ROUTE: Route = {
  path: 'administration/users/practitioner',
  title: `${APP_TITLE} - Registrar médico`,
  canActivate: [seccionRolesGuard],
  loadComponent: () =>
    import('./practitioner-assisted-registration')
      .then((m) => m.PractitionerAssistedRegistration)
      // Mismo criterio que `chunkFallido` de `app.routes.ts`: si el fragmento no
      // se descarga se muestra la recuperación, que ofrece recargar.
      .catch(() => ErrorRecovery),
};
