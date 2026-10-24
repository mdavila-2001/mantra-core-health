import { mensajeDeFechaRechazada } from './error-message';

describe('mensajeDeFechaRechazada', () => {
  it('con los dos límites dice desde cuándo y hasta cuándo, como lo diría una persona', () => {
    expect(
      mensajeDeFechaRechazada('out-of-range', { minDate: new Date(1910, 0, 1), maxDate: 'today' }),
    ).toBe('Ingrese una fecha desde 1910 hasta hoy.');
  });

  it('un límite que no es el 1 de enero va con la fecha completa', () => {
    expect(
      mensajeDeFechaRechazada('out-of-range', {
        minDate: new Date(2026, 6, 5),
        maxDate: new Date(2026, 11, 31),
      }),
    ).toBe('Ingrese una fecha desde el 05/07/2026 hasta el 31/12/2026.');
  });

  it('con un solo límite nombra sólo ese', () => {
    expect(mensajeDeFechaRechazada('out-of-range', { minDate: 'today' })).toBe(
      'Ingrese una fecha desde hoy en adelante.',
    );
    expect(mensajeDeFechaRechazada('out-of-range', { maxDate: 'today' })).toBe(
      'Ingrese una fecha hasta hoy.',
    );
  });

  it('una fecha que no existe pide revisar el formato, no el rango', () => {
    expect(
      mensajeDeFechaRechazada('invalid', { minDate: new Date(1910, 0, 1), maxDate: 'today' }),
    ).toBe('Revise la fecha: día, mes y año, como DD/MM/AAAA.');
  });
});
