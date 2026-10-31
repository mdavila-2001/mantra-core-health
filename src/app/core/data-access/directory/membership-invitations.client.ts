import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { TENANT_HEADER } from '../../http/auth.interceptor';
import { API_BASE_URL, apiUrl } from '../api';
import type { InvitedRoleCode, MembershipInvitation, MembershipInvitationDecision } from './membership-invitations.types';

interface WireInvitation {
  readonly id: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly role: string;
  readonly invitedAt: string;
}

const ROLES: readonly InvitedRoleCode[] = ['OWNER', 'ADMIN', 'STAFF', 'OTHER'];

function toInvitation(fila: WireInvitation): MembershipInvitation {
  return {
    id: fila.id,
    tenantId: fila.tenantId,
    tenantName: fila.tenantName,
    role: (ROLES as readonly string[]).includes(fila.role) ? (fila.role as InvitedRoleCode) : 'OTHER',
    invitedAt: new Date(fila.invitedAt),
  };
}

/**
 * Las **invitaciones de organizaciones** de la propia persona: las membresías que una organización creó para ella y que
 * todavía no aceptó. Son rutas sin organización activa (`@TenantAgnostic`): quien solo tiene invitaciones pendientes no
 * pertenece todavía a ninguna.
 *
 * Aceptar o rechazar una que no es suya, o que ya no está pendiente, responde **404 igual** que si no existiera.
 */
@Injectable({ providedIn: 'root' })
export class MembershipInvitationsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }

  /** `GET /tenants/me/membership-invitations` — lo que la persona tiene pendiente de aceptar. */
  list(): Observable<readonly MembershipInvitation[]> {
    return this.http.get<{ readonly items: readonly WireInvitation[] }>(this.url('/tenants/me/membership-invitations')).pipe(map((cuerpo) => cuerpo.items.map(toInvitation)));
  }

  /** `POST /tenants/me/membership-invitations/:membershipId/accept` — la membresía queda activa. */
  accept(membershipId: string): Observable<MembershipInvitationDecision> {
    return this.http.post<MembershipInvitationDecision>(this.url(`/tenants/me/membership-invitations/${encodeURIComponent(membershipId)}/accept`), {});
  }

  /** `POST /tenants/me/membership-invitations/:membershipId/decline` — la invitación se descarta. */
  decline(membershipId: string): Observable<MembershipInvitationDecision> {
    return this.http.post<MembershipInvitationDecision>(this.url(`/tenants/me/membership-invitations/${encodeURIComponent(membershipId)}/decline`), {});
  }

  /**
   * `POST /tenants/:tenantId/memberships/:membershipId/offboard` — la **organización** retira una invitación que nadie aceptó
   * todavía (o da de baja a un miembro). Responde `{ ok: true }`. Pide administrar la organización; declara como
   * organización la de la ruta, no la activa de quien administra.
   */
  withdraw(tenantId: string, membershipId: string): Observable<{ readonly ok: boolean }> {
    return this.http.post<{ readonly ok: boolean }>(
      this.url(`/tenants/${encodeURIComponent(tenantId)}/memberships/${encodeURIComponent(membershipId)}/offboard`),
      {},
      { headers: new HttpHeaders({ [TENANT_HEADER]: tenantId }) },
    );
  }
}
