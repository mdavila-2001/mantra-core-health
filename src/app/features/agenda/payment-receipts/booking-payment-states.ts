import { Injectable, signal } from '@angular/core';

import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';

/**
 * El estado de pago que la API devolvió **después** de leer la agenda.
 *
 * Confirmar un comprobante o marcar el pago a mano responden con el
 * `paymentState` nuevo de la cita. La agenda lo pinta en el acto con esto, sin
 * volver a pedir la lista: releerla la dejaría en esqueleto, y quien atiende
 * vería parpadear su día por un cambio en una sola fila.
 *
 * ## Gana el más nuevo, no el último que llegó
 *
 * Lo anotado acá convive con lo que trae la próxima lectura de la agenda, y
 * esa lectura puede saber algo más nuevo —otra persona lo cambió después—. Por
 * eso se comparan los `markedAt`: lo anotado sólo pisa lo leído si es
 * posterior, y una lectura fresca vuelve a mandar sola.
 */
@Injectable({ providedIn: 'root' })
export class BookingPaymentStates {
  private readonly recorded = signal<ReadonlyMap<string, PaymentStateInfo>>(new Map());

  /** Anota el estado de pago que devolvió la API para una cita. */
  record(bookingId: string, state: PaymentStateInfo): void {
    this.recorded.update((current) => new Map(current).set(bookingId, state));
  }

  /**
   * El estado de pago más nuevo de una cita.
   *
   * @param bookingId - La cita.
   * @param fromBooking - El que trajo la lectura de la cita; `null` si nadie
   *   lo marcó todavía.
   */
  resolve(bookingId: string, fromBooking: PaymentStateInfo | null): PaymentStateInfo | null {
    const recorded = this.recorded().get(bookingId);
    if (recorded === undefined) return fromBooking;
    if (fromBooking === null) return recorded;
    return recorded.markedAt.getTime() >= fromBooking.markedAt.getTime() ? recorded : fromBooking;
  }
}
