import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { withAccessChallenge } from '../../access-challenge/access-challenge';
import { API_BASE_URL, apiUrl } from '../api';
import type { ExportReasonCode } from './governance-reports.types';
import type {
  BulkReviewDecision,
  BulkReviewResult,
  Campaign,
  CampaignChange,
  CampaignDraft,
  CampaignList,
  CampaignPreview,
  CampaignResults,
  CloseCampaignResult,
  CreatedCampaign,
  ExportedFile,
  LaunchCampaignResult,
  MyReviewsStatus,
  NewCampaign,
  ReviewDecision,
  ReviewDecisionResult,
  ReviewItem,
  ReviewItemList,
} from './access-reviews.types';

/**
 * Cliente de las **campañas de certificación de accesos** y de la bandeja del revisor (CONTRATO-GOBIERNO §6.2, §8.3 bloque F).
 *
 * `/org/access-reviews/campaigns*` es de quien administra; `/me/access-reviews/items*` es de quien revisa (doctor, jefe de
 * servicio, administrador): el servicio decide por elegibilidad y un ítem ajeno es «no encontrado», nunca «prohibido».
 */
@Injectable({ providedIn: 'root' })
export class AccessReviewsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---- campañas (organización) ---------------------------------------------------------------- */

  /** `GET /org/access-reviews/campaigns`. */
  listCampaigns(): Observable<CampaignList> {
    return this.http.get<CampaignList>(this.url('/org/access-reviews/campaigns'));
  }

  /** `POST /org/access-reviews/campaigns/preview` — cuántos ítems y quién revisa, sin crear nada. */
  previewCampaign(draft: CampaignDraft): Observable<CampaignPreview> {
    return this.http.post<CampaignPreview>(
      this.url('/org/access-reviews/campaigns/preview'),
      draft,
    );
  }

  /** `POST /org/access-reviews/campaigns` — nace en borrador (422 `REVIEW_SCOPE_EMPTY`, 409 `REVIEW_CAMPAIGN_DUPLICATE`). */
  createCampaign(campaign: NewCampaign): Observable<CreatedCampaign> {
    return this.http.post<CreatedCampaign>(this.url('/org/access-reviews/campaigns'), campaign);
  }

  /** `GET /org/access-reviews/campaigns/:id`. */
  getCampaign(campaignId: string): Observable<Campaign> {
    return this.http.get<Campaign>(this.campaignUrl(campaignId));
  }

  /** `PATCH /org/access-reviews/campaigns/:id` — solo un borrador (409 `REVIEW_CAMPAIGN_NOT_DRAFT`). */
  updateCampaign(campaignId: string, change: CampaignChange): Observable<Campaign> {
    return this.http.patch<Campaign>(this.campaignUrl(campaignId), change);
  }

  /** `POST …/:id/launch` — genera los ítems y la evidencia. */
  launchCampaign(campaignId: string): Observable<LaunchCampaignResult> {
    return this.http.post<LaunchCampaignResult>(`${this.campaignUrl(campaignId)}/launch`, {});
  }

  /** `POST …/:id/close` — aplica la acción de lo no certificado (409 `REVIEW_CAMPAIGN_NOT_OPEN`). */
  closeCampaign(campaignId: string): Observable<CloseCampaignResult> {
    return this.http.post<CloseCampaignResult>(`${this.campaignUrl(campaignId)}/close`, {});
  }

  /** `POST …/:id/cancel` — no revoca nada. */
  cancelCampaign(campaignId: string, reason?: string): Observable<Campaign> {
    return this.http.post<Campaign>(
      `${this.campaignUrl(campaignId)}/cancel`,
      reason === undefined ? {} : { reason },
    );
  }

  /** `GET …/:id/items` — el estado de cada ítem. */
  listCampaignItems(campaignId: string): Observable<ReviewItemList> {
    return this.http.get<ReviewItemList>(`${this.campaignUrl(campaignId)}/items`);
  }

  /** `GET …/:id/results` — avance, por decisión, por revisor, por sensibilidad. */
  getCampaignResults(campaignId: string): Observable<CampaignResults> {
    return this.http.get<CampaignResults>(`${this.campaignUrl(campaignId)}/results`);
  }

  /**
   * `GET …/:id/export?format=csv|json&reasonCode` — el archivo viaja como texto con su `sha256` (auditado). Sin formato, la API manda
   * JSON. **Pide el motivo como un código** (la ruta es un GET: el texto libre quedaría en los registros del servidor; sin él, 422
   * `EXPORT_REASON_REQUIRED`) **y el paso extra** reciente, que el diálogo resuelve antes de repetir la petición.
   */
  exportCampaign(
    campaignId: string,
    format: 'csv' | 'json' = 'json',
    reasonCode: ExportReasonCode = 'OTHER',
  ): Observable<ExportedFile> {
    return this.http.get<ExportedFile>(`${this.campaignUrl(campaignId)}/export`, {
      params: new HttpParams().set('format', format).set('reasonCode', reasonCode),
      context: withAccessChallenge({ actionLabel: 'Exportar los resultados de la campaña' }),
    });
  }

  /* ---- bandeja del revisor ------------------------------------------------------------------------ */

  /** `GET /me/access-reviews/items?status` — mis ítems por estado. */
  listMyItems(status?: MyReviewsStatus): Observable<ReviewItemList> {
    return this.http.get<ReviewItemList>(this.url('/me/access-reviews/items'), {
      params: status === undefined ? new HttpParams() : new HttpParams().set('status', status),
    });
  }

  /** `GET /me/access-reviews/items/:id` — con la evidencia. Un ítem de otro revisor es 404 uniforme. */
  getMyItem(itemId: string): Observable<ReviewItem> {
    return this.http.get<ReviewItem>(
      this.url(`/me/access-reviews/items/${encodeURIComponent(itemId)}`),
    );
  }

  /** `POST /me/access-reviews/items/:id/decision` — mantener, quitar o ajustar (ajustar solo reduce). */
  decideItem(itemId: string, decision: ReviewDecision): Observable<ReviewDecisionResult> {
    return this.http.post<ReviewDecisionResult>(
      this.url(`/me/access-reviews/items/${encodeURIComponent(itemId)}/decision`),
      decision,
    );
  }

  /** `POST /me/access-reviews/items/bulk-decision` — solo `CERTIFY` de bajo riesgo; todo o nada (422 `REVIEW_BULK_NOT_ALLOWED`). */
  bulkDecide(decision: BulkReviewDecision): Observable<BulkReviewResult> {
    return this.http.post<BulkReviewResult>(
      this.url('/me/access-reviews/items/bulk-decision'),
      decision,
    );
  }

  private campaignUrl(campaignId: string): string {
    return this.url(`/org/access-reviews/campaigns/${encodeURIComponent(campaignId)}`);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
