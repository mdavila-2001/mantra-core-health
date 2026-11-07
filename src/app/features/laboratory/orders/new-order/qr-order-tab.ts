import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';

import { orderIdFromQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { readApiError } from '../../../../core/http/api-error';
import { Input } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { QrReader, type QrCameraSession } from '../../../../shared/utils/qr/qr-reader';
import type { NewOrderResult } from './new-order.types';

/**
 * Way 1: the order QR the patient sent. Camera, image (upload or drop), clipboard (Ctrl+V or button)
 * or the code typed by hand all end in the same call, so a code is never read twice in different ways.
 */
@Component({
  selector: 'app-qr-order-tab',
  imports: [Alert, AppButton, FormField, Input, NavIcon],
  templateUrl: './qr-order-tab.html',
  styleUrl: './qr-order-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:paste)': 'onPaste($event)' },
})
export class QrOrderTab {
  private readonly lab = inject(LabPortalClient);
  private readonly qr = inject(QrReader);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private camera: QrCameraSession | null = null;

  readonly created = output<NewOrderResult>();

  protected readonly busy = signal(false);
  protected readonly cameraOn = signal(false);
  protected readonly dragging = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly manualCode = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopCamera());
  }

  protected async toggleCamera(): Promise<void> {
    if (this.cameraOn()) return this.stopCamera();
    this.error.set(null);
    this.cameraOn.set(true);
    await Promise.resolve(); // the <video> exists after the next change detection
    const element = this.video()?.nativeElement;
    if (element === undefined) return;
    try {
      this.camera = await this.qr.startCamera(element, (text) => this.useText(text));
    } catch (error: unknown) {
      this.cameraOn.set(false);
      const name = error instanceof DOMException ? error.name : '';
      this.error.set(
        name === 'NotAllowedError'
          ? 'No dio permiso para usar la cámara. Actívelo en el navegador o suba una imagen.'
          : name === 'NotFoundError'
            ? 'Este equipo no tiene cámara. Suba una imagen del QR.'
            : 'No pudimos abrir la cámara.',
      );
    }
  }

  protected stopCamera(): void {
    this.camera?.stop();
    this.camera = null;
    this.cameraOn.set(false);
  }

  protected async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file !== undefined) await this.useImage(file);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.busy()) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const image = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (image === undefined) this.error.set('Suelte una imagen con el QR.');
    else void this.useImage(image);
  }

  /** The «paste» button: reads the clipboard (image or text) when the browser allows it. */
  protected async pasteFromClipboard(): Promise<void> {
    this.error.set(null);
    try {
      for (const item of await navigator.clipboard.read()) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType !== undefined) return await this.useImage(await item.getType(imageType));
        if (item.types.includes('text/plain')) return this.useText(await (await item.getType('text/plain')).text());
      }
      this.error.set('El portapapeles no tiene ni una imagen ni un código.');
    } catch {
      this.error.set('El navegador no dejó leer el portapapeles. Pegue con Ctrl+V o escriba el código.');
    }
  }

  /** Ctrl+V anywhere on the tab; inside a text field, pasting is typing and is not interpreted. */
  protected onPaste(event: ClipboardEvent): void {
    if (this.busy() || (event.target as HTMLElement | null)?.closest('input, textarea') != null) return;
    const data = event.clipboardData;
    const image = Array.from(data?.files ?? []).find((f) => f.type.startsWith('image/'));
    const text = data?.getData('text/plain') ?? '';
    if (image === undefined && text.trim() === '') return;
    event.preventDefault();
    if (image !== undefined) void this.useImage(image);
    else this.useText(text);
  }

  protected useManualCode(): void {
    this.useText(this.manualCode());
  }

  private async useImage(image: Blob): Promise<void> {
    if (this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    const text = await this.qr.readImage(image);
    this.busy.set(false);
    if (text === null) this.error.set('No encontramos un QR en esa imagen. Pruebe con otra o escriba el código.');
    else this.useText(text);
  }

  private useText(text: string): void {
    if (this.busy()) return;
    this.error.set(null);
    // A foreign code does not turn the camera off: keep looking for the right one.
    if (orderIdFromQrCode(text) === null) return this.error.set('Ese código no es el de una orden de AloVida.');
    this.stopCamera();
    this.busy.set(true);
    this.lab.createOrderFromQr(text).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.created.emit(result);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        const message = error instanceof HttpErrorResponse ? readApiError(error)?.message : undefined;
        this.error.set(message ?? 'No pudimos crear la orden con ese código.');
      },
    });
  }
}
