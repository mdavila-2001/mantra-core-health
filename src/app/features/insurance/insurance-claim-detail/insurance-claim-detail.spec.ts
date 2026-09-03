import { sameDecimal } from './insurance-claim-detail';

/**
 * `sameDecimal` decide si la pantalla acusa un descuadre entre el monto
 * declarado y la suma de los ítems. Un falso positivo acá le dice a alguien
 * que su facturación no cierra cuando sí cierra; un falso negativo esconde un
 * descuadre real. Por eso se prueba aparte del componente.
 */
describe('sameDecimal', () => {
  it('la escala no es una diferencia', () => {
    // `'1250.0'` y `'1250.00'` son el mismo dinero: marcarlo como descuadre
    // sería avisar de un problema que no existe.
    expect(sameDecimal('1250.0', '1250.00')).toBe(true);
    expect(sameDecimal('1250', '1250.000')).toBe(true);
  });

  it('un céntimo de diferencia sí lo es', () => {
    expect(sameDecimal('1250.00', '1250.01')).toBe(false);
  });

  it('compara sin pasar por coma flotante', () => {
    // Con `Number`, estos dos son iguales por redondeo del doble; como cadena
    // decimal, no lo son. La comparación tiene que ver la diferencia.
    expect(sameDecimal('0.1', '0.10000000000000001')).toBe(false);
  });

  it('sostiene importes que no caben en un doble', () => {
    expect(
      sameDecimal('90071992547409.91', '90071992547409.91'),
    ).toBe(true);
    expect(
      sameDecimal('90071992547409.91', '90071992547409.92'),
    ).toBe(false);
  });

  it('tolera el signo explícito y los espacios de los bordes', () => {
    expect(sameDecimal(' +100.00 ', '100.0')).toBe(true);
  });

  it('distingue el signo', () => {
    expect(sameDecimal('-40.50', '40.50')).toBe(false);
  });
});
