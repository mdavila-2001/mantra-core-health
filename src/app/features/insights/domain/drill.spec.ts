import { applyDrill, DRILL_COLUMNS, drillRows, encodeDrill, eventRows, parseDrill, viewFor } from './drill';
import { CHANNELS } from './insights.types';
import type { InsightsFilter } from './insights.types';

const FILTER: InsightsFilter = {
  campaignIds: ['c1', 'c2', 'c3', 'c4'],
  range: { from: '2026-10-01', to: '2026-10-29' },
  grain: 'day',
  channels: CHANNELS,
  metric: 'conversions',
};

describe('drill-down de Campañas', () => {
  it('el camino se codifica y se lee en orden canal → campaña', () => {
    const steps = parseDrill('ch.instagram,camp.c2');
    expect(steps).toEqual([{ level: 'ch', id: 'instagram' }, { level: 'camp', id: 'c2' }]);
    expect(encodeDrill(steps)).toBe('ch.instagram,camp.c2');
    expect(encodeDrill([])).toBeNull();
  });

  it('NEGATIVO: un camino fuera de orden, con ids inexistentes o basura no se acepta', () => {
    expect(parseDrill('camp.c2')).toEqual([]);
    expect(parseDrill('ch.nope')).toEqual([]);
    expect(parseDrill('ch.instagram,camp.zz')).toEqual([{ level: 'ch', id: 'instagram' }]);
    expect(parseDrill(undefined)).toEqual([]);
    expect(parseDrill('ch.instagram,ch.facebook')).toEqual([{ level: 'ch', id: 'instagram' }]);
  });

  it('cada paso filtra: el canal fija el canal y la campaña fija la campaña', () => {
    const f = applyDrill(FILTER, parseDrill('ch.instagram,camp.c2'));
    expect(f.channels).toEqual(['instagram']);
    expect(f.campaignIds).toEqual(['c2']);
    expect(viewFor([])).toBe('ch');
    expect(viewFor(parseDrill('ch.instagram'))).toBe('camp');
    expect(viewFor(parseDrill('ch.instagram,camp.c2'))).toBe('ev');
  });

  it('las filas por canal suman lo mismo que el total (las conversiones no se pierden)', () => {
    const rows = drillRows(FILTER, 'ch');
    const total = rows.reduce((s, r) => s + (r.values['conversions'] ?? 0), 0);
    const all = drillRows({ ...FILTER, channels: CHANNELS }, 'camp').reduce((s, r) => s + (r.values['conversions'] ?? 0), 0);
    expect(total).toBe(all);
    expect(rows.every((r) => DRILL_COLUMNS.every((c) => c in r.values))).toBe(true);
  });

  it('bajar al canal deja solo las campañas que lo usan', () => {
    const f = applyDrill(FILTER, parseDrill('ch.tiktok'));
    const ids = drillRows(f, 'camp').map((r) => r.id).sort();
    expect(ids).toEqual(['c2', 'c3']);
  });

  it('el último nivel señala días atípicos y asocia el hito del calendario', () => {
    const f = applyDrill({ ...FILTER, range: { from: '2026-09-15', to: '2026-10-29' }, metric: 'ctr' }, parseDrill('ch.tiktok,camp.c2'));
    const events = eventRows(f);
    expect(events.length).toBeGreaterThan(0);
    expect(events.length).toBeLessThanOrEqual(8);
    expect(Math.abs(events[0]!.z)).toBeGreaterThanOrEqual(Math.abs(events[events.length - 1]!.z));
  });

  it('con muy pocos días no hay días atípicos que inventar', () => {
    expect(eventRows({ ...FILTER, range: { from: '2026-10-27', to: '2026-10-29' } })).toEqual([]);
  });
});
