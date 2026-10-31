/**
 * Tipos de la vista para el **personal de apoyo** (secretaria y otros roles):
 * vínculos persona↔organización, permisos por objetivo, solicitudes,
 * invitaciones, equipo del doctor y agenda combinada.
 *
 * Los códigos (plantillas, acciones, tipos de objetivo) son los del contrato
 * compartido con la API (`CONTRATO.md`, ronda «personal de apoyo»). Las formas
 * de las respuestas son las que este cliente **espera**: donde el contrato solo
 * fija la ruta, la forma la propone el front y queda anotada en el informe para
 * que la API la confirme.
 *
 * El front **no autoriza**: lo que acá se llama `allowedActions` o `denialReason`
 * es lo que la API ya resolvió con `SupportAccessPolicy`, y la pantalla solo lo
 * pinta. Ocultar un control no es seguridad.
 */

import type { ActionConditions, SupportCondition } from '../access-governance/conditions.types';
import type { SupportAtom } from './support-atoms';
import type { GrantEffect, GrantOrigin } from './support-decision.types';
import type { CatalogService, LocationNode, SupportActionCode } from './support-access-base.types';

export { SUPPORT_ACTION_CODES } from './support-access-base.types';
export type { CatalogService, LocationKind, LocationNode, SupportActionCode } from './support-access-base.types';

/* ---- plantillas y acciones -------------------------------------------------- */

/** Plantillas de rol de apoyo. */
export const SUPPORT_ROLE_TEMPLATE_CODES = [
  'SECRETARY',
  'MEDICAL_ASSISTANT',
  'NURSING',
  'FRONT_DESK',
  'BILLING_CASHIER',
  'CALL_CENTER',
  'ORG_MANAGEMENT',
] as const;
export type SupportRoleTemplateCode = (typeof SUPPORT_ROLE_TEMPLATE_CODES)[number];

/** Rótulos de las plantillas, en lenguaje de quien las elige. */
export const SUPPORT_ROLE_TEMPLATE_LABELS: Readonly<Record<SupportRoleTemplateCode, string>> = {
  SECRETARY: 'Secretaria',
  MEDICAL_ASSISTANT: 'Asistente médico',
  NURSING: 'Enfermería',
  FRONT_DESK: 'Recepción',
  BILLING_CASHIER: 'Caja y facturación',
  CALL_CENTER: 'Call center',
  ORG_MANAGEMENT: 'Administración de la organización',
};

/** Acciones de agenda: las que paquetean todas las plantillas salvo caja. */
const SECRETARY_ACTIONS: readonly SupportActionCode[] = [
  'schedule.view',
  'schedule.create',
  'schedule.reschedule',
  'schedule.cancel',
  'schedule.confirm',
  'schedule.check_in',
  'schedule.walk_in',
  'schedule.waitlist',
  'schedule.send_reminders',
  'patient.register',
  'messages.reply_on_behalf',
];

/** Lo que cada plantilla da por defecto. Bloquear horario, editar horario y cobro son otorgables aparte. */
export const SUPPORT_TEMPLATE_DEFAULT_ACTIONS: Readonly<
  Record<SupportRoleTemplateCode, readonly SupportActionCode[]>
> = {
  SECRETARY: SECRETARY_ACTIONS,
  MEDICAL_ASSISTANT: SECRETARY_ACTIONS,
  NURSING: ['schedule.view', 'schedule.check_in', 'schedule.waitlist'],
  FRONT_DESK: ['schedule.view', 'schedule.check_in', 'schedule.walk_in', 'patient.register'],
  BILLING_CASHIER: ['schedule.view', 'billing.collect', 'billing.issue_receipt'],
  CALL_CENTER: ['schedule.view', 'schedule.create', 'schedule.reschedule', 'schedule.cancel'],
  ORG_MANAGEMENT: [
    'schedule.view',
    'schedule.create',
    'schedule.reschedule',
    'schedule.cancel',
    'schedule.confirm',
    'schedule.check_in',
    'schedule.walk_in',
    'schedule.waitlist',
    'schedule.send_reminders',
    'schedule.block_time',
    'schedule.edit_hours',
    'patient.register',
  ],
};

/** Cada acción, nombrada para la persona (nada de códigos) y en infinitivo/gerundio de acción. */
export const SUPPORT_ACTION_LABELS: Readonly<Record<SupportActionCode, string>> = {
  'schedule.view': 'Ver la agenda',
  'schedule.create': 'Crear citas',
  'schedule.reschedule': 'Reprogramar citas',
  'schedule.cancel': 'Cancelar citas',
  'schedule.confirm': 'Confirmar citas',
  'schedule.check_in': 'Registrar la llegada del paciente',
  'schedule.walk_in': 'Atender pacientes sin cita',
  'schedule.waitlist': 'Manejar la lista de espera',
  'schedule.send_reminders': 'Enviar recordatorios',
  'schedule.block_time': 'Bloquear horarios',
  'schedule.edit_hours': 'Cambiar el horario de atención',
  'billing.collect': 'Cobrar',
  'billing.issue_receipt': 'Emitir recibos',
  'patient.register': 'Registrar pacientes nuevos',
  'messages.reply_on_behalf': 'Responder mensajes administrativos en nombre del doctor',
};

/* ---- objetivos --------------------------------------------------------------- */

/** Tipo de objetivo de un permiso. Una fila con dos objetivos se **cruza**; varias filas se **suman**. */
export const SUPPORT_TARGET_KINDS = [
  'PRACTITIONER',
  'SERVICE',
  'LOCATION',
  'PRACTITIONER_SERVICE',
  'PRACTITIONER_LOCATION',
  'SERVICE_LOCATION',
  'ALL_PRACTITIONERS',
  'ALL_SERVICES',
  'ALL_LOCATIONS',
  'ALL',
] as const;
export type SupportTargetKind = (typeof SUPPORT_TARGET_KINDS)[number];

/** `DYNAMIC` incluye automáticamente lo que se agregue después; `FIXED` congela lo elegido hoy. */
export type ExpansionMode = 'DYNAMIC' | 'FIXED';

/** Un permiso concreto. Los identificadores que no aplican al tipo de objetivo quedan ausentes. */
export interface SupportScopeTarget {
  readonly targetKind: SupportTargetKind;
  /** Asignación del doctor (`practitioner_role_assignment_id`). */
  readonly practitionerRoleAssignmentId?: string;
  readonly healthcareServiceId?: string;
  /** Espacio o nivel de la jerarquía (`care_space_id`): piso, edificio, ala, consultorio. */
  readonly careSpaceId?: string;
  /** Sede (`practice_site_id`). */
  readonly practiceSiteId?: string;
}

/** Un permiso ya guardado. */
export interface SupportGrant extends SupportScopeTarget {
  readonly id: string;
  readonly engagementId: string;
  readonly expansionMode: ExpansionMode;
  readonly actions: readonly SupportActionCode[];
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  /** Nombres ya resueltos por la API, para listar sin otra consulta. */
  readonly practitionerName?: string;
  readonly serviceName?: string;
  readonly locationName?: string;
  /** `ALLOW` si falta (permisos de antes de la fase 5). */
  readonly effect?: GrantEffect;
  /** Los átomos que el permiso da, con los alias ya expandidos (`actions` sigue trayendo los 15 códigos). */
  readonly atoms?: readonly SupportAtom[];
  readonly origin?: GrantOrigin;
  /** Condición del permiso entero y por átomo. El detalle técnico; la persona lee `conditionsSummary`. */
  readonly condition?: SupportCondition;
  readonly actionConditions?: ActionConditions;
  /** Las condiciones en una oración, generada por el servidor. */
  readonly conditionsSummary?: string;
  readonly reasonText?: string;
}

/** Alta de un permiso. */
export interface NewSupportGrant extends SupportScopeTarget {
  readonly expansionMode: ExpansionMode;
  readonly actions: readonly SupportActionCode[];
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly effect?: GrantEffect;
  readonly condition?: SupportCondition;
  readonly actionConditions?: ActionConditions;
  readonly reasonText?: string;
  /** Huella de `simulate`: si lo que se guarda no es lo simulado, 409 `SIMULATION_STALE`. */
  readonly simulationToken?: string;
}

/**
 * Cambio de un permiso: `PATCH /org/support-engagements/:id/grants`. Sin
 * `revoke`, reemplaza lo que venga; con `revoke: true`, lo retira de inmediato.
 */
export interface SupportGrantChange {
  readonly grantId: string;
  readonly actions?: readonly SupportActionCode[];
  readonly expansionMode?: ExpansionMode;
  readonly validTo?: string | null;
  readonly revoke?: boolean;
  readonly condition?: SupportCondition;
  readonly actionConditions?: ActionConditions;
  readonly simulationToken?: string;
}

/* ---- vínculos ---------------------------------------------------------------- */

/**
 * El estado que usan las pantallas. La API dice `ACTIVE | SUSPENDED | REVOKED | EXPIRED`:
 * `support-access.wire.ts` traduce `REVOKED` y `EXPIRED` a `ENDED` (un vínculo que ya
 * no rige y no vuelve solo).
 */
export type SupportEngagementStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ENDED';
export type SupportEngagementOrigin = 'REQUEST' | 'INVITATION' | 'QR';
export type SupportOwnerKind = 'ORGANIZATION' | 'PRIVATE_PRACTICE';

/** Vínculo de apoyo: persona + organización + plantilla + vigencia + recertificación. */
export interface SupportEngagement {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationName: string;
  readonly ownerKind: SupportOwnerKind;
  readonly userId: string;
  readonly personName: string;
  readonly roleTemplate: SupportRoleTemplateCode;
  readonly status: SupportEngagementStatus;
  readonly origin: SupportEngagementOrigin;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly recertifyEveryMonths: 6 | 12;
  readonly nextRecertificationAt?: string;
  readonly endedReason?: string;
  readonly lastActivityAt?: string;
  /**
   * Fecha en que el vínculo se suspende (o debió suspenderse) por no recertificarse:
   * la de recertificación más 15 días. Solo si está suspendido por eso.
   */
  readonly suspendedAt?: string;
  /** Última vez que se confirmó el vínculo (la recertificación vigente menos su período) y quién lo hizo. */
  readonly lastConfirmedAt?: string;
  readonly lastConfirmedBy?: 'PERSON' | 'ORGANIZATION';
  /** Los permisos vigentes del vínculo. */
  readonly grants: readonly SupportGrant[];
}

/**
 * El vínculo tras confirmarlo la propia persona (`POST /me/support-engagements/:id/confirm`).
 * `reactivated` es `true` si estaba suspendido y la confirmación lo reactivó: la API de
 * hoy lo permite; la decisión de producto es que la renovación sea de la organización
 * y la persona solo declare que sigue trabajando ahí (las pantallas ya no lo ofrecen).
 */
export type ConfirmedSupportEngagement = SupportEngagement & { readonly reactivated: boolean };

export interface SupportEngagementPage {
  readonly items: readonly SupportEngagement[];
}

/** Lo que la persona de apoyo ve en «Mis accesos»: sus vínculos y lo que pidió. */
export interface MySupportEngagements {
  readonly engagements: readonly SupportEngagement[];
  readonly requests: readonly SupportEngagementRequest[];
}

/* ---- solicitudes ------------------------------------------------------------- */

export type SupportRequestDirection = 'REQUEST' | 'INVITATION';
/**
 * `PARTIAL`: se aprobó parte y se rechazó parte. `CANCELLED`: la retiró quien la pidió.
 * El filtro `status` del listado de la API **no** acepta `PARTIAL`: se filtra acá.
 */
export type SupportRequestStatus = 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type SupportItemDecision = 'PENDING' | 'APPROVED' | 'ADJUSTED' | 'REJECTED';

export interface SupportRequestItem extends SupportScopeTarget {
  readonly id: string;
  readonly proposedActions: readonly SupportActionCode[];
  readonly decision: SupportItemDecision;
  readonly decisionComment?: string;
  readonly resultingGrantId?: string;
  readonly practitionerName?: string;
  readonly serviceName?: string;
  readonly locationName?: string;
}

export interface SupportEngagementRequest {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationName: string;
  readonly requesterUserId: string;
  readonly requesterName: string;
  readonly direction: SupportRequestDirection;
  readonly roleTemplate: SupportRoleTemplateCode;
  /** Presente cuando es una **ampliación** de un vínculo que ya existe. */
  readonly parentEngagementId?: string;
  readonly message?: string;
  readonly status: SupportRequestStatus;
  /** Las solicitudes vencen a los 15 días. */
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly decidedAt?: string;
  readonly decisionReason?: string;
  readonly items: readonly SupportRequestItem[];
}

export interface SupportRequestPage {
  readonly items: readonly SupportEngagementRequest[];
  readonly count?: number;
  /** Cursor de la página siguiente, o `null` en la última. */
  readonly nextCursor?: string | null;
}

/** Lo que la persona pide: una plantilla y uno o más objetivos con sus acciones. */
export interface NewSupportEngagementRequest {
  readonly tenantId: string;
  readonly roleTemplate: SupportRoleTemplateCode;
  readonly parentEngagementId?: string;
  readonly message?: string;
  readonly items: readonly (SupportScopeTarget & { readonly proposedActions: readonly SupportActionCode[] })[];
}

/** El veredicto sobre un ítem. `ADJUSTED` lleva las acciones que sí se conceden. */
export interface SupportItemVerdict {
  readonly itemId: string;
  readonly decision: Exclude<SupportItemDecision, 'PENDING'>;
  readonly actions?: readonly SupportActionCode[];
  readonly comment?: string;
}

/** Lo que responde `POST /org/support-engagement-requests/:id/decision`: no la solicitud, su resultado. */
export interface EngagementDecisionResult {
  readonly requestId: string;
  readonly status: SupportRequestStatus;
  /** El vínculo abierto o ampliado, si algo se aprobó. */
  readonly engagementId?: string;
  readonly grantIds: readonly string[];
  /**
   * Decisión parcial por alcance (`/org/team/requests/:id/decision`): los ítems que siguen pendientes y decide el administrador
   * de seguridad. Ausente si la solicitud quedó completa.
   */
  readonly pendingItemIds?: readonly string[];
}

/** `POST /org/support-engagement-requests/:id/decision`. */
export interface SupportRequestDecision {
  readonly items: readonly SupportItemVerdict[];
  readonly reasonText?: string;
}

/* ---- invitaciones y QR ------------------------------------------------------- */

export type AffiliationInvitationKind = 'PRACTITIONER' | 'SUPPORT_STAFF';

/** `POST /org/affiliation-invitations`. Un solo uso para alguien concreto, o varios usos. */
export interface NewAffiliationInvitation {
  readonly kind: AffiliationInvitationKind;
  /** Persona concreta a la que va dirigida (un solo uso). */
  readonly targetPersonId?: string;
  readonly targetPersonLabel?: string;
  readonly maxUses: number;
  readonly expiresInDays: number;
  readonly roleTemplate?: SupportRoleTemplateCode;
}

export interface AffiliationInvitation {
  readonly id: string;
  readonly kind: AffiliationInvitationKind;
  readonly targetPersonLabel?: string;
  readonly maxUses: number;
  readonly usesCount: number;
  readonly expiresAt: string;
  readonly roleTemplate?: SupportRoleTemplateCode;
  readonly status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
  readonly createdAt: string;
  /**
   * El código en claro. **Solo llega en la respuesta de la emisión**: la API
   * guarda únicamente su huella (`token_hash`), así que en el listado no está.
   */
  readonly code?: string;
}

export interface AffiliationInvitationPage {
  readonly items: readonly AffiliationInvitation[];
}

/**
 * Qué pasó al canjear un código (`AffiliationRedeemResultDto`). Un código **multiuso** (sin persona destino) no
 * afilia solo: la organización decide. Para el personal de apoyo queda una solicitud (`requestId`); para un
 * doctor, una solicitud de afiliación **pendiente** (`roleAssignmentId`, `pendingApproval: true`, sin `requestId` ni
 * `membershipId`) que la organización ve en «Médicos del centro» con `initiatedBy: 'PRACTITIONER'`. Quien ya era
 * miembro activo recibe `membershipId` y no queda pendiente.
 */
export interface InvitationRedeemResult {
  readonly outcome: 'SUPPORT_REQUEST_CREATED' | 'SUPPORT_JOINED' | 'PRACTITIONER_AFFILIATED' | 'PRACTITIONER_PENDING_APPROVAL';
  /** La API no lo manda (solo `tenantId`): queda vacío y la pantalla dice «la organización». */
  readonly organizationName: string;
  readonly tenantId?: string;
  readonly membershipId?: string;
  readonly engagementId?: string;
  readonly requestId?: string;
  /** Solo un doctor con un código multiuso: la solicitud de afiliación pendiente (`role_assignment`). */
  readonly roleAssignmentId?: string;
  /** `true` si el canje espera la decisión de la organización. */
  readonly pendingApproval?: boolean;
}

/* ---- catálogo de la organización y consulta de acceso ----------------------- */

/* `LocationKind`, `LocationNode` y `CatalogService` viven en `support-access-base.types.ts`. */

/** Dónde atiende un doctor y qué hace ahí: un espacio y el servicio que presta en él. */
export interface DoctorPlacement {
  readonly careSpaceId: string;
  readonly healthcareServiceId: string;
}

export interface CatalogDoctor {
  /** `practitioner_role_assignment_id`. */
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  /** Sus lugares de atención, cada uno con su servicio (`practitioner_location_assignments`). */
  readonly placements: readonly DoctorPlacement[];
}

/** Lo que el editor de permisos necesita para ofrecer opciones y calcular la vista previa. */
export interface SupportCatalog {
  readonly organizationName: string;
  readonly doctors: readonly CatalogDoctor[];
  readonly services: readonly CatalogService[];
  readonly locations: readonly LocationNode[];
}

export type AccessLookupQuery =
  | { readonly kind: 'doctor'; readonly id: string }
  | { readonly kind: 'service'; readonly id: string }
  | { readonly kind: 'location'; readonly id: string };

export interface AccessLookupEntry {
  readonly engagementId: string;
  readonly personName: string;
  readonly roleTemplate: SupportRoleTemplateCode;
  readonly actions: readonly SupportActionCode[];
}

export interface AccessLookupResult {
  readonly items: readonly AccessLookupEntry[];
}

/* ---- bitácora ---------------------------------------------------------------- */

/**
 * Un asiento de la bitácora (`SupportActivityEntryDto`). Solo identificadores,
 * nombres y verbos: la API no trae datos clínicos ni el nombre de un paciente.
 */
export interface SupportActivityEntry {
  readonly id: string;
  readonly tenantId?: string;
  readonly userId: string;
  /** Quien actuó. La API lo manda como `personName` y como `actorName`. */
  readonly personName: string;
  /**
   * Código de la entrada: el permiso con el que se actuó (`schedule.confirm`) o el
   * evento (`engagement.ended`). Un asiento que la API no reconoce trae su `auditAction`.
   */
  readonly action: string;
  /** El asiento de auditoría tal como se selló (`BOOKING_CONFIRMED`). */
  readonly auditAction: string;
  readonly permission?: string;
  readonly entity: string;
  readonly entityId?: string;
  readonly bookingId?: string;
  readonly appointmentId?: string;
  readonly practitionerProfileId?: string;
  readonly practitionerRoleAssignmentId?: string;
  /** Solo si quien consulta puede verlo. */
  readonly practitionerName?: string;
  /** La acción en una frase. */
  readonly summary: string;
  /** ¿Se hizo? (`result` es `SUCCESS` o `FAILURE`). */
  readonly success: boolean;
  readonly result: 'SUCCESS' | 'FAILURE';
  /** Cuándo (instante ISO). La API lo repite como `occurredAt` y `recordedAt`. */
  readonly createdAt: string;
}

export interface SupportActivityPage {
  readonly items: readonly SupportActivityEntry[];
  readonly count?: number;
  /** Cursor opaco de la página siguiente, o `null` en la última. */
  readonly nextCursor: string | null;
}

/* ---- el equipo del doctor ---------------------------------------------------- */

export type DelegateReplyDisclosure = 'SHOW' | 'HIDE';

/** Una solicitud de acceso clínico temporal, por paciente, que decide el **doctor**. */
export interface PendingClinicalAccessRequest {
  readonly requestId: string;
  readonly patientLabel: string;
  readonly reasonText: string;
  readonly requestedAt: string;
  readonly requestedHours: number;
}

/**
 * El estado de la delegación tal cual: `ACTIVE`, `SUSPENDED` (el vínculo se suspendió
 * por no recertificarse), `REVOKED` (se retiró) o `EXPIRED`. Cuando no es `ACTIVE`,
 * el `status` para el doctor es `REVOKED`.
 */
export type DelegateStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export interface DoctorTeamMember {
  /** `practitioner_delegate_assignment_id`. */
  readonly delegateId: string;
  readonly userId?: string;
  readonly engagementId?: string;
  /**
   * La vinculación del doctor con esa organización (`practitioner_role_assignment_id`): la que pide
   * `POST /me/practitioner/support-team/explain`. La API la manda siempre; así «¿Por qué pudo…?» no necesita adivinar en
   * cuál de sus vinculaciones preguntar.
   */
  readonly practitionerRoleAssignmentId: string;
  readonly tenantId?: string;
  readonly personName: string;
  readonly roleTemplate: SupportRoleTemplateCode;
  readonly organizationName: string;
  /**
   * Para el doctor: `PENDING_ACCEPTANCE` (la delegación está activa y él todavía no la
   * aceptó), `ACTIVE` o `REVOKED` (retirada, suspendida o vencida).
   */
  readonly status: 'PENDING_ACCEPTANCE' | 'ACTIVE' | 'REVOKED';
  /** Por qué está en `REVOKED`: la delegación como la tiene la API. */
  readonly delegateStatus: DelegateStatus;
  readonly accepted?: boolean;
  readonly mayReplyOnBehalf: boolean;
  readonly replyDisclosure: DelegateReplyDisclosure;
  readonly acceptedAt?: string;
  /** Las acciones que tiene sobre este doctor (la unión de sus permisos que lo cubren). */
  readonly actions: readonly SupportActionCode[];
  /** Qué cubre de este doctor, ya resumido por la API para mostrar. */
  readonly coverageSummary: string;
  readonly lastActivityAt?: string;
  readonly pendingClinicalRequests: readonly PendingClinicalAccessRequest[];
}

export interface DoctorTeam {
  readonly items: readonly DoctorTeamMember[];
}

export interface DelegateAcceptance {
  readonly mayReplyOnBehalf?: boolean;
  readonly replyDisclosure?: DelegateReplyDisclosure;
}

export interface DelegateReplySettings {
  readonly mayReplyOnBehalf?: boolean;
  readonly replyDisclosure?: DelegateReplyDisclosure;
}

/* ---- agenda combinada: ver `support-agenda.types.ts` (se reexporta acá) -------------- */
export type { SupportAgenda, SupportAgendaDoctor, SupportAgendaItem, SupportAgendaQuery } from './support-agenda.types';

/* ---- política de sesión y filtros de la bitácora: ver `support-session.types.ts` ---- */
export * from './support-session.types';

/* ---- catálogo de átomos y condiciones: ver `support-atoms.ts` y `access-governance/conditions.types.ts` ---- */
export * from './support-atoms';
export * from './support-decision.types';
export type { ActionConditions, ApproverKind, SupportCondition } from '../access-governance/conditions.types';
