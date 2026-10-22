import { formatCalendarDay, parseCalendarDay, parseCalendarView } from './calendar-position';

describe('calendar-position — el día del calendario en la URL', () => {
  it('escribe el día en hora local, con ceros', () => {
    expect(formatCalendarDay(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
  });

  it('lee de vuelta el mismo día, a medianoche local', () => {
    const dia = parseCalendarDay('2026-10-06');
    expect(dia?.getFullYear()).toBe(2026);
    expect(dia?.getMonth()).toBe(9);
    expect(dia?.getDate()).toBe(6);
    expect(dia?.getHours()).toBe(0);
  });

  it('un día imposible o mal escrito no se corre a otra fecha: es ninguno', () => {
    expect(parseCalendarDay('2026-02-31')).toBeNull();
    expect(parseCalendarDay('6/10/2026')).toBeNull();
    expect(parseCalendarDay('')).toBeNull();
    expect(parseCalendarDay(null)).toBeNull();
  });

  it('sólo acepta las tres vistas que existen', () => {
    expect(parseCalendarView('week')).toBe('week');
    expect(parseCalendarView('month')).toBe('month');
    expect(parseCalendarView('day')).toBe('day');
    expect(parseCalendarView('year')).toBeNull();
    expect(parseCalendarView(null)).toBeNull();
  });
});
