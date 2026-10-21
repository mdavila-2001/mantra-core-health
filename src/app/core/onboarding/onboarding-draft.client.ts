import { HttpClient, HttpParams } from '@angular/common/http';
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

  saveDraft(draft: OnboardingDraft): Observable<{ ok: boolean; savedAt: string }> {
    return this.http.put<{ ok: boolean; savedAt: string }>(
      this.url(`/iam/onboarding-drafts/${draft.formType}/${draft.draftId}`),
      draft,
    );
  }

  deleteDraft(formType: OnboardingFormType, draftId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      this.url(`/iam/onboarding-drafts/${formType}/${draftId}`),
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
