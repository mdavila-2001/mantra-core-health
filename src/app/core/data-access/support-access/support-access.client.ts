import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError, EMPTY, expand, forkJoin, map, of, reduce, switchMap, type Observable,
} from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  withAccessChallenge,
  type ChallengeRequestOptions,
} from '../../access-challenge/access-challenge';
import { API_BASE_URL, apiUrl } from '../api';
import { TerminologyClient } from '../terminology/terminology.client';
import type { OperationResult } from '../delegated-access/delegated-access.types';
import type {
  AtomGrantChange,
  GrantChangePending,
  NewAtomGrant,
} from './support-atom-grants.types';
import type {
  AccessLookupQuery,
  AccessLookupResult,
  AffiliationInvitation,
  AffiliationInvitationPage,
  DelegateAcceptance,
  ConfirmedSupportEngagement,
  DelegateReplySettings,
  DoctorTeam,
  EngagementDecisionResult,
  InvitationRedeemResult,
  IpAccessRule,
  IpAccessRules,
  MySupportEngagements,
  NewAffiliationInvitation,
  NewSupportEngagementRequest,
  NewSupportGrant,
  SessionPolicies,
  SupportActivityPage,
  SupportActivityQuery,
  SupportAgenda,
  SupportAgendaQuery,
  SupportCatalog,
  SupportEngagementPage,
  SupportEngagementRequest,
  SupportGrant,
  SupportGrantChange,
  SupportRequestDecision,
  SupportRequestPage,
  SupportRequestStatus,
} from './support-access.types';
import type {
  ConversationAssignment,
  ConversationAssignmentChange,
  InternalNote,
  NewInternalNote,
  NewReplyTemplate,
  ReplyTemplate,
  ReplyTemplateChange,
  ReplyTemplatePage,
  SupportConversation,
  SupportInboxPage,
  SupportInboxQuery,
} from './support-inbox.types';
import { activityParams } from './support-activity';
import type { NewSupportInvitation, SupportInvitationCreated } from './support-invite.types';
import type { NewClinicalAccessRequest } from './support-inbox.types';
import {
  fromWireSupportAgenda,
  type WireSupportAgenda,
  type WireSupportFreeSlots,
} from './support-agenda.wire';
import {
  fromWireActivityPage,
  fromWireCatalog,
  fromWireConfirmed,
  fromWireDecision,
  fromWireEngagementPage,
  fromWireInvitation,
  fromWireMyEngagements,
  fromWireRedeem,
  fromWireRequest,
  fromWireRequestPage,
  fromWireTeam,
  toWireEngagementRequest,
  toWireInvitation,
  toWireRequestStatus,
} from './support-access.wire';

/**
 * Cliente del **personal de apoyo** (secretaria y otros roles): persona de
 * apoyo, organización, doctor y los dos gestos del chat.
 *
 * Las rutas son las del contrato compartido con la API. Tres lecturas no
 * figuran en él y las pide la pantalla —la lista del equipo, el catálogo de
 * ubicaciones y la lista de invitaciones emitidas—: están marcadas como
 * **propuesta** para que la API las confirme o las nombre distinto.
 *
 * Es solo transporte. Quien decide si una persona puede hacer algo es
 * `SupportAccessPolicy` en la API; lo que vuelve en `allowedActions` ya es esa
 * decisión, y la pantalla la pinta sin recalcularla.
 */
/** Cuántas solicitudes se piden por página y cuántas páginas se juntan como máximo. */
const PAGINA_DE_SOLICITUDES = 100;
const MAX_PAGINAS_DE_SOLICITUDES = 20;

@Injectable({
  providedIn: 'root',
})
export class SupportAccessClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly terminology = inject(TerminologyClient);

  /* ---- persona de apoyo ---------------------------------------------------- */

  /** `GET /me/support-engagements` — mis vínculos y mis solicitudes. */
  listMyEngagements(): Observable<MySupportEngagements> {
    return this.http
      .get<MySupportEngagements>(this.url('/me/support-engagements'))
      .pipe(map(fromWireMyEngagements));
  }

  /**
   * `GET /me/support-catalog?org` — doctores, servicios y ubicaciones de una
   * organización donde ya tengo vínculo, para elegir qué pedir. **Propuesta**:
   * no está en el contrato; el catálogo de `GET /org/support-catalog` es de quien
   * administra, no de la persona de apoyo.
   */
  getMyCatalog(org: string): Observable<SupportCatalog> {
    return this.http
      .get<SupportCatalog>(this.url('/me/support-catalog'), {
        params: new HttpParams().set('org', org),
      })
      .pipe(map(fromWireCatalog));
  }

  /** `POST /support-engagement-requests` — pedir un vínculo o ampliar uno existente. */
  requestEngagement(request: NewSupportEngagementRequest): Observable<SupportEngagementRequest> {
    return this.http
      .post<SupportEngagementRequest>(
        this.url('/support-engagement-requests'),
        toWireEngagementRequest(request),
      )
      .pipe(map(fromWireRequest));
  }

  /**
   * `POST /me/support-access-requests` — la persona de apoyo pide **acceso clínico temporal** a un paciente. Lo decide el doctor titular
   * de la delegación (`POST /access-requests/:id/decision`). Sin tenant activo: la organización va en el cuerpo. No es la ruta de
   * `POST /practitioner-delegates/:id/access-requests`, que es de la administración (`SECURITY_ADMIN`).
   */
  requestClinicalAccess(
    request: NewClinicalAccessRequest,
  ): Observable<{ readonly id: string; readonly tenantId?: string }> {
    return this.http.post<{ readonly id: string; readonly tenantId?: string }>(
      this.url('/me/support-access-requests'),
      request,
    );
  }

  /** `POST /affiliation-invitations/redeem` — unirse con el código o el QR. */
  redeemInvitation(code: string): Observable<InvitationRedeemResult> {
    return this.http
      .post<InvitationRedeemResult>(this.url('/affiliation-invitations/redeem'), { code })
      .pipe(map(fromWireRedeem));
  }

  /**
   * `GET /me/support-agenda` — la agenda combinada que esta persona puede ver.
   *
   * Los filtros viajan como listas separadas por coma. La respuesta trae
   * también las opciones de filtro (doctores, servicios, ubicaciones) que la
   * persona tiene a la vista, para no pedir un catálogo aparte.
   */
  getSupportAgenda(query: SupportAgendaQuery): Observable<SupportAgenda> {
    let params = new HttpParams()
      .set('tenantId', query.org)
      .set('from', query.from)
      .set('to', query.to);
    if (query.doctors !== undefined && query.doctors.length > 0) {
      params = params.set('doctors', query.doctors.join(','));
    }
    if (query.services !== undefined && query.services.length > 0) {
      params = params.set('services', query.services.join(','));
    }
    if (query.locations !== undefined && query.locations.length > 0) {
      params = params.set('locations', query.locations.join(','));
    }
    const agenda$ = this.http.get<WireSupportAgenda>(this.url('/me/support-agenda'), { params });
    // La API solo devuelve citas. Los horarios libres (para crear una cita) los sirve **solo el simulador**; con la API real
    // no hay de dónde sacarlos para el personal de apoyo, y la agenda muestra solo lo reservado.
    const free$ = environment.mockBackend
      ? this.http
          .get<WireSupportFreeSlots>(this.url('/me/support-agenda/free-slots'), { params })
          .pipe(catchError(() => of(undefined)))
      : of(undefined);
    // La agenda identifica al doctor por su perfil profesional; las aprobaciones piden su asignación de rol, que solo trae el catálogo.
    const catalog$ = this.getMyCatalog(query.org).pipe(catchError(() => of(null)));
    return forkJoin([agenda$, free$, catalog$]).pipe(
      switchMap(([wire, free, catalog]) =>
        // El estado llega como concepto: se pide su código a la terminología (una sola lectura por ids distintos).
        this.terminology.readConceptLabels(wire.items.map((i) => i.statusConceptId)).pipe(
          catchError(() => of(new Map<string, { readonly code: string }>())),
          map((labels) => fromWireSupportAgenda(wire, (id) => labels.get(id)?.code, free, catalog)),
        ),
      ),
    );
  }

  /**
   * `GET /me/support-activity` — «Mi actividad»: lo que hizo esta persona de
   * apoyo, en todas las organizaciones donde ayuda (o en una, con `tenantId`).
   * Filtros y cursor los resuelve la API.
   */
  getMyActivity(query: SupportActivityQuery = {}): Observable<SupportActivityPage> {
    return this.http
      .get<SupportActivityPage>(this.url('/me/support-activity'), {
        params: new HttpParams({ fromObject: { ...activityParams(query) } }),
      })
      .pipe(map(fromWireActivityPage));
  }

  /**
   * `POST /me/support-engagements/:id/confirm` — la persona declara que **sigue
   * trabajando** en esa organización (sin cuerpo). Responde el vínculo y
   * `reactivated`.
   *
   * La decisión de producto es que esto sea solo una declaración y que **renovar o
   * reactivar el vínculo sea de la organización** (`/org/.../recertify`); la API de hoy
   * deja que la propia persona reactive uno suspendido, y por eso la pantalla no le
   * ofrece este gesto cuando está suspendido.
   */
  confirmMyEngagement(engagementId: string): Observable<ConfirmedSupportEngagement> {
    return this.http
      .post<ConfirmedSupportEngagement>(
        this.url(`/me/support-engagements/${encodeURIComponent(engagementId)}/confirm`),
        {},
      )
      .pipe(map(fromWireConfirmed));
  }

  /**
   * `GET /me/support-inbox` — mensajes administrativos de los doctores que cubro.
   *
   * El contrato fija `status` y `doctor`; `org` es una **propuesta** (ver
   * {@link SupportInboxQuery}). La API aísla por organización: solo devuelve
   * conversaciones de una donde la persona tiene un vínculo vigente.
   */
  getSupportInbox(query: SupportInboxQuery = {}): Observable<SupportInboxPage> {
    let params = new HttpParams();
    if (query.status !== undefined) params = params.set('status', query.status);
    if (query.doctor !== undefined) params = params.set('doctor', query.doctor);
    if (query.org !== undefined) params = params.set('tenantId', query.org);
    return this.http.get<SupportInboxPage>(this.url('/me/support-inbox'), { params });
  }

  /**
   * `GET /me/support-inbox/:conversationId` — una conversación completa para el
   * equipo: mensajes con la autora real, notas internas, y lo que se puede
   * hacer con ella. **Propuesta**: el contrato no trae una lectura para quien no
   * es participante del chat (`GET /community/conversations/:id/messages` exige
   * serlo), y esta es la que la bandeja necesita.
   */
  getSupportConversation(conversationId: string, org: string): Observable<SupportConversation> {
    return this.http.get<SupportConversation>(
      this.url(`/me/support-inbox/${encodeURIComponent(conversationId)}`),
      {
        params: new HttpParams().set('tenantId', org),
      },
    );
  }

  /**
   * `GET /me/support-reply-templates` — plantillas de respuesta rápida de una
   * organización (tabla `community.reply_templates`). **Propuesta**: el contrato
   * declara la tabla pero no la lectura.
   */
  listReplyTemplates(org: string): Observable<ReplyTemplatePage> {
    return this.http.get<ReplyTemplatePage>(this.url('/me/support-reply-templates'), {
      params: new HttpParams().set('tenantId', org),
    });
  }

  /* ---- organización -------------------------------------------------------- */

  /** `GET /org/support-engagements` — el equipo de apoyo. **Propuesta**: no está en el contrato. */
  listEngagements(): Observable<SupportEngagementPage> {
    return this.http
      .get<SupportEngagementPage>(this.url('/org/support-engagements'))
      .pipe(map(fromWireEngagementPage));
  }

  /** `GET /org/support-catalog` — doctores, servicios y ubicaciones. **Propuesta**: no está en el contrato. */
  getCatalog(): Observable<SupportCatalog> {
    return this.http
      .get<SupportCatalog>(this.url('/org/support-catalog'))
      .pipe(map(fromWireCatalog));
  }

  /**
   * `GET /org/support-engagement-requests?status&limit&cursor` — la bandeja de solicitudes.
   *
   * La API pagina (25 por página por omisión, hasta 100) y la bandeja filtra y pagina
   * en pantalla, así que acá se **juntan todas las páginas** (de 100 en 100, con un tope
   * de 20 para no quedar en un ciclo). `PARTIAL` no es un filtro válido de la API: se
   * pide todo y se recorta en pantalla.
   */
  listRequests(status?: SupportRequestStatus): Observable<SupportRequestPage> {
    const estado = toWireRequestStatus(status);
    const pagina = (cursor?: string): Observable<SupportRequestPage> => {
      let params = new HttpParams().set('limit', String(PAGINA_DE_SOLICITUDES));
      if (estado !== undefined) params = params.set('status', estado);
      if (cursor !== undefined) params = params.set('cursor', cursor);
      return this.http
        .get<SupportRequestPage>(this.url('/org/support-engagement-requests'), { params })
        .pipe(map(fromWireRequestPage));
    };
    return pagina().pipe(
      expand((actual, indice) =>
        actual.nextCursor !== null &&
        actual.nextCursor !== undefined &&
        indice < MAX_PAGINAS_DE_SOLICITUDES - 1
          ? pagina(actual.nextCursor)
          : EMPTY,
      ),
      reduce<SupportRequestPage, SupportRequestPage>(
        (junto, actual) => ({
          items: [...junto.items, ...actual.items],
          nextCursor: actual.nextCursor ?? null,
        }),
        { items: [], nextCursor: null },
      ),
      map((todo) =>
        status === 'PARTIAL'
          ? { ...todo, items: todo.items.filter((r) => r.status === 'PARTIAL') }
          : todo,
      ),
    );
  }

  /**
   * `POST /org/support-engagement-requests/:id/decision` — aprobar, ajustar o rechazar
   * ítem por ítem. La API responde cómo quedó (`status`, `engagementId`, `grantIds`),
   * no la solicitud: para verla, se vuelve a leer la bandeja.
   */
  decideRequest(
    requestId: string,
    decision: SupportRequestDecision,
  ): Observable<EngagementDecisionResult> {
    return this.http
      .post<EngagementDecisionResult>(
        this.url(`/org/support-engagement-requests/${encodeURIComponent(requestId)}/decision`),
        decision,
      )
      .pipe(map(fromWireDecision));
  }

  /** `GET /org/support-engagements/:id/grants` — los permisos de una persona. */
  listGrants(engagementId: string): Observable<readonly SupportGrant[]> {
    return this.http.get<readonly SupportGrant[]>(this.grantsUrl(engagementId));
  }

  /** `POST /org/support-engagements/:id/grants` — agrega un permiso. */
  createGrant(
    engagementId: string,
    grant: NewSupportGrant | NewAtomGrant,
  ): Observable<{ readonly id: string; readonly status: string } | GrantChangePending> {
    // Pide el segundo paso (`STEP_UP_REQUIRED`): el diálogo lo resuelve y repite la misma petición. Un átomo CRÍTICA responde 202.
    return this.http.post<{ readonly id: string; readonly status: string } | GrantChangePending>(
      this.grantsUrl(engagementId),
      grant,
      { context: withAccessChallenge({ actionLabel: 'Guardar los permisos' }) },
    );
  }

  /** `PATCH /org/support-engagements/:id/grants` — cambia o retira un permiso. */
  changeGrant(
    engagementId: string,
    change: SupportGrantChange | AtomGrantChange,
  ): Observable<OperationResult | GrantChangePending> {
    return this.http.patch<OperationResult | GrantChangePending>(
      this.grantsUrl(engagementId),
      change,
      { context: withAccessChallenge({ actionLabel: 'Guardar los permisos' }) },
    );
  }

  /** `GET /org/access-lookup` — quién puede actuar sobre un doctor, un servicio o una ubicación. */
  lookupAccess(query: AccessLookupQuery): Observable<AccessLookupResult> {
    const params = new HttpParams().set(query.kind, query.id);
    return this.http.get<AccessLookupResult>(this.url('/org/access-lookup'), { params });
  }

  /** `POST /org/affiliation-invitations` — emite una invitación (un solo uso o varios) con su código. */
  createInvitation(invitation: NewAffiliationInvitation): Observable<AffiliationInvitation> {
    return this.http
      .post<AffiliationInvitation>(
        this.url('/org/affiliation-invitations'),
        toWireInvitation(invitation),
      )
      .pipe(map(fromWireInvitation));
  }

  /** `GET /org/affiliation-invitations` — las emitidas. **Propuesta**: no está en el contrato. */
  listInvitations(): Observable<AffiliationInvitationPage> {
    return this.http
      .get<AffiliationInvitationPage>(this.url('/org/affiliation-invitations'))
      .pipe(map((page) => ({ ...page, items: page.items.map(fromWireInvitation) })));
  }

  /**
   * `GET /org/support-activity` — la bitácora de la organización, con los filtros de
   * `SupportActivityQuery` (los resuelve la API) y paginada por cursor.
   */
  getOrganizationActivity(query: SupportActivityQuery = {}): Observable<SupportActivityPage> {
    return this.http
      .get<SupportActivityPage>(this.url('/org/support-activity'), {
        params: new HttpParams({ fromObject: { ...activityParams(query) } }),
      })
      .pipe(map(fromWireActivityPage));
  }

  /** `POST /org/support-engagements/:id/recertify` — confirmar el vínculo por 6 o 12 meses más. */
  recertify(engagementId: string, months?: 6 | 12): Observable<OperationResult> {
    // Sin `months` el cuerpo va vacío: `recertifyEveryMonths` es opcional y la API repite el período del vínculo.
    return this.http.post<OperationResult>(
      this.url(`/org/support-engagements/${encodeURIComponent(engagementId)}/recertify`),
      months === undefined ? {} : { recertifyEveryMonths: months },
    );
  }

  /** `POST /org/support-engagements/:id/end` — fin del vínculo: revocación inmediata. */
  endEngagement(engagementId: string, reasonText?: string): Observable<OperationResult> {
    // `EndEngagementDto.reason` es obligatorio en la API.
    return this.http.post<OperationResult>(
      this.url(`/org/support-engagements/${encodeURIComponent(engagementId)}/end`),
      { reason: reasonText ?? '' },
    );
  }

  /** `GET /org/session-policies`. */
  getSessionPolicies(): Observable<SessionPolicies> {
    return this.http.get<SessionPolicies>(this.url('/org/session-policies'));
  }

  /** `PUT /org/session-policies`. */
  putSessionPolicies(policies: SessionPolicies): Observable<SessionPolicies> {
    return this.http.put<SessionPolicies>(this.url('/org/session-policies'), policies);
  }

  /** `GET /org/ip-access-rules` — las redes de la organización, en el orden en que se guardaron. */
  getIpAccessRules(): Observable<IpAccessRules> {
    return this.http.get<IpAccessRules>(this.url('/org/ip-access-rules'));
  }

  /**
   * `PUT /org/ip-access-rules` — **reemplaza** el conjunto entero (hasta 50 reglas; vacío
   * = sin restricción de red). Un rango inválido es `422 IP_RULE_CIDR_INVALID`, una
   * vigencia al revés `IP_RULE_VALIDITY_INVALID`, y un conjunto que dejaría fuera la
   * red de quien lo guarda `IP_RULES_WOULD_LOCK_OUT_ACTOR`: en los tres casos no se
   * cambia nada.
   */
  putIpAccessRules(rules: readonly IpAccessRule[]): Observable<IpAccessRules> {
    return this.http.put<IpAccessRules>(this.url('/org/ip-access-rules'), { rules });
  }

  /** `GET /org/reply-templates` — las respuestas preparadas de la organización, también las retiradas. */
  listOrgReplyTemplates(): Observable<ReplyTemplatePage> {
    return this.http.get<ReplyTemplatePage>(this.url('/org/reply-templates'));
  }

  /** `POST /org/reply-templates` — crea una respuesta preparada (administrativa: nunca clínica). */
  createReplyTemplate(template: NewReplyTemplate): Observable<ReplyTemplate> {
    return this.http.post<ReplyTemplate>(this.url('/org/reply-templates'), template);
  }

  /**
   * `PATCH /org/reply-templates/:id` — la cambia, la retira o la reactiva. Con
   * `expectedVersion` (la `version` que quien edita vio) la API no pisa lo que otra
   * persona cambió: `409 REPLY_TEMPLATE_STALE` con `details.currentVersion`.
   */
  updateReplyTemplate(templateId: string, change: ReplyTemplateChange): Observable<ReplyTemplate> {
    return this.http.patch<ReplyTemplate>(
      this.url(`/org/reply-templates/${encodeURIComponent(templateId)}`),
      change,
    );
  }

  /* ---- doctor -------------------------------------------------------------- */

  /** `GET /me/practitioner/support-team` — «Mi equipo». Devuelve lista vacía en 404/0. */
  getMyTeam(): Observable<DoctorTeam> {
    return this.http.get<DoctorTeam>(this.url('/me/practitioner/support-team')).pipe(
      map(fromWireTeam),
      catchError(() => of({ items: [] })),
    );
  }

  /**
   * `POST /me/practitioner/support-invitations` — el doctor invita a una secretaria registrada (por su documento) a
   * asistirlo en una de sus vinculaciones con un hospital. Roles de la API: `PRACTITIONER` y `CLINICIAN`.
   *
   * El vínculo nace **pendiente** (`awaiting: 'SUPPORT_STAFF'`): lo decide la secretaria y esto no concede nada. Los
   * rechazos que la pantalla explica llegan con su `reason`: `SUPPORT_STAFF_NOT_FOUND` (404, no hay una secretaria con ese
   * documento), `SUPPORT_TARGET_NOT_FOUND` (404, la vinculación no es suya) y `SUPPORT_LINK_DUPLICATE` (409, ya hay un
   * vínculo vivo con ella).
   */
  inviteSupportStaff(invitation: NewSupportInvitation): Observable<SupportInvitationCreated> {
    return this.http.post<SupportInvitationCreated>(
      this.url('/me/practitioner/support-invitations'),
      invitation,
    );
  }

  /** `POST /practitioner-delegates/:id/accept` — el doctor acepta a esa persona. */
  acceptDelegate(
    delegateId: string,
    acceptance: DelegateAcceptance = {},
  ): Observable<OperationResult> {
    // `AcceptSupportDelegateDto.acceptsSupportClause` es obligatorio y solo vale `true`:
    // aceptar a la persona es aceptar la cláusula de personal de apoyo.
    return this.http.post<OperationResult>(
      this.url(`/practitioner-delegates/${encodeURIComponent(delegateId)}/accept`),
      {
        acceptsSupportClause: true,
        ...acceptance,
      },
    );
  }

  /** `PATCH /practitioner-delegates/:id/reply-settings` — responder en mi nombre y mostrar «respondido por su equipo». */
  setReplySettings(
    delegateId: string,
    settings: DelegateReplySettings,
  ): Observable<OperationResult> {
    return this.http.patch<OperationResult>(
      this.url(`/practitioner-delegates/${encodeURIComponent(delegateId)}/reply-settings`),
      settings,
    );
  }

  /** `GET /me/practitioner/support-activity` — qué hizo mi equipo, con los mismos filtros y cursor. */
  getMyTeamActivity(query: SupportActivityQuery = {}): Observable<SupportActivityPage> {
    return this.http
      .get<SupportActivityPage>(this.url('/me/practitioner/support-activity'), {
        params: new HttpParams({ fromObject: { ...activityParams(query) } }),
      })
      .pipe(
        map(fromWireActivityPage),
        catchError(() => of({ items: [], count: 0, nextCursor: null })),
      );
  }

  /* ---- chat ---------------------------------------------------------------- */

  /** `POST /community/conversations/:id/assignment` — tomar, esperar al doctor o resolver. */
  assignConversation(
    conversationId: string,
    change: ConversationAssignmentChange,
    options?: ChallengeRequestOptions,
  ): Observable<ConversationAssignment> {
    return this.http.post<ConversationAssignment>(
      this.url(`/community/conversations/${encodeURIComponent(conversationId)}/assignment`),
      change,
      options,
    );
  }

  /** `POST /community/conversations/:id/internal-notes` — nota que el paciente nunca ve. */
  addInternalNote(
    conversationId: string,
    note: NewInternalNote,
    options?: ChallengeRequestOptions,
  ): Observable<InternalNote> {
    return this.http.post<InternalNote>(
      this.url(`/community/conversations/${encodeURIComponent(conversationId)}/internal-notes`),
      note,
      options,
    );
  }

  private grantsUrl(engagementId: string): string {
    return this.url(`/org/support-engagements/${encodeURIComponent(engagementId)}/grants`);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
