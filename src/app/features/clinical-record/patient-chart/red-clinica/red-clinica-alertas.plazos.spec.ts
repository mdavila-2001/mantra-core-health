import { describe, expect, it } from 'vitest';

import { fecha, fechaClinica } from './red-clinica-alertas.plazos';

describe('fecha de las alertas', () => {
  it('nombra el día clínico de La Paz aunque en UTC ya sea el día siguiente', () => {
    // 23:30 on 4 Nov in La Paz (-04:00) is 03:30 on 5 Nov in UTC.
    const texto = fechaClinica(new Date('2026-11-05T03:30:00Z'));
    expect(texto).toMatch(/^4\b/);
    expect(texto).toContain('2026');
  });

  it('un día elegido en un filtro se nombra tal cual, sin correrlo de zona', () => {
    expect(fecha(new Date(2026, 9, 1))).toMatch(/^1\b/);
  });
});
