import { formatDate, formatDateTime, formatMoney, formatTime, MINUS } from './pdf-format';

describe('formatMoney', () => {
  it.each([
    [0, '0,00 Bs'],
    [133.5, '133,50 Bs'],
    [8842, '8.842,00 Bs'],
    [1234567.891, '1.234.567,89 Bs'],
    ['1234.5', '1.234,50 Bs'],
    [-442, `${MINUS}442,00 Bs`],
    [-0.001, '0,00 Bs'],
  ])('%s → %s', (monto, esperado) => {
    expect(formatMoney(monto)).toBe(esperado);
  });

  it('sin moneda, para la celda de una tabla que ya la dice en la cabecera', () => {
    expect(formatMoney(1200, null)).toBe('1.200,00');
  });

  it('un texto que no es un número no se convierte en cero', () => {
    expect(formatMoney('no disponible')).toBe('no disponible');
    expect(formatMoney('')).toBe('');
  });
});

describe('fechas y horas', () => {
  const fecha = new Date(2026, 9, 4, 8, 5);

  it('escribe día/mes/año y la hora en 24 horas', () => {
    expect(formatDate(fecha)).toBe('04/10/2026');
    expect(formatTime(fecha)).toBe('08:05');
    expect(formatDateTime(new Date(2026, 9, 24, 18, 30))).toBe('24/10/2026, 18:30');
  });
});
