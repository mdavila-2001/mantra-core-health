import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  InsuranceAnalyticsQuery,
  InsuranceDashboardAnalytics,
} from './insurance-analytics.types';

/**
 * `GET /insurance/analytics/loss-ratio` — el tablero de siniestralidad de la
 * aseguradora del tenant activo (subtarea 3.1, v4.2.14).
 *
 * No hay conversión Wire→dominio: la respuesta ya viaja en la forma que la
 * pantalla necesita (importes como cadena decimal, sin fechas `Date`), así
 * que no hace falta un tipo `Wire*` ni un mapeador — a diferencia de
 * {@link InsuranceClient}, que sí convierte vigencias y `createdAt`.
 */
@Injectable({ providedIn: 'root' })
export class InsuranceAnalyticsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * @param query - Rango de fechas y plan opcional. Sin `startDate`, la API
   *   usa los últimos 12 meses hasta hoy.
   * @returns KPIs, tendencia mensual, top de medicamentos, especialidades,
   *   patologías CIE-10 e inmunización.
   */
  getLossRatioAnalytics(
    query: InsuranceAnalyticsQuery = {},
  ): Observable<InsuranceDashboardAnalytics> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params = params.set(clave, String(valor));
    }
    return this.http.get<InsuranceDashboardAnalytics>(
      this.url('/insurance/analytics/loss-ratio'),
      { params },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
