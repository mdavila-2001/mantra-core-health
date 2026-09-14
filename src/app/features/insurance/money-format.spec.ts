import type { Money } from '../../core/data-access/insurance/insurance.types';
import {
  currencySuffix,
  formatAmount,
  formatKpiAmount,
  formatMoney,
  SIN_IMPORTE,
} from './money-format';

/**
 * Arma un importe de prueba.
 *
 * @param amount - El número, como cadena.
 * @param display - Etiqueta de la moneda, o `null` si no se declaró.
 * @returns El importe.
 */
function bs(amount: string, display: string | null = 'Boliviano'): Money {
  return {
    amount,
    currency: display === null ? null : { code: 'BOB', display },
  };
}

describe('formatMoney', () => {
  it('muestra el importe con su moneda', () => {
    expect(formatMoney(bs('1250.00'))).toBe('1250.00 Boliviano');
  });

  it('no toca el número: ni redondea ni completa decimales', () => {
    // Lo que llega de la base es lo que se muestra. Rellenar a dos decimales
    // acá sería inventar precisión que el dato no declara.
    expect(formatMoney(bs('1615.125'))).toBe('1615.125 Boliviano');
    expect(formatMoney(bs('620'))).toBe('620 Boliviano');
  });

  it('sin moneda declarada muestra sólo el número', () => {
    // Inventarle un símbolo a un importe es peor que mostrarlo sin unidad, y
    // en un producto que maneja bolivianos y dólares es directamente un error.
    expect(formatMoney(bs('99.90', null))).toBe('99.90');
  });

  it('la ausencia se dice con palabras, no con cero', () => {
    // «Todavía no hay dictamen» y «el dictamen aprobó cero» son cosas
    // distintas: confundirlas es un error contable que nadie detecta mirando.
    expect(formatMoney(null)).toBe(SIN_IMPORTE);
    expect(formatMoney(null)).not.toBe('0.00');
  });
});

describe('formatAmount', () => {
  it('devuelve el número sin la moneda', () => {
    expect(formatAmount(bs('2100.00'))).toBe('2100.00');
  });

  it('mantiene el mismo texto de ausencia que formatMoney', () => {
    expect(formatAmount(null)).toBe(SIN_IMPORTE);
  });
});

describe('currencySuffix', () => {
  it('arma el sufijo del encabezado', () => {
    expect(currencySuffix(bs('1.00'))).toBe(' · Boliviano');
  });

  it('devuelve cadena vacía cuando no hay moneda', () => {
    expect(currencySuffix(bs('1.00', null))).toBe('');
    expect(currencySuffix(null)).toBe('');
  });
});

describe('formatKpiAmount (subtarea 3.1, v4.2.14)', () => {
  it('separa miles con punto y decimal con coma, en el formato boliviano oficial', () => {
    expect(formatKpiAmount('280000.00', { code: 'BOB', display: 'Boliviano' })).toBe(
      '280.000,00 Bs',
    );
  });

  it('agrupa correctamente montos de una, dos y varias cifras', () => {
    expect(formatKpiAmount('0.00', { code: 'BOB', display: 'Boliviano' })).toBe('0,00 Bs');
    expect(formatKpiAmount('62.77', { code: 'BOB', display: 'Boliviano' })).toBe('62,77 Bs');
    expect(formatKpiAmount('1234567.89', { code: 'BOB', display: 'Boliviano' })).toBe(
      '1.234.567,89 Bs',
    );
  });

  it('una moneda distinta de BOB muestra su código, no "Bs"', () => {
    expect(formatKpiAmount('1000.00', { code: 'USD', display: 'US Dollar' })).toBe(
      '1.000,00 USD',
    );
  });

  it('sin moneda declarada muestra sólo el número agrupado', () => {
    expect(formatKpiAmount('1000.00', null)).toBe('1.000,00');
  });

  it('no hace aritmética: nunca pasa el importe por Number()', () => {
    // Un importe con más de 15 dígitos perdería precisión al pasar por
    // Number(); esta función sólo reacomoda el texto.
    expect(formatKpiAmount('123456789012345.67', { code: 'BOB', display: 'Boliviano' })).toBe(
      '123.456.789.012.345,67 Bs',
    );
  });

  it('conserva el signo negativo, agrupando sólo la parte entera', () => {
    expect(formatKpiAmount('-1500.50', { code: 'BOB', display: 'Boliviano' })).toBe(
      '-1.500,50 Bs',
    );
  });
});
