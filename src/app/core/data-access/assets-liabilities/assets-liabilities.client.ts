import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AssetSummary,
  CapitalizeOwnAssetInput,
  CreateOwnLiabilityInput,
  LiabilityCreated,
  LiabilitySummary,
  ProgressRegistered,
  RegisterAssetProgressInput,
  RegisterLiabilityProgressInput,
} from './assets-liabilities.types';

/**
 * FT-26 — auto-servicio de activos y pasivos del doctor.
 *
 * Mismo patrón que `AccountingClient` (Carril 18): rutas bajo
 * `/accounting/practitioner/...`, sólo `PRACTITIONER` con vinculación activa
 * a la práctica indicada. El servidor lo revalida siempre — este cliente no
 * es la autoridad.
 */
@Injectable({ providedIn: 'root' })
export class AssetsLiabilitiesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /accounting/practitioner/assets` */
  listAssets(practiceId: string): Observable<readonly AssetSummary[]> {
    const params = new HttpParams().set('practiceId', practiceId);
    return this.http.get<readonly AssetSummary[]>(this.url('assets'), { params });
  }

  /** `POST /accounting/practitioner/assets` */
  capitalizeAsset(input: CapitalizeOwnAssetInput): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.url('assets'), input);
  }

  /** `PATCH /accounting/practitioner/assets/:id/automation` */
  setAssetAutomation(assetId: string, automated: boolean): Observable<void> {
    return this.http.patch<void>(this.url(`assets/${assetId}/automation`), { automated });
  }

  /** `POST /accounting/practitioner/assets/:id/progress` */
  registerAssetProgress(
    assetId: string,
    input: RegisterAssetProgressInput,
  ): Observable<ProgressRegistered> {
    return this.http.post<ProgressRegistered>(
      this.url(`assets/${assetId}/progress`),
      input,
    );
  }

  /** `GET /accounting/practitioner/liabilities` */
  listLiabilities(practiceId: string): Observable<readonly LiabilitySummary[]> {
    const params = new HttpParams().set('practiceId', practiceId);
    return this.http.get<readonly LiabilitySummary[]>(this.url('liabilities'), { params });
  }

  /** `POST /accounting/practitioner/liabilities` */
  createLiability(input: CreateOwnLiabilityInput): Observable<LiabilityCreated> {
    return this.http.post<LiabilityCreated>(this.url('liabilities'), input);
  }

  /** `PATCH /accounting/practitioner/liabilities/:id/automation` */
  setLiabilityAutomation(liabilityId: string, automated: boolean): Observable<void> {
    return this.http.patch<void>(
      this.url(`liabilities/${liabilityId}/automation`),
      { automated },
    );
  }

  /** `POST /accounting/practitioner/liabilities/:id/progress` */
  registerLiabilityProgress(
    liabilityId: string,
    input: RegisterLiabilityProgressInput,
  ): Observable<ProgressRegistered> {
    return this.http.post<ProgressRegistered>(
      this.url(`liabilities/${liabilityId}/progress`),
      input,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, `/accounting/practitioner/${path}`);
  }
}
