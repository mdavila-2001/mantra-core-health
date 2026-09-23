import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';

import { readApiError } from '../../http/api-error';
import { generarCodigoLegible } from '../../codigo-legible/codigo-legible';
import { API_BASE_URL, apiUrl } from '../api';
import {
  canjeDesdeDto,
  membresiaDesdeDto,
  paginaDesdeDto,
} from './loyalty.adapter';
import type {
  MyLoyaltyResponseDto,
  PointsLedgerPageDto,
  PointsLedgerResponseDto,
  RedeemPointsRequestDto,
} from './loyalty.dto';
import {
  type Canje,
  type ComprobanteDeCanje,
  type Membresia,
  type PaginaDeMovimientos,
  type PedidoDeCanje,
} from './loyalty.types';

/** Cuántos caracteres tiene el código que se dicta en la caja. */
const LARGO_DEL_CODIGO_DE_CANJE = 8;

/**
 * Cuánto vive el comprobante de canje.
 *
 * Corto a propósito: es un código que se muestra en la caja, ahí mismo. Un
 * comprobante que vive horas invita a generarlo «por las dudas» y a que el
 * saldo quede descontado sin que nadie lo use.
 */
const MINUTOS_DE_VIGENCIA_DEL_CANJE = 15;

/**
 * El canje no alcanza: el saldo nunca queda negativo.
 *
 * Es regla del modelo y la aplica el backend, que responde
 * `PRECONDITION_FAILED` con el saldo y lo pedido en `details`.
 */
export class SaldoInsuficienteError extends Error {
  constructor(
    readonly saldo: string,
    readonly pedidos: string,
  ) {
    super(`El saldo disponible (${saldo}) no alcanza para canjear ${pedidos} puntos.`);
    this.name = 'SaldoInsuficienteError';
  }
}

/**
 * La billetera de puntos del paciente, contra el contrato real.
 *
 * ## Qué es real acá
 *
 * Todo. Las tres operaciones son HTTP contra el portal de lealtad de la API:
 * `GET /loyalty/me`, `GET /loyalty/me/points` y
 * `POST /loyalty/me/points/redeem`. **El titular nunca viaja desde el front**:
 * sale del token, y por eso ninguna de estas firmas recibe un identificador de
 * paciente o de membresía.
 *
 * No queda nada sembrado: ni saldo, ni movimientos, ni promoción de ejemplo.
 * Lo único que sigue produciendo el front es el **código del comprobante**,
 * porque quien lo escanea —el lado comercio— todavía no existe; la pantalla lo
 * acompaña con su chip DEMO desde que se construyó.
 */
@Injectable({ providedIn: 'root' })
export class LoyaltyClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Mi membresía.
   *
   * `null` = no hay inscripción en el programa del tenant. Es un estado normal
   * que la API responde con 200 y `enrolled: false`, no un error.
   */
  miMembresia(): Observable<Membresia | null> {
    return this.http
      .get<MyLoyaltyResponseDto>(this.url('/loyalty/me'))
      .pipe(map(membresiaDesdeDto));
  }

  /**
   * Mis movimientos, más nuevos primero.
   *
   * Paginado **por cursor**: el valor es opaco y se devuelve tal cual lo emitió
   * el backend. El front no lo interpreta ni lo fabrica.
   */
  misMovimientos(cursor: string | null = null): Observable<PaginaDeMovimientos> {
    const params =
      cursor === null ? new HttpParams() : new HttpParams().set('cursor', cursor);
    return this.http
      .get<PointsLedgerPageDto>(this.url('/loyalty/me/points'), { params })
      .pipe(map(paginaDesdeDto));
  }

  /**
   * Canjear puntos propios.
   *
   * El cuerpo lleva sólo la cantidad y la clave de idempotencia: la membresía
   * la resuelve el servidor con el paciente del token. Reintentar con la misma
   * clave devuelve el canje anterior en vez de descontar dos veces.
   */
  canjear(pedido: PedidoDeCanje): Observable<Canje> {
    const body: RedeemPointsRequestDto = {
      points: pedido.puntos,
      idempotencyKey: pedido.idempotencyKey,
    };
    return this.http
      .post<PointsLedgerResponseDto>(this.url('/loyalty/me/points/redeem'), body)
      .pipe(
        map(canjeDesdeDto),
        catchError((error: unknown) => throwError(() => this.errorDeCanje(error))),
      );
  }

  /**
   * El comprobante que se muestra en la caja.
   *
   * El canje ya es real —el saldo bajó en el backend—; lo que sigue siendo del
   * front es el **código legible y su vencimiento**, porque la API no los emite
   * y el lado comercio no existe. Por eso la pantalla lo marca DEMO.
   */
  comprobanteDe(canje: Canje): ComprobanteDeCanje {
    const generadoEl = new Date();
    return {
      canje,
      codigo: generarCodigoLegible(LARGO_DEL_CODIGO_DE_CANJE),
      generadoEl,
      venceEl: new Date(generadoEl.getTime() + MINUTOS_DE_VIGENCIA_DEL_CANJE * 60 * 1000),
    };
  }

  /**
   * Distingue «no te alcanza» de cualquier otro fallo.
   *
   * Se ramifica por el `code` del contrato y por `details`, nunca por el texto:
   * el mensaje es para leer, no para decidir. El backend manda el saldo y lo
   * pedido junto al `PRECONDITION_FAILED` del canje.
   */
  private errorDeCanje(error: unknown): unknown {
    if (!(error instanceof HttpErrorResponse)) {
      return error;
    }
    const cuerpo = readApiError(error);
    if (cuerpo?.code !== 'PRECONDITION_FAILED') {
      return error;
    }
    const detalles = cuerpo.details ?? {};
    const saldo = detalles['pointsBalance'];
    const pedidos = detalles['requested'];
    if (typeof saldo !== 'string' || typeof pedidos !== 'string') {
      return error;
    }
    return new SaldoInsuficienteError(saldo, pedidos);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
