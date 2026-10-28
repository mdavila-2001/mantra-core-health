import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PaymentReceiptsClient } from '../../../core/data-access/scheduling/payment-receipts.client';
import {
  PAYMENT_RECEIPT_MIME_TYPES,
  type PaymentReceipt,
} from '../../../core/data-access/scheduling/payment-receipts.types';

/**
 * En qué está el archivo de un comprobante.
 *
 * `previewable` dice si los bytes se pueden mostrar —una imagen o un PDF de
 * los que admite un comprobante— o sólo descargar.
 */
export type ReceiptFileState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly url: string; readonly previewable: boolean }
  | { readonly status: 'failed' };

/** El tipo de unos bytes que no se muestran: el navegador sólo los descarga. */
const DOWNLOAD_ONLY_MIME_TYPE = 'application/octet-stream';

/**
 * La URL de objeto de un archivo ya bajado, o `null`.
 *
 * Sólo una `blob:`: es la única que crea {@link ReceiptFiles}, y el visor la
 * pone en un `<iframe>` saltándose el saneado de Angular. Cualquier otra cosa
 * no se dibuja.
 */
export function objectUrlOf(file: ReceiptFileState | undefined): string | null {
  return file?.status === 'ready' && file.url.startsWith('blob:') ? file.url : null;
}

/** La misma URL, si los bytes se pueden mostrar; `null` si sólo se descargan. */
export function previewUrlOf(file: ReceiptFileState | undefined): string | null {
  return file?.status === 'ready' && file.previewable ? objectUrlOf(file) : null;
}

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
 * es revocarlas todas cuando el modal se cierra. Por lo mismo, una descarga
 * que sigue en vuelo al cerrarse se corta: si sus bytes llegaran después, su
 * URL nacería cuando ya no queda nadie que la revoque.
 *
 * ## El tipo lo pone la lista, no la respuesta
 *
 * Los bytes se vuelven a tipar con el `mimeType` que declaró la lista, y sólo
 * si es uno de los que admite un comprobante (`PAYMENT_RECEIPT_MIME_TYPES`);
 * cualquier otro queda como descarga, sin vista previa. Es lo mismo que hace
 * el visor de resultados de laboratorio con un PDF mal tipado: lo que se
 * dibuja dentro de la aplicación no depende de la cabecera de una respuesta.
 */
@Injectable()
export class ReceiptFiles {
  private readonly client = inject(PaymentReceiptsClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly files = signal<ReadonlyMap<string, ReceiptFileState>>(new Map());

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeAll());
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
  request(bookingId: string, receipt: Pick<PaymentReceipt, 'id' | 'mimeType'>): void {
    const current = this.stateOf(receipt.id);
    if (!this.isBrowser || current?.status === 'loading' || current?.status === 'ready') {
      return;
    }
    this.set(receipt.id, { status: 'loading' });
    this.client
      .content(bookingId, receipt.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => this.set(receipt.id, toReadyFile(blob, receipt.mimeType)),
        // La fila cae al ícono del formato y el visor ofrece reintentar: el
        // fallo se muestra donde se mira el archivo, no como aviso suelto.
        error: () => this.set(receipt.id, { status: 'failed' }),
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

/** Los bytes con el tipo que declaró la lista, o como descarga si no es uno admitido. */
function toReadyFile(blob: Blob, mimeType: string): ReceiptFileState {
  const previewable = PAYMENT_RECEIPT_MIME_TYPES.includes(mimeType);
  const type = previewable ? mimeType : DOWNLOAD_ONLY_MIME_TYPE;
  const typed = blob.type === type ? blob : new Blob([blob], { type });
  return { status: 'ready', url: URL.createObjectURL(typed), previewable };
}
