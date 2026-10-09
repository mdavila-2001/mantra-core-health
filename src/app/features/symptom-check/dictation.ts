import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
} from '@angular/core';

import type { RecognizerConstructor, VoiceRecognizer } from './dictation.types';

/**
 * El constructor del reconocedor del navegador, o `null` si no hay.
 *
 * Es un token, y no una lectura directa de `window`, por dos razones: bajo
 * SSR no hay ventana, y el spec tiene que poder poner un doble en su lugar
 * (regla 65: tres niveles contra el doble, la prueba real aparte). Chromium
 * sólo expone `webkitSpeechRecognition`; Firefox, ninguno de los dos —y ahí
 * el botón de dictar directamente no aparece.
 */
export const VOICE_RECOGNIZER = new InjectionToken<RecognizerConstructor | null>(
  'RECONOCEDOR_DE_VOZ',
  {
    providedIn: 'root',
    factory: () => {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) {
        return null;
      }
      const ventana = window as unknown as Record<string, unknown>;
      const constructor = ventana['SpeechRecognition'] ?? ventana['webkitSpeechRecognition'];
      return typeof constructor === 'function' ? (constructor as RecognizerConstructor) : null;
    },
  },
);

/**
 * En qué está el dictado. Los tres últimos son los errores que la persona
 * puede resolver, cada uno con su frase en la plantilla; lo que no encaja en
 * ninguno se cuenta como «no te escuchamos», que es lo único honesto que se
 * puede decir sin inventar una causa.
 */
export type DictationStatus =
  'inactivo' | 'escuchando' | 'sin-permiso' | 'sin-resultado' | 'sin-red';

/**
 * Español de Bolivia (Q-M2). El reconocedor de Chromium acepta cualquier
 * etiqueta BCP-47 y, si no tiene modelo para la región, cae al idioma base:
 * no hace falta un respaldo escrito a mano.
 */
const LANGUAGE = 'es-BO';

const STATUS_BY_ERROR: Readonly<Record<string, DictationStatus>> = {
  'not-allowed': 'sin-permiso',
  'service-not-allowed': 'sin-permiso',
  'audio-capture': 'sin-permiso',
  'no-speech': 'sin-resultado',
  network: 'sin-red',
  aborted: 'inactivo',
};

/**
 * Dictar en vez de escribir (P-02, doctor 22/09/2026: «panel de texto escrito
 * a mano o por voz»).
 *
 * ## Qué hace con lo dicho, y qué no
 *
 * Lo que el navegador transcribe se entrega a quien llamó a `empezar` —y a
 * nadie más—. **No se registra ni se guarda**: la transcripción la hace el
 * reconocedor del navegador. Después, como lo tecleado, el texto se manda al
 * servicio de triage para entenderlo mejor (`TriageIaClient`), que lo analiza
 * sin guardarlo ni registrarlo; es lo que el aviso de la pantalla le dice a la
 * persona antes de que hable (Q-M1). Ni un `console.*` en este archivo: lo que
 * alguien dicta sobre su salud es dato de salud (regla 90.2.1).
 *
 * ## Por qué se provee en el componente y no en `root`
 *
 * Porque el reconocedor es un recurso vivo —micrófono abierto, punto rojo en
 * la pestaña— y tiene que morir con la pantalla que lo pidió. Con `DestroyRef`
 * del componente que lo provee, salir de la pantalla aborta la escucha, igual
 * que `Grabador` suelta su pista de audio.
 */
@Injectable()
export class Dictation {
  private readonly Recognizer = inject(VOICE_RECOGNIZER);

  /** Si el navegador puede dictar. Sin esto, la pantalla no ofrece el botón. */
  readonly supported = this.Recognizer !== null;

  readonly status = signal<DictationStatus>('inactivo');

  /** Lo que el reconocedor va entendiendo antes de cerrar la frase. Se muestra, no se entrega. */
  readonly partial = signal('');

  readonly listening = computed(() => this.status() === 'escuchando');

  private recognizer: VoiceRecognizer | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abort());
  }

  /**
   * Empieza a escuchar y entrega cada frase cerrada a `alTexto`.
   *
   * Continuo y con parciales: la persona habla lo que quiera, ve lo que se le
   * va entendiendo, y cada trozo final se agrega al texto. Si ya está
   * escuchando, no arranca un segundo reconocedor: el botón alterna.
   */
  start(alTexto: (final: string) => void): void {
    if (this.Recognizer === null || this.recognizer !== null) {
      return;
    }
    const reconocedor = new this.Recognizer();
    reconocedor.lang = LANGUAGE;
    reconocedor.continuous = true;
    reconocedor.interimResults = true;

    reconocedor.onresult = (evento) => {
      let final = '';
      let parcial = '';
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        const texto = resultado[0]?.transcript ?? '';
        if (resultado.isFinal) {
          final += texto;
        } else {
          parcial += texto;
        }
      }
      this.partial.set(parcial.trim());
      if (final.trim() !== '') {
        alTexto(final.trim());
      }
    };

    reconocedor.onerror = (evento) => {
      this.status.set(STATUS_BY_ERROR[evento.error] ?? 'sin-resultado');
    };

    // `onend` llega siempre: tras `stop()`, tras `abort()`, tras un error y
    // cuando el navegador corta solo por silencio. Es el único lugar donde se
    // suelta el reconocedor.
    reconocedor.onend = () => {
      this.recognizer = null;
      this.partial.set('');
      if (this.status() === 'escuchando') {
        this.status.set('inactivo');
      }
    };

    this.recognizer = reconocedor;
    this.status.set('escuchando');
    reconocedor.start();
  }

  /** Deja de escuchar; lo que ya se cerró queda, lo parcial se descarta. */
  stop(): void {
    this.recognizer?.stop();
  }

  private abort(): void {
    const reconocedor = this.recognizer;
    this.recognizer = null;
    reconocedor?.abort();
  }
}
