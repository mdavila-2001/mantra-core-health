/**
 * Tipos de `medical_groups` (FT-21). Calcan los DTO de la API
 * (`medical-groups.dto.ts`): ni un campo más, ni uno menos.
 *
 * Las fechas viajan como texto ISO 8601 en los dos sentidos y así se quedan:
 * quien las pinta las convierte con `DatePipe`, y el formulario arma el texto
 * que la API valida con `IsDateString`.
 */

/** Las tres pestañas del listado: `GET /medical-groups?tab=`. */
export const MEDICAL_GROUP_TABS = ['historico', 'enviadas', 'recibidas'] as const;
export type MedicalGroupTab = (typeof MEDICAL_GROUP_TABS)[number];

/** El ciclo de vida del grupo, tal como lo declara la API. */
export const MEDICAL_GROUP_STATUSES = [
  'PENDING_TEAM',
  'SCHEDULED',
  'RESCHEDULE_PENDING',
  'CLOSED',
] as const;
export type MedicalGroupStatus = (typeof MEDICAL_GROUP_STATUSES)[number];

/** Estado de la invitación de un cargo. */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** La respuesta a una invitación o a un cambio de horario. */
export type MedicalGroupDecision = 'ACCEPTED' | 'REJECTED';

/** Un cargo del equipo, en la respuesta. */
export interface MedicalGroupMember {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly roleTitle: string;
  /** Importe como texto decimal (`"500.00"`): nunca se pasa por `number`. */
  readonly agreedPaymentAmount: string;
  readonly agreedPaymentCurrencyConceptId?: string;
  readonly additionalTermsText?: string;
  readonly isCreator: boolean;
  readonly invitationStatus: InvitationStatus;
  readonly respondedAt?: string;
}

/** La ficha completa de un grupo (`GET /medical-groups/:id` y todas las escrituras). */
export interface MedicalGroup {
  readonly id: string;
  readonly serviceCatalogId: string;
  readonly requestingPractitionerId: string;
  readonly patientProfileId?: string;
  readonly conditionId?: string;
  readonly scheduledAt: string;
  readonly locationText: string;
  readonly notesText?: string;
  readonly termsText: string;
  readonly status: MedicalGroupStatus;
  readonly exerciseNotesText?: string;
  readonly exerciseNotesUpdatedAt?: string;
  readonly proposedRescheduleAt?: string;
  readonly proposedByPractitionerId?: string;
  /** Derivado en el servidor: ya pasó la fecha de realización. */
  readonly isRealized: boolean;
  /** Derivado: todavía se pueden subir notas del procedimiento. */
  readonly canEditExerciseNotes: boolean;
  /** Derivado: pasó la ventana de una semana y el expediente es inmutable. */
  readonly isClosed: boolean;
  readonly createdAt: string;
  readonly members: readonly MedicalGroupMember[];
}

/** Una fila del listado. */
export interface MedicalGroupListItem {
  readonly id: string;
  readonly serviceCatalogId: string;
  readonly scheduledAt: string;
  readonly locationText: string;
  readonly status: MedicalGroupStatus;
  readonly isCreator: boolean;
  readonly patientProfileId?: string;
  /** Cuántos cargos siguen sin responder. */
  readonly pendingMembersCount: number;
}

/** Una página del listado: pagina por cursor y no devuelve total. */
export interface MedicalGroupPage {
  readonly items: readonly MedicalGroupListItem[];
  readonly nextCursor?: string | null;
}

/** Un diagnóstico del paciente para el selector del alta. */
export interface MedicalGroupConditionOption {
  readonly id: string;
  /** Código del catálogo (p. ej. CIE-10). */
  readonly code: string;
  readonly display: string;
  readonly onsetAt?: string;
  /** `true` en la más reciente: la que el formulario preselecciona. */
  readonly isMostRecent: boolean;
}

/** Un cargo a invitar en el alta. */
export interface NewMedicalGroupMember {
  readonly practitionerProfileId: string;
  /** Hasta 120 caracteres. */
  readonly roleTitle: string;
  /** Sin signo y con hasta dos decimales: `500` o `500.00`. */
  readonly agreedPaymentAmount: string;
  readonly agreedPaymentCurrencyConceptId?: string;
  /** Hasta 4000 caracteres. */
  readonly additionalTermsText?: string;
}

/** Cuerpo de `POST /medical-groups`. */
export interface NewMedicalGroup {
  readonly serviceCatalogId: string;
  readonly patientProfileId?: string;
  readonly conditionId?: string;
  readonly scheduledAt: string;
  /** Hasta 300 caracteres. */
  readonly locationText: string;
  /** Hasta 4000 caracteres. */
  readonly notesText?: string;
  /** Hasta 4000 caracteres. */
  readonly additionalTermsText?: string;
  /** El resto del equipo: quien crea se agrega solo como miembro aceptado. */
  readonly members: readonly NewMedicalGroupMember[];
}

/** Topes de longitud que valida la API (`@MaxLength`). */
export const MEDICAL_GROUP_LIMITS = {
  locationText: 300,
  notesText: 4000,
  additionalTermsText: 4000,
  roleTitle: 120,
  exerciseNotesText: 8000,
} as const;

/** Importe válido para la API: sin signo, hasta dos decimales. */
export const MEDICAL_GROUP_AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
