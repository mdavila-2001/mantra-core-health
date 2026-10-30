import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

import {
  describeReceipt,
  isPdfReceipt,
  receiptFileName,
} from '../../../../core/data-access/scheduling/payment-receipt-format';
import type { PaymentReceipt } from '../../../../core/data-access/scheduling/payment-receipts.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { nextControlId } from '../../../../shared/forms/form-control.context';
import { objectUrlOf, previewUrlOf, type ReceiptFileState } from '../receipt-files';

/**
 * El comprobante a tamaño completo, **dentro del modal**, con «Descargar».
 *
 * Es la misma forma de mirar un archivo que el visor de resultados de
 * laboratorio (`laboratory-results`): la imagen en un `<img>` y el PDF en un
 * `<iframe>`, los dos sobre la URL de objeto de los bytes ya bajados. No abre
 * una pestaña: la ruta del archivo exige sesión y una pestaña nueva sale sin
 * ella.
 *
 * Al abrirse lleva el foco a su título, para que quien navega con teclado o
 * lector sepa que cambió lo que tiene delante; «Volver a la lista» lo
 * devuelve a la fila (lo resuelve el modal).
 */
@Component({
  selector: 'app-payment-receipt-viewer',
  imports: [Alert, AppButton, AppButtonLink, NavIcon, Skeleton],
  templateUrl: './payment-receipt-viewer.html',
  styleUrl: './payment-receipt-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReceiptViewer {
  readonly receipt = input.required<PaymentReceipt>();
  readonly file = input<ReceiptFileState | undefined>(undefined);

  readonly back = output<void>();
  readonly retry = output<void>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');

  protected readonly titleId = nextControlId('payment-receipt-viewer');
  protected readonly isPdf = computed(() => isPdfReceipt(this.receipt()));
  protected readonly fileName = computed(() => receiptFileName(this.receipt()));
  protected readonly heading = computed(() => {
    const summary = describeReceipt(this.receipt());
    return summary.charAt(0).toLocaleUpperCase('es') + summary.slice(1);
  });

  /** Lo que se descarga: la URL de objeto de los bytes, sólo si es una `blob:`. */
  protected readonly downloadUrl = computed(() => objectUrlOf(this.file()));

  /** Lo que se muestra: la misma URL, sólo si el formato es uno admitido. */
  protected readonly previewUrl = computed(() => previewUrlOf(this.file()));

  /**
   * La URL del PDF para el `<iframe>`.
   *
   * Angular no deja poner una URL cualquiera en un `src` de marco, y está
   * bien: ésta es una URL de objeto (`blob:`, lo único que deja pasar
   * {@link previewUrlOf}) creada en este modal con los bytes que devolvió la
   * API para esta cita, no un texto que haya escrito nadie.
   */
  protected readonly frameUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.previewUrl();
    return url !== null && this.isPdf() ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  constructor() {
    afterNextRender(() => this.title().nativeElement.focus());
  }
}
