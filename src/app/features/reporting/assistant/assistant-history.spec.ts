import {
  agregarAlHistorial,
  borrarHistorialGuardado,
  guardarHistorial,
  leerHistorial,
  MAX_HISTORIAL,
} from './assistant-history';

describe('historial del asistente', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    borrarHistorialGuardado();
  });

  it('agrega al principio y no repite (sin distinguir mayúsculas)', () => {
    const h = agregarAlHistorial(['¿Cuál es el CAC?', '¿Cuál es el MRR?'], '  ¿cuál es el mrr?  ');
    expect(h).toEqual(['¿cuál es el mrr?', '¿Cuál es el CAC?']);
  });

  it('guarda como máximo 30 preguntas, las más recientes', () => {
    let h: string[] = [];
    for (let i = 1; i <= MAX_HISTORIAL + 5; i++) {
      h = agregarAlHistorial(h, `pregunta ${i}`);
    }
    expect(h).toHaveLength(MAX_HISTORIAL);
    expect(h[0]).toBe(`pregunta ${MAX_HISTORIAL + 5}`);
    expect(h).not.toContain('pregunta 1');
  });

  it('ignora preguntas vacías', () => {
    expect(agregarAlHistorial(['a'], '   ')).toEqual(['a']);
  });

  it('guarda y vuelve a leer', () => {
    guardarHistorial(['uno', 'dos']);
    expect(leerHistorial()).toEqual(['uno', 'dos']);
  });

  it('un contenido corrupto o de otro tipo se lee como vacío', () => {
    globalThis.localStorage.setItem('alovida:reportes:asistente:historial', '{no es json');
    expect(leerHistorial()).toEqual([]);
    globalThis.localStorage.setItem('alovida:reportes:asistente:historial', '{"a":1}');
    expect(leerHistorial()).toEqual([]);
    globalThis.localStorage.setItem('alovida:reportes:asistente:historial', '["ok", 3, "", null]');
    expect(leerHistorial()).toEqual(['ok']);
  });

  it('si el almacenamiento falla, no lanza', () => {
    const roto = (): never => {
      throw new Error('almacenamiento bloqueado');
    };
    vi.stubGlobal('localStorage', { getItem: roto, setItem: roto, removeItem: roto });
    expect(() => guardarHistorial(['x'])).not.toThrow();
    expect(leerHistorial()).toEqual([]);
    expect(() => borrarHistorialGuardado()).not.toThrow();
  });
});
