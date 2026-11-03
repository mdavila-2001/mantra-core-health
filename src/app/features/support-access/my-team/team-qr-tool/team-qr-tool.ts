import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { readQrFromSource } from '../../../../shared/utils/qr/read-qr';
import { codeFromPasted } from '../../invitations/invitation-link';

/** How often a camera frame is checked for a QR. */
const SCAN_INTERVAL_MS = 400;

/**
 * **QR reader** for an affiliation code: the camera or a photo of the QR. It only reads: it emits the
 * code (taken out of the QR address) and the parent redeems it. The QR itself is issued by the
 * organization from «Invitaciones», with a real code the API knows.
 */
@Component({
  selector: 'app-team-qr-tool',
  imports: [Alert, AppButton],
  templateUrl: './team-qr-tool.html',
  styleUrl: './team-qr-tool.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamQrTool {
  private readonly toasts = inject(ToastService);

  readonly codeScanned = output<string>();

  protected readonly leyendoImagen = signal(false);
  protected readonly camaraActiva = signal(false);
  protected readonly errorCamara = signal<string | null>(null);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('videoCamara');
  private stream: MediaStream | null = null;
  private intervalo: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerCamara());
  }

  protected async leerDesdeArchivo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.leyendoImagen.set(true);
    try {
      const raw = await readQrFromSource(file);
      if (raw) this.emitir(raw);
      else this.toasts.error('No encontramos un código QR en esa imagen. Pruebe con una foto más nítida.');
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
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.camaraActiva.set(true);
      // The <video> exists only after the @if renders it.
      setTimeout(() => this.empezarEscaneo(), 0);
    } catch {
      this.errorCamara.set('No se pudo usar la cámara: no hay una o no se dio permiso.');
      this.detenerCamara();
    }
  }

  private empezarEscaneo(): void {
    const video = this.video()?.nativeElement;
    if (!video || !this.stream) return;
    video.srcObject = this.stream;
    video.play().catch(() => undefined);
    let leyendo = false;
    this.intervalo = setInterval(async () => {
      if (leyendo || video.readyState < video.HAVE_ENOUGH_DATA) return;
      leyendo = true;
      const raw = await readQrFromSource(video);
      leyendo = false;
      if (raw && this.camaraActiva()) {
        this.detenerCamara();
        this.emitir(raw);
      }
    }, SCAN_INTERVAL_MS);
  }

  private emitir(raw: string): void {
    const codigo = codeFromPasted(raw);
    if (codigo === '') return;
    this.codeScanned.emit(codigo);
  }

  private detenerCamara(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    this.intervalo = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.camaraActiva.set(false);
  }
}
