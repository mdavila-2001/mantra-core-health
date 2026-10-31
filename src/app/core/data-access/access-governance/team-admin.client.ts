import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { OperationResult } from '../delegated-access/delegated-access.types';
import {
  fromWireDecision,
  fromWireInvitation,
  fromWireRequest,
  toWireInvitation,
} from '../support-access/support-access.wire';
import type {
  AffiliationInvitation,
  EngagementDecisionResult,
  NewAffiliationInvitation,
  SupportRequestDecision,
} from '../support-access/support-access.types';
import type {
  AtomGrantChange,
  GrantChangePending,
  NewAtomGrant,
} from '../support-access/support-atom-grants.types';
import type {
  HandoverPreview,
  OffboardRequest,
  OffboardResult,
  ReactivateRequest,
  SuspendRequest,
  SuspensionResult,
  TeamCapabilities,
  TeamMember,
  TeamMemberList,
  TeamRequestList,
} from './access-lifecycle.types';

/**
 * Cliente de la **administración delegada** (`/org/team/*`, CONTRATO-GOBIERNO §6.4, §8.3 bloque E): el jefe de servicio o de
 * piso administra a **su** gente dentro de **su** techo.
 *
 * Las rutas `/org/support-engagements*` siguen siendo solo del administrador de seguridad. Estas las alcanzan también
 * las personas con el átomo (`team.*`) y el servicio exige el alcance: `403 ADMIN_CEILING_EXCEEDED` si pide más de lo que
 * puede dar, `403 ADMIN_SCOPE_EXCEEDED` si la persona o el permiso están fuera de lo que administra, y un `404` uniforme
 * para lo que no ve. El mismo DTO de permisos que `/org/support-engagements/:id/grants`.
 */
@Injectable({ providedIn: 'root' })
export class TeamAdminClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /org/team/capabilities` — mi alcance, mi techo y qué puedo hacer (el banner «Usted administra…»). */
  getCapabilities(): Observable<TeamCapabilities> {
    return this.http.get<TeamCapabilities>(this.url('/org/team/capabilities'));
  }

  /** `GET /org/team/members` — solo la población administrable. */
  listMembers(): Observable<TeamMemberList> {
    return this.http.get<TeamMemberList>(this.url('/org/team/members'));
  }

  /** `GET /org/team/members/:id` — solo las concesiones dentro del alcance; lo demás, «otras funciones: N». */
  getMember(engagementId: string): Observable<TeamMember> {
    return this.http.get<TeamMember>(this.memberUrl(engagementId));
  }

  /** `POST /org/team/members/:id/grants` — pide paso extra. */
  createGrant(
    engagementId: string,
    grant: NewAtomGrant,
  ): Observable<{ readonly id: string; readonly status: string } | GrantChangePending> {
    return this.http.post<{ readonly id: string; readonly status: string } | GrantChangePending>(
      `${this.memberUrl(engagementId)}/grants`,
      grant,
    );
  }

  /** `PATCH /org/team/members/:id/grants` — con `team.grants.revoke` solo reduce. */
  changeGrant(
    engagementId: string,
    change: AtomGrantChange,
  ): Observable<OperationResult | GrantChangePending> {
    return this.http.patch<OperationResult | GrantChangePending>(
      `${this.memberUrl(engagementId)}/grants`,
      change,
    );
  }

  /** `POST /org/team/members/:id/recertify`. */
  recertify(engagementId: string, months?: 6 | 12): Observable<OperationResult> {
    return this.http.post<OperationResult>(
      `${this.memberUrl(engagementId)}/recertify`,
      months === undefined ? {} : { recertifyEveryMonths: months },
    );
  }

  /** `POST /org/team/members/:id/suspend`. */
  suspend(engagementId: string, request: SuspendRequest): Observable<SuspensionResult> {
    return this.http.post<SuspensionResult>(`${this.memberUrl(engagementId)}/suspend`, request);
  }

  /** `POST /org/team/members/:id/reactivate` — responde 202 y crea el cuatro ojos. */
  reactivate(engagementId: string, request: ReactivateRequest): Observable<SuspensionResult> {
    return this.http.post<SuspensionResult>(`${this.memberUrl(engagementId)}/reactivate`, request);
  }

  /** `POST /org/team/members/:id/offboard`. */
  offboard(engagementId: string, request: OffboardRequest): Observable<OffboardResult> {
    return this.http.post<OffboardResult>(`${this.memberUrl(engagementId)}/offboard`, request);
  }

  /** `GET /org/team/members/:id/handover-preview`. */
  handoverPreview(engagementId: string): Observable<HandoverPreview> {
    return this.http.get<HandoverPreview>(`${this.memberUrl(engagementId)}/handover-preview`);
  }

  /** `POST /org/team/invitations` — plantillas y alcance propios (403 `ADMIN_CEILING_EXCEEDED`). */
  invite(invitation: NewAffiliationInvitation): Observable<AffiliationInvitation> {
    return this.http
      .post<AffiliationInvitation>(this.url('/org/team/invitations'), toWireInvitation(invitation))
      .pipe(map(fromWireInvitation));
  }

  /** `GET /org/team/requests` — ítems pendientes dentro de mi alcance, con `otherItems` para lo que no es mío. */
  listRequests(): Observable<TeamRequestList> {
    return this.http.get<TeamRequestList>(this.url('/org/team/requests')).pipe(
      map((page) => ({
        ...page,
        items: (page.items ?? []).map((r) => ({
          ...fromWireRequest(r),
          otherItems: r.otherItems,
        })),
      })),
    );
  }

  /** `POST /org/team/requests/:id/decision` — decide solo los ítems propios; el resto sigue pendiente. */
  decideRequest(
    requestId: string,
    decision: SupportRequestDecision,
  ): Observable<EngagementDecisionResult> {
    return this.http
      .post<EngagementDecisionResult>(
        this.url(`/org/team/requests/${encodeURIComponent(requestId)}/decision`),
        decision,
      )
      .pipe(map(fromWireDecision));
  }

  private memberUrl(engagementId: string): string {
    return this.url(`/org/team/members/${encodeURIComponent(engagementId)}`);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
