import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  FloorPlanMeta,
  FloorPlanSummary,
  LayoutApplyResponse,
  LayoutPatch,
  LayoutQuery,
  LayoutResponse,
  PlanCardResponse,
  PlanCatalog,
  PlanFocusEntry,
  PlanLocation,
  PlanSearchHit,
  PlanStateQuery,
  PlanStateResponse,
  PlanValidationIssue,
  UnplacedSpace,
} from './floor-plan.types';

/**
 * Cliente del plano de planta — CONTRATO-PLANO §3 (módulo `practice`, franja F1c).
 *
 * Un método por fila del contrato, con las rutas tal cual. **La autoridad es
 * la API**: este cliente no decide qué se puede hacer, solo lo pide; un 403 o
 * un 404 llegan al llamador como `HttpErrorResponse` (léalos con
 * `readPlanFailure`).
 *
 * Contra la API real todavía no se probó nada de este cliente (la API de la
 * franja no existe al escribir esto); lo ejercita el backend simulado.
 */
@Injectable({ providedIn: 'root' })
export class FloorPlanClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practice/floor-plan-catalog` (§3.1). */
  getCatalog(): Observable<PlanCatalog> {
    return this.http.get<PlanCatalog>(this.url('/practice/floor-plan-catalog'));
  }

  /** `GET /sites/:siteId/floor-plans` (§3.2). */
  listPlans(siteId: string, includeRetired = false): Observable<readonly FloorPlanSummary[]> {
    let params = new HttpParams();
    if (includeRetired) params = params.set('includeRetired', 'true');
    return this.http.get<readonly FloorPlanSummary[]>(this.url(`/sites/${enc(siteId)}/floor-plans`), { params });
  }

  /** `GET /floor-plans/:id` (§3.2). */
  getPlan(planId: string): Observable<FloorPlanMeta> {
    return this.http.get<FloorPlanMeta>(this.url(`/floor-plans/${enc(planId)}`));
  }

  /** `GET /floor-plans/:id/layout` (§3.3). */
  getLayout(planId: string, query: LayoutQuery = {}): Observable<LayoutResponse> {
    let params = new HttpParams();
    if (query.bbox) params = params.set('bbox', query.bbox.join(','));
    if (query.detail) params = params.set('detail', query.detail);
    params = params.set('include', 'spaces,elements');
    if (query.limit !== undefined) params = params.set('limit', String(query.limit));
    if (query.cursor) params = params.set('cursor', query.cursor);
    if (query.focusSpaceId) params = params.set('focusSpaceId', query.focusSpaceId);
    if (query.unitId) params = params.set('unitId', query.unitId);
    if (query.unitMode) params = params.set('unitMode', query.unitMode);
    if (query.includeRetired) params = params.set('includeRetired', 'true');
    return this.http.get<LayoutResponse>(this.url(`/floor-plans/${enc(planId)}/layout`), { params });
  }

  /**
   * `PATCH /floor-plans/:id/layout` (§3.4): el delta del editor. `If-Match` es
   * el `layoutVersion`; con `dryRun` valida sin escribir.
   */
  patchLayout(planId: string, patch: LayoutPatch, layoutVersion: number, dryRun = false): Observable<LayoutApplyResponse> {
    let params = new HttpParams();
    if (dryRun) params = params.set('dryRun', 'true');
    return this.http.patch<LayoutApplyResponse>(this.url(`/floor-plans/${enc(planId)}/layout`), patch, {
      params,
      headers: new HttpHeaders({ 'If-Match': String(layoutVersion) }),
    });
  }

  /** `GET /floor-plans/:id/state` (§3.6): el estado, sin geometría. */
  getState(planId: string, query: PlanStateQuery = {}): Observable<PlanStateResponse> {
    let params = new HttpParams();
    if (query.bbox) params = params.set('bbox', query.bbox.join(','));
    if (query.focusSpaceId) params = params.set('focusSpaceId', query.focusSpaceId);
    if (query.unitId) params = params.set('unitId', query.unitId);
    return this.http.get<PlanStateResponse>(this.url(`/floor-plans/${enc(planId)}/state`), { params });
  }

  /** `GET /care-spaces/:id/plan-card` (§3.7): el nombre del paciente, solo si la API lo autoriza. */
  getPlanCard(spaceId: string): Observable<PlanCardResponse> {
    return this.http.get<PlanCardResponse>(this.url(`/care-spaces/${enc(spaceId)}/plan-card`));
  }

  /** `GET /care-spaces/:id/plan-location` (§3.5). */
  getPlanLocation(spaceId: string): Observable<PlanLocation> {
    return this.http.get<PlanLocation>(this.url(`/care-spaces/${enc(spaceId)}/plan-location`));
  }

  /** `GET /sites/:siteId/plan-search` (§3.5). */
  search(siteId: string, query: string, limit = 10): Observable<readonly PlanSearchHit[]> {
    const params = new HttpParams().set('q', query).set('limit', String(limit));
    return this.http.get<readonly PlanSearchHit[]>(this.url(`/sites/${enc(siteId)}/plan-search`), { params });
  }

  /** `GET /sites/:siteId/plan-focus` (§3.5): una entrada por lienzo. */
  getFocus(siteId: string, target: { spaceId?: string; unitId?: string }): Observable<readonly PlanFocusEntry[]> {
    let params = new HttpParams();
    if (target.spaceId) params = params.set('spaceId', target.spaceId);
    if (target.unitId) params = params.set('unitId', target.unitId);
    return this.http.get<readonly PlanFocusEntry[]>(this.url(`/sites/${enc(siteId)}/plan-focus`), { params });
  }

  /** `GET /floor-plans/:id/validation` (§3.5). */
  getValidation(planId: string): Observable<{ readonly issues: readonly PlanValidationIssue[] }> {
    return this.http.get<{ readonly issues: readonly PlanValidationIssue[] }>(this.url(`/floor-plans/${enc(planId)}/validation`));
  }

  /** `GET /floor-plans/:id/unplaced-spaces` (§3.5). */
  getUnplacedSpaces(planId: string): Observable<{ readonly items: readonly UnplacedSpace[]; readonly nextCursor: string | null }> {
    return this.http.get<{ readonly items: readonly UnplacedSpace[]; readonly nextCursor: string | null }>(
      this.url(`/floor-plans/${enc(planId)}/unplaced-spaces`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}
