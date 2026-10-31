import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** `GET /telemetry/tracking-consents/me`: la última decisión de quien consulta. */
export interface MyTrackingConsentStatus {
  readonly status: 'GRANTED' | 'WITHDRAWN' | 'NONE';
  /** Lo que hay que pasar a `withdraw`. Solo viene con `GRANTED`. */
  readonly consentId?: string;
  readonly purposeDefinitionId: string;
}

/** `POST /telemetry/tracking-consents` y `…/:id/withdraw`. */
export interface TrackingConsent {
  readonly id: string;
  readonly userId: string;
  readonly purposeDefinitionId: string;
  readonly decisionConceptId: string;
  readonly grantedAt?: string;
  readonly withdrawnAt?: string;
}

/**
 * Consentimiento de tracking del M28 (`TelemetryConsentController`).
 *
 * Siempre es **del usuario autenticado**: el cuerpo no nombra a nadie y la API
 * rechaza una clave `userId`. Cualquier rol puede decidir sobre sí mismo.
 */
@Injectable({
  providedIn: 'root',
})
export class TelemetryConsentClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Estado vigente de mi consentimiento para un propósito. */
  getMine(purposeDefinitionId: string): Observable<MyTrackingConsentStatus> {
    return this.http.get<MyTrackingConsentStatus>(apiUrl(this.baseUrl, '/telemetry/tracking-consents/me'), {
      params: { purposeDefinitionId },
    });
  }

  /** Otorga el consentimiento para un propósito que lo requiere. */
  grant(purposeDefinitionId: string, consentVersion: string): Observable<TrackingConsent> {
    return this.http.post<TrackingConsent>(apiUrl(this.baseUrl, '/telemetry/tracking-consents'), {
      purposeDefinitionId,
      consentVersion,
    });
  }

  /** Retira un consentimiento vigente (append-only: la API guarda el retiro). */
  withdraw(consentId: string): Observable<TrackingConsent> {
    return this.http.post<TrackingConsent>(
      apiUrl(this.baseUrl, `/telemetry/tracking-consents/${encodeURIComponent(consentId)}/withdraw`),
      {},
    );
  }
}
