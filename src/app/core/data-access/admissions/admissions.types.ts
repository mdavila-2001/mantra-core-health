/* ============================================================================
    Admisiones: la solicitud con que alguien pide entrar a la plataforma y que
    una persona con rol de revisión resuelve, requisito por requisito.

    El primer tipo es `ALTA_DE_DOCTOR` (un médico que se registra). La bandeja
    es genérica a propósito: sumar otro tipo es agregar un código a
    {@link ADMISSION_TYPE_CODES} y su etiqueta, no rehacer la pantalla.

    ## Vocabulario

    Los códigos son estables y en inglés (`IN_REVIEW`); las etiquetas, en
    español, salen de {@link ADMISSION_STATUS_LABELS}. Una versión anterior del
    contrato hablaba en español (`EN_REVISION`): el cliente la normaliza en la
    frontera y el resto de la aplicación no la ve.

    Estos tipos siguen el contrato de `/admissions` (camelCase). Los `Wire*` son
    lo que viaja; los demás son lo que usan las pantallas, con las fechas ya
    convertidas.
    ========================================================================== */

/** Estados de una admisión. `EXPIRED` solo sale de `VERIFIED`; `ABANDONED`, de `INFO_REQUESTED`. */
export const ADMISSION_STATUS_CODES = [
  'SUBMITTED',
  'IN_REVIEW',
  'INFO_REQUESTED',
  'VERIFIED',
  'REJECTED',
  'SUSPENDED',
  'EXPIRED',
  'ABANDONED',
  'WITHDRAWN',
] as const;
export type AdmissionStatusCode = (typeof ADMISSION_STATUS_CODES)[number];

export const ADMISSION_STATUS_LABELS: Readonly<Record<AdmissionStatusCode, string>> = {
  SUBMITTED: 'Enviada',
  IN_REVIEW: 'En revisión',
  INFO_REQUESTED: 'Información requerida',
  VERIFIED: 'Verificada',
  REJECTED: 'Rechazada',
  SUSPENDED: 'Suspendida',
  EXPIRED: 'Verificación vencida',
  ABANDONED: 'Abandonada',
  WITHDRAWN: 'Retirada',
};

/** Tipos de admisión conocidos. La API puede publicar otros: se muestran por su etiqueta. */
export const ADMISSION_TYPE_CODES = ['ALTA_DE_DOCTOR'] as const;
export type AdmissionTypeCode = (typeof ADMISSION_TYPE_CODES)[number];

/** Un código de catálogo con su etiqueta en palabras. */
export interface AdmissionCoded {
  readonly code: string;
  readonly label: string;
}

/** Estado de un requisito. */
export const REQUIREMENT_STATUS_CODES = ['PENDING', 'VERIFIED', 'REJECTED', 'INFO_REQUIRED'] as const;
export type RequirementStatusCode = (typeof REQUIREMENT_STATUS_CODES)[number];

/** Lo que el revisor decide sobre un requisito. */
export type RequirementDecision = 'VERIFIED' | 'REJECTED' | 'INFO_REQUIRED';

/** Clase de ítem de la ficha del profesional a la que apunta un requisito. */
export type AdmissionItemType = 'LICENSE' | 'CREDENTIAL' | 'SPECIALTY';

/**
 * Fuentes de verificación. No hay un registro público con dirección estable
 * para todas: el revisor declara de dónde sacó el dato, y la dirección o el
 * número de comprobante es opcional.
 */
export const SOURCE_TYPE_CODES = [
  'MINSALUD_REGISTRY',
  'MEDICAL_COLLEGE',
  'SEDES',
  'SEGIP',
  'PROVIDED_DOCUMENT',
  'OTHER',
] as const;
export type SourceTypeCode = (typeof SOURCE_TYPE_CODES)[number];

export const SOURCE_TYPE_LABELS: Readonly<Record<SourceTypeCode, string>> = {
  MINSALUD_REGISTRY: 'Registro del Ministerio de Salud',
  MEDICAL_COLLEGE: 'Colegio Médico',
  SEDES: 'SEDES',
  SEGIP: 'SEGIP',
  PROVIDED_DOCUMENT: 'Documento aportado por el médico',
  OTHER: 'Otra fuente',
};

/**
 * Motivos de rechazo o de pedido de información (lista cerrada). El código
 * alimenta la estadística; el texto que ve el médico lo escribe el revisor.
 * No hay un código de «sospecha de fraude» a propósito: una sospecha va en la
 * nota interna, nunca en un código que el solicitante pueda leer.
 */
export const REASON_CODES = [
  'ILLEGIBLE',
  'EXPIRED_DOCUMENT',
  'NAME_MISMATCH',
  'NOT_IN_REGISTRY',
  'INCOMPLETE_DOCUMENT',
  'OTHER',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_CODE_LABELS: Readonly<Record<ReasonCode, string>> = {
  ILLEGIBLE: 'Ilegible o cortado',
  EXPIRED_DOCUMENT: 'Documento vencido',
  NAME_MISMATCH: 'El nombre no coincide',
  NOT_IN_REGISTRY: 'No figura en el registro',
  INCOMPLETE_DOCUMENT: 'Documento incompleto',
  OTHER: 'Otro motivo',
};

export interface AdmissionPractitioner {
  readonly id: string;
  readonly fullName: string;
  readonly profession: string;
  readonly maskedNationalId: string;
}

/** Contacto completo: sólo en el detalle. */
export interface AdmissionPractitionerContact extends AdmissionPractitioner {
  /** Documento completo: sólo lo ve quien revisa, en el detalle. */
  readonly nationalId: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly registeredAt: Date | null;
}

export interface AdmissionPerson {
  readonly id: string;
  readonly name: string;
}

export interface AdmissionItemsSummary {
  readonly licenses: number;
  readonly credentials: number;
  readonly specialties: number;
}

/** Avance de la revisión: cuántos requisitos hay y en qué estado. */
export interface RequirementsSummary {
  readonly total: number;
  readonly verified: number;
  readonly rejected: number;
  readonly pending: number;
}

export interface AdmissionSummary {
  readonly id: string;
  readonly type: AdmissionCoded;
  readonly status: AdmissionCoded;
  readonly practitioner: AdmissionPractitioner;
  readonly itemsSummary: AdmissionItemsSummary;
  readonly requirementsSummary: RequirementsSummary;
  readonly submittedAt: Date;
  readonly dueAt: Date | null;
  readonly overdue: boolean;
  readonly assignedTo: AdmissionPerson | null;
  readonly rowVersion: number;
}

export interface AdmissionPage {
  readonly items: readonly AdmissionSummary[];
  readonly nextCursor: string | null;
  /** Cuántas admisiones hay por estado (con los filtros que no son de estado). */
  readonly counts: Readonly<Record<string, number>>;
}

export interface AdmissionListQuery {
  readonly type?: string;
  readonly status?: string;
  /** Un id de persona, o `none` para las que nadie tomó. */
  readonly assignedTo?: string;
  readonly overdue?: boolean;
  /** Nombre, documento o matrícula. Con texto, la consulta va por `POST /admissions/search`. */
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly sort?: 'due_at';
}

export interface AdmissionLicense {
  readonly id: string;
  readonly number: string;
  readonly jurisdiction: string;
  readonly state: string;
  readonly fileId: string | null;
  readonly verifiedAt: Date | null;
  readonly rejectionReasonText: string | null;
}

export interface AdmissionCredential {
  readonly id: string;
  readonly title: string;
  readonly institution: string;
  readonly state: string;
  readonly fileId: string | null;
  readonly verifiedAt: Date | null;
  readonly rejectionReasonText: string | null;
}

export interface AdmissionSpecialty {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly supportingCredentialId: string | null;
}

/** Un documento que respalda un requisito. El contenido se pide por `fileId`. */
export interface RequirementDocument {
  readonly fileId: string;
  readonly name: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
}

/** Un dato cargado (no un archivo) que el revisor contrasta con su fuente. */
export interface RequirementDatum {
  readonly label: string;
  readonly value: string;
}

/** La fuente que el revisor declaró al verificar un requisito. */
export interface RequirementSource {
  readonly type: AdmissionCoded;
  /** Número de comprobante, nombre del documento o dirección web. Opcional. */
  readonly ref: string | null;
  readonly consultedAt: Date | null;
}

export interface AdmissionRequirement {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
  readonly mandatory: boolean;
  readonly status: RequirementStatusCode;
  readonly documents: readonly RequirementDocument[];
  readonly data: readonly RequirementDatum[];
  /** Ítem de la ficha al que corresponde (matrícula, título, especialidad). */
  readonly itemRef: { readonly type: AdmissionItemType; readonly id: string } | null;
  readonly source: RequirementSource | null;
  /**
   * La huella de lo que hay que mirar para decidir (los documentos y los
   * datos del requisito). Se manda al verificar: si el médico cambió algo
   * mientras tanto, la API responde 409 `ADMISSION_EVIDENCE_CHANGED`.
   */
  readonly evidenceSha256: string | null;
  readonly reasonCode: string | null;
  /** Lo que lee el médico. */
  readonly reasonText: string | null;
  /** Solo para el personal: el médico nunca la recibe. */
  readonly internalNote: string | null;
  readonly reviewedAt: Date | null;
  readonly reviewedBy: AdmissionPerson | null;
}

export interface AdmissionEvent {
  readonly id: string;
  readonly type: string;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
  readonly itemType: string | null;
  readonly itemId: string | null;
  readonly sourceLabel: string | null;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly internalNote: string | null;
  readonly actor: AdmissionPerson;
  readonly occurredAt: Date;
}

/**
 * Un documento subido por el médico, ya vinculado al requisito que respalda.
 * Es la lista plana que alimenta la galería de evidencia.
 */
export interface AdmissionDocument {
  readonly id: string;
  readonly requirementCode: string;
  readonly fileId: string;
  readonly name: string;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly uploadedAt: Date | null;
  readonly pages: number | null;
  readonly reviewState: RequirementStatusCode | null;
  /** Huella SHA-256 del contenido, tal como la API lo tiene hoy. */
  readonly evidenceSha256: string | null;
}

/** Un campo del formulario que el médico llenó al registrarse. */
export interface SubmittedFormField {
  readonly key: string;
  readonly label: string;
  /** `null` o vacío: el médico no lo declaró. */
  readonly value: string | null;
  readonly required: boolean;
  /** Requisito que verifica este campo, si lo hay. */
  readonly requirementCode: string | null;
  /** `COORDINATES`: el valor es «latitud, longitud» y se ofrece un enlace al mapa. */
  readonly kind: 'TEXT' | 'COORDINATES';
}

export interface SubmittedFormSection {
  readonly key: string;
  readonly title: string;
  readonly fields: readonly SubmittedFormField[];
}

/** Las acciones que el servidor admite para QUIEN pide, con el motivo si no. */
export const ADMISSION_ACTION_CODES = [
  'CLAIM',
  'RELEASE',
  'REASSIGN',
  'REQUEST_INFO',
  'REVIEW_REQUIREMENT',
  'DECIDE',
  'SUSPEND',
  'REINSTATE',
] as const;
export type AdmissionActionCode = (typeof ADMISSION_ACTION_CODES)[number];

export interface AdmissionAllowedAction {
  readonly code: AdmissionActionCode;
  readonly allowed: boolean;
  /** Por qué no: `FOUR_EYES`, `ROLE`, `STATE`, `NOT_ASSIGNED`… */
  readonly reasonCode?: string;
  /** Explicación lista para mostrar. */
  readonly message?: string;
}

export interface AdmissionDetail extends Omit<AdmissionSummary, 'practitioner'> {
  readonly practitioner: AdmissionPractitionerContact;
  readonly documents: readonly AdmissionDocument[];
  readonly submittedForm: readonly SubmittedFormSection[];
  readonly licenses: readonly AdmissionLicense[];
  readonly credentials: readonly AdmissionCredential[];
  readonly specialties: readonly AdmissionSpecialty[];
  readonly requirements: readonly AdmissionRequirement[];
  readonly events: readonly AdmissionEvent[];
  readonly infoRequestedText: string | null;
  readonly infoDueAt: Date | null;
  readonly decisionReasonText: string | null;
  /** Qué puede hacer QUIEN mira. Vacío: la pantalla decide por rol y estado. */
  readonly allowedActions: readonly AdmissionAllowedAction[];
  /** A quién se puede reasignar (solo para quien aprueba). */
  readonly assignableReviewers: readonly AdmissionPerson[];
}

/* ---- comandos ------------------------------------------------------------ */

export interface ClaimAdmissionCommand {
  readonly expectedRowVersion: number;
}

export interface ReleaseAdmissionCommand {
  readonly expectedRowVersion: number;
  readonly reason?: string;
}

export interface ReassignAdmissionCommand {
  readonly assigneeId: string;
  readonly reason?: string;
  readonly expectedRowVersion: number;
}

/** Un motivo estructurado: código + texto que ve el médico + nota que no ve. */
export interface StructuredReason {
  readonly reasonCode?: ReasonCode;
  readonly reason: string;
  readonly internalNote?: string;
}

export interface RequestInfoCommand extends StructuredReason {
  readonly expectedRowVersion: number;
}

/**
 * La decisión final no lleva ítems: el servidor lee las revisiones de cada
 * requisito y deriva el estado de la matrícula, los títulos y las especialidades.
 */
export interface AdmissionDecisionCommand {
  readonly decision: 'VERIFIED' | 'REJECTED';
  readonly reason?: string;
  readonly reasonCode?: ReasonCode;
  readonly internalNote?: string;
  readonly expectedRowVersion: number;
}

export interface SuspendCommand extends StructuredReason {
  readonly expectedRowVersion: number;
}

export interface ReinstateCommand {
  readonly reason: string;
  readonly expectedRowVersion: number;
}

/** `POST /admissions/:id/items/:itemId/review`. */
export interface RequirementReviewCommand {
  readonly decision: RequirementDecision;
  /** Al verificar: de dónde salió el dato. */
  readonly sourceType?: SourceTypeCode;
  readonly sourceRef?: string;
  /** Fecha de la consulta, `YYYY-MM-DD`. */
  readonly sourceConsultedAt?: string;
  /**
   * La huella de la evidencia que el revisor tenía en pantalla. Obligatoria al
   * verificar; opcional al rechazar o pedir información.
   */
  readonly evidenceSha256?: string;
  /** Al rechazar o pedir información. */
  readonly reasonCode?: ReasonCode;
  readonly reason?: string;
  readonly internalNote?: string;
  readonly expectedRowVersion: number;
}

export interface DocumentAccess {
  readonly url: string;
  readonly expiresAt: Date;
}

/* ---- lo que ve el propio médico ------------------------------------------- */

export interface MyAdmissionItem {
  readonly type: string;
  readonly id: string;
  readonly label: string;
  readonly state: string;
  readonly reasonText: string | null;
}

export interface MyAdmission {
  readonly id: string;
  readonly status: AdmissionCoded;
  readonly submittedAt: Date;
  readonly dueAt: Date | null;
  /** Hasta cuándo puede responder a un pedido de información. */
  readonly infoDueAt: Date | null;
  readonly infoRequestedText: string | null;
  readonly decisionReasonText: string | null;
  /** Reenvíos que le quedan; `null` si la API no pone tope. */
  readonly resubmissionsRemaining: number | null;
  readonly items: readonly MyAdmissionItem[];
}

export interface ResubmitCommand {
  /** «Declaro que los datos y documentos son verídicos». */
  readonly attested: true;
  readonly attestationVersion: string;
}

/** La versión del texto de atestación que se muestra en pantalla. */
export const ATTESTATION_VERSION = '2026-10';

/* ---- wire ----------------------------------------------------------------- */

type Iso = string;

export interface WireAdmissionSummary {
  readonly id: string;
  readonly type: AdmissionCoded;
  readonly status: AdmissionCoded;
  readonly practitioner: AdmissionPractitioner;
  readonly itemsSummary: AdmissionItemsSummary;
  /** Ausente en una API anterior a la lista de requisitos: se resume en cero. */
  readonly requirementsSummary?: RequirementsSummary;
  readonly submittedAt: Iso;
  readonly dueAt: Iso | null;
  readonly overdue: boolean;
  readonly assignedTo: AdmissionPerson | null;
  readonly rowVersion: number;
}

export interface WireAdmissionPage {
  readonly items: readonly WireAdmissionSummary[];
  readonly nextCursor: string | null;
  readonly counts: Readonly<Record<string, number>>;
}

export interface WireAdmissionDetail extends Omit<WireAdmissionSummary, 'practitioner'> {
  readonly practitioner: Omit<AdmissionPractitionerContact, 'registeredAt'> & {
    readonly registeredAt?: Iso | null;
  };
  readonly licenses: readonly (Omit<AdmissionLicense, 'verifiedAt'> & { readonly verifiedAt: Iso | null })[];
  readonly credentials: readonly (Omit<AdmissionCredential, 'verifiedAt'> & {
    readonly verifiedAt: Iso | null;
  })[];
  readonly specialties: readonly AdmissionSpecialty[];
  readonly requirements?: readonly (Omit<AdmissionRequirement, 'reviewedAt' | 'source' | 'evidenceSha256'> & {
    readonly evidenceSha256?: string | null;
    readonly reviewedAt: Iso | null;
    readonly source: (Omit<RequirementSource, 'consultedAt'> & { readonly consultedAt: Iso | null }) | null;
  })[];
  /** Ausentes en una API anterior: el cliente los deriva de los requisitos y la ficha. */
  readonly documents?: readonly (Omit<AdmissionDocument, 'uploadedAt' | 'evidenceSha256'> & {
    readonly uploadedAt: Iso | null;
    readonly evidenceSha256?: string | null;
  })[];
  readonly submittedForm?: readonly SubmittedFormSection[];
  readonly events: readonly (Omit<AdmissionEvent, 'occurredAt'> & { readonly occurredAt: Iso })[];
  readonly infoRequestedText: string | null;
  readonly infoDueAt?: Iso | null;
  readonly decisionReasonText: string | null;
  readonly allowedActions?: readonly AdmissionAllowedAction[];
  readonly assignableReviewers?: readonly AdmissionPerson[];
}

export interface WireMyAdmission {
  readonly id: string;
  readonly status: AdmissionCoded;
  readonly submittedAt: Iso;
  readonly dueAt: Iso | null;
  readonly infoDueAt?: Iso | null;
  readonly infoRequestedText: string | null;
  readonly decisionReasonText: string | null;
  readonly resubmissionsRemaining?: number | null;
  readonly items: readonly MyAdmissionItem[];
}

export interface WireDocumentAccess {
  readonly url: string;
  readonly expiresAt: Iso;
}
