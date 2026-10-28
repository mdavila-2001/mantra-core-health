import { plainText } from './plain-text';

describe('plainText', () => {
  it('quita la negrita', () => {
    expect(plainText('**No delimita controles.** Sólo los nombra.')).toBe(
      'No delimita controles. Sólo los nombra.',
    );
  });

  it('quita los acentos graves del código', () => {
    expect(plainText('Se guarda en `row_version` y `created_at`.')).toBe(
      'Se guarda en row_version y created_at.',
    );
  });

  it('quita la cursiva sin comerse un asterisco suelto', () => {
    expect(plainText('un *término* y 2 * 3')).toBe('un término y 2 * 3');
  });

  it('deja intacto el texto sin marcas', () => {
    expect(plainText('Dato de salud identificable.')).toBe('Dato de salud identificable.');
  });
});
