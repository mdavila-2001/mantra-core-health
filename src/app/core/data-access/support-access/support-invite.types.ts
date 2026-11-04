import type { SupportTargetKind } from './support-access.types';

/* ============================================================================
    «Invitar a una secretaria»: lo que viaja en `POST /me/practitioner/support-invitations`.

    Son los nombres de `PractitionerInviteSupportDto` y `SupportLinksCreatedDto` de la API
    (`delegated_access/dto/support-staff.dto.ts`). El vínculo nace **pendiente**: lo decide
    después la otra parte, la propia secretaria. El front no concede nada.
   ========================================================================== */

/** Quién interviene en un vínculo de apoyo: la secretaria, la organización o el doctor. */
export type SupportLinkParty = 'SUPPORT_STAFF' | 'ORGANIZATION' | 'PRACTITIONER';

/** Cuerpo de la invitación. La API no admite ninguna otra clave. */
export interface NewSupportInvitation {
  /** Documento con el que la secretaria inicia sesión: letras, dígitos, punto y guion; de 4 a 40 caracteres. */
  readonly nationalId: string;
  /** Su vinculación con el hospital donde ella lo va a asistir (`practitioner_role_assignment_id`). */
  readonly practitionerRoleAssignmentId: string;
}

/** Un vínculo tal como lo devuelve la API (`SupportLinkViewDto`). */
export interface SupportInvitationLink {
  readonly id: string;
  readonly kind: 'LOCATION' | 'PRACTITIONER';
  readonly targetKind: SupportTargetKind;
  readonly tenantId: string;
  readonly organizationName: string | null;
  readonly userId: string;
  readonly personName: string | null;
  readonly status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'ENDED';
  /** Quién inició el vínculo; `null` si no tiene iniciador y nadie lo decide. */
  readonly initiatedBy: SupportLinkParty | null;
  /** Quién tiene que aceptar o rechazar; `null` si ya se decidió. */
  readonly awaiting: SupportLinkParty | null;
  readonly practiceSiteId: string | null;
  readonly clinicalUnitId: string | null;
  readonly careSpaceId: string | null;
  readonly practitionerRoleAssignmentId: string | null;
  readonly practitionerProfileId: string | null;
  /** Nombre del doctor, la sede, el servicio o el piso. */
  readonly targetName: string | null;
  readonly createdAt: string;
}

/** Respuesta de invitar (`SupportLinksCreatedDto`): los vínculos creados, todos pendientes. */
export interface SupportInvitationCreated {
  /** Id del primer vínculo creado. */
  readonly id: string;
  readonly tenantId: string;
  readonly items: readonly SupportInvitationLink[];
}

/**
 * Los campos con que la API dice **quién espera a quién** en cada vínculo del equipo, y desde cuándo.
 * `GET /me/practitioner/support-team` los trae junto al resto de cada integrante.
 */
export interface TeamMemberInitiator {
  /** Id del vínculo (`SupportLinkViewDto.id`): la API real no manda `delegateId`. */
  readonly id?: string;
  readonly initiatedBy?: SupportLinkParty | null;
  readonly awaiting?: SupportLinkParty | null;
  /** Cuándo se creó el vínculo (ISO 8601). */
  readonly createdAt?: string;
}
