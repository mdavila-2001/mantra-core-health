import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, defer, map, switchMap, tap, throwError, type Observable } from 'rxjs';

import { readApiError } from '../../http/api-error';
import { API_BASE_URL, apiUrl } from '../api';
import {
  confirmOrderRequest,
  createOrderRequest,
  dispenseOrderRequest,
  pharmacyOrderFromDto,
} from './pharmacy-orders.adapter';
import type {
  CreatePharmacyOrderDto,
  PharmacyOrderDto,
  PharmacyOrderListResponseDto,
} from './pharmacy-orders.dto';
import type {
  AjusteDeLinea,
  BorradorDePedido,
  EnvioDePedido,
  EstadoDePedido,
  PedidoFarmacia,
  RegistroDeRetiro,
  ResultadoDeDispensa,
} from './pharmacy-orders.types';

export interface PharmacyOrderTenantQuery {
  readonly status?: string;
  readonly siteId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
}

/** HTTP client for the real `/pharmacy/orders` contract. */
@Injectable({ providedIn: 'root' })
export class PharmacyOrdersClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly draft = signal<BorradorDePedido | null>(null);
  private readonly createKeys = new WeakMap<BorradorDePedido, string>();
  private readonly dispenseKeys = new Map<string, string>();

  /** Ephemeral navigation state only; orders are never stored or simulated here. */
  readonly borradorPreparado = this.draft.asReadonly();

  prepararBorrador(draft: BorradorDePedido): void {
    this.draft.set(draft);
  }

  descartarBorrador(): void {
    this.draft.set(null);
  }

  enviar(order: EnvioDePedido): Observable<PedidoFarmacia> {
    return defer(() => {
      const key = this.createKeyFor(order.borrador);
      const body = createOrderRequest(order, key);
      return this.http.post<PharmacyOrderDto>(this.url('/pharmacy/orders'), body).pipe(
        map((dto) => pharmacyOrderFromDto(dto)),
        tap(() => this.draft.set(null)),
      );
    });
  }

  misPedidos(): Observable<readonly PedidoFarmacia[]> {
    return this.http
      .get<PharmacyOrderListResponseDto>(this.url('/pharmacy/orders/me'))
      .pipe(map((response) => response.items.map((dto) => pharmacyOrderFromDto(dto))));
  }

  /** A missing order remains the API's 404; it is never converted to `null`. */
  pedido(id: string): Observable<PedidoFarmacia> {
    return this.http
      .get<PharmacyOrderDto>(this.orderUrl(id))
      .pipe(map((dto) => pharmacyOrderFromDto(dto)));
  }

  /** Same endpoint, with the staff projection enforced again on the client. */
  pedidoParaMostrador(id: string): Observable<PedidoFarmacia> {
    return this.http
      .get<PharmacyOrderDto>(this.orderUrl(id))
      .pipe(map((dto) => pharmacyOrderFromDto(dto, 'staff')));
  }

  aceptarSustituciones(id: string): Observable<PedidoFarmacia> {
    return this.postOrder(id, 'accept-substitutions');
  }

  preferirOriginal(id: string): Observable<PedidoFarmacia> {
    return this.postOrder(id, 'prefer-original');
  }

  cancelar(id: string): Observable<PedidoFarmacia> {
    return this.postOrder(id, 'cancel');
  }

  /** Re-creates a terminal order through the same real POST contract. */
  reintentar(id: string): Observable<PedidoFarmacia> {
    return this.pedido(id).pipe(
      switchMap((order) => {
        const body: CreatePharmacyOrderDto = {
          siteId: order.siteId,
          ...(order.requestId === null ? {} : { medicationRequestId: order.requestId }),
          deliveryMode: 'RETIRO',
          idempotencyKey: newIdempotencyKey(),
          lines: order.lineas.map((line) => {
            if (!line.productId) {
              throw new Error('No se puede repetir un pedido sin productos publicados.');
            }
            return { productId: line.productId, quantity: line.cantidad };
          }),
        };
        return this.http.post<PharmacyOrderDto>(this.url('/pharmacy/orders'), body);
      }),
      map((dto) => pharmacyOrderFromDto(dto)),
    );
  }

  pedidosDeFarmacia(query: PharmacyOrderTenantQuery = {}): Observable<readonly PedidoFarmacia[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http
      .get<PharmacyOrderListResponseDto>(this.url('/pharmacy/orders'), { params })
      .pipe(map((response) => response.items.map((dto) => pharmacyOrderFromDto(dto, 'staff'))));
  }

  abrirRevision(id: string): Observable<PedidoFarmacia> {
    return this.postOrder(id, 'review');
  }

  confirmarPedido(
    order: PedidoFarmacia | string,
    adjustments: readonly AjusteDeLinea[],
  ): Observable<PedidoFarmacia> {
    if (typeof order === 'string') {
      if (adjustments.some((adjustment) => adjustment.decision !== 'TAL_CUAL')) {
        return unsupportedOperation('Los ajustes requieren las líneas del pedido.');
      }
      return this.http
        .post<PharmacyOrderDto>(`${this.orderUrl(order)}/confirm`, {})
        .pipe(map((dto) => pharmacyOrderFromDto(dto)));
    }
    const body = confirmOrderRequest(order, adjustments);
    return this.http
      .post<PharmacyOrderDto>(`${this.orderUrl(order.id)}/confirm`, body)
      .pipe(map((dto) => pharmacyOrderFromDto(dto)));
  }

  rechazarPedido(id: string, reason: string): Observable<PedidoFarmacia> {
    return this.http
      .post<PharmacyOrderDto>(`${this.orderUrl(id)}/reject`, { reason })
      .pipe(map((dto) => pharmacyOrderFromDto(dto)));
  }

  marcarListo(id: string): Observable<PedidoFarmacia> {
    return this.postOrder(id, 'ready');
  }

  dispensar(order: PedidoFarmacia, withdrawal: RegistroDeRetiro): Observable<ResultadoDeDispensa> {
    const requestKey = `${order.id}|${withdrawal.codigo}|${[...withdrawal.indices].sort().join(',')}`;
    const idempotencyKey = this.dispenseKeys.get(requestKey) ?? newIdempotencyKey();
    this.dispenseKeys.set(requestKey, idempotencyKey);
    const body = dispenseOrderRequest(order, withdrawal, idempotencyKey);
    return this.http.post<PharmacyOrderDto>(`${this.orderUrl(order.id)}/dispense`, body).pipe(
      map((dto) => ({ codigoValido: true, pedido: pharmacyOrderFromDto(dto) })),
      catchError((error: unknown) => {
        if (isPickupCodeMismatch(error)) {
          return [{ codigoValido: false, pedido: null } satisfies ResultadoDeDispensa];
        }
        return throwError(() => error);
      }),
    );
  }

  private postOrder(id: string, action: string): Observable<PedidoFarmacia> {
    return this.http
      .post<PharmacyOrderDto>(`${this.orderUrl(id)}/${action}`, {})
      .pipe(map((dto) => pharmacyOrderFromDto(dto)));
  }

  private createKeyFor(draft: BorradorDePedido): string {
    const current = this.createKeys.get(draft);
    if (current) return current;
    const created = newIdempotencyKey();
    this.createKeys.set(draft, created);
    return created;
  }

  private orderUrl(id: string): string {
    return this.url(`/pharmacy/orders/${encodeURIComponent(id)}`);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function isPickupCodeMismatch(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 422) return false;
  const body = readApiError(error);
  return (
    body?.code === 'PRECONDITION_FAILED' && body.details?.['reason'] === 'PICKUP_CODE_MISMATCH'
  );
}

function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function unsupportedOperation(message: string): Observable<never> {
  return throwError(() => new Error(message));
}

export function puedeCancelarse(status: EstadoDePedido): boolean {
  return !esEstadoTerminal(status);
}

export function esEstadoTerminal(status: EstadoDePedido): boolean {
  return ['RETIRADO', 'RECHAZADO', 'VENCIDO', 'CANCELADO'].includes(status);
}

export function puedeConfirmarse(status: EstadoDePedido): boolean {
  return status === 'EN_REVISION';
}

export function puedeRechazarsePorFarmacia(status: EstadoDePedido): boolean {
  return ['ENVIADO', 'EN_REVISION'].includes(status);
}

export function puedePrepararse(status: EstadoDePedido): boolean {
  return status === 'CONFIRMADO' || status === 'ACEPTADO';
}

/** Compatibility predicate consumed by the out-of-scope payment presentation. */
export function estaPagado(order: PedidoFarmacia): boolean {
  return order.pago?.estado === 'PAGADO';
}
