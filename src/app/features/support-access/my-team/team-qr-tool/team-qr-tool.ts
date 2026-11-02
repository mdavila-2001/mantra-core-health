import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { drawQr } from '../../../../shared/utils/qr/draw-qr';
import { readQrFromSource } from '../../../../shared/utils/qr/read-qr';
import { codeFromPasted } from '../../../../core/auth/invitation-link';

type ModoQr = 'generar' | 'leer';

const MODOS_QR: readonly SegmentedOption<ModoQr>[] = [
  { value: 'generar', label: 'Generar QR (Solicitud y chat)' },
  { value: 'leer', label: 'Leer o escanear QR' },
];

/**
 * **Herramienta de QR para Solicitud y Chat de Equipo**:
 * Permite leer QR con cámara/imagen o generar el código QR con enlace
 * para crear solicitudes de vinculación y conectar al equipo.
 */
@Component({
  selector: 'app-team-qr-tool',
  imports: [Alert, AppButton, Card, FormField, Input, SegmentedControl],
  templateUrl: './team-qr-tool.html',
  styleUrl: './team-qr-tool.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamQrTool {
  private readonly document = inject(DOCUMENT);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly codeScanned = output<string>();

  protected readonly modos = MODOS_QR;
  protected readonly modo = signal<ModoQr>('generar');

  /* ---- Generar QR ---- */
  protected readonly proposito = signal<'chat' | 'solicitud'>('chat');
  protected readonly qrGenerado = signal(false);
  protected readonly urlGenerada = signal('');
  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('qrCanvas');

  /* ---- Leer QR ---- */
  protected readonly textoPegado = signal('');
  protected readonly leyendoImagen = signal(false);
  protected readonly camaraActiva = signal(false);
  protected readonly errorCamara = signal<string | null>(null);
  private streamCamara: MediaStream | null = null;
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoCamara');
  private intervaloEscaneo: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.detenerCamara());
  }

  protected cambiarModo(nuevo: ModoQr): void {
    this.modo.set(nuevo);
    if (nuevo === 'generar' && !this.qrGenerado()) {
      this.generarQr();
    } else if (nuevo !== 'leer') {
      this.detenerCamara();
    }
  }

  protected generarQr(): void {
    const origin = this.document.defaultView?.location.origin ?? 'https://dev.alovidasalud.com';
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const ruta = this.proposito() === 'chat'
      ? `${origin}/my-team#code=CHAT-${randomCode}`
      : `${origin}/my-team?tab=mis-accesos#code=REQ-${randomCode}`;
    this.urlGenerada.set(ruta);
    this.qrGenerado.set(true);

    setTimeout(() => {
      const canvas = this.lienzo()?.nativeElement;
      if (canvas) {
        drawQr(canvas, ruta, 192).catch(() => {});
      }
    }, 50);
  }

  protected async copiarEnlace(): Promise<void> {
    const url = this.urlGenerada();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.toasts.success('Enlace copiado al portapapeles');
    } catch {
      this.toasts.info('Seleccione y copie la dirección en pantalla');
    }
  }

  protected procesarTextoPegado(): void {
    const limpio = codeFromPasted(this.textoPegado());
    if (!limpio) return;
    this.codeScanned.emit(limpio);
    this.toasts.success('Código o enlace detectado');
  }

  protected async leerDesdeArchivo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.leyendoImagen.set(true);
    try {
      const raw = await readQrFromSource(file);
      if (raw) {
        const codigo = codeFromPasted(raw);
        this.textoPegado.set(codigo);
        this.codeScanned.emit(codigo);
        this.toasts.success('Código QR leído de la imagen con éxito');
      } else {
        this.toasts.error('No se pudo detectar ningún código QR en la imagen');
      }
    } finally {
      this.leyendoImagen.set(false);
      input.value = '';
    }
  }

  protected async alternarCamara(): Promise<void> {
    if (this.camaraActiva()) {
      this.detenerCamara();
      return;
    }
    this.errorCamara.set(null);
    try {
      this.streamCamara = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      this.camaraActiva.set(true);
      setTimeout(() => {
        const video = this.videoElement()?.nativeElement;
        if (video && this.streamCamara) {
          video.srcObject = this.streamCamara;
          video.play().catch(() => {});
          this.iniciarDeteccionCamara(video);
        }
      }, 100);
    } catch {
      this.errorCamara.set('No se pudo acceder a la cámara o no está permitida.');
      this.camaraActiva.set(false);
    }
  }

  private iniciarDeteccionCamara(video: HTMLVideoElement): void {
    this.intervaloEscaneo = setInterval(async () => {
      if (!this.camaraActiva() || video.readyState !== video.HAVE_ENOUGH_DATA) return;
      const raw = await readQrFromSource(video);
      if (raw) {
        const codigo = codeFromPasted(raw);
        this.detenerCamara();
        this.textoPegado.set(codigo);
        this.codeScanned.emit(codigo);
        this.toasts.success('¡Código QR escaneado con éxito!');
      }
    }, 400);
  }

  protected detenerCamara(): void {
    if (this.intervaloEscaneo) {
      clearInterval(this.intervaloEscaneo);
      this.intervaloEscaneo = null;
    }
    if (this.streamCamara) {
      for (const track of this.streamCamara.getTracks()) track.stop();
      this.streamCamara = null;
    }
    this.camaraActiva.set(false);
  }
}
