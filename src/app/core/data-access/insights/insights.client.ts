import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  DailyFact,
  InsightsCatalog,
  InsightsFactsQuery,
  InsightsResponse,
} from './insights.types';

/**
 * Cliente de AloVida Insights (`/marketing/insights/*`, módulo 50).
 *
 * Alcance **plataforma**: roles de marketing y de plataforma. La API es la
 * autoridad; el portal solo decide qué se ofrece.
 *
 * Esta primera entrega expone el catálogo y los hechos diarios de campañas. Los
 * KPI, benchmarks y estados se calculan en el dominio de la pantalla
 * (`features/insights/domain`) a partir de esos hechos.
 */
@Injectable({ providedIn: 'root' })
export class InsightsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /marketing/insights/catalog` — campañas, canales por campaña e hitos. */
  getCatalog(): Observable<InsightsResponse<InsightsCatalog>> {
    return this.http.get<InsightsResponse<InsightsCatalog>>(
      apiUrl(this.baseUrl, '/marketing/insights/catalog'),
    );
  }

  /** `GET /marketing/insights/campaign-facts` — hechos diarios por campaña y canal (ventana ≤ 92 días). */
  getCampaignFacts(query: InsightsFactsQuery): Observable<InsightsResponse<DailyFact[]>> {
    let params = new HttpParams().set('from', query.from).set('to', query.to);
    if (query.campaignIds?.length) {
      params = params.set('campaignIds', query.campaignIds.join(','));
    }
    if (query.channels?.length) {
      params = params.set('channels', query.channels.join(','));
    }
    return this.http.get<InsightsResponse<DailyFact[]>>(
      apiUrl(this.baseUrl, '/marketing/insights/campaign-facts'),
      { params },
    );
  }
}
