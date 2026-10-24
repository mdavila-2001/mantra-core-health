import { addDecimalStrings, isDecimalString, sameDecimalString } from './decimal-strings';

describe('isDecimalString', () => {
  it('acepta enteros y decimales, con o sin signo', () => {
    expect(isDecimalString('100')).toBe(true);
    expect(isDecimalString('100.00')).toBe(true);
    expect(isDecimalString('-40.5')).toBe(true);
    expect(isDecimalString('+40.5')).toBe(true);
  });
  it('rechaza texto no decimal', () => {
    expect(isDecimalString('abc')).toBe(false);
    expect(isDecimalString('1,5')).toBe(false);
    expect(isDecimalString('')).toBe(false);
  });
});

describe('addDecimalStrings', () => {
  it('suma tres importes con distinta escala', () => {
    expect(addDecimalStrings(['150.00', '30', '120.00'])).toBe('300.00');
  });
  it('conserva la escala mayor de las entradas', () => {
    expect(addDecimalStrings(['1.1', '2.22'])).toBe('3.32');
  });
  it('ignora nulos y cadenas vacías', () => {
    expect(addDecimalStrings(['10.00', null, undefined, ''])).toBe('10.00');
  });
  it('devuelve null si no hay ningún importe, no cero', () => {
    expect(addDecimalStrings([null, undefined, ''])).toBeNull();
  });
  it('conserva un importe que no cabe en un number (> 2^53)', () => {
    expect(addDecimalStrings(['90071992547409.91', '0.01'])).toBe(
      '90071992547409.92',
    );
  });
  it('suma con signo', () => {
    expect(addDecimalStrings(['100.00', '-30.00'])).toBe('70.00');
  });
});

describe('sameDecimalString', () => {
  it('la escala no es una diferencia', () => {
    expect(sameDecimalString('1250.0', '1250.00')).toBe(true);
  });
  it('un céntimo de diferencia sí lo es', () => {
    expect(sameDecimalString('1250.00', '1250.01')).toBe(false);
  });
  it('compara sin pasar por coma flotante', () => {
    expect(sameDecimalString('0.1', '0.10000000000000001')).toBe(false);
  });
  it('sostiene importes que no caben en un doble', () => {
    expect(sameDecimalString('90071992547409.91', '90071992547409.91')).toBe(
      true,
    );
  });
  it('distingue el signo', () => {
    expect(sameDecimalString('-40.50', '40.50')).toBe(false);
  });
  it('null y undefined se tratan como iguales entre sí, no con un importe', () => {
    expect(sameDecimalString(null, undefined)).toBe(true);
    expect(sameDecimalString(null, '0')).toBe(false);
  });
});
