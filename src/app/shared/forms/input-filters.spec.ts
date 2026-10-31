import { describe, expect, it } from 'vitest';

import { soloLetrasDeNombre, soloLetrasYNumeros } from './input-filters';

describe('soloLetrasDeNombre', () => {
  it('deja letras con tildes y ñ', () => {
    expect(soloLetrasDeNombre('José Ñandú')).toBe('José Ñandú');
  });

  it('deja un solo espacio entre palabras, para apellidos compuestos', () => {
    expect(soloLetrasDeNombre('De La Cruz')).toBe('De La Cruz');
    expect(soloLetrasDeNombre('de ')).toBe('de ');
  });

  it('quita dígitos y símbolos', () => {
    expect(soloLetrasDeNombre("Ana-María 2.0 d'Arc")).toBe('AnaMaría dArc');
  });

  it('quita el espacio inicial y los espacios seguidos', () => {
    expect(soloLetrasDeNombre('   de   la  cruz')).toBe('de la cruz');
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
