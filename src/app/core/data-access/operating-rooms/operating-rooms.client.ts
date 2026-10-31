import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CreateOrBlockRequest,
  CreateOrBlockResult,
  OperatingRoomSummary,
  OrBlock,
  OrBlockQuery,
  OrUtilization,
  OrUtilizationQuery,
  TurnoverCleaning,
  TurnoverStep,
} from './operating-rooms.types';

/**
 * Cliente de quirófanos — franja F4 (`CONTRATO-F2-F5.md` §F4.3).
 *
 * La sala es un espacio de F1; lo que este cliente agrega es su calendario
 * (bloques con liberación) y su medición (utilización). Los casos siguen en
 * `ProceduresClient`: son del módulo perioperatorio, no de la sala.
 *
 * ## La autoridad es la API
 *
 * Una sede o un bloque de otro tenant responde **404**, igual que uno
 * inexistente, y una acción fuera de rol **403**: este cliente no los
 * distingue de antemano ni filtra nada por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class OperatingRoomsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /sites/:siteId/operating-rooms` — las salas con su preparación y limpieza. */
  listOperatingRooms(siteId: string): Observable<readonly OperatingRoomSummary[]> {
    return this.http.get<readonly OperatingRoomSummary[]>(this.url(`/sites/${enc(siteId)}/operating-rooms`));
  }

  /** `GET /sites/:siteId/or-blocks` — bloques del rango, con su uso y sus casos. */
  listBlocks(siteId: string, query: OrBlockQuery): Observable<readonly OrBlock[]> {
    return this.http.get<readonly OrBlock[]>(this.url(`/sites/${enc(siteId)}/or-blocks`), {
      params: paramsOf(query),
    });
  }

  /** `POST /sites/:siteId/or-blocks` — un bloque o una serie semanal (máx. 400 instancias). */
  createBlock(siteId: string, body: CreateOrBlockRequest): Observable<CreateOrBlockResult> {
    return this.http.post<CreateOrBlockResult>(this.url(`/sites/${enc(siteId)}/or-blocks`), body);
  }

  /**
   * `POST /or-blocks/:id/release` — el tiempo sin usar vuelve a la agenda abierta.
   *
   * Lleva `If-Match` con la versión leída: liberar un bloque que alguien acaba
   * de usar para un caso tiene que fallar con 412, no pisar.
   */
  releaseBlock(id: string, rowVersion: number, reasonText: string): Observable<OrBlock> {
    return this.http.post<OrBlock>(this.url(`/or-blocks/${enc(id)}/release`), { reasonText }, { headers: ifMatch(rowVersion) });
  }

  /** `POST /or-blocks/:id/cancel`. Mismo `If-Match` que la liberación. */
  cancelBlock(id: string, rowVersion: number, reasonText: string): Observable<OrBlock> {
    return this.http.post<OrBlock>(this.url(`/or-blocks/${enc(id)}/cancel`), { reasonText }, { headers: ifMatch(rowVersion) });
  }

  /** `GET /sites/:siteId/or-utilization` — KPI de sala y de bloque. */
  getUtilization(siteId: string, query: OrUtilizationQuery): Observable<OrUtilization> {
    return this.http.get<OrUtilization>(this.url(`/sites/${enc(siteId)}/or-utilization`), {
      params: paramsOf(query),
    });
  }

  /**
   * `POST /cleaning-orders/:id/{start|finish|inspect}` — el recambio de la sala
   * (contrato de F2), con `If-Match` de la orden. Inspeccionar va con `PASS`:
   * el rechazo con motivo vive en la cola de limpieza de F2.
   */
  turnoverStep(id: string, step: TurnoverStep, rowVersion: number): Observable<TurnoverCleaning> {
    return this.http.post<TurnoverCleaning>(this.url(`/cleaning-orders/${enc(id)}/${step}`), step === 'inspect' ? { result: 'PASS' } : {}, { headers: ifMatch(rowVersion) });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

const enc = encodeURIComponent;

const ifMatch = (rowVersion: number): HttpHeaders => new HttpHeaders({ 'If-Match': `"${rowVersion}"` });

/** Lo ausente no viaja: la API valida con `forbidNonWhitelisted`. */
function paramsOf(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}
