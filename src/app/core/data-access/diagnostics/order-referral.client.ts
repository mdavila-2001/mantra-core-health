import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { simulatorOnly } from '../simulator-only';
import type { OrderReferralResult } from './diagnostics.types';

/**
 * La derivación de una orden de laboratorio o imagenología a un centro, con
 * aceptación del paciente (06/11/2026).
 *
 * **Sólo existe en el simulador**: la API real no publica estas rutas. Cada
 * llamada pasa por `simulatorOnly`, así que contra la API real no sale una
 * petición: entrega un error que nombra la función que falta.
 *
 * Archivo aparte de {@link DiagnosticsClient} a propósito: aquél es el contrato
 * real del circuito diagnóstico y esto no lo es todavía.
 */
@Injectable({ providedIn: 'root' })
export class OrderReferralClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /diagnostic-results/me/orders/:orderId/referral/{accept|reject}` — el
   * paciente decide si acepta que su orden se derive al centro que eligió el
   * médico (06/11/2026). Recién al aceptar la orden aparece en el centro.
   *
   * Sólo existe en el simulador: la API real no publica la derivación.
   *
   * @param orderId - Orden derivada.
   * @param decision - `accept` o `reject`.
   */
  respondToReferral(
    orderId: string,
    decision: 'accept' | 'reject',
  ): Observable<OrderReferralResult> {
    return simulatorOnly(
      'Responder a la derivación de una orden',
      this.url('/diagnostic-results/me/orders'),
      () =>
        this.http.post<OrderReferralResult>(
          this.url(
            `/diagnostic-results/me/orders/${encodeURIComponent(orderId)}/referral/${decision}`,
          ),
          {},
        ),
    );
  }

  /**
   * `POST /diagnostics/orders/:orderId/referral` — el médico deriva una orden de
   * laboratorio o imagenología a un centro; queda pendiente de que el paciente
   * la acepte. Sólo existe en el simulador.
   *
   * @param orderId - Orden a derivar.
   * @param performerTenantId - Centro (organización `DIAGNOSTIC_CENTER`).
   */
  referOrder(orderId: string, performerTenantId: string): Observable<OrderReferralResult> {
    return simulatorOnly(
      'Derivar una orden a un centro',
      this.url('/diagnostics/orders'),
      () =>
        this.http.post<OrderReferralResult>(
          this.url(`/diagnostics/orders/${encodeURIComponent(orderId)}/referral`),
          { performerTenantId },
        ),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
