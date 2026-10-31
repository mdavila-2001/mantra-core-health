import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  MySupportEngagements,
  NewSupportRequest,
  OrganizationInvitation,
  PractitionerInvitation,
  RegisteredSupportStaff,
  SupportAccess,
  SupportAgendaItem,
  SupportAgendaQuery,
  SupportCatalog,
  SupportDecision,
  SupportLink,
  SupportLinkList,
  SupportLinksCreated,
  SupportLinkStatus,
  SupportStaffRegistration,
} from './support-staff.types';

function idOf(id: string): string {
  return encodeURIComponent(id);
}

/** El cuerpo con `reason` sólo si se escribió uno: `forbidNonWhitelisted` no perdona claves vacías. */
function withReason(reason?: string): { reason?: string } {
  const texto = reason?.trim() ?? '';
  return texto === '' ? {} : { reason: texto };
}

/**
 * La secretaria vista desde sus tres lados: ella, el hospital y el doctor. Ver
 * `support-staff.types.ts` para el modelo.
 *
 * Las rutas `/me/*` de la secretaria y del doctor van **sin organización
 * activa** en la API (`@TenantAgnostic`): se trabaja para varios hospitales a la
 * vez. Las `/org/*` son del hospital activo.
 */
@Injectable({ providedIn: 'root' })
export class SupportStaffClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---- la secretaria ------------------------------------------------------ */

  /**
   * `POST /iam/auth/register-support-staff` — el alta. Pública, como la de
   * paciente. El cuerpo se arma campo por campo: la API valida con
   * `forbidNonWhitelisted` y una clave de más tumba el alta entera.
   */
  registerSupportStaff(registration: SupportStaffRegistration): Observable<RegisteredSupportStaff> {
    const middleName = registration.middleName?.trim() ?? '';
    const motherLastName = registration.motherLastName?.trim() ?? '';
    return this.http.post<RegisteredSupportStaff>(this.url('/iam/auth/register-support-staff'), {
      nationalId: registration.nationalId,
      issuerAdministrativeAreaConceptId: registration.issuerAdministrativeAreaConceptId,
      password: registration.password,
      name: registration.name,
      lastName: registration.lastName,
      ...(middleName === '' ? {} : { middleName }),
      ...(motherLastName === '' ? {} : { motherLastName }),
      email: registration.email,
      birthDate: registration.birthDate,
      phone: registration.phone,
    });
  }

  /** `GET /me/support-engagements` — mis vínculos, y aparte los que esperan una decisión. */
  listMine(): Observable<MySupportEngagements> {
    return this.http.get<MySupportEngagements>(this.url('/me/support-engagements'));
  }

  /**
   * `GET /me/support-access` — **la** fuente de lo que ve: sus hospitales, sus
   * doctores y sus pisos, sólo de vínculos activos.
   */
  getMyAccess(): Observable<SupportAccess> {
    return this.http.get<SupportAccess>(this.url('/me/support-access'));
  }

  /** `GET /me/support-agenda` — la agenda de un doctor que asiste (hasta 31 días). */
  getAgenda(query: SupportAgendaQuery): Observable<readonly SupportAgendaItem[]> {
    const params = new HttpParams()
      .set('tenantId', query.tenantId)
      .set('practitionerRoleAssignmentId', query.practitionerRoleAssignmentId)
      .set('from', query.from)
      .set('to', query.to);
    return this.http
      .get<{ readonly items: readonly SupportAgendaItem[] }>(this.url('/me/support-agenda'), { params })
      .pipe(map((page) => page.items));
  }

  /** `GET /me/support-catalog?org=` — doctores y pisos de un hospital, para pedir. */
  getCatalogFor(tenantId: string): Observable<SupportCatalog> {
    return this.http.get<SupportCatalog>(this.url('/me/support-catalog'), {
      params: new HttpParams().set('org', tenantId),
    });
  }

  /** `POST /support-engagement-requests` — pedir trabajar con esos doctores o pisos. */
  request(request: NewSupportRequest): Observable<SupportLinksCreated> {
    return this.http.post<SupportLinksCreated>(this.url('/support-engagement-requests'), request);
  }

  /** `POST /me/support-engagements/:id/confirm` — aceptar la invitación del hospital o del doctor. */
  confirm(linkId: string): Observable<SupportLink> {
    return this.http.post<SupportLink>(this.url(`/me/support-engagements/${idOf(linkId)}/confirm`), {});
  }

  /** `POST /me/support-engagements/:id/decline` — rechazar una invitación. */
  decline(linkId: string, reason?: string): Observable<SupportLink> {
    return this.http.post<SupportLink>(this.url(`/me/support-engagements/${idOf(linkId)}/decline`), withReason(reason));
  }

  /** `POST /me/support-engagements/:id/leave` — dejar un vínculo, o retirar un pedido. */
  leave(linkId: string): Observable<SupportLink> {
    return this.http.post<SupportLink>(this.url(`/me/support-engagements/${idOf(linkId)}/leave`), {});
  }

  /* ---- el hospital (organización activa) ------------------------------------ */

  /** `GET /org/support-catalog` — doctores y pisos del hospital activo. */
  getOrgCatalog(): Observable<SupportCatalog> {
    return this.http.get<SupportCatalog>(this.url('/org/support-catalog'));
  }

  /** `GET /org/support-engagement-requests?status=` — por defecto, lo pendiente. */
  listRequests(status: SupportLinkStatus = 'PENDING'): Observable<readonly SupportLink[]> {
    return this.http
      .get<SupportLinkList>(this.url('/org/support-engagement-requests'), {
        params: new HttpParams().set('status', status),
      })
      .pipe(map((page) => page.items));
  }

  /** `POST /org/support-engagement-requests/:id/decision` — aceptar o rechazar un vínculo. */
  decide(linkId: string, decision: SupportDecision): Observable<SupportLink> {
    const reasonText = decision.reasonText?.trim() ?? '';
    return this.http.post<SupportLink>(this.url(`/org/support-engagement-requests/${idOf(linkId)}/decision`), {
      decision: decision.decision,
      ...(reasonText === '' ? {} : { reasonText }),
    });
  }

  /** `GET /org/support-engagements` — el personal de apoyo del hospital (activo y pendiente). */
  listEngagements(): Observable<readonly SupportLink[]> {
    return this.http.get<SupportLinkList>(this.url('/org/support-engagements')).pipe(map((page) => page.items));
  }

  /** `POST /org/support-engagements/:id/end` — terminar un vínculo. */
  endEngagement(linkId: string, reason?: string): Observable<SupportLink> {
    return this.http.post<SupportLink>(this.url(`/org/support-engagements/${idOf(linkId)}/end`), withReason(reason));
  }

  /** `POST /org/team/invitations` — el hospital invita a una secretaria por su documento. */
  inviteToOrganization(invitation: OrganizationInvitation): Observable<SupportLinksCreated> {
    return this.http.post<SupportLinksCreated>(this.url('/org/team/invitations'), invitation);
  }

  /* ---- el doctor ------------------------------------------------------------- */

  /** `GET /me/practitioner/support-team` — mis secretarias, en todos mis hospitales. */
  getMyTeam(): Observable<readonly SupportLink[]> {
    return this.http.get<SupportLinkList>(this.url('/me/practitioner/support-team')).pipe(map((page) => page.items));
  }

  /** `POST /practitioner-delegates/:id/accept` — el doctor acepta a la secretaria que lo pidió. */
  acceptAsPractitioner(linkId: string): Observable<SupportLink> {
    return this.http.post<SupportLink>(this.url(`/practitioner-delegates/${idOf(linkId)}/accept`), {});
  }

  /** `POST /practitioner-delegates/:id/reject`. */
  rejectAsPractitioner(linkId: string, reason?: string): Observable<SupportLink> {
    return this.http.post<SupportLink>(this.url(`/practitioner-delegates/${idOf(linkId)}/reject`), withReason(reason));
  }

  /** `POST /me/practitioner/support-team/:id/end` — el doctor deja de trabajar con ella. */
  endAsPractitioner(linkId: string, reason?: string): Observable<SupportLink> {
    return this.http.post<SupportLink>(this.url(`/me/practitioner/support-team/${idOf(linkId)}/end`), withReason(reason));
  }

  /** `POST /me/practitioner/support-invitations` — el doctor invita a su secretaria en uno de sus hospitales. */
  inviteAsPractitioner(invitation: PractitionerInvitation): Observable<SupportLinksCreated> {
    return this.http.post<SupportLinksCreated>(this.url('/me/practitioner/support-invitations'), invitation);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
