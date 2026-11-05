import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AssignHandoverResult,
  ConfidentialityAckResult,
  Handover,
  HandoverPreview,
  IdentityVerificationRequest,
  LifecycleCaseDetail,
  LifecycleCaseExport,
  LifecycleCaseList,
  LifecycleCaseQuery,
  MoveEngagementRequest,
  MoveResult,
  OffboardRequest,
  OffboardResult,
  OwnerChange,
  ReactivateRequest,
  SuspendRequest,
  SuspensionResult,
} from './access-lifecycle.types';
import type { OperationResult } from '../delegated-access/delegated-access.types';

/**
 * Cliente del **ciclo de vida** del personal de apoyo (CONTRATO-GOBIERNO §6.1, §8.3 bloque D): ingreso, cambio de rol o
 * alcance, baja con traspaso, suspensión y reactivación.
 *
 * `move` responde 200 si se ejecutó o **202** si exige cuatro ojos; `reactivate` responde 202 siempre. Quien baja primero
 * corta el acceso y recién después reasigna: un fallo del traspaso no deshace la baja.
 */
@Injectable({ providedIn: 'root' })
export class AccessLifecycleClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---- casos ------------------------------------------------------------------------------------ */

  /** `GET /org/lifecycle/cases?kind&status`. */
  listCases(query: LifecycleCaseQuery = {}): Observable<LifecycleCaseList> {
    let params = new HttpParams();
    if (query.kind !== undefined) params = params.set('kind', query.kind);
    if (query.status !== undefined) params = params.set('status', query.status);
    return this.http.get<LifecycleCaseList>(this.url('/org/lifecycle/cases'), { params });
  }

  /** `GET /org/lifecycle/cases/:id` — lista de verificación y traspasos. */
  getCase(caseId: string): Observable<LifecycleCaseDetail> {
    return this.http.get<LifecycleCaseDetail>(this.caseUrl(caseId));
  }

  /** `POST …/cases/:id/checklist/:code` — 409 `LIFECYCLE_ITEM_AUTOMATIC` si el paso lo completa el sistema. */
  completeChecklistItem(caseId: string, code: string, note?: string): Observable<LifecycleCaseDetail> {
    return this.http.post<LifecycleCaseDetail>(`${this.caseUrl(caseId)}/checklist/${encodeURIComponent(code)}`, note === undefined ? {} : { note });
  }

  /** `POST …/cases/:id/handover/assign` — reasigna lo que quedó pendiente. */
  assignHandover(caseId: string, handover: Handover): Observable<AssignHandoverResult> {
    return this.http.post<AssignHandoverResult>(`${this.caseUrl(caseId)}/handover/assign`, handover);
  }

  /** `GET …/cases/:id/export` — registro de transferencia (auditado). */
  exportCase(caseId: string): Observable<LifecycleCaseExport> {
    return this.http.get<LifecycleCaseExport>(`${this.caseUrl(caseId)}/export`);
  }

  /* ---- sobre un vínculo ----------------------------------------------------------------------------- */

  /** `POST /org/support-engagements/:id/identity-verification`. */
  verifyIdentity(engagementId: string, request: IdentityVerificationRequest): Observable<OperationResult> {
    return this.http.post<OperationResult>(`${this.engagementUrl(engagementId)}/identity-verification`, request);
  }

  /** `PUT /org/support-engagements/:id/owner` — el dueño de la cuenta (422 `GUARDRAIL_SELF_SUPERVISION`, `OWNER_NOT_ELIGIBLE`). */
  putOwner(engagementId: string, change: OwnerChange): Observable<OperationResult> {
    return this.http.put<OperationResult>(`${this.engagementUrl(engagementId)}/owner`, change);
  }

  /** `POST /me/support-engagements/:id/confidentiality-ack` — el compromiso de la propia persona. */
  acknowledgeConfidentiality(engagementId: string): Observable<ConfidentialityAckResult> {
    return this.http.post<ConfidentialityAckResult>(this.url(`/me/support-engagements/${encodeURIComponent(engagementId)}/confidentiality-ack`), {});
  }

  /** `POST /org/support-engagements/:id/move` — 200 o 202 (cuatro ojos); 409 `SOD_EXCEPTION_REQUIRED`, `SIMULATION_STALE`. */
  move(engagementId: string, request: MoveEngagementRequest): Observable<MoveResult> {
    return this.http.post<MoveResult>(`${this.engagementUrl(engagementId)}/move`, request);
  }

  /** `GET /org/support-engagements/:id/handover-preview` — qué tiene en las manos. */
  handoverPreview(engagementId: string): Observable<HandoverPreview> {
    return this.http.get<HandoverPreview>(`${this.engagementUrl(engagementId)}/handover-preview`);
  }

  /** `POST /org/support-engagements/:id/offboard` — revoca primero, reasigna después (422 `HANDOVER_SUPERVISOR_REQUIRED`). */
  offboard(engagementId: string, request: OffboardRequest): Observable<OffboardResult> {
    return this.http.post<OffboardResult>(`${this.engagementUrl(engagementId)}/offboard`, request);
  }

  /** `POST /org/support-engagements/:id/suspend` — inmediata (409 `ENGAGEMENT_ALREADY_SUSPENDED`). */
  suspend(engagementId: string, request: SuspendRequest): Observable<SuspensionResult> {
    return this.http.post<SuspensionResult>(`${this.engagementUrl(engagementId)}/suspend`, request);
  }

  /** `POST /org/support-engagements/:id/reactivate` — responde 202 y crea el cuatro ojos (409 `ENGAGEMENT_NOT_SUSPENDED`). */
  reactivate(engagementId: string, request: ReactivateRequest): Observable<SuspensionResult> {
    return this.http.post<SuspensionResult>(`${this.engagementUrl(engagementId)}/reactivate`, request);
  }

  private caseUrl(caseId: string): string {
    return this.url(`/org/lifecycle/cases/${encodeURIComponent(caseId)}`);
  }

  private engagementUrl(engagementId: string): string {
    return this.url(`/org/support-engagements/${encodeURIComponent(engagementId)}`);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
