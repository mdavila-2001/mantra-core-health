import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  EngagementEffective,
  EngagementSummary,
  ExplainAccessRequest,
  ExplainAccessResponse,
  ExplainMyAccessRequest,
  ExplainTeamAccessRequest,
  PermissionCatalog,
  SimulateAccessRequest,
  SimulateAccessResponse,
} from './access-explain.types';

/**
 * Cliente de **explicar y simular** (CONTRATO-GOBIERNO §5, §8.3 bloque A).
 *
 * Es solo transporte: lo que explica es lo que decide, porque sale del mismo motor de la API. El front **no replica**
 * la semántica de las condiciones; pregunta. `simulate` no tiene efectos (no escribe, no consume contadores, no crea
 * aprobaciones) y responde 200 aun cuando el **borrador** tenga errores: esos viajan en `validation`.
 */
@Injectable({ providedIn: 'root' })
export class AccessExplainClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /org/access/explain` — por qué una persona puede o no hacer algo (administración). */
  explain(request: ExplainAccessRequest): Observable<ExplainAccessResponse> {
    return this.http.post<ExplainAccessResponse>(this.url('/org/access/explain'), request);
  }

  /** `POST /org/access/simulate` — qué cambiaría un borrador, sin guardarlo. Límite: 20 por minuto. */
  simulate(request: SimulateAccessRequest): Observable<SimulateAccessResponse> {
    return this.http.post<SimulateAccessResponse>(this.url('/org/access/simulate'), request);
  }

  /** `POST /me/support-access/explain` — «¿Por qué no puedo?»: la propia persona, con la organización en el cuerpo. */
  explainMine(request: ExplainMyAccessRequest): Observable<ExplainAccessResponse> {
    return this.http.post<ExplainAccessResponse>(this.url('/me/support-access/explain'), request);
  }

  /** `POST /me/practitioner/support-team/explain` — el doctor pregunta por alguien de su equipo y solo sobre su agenda. */
  explainTeam(request: ExplainTeamAccessRequest): Observable<ExplainAccessResponse> {
    return this.http.post<ExplainAccessResponse>(this.url('/me/practitioner/support-team/explain'), request);
  }

  /** `GET /org/permission-catalog` — los 73 átomos, las 7 categorías y los 15 alias. */
  getPermissionCatalog(): Observable<PermissionCatalog> {
    return this.http.get<PermissionCatalog>(this.url('/org/permission-catalog'));
  }

  /** `GET /org/support-engagements/:id/summary` — lo que la persona puede hacer, en oraciones (las arma el servidor). */
  getEngagementSummary(engagementId: string): Observable<EngagementSummary> {
    return this.http.get<EngagementSummary>(this.url(`/org/support-engagements/${encodeURIComponent(engagementId)}/summary`));
  }

  /** `GET /org/support-engagements/:id/effective` — átomos efectivos, si son condicionales y de dónde vienen. */
  getEngagementEffective(engagementId: string): Observable<EngagementEffective> {
    return this.http.get<EngagementEffective>(this.url(`/org/support-engagements/${encodeURIComponent(engagementId)}/effective`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
