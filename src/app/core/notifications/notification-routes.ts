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
  // El pedido de farmacia (FAR-I2). La campana lleva directo al detalle
  // porque es donde vive la única decisión que el aviso puede estar pidiendo:
  // «te proponen un genérico» se responde ahí, no en la lista.
  PHARMACY_ORDER: (id) => `/my-account/pharmacy-orders/${id}`,
  // El comprobante interno de pago (FAR-I5). El id es el del pedido: cuando
  // el backend registre el pago y emita (FAR-E1/E4), su aviso ya abre el
  // comprobante — hoy la demo lo anuncia con un toast, porque inyectar
  // avisos locales sería tocar la campana por dentro.
  PHARMACY_RECEIPT: (id) => `/my-account/pharmacy-orders/${id}/receipt`,
  // Mensajería directa (carril P2). Con `?responder=1` (carril P9) el hilo
  // abre con el foco puesto en el textarea: llegar desde «te escribieron» y
  // tener que buscar dónde escribir rompe el gesto que la notificación empezó.
  CONVERSATION: (id) => `/messaging/${id}?responder=1`,
  // FT-07-R06: «un profesional pide ver tu historia clínica». La bandeja
  // lista todo lo pendiente, así que no hace falta el id para llegar a la
  // decisión — y la solicitud puede haber sido respondida ya desde otro aviso.
  CARE_RELATIONSHIP_REQUEST: () => '/my-account/access-requests',
  // «Alguien pide registrarte como su dependiente»: se acepta o rechaza en la
  // bandeja de la pantalla de Dependientes.
  DEPENDENT_LINK_REQUEST: () => '/my-account/dependents',
  // El muro no tiene todavía pantalla de publicación suelta.
  POST: null,
  // AG-06/AG-07 (BR-22): lo que en verdad emite la agenda
  // (`scheduling/notices/agenda-notices.ts`, `RECURSO_CITA`/`RECURSO_CUPO`),
  // no el `APPOINTMENT` aspiracional de arriba. Confirmación, recordatorio,
  // cancelación y cupo liberado abren todos la misma bandeja: es donde vive
  // la única decisión que cualquiera de esos avisos puede estar pidiendo.
  'scheduling.appointment_bookings': () => '/my-account/appointments',
  'scheduling.bookable_slots': () => '/my-account/appointments',
  // MCH-027: una orden de estudios que el médico dejó al paciente. No lleva al
  // id concreto por el mismo motivo que PRESCRIPTION/ENCOUNTER: la lista de
  // órdenes no acepta ancla todavía.
  SERVICE_REQUEST: () => '/my-account/diagnostic-orders',
  // Su médico la derivó (24/10/2026): el aviso abre la ficha del profesional
  // recomendado, donde reserva la cita de siempre.
  PRACTITIONER_PROFILE: (id) => `/directory/${id}`,
  // ORGANIZATION_PROFILE (derivación a una organización, 31/10/2026) no está
  // acá: su ruta no se arma con el id (el tenant) sino que la manda la API en
  // `payloadJson.route` — ver `organizationRoute`.
};

/**
 * La única forma de ruta que se acepta del aviso de una organización: su ficha
 * pública por slug (`/o/:slug`, `rutasDeFichasPublicas` en `app.routes.ts`).
 */
const ORGANIZATION_ROUTE = /^\/o\/[a-z0-9-]+$/;

/**
 * La ficha pública de la organización a la que derivaron a la persona.
 *
 * La API manda `payloadJson.route = '/o/{slug}'` sólo si la organización tiene
 * ficha pública activa. Se navega **únicamente** si la ruta tiene esa forma:
 * un `route` arbitrario en el payload no puede convertir la campana en un
 * redirector a cualquier lado.
 */
function organizationRoute(payloadJson: unknown): string | null {
  if (typeof payloadJson !== 'object' || payloadJson === null) return null;
  const route = (payloadJson as Record<string, unknown>)['route'];
  return typeof route === 'string' && ORGANIZATION_ROUTE.test(route) ? route : null;
}

/**
 * La ruta que abre una notificación, o `null` si no abre nada.
 *
 * Devolver `null` es deliberado y la campana lo respeta: una notificación no
 * navegable se pinta como texto y no como enlace. Fingir un enlace que no
 * lleva a ningún lado es peor que no ofrecerlo — quien lo toca cree que el
 * producto se rompió.
 *
 * @param destination - El par `(tipo, id)` que mandó el backend.
 * @param payloadJson - El payload del aviso: sólo lo lee un destino cuya ruta
 *   la manda la API (`ORGANIZATION_PROFILE`), y siempre contra una forma fija.
 * @returns La ruta absoluta, o `null`.
 */
export function rutaDeNotificacion(
  destination: NotificationDestination | undefined,
  payloadJson?: unknown,
): string | null {
  if (!destination) {
    return null;
  }
  if (destination.type === 'ORGANIZATION_PROFILE') {
    return organizationRoute(payloadJson);
  }
  const constructor = RUTAS[destination.type];
  return constructor ? constructor(destination.id) : null;
}
