import { describe, expect, it } from 'vitest';

import { soloLetrasDeNombre, soloLetrasYNumeros } from './input-filters';

describe('soloLetrasDeNombre', () => {
  it('deja letras con tildes y ñ', () => {
    expect(soloLetrasDeNombre('José Ñandú')).toBe('JoséÑandú');
  });

  it('quita dígitos, espacios y símbolos', () => {
    expect(soloLetrasDeNombre('Ana-María 2.0 d\'Arc')).toBe('AnaMaríadArc');
  });
});

describe('soloLetrasYNumeros', () => {
  it('deja letras y dígitos', () => {
    expect(soloLetrasYNumeros('1234567LP')).toBe('1234567LP');
  });

  it('quita espacios y símbolos', () => {
    expect(soloLetrasYNumeros('12 34-5.6!"$%')).toBe('123456');
  });
});
