import {
  agregarAlHistorial,
  borrarHistorialGuardado,
  guardarHistorial,
  leerHistorial,
  MAX_HISTORIAL,
  clearBrowserHistories,
} from './assistant-history';

describe('historial del asistente', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearBrowserHistories();
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
    globalThis.sessionStorage.setItem('alovida:reportes:asistente:historial:u1', '{no es json');
    expect(leerHistorial('u1')).toEqual([]);
    globalThis.sessionStorage.setItem('alovida:reportes:asistente:historial:u1', '{"a":1}');
    expect(leerHistorial('u1')).toEqual([]);
    globalThis.sessionStorage.setItem('alovida:reportes:asistente:historial:u1', '["ok", 3, "", null]');
    expect(leerHistorial('u1')).toEqual(['ok']);
  });

  it('si el almacenamiento falla, no lanza', () => {
    const roto = (): never => {
      throw new Error('almacenamiento bloqueado');
    };
    vi.stubGlobal('sessionStorage', { getItem: roto, setItem: roto, removeItem: roto });
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
    clearBrowserHistories();
    expect(leerHistorial('u1')).toEqual([]);
    expect(leerHistorial('u2')).toEqual([]);
    expect(leerHistorial(null)).toEqual([]);
  });

  it('olvidar no toca claves ajenas del almacenamiento', () => {
    sessionStorage.setItem('otra-cosa', 'x');
    localStorage.setItem('otra-cosa', 'y');
    guardarHistorial('u1', ['a']);
    clearBrowserHistories();
    expect(sessionStorage.getItem('otra-cosa')).toBe('x');
    expect(localStorage.getItem('otra-cosa')).toBe('y');
    sessionStorage.removeItem('otra-cosa');
    localStorage.removeItem('otra-cosa');
  });

  it('el historial no se escribe en localStorage: no sobrevive a la pestaña', () => {
    guardarHistorial('u1', ['¿Cuánto cobró el Dr. Gómez?']);
    expect(localStorage.getItem('alovida:reportes:asistente:historial:u1')).toBeNull();
    expect(sessionStorage.getItem('alovida:reportes:asistente:historial:u1')).not.toBeNull();
  });

  it('cerrar sesión borra el historial de todos los usuarios, y también las claves que la versión anterior dejó en localStorage', () => {
    guardarHistorial('u1', ['a']);
    guardarHistorial('u2', ['b']);
    localStorage.setItem('alovida:reportes:asistente:historial:u3', JSON.stringify(['vieja de disco']));
    clearBrowserHistories();
    expect(leerHistorial('u1')).toEqual([]);
    expect(leerHistorial('u2')).toEqual([]);
    expect(localStorage.getItem('alovida:reportes:asistente:historial:u3')).toBeNull();
  });

  it('cerrar sesión también olvida la llave de la versión previa', () => {
    localStorage.setItem('alovida:reportes:asistente:historial', JSON.stringify(['vieja']));
    clearBrowserHistories();
    expect(localStorage.getItem('alovida:reportes:asistente:historial')).toBeNull();
  });
});
