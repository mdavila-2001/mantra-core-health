/**
 * Cómo la API lee cada asiento de auditoría como actividad (`ACTIVITY_KINDS` en
 * `delegated_access/domain/support-activity.ts`): el código que ve el cliente, el
 * asiento crudo, el recurso y, si es una acción de agenda, el permiso con el que se hizo.
 *
 * El simulador guarda el **código** del cliente; de ahí sale el resto. Los códigos que la
 * API no reconoce conservan su asiento tal cual (`auditAction`), y los eventos que solo
 * existen en el simulador usan un asiento inventado con el mismo patrón.
 */
export interface TipoDeActividad {
  readonly auditAction: string;
  readonly entity: string;
  readonly permission?: string;
}

const POR_CODIGO: Readonly<Record<string, TipoDeActividad>> = {
  'schedule.confirm': { auditAction: 'BOOKING_CONFIRMED', entity: 'booking', permission: 'schedule.confirm' },
  'schedule.cancel': { auditAction: 'BOOKING_CANCELLED', entity: 'booking', permission: 'schedule.cancel' },
  'schedule.reschedule': { auditAction: 'BOOKING_RESCHEDULED', entity: 'booking', permission: 'schedule.reschedule' },
  'schedule.check_in': { auditAction: 'BOOKING_CHECKED_IN', entity: 'booking', permission: 'schedule.check_in' },
  'schedule.create': { auditAction: 'DIRECT_APPOINTMENT_CREATED', entity: 'appointment', permission: 'schedule.create' },
  'schedule.walk_in': { auditAction: 'WALK_IN_APPOINTMENT_CREATED', entity: 'appointment', permission: 'schedule.walk_in' },
  'schedule.waitlist': { auditAction: 'WAITLIST_ENTRY_ENROLLED', entity: 'waitlist_entry', permission: 'schedule.waitlist' },
  'schedule.send_reminders': { auditAction: 'BOOKING_REMINDERS_SCHEDULED', entity: 'booking', permission: 'schedule.send_reminders' },
  'request.created': { auditAction: 'SUPPORT_ENGAGEMENT_REQUESTED', entity: 'engagement_request' },
  'request.decided': { auditAction: 'SUPPORT_ENGAGEMENT_REQUEST_DECIDED', entity: 'engagement_request' },
  'grant.created': { auditAction: 'SUPPORT_GRANT_CREATED', entity: 'support_scope_grant' },
  'grant.updated': { auditAction: 'SUPPORT_GRANT_UPDATED', entity: 'support_scope_grant' },
  'engagement.recertified': { auditAction: 'SUPPORT_ENGAGEMENT_RECERTIFIED', entity: 'organization_user_assignment' },
  'engagement.confirmed_by_person': { auditAction: 'SUPPORT_ENGAGEMENT_CONFIRMED_BY_PERSON', entity: 'organization_user_assignment' },
  'engagement.ended': { auditAction: 'SUPPORT_ENGAGEMENT_ENDED', entity: 'organization_user_assignment' },
  'invitation.redeemed': { auditAction: 'AFFILIATION_INVITATION_REDEEMED', entity: 'affiliation_invitation' },
  'delegate.accepted': { auditAction: 'SUPPORT_DELEGATE_ACCEPTED', entity: 'practitioner_delegate_assignment' },
  'clinical_access.requested': { auditAction: 'SUPPORT_CLINICAL_ACCESS_REQUESTED', entity: 'access_request' },
  'patient.search': { auditAction: 'SUPPORT_PATIENT_SEARCHED', entity: 'patient_profile' },
};

export function activityKindOf(code: string): TipoDeActividad {
  return POR_CODIGO[code] ?? { auditAction: code.toUpperCase().replace(/[.\s]+/g, '_'), entity: 'support' };
}
