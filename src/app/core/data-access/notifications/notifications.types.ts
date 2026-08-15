/* ============================================================================
    Carril 18 — notificaciones del doctor: canales, preferencias y bandeja
    in-app propia. La entrega efectiva de un canal externo (WhatsApp/SMS/push)
    puede no estar configurada en este entorno; la preferencia se puede fijar
    igual — es la entrega, no la preferencia, la que reporta indisponibilidad.
    ========================================================================== */

/** Un canal disponible para configurar preferencia. */
export interface NotificationChannel {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly channelTypeConceptId: string;
}

/** Una preferencia ya declarada por el usuario. */
export interface NotificationPreference {
  readonly id: string;
  readonly channelId: string;
  readonly categoryConceptId?: string;
  readonly optedIn: boolean;
  readonly quietHoursJson?: { start?: string; end?: string };
}

/** Cuerpo de "fijar una preferencia". */
export interface SetPreferenceInput {
  readonly channelId: string;
  readonly categoryConceptId?: string;
  readonly optedIn: boolean;
  readonly quietHoursJson?: { start?: string; end?: string };
}

/** Una notificación in-app tal como la ve el destinatario. */
export interface MyInAppNotification {
  readonly id: string;
  readonly categoryConceptId?: string;
  readonly subject?: string;
  readonly bodyText?: string;
  readonly payloadJson?: unknown;
  readonly statusConceptId: string;
  readonly relatedResourceType?: string;
  readonly relatedResourceId?: string;
  readonly availableAt: Date;
  readonly readAt?: Date;
}
