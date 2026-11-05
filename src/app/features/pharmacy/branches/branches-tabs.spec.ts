import { describe, expect, it } from 'vitest';

import { branchesTabIndexOf, branchesTabKeyOf } from './branches-tabs';

describe('pestañas de Sucursales', () => {
  it('?tab=horario abre «Horario y turnos»; sin valor o desconocido, la primera', () => {
    expect(branchesTabIndexOf('horario')).toBe(1);
    expect(branchesTabIndexOf(null)).toBe(0);
    expect(branchesTabIndexOf('otra')).toBe(0);
  });

  it('el índice vuelve a su clave', () => {
    expect(branchesTabKeyOf(1)).toBe('horario');
    expect(branchesTabKeyOf(9)).toBe('sucursales');
  });
});
