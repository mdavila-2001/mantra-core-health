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

/**
 * Estado de una ficha (ítem) y de un documento: lo que el revisor decide.
 * El del requisito entero, que agrega varias fichas, es {@link RequirementStateCode}.
 */
export const REQUIREMENT_STATUS_CODES = ['PENDING', 'VERIFIED', 'REJECTED', 'INFO_REQUIRED'] as const;
export type RequirementStatusCode = (typeof REQUIREMENT_STATUS_CODES)[number];

/**
 * Estado del requisito completo, tal como lo evalúa la API: además de los de
 * una ficha puede no haberse aportado nada (`NOT_PROVIDED`, opcional) o faltar
 * lo mínimo (`MISSING`, obligatorio).
 */
export type RequirementStateCode = RequirementStatusCode | 'NOT_PROVIDED' | 'MISSING';

/** Lo que el revisor decide sobre una ficha. */
export type RequirementDecision = 'VERIFIED' | 'REJECTED' | 'INFO_REQUIRED';

/** Clase de ficha del profesional a la que apunta un ítem del checklist. */
export type AdmissionItemType = 'LICENSE' | 'CREDENTIAL' | 'SPECIALTY' | 'PROFILE';

/**
 * Fuentes de verificación. No hay un registro público con dirección estable
 * para todas: el revisor declara de dónde sacó el dato, y la dirección o el
 * número de comprobante es opcional.
 *
 * La API habla en español (`REGISTRO_MINSALUD`); el cliente traduce en la
 * frontera (`admissions.client.ts`) y el resto de la aplicación usa estos.
 */
export const SOURCE_TYPE_CODES = [
  'MINSALUD_REGISTRY',
  'MEDICAL_COLLEGE',
  'DENTAL_COLLEGE',
  'SEDES',
  'SEGIP',
  'PROVIDED_DOCUMENT',
  'OTHER',
] as const;
export type SourceTypeCode = (typeof SOURCE_TYPE_CODES)[number];

export const SOURCE_TYPE_LABELS: Readonly<Record<SourceTypeCode, string>> = {
  MINSALUD_REGISTRY: 'Registro del Ministerio de Salud',
  MEDICAL_COLLEGE: 'Colegio Médico',
  DENTAL_COLLEGE: 'Colegio de Odontólogos',
  SEDES: 'SEDES',
  SEGIP: 'SEGIP',
  PROVIDED_DOCUMENT: 'Documento aportado por el médico',
  OTHER: 'Otra fuente',
};

/**
 * Motivos de rechazo o de pedido de información (lista cerrada). El código
 * alimenta la estadística; el texto que ve el médico lo escribe el revisor.
 * `SUSPECTED_FRAUD` es solo del personal: la API se lo muestra al médico como
 * «Otro», y la sospecha se escribe en la nota interna, nunca en el texto que
 * el solicitante lee.
 */
export const REASON_CODES = [
  'ILLEGIBLE',
  'EXPIRED_DOCUMENT',
  'NAME_MISMATCH',
  'NOT_IN_REGISTRY',
  'INCOMPLETE_DOCUMENT',
  'SUSPECTED_FRAUD',
  'OTHER',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const REASON_CODE_LABELS: Readonly<Record<ReasonCode, string>> = {
  ILLEGIBLE: 'Ilegible o cortado',
  EXPIRED_DOCUMENT: 'Documento vencido',
  NAME_MISMATCH: 'El nombre no coincide',
  NOT_IN_REGISTRY: 'No figura en el registro',
  INCOMPLETE_DOCUMENT: 'Documento incompleto',
  SUSPECTED_FRAUD: 'Sospecha de fraude (solo el personal lo ve)',
  OTHER: 'Otro motivo',
};

/** Motivos que el médico no ve como tales. */
export const STAFF_ONLY_REASON_CODES: readonly ReasonCode[] = ['SUSPECTED_FRAUD'];

export interface AdmissionPractitioner {
  readonly id: string;
  readonly fullName: string;
  readonly profession: string | null;
  readonly maskedNationalId: string | null;
}

/** Datos completos: solo en el detalle, solo para quien revisa. */
export interface AdmissionPractitionerContact extends AdmissionPractitioner {
  readonly nationalId: string | null;
  readonly nationalIdIssuer: string | null;
  readonly birthDate: string | null;
  readonly age: number | null;
  readonly occupation: string | null;
  readonly personalMobile: string | null;
  readonly personalEmail: string | null;
  readonly workMobile: string | null;
  readonly workPhone: string | null;
  readonly workEmail: string | null;
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
  /** Un id de persona, `me` o `none` para las que nadie tomó. */
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
  readonly requirementCode: string;
  readonly number: string;
  readonly jurisdiction: string | null;
  readonly state: AdmissionCoded;
  readonly fileId: string | null;
  readonly verifiedAt: Date | null;
  readonly rejectionReasonText: string | null;
}

export interface AdmissionCredential {
  readonly id: string;
  readonly requirementCode: string;
  readonly level: string;
  readonly title: string | null;
  readonly institution: string | null;
  readonly state: AdmissionCoded;
  readonly fileId: string | null;
  readonly verifiedAt: Date | null;
  readonly rejectionReasonText: string | null;
}

export interface AdmissionSpecialty {
  readonly id: string;
  readonly requirementCode: string;
  readonly name: string | null;
  readonly state: AdmissionCoded;
  readonly supportingCredentialId: string | null;
}

/** La fuente que el revisor declaró al verificar una ficha. */
export interface RequirementSource {
  readonly type: AdmissionCoded;
  /** Número de comprobante, nombre del documento o dirección web. Opcional. */
  readonly ref: string | null;
  readonly consultedAt: Date | null;
}

/**
 * Una ficha concreta de un requisito (una matrícula, un título, una
 * especialidad o el perfil): lo que se verifica o se rechaza, una por una.
 */
export interface AdmissionReviewItem {
  /**
   * Id de la revisión: el `:itemId` de `.../items/:itemId/review`. Es `null`
   * hasta que alguien toma la admisión y se materializa.
   */
  readonly id: string | null;
  /** La ficha misma (matrícula, título…). */
  readonly itemId: string;
  readonly itemType: AdmissionItemType;
  readonly label: string;
  readonly state: RequirementStatusCode;
  readonly fileId: string | null;
  readonly source: RequirementSource | null;
  readonly reasonCode: string | null;
  /** Lo que lee el médico. */
  readonly reasonText: string | null;
  /** Solo para el personal: el médico nunca la recibe. */
  readonly internalNote: string | null;
  readonly reviewedBy: AdmissionPerson | null;
  readonly reviewedAt: Date | null;
  /** El dato o el archivo cambió después de revisarse: la revisión ya no vale. */
  readonly evidenceChanged: boolean;
  /**
   * La huella de lo que hay que mirar para decidir (el dato y el archivo de
   * hoy). Se devuelve al verificar: si el médico cambió algo mientras tanto,
   * la API responde 409 `ADMISSION_EVIDENCE_CHANGED`.
   */
  readonly evidenceSha256: string;
  /** Versión DE LA FICHA (no de la admisión): es el `expectedRowVersion` de su revisión. */
  readonly rowVersion: number | null;
}

export interface AdmissionRequirement {
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
  readonly mandatory: boolean;
  readonly evidenceKind: 'DOCUMENT' | 'DATA';
  /** Verificar una ficha de este requisito exige declarar la fuente. */
  readonly requiresSource: boolean;
  readonly minItems: number | null;
  readonly maxItems: number | null;
  readonly state: RequirementStateCode;
  readonly satisfied: boolean;
  /** Qué impide darlo por cumplido, si algo. */
  readonly blockedBy: string | null;
  readonly items: readonly AdmissionReviewItem[];
}

/** Por qué todavía no se puede verificar al profesional. */
export interface AdmissionBlocker {
  readonly requirementCode: string;
  readonly label: string;
  readonly reason: 'MISSING' | 'REJECTED' | 'PENDING' | 'INFO_REQUIRED' | 'BELOW_MINIMUM';
}

export interface AdmissionEvent {
  readonly id: string;
  readonly type: string;
  readonly fromStatus: AdmissionCoded | null;
  readonly toStatus: AdmissionCoded | null;
  readonly itemType: string | null;
  readonly itemId: string | null;
  readonly requirementCode: string | null;
  readonly sourceUri: string | null;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly actor: AdmissionPerson | null;
  readonly actorRole: string | null;
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
  /** Huella de la ficha a la que pertenece el archivo. */
  readonly evidenceSha256: string | null;
}

/** Un campo del formulario que el médico llenó al registrarse. */
export interface SubmittedFormField {
  readonly key: string;
  readonly label: string;
  /** `null` o vacío: el médico no lo declaró. */
  readonly value: string | null;
  /** Obligatorio si el requisito que lo respalda lo es. */
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

/** Acciones de la ficha: la API autoriza cada una; la pantalla solo decide si las ofrece. */
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

export interface AdmissionDetail extends Omit<AdmissionSummary, 'practitioner'> {
  readonly practitioner: AdmissionPractitionerContact;
  readonly documents: readonly AdmissionDocument[];
  readonly submittedForm: readonly SubmittedFormSection[];
  /** `SNAPSHOT`: foto tomada al enviar. `LIVE`: lectura viva del perfil (sin foto). */
  readonly submittedFormSource: 'SNAPSHOT' | 'LIVE';
  readonly licenses: readonly AdmissionLicense[];
  readonly credentials: readonly AdmissionCredential[];
  readonly specialties: readonly AdmissionSpecialty[];
  readonly requirements: readonly AdmissionRequirement[];
  readonly blockers: readonly AdmissionBlocker[];
  /** Hoy se podría resolver «verificada» (lo decide el servidor). */
  readonly canVerify: boolean;
  /** La configuración exige un aprobador distinto de quienes revisaron. */
  readonly fourEyesRequired: boolean;
  readonly events: readonly AdmissionEvent[];
  readonly infoRequestedText: string | null;
  readonly infoDueAt: Date | null;
  readonly decisionReasonText: string | null;
  readonly decisionReasonCode: string | null;
  /** Nota interna de la decisión: solo para el personal. */
  readonly internalNote: string | null;
  /** Hasta cuándo vale la verificación (`YYYY-MM-DD`, inclusive). */
  readonly validUntil: string | null;
  readonly resubmissionCount: number;
  readonly attestedAt: Date | null;
}

/* ---- comandos ------------------------------------------------------------ */

export interface ClaimAdmissionCommand {
  readonly expectedRowVersion: number;
}

export interface ReleaseAdmissionCommand {
  readonly expectedRowVersion: number;
}

export interface ReassignAdmissionCommand {
  /** Cuenta del revisor que recibe la admisión. */
  readonly toUserId: string;
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
 * ficha y deriva el estado de la matrícula, los títulos y las especialidades.
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
  /** Versión de la FICHA (`AdmissionReviewItem.rowVersion`), no de la admisión. */
  readonly expectedRowVersion: number;
}

/** La dirección firmada de un documento (2 minutos de vida, atada a quien la pidió). */
export interface DocumentAccess {
  readonly url: string;
  readonly expiresAt: Date;
  readonly name: string;
  readonly mimeType: string;
}

/* ---- lo que ve el propio médico ------------------------------------------- */

export interface MyAdmissionItem {
  readonly type: string;
  readonly id: string;
  readonly label: string;
  readonly state: string;
  readonly reasonText: string | null;
  readonly reasonCode: string | null;
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
  readonly validUntil: string | null;
  readonly items: readonly MyAdmissionItem[];
  readonly resubmissionCount: number;
  /** La API decide si puede reenviar (estado y tope de reenvíos). */
  readonly canResubmit: boolean;
  readonly canWithdraw: boolean;
}

/**
 * El reenvío lleva la atestación de quien lo hace. Se manda SOLO después de
 * que la persona marque «Declaro que los datos y documentos son verídicos»:
 * nunca `attested: true` por defecto.
 */
export interface ResubmitCommand {
  readonly attested: true;
  readonly attestationVersion: string;
}

/** La versión del texto de atestación que se muestra en pantalla y se manda al reenviar. */
export const ATTESTATION_VERSION = '2026-10';

/* ---- wire: el contrato real de la API (códigos en español) ------------------- */

type Iso = string;

export interface WireCoded {
  readonly code: string;
  readonly label: string;
}

export interface WireAdmissionSummary {
  readonly id: string;
  readonly type: WireCoded;
  readonly status: WireCoded;
  readonly practitioner: {
    readonly id: string;
    readonly fullName: string;
    readonly profession: string | null;
    readonly maskedNationalId: string | null;
  };
  readonly itemsSummary: AdmissionItemsSummary;
  readonly requirementsSummary: RequirementsSummary;
  readonly submittedAt: Iso;
  readonly dueAt: Iso;
  readonly overdue: boolean;
  readonly assignedTo: AdmissionPerson | null;
  readonly rowVersion: number;
}

export interface WireAdmissionPage {
  readonly items: readonly WireAdmissionSummary[];
  readonly nextCursor: string | null;
  readonly counts: Readonly<Record<string, number>>;
}

export interface WireReviewItem {
  readonly id: string | null;
  readonly itemId: string;
  readonly itemType: AdmissionItemType;
  readonly label: string;
  readonly state: string;
  readonly fileId: string | null;
  readonly verificationSourceUri: string | null;
  readonly sourceType: string | null;
  readonly sourceRef: string | null;
  readonly sourceConsultedAt: Iso | null;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly internalNote: string | null;
  readonly reviewedBy: AdmissionPerson | null;
  readonly reviewedAt: Iso | null;
  readonly evidenceChanged: boolean;
  readonly evidenceSha256: string;
  readonly rowVersion: number | null;
}

export interface WireRequirement {
  readonly code: string;
  readonly label: string;
  readonly description: string | null;
  readonly required: boolean;
  readonly evidenceKind: string;
  readonly requiresSource: boolean;
  readonly professionGroup: string | null;
  readonly minItems: number | null;
  readonly maxItems: number | null;
  readonly state: string;
  readonly satisfied: boolean;
  readonly blockedBy: string | null;
  readonly items: readonly WireReviewItem[];
}

export interface WireDocument {
  readonly id: string;
  readonly requirementCode: string;
  readonly fileId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedAt: Iso;
  readonly pages: number | null;
  readonly reviewState: string;
  readonly evidenceSha256: string;
}

export interface WireEvent {
  readonly id: string;
  readonly type: string;
  readonly fromStatus: WireCoded | null;
  readonly toStatus: WireCoded | null;
  readonly itemType: string | null;
  readonly itemId: string | null;
  readonly requirementCode: string | null;
  readonly verificationSourceUri: string | null;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly actor: AdmissionPerson | null;
  readonly actorRole: string | null;
  readonly occurredAt: Iso;
}

interface WireAddress {
  readonly lines: string | null;
  readonly locality: string | null;
  readonly department: string | null;
  readonly gps: { readonly lat: number; readonly lng: number } | null;
}

/** El formulario tal como lo envió el médico (`submittedForm` del detalle). */
export interface WireSubmittedForm {
  readonly personal: {
    readonly requirementCode: string;
    readonly firstName: string | null;
    readonly middleName: string | null;
    readonly paternalLastName: string | null;
    readonly maternalLastName: string | null;
    readonly nationalId: string | null;
    readonly nationalIdIssuer: string | null;
    readonly birthDate: string | null;
    readonly age: number | null;
    readonly occupation: string | null;
  };
  readonly contact: {
    readonly personalMobile: string | null;
    readonly personalEmail: string | null;
    readonly workMobile: string | null;
    readonly workPhone: string | null;
    readonly workEmail: string | null;
  };
  readonly addresses: { readonly home: WireAddress | null; readonly work: WireAddress | null };
  readonly licenses: readonly {
    readonly id: string;
    readonly requirementCode: string;
    readonly number: string;
    readonly jurisdiction: string | null;
    readonly authority: string | null;
    readonly validFrom: string | null;
    readonly validTo: string | null;
    readonly fileId: string | null;
  }[];
  readonly education: readonly {
    readonly id: string;
    readonly requirementCode: string;
    readonly level: string;
    readonly title: string | null;
    readonly institution: string | null;
    readonly year: number | null;
    readonly number: string;
    readonly fileId: string | null;
  }[];
  readonly specialties: readonly {
    readonly id: string;
    readonly requirementCode: string;
    readonly name: string | null;
    readonly isPrimary: boolean;
    readonly supportingCredentialId: string | null;
  }[];
  readonly practices: readonly {
    readonly id: string;
    readonly requirementCode: string;
    readonly name: string;
    readonly address: string | null;
    readonly gps: { readonly lat: number; readonly lng: number } | null;
  }[];
}

export interface WireAdmissionDetail extends Omit<WireAdmissionSummary, 'practitioner'> {
  readonly practitioner: WireAdmissionSummary['practitioner'] & {
    readonly nationalId: string | null;
    readonly nationalIdIssuer: string | null;
    readonly birthDate: string | null;
    readonly age: number | null;
    readonly occupation: string | null;
    readonly personalMobile: string | null;
    readonly personalEmail: string | null;
    readonly workMobile: string | null;
    readonly workPhone: string | null;
    readonly workEmail: string | null;
  };
  readonly licenses: readonly {
    readonly id: string;
    readonly requirementCode: string;
    readonly number: string;
    readonly jurisdiction: string | null;
    readonly state: WireCoded;
    readonly fileId: string | null;
    readonly verifiedAt: Iso | null;
    readonly verificationSourceUri: string | null;
    readonly rejectionReasonText: string | null;
  }[];
  readonly credentials: readonly {
    readonly id: string;
    readonly requirementCode: string;
    readonly level: string;
    readonly title: string | null;
    readonly institution: string | null;
    readonly state: WireCoded;
    readonly fileId: string | null;
    readonly verifiedAt: Iso | null;
    readonly verificationSourceUri: string | null;
    readonly rejectionReasonText: string | null;
  }[];
  readonly specialties: readonly {
    readonly id: string;
    readonly requirementCode: string;
    readonly name: string | null;
    readonly state: WireCoded;
    readonly supportingCredentialId: string | null;
  }[];
  readonly events: readonly WireEvent[];
  readonly infoRequestedText: string | null;
  readonly infoDueAt: Iso | null;
  readonly decisionReasonText: string | null;
  readonly decisionReasonCode: string | null;
  readonly internalNote: string | null;
  readonly validUntil: string | null;
  readonly resubmissionCount: number;
  readonly attestedAt: Iso | null;
  readonly fourEyesRequired: boolean;
  readonly requirements: readonly WireRequirement[];
  readonly blockers: readonly AdmissionBlocker[];
  readonly canVerify: boolean;
  readonly documents: readonly WireDocument[];
  readonly submittedForm: WireSubmittedForm;
  readonly submittedFormSource: string;
}

export interface WireMyAdmission {
  readonly id: string;
  readonly status: WireCoded;
  readonly submittedAt: Iso;
  readonly dueAt: Iso;
  readonly infoRequestedText: string | null;
  readonly infoDueAt: Iso | null;
  readonly decisionReasonText: string | null;
  readonly validUntil: string | null;
  readonly items: readonly {
    readonly type: string;
    readonly id: string;
    readonly label: string;
    readonly state: string;
    readonly reasonText: string | null;
    readonly reasonCode: string | null;
  }[];
  readonly resubmissionCount: number;
  readonly canResubmit: boolean;
  readonly canWithdraw: boolean;
}

export interface WireDocumentAccess {
  readonly url: string;
  readonly expiresAt: Iso;
  readonly name: string;
  readonly mimeType: string;
}
