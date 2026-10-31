import type { BedBoardCell } from '../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { cellToTile, patientShort, relativeAge, shortDate, shortDateTime, siteMidnight, siteToday, validDateKey } from './inpatient-presentation';

describe('presentación de internación', () => {
  const ahora = Date.parse('2026-10-31T12:00:00Z');

  it('dice la antigüedad del dato en palabras', () => {
    expect(relativeAge('2026-10-31T11:59:48Z', ahora)).toBe('hace 12 s');
    expect(relativeAge('2026-10-31T11:56:00Z', ahora)).toBe('hace 4 min');
    expect(relativeAge('2026-10-31T09:00:00Z', ahora)).toBe('hace 3 h');
    expect(relativeAge('2026-10-27T12:00:00Z', ahora)).toBe('hace 4 d');
    expect(relativeAge(null, ahora)).toBeNull();
    expect(shortDate('2026-10-27')).toBe('27/10/2026');
  });

  it('una cama en mantenimiento muestra motivo y «hasta», con el estado escrito (códigos de la API, etiquetas de la web)', () => {
    const cell = {
      code: '302-B', v2Code: 'C', lastEventAt: '2026-10-30T10:00:00Z', lifecycle: 'ACTIVE',
      availability: { code: 'SPACE_OP_MAINTENANCE', reasonText: null, expectedUntil: '2026-10-30T22:00:00Z', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE', since: null },
      hygiene: { code: 'HYG_INSPECTED', terminalRequired: false, since: null },
      isolation: { code: 'ISO_NONE', since: null },
      occupancy: { code: 'OCC_FREE', since: null },
    } as unknown as BedBoardCell;
    const t = cellToTile(cell, ahora);
    expect(t).toMatchObject({ statusLabel: 'No disponible', tone: 'unavailable', reason: 'En mantenimiento · Mantenimiento preventivo', until: 'hasta 30/10 18:00', hygiene: null, age: 'hace 26 h' });
  });

  it('M2: sexo y edad con mapeo explícito, y «sin dato» cuando faltan', () => {
    expect(patientShort({ initials: 'JMC', sexCode: 'M', ageYears: 67 })).toBe('JMC · M · 67 a');
    expect(patientShort({ initials: 'AR', sexCode: 'F', ageYears: 3 })).toBe('AR · F · 3 a');
    expect(patientShort({ initials: 'XY', sexCode: null, ageYears: null })).toBe('XY · sin dato · edad sin dato');
    expect(patientShort({ initials: 'ZZ', sexCode: 'MALE', ageYears: 40 })).toBe('ZZ · sin dato · 40 a');
    expect(patientShort(undefined)).toBeNull();
  });

  it('M3: las horas y el «hoy» son los de la zona de la sede', () => {
    expect(shortDateTime('2026-10-31T03:30:00Z', 'America/La_Paz')).toBe('30/10 23:30');
    expect(shortDateTime('2026-10-31T03:30:00Z', 'America/Argentina/Buenos_Aires')).toBe('31/10 00:30');
    const casiMedianoche = Date.parse('2026-10-31T03:30:00Z');
    expect(siteToday(0, casiMedianoche, 'America/La_Paz')).toBe('2026-10-30');
    expect(siteToday(0, casiMedianoche, 'America/Argentina/Buenos_Aires')).toBe('2026-10-31');
    expect(siteMidnight('2026-10-31', 'America/La_Paz').toISOString()).toBe('2026-10-31T04:00:00.000Z');
  });

  it('una fecha de la URL inválida no se usa', () => {
    expect(validDateKey('2026-10-30')).toBe('2026-10-30');
    expect(validDateKey('30/10/2026')).toBeNull();
    expect(validDateKey(null)).toBeNull();
  });
});
