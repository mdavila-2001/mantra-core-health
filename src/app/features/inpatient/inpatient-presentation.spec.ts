import type { BedBoardCell } from '../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { cellToTile, relativeAge, shortDate } from './inpatient-presentation';

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

  it('una cama en mantenimiento muestra motivo y «hasta», con el estado escrito', () => {
    const cell = {
      code: '302-B', v2Code: 'C', lastEventAt: '2026-10-30T10:00:00Z',
      lifecycle: { code: 'SPACE_ACTIVE', display: 'Activo' },
      availability: { code: 'SPACE_OP_MAINTENANCE', display: 'En mantenimiento', reasonText: 'Mantenimiento preventivo', expectedUntil: '2026-10-30T22:00:00Z', reasonCode: 'x', since: null },
      hygiene: { code: 'HYG_INSPECTED', display: 'Limpia e inspeccionada', terminalRequired: false, since: null },
      isolation: { code: 'ISO_NONE', display: 'Sin aislamiento', since: null },
      occupancy: { code: 'OCC_FREE', display: 'Libre', since: null },
    } as unknown as BedBoardCell;
    const t = cellToTile(cell, ahora);
    expect(t).toMatchObject({ statusLabel: 'No disponible', tone: 'unavailable', reason: 'En mantenimiento · Mantenimiento preventivo', until: 'hasta 30/10 18:00', hygiene: null, age: 'hace 26 h' });
  });
});
