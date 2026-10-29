/**
 * Lo mínimo del reconocedor de voz del navegador (Web Speech API) que usa
 * `Dictado`.
 *
 * TypeScript 5.9.3 trae en `lib.dom.d.ts` `SpeechRecognitionResultList`,
 * `SpeechRecognitionResult` y `SpeechRecognitionAlternative` —y se usan tal
 * cual—, pero **no** la clase `SpeechRecognition`, sus eventos ni el
 * `webkitSpeechRecognition` con prefijo que es el único que existe en
 * Chromium. Se declaran acá, con nombre propio y sólo los miembros que se
 * tocan: ni `any`, ni ampliar `Window` a nivel global. La lectura de
 * `window` se hace por índice en `dictation.ts`, y es el único lugar donde el
 * navegador entra en juego.
 */
export interface VoiceRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((evento: VoiceResultEvent) => void) | null;
  onerror: ((evento: VoiceErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface VoiceResultEvent {
  /** Desde qué resultado cambió algo: los anteriores ya se entregaron. */
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

export interface VoiceErrorEvent {
  /** `not-allowed`, `no-speech`, `network`, `aborted`, `audio-capture`… según la especificación. */
  readonly error: string;
}

export type RecognizerConstructor = new () => VoiceRecognizer;
