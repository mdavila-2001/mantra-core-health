import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { cleanAdmission } from './adt.logic';
import type {
  AdjustCensusRequest,
  AdmissionCompatibilityRequest,
  AdmissionRequest,
  AdmissionResult,
  BedAssignmentRequest,
  BedAssignmentResult,
  BedBoard,
  BedCompatibility,
  BedSwapRequest,
  BedSwapResult,
  CancelLocationRequest,
  CensusAdjustment,
  CensusResponse,
  CloseCensusResult,
  DischargeRequest,
  DischargeResult,
  InpatientIndicators,
  InpatientRow,
  InpatientsPage,
  PlacementIncident,
  ReviewIncidentRequest,
  StayView,
  TransferRequest,
  TransferResult,
} from './adt.types';

/**
 * Cliente de **internación / ADT** — franja F3, módulo 08 (`clinical`). Un
 * método por fila de la tabla de `§F3.3` de `CONTRATO-F2-F5.md`.
 *
 * ## `If-Match`
 *
 * Asignar cama, trasladar y dar el egreso llevan `If-Match: <rowVersion del
 * encuentro>` (412 si cambió). Ingresar, intercambiar y cancelar no: crean o
 * mueven varias filas a la vez y la concurrencia la resuelve la `EXCLUDE` de la
 * base (409 `BED_DOUBLE_OCCUPANCY`).
 *
 * ## Lo que este cliente NO decide
 *
 * Qué cama es asignable, qué es compatible, quién puede forzar y qué día se
 * puede cerrar: lo valida la API en cada llamada. La pantalla sólo evita
 * ofrecer lo que ya sabe inválido.
 */
@Injectable({ providedIn: 'root' })
export class AdtClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /sites/:siteId/bed-board` (F2). Sólo para ofrecer camas candidatas;
   * el tablero propiamente dicho es de la franja F2.
   */
  getBedBoard(siteId: string, params: { unitId?: string } = {}): Observable<BedBoard> {
    let query = new HttpParams();
    if (params.unitId !== undefined) query = query.set('unitId', params.unitId);
    return this.http.get<BedBoard>(this.url(`/sites/${enc(siteId)}/bed-board`), { params: query });
  }

  /** `POST /clinical/encounters/:id/bed-compatibility`. */
  checkCompatibility(encounterId: string, careSpaceId: string): Observable<BedCompatibility> {
    return this.http.post<BedCompatibility>(this.url(`/clinical/encounters/${enc(encounterId)}/bed-compatibility`), { careSpaceId });
  }

  /** DESVÍO F3-A: ver `AdmissionCompatibilityRequest`. Propuesta, no contratada. */
  checkAdmissionCompatibility(body: AdmissionCompatibilityRequest): Observable<BedCompatibility> {
    return this.http.post<BedCompatibility>(this.url('/clinical/admissions/bed-compatibility'), body);
  }

  /** `POST /clinical/admissions` — 201. Sin `bed` queda «pendiente de cama». */
  admit(body: AdmissionRequest): Observable<AdmissionResult> {
    return this.http.post<AdmissionResult>(this.url('/clinical/admissions'), cleanAdmission(body));
  }

  /** `POST /clinical/encounters/:id/bed-assignment` con `If-Match` (encuentro). */
  assignBed(encounterId: string, rowVersion: number, body: BedAssignmentRequest): Observable<BedAssignmentResult> {
    return this.http.post<BedAssignmentResult>(this.url(`/clinical/encounters/${enc(encounterId)}/bed-assignment`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /clinical/encounters/:id/transfer` con `If-Match`. Atómico. */
  transfer(encounterId: string, rowVersion: number, body: TransferRequest): Observable<TransferResult> {
    return this.http.post<TransferResult>(this.url(`/clinical/encounters/${enc(encounterId)}/transfer`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /clinical/bed-swaps` — intercambio A17 atómico entre dos pacientes. */
  swap(body: BedSwapRequest): Observable<BedSwapResult> {
    return this.http.post<BedSwapResult>(this.url('/clinical/bed-swaps'), body);
  }

  /** `POST /clinical/encounters/:id/discharge` con `If-Match`. Deja la cama sucia y crea la orden. */
  discharge(encounterId: string, rowVersion: number, body: DischargeRequest): Observable<DischargeResult> {
    return this.http.post<DischargeResult>(this.url(`/clinical/encounters/${enc(encounterId)}/discharge`), body, {
      headers: ifMatch(rowVersion),
    });
  }

  /** `POST /clinical/encounter-locations/:id/cancel` — reserva (A11) o traslado (A12). */
  cancelLocation(locationId: string, body: CancelLocationRequest): Observable<void> {
    return this.http.post<void>(this.url(`/clinical/encounter-locations/${enc(locationId)}/cancel`), body);
  }

  /** `GET /sites/:siteId/inpatients` — el censo vivo. */
  listInpatients(siteId: string, params: { unitId?: string; cursor?: string } = {}): Observable<InpatientsPage> {
    let query = new HttpParams();
    if (params.unitId !== undefined) query = query.set('unitId', params.unitId);
    if (params.cursor !== undefined) query = query.set('cursor', params.cursor);
    return this.http
      .get<InpatientsPage | readonly InpatientRow[]>(this.url(`/sites/${enc(siteId)}/inpatients`), { params: query })
      .pipe(map((r): InpatientsPage => ('items' in r ? r : { items: r, nextCursor: null, generatedAt: new Date().toISOString() })));
  }

  /** `GET /clinical/encounters/:id/stay` — la ficha de internación. */
  getStay(encounterId: string): Observable<StayView> {
    return this.http.get<StayView>(this.url(`/clinical/encounters/${enc(encounterId)}/stay`));
  }

  /** `PATCH /clinical/placement-incidents/:id` — revisar o cerrar. */
  reviewIncident(id: string, body: ReviewIncidentRequest): Observable<PlacementIncident> {
    return this.http.patch<PlacementIncident>(this.url(`/clinical/placement-incidents/${enc(id)}`), body);
  }

  /** `GET /sites/:siteId/census?date&unitId` — cerrado: snapshot + ajustes; abierto: vista previa. */
  getCensus(siteId: string, date: string, unitId?: string): Observable<CensusResponse> {
    let query = new HttpParams().set('date', date);
    if (unitId !== undefined) query = query.set('unitId', unitId);
    return this.http.get<CensusResponse>(this.url(`/sites/${enc(siteId)}/census`), { params: query });
  }

  /** `POST /sites/:siteId/census/:date/close` — idempotente por unidad. */
  closeCensus(siteId: string, date: string, unitIds?: readonly string[]): Observable<CloseCensusResult> {
    return this.http.post<CloseCensusResult>(
      this.url(`/sites/${enc(siteId)}/census/${enc(date)}/close`),
      unitIds === undefined ? {} : { unitIds },
    );
  }

  /** `POST /census-days/:id/adjustments` — el snapshot no cambia; se agrega una fila. */
  adjustCensus(censusDayId: string, body: AdjustCensusRequest): Observable<CensusAdjustment> {
    return this.http.post<CensusAdjustment>(this.url(`/census-days/${enc(censusDayId)}/adjustments`), body);
  }

  /** `GET /sites/:siteId/inpatient-indicators?from&to&unitId`. */
  getIndicators(siteId: string, from: string, to: string, unitId?: string): Observable<InpatientIndicators> {
    let query = new HttpParams().set('from', from).set('to', to);
    if (unitId !== undefined) query = query.set('unitId', unitId);
    return this.http.get<InpatientIndicators>(this.url(`/sites/${enc(siteId)}/inpatient-indicators`), { params: query });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function ifMatch(rowVersion: number): HttpHeaders {
  return new HttpHeaders({ 'If-Match': String(rowVersion) });
}
