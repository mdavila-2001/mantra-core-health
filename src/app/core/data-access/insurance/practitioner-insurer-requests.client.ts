import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  InsurerRequest,
  InsurerRequestStatus,
  ReceivedInsurerRequest,
} from './practitioner-insurer-requests.types';

interface WireInsurerRequest {
  readonly id: string;
  readonly carrierId: string;
  readonly carrierName: string;
  readonly status: InsurerRequestStatus;
  readonly decisionReasonText: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

interface WireReceivedInsurerRequest {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly practitionerName: string | null;
  readonly professionalTitle: string | null;
  readonly status: InsurerRequestStatus;
  readonly decisionReasonText: string | null;
  readonly createdAt: string;
  readonly decidedAt: string | null;
}

interface WirePage<T> {
  readonly items: readonly T[];
  readonly count: number;
}

function toInsurerRequest(w: WireInsurerRequest): InsurerRequest {
  return {
    ...w,
    createdAt: new Date(w.createdAt),
    decidedAt: w.decidedAt === null ? null : new Date(w.decidedAt),
  };
}

function toReceived(w: WireReceivedInsurerRequest): ReceivedInsurerRequest {
  return {
    ...w,
    createdAt: new Date(w.createdAt),
    decidedAt: w.decidedAt === null ? null : new Date(w.decidedAt),
  };
}

/**
 * Las dos caras de la solicitud médico → aseguradora.
 *
 * - El médico: `/practitioners/me/insurer-requests`. El sujeto sale de la
 *   sesión; ninguna llamada manda un id de profesional.
 * - La aseguradora: `/insurance/practitioner-requests`. La compañía sale del
 *   tenant activo; ninguna llamada manda un id de aseguradora.
 *
 * La autoridad es la API: este cliente no decide quién puede qué.
 */
@Injectable({ providedIn: 'root' })
export class PractitionerInsurerRequestsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practitioners/me/insurer-requests` — las mías, de la más reciente a la más vieja. */
  listMine(): Observable<readonly InsurerRequest[]> {
    return this.http
      .get<WirePage<WireInsurerRequest>>(this.url('/practitioners/me/insurer-requests'))
      .pipe(map((page) => page.items.map(toInsurerRequest)));
  }

  /**
   * `POST /practitioners/me/insurer-requests` — pedir una o más aseguradoras.
   * Devuelve la lista completa ya actualizada. 409 si todas ya estaban vivas.
   */
  request(carrierIds: readonly string[]): Observable<readonly InsurerRequest[]> {
    return this.http
      .post<WirePage<WireInsurerRequest>>(this.url('/practitioners/me/insurer-requests'), {
        carrierIds,
      })
      .pipe(map((page) => page.items.map(toInsurerRequest)));
  }

  /** `POST /practitioners/me/insurer-requests/:id/withdraw` — sólo una pendiente. */
  withdraw(id: string): Observable<InsurerRequest> {
    return this.http
      .post<WireInsurerRequest>(
        this.url(`/practitioners/me/insurer-requests/${encodeURIComponent(id)}/withdraw`),
        {},
      )
      .pipe(map(toInsurerRequest));
  }

  /** `GET /insurance/practitioner-requests` — la bandeja de la aseguradora activa. */
  listReceived(): Observable<readonly ReceivedInsurerRequest[]> {
    return this.http
      .get<WirePage<WireReceivedInsurerRequest>>(this.url('/insurance/practitioner-requests'))
      .pipe(map((page) => page.items.map(toReceived)));
  }

  /** `POST /insurance/practitioner-requests/:id/approve`. */
  approve(id: string): Observable<ReceivedInsurerRequest> {
    return this.http
      .post<WireReceivedInsurerRequest>(
        this.url(`/insurance/practitioner-requests/${encodeURIComponent(id)}/approve`),
        {},
      )
      .pipe(map(toReceived));
  }

  /** `POST /insurance/practitioner-requests/:id/reject` — el motivo lo lee el médico. */
  reject(id: string, reason?: string): Observable<ReceivedInsurerRequest> {
    const motivo = reason?.trim();
    return this.http
      .post<WireReceivedInsurerRequest>(
        this.url(`/insurance/practitioner-requests/${encodeURIComponent(id)}/reject`),
        motivo === undefined || motivo === '' ? {} : { reason: motivo },
      )
      .pipe(map(toReceived));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
