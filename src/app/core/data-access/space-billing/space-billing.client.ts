import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  BedDayRunResult,
  BedDayStay,
  ChargeCapture,
  CreateSpaceTariffRequest,
  EncounterCharges,
  SpaceTariff,
} from './space-billing.types';

/**
 * Cliente de facturación por espacio — franja F5e (`CONTRATO-F2-F5.md` §F5e).
 *
 * Las tarifas son versionadas (vigencia `[desde, hasta)`): cerrar una no la
 * borra, y una tarifa nueva con vigencia futura no altera cargos pasados. Los
 * cargos se devengan solos (regla de medianoche, quirófano por tiempo) y
 * Facturación los revisa; nadie los escribe a mano.
 */
@Injectable({ providedIn: 'root' })
export class SpaceBillingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /billing/space-tariffs?practiceId`. */
  listTariffs(practiceId: string): Observable<readonly SpaceTariff[]> {
    return this.http.get<readonly SpaceTariff[]>(this.url('/billing/space-tariffs'), { params: new HttpParams().set('practiceId', practiceId) });
  }

  /** `POST /billing/space-tariffs` — 409 `TARIFF_OVERLAP`, 422 `TARIFF_SERVICE_NOT_IN_PRACTICE`. */
  createTariff(body: CreateSpaceTariffRequest): Observable<SpaceTariff> {
    return this.http.post<SpaceTariff>(this.url('/billing/space-tariffs'), body);
  }

  /** `POST /billing/space-tariffs/:id/close {validTo}`. */
  closeTariff(id: string, validTo: string): Observable<SpaceTariff> {
    return this.http.post<SpaceTariff>(this.url(`/billing/space-tariffs/${encodeURIComponent(id)}/close`), { validTo });
  }

  /** `GET /billing/encounters/:encounterId/pending-charges`. */
  getEncounterCharges(encounterId: string): Observable<EncounterCharges> {
    return this.http.get<EncounterCharges>(this.url(`/billing/encounters/${encodeURIComponent(encounterId)}/pending-charges`));
  }

  /** `POST /billing/charge-captures/:id/void {reason}`. */
  voidCharge(id: string, reason: string): Observable<ChargeCapture> {
    return this.http.post<ChargeCapture>(this.url(`/billing/charge-captures/${encodeURIComponent(id)}/void`), { reason });
  }

  /**
   * `GET /billing/bed-day/stays?siteId` — estancias de la sede con cargos.
   *
   * Desvío anotado en el contrato: la API sólo declara la lectura por
   * encuentro, y Facturación necesita de dónde elegirlo.
   */
  listStays(siteId: string): Observable<readonly BedDayStay[]> {
    return this.http.get<readonly BedDayStay[]>(this.url('/billing/bed-day/stays'), { params: new HttpParams().set('siteId', siteId) });
  }

  /**
   * `POST /billing/encounters/:encounterId/bed-day-charges/run` — devenga el
   * día-cama hasta la última medianoche. Idempotente por
   * `BEDDAY:<encuentro>:<fecha>`.
   *
   * Desvío anotado: el contrato lo deja al job (`/internal/…`, SYSTEM); esto
   * es el mismo servicio abierto a Facturación para un encuentro.
   */
  runBedDay(encounterId: string): Observable<BedDayRunResult> {
    return this.http.post<BedDayRunResult>(this.url(`/billing/encounters/${encodeURIComponent(encounterId)}/bed-day-charges/run`), {});
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
