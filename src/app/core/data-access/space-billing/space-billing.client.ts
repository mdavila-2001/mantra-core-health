import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { BedDayRunResult, ChargeCapture, CreateSpaceTariffRequest, Inpatient, SpaceTariff } from './space-billing.types';

/**
 * Cliente de facturación por espacio — franja F5e (`CONTRATO-F2-F5.md` §F5e).
 *
 * Las tarifas son versionadas (vigencia `[desde, hasta)`): cerrar una no la
 * borra, y una tarifa nueva con vigencia futura no altera cargos pasados. Los
 * cargos se devengan solos (regla de medianoche, quirófano por tiempo) y
 * Facturación los revisa; nadie los escribe a mano.
 *
 * Formas de la API (`billing-space-charges.controller.ts`, `tariffView`,
 * `chargeView`): los ids viajan sueltos y la pantalla los resuelve con sus
 * catálogos. `space-billing.client.contract.spec.ts` lo fija.
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

  /** `GET /billing/encounters/:encounterId/pending-charges` — arreglo de cargos **pendientes**. */
  getPendingCharges(encounterId: string): Observable<readonly ChargeCapture[]> {
    return this.http.get<readonly ChargeCapture[]>(this.url(`/billing/encounters/${encodeURIComponent(encounterId)}/pending-charges`));
  }

  /** `POST /billing/charge-captures/:id/void {reason}`. */
  voidCharge(id: string, reason: string): Observable<ChargeCapture> {
    return this.http.post<ChargeCapture>(this.url(`/billing/charge-captures/${encodeURIComponent(id)}/void`), { reason });
  }

  /**
   * `GET /sites/:siteId/inpatients` (F3) — de dónde elegir el encuentro.
   *
   * La API no tiene lectura de estancias de facturación (pedido a A-F5e:
   * `GET /billing/bed-day/stays`); mientras tanto se eligen las internaciones
   * vigentes de la lectura de F3. Al integrar con W-F2F3 queda su cliente ADT.
   */
  listInpatients(siteId: string): Observable<readonly Inpatient[]> {
    return this.http.get<readonly Inpatient[]>(this.url(`/sites/${encodeURIComponent(siteId)}/inpatients`));
  }

  /**
   * `POST /billing/encounters/:encounterId/bed-day-charges/run` — devenga el
   * día-cama hasta la última medianoche. Idempotente por
   * `BEDDAY:<encuentro>:<fecha>`.
   *
   * Devuelve `{created: ChargeCapture[], skipped}`.
   */
  runBedDay(encounterId: string): Observable<BedDayRunResult> {
    return this.http.post<BedDayRunResult>(this.url(`/billing/encounters/${encodeURIComponent(encounterId)}/bed-day-charges/run`), {});
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
