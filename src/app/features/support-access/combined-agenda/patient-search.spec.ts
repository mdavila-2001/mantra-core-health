import { describe, expect, it } from 'vitest';

import { isMinorOn, validateExactSearch, type SearchInput } from './patient-search';

const base: SearchInput = { mode: 'DOCUMENT', text: '', fullName: '', birthDate: '' };
const con = (parcial: Partial<SearchInput>): SearchInput => ({ ...base, ...parcial });

describe('la búsqueda de pacientes es exacta', () => {
  describe('por documento', () => {
    it('acepta el documento completo y lo limpia', () => {
      expect(validateExactSearch(con({ text: ' 4123456 ' }))).toEqual({ ok: true, query: { kind: 'DOCUMENT', document: '4123456' } });
      expect(validateExactSearch(con({ text: '4.123.456' }))).toMatchObject({ ok: true, query: { document: '4123456' } });
      expect(validateExactSearch(con({ text: '1234567-1B' }))).toMatchObject({ ok: true });
    });

    it('«Juan» se rechaza (caso 13) y el mensaje dice cómo buscar', () => {
      const r = validateExactSearch(con({ text: 'Juan' }));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.message).toContain('«Juan» no alcanza');
        expect(r.message).toContain('exacta');
        expect(r.help).toContain('documento de identidad completo');
        expect(r.help).toContain('Nombre y fecha');
      }
    });

    it('un documento corto o sin números no es un documento', () => {
      expect(validateExactSearch(con({ text: '412' })).ok).toBe(false);
      expect(validateExactSearch(con({ text: 'abcdefgh' })).ok).toBe(false);
      expect(validateExactSearch(con({ text: '' })).ok).toBe(false);
    });
  });

  describe('por teléfono', () => {
    it('acepta el teléfono completo, con o sin el 591', () => {
      expect(validateExactSearch(con({ mode: 'PHONE', text: '71234567' }))).toEqual({ ok: true, query: { kind: 'PHONE', phone: '71234567' } });
      expect(validateExactSearch(con({ mode: 'PHONE', text: '+591 7123 4567' }))).toMatchObject({ ok: true, query: { phone: '71234567' } });
    });

    it('rechaza un teléfono con dígitos de menos', () => {
      const r = validateExactSearch(con({ mode: 'PHONE', text: '7123' }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.help).toContain('8 dígitos');
    });
  });

  describe('por nombre completo y fecha de nacimiento', () => {
    it('necesita las dos cosas', () => {
      expect(validateExactSearch(con({ mode: 'NAME_BIRTH', fullName: 'Juan Pérez Rojas', birthDate: '1990-05-12' }))).toEqual({
        ok: true,
        query: { kind: 'NAME_BIRTH', fullName: 'Juan Pérez Rojas', birthDate: '1990-05-12' },
      });
    });

    it('un nombre suelto no alcanza', () => {
      const r = validateExactSearch(con({ mode: 'NAME_BIRTH', fullName: 'Juan', birthDate: '1990-05-12' }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain('nombre y el apellido completos');
    });

    it('sin fecha de nacimiento no se busca por nombre', () => {
      const r = validateExactSearch(con({ mode: 'NAME_BIRTH', fullName: 'Juan Pérez', birthDate: '' }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toContain('fecha de nacimiento');
    });

    it('una fecha futura o imposible no vale', () => {
      expect(validateExactSearch(con({ mode: 'NAME_BIRTH', fullName: 'Juan Pérez', birthDate: '2999-01-01' })).ok).toBe(false);
      expect(validateExactSearch(con({ mode: 'NAME_BIRTH', fullName: 'Juan Pérez', birthDate: '2020-02-31' })).ok).toBe(false);
    });
  });
});

describe('menor de edad', () => {
  const hoy = new Date(2026, 10, 3);
  it('es menor hasta cumplir los 18', () => {
    expect(isMinorOn('2015-09-30', hoy)).toBe(true);
    expect(isMinorOn('2008-11-04', hoy)).toBe(true);
    expect(isMinorOn('2008-11-03', hoy)).toBe(false);
    expect(isMinorOn('1990-01-01', hoy)).toBe(false);
  });
  it('una fecha ilegible no se toma por menor', () => {
    expect(isMinorOn('', hoy)).toBe(false);
  });
});
