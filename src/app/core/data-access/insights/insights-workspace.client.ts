import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  InsightsAlertRule,
  InsightsAlertWorkflow,
  InsightsNotificationPreferences,
  InsightsReportRecord,
  InsightsResponse,
  InsightsSavedView,
  InsightsUserPreferences,
  PatchAlertRuleBody,
  PutAlertWorkflowBody,
  PutNotificationPreferencesBody,
  PutReportBody,
  PutSavedViewBody,
  PutUserPreferencesBody,
  InsightsRuleCode,
} from './insights.types';

/**
 * Lo que las personas hacen en AloVida Insights y se queda: el estado y el responsable de cada
 * alerta, las reglas, las preferencias de aviso, el historial de informes, las vistas guardadas y
 * las preferencias de interfaz. Todo es **del usuario que pide** (alcance plataforma, sin tenant)
 * salvo las reglas y las alertas, que son compartidas.
 *
 * Las modificaciones de alertas y reglas llevan `If-Match` con el `rowVersion` que se leyó: si
 * alguien más las cambió, el API responde 412 y la pantalla recarga en vez de pisar.
 */
@Injectable({ providedIn: 'root' })
export class InsightsWorkspaceClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private ifMatch(version: number | null): { headers?: HttpHeaders } {
    return version === null ? {} : { headers: new HttpHeaders({ 'If-Match': String(version) }) };
  }

  /** `GET /alert-workflow` — el estado de todas las alertas que alguien tocó. */
  listAlertWorkflow(): Observable<InsightsResponse<InsightsAlertWorkflow[]>> {
    return this.http.get<InsightsResponse<InsightsAlertWorkflow[]>>(apiUrl(this.baseUrl, '/marketing/insights/alert-workflow'));
  }

  /** `PUT /alert-workflow/:fingerprint` — cambia estado y/o responsable; deja una transición. */
  putAlertWorkflow(fingerprint: string, body: PutAlertWorkflowBody, version: number | null): Observable<InsightsResponse<InsightsAlertWorkflow>> {
    return this.http.put<InsightsResponse<InsightsAlertWorkflow>>(apiUrl(this.baseUrl, `/marketing/insights/alert-workflow/${encodeURIComponent(fingerprint)}`), body, this.ifMatch(version));
  }

  /** `GET /alert-rules` — las siete reglas con su umbral y si están activas. */
  listAlertRules(): Observable<InsightsResponse<InsightsAlertRule[]>> {
    return this.http.get<InsightsResponse<InsightsAlertRule[]>>(apiUrl(this.baseUrl, '/marketing/insights/alert-rules'));
  }

  /** `PATCH /alert-rules/:code` — enciende o apaga una regla, o cambia su umbral (1 a 500). */
  patchAlertRule(code: InsightsRuleCode, body: PatchAlertRuleBody, version: number): Observable<InsightsResponse<InsightsAlertRule>> {
    return this.http.patch<InsightsResponse<InsightsAlertRule>>(apiUrl(this.baseUrl, `/marketing/insights/alert-rules/${code}`), body, this.ifMatch(version));
  }

  getNotificationPreferences(): Observable<InsightsResponse<InsightsNotificationPreferences>> {
    return this.http.get<InsightsResponse<InsightsNotificationPreferences>>(apiUrl(this.baseUrl, '/marketing/insights/notification-preferences'));
  }

  putNotificationPreferences(body: PutNotificationPreferencesBody, version: number | null): Observable<InsightsResponse<InsightsNotificationPreferences>> {
    return this.http.put<InsightsResponse<InsightsNotificationPreferences>>(apiUrl(this.baseUrl, '/marketing/insights/notification-preferences'), body, this.ifMatch(version));
  }

  getUserPreferences(): Observable<InsightsResponse<InsightsUserPreferences>> {
    return this.http.get<InsightsResponse<InsightsUserPreferences>>(apiUrl(this.baseUrl, '/marketing/insights/user-preferences'));
  }

  putUserPreferences(body: PutUserPreferencesBody, version: number | null): Observable<InsightsResponse<InsightsUserPreferences>> {
    return this.http.put<InsightsResponse<InsightsUserPreferences>>(apiUrl(this.baseUrl, '/marketing/insights/user-preferences'), body, this.ifMatch(version));
  }

  listSavedViews(): Observable<InsightsResponse<InsightsSavedView[]>> {
    return this.http.get<InsightsResponse<InsightsSavedView[]>>(apiUrl(this.baseUrl, '/marketing/insights/saved-views'));
  }

  /** `PUT /saved-views/:id` — el `id` lo genera el cliente: reintentar no duplica. */
  putSavedView(id: string, body: PutSavedViewBody): Observable<InsightsResponse<InsightsSavedView>> {
    return this.http.put<InsightsResponse<InsightsSavedView>>(apiUrl(this.baseUrl, `/marketing/insights/saved-views/${id}`), body);
  }

  deleteSavedView(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(this.baseUrl, `/marketing/insights/saved-views/${id}`));
  }

  listReports(): Observable<InsightsResponse<InsightsReportRecord[]>> {
    return this.http.get<InsightsResponse<InsightsReportRecord[]>>(apiUrl(this.baseUrl, '/marketing/insights/reports'));
  }

  /** `PUT /reports/:id` — guarda un informe en el historial (máximo 12; el 13.º expulsa el más viejo). */
  putReport(id: string, body: PutReportBody): Observable<InsightsResponse<InsightsReportRecord>> {
    return this.http.put<InsightsResponse<InsightsReportRecord>>(apiUrl(this.baseUrl, `/marketing/insights/reports/${id}`), body);
  }

  deleteReport(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(this.baseUrl, `/marketing/insights/reports/${id}`));
  }
}
