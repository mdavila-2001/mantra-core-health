import type { DelegateReplyDisclosure } from './support-access.types';

/**
 * Tipos de la **bandeja de chat compartida** del personal de apoyo: la lista,
 * una conversación con la autora real, la asignación («Tomar», «Derivar»,
 * «Resolver»), las notas internas y las plantillas de respuesta. Las formas son las
 * de la API (`community/dto/support-inbox.dto.ts`).
 *
 * **Dos perfiles del doctor, que no se confunden.** `practitionerProfileId` es su perfil
 * **profesional** (el de los filtros y la asignación); `doctorPublicProfileId` es su perfil
 * **de chat**, y es el único que sirve como remitente al responder en su nombre
 * (`senderProfileId` y `onBehalfOfProfileId`): con el profesional, el envío falla porque
 * quien manda no es participante de la conversación.
 *
 * El front no autoriza: `replyAllowed`, `assignedToMe` e `isClinical` son lo que
 * la API ya resolvió, y la pantalla los pinta sin recalcularlos.
 */

/**
 * El texto con que la API **reemplaza** un contenido clínico que esta persona no puede leer
 * (`CLINICAL_CONTENT_HIDDEN_TEXT`). Sale en `bodyText` de un mensaje con `contentHidden: true` y,
 * en la lista, en `lastPatientMessage` y `lastMessagePreview`. Se reconoce por el prefijo: la
 * pantalla no lo imprime, lo cambia por un estado visible («Contenido clínico oculto»).
 */
export const CLINICAL_CONTENT_HIDDEN_TEXT =
  'Contenido clínico oculto: requiere acceso clínico temporal aprobado.';

/** Si un texto de la lista (`lastPatientMessage`, `lastMessagePreview`) es el marcador de contenido clínico oculto. */
export function isHiddenClinicalPreview(text: string | undefined): boolean {
  return text !== undefined && text.trim().startsWith('Contenido clínico oculto');
}

export type ConversationAssignmentStatus = 'NEW' | 'TAKEN' | 'WAITING_DOCTOR' | 'RESOLVED';

export interface SupportInboxQuery {
  readonly status?: ConversationAssignmentStatus;
  /** `practitioner_profile_id` del doctor. */
  readonly doctor?: string;
  /**
   * Organización (tenant) de la que se pide la bandeja. Sin ella, la API junta las
   * organizaciones donde la persona tiene un vínculo vivo; con ella, la acota y la aísla:
   * nunca devuelve conversaciones de una organización donde no hay vínculo (403
   * `SUPPORT_INBOX_NO_ENGAGEMENT`, o `SUPPORT_INBOX_NO_REPLY_PERMISSION` si el vínculo no
   * incluye responder).
   */
  readonly org?: string;
}

/** Un doctor cuyas conversaciones puede ver la persona, en el mismo orden que su agenda combinada. */
export interface SupportInboxDoctor {
  /** El id del doctor en la agenda (`practitioner_role_assignment_id`): el de `SupportAgendaDoctor.id`. */
  readonly id: string;
  /** El perfil **profesional** del doctor: el de los filtros. */
  readonly practitionerProfileId: string;
  readonly name: string;
  /** Lo mismo que `name`: la API lo manda con los dos nombres. */
  readonly displayName?: string;
  readonly specialty: string;
}

export interface SupportInboxItem {
  readonly conversationId: string;
  /** La organización: la API la manda como `tenantId` y como `organizationId` (el mismo valor). */
  readonly tenantId?: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly practitionerProfileId: string;
  readonly practitionerName: string;
  /** El perfil **de chat** del doctor: el remitente al responder en su nombre. */
  readonly doctorPublicProfileId: string;
  /** Solo el nombre público del paciente: ya no trae el documento. */
  readonly patientLabel: string;
  /**
   * Lo último que escribió el paciente, recortado: lo que hay que contestar. Si parece clínico
   * la API manda {@link CLINICAL_CONTENT_HIDDEN_TEXT} en lugar del texto (en este campo y en
   * `lastMessagePreview`): la lista dice «Contenido clínico oculto» y no lo muestra.
   */
  readonly lastPatientMessage?: string;
  readonly lastMessagePreview: string;
  readonly lastMessageAt: string;
  readonly status: ConversationAssignmentStatus;
  readonly assignedUserId?: string;
  readonly assignedToName?: string;
  /** Lo resuelve la API: el front no compara identificadores de usuario. */
  readonly assignedToMe: boolean;
  /** Hasta cuándo debería tener respuesta (`sla_due_at`). Ausente en lo resuelto. */
  readonly slaDueAt?: string;
  /** Lo detecta la API: el último mensaje abierto del paciente habla de salud. */
  readonly isClinical: boolean;
  /**
   * `true` si la API **retuvo** la vista previa y solo entrega metadatos (SEG A-A4): quien escribe no es paciente de la agenda del doctor
   * y el equipo aún no tomó la conversación como administrativa. El texto se lee abriendo la conversación (`lastMessagePreview` viene
   * vacío o genérico). Ausente cuando la vista previa es real.
   */
  readonly previewHidden?: boolean;
  /**
   * `'RESERVED'` si la conversación es de un paciente reservado (VIP, confidencial…): sale como bloque «Reservado», sin nombre ni
   * texto, y **no dice por qué** (solo «¿Por qué no puedo?» lo explica). Ausente en lo demás.
   */
  readonly denialReason?: string;
}

export interface SupportInboxPage {
  readonly items: readonly SupportInboxItem[];
  /** Los doctores cubiertos, en el mismo orden que en la agenda: de ahí sale su color. */
  readonly doctors: readonly SupportInboxDoctor[];
  readonly count?: number;
}

/**
 * Lo que se manda a `POST …/assignment`. La API acepta la forma corta `{ practitionerProfileId?,
 * assignedUserId?, status }` (sin `assignedUserId` asigna a quien pide) o la explícita
 * `{ action: TAKE | ASSIGN | SET_STATUS, … }`. Sin estado y sin acción, 422
 * `CONVERSATION_STATUS_REQUIRED`.
 */
export interface ConversationAssignmentChange {
  readonly practitionerProfileId?: string;
  /** Sin él, la API asigna a quien hace la petición («Tomar»). */
  readonly assignedUserId?: string;
  readonly status: ConversationAssignmentStatus;
}

export interface ConversationAssignment {
  readonly conversationId: string;
  readonly status: ConversationAssignmentStatus;
  readonly assignedUserId?: string;
  readonly assignedToName?: string;
  readonly slaDueAt?: string;
  /** `true` si se derivó al doctor por parecer clínica. */
  readonly referredToDoctor?: boolean;
}

export interface NewInternalNote {
  readonly bodyText: string;
}

/** Una nota interna: el paciente **nunca** la ve, ni el doctor en su chat. */
export interface InternalNote {
  readonly id: string;
  readonly conversationId: string;
  readonly authorName: string;
  readonly bodyText: string;
  readonly createdAt: string;
}

/** Un mensaje de la conversación, tal como lo ve el **equipo** (con la autora real). */
export interface SupportConversationMessage {
  readonly id: string;
  /** `PATIENT` escribió el paciente; `DOCTOR_SIDE`, el doctor o alguien de su equipo en su nombre. */
  readonly from: 'PATIENT' | 'DOCTOR_SIDE';
  readonly bodyText: string;
  readonly sentAt: string;
  /** La API lo detectó como clínico (paciente), o su texto está oculto por serlo. */
  readonly isClinical: boolean;
  /**
   * `true` cuando `bodyText` es el marcador {@link CLINICAL_CONTENT_HIDDEN_TEXT} y no el texto real:
   * los mensajes que escribió el propio doctor y los clínicos del paciente salen así mientras
   * `patientContext.clinicalAccess` no sea `APPROVED`. Lo administrativo y lo que escribió el
   * equipo en nombre del doctor se leen siempre.
   */
  readonly contentHidden?: boolean;
  /** La autora real, cuando respondió el equipo en nombre del doctor. Solo el equipo la ve. */
  readonly authoredByName?: string;
  /** Si el paciente ve «respondido por su equipo» en este mensaje. */
  readonly disclosureShown?: boolean;
}

/** El cuerpo de `POST /me/support-access-requests`: quién pide, a qué doctor, de qué paciente y para qué. */
export interface NewClinicalAccessRequest {
  readonly tenantId: string;
  /** El doctor que decide (su perfil profesional). */
  readonly practitionerProfileId: string;
  readonly patientProfileId: string;
  readonly encounterId?: string;
  /** Entre 5 y 1000 caracteres: el doctor lo lee antes de decidir. */
  readonly reasonText: string;
}

export type ClinicalAccessState = 'NONE' | 'PENDING' | 'APPROVED';

/** Lo que la persona puede saber del paciente: por defecto solo el motivo de consulta. */
export interface SupportPatientContext {
  readonly reasonLabel?: string;
  readonly clinicalAccess: ClinicalAccessState;
  /** `practitioner_delegate_assignment_id`: con él se pide el acceso clínico temporal. */
  readonly delegateId?: string;
  readonly patientProfileId?: string;
  readonly requestedPermissionId?: string;
}

/** Una conversación abierta en la bandeja. **Propuesta**: `GET /me/support-inbox/:conversationId`. */
export interface SupportConversation {
  readonly conversationId: string;
  /** La organización: la API la manda como `tenantId` y como `organizationId` (el mismo valor). */
  readonly tenantId?: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly practitionerProfileId: string;
  readonly practitionerName: string;
  /** El perfil **de chat** del doctor: el remitente al responder en su nombre. */
  readonly doctorPublicProfileId: string;
  readonly practitionerSpecialty: string;
  readonly patientLabel: string;
  readonly status: ConversationAssignmentStatus;
  readonly assignedToName?: string;
  readonly assignedToMe: boolean;
  readonly slaDueAt?: string;
  /** Hay un mensaje clínico del paciente sin responder por el doctor. */
  readonly isClinical: boolean;
  /** Configuración del doctor para esta persona: si el paciente ve «respondido por su equipo». */
  readonly replyDisclosure: DelegateReplyDisclosure;
  /**
   * Siempre `true` en lo que se ve: ver la conversación **exige** poder responder en nombre del
   * doctor (permiso `messages.reply_on_behalf` y aceptación del doctor con ese alcance). Quien no
   * lo tiene no recibe una conversación «de solo lectura»: la conversación **no aparece**
   * (404 `CONVERSATION_NOT_FOUND`). Por eso la pantalla ya no tiene un estado «sin permiso de responder».
   */
  readonly replyAllowed: boolean;
  /** La API aún lo declara, pero con `replyAllowed` siempre verdadero no llega. */
  readonly replyBlockedReason?: string;
  /** A quién se puede asignar: personas con acceso a este doctor. */
  readonly assignableTo: readonly { readonly userId: string; readonly name: string }[];
  readonly messages: readonly SupportConversationMessage[];
  readonly notes: readonly InternalNote[];
  readonly patientContext: SupportPatientContext;
}

/* ---- plantillas de respuesta -------------------------------------------------- */

export const REPLY_TEMPLATE_CATEGORIES = [
  'GENERAL',
  'SCHEDULING',
  'BILLING',
  'PREPARATION',
] as const;
export type ReplyTemplateCategory = (typeof REPLY_TEMPLATE_CATEGORIES)[number];

export const REPLY_TEMPLATE_CATEGORY_LABELS: Readonly<Record<ReplyTemplateCategory, string>> = {
  GENERAL: 'General',
  SCHEDULING: 'Citas',
  BILLING: 'Cobros y seguros',
  PREPARATION: 'Preparación',
};

/** Una plantilla de respuesta rápida. `{paciente}` y `{doctor}` se completan al insertarla. */
export interface ReplyTemplate {
  readonly id: string;
  readonly category: ReplyTemplateCategory;
  readonly title: string;
  readonly bodyText: string;
  /** Presente si es de un doctor en particular; ausente si es de toda la organización. */
  readonly practitionerProfileId?: string;
  /** ¿Está retirada? Las retiradas no se ofrecen a quien responde. */
  readonly retired?: boolean;
  /** Sube con cada cambio: se manda como `expectedVersion` al editar, para no pisar a otra persona. */
  readonly version?: number;
}

export interface ReplyTemplatePage {
  readonly items: readonly ReplyTemplate[];
  readonly count?: number;
}

/** `POST /org/reply-templates`: respuestas administrativas, nunca clínicas. */
export interface NewReplyTemplate {
  readonly category: ReplyTemplateCategory;
  readonly title: string;
  readonly bodyText: string;
  readonly practitionerProfileId?: string;
}

/** `PATCH /org/reply-templates/:id`: cambiarla, retirarla o reactivarla, con la versión que se vio. */
export interface ReplyTemplateChange {
  readonly title?: string;
  readonly bodyText?: string;
  readonly category?: ReplyTemplateCategory;
  readonly retired?: boolean;
  readonly expectedVersion?: number;
}

/** El canal por el que sale una respuesta. El correo solo sale al responder en nombre del doctor. */
export type ReplyChannel = 'CHAT' | 'EMAIL';

/** Lo que pasó con el correo de una respuesta que lo pidió. */
export interface ReplyEmailOutcome {
  readonly queued: boolean;
  readonly requestId?: string;
  /** Por qué no se mandó (por ejemplo, el paciente no tiene correo). */
  readonly skippedReason?: string;
}
