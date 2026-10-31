/**
 * **Personal de apoyo** (la secretaria): el contrato de la API
 * (`claude/secretaria-alta-dev`, módulo `delegated_access`).
 *
 * ## El modelo
 *
 * La secretaria tiene su propio rol global, **`SUPPORT_STAFF`**, desde el alta
 * (`POST /iam/auth/register-support-staff`). Lo que **no** tiene por el rol es
 * acceso a nada: lo que ve sale de sus **vínculos** (`SupportLink`), uno por
 * objetivo —un doctor, un piso, una sede, un servicio o la organización entera—
 * en un hospital.
 *
 * Todo vínculo nace `PENDING` y lo decide **la otra parte** (`awaiting`):
 *
 * - el hospital invita (`POST /org/team/invitations`) o el doctor invita
 *   (`POST /me/practitioner/support-invitations`) → acepta la secretaria
 *   (`POST /me/support-engagements/:id/confirm`);
 * - la secretaria pide (`POST /support-engagement-requests`) → acepta el
 *   hospital (`POST /org/support-engagement-requests/:id/decision`) o, si pidió
 *   a un doctor, el doctor (`POST /practitioner-delegates/:id/accept`).
 *
 * Al aceptar, el hospital entra a los `tenants` de su token: hay que
 * **refrescarlo** para verlo.
 */

/** El rol de la secretaria en el token. */
export const SUPPORT_STAFF_ROLE = 'SUPPORT_STAFF';

/** Plantillas de rol de apoyo. Hoy la API sólo pide `SECRETARY`. */
export type SupportTemplateCode = 'SECRETARY';

/** A qué apunta un vínculo. */
export type SupportTargetKind = 'ORGANIZATION' | 'SITE' | 'SERVICE' | 'SPACE' | 'PRACTITIONER';

/**
 * El objetivo de un vínculo: `SITE` → `practiceSiteId`; `SERVICE` →
 * `clinicalUnitId`; `SPACE` (el piso) → `careSpaceId`; `PRACTITIONER` →
 * `practitionerRoleAssignmentId` (la vinculación del doctor con ese hospital).
 */
export interface SupportTarget {
  readonly targetKind: SupportTargetKind;
  readonly practiceSiteId?: string;
  readonly clinicalUnitId?: string;
  readonly careSpaceId?: string;
  readonly practitionerRoleAssignmentId?: string;
}

export type SupportLinkStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'ENDED';

/** Las tres partes de un vínculo. */
export type SupportParty = 'SUPPORT_STAFF' | 'ORGANIZATION' | 'PRACTITIONER';

/** `SupportLinkView`: un vínculo de la secretaria con un objetivo de un hospital. */
export interface SupportLink {
  readonly id: string;
  readonly kind: 'LOCATION' | 'PRACTITIONER';
  readonly targetKind: SupportTargetKind;
  readonly tenantId: string;
  readonly organizationName: string | null;
  /** La secretaria. */
  readonly userId: string;
  readonly personName: string | null;
  readonly status: SupportLinkStatus;
  /** `null` en un vínculo sin iniciador guardado: nadie lo decide (`awaiting: null`). */
  readonly initiatedBy: SupportParty | null;
  /** Quién tiene que aceptar o rechazar; `null` si ya no hay nada que decidir. */
  readonly awaiting: SupportParty | null;
  readonly practiceSiteId: string | null;
  readonly clinicalUnitId: string | null;
  readonly careSpaceId: string | null;
  readonly practitionerRoleAssignmentId: string | null;
  readonly practitionerProfileId: string | null;
  /** El nombre del doctor, la sede, el servicio o el piso. */
  readonly targetName: string | null;
  readonly createdAt: string;
}

/** `SupportLinkList`. */
export interface SupportLinkList {
  readonly items: readonly SupportLink[];
  readonly count: number;
  readonly nextCursor: string | null;
}

/** `SupportLinksCreated`: lo que deja una solicitud o una invitación. */
export interface SupportLinksCreated {
  readonly id: string;
  readonly tenantId: string;
  readonly items: readonly SupportLink[];
}

/** `GET /me/support-engagements`: mis vínculos y, aparte, los pendientes. */
export interface MySupportEngagements {
  readonly items: readonly SupportLink[];
  readonly count: number;
  readonly requests: readonly SupportLink[];
}

/** Un doctor con el que trabaja, en `GET /me/support-access`. */
export interface SupportAccessPractitioner {
  readonly linkId: string;
  readonly practitionerRoleAssignmentId: string | null;
  readonly practitionerProfileId: string | null;
  readonly name: string | null;
}

/**
 * Lo que la secretaria puede ver de un hospital: **sólo** vínculos `ACTIVE`.
 *
 * `organizationAccess: false` es el caso de un vínculo que **sólo aceptó un
 * doctor** (o que el doctor ofreció y ella aceptó): no hay membresía del
 * hospital, así que ve la agenda de ese doctor y nada del hospital —ni su
 * nombre como lugar de trabajo ni sus pisos—.
 */
export interface SupportAccessTenant {
  readonly tenantId: string;
  readonly organizationName: string | null;
  readonly wholeOrganization: boolean;
  readonly organizationAccess: boolean;
  readonly practiceSiteIds: readonly string[];
  readonly clinicalUnitIds: readonly string[];
  /** Los pisos. */
  readonly careSpaceIds: readonly string[];
  readonly practitioners: readonly SupportAccessPractitioner[];
}

/** `GET /me/support-access`. */
export interface SupportAccess {
  readonly tenants: readonly SupportAccessTenant[];
}

/** Un turno de la agenda de un doctor que asiste (`GET /me/support-agenda`). */
export interface SupportAgendaItem {
  readonly bookingId: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly statusCode: string;
  readonly patientProfileId: string;
  readonly patientName: string;
}

/** `GET /me/support-agenda`: hasta 31 días; 403 `SUPPORT_SCOPE_DENIED` sin vínculo activo con ese doctor. */
export interface SupportAgendaQuery {
  readonly tenantId: string;
  readonly practitionerRoleAssignmentId: string;
  readonly from: string;
  readonly to: string;
}

/** Una entrada del catálogo. En `practitioners`, `id` es el `practitionerRoleAssignmentId`. */
export interface CatalogEntry {
  readonly id: string;
  readonly name: string | null;
  readonly practiceSiteId: string | null;
  readonly clinicalUnitId?: string | null;
  readonly practitionerProfileId?: string;
}

/** `SupportCatalog`: con qué armar una solicitud o una invitación. */
export interface SupportCatalog {
  readonly tenantId: string;
  readonly organizationName: string | null;
  readonly sites: readonly CatalogEntry[];
  readonly services: readonly CatalogEntry[];
  /** Los pisos (`care_spaces`). */
  readonly floors: readonly CatalogEntry[];
  readonly practitioners: readonly CatalogEntry[];
}

/** `POST /support-engagement-requests`. */
export interface NewSupportRequest {
  readonly tenantId: string;
  readonly items: readonly SupportTarget[];
  readonly roleTemplateCode?: SupportTemplateCode;
  readonly message?: string;
}

/** `POST /org/support-engagement-requests/:id/decision`: un vínculo, sin ítems. */
export interface SupportDecision {
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly reasonText?: string;
}

/** `POST /org/team/invitations`: el hospital invita por documento. */
export interface OrganizationInvitation {
  readonly nationalId: string;
  readonly items: readonly SupportTarget[];
}

/** `POST /me/practitioner/support-invitations`: el doctor invita por documento. */
export interface PractitionerInvitation {
  readonly nationalId: string;
  readonly practitionerRoleAssignmentId: string;
}

/**
 * `POST /iam/auth/register-support-staff`: el alta de la secretaria.
 *
 * Mismos nombres y mismas validaciones que el alta de paciente en lo que
 * comparten —identidad, documento, contacto y acceso—, sin los bloques clínicos,
 * de seguro ni de emergencia, que son de quien se atiende y no de quien trabaja.
 */
export interface SupportStaffRegistration {
  readonly nationalId: string;
  readonly issuerAdministrativeAreaConceptId: string;
  readonly password: string;
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName?: string;
  readonly email: string;
  /** ISO `YYYY-MM-DD`. */
  readonly birthDate: string;
  readonly phone: string;
}

/** Respuesta del alta: la cuenta nace con el rol `SUPPORT_STAFF`. */
export interface RegisteredSupportStaff {
  readonly userId: string;
  readonly personId: string;
  readonly supportProfileId: string;
  readonly role: 'SUPPORT_STAFF';
  readonly emailVerificationSent: boolean;
}

/** Texto visible del estado de un vínculo, sin vocabulario de sistema. */
export const SUPPORT_LINK_STATUS_TEXT: Readonly<Record<SupportLinkStatus, string>> = {
  PENDING: 'Pendiente',
  ACTIVE: 'Activo',
  REJECTED: 'Rechazado',
  ENDED: 'Terminado',
};

/** Quién falta que decida, en palabras de quien lo lee. */
export function awaitingText(link: Pick<SupportLink, 'awaiting' | 'status'>): string {
  switch (link.awaiting) {
    case 'SUPPORT_STAFF':
      return 'Espera que la secretaria acepte';
    case 'ORGANIZATION':
      return 'Espera que el hospital acepte';
    case 'PRACTITIONER':
      return 'Espera que el doctor acepte';
    default:
      return SUPPORT_LINK_STATUS_TEXT[link.status];
  }
}

/** Cómo se llama el objetivo de un vínculo cuando la API no trae nombre. */
export function targetLabel(link: Pick<SupportLink, 'targetKind' | 'targetName'>): string {
  if (link.targetName !== null && link.targetName.trim() !== '') return link.targetName;
  switch (link.targetKind) {
    case 'ORGANIZATION':
      return 'Toda la organización';
    case 'PRACTITIONER':
      return 'Un doctor';
    case 'SPACE':
      return 'Un piso';
    case 'SITE':
      return 'Una sede';
    default:
      return 'Un servicio';
  }
}
