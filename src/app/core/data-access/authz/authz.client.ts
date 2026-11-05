import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { TENANT_HEADER } from '../../http/auth.interceptor';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccessRequestItem,
  AuthzScopeQuery,
  BreakTheGlassInput,
  CareRelationship,
  CareRelationshipDecision,
  CareRelationshipRequestInput,
  CareRelationshipRespondInput,
  LegalRepresentation,
  MyClinicalAccess,
} from './authz.types';

/**
 * Cliente de `authz` (M06) — las bases legítimas de acceso de un paciente.
 *
 * ## Por qué las dos lecturas exigen paciente
 *
 * El backend no publica un listado global de relaciones asistenciales, y no es
 * una omisión: la lista completa de «quién atiende a quién» de una organización
 * es un mapa de la actividad clínica entera. Se lee de a un paciente, que es
 * como se usa —desde su ficha— y como se puede auditar.
 *
 * Las respuestas son arrays desnudos, sin sobre de paginación: es la forma que
 * declara el contrato, no un descuido de este cliente.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthzClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /authz/care-relationships` — quién atiende a este paciente y desde
   * cuándo. Requiere `CLINICIAN` o `SECURITY_ADMIN`.
   */
  listCareRelationships(query: AuthzScopeQuery): Observable<readonly CareRelationship[]> {
    return this.http
      .get<readonly WireCareRelationship[]>(this.url('/authz/care-relationships'), {
        params: alcanceDe(query),
      })
      .pipe(map((items) => items.map(toCareRelationship)));
  }

  /**
   * `GET /authz/legal-representations` — quién representa legalmente al
   * paciente. Requiere `SECURITY_ADMIN`.
   */
  listLegalRepresentations(query: AuthzScopeQuery): Observable<readonly LegalRepresentation[]> {
    return this.http
      .get<readonly WireLegalRepresentation[]>(this.url('/authz/legal-representations'), {
        params: alcanceDe(query),
      })
      .pipe(map((items) => items.map(toLegalRepresentation)));
  }

  /**
   * `POST /authz/care-relationships/request` — el profesional que encontró al
   * paciente en la búsqueda le pide el vínculo (FT-07-R05). Nace `PENDING` y no
   * concede nada hasta que el paciente responda.
   */
  requestCareRelationship(
    input: CareRelationshipRequestInput,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url('/authz/care-relationships/request'),
      input,
    );
  }

  /**
   * `GET /authz/me/access-requests` — the patient's inbox: received, sent and
   * decided requests of every kind, for the active tenant. The subject is the
   * session, so it takes no parameters.
   */
  listMyAccessRequests(): Observable<readonly AccessRequestItem[]> {
    return this.http
      .get<readonly WireAccessRequestItem[]>(this.url('/authz/me/access-requests'))
      .pipe(map((items) => items.map(toAccessRequestItem)));
  }

  /** `GET /authz/practitioners/me/access-requests` — the same inbox, seen by the practitioner. */
  listPractitionerAccessRequests(): Observable<readonly AccessRequestItem[]> {
    return this.http
      .get<readonly WireAccessRequestItem[]>(this.url('/authz/practitioners/me/access-requests'))
      .pipe(map((items) => items.map(toAccessRequestItem)));
  }

  /**
   * `POST /authz/me/primary-practitioner-requests` — the patient asks a
   * practitioner to be their primary practitioner. It is born `PENDING` until
   * the practitioner accepts. `X-Tenant-Id` is the practitioner's organization,
   * not the patient's active one: the interceptor keeps a header it finds.
   */
  requestPrimaryPractitioner(practitionerProfileId: string, tenantId: string): Observable<void> {
    return this.http
      .post(
        this.url('/authz/me/primary-practitioner-requests'),
        { practitionerProfileId },
        { headers: new HttpHeaders({ [TENANT_HEADER]: tenantId }) },
      )
      .pipe(map(() => undefined));
  }

  /** `POST /authz/practitioners/me/care-relationships/:id/respond` — the practitioner answers a patient's request. */
  respondAsPractitioner(id: string, decision: CareRelationshipDecision): Observable<void> {
    return this.http
      .post(this.url(`/authz/practitioners/me/care-relationships/${encodeURIComponent(id)}/respond`), {
        decision,
      })
      .pipe(map(() => undefined));
  }

  /**
   * `POST /authz/care-relationships/:id/respond` — el paciente acepta o
   * rechaza la solicitud de un profesional (FT-07-R06/R07).
   */
  respondToCareRelationshipRequest(
    id: string,
    input: CareRelationshipRespondInput,
  ): Observable<{ readonly ok: boolean }> {
    return this.http.post<{ readonly ok: boolean }>(
      this.url(`/authz/care-relationships/${encodeURIComponent(id)}/respond`),
      input,
    );
  }

  /**
   * `GET /authz/me/access` — «Quién ve mi historia»: las relaciones asistenciales
   * (con el nombre del profesional) y los accesos clínicos concedidos, los de
   * emergencia incluidos. La persona sale de la sesión.
   */
  getMyClinicalAccess(): Observable<MyClinicalAccess> {
    return this.http.get<WireMyClinicalAccess>(this.url('/authz/me/access')).pipe(
      map((body) => ({
        careRelationships: body.careRelationships.map(({ validFrom, validTo, ...resto }) => ({
          ...resto,
          validFrom: new Date(validFrom),
          ...hasta(validTo),
        })),
        grants: body.grants.map(({ validFrom, validTo, ...resto }) => ({
          ...resto,
          validFrom: new Date(validFrom),
          validTo: new Date(validTo),
        })),
      })),
    );
  }

  /**
   * `POST /authz/me/care-relationships/:id/revoke` — el paciente revoca un vínculo.
   * Lo ajeno responde 404. Desde ese momento el profesional recibe 403 al abrir
   * la historia sin un turno de hoy.
   */
  revokeMyCareRelationship(id: string): Observable<{ readonly ok: boolean }> {
    return this.http.post<{ readonly ok: boolean }>(
      this.url(`/authz/me/care-relationships/${encodeURIComponent(id)}/revoke`),
      {},
    );
  }

  /** `POST /authz/me/clinical-access-grants/:grantId/revoke` — revoca un acceso clínico. */
  revokeMyClinicalGrant(grantId: string): Observable<{ readonly ok: boolean }> {
    return this.http.post<{ readonly ok: boolean }>(
      this.url(`/authz/me/clinical-access-grants/${encodeURIComponent(grantId)}/revoke`),
      {},
    );
  }

  /**
   * `POST /authz/patients/:id/break-the-glass` — acceso de emergencia (UC-06-07).
   * Sólo lo permite el rol de aprobación clínica (`CLINICAL_APPROVER`) o
   * `SECURITY_ADMIN`; queda auditado y el paciente lo ve en «Quién ve mi historia».
   */
  breakTheGlass(
    patientProfileId: string,
    input: BreakTheGlassInput,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(`/authz/patients/${encodeURIComponent(patientProfileId)}/break-the-glass`),
      input,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

interface WireMyClinicalAccess {
  readonly careRelationships: readonly (Omit<
    MyClinicalAccess['careRelationships'][number],
    'validFrom' | 'validTo'
  > & { readonly validFrom: string; readonly validTo?: string | null })[];
  readonly grants: readonly (Omit<MyClinicalAccess['grants'][number], 'validFrom' | 'validTo'> & {
    readonly validFrom: string;
    readonly validTo: string;
  })[];
}

/** Los dos parámetros obligatorios, que son los mismos en ambas lecturas. */
function alcanceDe(query: AuthzScopeQuery): HttpParams {
  return new HttpParams()
    .set('tenantId', query.tenantId)
    .set('patientProfileId', query.patientProfileId);
}

/* ---- formas de transporte ------------------------------------------------ */

type WireCareRelationship = Omit<CareRelationship, 'validFrom' | 'validTo'> & {
  readonly validFrom: string;
  readonly validTo?: string | null;
};

type WireLegalRepresentation = Omit<LegalRepresentation, 'validFrom' | 'validTo'> & {
  readonly validFrom: string;
  readonly validTo?: string | null;
};

function toCareRelationship({
  validFrom,
  validTo,
  ...resto
}: WireCareRelationship): CareRelationship {
  return { ...resto, validFrom: new Date(validFrom), ...hasta(validTo) };
}

type WireAccessRequestItem = Omit<AccessRequestItem, 'requestedAt' | 'decidedAt'> & {
  readonly requestedAt: string;
  readonly decidedAt?: string | null;
};

function toAccessRequestItem({ requestedAt, decidedAt, ...rest }: WireAccessRequestItem): AccessRequestItem {
  return {
    ...rest,
    requestedAt: new Date(requestedAt),
    ...(decidedAt === null || decidedAt === undefined ? {} : { decidedAt: new Date(decidedAt) }),
  };
}

function toLegalRepresentation({
  validFrom,
  validTo,
  ...resto
}: WireLegalRepresentation): LegalRepresentation {
  return { ...resto, validFrom: new Date(validFrom), ...hasta(validTo) };
}

/**
 * El fin de la ventana, o nada.
 *
 * Sin `validTo` la relación es abierta —vigente hasta que se revoque—, que es
 * distinto de una con fin en el pasado. Dejar la clave ausente en vez de ponerla
 * en `undefined` conserva esa distinción para `in` y para `Object.keys`.
 */
function hasta(value: string | null | undefined): { readonly validTo?: Date } {
  return value === null || value === undefined ? {} : { validTo: new Date(value) };
}
