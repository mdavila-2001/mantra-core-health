import { describe, expect, it } from 'vitest';

import { sinCortes } from './sin-cortes';

describe('sinCortes', () => {
  it('une la hora con su meridiano con espacios duros', () => {
    expect(sinCortes('1 oct de 2026, 12:00 a. m.')).toBe('1 oct de 2026, 12:00\u00a0a.\u00a0m.');
    expect(sinCortes('5:35 p. m.')).toBe('5:35\u00a0p.\u00a0m.');
  });

  it('no toca el resto del texto', () => {
    expect(sinCortes('Sin dato')).toBe('Sin dato');
    expect(sinCortes('1 oct de 2026')).toBe('1 oct de 2026');
  });

  it('con `todo` no deja ningún espacio partible', () => {
    expect(sinCortes('1 oct de 2026', true)).toBe('1\u00a0oct\u00a0de\u00a02026');
  });
});
