import { conFecha, fechaCorta } from './redaccion';

// 23:30 on 4 Nov in La Paz is already 5 Nov in UTC: run with TZ=UTC, and these
// fail if the formatter falls back to the browser's zone.
const NOCHE_DEL_4 = new Date('2026-11-05T03:30:00Z');

describe('redaccion: dates in the clinical day', () => {
  it('the short date is the clinical day, not the browser day', () => {
    expect(fechaCorta(NOCHE_DEL_4)).toMatch(/^4 nov\.? 2026$/);
  });

  it('the sentence date is the clinical day, not the browser day', () => {
    expect(conFecha(NOCHE_DEL_4, 'se confirmó.')).toBe('El 4 de noviembre de 2026 se confirmó.');
  });
});
