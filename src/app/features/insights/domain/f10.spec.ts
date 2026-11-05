import { describe, expect, it } from 'vitest';

import { commentRows, confidenceOf, REVIEW_BELOW } from './comments';
import { ENVIRONMENT, exposure } from './environment';
import { IDEA_PRIORITIES, ideas } from './ideas';
import { SOURCES } from './opinion.data';

const FILTER = { range: { from: '2026-08-01', to: '2026-10-29' }, sources: SOURCES };

describe('comentarios', () => {
  it('la confianza es estable y está entre 0,72 y 0,98', () => {
    const rows = commentRows(FILTER, { sentiment: 'all', kind: 'all', department: 'all', query: '' });
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.confidence).toBe(confidenceOf(r.mention));
      expect(r.confidence).toBeGreaterThanOrEqual(0.72);
      expect(r.confidence).toBeLessThanOrEqual(0.98);
      expect(r.needsReview).toBe(r.confidence < REVIEW_BELOW);
    }
  });
  it('filtra por sentimiento y por texto', () => {
    const neg = commentRows(FILTER, { sentiment: 'negative', kind: 'all', department: 'all', query: '' });
    expect(neg.every((r) => r.mention.sentiment === 'negative')).toBe(true);
    const q = neg[0]!.mention.text.split(' ')[0]!;
    expect(commentRows(FILTER, { sentiment: 'negative', kind: 'all', department: 'all', query: q }).length).toBeGreaterThan(0);
  });
});

describe('entorno', () => {
  it('el riesgo de cada campaña es el máximo de sus riesgos', () => {
    const e = exposure();
    expect(e.length).toBe(4);
    const c4 = e.find((x) => x.campaignId === 'c4')!;
    expect(c4.risk).toBe(3);
    expect(ENVIRONMENT.length).toBe(14);
  });
});

describe('ideas', () => {
  it('son seis y salen ordenadas por prioridad', () => {
    const list = ideas(FILTER);
    expect(list.length).toBe(6);
    const order = list.map((i) => IDEA_PRIORITIES.indexOf(i.priority));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
