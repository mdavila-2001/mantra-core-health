import { READABLE_CHARACTERS, generateReadableCode } from './readable-code';

/**
 * El generador que comparten el código de retiro del pedido (FAR-I2) y el
 * comprobante de canje de puntos (FAR-I6). Lo que se fija es lo único que
 * importa de él: que lo que produzca se pueda **dictar en voz alta** sin que
 * el otro lado tipee otra cosa.
 */
describe('generarCodigoLegible', () => {
  it('devuelve el largo pedido', () => {
    expect(generateReadableCode(6)).toHaveLength(6);
    expect(generateReadableCode(8)).toHaveLength(8);
  });

  it('no usa los caracteres que se confunden al dictarlos', () => {
    // Cien tiradas: si `O`, `0`, `I`, `1`, `B` u `8` pudieran salir, saldrían.
    const muestra = Array.from({ length: 100 }, () => generateReadableCode(8)).join('');

    expect(muestra).not.toMatch(/[O0I1B8]/);
  });

  it('sólo emite caracteres del alfabeto legible', () => {
    const muestra = generateReadableCode(200);

    for (const caracter of muestra) {
      expect(READABLE_CHARACTERS).toContain(caracter);
    }
  });

  it('con largo cero o negativo devuelve cadena vacía, sin inventar un largo', () => {
    expect(generateReadableCode(0)).toBe('');
    expect(generateReadableCode(-3)).toBe('');
  });

  it('no devuelve siempre lo mismo', () => {
    const codigos = new Set(Array.from({ length: 50 }, () => generateReadableCode(8)));

    expect(codigos.size).toBeGreaterThan(1);
  });
});
