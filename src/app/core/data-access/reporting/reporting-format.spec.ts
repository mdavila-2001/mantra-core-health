import { describe, expect, it } from 'vitest';

import { formatDate, formatearValor, formatearVariacion, NO_DATA } from './reporting-format';

const BOB = { tipo: 'moneda', moneda: 'BOB' } as const;
const USD = { tipo: 'moneda', moneda: 'USD' } as const;
const NUM = { tipo: 'numero' } as const;

/** Intl pone espacios duros: se comparan con espacio normal. */
const n = (texto: string): string => texto.replace(/\s/g, ' ');

describe('formatearValor', () => {
  it('null, undefined y NaN salen como «Sin dato», nunca como 0', () => {
    for (const v of [null, undefined, Number.NaN]) {
      expect(formatearValor(v, BOB)).toBe(NO_DATA);
      expect(formatearValor(v, NUM, true)).toBe(NO_DATA);
    }
    expect(formatearValor(0, NUM)).toBe('0');
  });

  it('un importe lleva su moneda', () => {
    expect(n(formatearValor(1500, BOB))).toContain('Bs');
    expect(n(formatearValor(1500, USD))).toContain('USD');
  });

  describe('compacto', () => {
    it('usa siempre «k» en miles: «3 k» y «12 k», nunca «3 K» junto a «12 k»', () => {
      expect(n(formatearValor(3000, BOB, true))).toBe('Bs 3 k');
      expect(n(formatearValor(12000, BOB, true))).toBe('Bs 12 k');
      expect(n(formatearValor(2500, BOB, true))).toBe('Bs 2,5 k');
    });

    it('usa «M» en millones y «mil M» en miles de millones', () => {
      expect(n(formatearValor(1_200_000, USD, true))).toBe('USD 1,2 M');
      expect(n(formatearValor(3_000_000_000, NUM, true))).toBe('3 mil M');
    });

    it('por debajo de mil no abrevia, y conserva el signo', () => {
      expect(n(formatearValor(500, BOB, true))).toBe('Bs 500');
      expect(n(formatearValor(-12000, NUM, true))).toMatch(/12 k$/);
      expect(n(formatearValor(-12000, NUM, true))).toMatch(/^[-−]/);
    });
  });
});

describe('formatearVariacion', () => {
  it('lleva signo explícito y «Sin comparativo» cuando no hay con qué comparar', () => {
    expect(formatearVariacion(4.2)).toBe('+4,2 %');
    expect(formatearVariacion(-1)).toBe('−1,0 %');
    expect(formatearVariacion(null)).toBe('Sin comparativo');
  });
});

describe('formatDate', () => {
  it('escribe la fecha como se lee en Bolivia, sin ceros a la izquierda', () => {
    expect(formatDate('2026-10-06')).toBe('6 oct');
    expect(formatDate('2026-01-31', true)).toBe('31 ene 2026');
    expect(formatDate('2026-12-01')).toBe('1 dic');
  });

  it('un mes de cohorte se escribe «may 2026»', () => {
    expect(formatDate('2026-05')).toBe('may 2026');
    expect(formatDate('2026-12', true)).toBe('dic 2026');
  });

  it('lo que no es una fecha ISO vuelve igual: una categoría no se inventa', () => {
    for (const texto of ['Esencial', 'T1', '2026-13-01', '2026-13', '']) {
      expect(formatDate(texto)).toBe(texto);
    }
  });
});
