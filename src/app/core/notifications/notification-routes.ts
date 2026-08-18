import type { NotificationDestination } from '../data-access/notifications/notifications.types';

/* ============================================================================
    De un destino del backend a una ruta del router.

    El backend manda `(tipo, id)` y no conoce ninguna URL. Es la frontera
    correcta: cambiar la ruta del expediente no puede obligar a migrar filas de
    `messaging.in_app_notifications`, y una notificación guardada hace tres
    meses tiene que seguir abriendo lo que abría.

    Esta traducción vive en `core/` y no en la campana porque la usan dos
    pantallas —el panel del header y el centro— y una tercera la va a usar
    cuando P9 conecte «responder desde la notificación».
    ========================================================================== */

/**
 * Qué ruta abre cada clase de destino.
 *
 * `null` significa **no navegable todavía**: el tipo existe en el contrato
 * pero la pantalla que lo mostraría no está construida. Se declara
 * explícitamente en vez de omitirse para que agregar la pantalla sea cambiar
 * una línea de acá, y para que quien lea esta tabla vea de un vistazo qué
 * avisos son hoy sólo un cartel.
 */
const RUTAS: Readonly<Record<string, ((id: string) => string) | null>> = {
  // El expediente propio: la receta y la consulta viven ahí para el paciente.
  // No se navega al id concreto porque `my-account/medical-record` no acepta
  // parámetro; llevar a la pantalla correcta ya es infinitamente mejor que no
  // llevar a ninguna, y el día que acepte un ancla se cambia acá.
  PRESCRIPTION: () => '/my-account/medical-record',
  ENCOUNTER: () => '/my-account/medical-record',
  DIAGNOSTIC_REPORT: () => '/my-account/diagnostic-results',
  APPOINTMENT: () => '/my-account/appointments',
  // Mensajería directa (carril P2): el hilo abre por su id.
  CONVERSATION: (id) => `/messaging/${id}`,
  // El muro no tiene todavía pantalla de publicación suelta.
  POST: null,
};

/**
 * La ruta que abre una notificación, o `null` si no abre nada.
 *
 * Devolver `null` es deliberado y la campana lo respeta: una notificación no
 * navegable se pinta como texto y no como enlace. Fingir un enlace que no
 * lleva a ningún lado es peor que no ofrecerlo — quien lo toca cree que el
 * producto se rompió.
 *
 * @param destination - El par `(tipo, id)` que mandó el backend.
 * @returns La ruta absoluta, o `null`.
 */
export function rutaDeNotificacion(
  destination: NotificationDestination | undefined,
): string | null {
  if (!destination) {
    return null;
  }
  const constructor = RUTAS[destination.type];
  return constructor ? constructor(destination.id) : null;
}
