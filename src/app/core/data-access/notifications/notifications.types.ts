/* ============================================================================
    Los tipos de la campana (M35 `messaging`, carril P1).

    Viven en su propio cliente y no dentro de `community` porque son **otro
    backend**: `community.social_notifications` cuenta lo social —te siguieron,
    comentaron tu publicación— y `messaging.in_app_notifications` cuenta lo del
    producto —tu receta está lista, tenés un mensaje, tu turno cambió—.

    La campana muestra las dos. Fusionarlas es trabajo del cliente, no del
    servidor: unificar los backends esta semana habría sido reescribir dos
    módulos que ya funcionan para ahorrarle una llamada a una campanita.
    ========================================================================== */

/**
 * Las cuatro familias de aviso, tal como las declara el contrato del backend
 * (`messaging/notifications.contract.ts`).
 *
 * Es un set cerrado y no texto libre porque es **la unidad de preferencia**:
 * lo que se silencia es una categoría entera. Una categoría inventada sería
 * una que nadie puede silenciar.
 */
export type NotificationCategory =
  | 'CLINICAL'
  | 'SCHEDULING'
  | 'MESSAGES'
  | 'SOCIAL';

/** Qué clase de cosa abre una notificación al tocarla. */
export type NotificationDestinationType =
  | 'PRESCRIPTION'
  | 'ENCOUNTER'
  | 'CONVERSATION'
  | 'APPOINTMENT'
  | 'POST'
  | 'DIAGNOSTIC_REPORT'
  | 'DEPENDENT_LINK_REQUEST'
  | 'PHARMACY_ORDER'
  | 'CARE_RELATIONSHIP_REQUEST'
  /** MCH-027 (AG-06): una orden de estudios que el médico dejó al paciente. */
  | 'SERVICE_REQUEST'
  /** AG-06/AG-07: lo que la agenda emite de verdad (ver `notification-routes.ts`). */
  | 'scheduling.appointment_bookings'
  | 'scheduling.bookable_slots';

/**
 * A dónde lleva una notificación.
 *
 * El backend no conoce rutas —manda `(tipo, id)`— y la traducción a URL vive
 * en `notification-routes.ts`. Es la frontera correcta: cambiar una ruta del
 * router no puede obligar a migrar filas de una tabla.
 */
export interface NotificationDestination {
  readonly type: string;
  readonly id: string;
}

/** Una notificación de la bandeja in-app. */
export interface InAppNotification {
  readonly id: string;
  readonly category?: NotificationCategory;
  readonly subject?: string;
  readonly bodyText?: string;
  readonly destination?: NotificationDestination;
  readonly payloadJson?: unknown;
  readonly unread: boolean;
  readonly availableAt: Date;
  readonly readAt?: Date;
}

/**
 * Una página de la bandeja.
 *
 * `unreadCount` **no** es el total de la página: es cuántas sin leer tiene la
 * persona en total, y es el número del badge.
 */
export interface InAppNotificationPage {
  readonly items: readonly InAppNotification[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly unreadCount: number;
}

/** Filtros de `GET /notifications/me`. */
export interface MyNotificationsQuery {
  readonly unread?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Lo que devuelve marcar una sola como leída. */
export interface InAppReadResult {
  readonly id: string;
  readonly readAt: Date;
  readonly alreadyRead: boolean;
}

/** Lo que devuelve marcar toda la bandeja. */
export interface MarkAllReadResult {
  readonly marked: number;
  readonly unreadCount: number;
}

/* ============================================================================
    Carril P9 · preferencias de notificación
    ========================================================================== */

/**
 * Ventana de silencio, en `HH:mm`.
 *
 * **Viaja en UTC.** El backend la compara contra `getUTCHours()`, así que la
 * pantalla convierte lo que la persona escribe —hora local— antes de guardar y
 * de vuelta al leer. Hacerlo en el cliente es lo único posible hoy: el modelo
 * no guarda el huso horario de nadie.
 */
export interface QuietHours {
  readonly start: string;
  readonly end: string;
}

/** La decisión para una categoría. */
export interface CategoryPreference {
  readonly category: NotificationCategory;
  readonly optedIn: boolean;
}

/** Las preferencias in-app de una persona: siempre las cuatro categorías. */
export interface MyPreferences {
  readonly categories: readonly CategoryPreference[];
  readonly quietHours: QuietHours | null;
}

/**
 * Lo que se manda a guardar.
 *
 * `categories` es un reemplazo **por categoría**: lo que no viene no se toca.
 * `quietHours` ausente significa «no la toques»; `null`, «quitala».
 */
export interface UpdatePreferences {
  readonly categories?: readonly CategoryPreference[];
  readonly quietHours?: QuietHours | null;
}
