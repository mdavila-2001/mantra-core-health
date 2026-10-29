import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { InfrastructureCatalog } from '../infrastructure/infrastructure.types';
import type {
  AssignRequest,
  AvailabilityRequest,
  AvailabilityResult,
  BedBoard,
  BedBoardQuery,
  CancelCleaningRequest,
  CareSpaceBlock,
  CleaningOrder,
  CleaningOrderList,
  CleaningOrderQuery,
  CleaningTransition,
  CreateCleaningOrderRequest,
  FinishRequest,
  HygieneRequest,
  HygieneResult,
  InspectRequest,
  IsolationRequest,
  IsolationResult,
  OperationalState,
  OpsCatalogExtension,
  StatusEventPage,
  StatusEventQuery,
} from './infrastructure-ops.types';

/**
 * Cliente de la **operación de camas y salas** — franja F2, módulo 14
 * (`practice`). Un método por fila de la tabla de F2.3 de `CONTRATO-F2-F5.md`.
 *
 * ## Dos versiones, dos cabeceras
 *
 * - Las mutaciones **operativas** de un espacio (disponibilidad, higiene,
 *   aislamiento) llevan `If-Match-Ops: <opsVersion>`: una versión aparte de
 *   `row_version`, para que limpieza y enfermería no choquen con quien edita la
 *   estructura. Con una versión vieja la API responde 412 `OPS_VERSION_MISMATCH`.
 * - Las transiciones de una **orden de limpieza** llevan `If-Match:
 *   <rowVersion de la orden>`: dos operarios que toman la misma orden compiten
 *   y gana el primero.
 *
 * ## Lo que este cliente NO decide
 *
 * Quién puede hacer qué, si una cama está ocupada, si el local sirve para un
 * aislamiento aéreo: lo valida la API en cada llamada. La pantalla solo ofrece
 * menos opciones inválidas.
 */
@Injectable({ providedIn: 'root' })
export class InfrastructureOpsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practice/infrastructure-catalog` — el catálogo de F1 extendido por F2. */
  getCatalog(): Observable<InfrastructureCatalog & Partial<OpsCatalogExtension>> {
    return this.http.get<InfrastructureCatalog & Partial<OpsCatalogExtension>>(
      this.url('/practice/infrastructure-catalog'),
    );
  }

  /** `GET /sites/:siteId/bed-board` — la cabecera `X-Data-As-Of` repite `lastEventAt`. */
  getBedBoard(siteId: string, query: BedBoardQuery = {}): Observable<BedBoard> {
    let params = new HttpParams();
    if (query.unitId) params = params.set('unitId', query.unitId);
    if (query.parentSpaceId) params = params.set('parentSpaceId', query.parentSpaceId);
    if (query.functionCodes?.length) params = params.set('functionCodes', query.functionCodes.join(','));
    if (query.v2Codes?.length) params = params.set('v2Codes', query.v2Codes.join(','));
    if (query.cursor) params = params.set('cursor', query.cursor);
    return this.http.get<BedBoard>(this.url(`/sites/${enc(siteId)}/bed-board`), { params });
  }

  /** `GET /care-spaces/:id/operational-state` — la celda con bloqueos y orden abierta. */
  getOperationalState(id: string): Observable<OperationalState> {
    return this.http.get<OperationalState>(this.url(`/care-spaces/${enc(id)}/operational-state`));
  }

  /** `POST /care-spaces/:id/availability` con `If-Match-Ops`. */
  changeAvailability(id: string, opsVersion: number, body: AvailabilityRequest): Observable<AvailabilityResult> {
    return this.http.post<AvailabilityResult>(this.url(`/care-spaces/${enc(id)}/availability`), body, {
      headers: ifMatchOps(opsVersion),
    });
  }

  /** `GET /care-spaces/:id/blocks?includeEnded`. */
  listBlocks(id: string, includeEnded = false): Observable<readonly CareSpaceBlock[]> {
    let params = new HttpParams();
    if (includeEnded) params = params.set('includeEnded', 'true');
    return this.http.get<readonly CareSpaceBlock[]>(this.url(`/care-spaces/${enc(id)}/blocks`), { params });
  }

  /** `POST /care-space-blocks/:id/end` — fin de un mantenimiento crea la orden `MAINTENANCE_END`. */
  endBlock(blockId: string, note: string): Observable<CareSpaceBlock> {
    return this.http.post<CareSpaceBlock>(this.url(`/care-space-blocks/${enc(blockId)}/end`), { note });
  }

  /** `POST /care-space-blocks/:id/cancel`. */
  cancelBlock(blockId: string, reason: string): Observable<CareSpaceBlock> {
    return this.http.post<CareSpaceBlock>(this.url(`/care-space-blocks/${enc(blockId)}/cancel`), { reason });
  }

  /** `POST /care-spaces/:id/hygiene` con `If-Match-Ops`. `mark-contaminated` escala una orden abierta. */
  changeHygiene(id: string, opsVersion: number, body: HygieneRequest): Observable<HygieneResult> {
    return this.http.post<HygieneResult>(this.url(`/care-spaces/${enc(id)}/hygiene`), body, {
      headers: ifMatchOps(opsVersion),
    });
  }

  /** `POST /care-spaces/:id/isolation` con `If-Match-Ops`. */
  changeIsolation(id: string, opsVersion: number, body: IsolationRequest): Observable<IsolationResult> {
    return this.http.post<IsolationResult>(this.url(`/care-spaces/${enc(id)}/isolation`), body, {
      headers: ifMatchOps(opsVersion),
    });
  }

  /** `GET /sites/:siteId/cleaning-orders` — sin datos de paciente. */
  listCleaningOrders(siteId: string, query: CleaningOrderQuery = {}): Observable<CleaningOrderList> {
    let params = new HttpParams();
    if (query.status) params = params.set('status', query.status);
    if (query.unitId) params = params.set('unitId', query.unitId);
    if (query.assignedTo) params = params.set('assignedTo', query.assignedTo);
    if (query.priority) params = params.set('priority', query.priority);
    if (query.cursor) params = params.set('cursor', query.cursor);
    return this.http.get<CleaningOrderList>(this.url(`/sites/${enc(siteId)}/cleaning-orders`), { params });
  }

  /** `POST /sites/:siteId/cleaning-orders` — pedido manual. */
  createCleaningOrder(siteId: string, body: CreateCleaningOrderRequest): Observable<CleaningOrder> {
    return this.http.post<CleaningOrder>(this.url(`/sites/${enc(siteId)}/cleaning-orders`), body);
  }

  /** `POST /cleaning-orders/:id/assign` con `If-Match`. */
  assign(id: string, rowVersion: number, body: AssignRequest): Observable<CleaningOrder> {
    return this.transition(id, 'assign', rowVersion, body);
  }

  /** `POST /cleaning-orders/:id/start` con `If-Match`. */
  start(id: string, rowVersion: number): Observable<CleaningOrder> {
    return this.transition(id, 'start', rowVersion, {});
  }

  /** `POST /cleaning-orders/:id/finish` con `If-Match`. */
  finish(id: string, rowVersion: number, body: FinishRequest = {}): Observable<CleaningOrder> {
    return this.transition(id, 'finish', rowVersion, body);
  }

  /** `POST /cleaning-orders/:id/inspect` con `If-Match`. FAIL exige `reasonText`. */
  inspect(id: string, rowVersion: number, body: InspectRequest): Observable<CleaningOrder> {
    return this.transition(id, 'inspect', rowVersion, body);
  }

  /** `POST /cleaning-orders/:id/cancel` con `If-Match`. */
  cancel(id: string, rowVersion: number, body: CancelCleaningRequest): Observable<CleaningOrder> {
    return this.transition(id, 'cancel', rowVersion, body);
  }

  /** `GET /care-spaces/:id/status-events` — el historial A20, paginado. */
  listStatusEvents(id: string, query: StatusEventQuery = {}): Observable<StatusEventPage> {
    let params = new HttpParams();
    if (query.axis) params = params.set('axis', query.axis);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.cursor) params = params.set('cursor', query.cursor);
    return this.http.get<StatusEventPage>(this.url(`/care-spaces/${enc(id)}/status-events`), { params });
  }

  private transition(
    id: string,
    action: CleaningTransition,
    rowVersion: number,
    body: object,
  ): Observable<CleaningOrder> {
    return this.http.post<CleaningOrder>(this.url(`/cleaning-orders/${enc(id)}/${action}`), body, {
      headers: new HttpHeaders({ 'If-Match': String(rowVersion) }),
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

function ifMatchOps(opsVersion: number): HttpHeaders {
  return new HttpHeaders({ 'If-Match-Ops': String(opsVersion) });
}
