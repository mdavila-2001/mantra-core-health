import { TestBed } from '@angular/core/testing';

import { Dictado, RECONOCEDOR_DE_VOZ } from './dictado';
import type { EventoDeErrorDeVoz, EventoDeResultadoDeVoz, ReconocedorDeVoz } from './dictado.types';

/**
 * El doble del reconocedor del navegador (regla 65: el real no se puede
 * ejercitar en el runner). Guarda el último creado para dispararle eventos a
 * mano y cuenta las llamadas, que es lo que el contrato promete: `start`,
 * `stop`, `abort`, y `onend` después de cada corte.
 */
class ReconocedorDoble implements ReconocedorDeVoz {
  static ultimo: ReconocedorDoble | null = null;
  static creados = 0;

  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((evento: EventoDeResultadoDeVoz) => void) | null = null;
  onerror: ((evento: EventoDeErrorDeVoz) => void) | null = null;
  onend: (() => void) | null = null;
  arrancado = 0;
  detenido = 0;
  abortado = 0;

  constructor() {
    ReconocedorDoble.ultimo = this;
    ReconocedorDoble.creados++;
  }

  start(): void {
    this.arrancado++;
  }

  stop(): void {
    this.detenido++;
    this.onend?.();
  }

  abort(): void {
    this.abortado++;
    this.onend?.();
  }
}

/** Arma un evento de resultado con la forma de `SpeechRecognitionResultList`. */
function resultado(
  trozos: readonly { texto: string; final: boolean }[],
  desde = 0,
): EventoDeResultadoDeVoz {
  const results = trozos.map((trozo) => {
    const alternativas = [{ transcript: trozo.texto, confidence: 1 }];
    return Object.assign(alternativas, {
      isFinal: trozo.final,
      item: (i: number) => alternativas[i],
    });
  });
  return {
    resultIndex: desde,
    results: Object.assign(results, {
      item: (i: number) => results[i],
    }) as unknown as SpeechRecognitionResultList,
  };
}

describe('Dictado', () => {
  beforeEach(() => {
    ReconocedorDoble.ultimo = null;
    ReconocedorDoble.creados = 0;
  });

  function montar(constructor: (new () => ReconocedorDeVoz) | null): Dictado {
    TestBed.configureTestingModule({
      providers: [Dictado, { provide: RECONOCEDOR_DE_VOZ, useValue: constructor }],
    });
    return TestBed.inject(Dictado);
  }

  /* ---- Correcto ---- */

  it('con reconocedor, escucha en español de Bolivia, continuo y con parciales', () => {
    const dictado = montar(ReconocedorDoble);
    expect(dictado.soportado).toBe(true);

    dictado.empezar(() => undefined);

    const r = ReconocedorDoble.ultimo;
    expect(dictado.estado()).toBe('escuchando');
    expect(r?.arrancado).toBe(1);
    expect(r?.lang).toBe('es-BO');
    expect(r?.continuous).toBe(true);
    expect(r?.interimResults).toBe(true);
  });

  it('una frase cerrada llega a quien escucha; la parcial sólo se muestra', () => {
    const dictado = montar(ReconocedorDoble);
    const llegado: string[] = [];
    dictado.empezar((final) => llegado.push(final));

    ReconocedorDoble.ultimo?.onresult?.(resultado([{ texto: 'me duele la ', final: false }]));
    expect(dictado.parcial()).toBe('me duele la');
    expect(llegado).toEqual([]);

    ReconocedorDoble.ultimo?.onresult?.(resultado([{ texto: 'me duele la panza', final: true }]));
    expect(llegado).toEqual(['me duele la panza']);
  });

  it('al detener, el navegador avisa que terminó y el estado vuelve a inactivo', () => {
    const dictado = montar(ReconocedorDoble);
    dictado.empezar(() => undefined);
    ReconocedorDoble.ultimo?.onresult?.(resultado([{ texto: 'hola', final: false }]));

    dictado.detener();

    expect(ReconocedorDoble.ultimo?.detenido).toBe(1);
    expect(dictado.estado()).toBe('inactivo');
    expect(dictado.parcial()).toBe('');
  });

  /* ---- Límite ---- */

  it('varios trozos en un evento: sólo los cerrados van al texto, desde `resultIndex`', () => {
    const dictado = montar(ReconocedorDoble);
    const llegado: string[] = [];
    dictado.empezar((final) => llegado.push(final));

    ReconocedorDoble.ultimo?.onresult?.(
      resultado(
        [
          { texto: 'ya entregado', final: true },
          { texto: 'tengo tos ', final: true },
          { texto: 'y fie', final: false },
        ],
        1,
      ),
    );

    expect(llegado).toEqual(['tengo tos']);
    expect(dictado.parcial()).toBe('y fie');
  });

  it('empezar dos veces no abre dos reconocedores', () => {
    const dictado = montar(ReconocedorDoble);
    dictado.empezar(() => undefined);
    dictado.empezar(() => undefined);

    expect(ReconocedorDoble.creados).toBe(1);
  });

  it('detener sin haber empezado no hace nada', () => {
    const dictado = montar(ReconocedorDoble);

    expect(() => dictado.detener()).not.toThrow();
    expect(ReconocedorDoble.creados).toBe(0);
  });

  it('si el navegador corta solo (silencio), se puede volver a empezar', () => {
    const dictado = montar(ReconocedorDoble);
    dictado.empezar(() => undefined);
    ReconocedorDoble.ultimo?.onend?.();
    expect(dictado.estado()).toBe('inactivo');

    dictado.empezar(() => undefined);

    expect(ReconocedorDoble.creados).toBe(2);
    expect(dictado.estado()).toBe('escuchando');
  });

  /* ---- Inválido ---- */

  it('sin reconocedor en el navegador no está soportado y empezar no rompe', () => {
    const dictado = montar(null);

    expect(dictado.soportado).toBe(false);
    expect(() => dictado.empezar(() => undefined)).not.toThrow();
    expect(dictado.estado()).toBe('inactivo');
  });

  it.each([
    ['not-allowed', 'sin-permiso'],
    ['service-not-allowed', 'sin-permiso'],
    ['audio-capture', 'sin-permiso'],
    ['no-speech', 'sin-resultado'],
    ['network', 'sin-red'],
    ['aborted', 'inactivo'],
    ['algo-que-no-existe', 'sin-resultado'],
  ])('el error «%s» deja el estado accionable «%s»', (error, esperado) => {
    const dictado = montar(ReconocedorDoble);
    dictado.empezar(() => undefined);

    ReconocedorDoble.ultimo?.onerror?.({ error });
    ReconocedorDoble.ultimo?.onend?.();

    expect(dictado.estado()).toBe(esperado);
  });

  /** Salir de la pantalla no puede dejar el micrófono abierto. */
  it('al destruirse aborta la escucha', () => {
    const dictado = montar(ReconocedorDoble);
    dictado.empezar(() => undefined);

    TestBed.resetTestingModule();

    expect(ReconocedorDoble.ultimo?.abortado).toBe(1);
  });
});
