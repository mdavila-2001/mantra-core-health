import { etiquetaDeDia, horaDeChat } from './hora-de-chat';

/**
 * Lo que estas pruebas fijan: que la bandeja diga la **hora del reloj** y no
 * «hace 2 min».
 *
 * En una lista de veinte filas el tiempo relativo obliga a hacer la cuenta en
 * cada una para ordenarlas mentalmente. Es la diferencia entre esta función y
 * `tiempoRelativo`, que sigue siendo la correcta para un aviso suelto.
 */
describe('horaDeChat', () => {
  const ahora = new Date('2026-09-08T20:30:00');

  it('hoy dice la hora', () => {
    expect(horaDeChat(new Date('2026-09-08T08:05:00'), ahora)).toContain('8:05');
  });

  it('ayer dice «Ayer», no la fecha', () => {
    expect(horaDeChat(new Date('2026-09-07T23:50:00'), ahora)).toBe('Ayer');
  });

  it('dentro de la semana dice el día', () => {
    // Miércoles 2/9 visto desde el martes 8/9.
    expect(horaDeChat(new Date('2026-09-03T10:00:00'), ahora)).toBe('jueves');
  });

  it('más viejo que una semana dice la fecha', () => {
    expect(horaDeChat(new Date('2026-08-20T10:00:00'), ahora)).toBe('20/08/2026');
  });

  it('una fecha inválida no rompe la fila', () => {
    expect(horaDeChat(new Date('no-es-fecha'), ahora)).toBe('');
  });
});

describe('etiquetaDeDia', () => {
  const ahora = new Date('2026-09-08T20:30:00');

  it('«Hoy» y «Ayer» se dicen con palabras', () => {
    expect(etiquetaDeDia(new Date('2026-09-08T09:00:00'), ahora)).toBe('Hoy');
    expect(etiquetaDeDia(new Date('2026-09-07T09:00:00'), ahora)).toBe('Ayer');
  });

  it('dentro del año no repite el año', () => {
    expect(etiquetaDeDia(new Date('2026-03-04T09:00:00'), ahora)).toBe('4 de marzo');
  });

  it('de otro año sí lo dice', () => {
    expect(etiquetaDeDia(new Date('2025-03-04T09:00:00'), ahora)).toContain('2025');
  });

  it('sin fecha devuelve vacío, no «Invalid Date»', () => {
    expect(etiquetaDeDia(undefined, ahora)).toBe('');
  });
});
