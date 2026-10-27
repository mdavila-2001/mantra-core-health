import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../data-access/api';
import type {
  OnboardingDraft,
  OnboardingFormType,
  OnboardingFunnelReport,
  OnboardingHeatmapReport,
  OnboardingTelemetryEvent,
} from './onboarding-draft.types';

/** Cabecera con la que la API reconoce al dueño del borrador. */
export const ONBOARDING_DRAFT_SECRET_HEADER = 'x-onboarding-draft-secret';

function secretHeaders(secret: string | null | undefined): HttpHeaders {
  return secret ? new HttpHeaders({ [ONBOARDING_DRAFT_SECRET_HEADER]: secret }) : new HttpHeaders();
}

@Injectable({
  providedIn: 'root',
})
export class OnboardingDraftClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getDraft(formType: OnboardingFormType, draftId: string): Observable<OnboardingDraft | null> {
    return this.http.get<OnboardingDraft | null>(
      this.url(`/iam/onboarding-drafts/${formType}/${draftId}`),
    );
  }

  /**
   * Crea o actualiza el borrador. Sin `secret` la API sólo crea, y devuelve
   * `draftSecret` una única vez; con él, actualiza. Un id ya tomado sin el
   * secreto correcto responde 404.
   */
  saveDraft(
    draft: OnboardingDraft,
    secret?: string | null,
  ): Observable<{ ok: boolean; savedAt: string; draftSecret?: string }> {
    return this.http.put<{ ok: boolean; savedAt: string; draftSecret?: string }>(
      this.url(`/iam/onboarding-drafts/${draft.formType}/${draft.draftId}`),
      draft,
      { headers: secretHeaders(secret) },
    );
  }

  deleteDraft(
    formType: OnboardingFormType,
    draftId: string,
    secret?: string | null,
  ): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      this.url(`/iam/onboarding-drafts/${formType}/${draftId}`),
      { headers: secretHeaders(secret) },
    );
  }

  recordEvents(events: readonly OnboardingTelemetryEvent[]): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(this.url('/telemetry/onboarding-events'), { events });
  }

  getFunnelReport(formType: OnboardingFormType, range = '7d'): Observable<OnboardingFunnelReport> {
    const params = new HttpParams().set('formType', formType).set('range', range);
    return this.http.get<OnboardingFunnelReport>(this.url('/admin/analytics/onboarding/funnel'), {
      params,
    });
  }

  getHeatmapReport(
    formType: OnboardingFormType,
    metric: 'interactions' | 'errors' | 'abandonment' = 'errors',
    range = '7d',
  ): Observable<OnboardingHeatmapReport> {
    const params = new HttpParams()
      .set('formType', formType)
      .set('metric', metric)
      .set('range', range);
    return this.http.get<OnboardingHeatmapReport>(this.url('/admin/analytics/onboarding/heatmap'), {
      params,
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
