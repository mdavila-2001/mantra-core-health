import { describe, expect, it } from 'vitest';

import { DEFAULT_TIME_ZONE } from '../../../inpatient/inpatient-presentation';
import { diaClinico, diaDelCalendario, diasClinicosEntre, mismoDiaClinico, partesDelDia } from './dia-clinico';

/*
 * Run under `TZ=UTC` and `TZ=America/La_Paz`: every expectation uses fixed
 * instants, so it must hold whatever the machine's zone.
 */
describe('dia-clinico · the clinical day is La Paz, not the browser', () => {
  // 20:30 in La Paz on 10 March = 00:30 UTC on 11 March.
  const noche = new Date('2026-03-11T00:30:00Z');
  // 10:00 in La Paz on 11 March.
  const manana = new Date('2026-03-11T14:00:00Z');

  it('uses the product time zone of the rest of the front', () => {
    expect(DEFAULT_TIME_ZONE).toBe('America/La_Paz');
  });

  it('reads the day of an instant in La Paz', () => {
    expect(diaClinico(noche)).toBe('2026-03-10');
    expect(partesDelDia(noche)).toEqual({ anio: 2026, mes: 3, dia: 10 });
    expect(diaClinico(new Date('2027-01-01T03:59:00Z'))).toBe('2026-12-31');
  });

  it('20:30 and 10:00 the next morning are different clinical days, one apart', () => {
    expect(mismoDiaClinico(noche, manana)).toBe(false);
    expect(diasClinicosEntre(noche, manana)).toBe(1);
    expect(diasClinicosEntre(manana, noche)).toBe(-1);
  });

  it('two instants of the same La Paz evening are the same day, though UTC splits them', () => {
    const antes = new Date('2026-03-10T23:30:00Z');
    expect(mismoDiaClinico(antes, noche)).toBe(true);
    expect(diasClinicosEntre(antes, noche)).toBe(0);
  });

  it('counts across months and years by calendar days', () => {
    expect(diasClinicosEntre(new Date('2026-12-31T15:00:00Z'), new Date('2027-01-01T03:00:00Z'))).toBe(0);
    expect(diasClinicosEntre(new Date('2026-02-28T15:00:00Z'), new Date('2026-03-01T15:00:00Z'))).toBe(1);
  });

  it('a picked day is read as written, from its local components', () => {
    expect(diaDelCalendario(new Date(2026, 2, 10, 12))).toBe('2026-03-10');
    expect(diaDelCalendario(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
