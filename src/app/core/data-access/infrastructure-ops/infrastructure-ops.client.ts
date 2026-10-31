import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { InfrastructureCatalog } from '../infrastructure/infrastructure.types';
import type {
  AvailabilityRequest,
  AvailabilityResult,
  BedBoard,
  BedBoardQuery,
  CareSpaceBlock,
  CleaningOrderPage,
  CleaningOrderQuery,
  CleaningOrderResult,
  CreateCleaningOrderRequest,
  HygieneRequest,
  HygieneResult,
  InfrastructureAccess,
  InfrastructureOpsCatalog,
  IsolationRequest,
  IsolationResult,
  MutationResult,
  OperationalState,
  StatusAxisCode,
  StatusEventPage,
} from './infrastructure-ops.types';

/**
 * Cliente de la operación de camas y salas — franja F2, módulo `practice`.
 *
 * ## Dos versiones, dos cabeceras
 *
 * Los ejes operativos (`availability`, `hygiene`, `isolation`) mandan
 * `If-Match-Ops: <opsVersion>`: limpieza y enfermería no chocan con una
 * edición de estructura de F1, que usa `row_version`. Las órdenes de limpieza
 * mandan `If-Match: <rowVersion>` de la orden. Un valor viejo → 412.
 *
 * ## La autoridad es la API
 *
 * Un espacio o una sede de otro tenant responde **404**, igual que uno que no
 * existe. Lo que el actor puede hacer viaja en la respuesta (`actions`,
 * `allowedTransitions`); la pantalla lo refleja, no lo decide.
 */
@Injectable({ providedIn: 'root' })
export class InfrastructureOpsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practice/infrastructure-access/me` — sedes y acciones del actor. */
  getAccess(): Observable<InfrastructureAccess> {
    return this.http.get<InfrastructureAccess>(this.url('/practice/infrastructure-access/me'));
  }

  /** `GET /practice/infrastructure-catalog` con la extensión de F2. */
  getCatalog(): Observable<InfrastructureCatalog & InfrastructureOpsCatalog> {
    return this.http.get<InfrastructureCatalog & InfrastructureOpsCatalog>(this.url('/practice/infrastructure-catalog'));
  }

  /** `GET /sites/:siteId/bed-board`. */
  getBedBoard(siteId: string, query: BedBoardQuery = {}): Observable<BedBoard> {
    let params = new HttpParams();
    if (query.unitId) params = params.set('unitId', query.unitId);
    if (query.parentSpaceId) params = params.set('parentSpaceId', query.parentSpaceId);
    if (query.functionCodes && query.functionCodes.length > 0) params = params.set('functionCodes', query.functionCodes.join(','));
    if (query.v2Codes && query.v2Codes.length > 0) params = params.set('v2Codes', query.v2Codes.join(','));
    return this.http.get<BedBoard>(this.url(`/sites/${enc(siteId)}/bed-board`), { params });
  }

  /** `GET /care-spaces/:id/operational-state`. */
  getOperationalState(careSpaceId: string): Observable<OperationalState> {
    return this.http.get<OperationalState>(this.url(`/care-spaces/${enc(careSpaceId)}/operational-state`));
  }

  /** `POST /care-spaces/:id/availability` con `If-Match-Ops`. */
  changeAvailability(careSpaceId: string, opsVersion: number, body: AvailabilityRequest): Observable<AvailabilityResult> {
    return this.http.post<AvailabilityResult>(this.url(`/care-spaces/${enc(careSpaceId)}/availability`), body, {
      headers: ifMatchOps(opsVersion),
    });
  }

  /** `GET /care-spaces/:id/blocks?includeEnded`. */
  listBlocks(careSpaceId: string, includeEnded = false): Observable<readonly CareSpaceBlock[]> {
    return this.http.get<readonly CareSpaceBlock[]>(this.url(`/care-spaces/${enc(careSpaceId)}/blocks`), {
      params: new HttpParams().set('includeEnded', String(includeEnded)),
    });
  }

  /** `POST /care-space-blocks/:id/end` — el fin de un mantenimiento deja la orden `MAINTENANCE_END`. */
  endBlock(blockId: string, note: string): Observable<MutationResult> {
    return this.http.post<MutationResult>(this.url(`/care-space-blocks/${enc(blockId)}/end`), { note });
  }

  /** `POST /care-space-blocks/:id/cancel`. */
  cancelBlock(blockId: string, reason: string): Observable<MutationResult> {
    return this.http.post<MutationResult>(this.url(`/care-space-blocks/${enc(blockId)}/cancel`), { reason });
  }

  /** `POST /care-spaces/:id/hygiene` con `If-Match-Ops`. */
  changeHygiene(careSpaceId: string, opsVersion: number, body: HygieneRequest): Observable<HygieneResult> {
    return this.http.post<HygieneResult>(this.url(`/care-spaces/${enc(careSpaceId)}/hygiene`), body, {
      headers: ifMatchOps(opsVersion),
    });
  }

  /** `POST /care-spaces/:id/isolation` con `If-Match-Ops`. */
  changeIsolation(careSpaceId: string, opsVersion: number, body: IsolationRequest): Observable<IsolationResult> {
    return this.http.post<IsolationResult>(this.url(`/care-spaces/${enc(careSpaceId)}/isolation`), body, {
      headers: ifMatchOps(opsVersion),
    });
  }

  /** `GET /sites/:siteId/cleaning-orders` — **sin datos de paciente**. */
  listCleaningOrders(siteId: string, query: CleaningOrderQuery = {}): Observable<CleaningOrderPage> {
    let params = new HttpParams();
    if (query.status && query.status.length > 0) params = params.set('status', query.status.join(','));
    if (query.unitId) params = params.set('unitId', query.unitId);
    if (query.assignedTo) params = params.set('assignedTo', query.assignedTo);
    if (query.priority) params = params.set('priority', query.priority);
    return this.http.get<CleaningOrderPage>(this.url(`/sites/${enc(siteId)}/cleaning-orders`), { params });
  }

  /** `POST /sites/:siteId/cleaning-orders` — orden manual. */
  createCleaningOrder(siteId: string, body: CreateCleaningOrderRequest): Observable<CleaningOrderResult> {
    return this.http.post<CleaningOrderResult>(this.url(`/sites/${enc(siteId)}/cleaning-orders`), body);
  }

  assignCleaningOrder(id: string, rowVersion: number, userId: string | null): Observable<CleaningOrderResult> {
    return this.transition(id, 'assign', rowVersion, { userId });
  }

  startCleaningOrder(id: string, rowVersion: number): Observable<CleaningOrderResult> {
    return this.transition(id, 'start', rowVersion, {});
  }

  finishCleaningOrder(id: string, rowVersion: number, note?: string): Observable<CleaningOrderResult> {
    return this.transition(id, 'finish', rowVersion, note === undefined ? {} : { note });
  }

  /** `inspect` — quien terminó la limpieza no puede inspeccionarla (422). */
  inspectCleaningOrder(id: string, rowVersion: number, result: 'PASS' | 'FAIL', reasonText?: string): Observable<CleaningOrderResult> {
    return this.transition(id, 'inspect', rowVersion, reasonText === undefined ? { result } : { result, reasonText });
  }

  cancelCleaningOrder(id: string, rowVersion: number, reason: string): Observable<CleaningOrderResult> {
    return this.transition(id, 'cancel', rowVersion, { reason });
  }

  /** `GET /care-spaces/:id/status-events` — historial A20. */
  listStatusEvents(careSpaceId: string, axis?: StatusAxisCode): Observable<StatusEventPage> {
    let params = new HttpParams();
    if (axis) params = params.set('axis', axis);
    return this.http.get<StatusEventPage>(this.url(`/care-spaces/${enc(careSpaceId)}/status-events`), { params });
  }

  private transition(
    id: string,
    action: 'assign' | 'start' | 'finish' | 'inspect' | 'cancel',
    rowVersion: number,
    body: Record<string, unknown>,
  ): Observable<CleaningOrderResult> {
    return this.http.post<CleaningOrderResult>(this.url(`/cleaning-orders/${enc(id)}/${action}`), body, {
      headers: new HttpHeaders({ 'If-Match': String(rowVersion) }),
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(valor: string): string {
  return encodeURIComponent(valor);
}

function ifMatchOps(opsVersion: number): HttpHeaders {
  return new HttpHeaders({ 'If-Match-Ops': String(opsVersion) });
}
