import { milestonesOn } from './campaign-analysis';
import type { InsightsFilter } from './insights.types';
import { CHANNELS } from './insights.types';

const FILTER: InsightsFilter = {
  campaignIds: ['c2'],
  range: { from: '2026-10-05', to: '2026-10-25' },
  grain: 'day',
  channels: CHANNELS,
  metric: 'ctr',
};

describe('milestonesOn', () => {
  const days = Array.from({ length: 21 }, (_, i) => `2026-10-${String(5 + i).padStart(2, '0')}`);

  it('con cubeta diaria marca el día exacto del hito', () => {
    const marks = milestonesOn(days, FILTER);
    const viral = marks.find((m) => m.label.includes('viraliza'));
    expect(viral?.index).toBe(days.indexOf('2026-10-09'));
    expect(marks.find((m) => m.label.includes('prensa'))?.index).toBe(days.indexOf('2026-10-17'));
  });

  it('con cubeta semanal cae en la semana que contiene la fecha', () => {
    const weeks = ['2026-10-05', '2026-10-12', '2026-10-19'];
    const marks = milestonesOn(weeks, { ...FILTER, grain: 'week' });
    expect(marks.find((m) => m.label.includes('viraliza'))?.index).toBe(0);
    expect(marks.find((m) => m.label.includes('prensa'))?.index).toBe(1);
  });

  it('NEGATIVO: no marca hitos de campañas no elegidas ni fuera del periodo', () => {
    const marks = milestonesOn(days, FILTER);
    expect(marks.some((m) => m.label.includes('Facebook'))).toBe(false); // es de c3
    expect(marks.some((m) => m.label.includes('Abran paso'))).toBe(false); // 15/09, antes del periodo
  });

  it('sin cubetas no hay nada que marcar', () => {
    expect(milestonesOn([], FILTER)).toEqual([]);
  });
});
