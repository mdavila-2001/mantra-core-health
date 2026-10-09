import { enteroEnLetras, montoLiteral } from './amount-in-words';

describe('monto literal', () => {
  it.each([
    [0, 'Cero'],
    [1, 'Uno'],
    [15, 'Quince'],
    [21, 'Veintiuno'],
    [30, 'Treinta'],
    [45, 'Cuarenta y Cinco'],
    [100, 'Cien'],
    [101, 'Ciento Uno'],
    [180, 'Ciento Ochenta'],
    [250, 'Doscientos Cincuenta'],
    [999, 'Novecientos Noventa y Nueve'],
    [1000, 'Mil'],
    [1001, 'Mil Uno'],
    [21_000, 'Veintiún Mil'],
    [31_500, 'Treinta y Un Mil Quinientos'],
    [1_000_000, 'Un Millón'],
    [2_500_000, 'Dos Millones Quinientos Mil'],
  ])('%i → %s', (n, texto) => {
    expect(enteroEnLetras(n)).toBe(texto);
  });

  it('arma la línea «Son: … Bolivianos» con los centavos', () => {
    expect(montoLiteral('250.00')).toBe('Son: Doscientos Cincuenta 00/100 Bolivianos');
    expect(montoLiteral('99')).toBe('Son: Noventa y Nueve 00/100 Bolivianos');
    expect(montoLiteral('12.5')).toBe('Son: Doce 50/100 Bolivianos');
  });

  it('rechaza lo que no es un importe', () => {
    expect(() => montoLiteral('-1')).toThrow();
    expect(() => enteroEnLetras(1.5)).toThrow();
  });
});
