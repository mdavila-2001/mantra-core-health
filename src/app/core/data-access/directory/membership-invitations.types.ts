/**
 * Las **invitaciones de organizaciones** (`directory/dto/membership-invitation.dto.ts`).
 *
 * `POST /tenants/:tenantId/memberships` ya no incorpora a nadie al instante: deja la membresía **pendiente de aceptación**.
 * Hasta que la persona la acepte no cuenta para su token, sus políticas, la lectura de la organización ni los vínculos de
 * apoyo. Sin esto, un administrador podía añadir a cualquier cuenta como miembro y, con una política de sesión, cerrarle el
 * acceso en todas sus organizaciones. Canjear un código QR o una invitación dirigida sigue siendo consentimiento y activa
 * al instante.
 */

/** Rol con que la organización invita (`role` del DTO). */
export type InvitedRoleCode = 'OWNER' | 'ADMIN' | 'STAFF' | 'OTHER';

/** Una invitación pendiente de la persona (`GET /tenants/me/membership-invitations`). */
export interface MembershipInvitation {
  /** La membresía pendiente: con ella se acepta o se rechaza. */
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: InvitedRoleCode;
  readonly invitedAt: Date;
}

/** `POST …/accept` y `POST …/decline`. */
export interface MembershipInvitationDecision {
  readonly id: string;
  readonly tenantId: string;
  /** `ACTIVE` si la aceptó; `DECLINED` si la rechazó. */
  readonly status: 'ACTIVE' | 'DECLINED';
}
