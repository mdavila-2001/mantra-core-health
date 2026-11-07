import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { orderQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { drawQr } from '../../../../shared/utils/qr/draw-qr';

const LADO_DEL_QR = 240;

/**
 * An order's QR to carry or send to the center: the patient shows it at the counter, downloads it,
 * or copies it as an image or as a code to paste in the chat or an email. The code in text is what
 * is typed by hand when the reader does not work.
 */
@Component({
  selector: 'app-order-qr-dialog',
  imports: [AppButton, ContentDialog],
  templateUrl: './order-qr-dialog.html',
  styleUrl: './order-qr-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderQrDialog {
  private readonly toasts = inject(ToastService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');

  readonly orderId = input.required<string>();
  readonly studyLabel = input.required<string>();
  readonly closed = output<void>();

  protected readonly lado = LADO_DEL_QR;
  protected readonly qrDisponible = signal(true);
  protected code(): string {
    return orderQrCode(this.orderId());
  }

  constructor() {
    effect(() => {
      const lienzo = this.canvas();
      const code = orderQrCode(this.orderId());
      if (!this.isBrowser || lienzo === undefined) return;
      drawQr(lienzo.nativeElement, code, LADO_DEL_QR).catch(() => this.qrDisponible.set(false));
    });
  }

  protected async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.toasts.success('Código copiado.');
    } catch {
      this.toasts.error('No pudimos copiar. Selecciónelo y cópielo a mano.');
    }
  }

  protected async copyImage(): Promise<void> {
    try {
      const blob = await this.toBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.toasts.success('Imagen copiada. Péguela en el chat o en un correo.');
    } catch {
      this.toasts.error('Este navegador no deja copiar la imagen. Descárguela.');
    }
  }

  protected async download(): Promise<void> {
    try {
      const url = URL.createObjectURL(await this.toBlob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'qr-de-la-orden.png';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toasts.error('No pudimos preparar la imagen.');
    }
  }

  private toBlob(): Promise<Blob> {
    const lienzo = this.canvas()?.nativeElement;
    return new Promise((resolve, reject) => {
      if (lienzo === undefined) return reject(new Error('sin lienzo'));
      lienzo.toBlob((blob) => (blob === null ? reject(new Error('sin imagen')) : resolve(blob)), 'image/png');
    });
  }
}
