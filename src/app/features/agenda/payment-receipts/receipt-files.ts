import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { PaymentReceiptsClient } from '../../../core/data-access/scheduling/payment-receipts.client';

/** En qué está el archivo de un comprobante. */
export type ReceiptFileState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly url: string }
  | { readonly status: 'failed' };

/**
 * Los archivos de los comprobantes de un modal, bajados una sola vez.
 *
 * La miniatura de la fila y el visor muestran **los mismos bytes**: se piden
 * una vez por comprobante y se sirven como URL de objeto (`blob:`), que la CSP
 * admite en `img-src` y `frame-src`. Un `data:` de una foto de 5 MB serían
 * casi 7 MB de texto en memoria por cada miniatura.
 *
 * Se provee **por modal** y no en la raíz: las URL de objeto retienen los
 * bytes hasta que alguien las revoca, y la única forma de no olvidar ninguna
 * es revocarlas todas cuando el modal se cierra.
 */
@Injectable()
export class ReceiptFiles {
  private readonly client = inject(PaymentReceiptsClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly files = signal<ReadonlyMap<string, ReceiptFileState>>(new Map());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokeAll());
  }

  /** Lo que se sabe del archivo de un comprobante; `undefined` si nadie lo pidió. */
  stateOf(receiptId: string): ReceiptFileState | undefined {
    return this.files().get(receiptId);
  }

  /**
   * Baja el archivo si todavía no está, o si la vez anterior falló.
   *
   * Bajo SSR no hace nada: no hay a quién mostrarle los bytes, y el modal sólo
   * existe después de un clic.
   */
  request(bookingId: string, receiptId: string): void {
    const current = this.stateOf(receiptId);
    if (!this.isBrowser || current?.status === 'loading' || current?.status === 'ready') {
      return;
    }
    this.set(receiptId, { status: 'loading' });
    this.client.content(bookingId, receiptId).subscribe({
      next: (blob) => this.set(receiptId, { status: 'ready', url: URL.createObjectURL(blob) }),
      // La fila cae al ícono del formato y el visor ofrece reintentar: el
      // fallo se muestra donde se mira el archivo, no como aviso suelto.
      error: () => this.set(receiptId, { status: 'failed' }),
    });
  }

  private set(receiptId: string, state: ReceiptFileState): void {
    this.files.update((current) => new Map(current).set(receiptId, state));
  }

  private revokeAll(): void {
    for (const state of this.files().values()) {
      if (state.status === 'ready') URL.revokeObjectURL(state.url);
    }
  }
}
