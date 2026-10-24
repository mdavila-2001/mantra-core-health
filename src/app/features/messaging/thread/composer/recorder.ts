import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Tope de una nota de voz. Más que esto es un audio, no un mensaje. */
const SECONDS_LIMIT = 300;

/**
 * El botón de nota de voz.
 *
 * Se mantiene apretado para grabar y se suelta para enviar, como en WhatsApp;
 * la cruz cancela. Es un componente aparte porque `MediaRecorder` trae consigo
 * permisos, un temporizador y una pista de audio que hay que cerrar sí o sí
 * —dejarla abierta deja el micrófono encendido y el navegador mostrando el
 * punto rojo hasta que se recarga la página—.
 *
 * Sin permiso o sin `MediaRecorder` (Safari viejo, SSR) el botón no aparece:
 * un botón que al apretarlo dice «tu navegador no puede» es peor que no
 * ofrecerlo.
 */
@Component({
  selector: 'app-recorder',
  imports: [],
  template: `
    @if (available) {
      @if (recording()) {
        <div class="grabador">
          <button
            class="grabador__cancelar"
            type="button"
            aria-label="Cancelar la grabación"
            (click)="cancel()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <span class="grabador__punto" aria-hidden="true"></span>
          <span class="grabador__tiempo" role="timer">{{ clock() }}</span>
          <button
            class="grabador__enviar"
            type="button"
            data-testid="composer-audio-enviar"
            aria-label="Enviar la nota de voz"
            (click)="finish()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m3.4 20.4 17.3-8.4L3.4 3.6 3.4 10l12 2-12 2z" /></svg>
          </button>
        </div>
      } @else {
        <button
          class="grabador__micro"
          type="button"
          data-testid="composer-audio"
          aria-label="Grabar una nota de voz"
          (click)="start()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></svg>
        </button>
      }
    }
  `,
  styleUrl: './recorder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recorder {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La nota terminada, lista para mandar. */
  readonly grabado = output<File>();

  /** Cuando el micrófono no se pudo usar, con el motivo ya en castellano. */
  readonly fallo = output<string>();

  protected readonly recording = signal(false);
  protected readonly seconds = signal(0);

  private recorder: MediaRecorder | null = null;
  private track: MediaStream | null = null;
  private chunks: Blob[] = [];
  private stopwatch: ReturnType<typeof setInterval> | null = null;
  private cancelled = false;

  /** `MediaRecorder` no existe bajo SSR ni en navegadores viejos. */
  protected readonly available =
    this.isBrowser && typeof MediaRecorder !== 'undefined';

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dropAll());
  }

  protected clock(): string {
    const total = this.seconds();
    const minutos = Math.floor(total / 60);
    const resto = total % 60;
    return `${minutos}:${resto.toString().padStart(2, '0')}`;
  }

  protected async start(): Promise<void> {
    if (!this.available || this.recording()) {
      return;
    }
    try {
      this.track = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.fallo.emit('No pudimos usar el micrófono. Revise el permiso del navegador.');
      return;
    }

    this.cancelled = false;
    this.chunks = [];
    this.recorder = new MediaRecorder(this.track);
    this.recorder.ondataavailable = (evento) => {
      if (evento.data.size > 0) {
        this.chunks.push(evento.data);
      }
    };
    this.recorder.onstop = () => this.toStop();
    this.recorder.start();

    this.recording.set(true);
    this.seconds.set(0);
    this.stopwatch = setInterval(() => {
      this.seconds.update((s) => s + 1);
      if (this.seconds() >= SECONDS_LIMIT) {
        this.finish();
      }
    }, 1000);
  }

  protected finish(): void {
    if (this.recorder?.state === 'recording') {
      this.recorder.stop();
    }
  }

  protected cancel(): void {
    this.cancelled = true;
    this.finish();
  }

  private toStop(): void {
    const trozos = this.chunks;
    const cancelado = this.cancelled;
    this.dropAll();

    if (cancelado || trozos.length === 0) {
      return;
    }
    const tipo = trozos[0].type || 'audio/webm';
    const blob = new Blob(trozos, { type: tipo });
    const extension = tipo.includes('ogg') ? 'ogg' : tipo.includes('mp4') ? 'm4a' : 'webm';
    this.grabado.emit(
      new File([blob], `nota-de-voz-${Date.now()}.${extension}`, { type: tipo }),
    );
  }

  /**
   * Corta el cronómetro y **apaga el micrófono**. Sin el `stop()` de cada
   * pista el navegador deja el indicador de grabación encendido aunque el
   * componente ya no exista.
   */
  private dropAll(): void {
    if (this.stopwatch !== null) {
      clearInterval(this.stopwatch);
      this.stopwatch = null;
    }
    this.track?.getTracks().forEach((track) => track.stop());
    this.track = null;
    this.recorder = null;
    this.chunks = [];
    this.recording.set(false);
    this.seconds.set(0);
  }
}
