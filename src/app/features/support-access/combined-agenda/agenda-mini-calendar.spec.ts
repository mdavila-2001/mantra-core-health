import { describe, expect, it } from 'vitest';

import { monthWeeks } from './agenda-mini-calendar';
import { toDayKey } from './agenda-model';

describe('el calendario chico', () => {
  it('cubre seis semanas de lunes a domingo, y la primera contiene el día 1 del mes', () => {
    const semanas = monthWeeks(new Date(2026, 10, 15));
    expect(semanas).toHaveLength(6);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    // 1 de noviembre de 2026 es domingo: su semana empieza el lunes 26 de octubre.
    expect(toDayKey(semanas[0]![0]!)).toBe('2026-10-26');
    expect(toDayKey(semanas[0]![6]!)).toBe('2026-11-01');
    expect(semanas.every((s) => s[0]!.getDay() === 1)).toBe(true);
  });
});
