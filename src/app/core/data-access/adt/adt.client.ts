import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AdmissionRequest,
  AdtResult,
  AttendingPractitioner,
  BedAssignmentRequest,
  BedCompatibility,
  CensusAdjustment,
  CensusAdjustmentRequest,
  CensusDayView,
  CloseCensusResult,
  DischargeRequest,
  InpatientIndicators,
  InpatientStay,
  ProspectiveCompatibilityRequest,
  ReviewIncidentRequest,
  ReviewIncidentResult,
  SwapRequest,
  TransferRequest,
} from './adt.types';

/**
 * Cliente de internación / ADT — franja F3, módulo `clinical`.
 *
 * Toda operación ADT corre en **una** transacción del lado de la API (traslado
 * e intercambio atómicos; el egreso deja la cama sucia con su orden de
 * limpieza). Las que cambian el encuentro mandan `If-Match: <rowVersion>` del
 * encuentro; un valor viejo → 412.
 *
 * Errores que la pantalla distingue por `reason`: 409 `BED_NOT_ASSIGNABLE`,
 * `BED_DOUBLE_OCCUPANCY`, `PATIENT_ALREADY_ADMITTED`; 422
 * `BED_COMPATIBILITY_OVERRIDE_REQUIRED`, `OVERRIDE_JUSTIFICATION_TOO_SHORT`;
 * 403 `INFRA_ACTION_NOT_ALLOWED` (forzar sin supervisión).
 */
@Injectable({ providedIn: 'root' })
export class AdtClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /clinical/bed-compatibility` — antes de que exista el encuentro (desvío W-F2F3-4). */
  checkProspectiveCompatibility(body: ProspectiveCompatibilityRequest): Observable<BedCompatibility> {
    return this.http.post<BedCompatibility>(this.url('/clinical/bed-compatibility'), body);
  }

  /** `POST /clinical/encounters/:id/bed-compatibility`. */
  checkCompatibility(encounterId: string, careSpaceId: string): Observable<BedCompatibility> {
    return this.http.post<BedCompatibility>(this.url(`/clinical/encounters/${enc(encounterId)}/bed-compatibility`), { careSpaceId });
  }

  /** `POST /clinical/admissions` → 201. Sin `bed` queda «pendiente de cama». */
  admit(body: AdmissionRequest): Observable<AdtResult> {
    return this.http.post<AdtResult>(this.url('/clinical/admissions'), body);
  }

  /** `POST /clinical/encounters/:id/bed-assignment` con `If-Match`. Convierte una reserva propia en ocupación. */
  assignBed(
    encounterId: string,
    rowVersion: number,
    body: BedAssignmentRequest,
  ): Observable<AdtResult> {
    return this.http.post<AdtResult>(this.url(`/clinical/encounters/${enc(encounterId)}/bed-assignment`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /clinical/encounters/:id/transfer` con `If-Match` — atómico. */
  transfer(encounterId: string, rowVersion: number, body: TransferRequest): Observable<AdtResult> {
    return this.http.post<AdtResult>(this.url(`/clinical/encounters/${enc(encounterId)}/transfer`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /clinical/bed-swaps` — A17, las cuatro filas en una transacción. */
  swap(body: SwapRequest): Observable<AdtResult> {
    return this.http.post<AdtResult>(this.url('/clinical/bed-swaps'), body);
  }

  /** `POST /clinical/encounters/:id/discharge` con `If-Match`. */
  discharge(encounterId: string, rowVersion: number, body: DischargeRequest): Observable<AdtResult> {
    return this.http.post<AdtResult>(this.url(`/clinical/encounters/${enc(encounterId)}/discharge`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /clinical/encounter-locations/:id/cancel` — reserva (A11) o traslado (A12). */
  cancelLocation(encounterLocationId: string, reasonText: string): Observable<AdtResult> {
    return this.http.post<AdtResult>(
      this.url(`/clinical/encounter-locations/${enc(encounterLocationId)}/cancel`),
      { reasonText },
    );
  }

  /** `GET /clinical/encounters/:id/stay`. */
  getStay(encounterId: string): Observable<InpatientStay> {
    return this.http.get<InpatientStay>(this.url(`/clinical/encounters/${enc(encounterId)}/stay`));
  }

  /** `PATCH /clinical/placement-incidents/:id`. */
  reviewIncident(id: string, body: ReviewIncidentRequest): Observable<ReviewIncidentResult> {
    return this.http.patch<ReviewIncidentResult>(this.url(`/clinical/placement-incidents/${enc(id)}`), body);
  }

  /** `GET /clinical/patients/:id/inpatient-stay` — la estancia vigente (misma forma que `/stay`); **404** sin internación. */
  getPatientCurrentStay(patientProfileId: string): Observable<InpatientStay> {
    return this.http.get<InpatientStay>(this.url(`/clinical/patients/${enc(patientProfileId)}/inpatient-stay`));
  }

  /** `GET /sites/:siteId/attending-practitioners` (desvío W-F2F3-7). */
  listAttendingPractitioners(siteId: string): Observable<readonly AttendingPractitioner[]> {
    return this.http.get<readonly AttendingPractitioner[]>(this.url(`/sites/${enc(siteId)}/attending-practitioners`));
  }

  /** `GET /sites/:siteId/census?date&unitId` — una fila por unidad: cerrada (foto + ajustes) o abierta (vista previa). */
  getCensus(siteId: string, date: string, unitId?: string | null): Observable<readonly CensusDayView[]> {
    let params = new HttpParams().set('date', date);
    if (unitId) params = params.set('unitId', unitId);
    return this.http.get<readonly CensusDayView[]>(this.url(`/sites/${enc(siteId)}/census`), { params });
  }

  /** `POST /sites/:siteId/census/:date/close` — idempotente por unidad; `unitIds` cierra sólo esas (M4). */
  closeCensus(siteId: string, date: string, unitIds?: readonly string[]): Observable<CloseCensusResult> {
    return this.http.post<CloseCensusResult>(
      this.url(`/sites/${enc(siteId)}/census/${enc(date)}/close`),
      unitIds === undefined ? {} : { unitIds },
    );
  }

  /** `POST /census-days/:id/adjustments` — la foto no cambia; el ajuste es una fila aparte. */
  adjustCensus(censusDayId: string, body: CensusAdjustmentRequest): Observable<CensusAdjustment> {
    return this.http.post<CensusAdjustment>(this.url(`/census-days/${enc(censusDayId)}/adjustments`), body);
  }

  /** `GET /sites/:siteId/inpatient-indicators?from&to&unitId`. */
  getIndicators(siteId: string, from: string, to: string, unitId?: string | null): Observable<InpatientIndicators> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (unitId) params = params.set('unitId', unitId);
    return this.http.get<InpatientIndicators>(this.url(`/sites/${enc(siteId)}/inpatient-indicators`), { params });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(valor: string): string {
  return encodeURIComponent(valor);
}

function ifMatch(rowVersion: number): HttpHeaders {
  return new HttpHeaders({ 'If-Match': String(rowVersion) });
}
