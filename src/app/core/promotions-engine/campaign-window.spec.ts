import { isInsideSchedule, windowStatus } from './campaign-window';

describe('windowStatus', () => {
  const from = new Date(2026, 9, 10, 12, 0);
  const to = new Date(2026, 9, 30, 12, 0);

  it('programada antes del primer día', () => {
    expect(windowStatus(from, to, new Date(2026, 9, 9, 23, 59))).toBe('SCHEDULED');
  });

  it('vigente desde el primer minuto del primer día, aunque el calendario diga mediodía', () => {
    expect(windowStatus(from, to, new Date(2026, 9, 10, 9, 0))).toBe('LIVE');
  });

  it('vigente hasta el último minuto del último día', () => {
    expect(windowStatus(from, to, new Date(2026, 9, 30, 23, 59))).toBe('LIVE');
  });

  it('terminada en cuanto empieza el día siguiente', () => {
    expect(windowStatus(from, to, new Date(2026, 9, 31, 0, 0))).toBe('ENDED');
  });
});

describe('isInsideSchedule', () => {
  const free = { weekdays: [], fromTime: null, toTime: null };

  it('sin restricciones, siempre', () => {
    expect(isInsideSchedule(free, new Date(2026, 9, 15, 3, 0))).toBe(true);
  });

  it('con días de la semana, sólo esos días', () => {
    // 15/10/2026 es jueves (4).
    expect(isInsideSchedule({ ...free, weekdays: [4] }, new Date(2026, 9, 15))).toBe(true);
    expect(isInsideSchedule({ ...free, weekdays: [0, 6] }, new Date(2026, 9, 15))).toBe(false);
  });

  it('la franja es [desde, hasta): a la hora de cierre ya terminó', () => {
    const window = { ...free, fromTime: '09:00', toTime: '18:00' };
    expect(isInsideSchedule(window, new Date(2026, 9, 15, 9, 0))).toBe(true);
    expect(isInsideSchedule(window, new Date(2026, 9, 15, 17, 59))).toBe(true);
    expect(isInsideSchedule(window, new Date(2026, 9, 15, 18, 0))).toBe(false);
  });
});
