/**
 * Tipos de la vista para `medical-groups` (FT-21, carril 21). Espejan los DTOs
 * de `src/modules/medical_groups/dto/medical-groups.dto.ts` de la API; las
 * fechas viajan como ISO y el cliente las convierte a `Date`.
 */

/** Las tres pestañas que la API sabe listar. Los valores son los del contrato. */
export const MEDICAL_GROUP_TABS = ['historico', 'enviadas', 'recibidas'] as const;
export type MedicalGroupTab = (typeof MEDICAL_GROUP_TABS)[number];

/**
 * El ciclo de vida del grupo, tal como lo declara la API:
 * - `PENDING_TEAM`: hay invitaciones sin responder;
 * - `SCHEDULED`: el equipo está completo y hay fecha;
 * - `RESCHEDULE_PENDING`: alguien propuso otra fecha y falta que el creador la resuelva;
 * - `CLOSED`: pasó la semana posterior a la fecha y el expediente es inmutable.
 */
export type MedicalGroupStatus = 'PENDING_TEAM' | 'SCHEDULED' | 'RESCHEDULE_PENDING' | 'CLOSED';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** La respuesta a una invitación o a un cambio de horario. */
export type MedicalGroupDecision = 'ACCEPTED' | 'REJECTED';

export interface MedicalGroupMember {
  readonly id: string;
  readonly practitionerProfileId: string;
  /** `null` si la persona no tiene nombre cargado; nunca el id. */
  readonly practitionerName: string | null;
  readonly roleTitle: string;
  /** Monto decimal tal como lo guarda la API (`"1500.00"`). */
  readonly agreedPaymentAmount: string;
  readonly agreedPaymentCurrencyConceptId?: string;
  readonly additionalTermsText?: string;
  readonly isCreator: boolean;
  readonly invitationStatus: InvitationStatus;
  readonly respondedAt?: Date;
}

export interface MedicalGroup {
  readonly id: string;
  readonly serviceCatalogId: string;
  readonly serviceName: string | null;
  readonly requestingPractitionerId: string;
  /** La API manda `null` cuando no hay paciente: ausente y `null` dicen lo mismo. */
  readonly patientProfileId?: string | null;
  readonly patientName: string | null;
  readonly conditionId?: string | null;
  readonly scheduledAt: Date;
  readonly locationText: string;
  readonly notesText?: string;
  /** Los términos por defecto del servicio más los adicionales del solicitante. */
  readonly termsText: string;
  readonly status: MedicalGroupStatus;
  readonly exerciseNotesText?: string;
  readonly exerciseNotesUpdatedAt?: Date;
  readonly proposedRescheduleAt?: Date;
  readonly proposedByPractitionerId?: string;
  readonly isRealized: boolean;
  readonly canEditExerciseNotes: boolean;
  readonly isClosed: boolean;
  readonly createdAt: Date;
  readonly members: readonly MedicalGroupMember[];
}

export interface MedicalGroupListItem {
  readonly id: string;
  readonly serviceCatalogId: string;
  readonly serviceName: string | null;
  readonly scheduledAt: Date;
  readonly locationText: string;
  readonly status: MedicalGroupStatus;
  readonly isCreator: boolean;
  readonly patientProfileId?: string;
  readonly pendingMembersCount: number;
}

export interface MedicalGroupPage {
  readonly items: readonly MedicalGroupListItem[];
  readonly nextCursor: string | null;
}

/** Un diagnóstico del paciente para el selector del formulario. */
export interface MedicalGroupConditionOption {
  readonly id: string;
  readonly code: string;
  readonly display: string;
  readonly onsetAt?: Date;
  /** La API lo marca sólo cuando el último diagnóstico se puede determinar sin ambigüedad. */
  readonly isMostRecent: boolean;
}

/** Un colega que se puede invitar: de la misma organización que el servicio. */
export interface EligibleMember {
  readonly practitionerProfileId: string;
  readonly name: string | null;
}

export interface NewMedicalGroupMember {
  readonly practitionerProfileId: string;
  readonly roleTitle: string;
  /** Decimal positivo con hasta dos decimales, como string. */
  readonly agreedPaymentAmount: string;
  readonly additionalTermsText?: string;
}

export interface NewMedicalGroup {
  readonly serviceCatalogId: string;
  readonly patientProfileId?: string;
  readonly conditionId?: string;
  /** ISO 8601 con hora. */
  readonly scheduledAt: string;
  readonly locationText: string;
  readonly notesText?: string;
  readonly additionalTermsText?: string;
  readonly members: readonly NewMedicalGroupMember[];
}

/** Lo que el creador puede corregir de un grupo que todavía no se realizó. */
export interface UpdateMedicalGroup {
  readonly locationText?: string;
  /** Una cadena vacía borra las notas. */
  readonly notesText?: string;
}

/** Lo que se puede cambiar de un cargo; cambiarlo vuelve a pedirle respuesta al invitado. */
export interface UpdateMedicalGroupMember {
  readonly roleTitle?: string;
  readonly agreedPaymentAmount?: string;
  /** Una cadena vacía borra los términos del cargo. */
  readonly additionalTermsText?: string;
}
