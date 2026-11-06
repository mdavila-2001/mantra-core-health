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
 * El QR de una orden para llevar o mandar al laboratorio (06/11/2026).
 *
 * El paciente lo muestra en el mostrador, lo descarga, o lo copia como imagen o
 * como código para pegarlo en el chat o en un correo. El centro lo lee y la
 * orden queda dirigida a él. Debajo del QR va el código en texto: es lo que se
 * escribe a mano si el lector no anda.
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
