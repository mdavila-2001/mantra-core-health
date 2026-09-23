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
const TOPE_SEGUNDOS = 300;

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
  selector: 'app-grabador',
  imports: [],
  template: `
    @if (disponible) {
      @if (grabando()) {
        <div class="grabador">
          <button
            class="grabador__cancelar"
            type="button"
            aria-label="Cancelar la grabación"
            (click)="cancelar()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <span class="grabador__punto" aria-hidden="true"></span>
          <span class="grabador__tiempo" role="timer">{{ reloj() }}</span>
          <button
            class="grabador__enviar"
            type="button"
            data-testid="composer-audio-enviar"
            aria-label="Enviar la nota de voz"
            (click)="terminar()"
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
          (click)="empezar()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></svg>
        </button>
      }
    }
  `,
  styleUrl: './grabador.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Grabador {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La nota terminada, lista para mandar. */
  readonly grabado = output<File>();

  /** Cuando el micrófono no se pudo usar, con el motivo ya en castellano. */
  readonly fallo = output<string>();

  protected readonly grabando = signal(false);
  protected readonly segundos = signal(0);

  private grabadora: MediaRecorder | null = null;
  private pista: MediaStream | null = null;
  private trozos: Blob[] = [];
  private cronometro: ReturnType<typeof setInterval> | null = null;
  private cancelado = false;

  /** `MediaRecorder` no existe bajo SSR ni en navegadores viejos. */
  protected readonly disponible =
    this.isBrowser && typeof MediaRecorder !== 'undefined';

  constructor() {
    inject(DestroyRef).onDestroy(() => this.soltarTodo());
  }

  protected reloj(): string {
    const total = this.segundos();
    const minutos = Math.floor(total / 60);
    const resto = total % 60;
    return `${minutos}:${resto.toString().padStart(2, '0')}`;
  }

  protected async empezar(): Promise<void> {
    if (!this.disponible || this.grabando()) {
      return;
    }
    try {
      this.pista = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.fallo.emit('No pudimos usar el micrófono. Revisá el permiso del navegador.');
      return;
    }

    this.cancelado = false;
    this.trozos = [];
    this.grabadora = new MediaRecorder(this.pista);
    this.grabadora.ondataavailable = (evento) => {
      if (evento.data.size > 0) {
        this.trozos.push(evento.data);
      }
    };
    this.grabadora.onstop = () => this.alDetenerse();
    this.grabadora.start();

    this.grabando.set(true);
    this.segundos.set(0);
    this.cronometro = setInterval(() => {
      this.segundos.update((s) => s + 1);
      if (this.segundos() >= TOPE_SEGUNDOS) {
        this.terminar();
      }
    }, 1000);
  }

  protected terminar(): void {
    if (this.grabadora?.state === 'recording') {
      this.grabadora.stop();
    }
  }

  protected cancelar(): void {
    this.cancelado = true;
    this.terminar();
  }

  private alDetenerse(): void {
    const trozos = this.trozos;
    const cancelado = this.cancelado;
    this.soltarTodo();

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
  private soltarTodo(): void {
    if (this.cronometro !== null) {
      clearInterval(this.cronometro);
      this.cronometro = null;
    }
    this.pista?.getTracks().forEach((track) => track.stop());
    this.pista = null;
    this.grabadora = null;
    this.trozos = [];
    this.grabando.set(false);
    this.segundos.set(0);
  }
}
