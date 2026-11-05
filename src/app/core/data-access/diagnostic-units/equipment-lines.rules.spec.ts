import { describe, expect, it } from 'vitest';

import { horarioDeSemana } from './center-schedule.rules';
import type { CenterEquipment, CenterSchedule } from './center-schedule.types';
import { asignarALineas, cupoDelTurno, turnoCubre } from './equipment-lines.rules';

// Tuesday 10/11/2026, local time.
const at = (h: number, m = 0): Date => new Date(2026, 10, 10, h, m);
const plus30 = (d: Date): Date => new Date(d.getTime() + 30 * 60_000);
const device = (id: string, status: CenterEquipment['status'] = 'OPERATIONAL'): CenterEquipment => ({
  id,
  name: id,
  manufacturer: null,
  model: null,
  modalityCode: 'ECO',
  status,
  glossaryConceptId: null,
});
const schedule = (equipment: CenterSchedule['equipment']): CenterSchedule => ({
  general: horarioDeSemana('08:00', '12:00', 30),
  modalities: [],
  studies: [],
  equipment,
});

describe('equipment lines', () => {
  it('a shift covers a slot inside its window and not one past its close', () => {
    const block = horarioDeSemana('09:00', '10:00', 30, [2]);
    expect(turnoCubre(block, at(9), plus30(at(9)))).toBe(true);
    expect(turnoCubre(block, at(9, 45), plus30(at(9, 45)))).toBe(false);
    expect(turnoCubre(block, at(8), plus30(at(8)))).toBe(false);
  });

  it('the capacity of a slot is the operational lines open for it', () => {
    const s = schedule([{ equipmentId: 'b', schedule: horarioDeSemana('09:00', '10:00', 30, [2]) }]);
    const equipos = [device('a'), device('b'), device('c', 'MAINTENANCE')];
    expect(cupoDelTurno(s, equipos, 'ECO', at(8), plus30(at(8)))).toBe(1);
    expect(cupoDelTurno(s, equipos, 'ECO', at(9), plus30(at(9)))).toBe(2);
  });

  it('lays bookings first come first served and leaves the overflow out', () => {
    const turno = (id: string, inicio: Date) => ({ id, inicio, fin: plus30(inicio), modalityCode: 'ECO' as const });
    const lineas = asignarALineas(schedule([]), [device('a'), device('b')], [
      turno('3', at(8)),
      turno('1', at(8)),
      turno('2', at(8)),
      turno('4', at(8, 30)),
    ]);
    expect([...lineas]).toEqual([
      ['1', 'a'],
      ['2', 'b'],
      ['4', 'a'],
    ]);
  });
});
