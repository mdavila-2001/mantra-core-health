import { inject } from '@angular/core';
import { map } from 'rxjs';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import {
  provideNotificationActionHandlers,
  type NotificationActionHandler,
} from '../../../core/notifications/notification-actions';

/** El tipo de destino de las notificaciones de «te quieren registrar como dependiente». */
export const DEPENDENT_LINK_REQUEST = 'DEPENDENT_LINK_REQUEST';

/** Las acciones que el servidor ofrece en esa notificación. */
export const DEPENDENT_LINK_ACTION = {
  accept: 'ACCEPT',
  reject: 'REJECT',
} as const;

/**
 * Qué hacen «Aceptar» y «Rechazar» sobre una solicitud de dependencia, sin
 * abrir la pantalla de Dependientes.
 *
 * Son las mismas llamadas que la bandeja de esa pantalla: decidir desde la
 * campana y decidir desde allá es un solo acto. El `id` del destino es el de la
 * solicitud.
 */
export function dependentLinkActionHandlers(): readonly NotificationActionHandler[] {
  const profiles = inject(ProfilesClient);
  return [
    {
      destinationType: DEPENDENT_LINK_REQUEST,
      key: DEPENDENT_LINK_ACTION.accept,
      run: (destino) =>
        profiles.acceptDependentLinkRequest(destino.id).pipe(
          map(() => ({
            message: 'Aceptó la solicitud: ya puede actuar por usted.',
            tone: 'success' as const,
          })),
        ),
    },
    {
      destinationType: DEPENDENT_LINK_REQUEST,
      key: DEPENDENT_LINK_ACTION.reject,
      run: (destino) =>
        profiles.rejectDependentLinkRequest(destino.id).pipe(
          map(() => ({ message: 'Rechazó la solicitud.', tone: 'info' as const })),
        ),
    },
  ];
}

/** Se registra una vez, en la configuración de la aplicación. */
export const provideDependentLinkNotificationActions = () =>
  provideNotificationActionHandlers(dependentLinkActionHandlers);
