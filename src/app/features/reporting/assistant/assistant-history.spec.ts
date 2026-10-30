import {
  agregarAlHistorial,
  borrarHistorialGuardado,
  guardarHistorial,
  leerHistorial,
  MAX_HISTORIAL,
  olvidarHistorialesDelNavegador,
} from './assistant-history';

describe('historial del asistente', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    olvidarHistorialesDelNavegador();
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
    guardarHistorial('u1', ['uno', 'dos']);
    expect(leerHistorial('u1')).toEqual(['uno', 'dos']);
  });

  it('un contenido corrupto o de otro tipo se lee como vacío', () => {
    globalThis.localStorage.setItem('alovida:reportes:asistente:historial', '{no es json');
    expect(leerHistorial('u1')).toEqual([]);
    globalThis.localStorage.setItem('alovida:reportes:asistente:historial', '{"a":1}');
    expect(leerHistorial('u1')).toEqual([]);
    globalThis.localStorage.setItem('alovida:reportes:asistente:historial', '["ok", 3, "", null]');
    expect(leerHistorial('u1')).toEqual(['ok']);
  });

  it('si el almacenamiento falla, no lanza', () => {
    const roto = (): never => {
      throw new Error('almacenamiento bloqueado');
    };
    vi.stubGlobal('localStorage', { getItem: roto, setItem: roto, removeItem: roto });
    expect(() => guardarHistorial('u1', ['x'])).not.toThrow();
    expect(leerHistorial('u1')).toEqual([]);
    expect(() => borrarHistorialGuardado('u1')).not.toThrow();
  });
  it('el historial es de quien lo escribió: otro usuario del mismo navegador no lo lee', () => {
    guardarHistorial('u1', ['¿Cuál es el MRR?']);
    expect(leerHistorial('u2')).toEqual([]);
    expect(leerHistorial(null)).toEqual([]);
    expect(leerHistorial('u1')).toEqual(['¿Cuál es el MRR?']);
  });

  it('cerrar sesión olvida los historiales de todos los usuarios del navegador', () => {
    guardarHistorial('u1', ['a']);
    guardarHistorial('u2', ['b']);
    guardarHistorial(null, ['c']);
    olvidarHistorialesDelNavegador();
    expect(leerHistorial('u1')).toEqual([]);
    expect(leerHistorial('u2')).toEqual([]);
    expect(leerHistorial(null)).toEqual([]);
  });

  it('olvidar no toca claves ajenas del almacenamiento', () => {
    localStorage.setItem('otra-cosa', 'x');
    guardarHistorial('u1', ['a']);
    olvidarHistorialesDelNavegador();
    expect(localStorage.getItem('otra-cosa')).toBe('x');
    localStorage.removeItem('otra-cosa');
  });

  it('cerrar sesión también olvida la llave de la versión previa', () => {
    localStorage.setItem('alovida:reportes:asistente:historial', JSON.stringify(['vieja']));
    olvidarHistorialesDelNavegador();
    expect(localStorage.getItem('alovida:reportes:asistente:historial')).toBeNull();
  });
});
