import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { CostCenter, InfrastructureItem } from './infrastructure-items.types';

/**
 * Cliente de contabilidad por espacio — franja F5f.
 *
 * Ubicar un activo valida que el espacio sea de la misma práctica (422
 * `INFRASTRUCTURE_SPACE_PRACTICE_MISMATCH`); ligar un centro de costo, que la
 * unidad no tenga ya uno vigente (409 `UNIT_ALREADY_HAS_COST_CENTER`). Los
 * cargos de día-cama toman el centro de costo de la unidad dueña de la cama.
 */
@Injectable({ providedIn: 'root' })
export class InfrastructureItemsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /accounting/infrastructure-items?practiceId` — desvío anotado: la lista. */
  listItems(practiceId: string): Observable<readonly InfrastructureItem[]> {
    return this.http.get<readonly InfrastructureItem[]>(this.url('/accounting/infrastructure-items'), { params: new HttpParams().set('practiceId', practiceId) });
  }

  /**
   * `PATCH /accounting/infrastructure-items/:id {careSpaceId}` con `If-Match`
   * de la versión leída: dos ubicaciones simultáneas no se pisan (412).
   */
  locateItem(id: string, careSpaceId: string | null, rowVersion: number): Observable<InfrastructureItem> {
    return this.http.patch<InfrastructureItem>(this.url(`/accounting/infrastructure-items/${encodeURIComponent(id)}`), { careSpaceId }, { headers: new HttpHeaders({ 'If-Match': `"${rowVersion}"` }) });
  }

  /** `GET /accounting/cost-centers?practiceId` — desvío anotado: la lista. */
  listCostCenters(practiceId: string): Observable<readonly CostCenter[]> {
    return this.http.get<readonly CostCenter[]>(this.url('/accounting/cost-centers'), { params: new HttpParams().set('practiceId', practiceId) });
  }

  /** `POST /accounting/cost-centers/:id/unit-link {clinicalUnitId}`. */
  linkUnit(id: string, clinicalUnitId: string): Observable<CostCenter> {
    return this.http.post<CostCenter>(this.url(`/accounting/cost-centers/${encodeURIComponent(id)}/unit-link`), { clinicalUnitId });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
