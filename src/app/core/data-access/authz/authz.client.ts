import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AuthzScopeQuery,
  CareRelationship,
  CareRelationshipRequestInput,
  CareRelationshipRespondInput,
  LegalRepresentation,
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
   * `GET /authz/care-relationships/requests/mine` — la bandeja del paciente:
   * sus solicitudes todavía pendientes (FT-07-R06). El sujeto sale de la
   * sesión, por eso no lleva parámetros.
   */
  listMyPendingCareRelationshipRequests(): Observable<readonly CareRelationship[]> {
    return this.http
      .get<readonly WireCareRelationship[]>(this.url('/authz/care-relationships/requests/mine'))
      .pipe(map((items) => items.map(toCareRelationship)));
  }

  /**
   * `POST /authz/care-relationships/:id/respond` — el paciente acepta (con
   * las áreas que autoriza) o rechaza (FT-07-R06/R07).
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

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
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
