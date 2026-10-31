import { describe, expect, it } from 'vitest';

import { PROTOTYPE_TODAY } from './dates';
import { recommendedTest, sampleSize, segmentConversion } from './funnel-test';
import { filterObservatory, sectorTrends } from './observatory';
import { CHANNELS } from './insights.types';
import { CAMPAIGNS } from './campaigns.data';

const FILTER = { campaignIds: CAMPAIGNS.map((c) => c.id), channels: [...CHANNELS], range: { from: '2026-10-01', to: PROTOTYPE_TODAY }, metric: 'ctr' } as never;

describe('prueba recomendada', () => {
  it('n = ⌈16·p(1−p)/0,05²⌉', () => {
    expect(sampleSize(0.5)).toBe(1600);
    expect(sampleSize(0.1)).toBe(576);
  });
  it('es una propuesta coherente o no hay prueba', () => {
    const t = recommendedTest(FILTER);
    if (t) {
      expect(t.perVariant).toBe(sampleSize(t.rate));
      expect(t.change).toBeLessThan(0);
      if (t.days !== null) expect(t.days).toBeGreaterThan(0);
    } else expect(t).toBeNull();
  });
});

describe('conversión por segmento', () => {
  it('canal y campaña: sin base suficiente no hay tasa, nunca 0', () => {
    for (const d of ['channel', 'campaign', 'audience', 'format'] as const) {
      const rows = segmentConversion(FILTER, d);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) if (!r.enough) expect(r.rates.clickToConv).toBeNull();
    }
  });
});

describe('observatorio', () => {
  const base = { category: 'all', impact: 'all', scope: 'all', minRelevance: 'low', order: 'relevance', query: '' } as const;
  it('filtra por ámbito, relevancia mínima y texto', () => {
    expect(filterObservatory(base).length).toBe(6);
    expect(filterObservatory({ ...base, scope: 'sc' }).map((o) => o.id)).toEqual(['resp']);
    expect(filterObservatory({ ...base, minRelevance: 'high' }).every((o) => o.relevance === 'high')).toBe(true);
    expect(filterObservatory({ ...base, query: 'telemedicina' }).length).toBeGreaterThan(0);
  });
  it('ordena por fecha', () => {
    const d = filterObservatory({ ...base, order: 'date' }).map((o) => o.date);
    expect(d).toEqual([...d].sort().reverse());
  });
  it('tendencias: 12 semanas por categoría', () => {
    const t = sectorTrends(PROTOTYPE_TODAY);
    expect(t.labels.length).toBe(12);
    expect(t.series.every((s) => s.values.length === 12)).toBe(true);
  });
});
