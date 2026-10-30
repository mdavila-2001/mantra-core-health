import { describe, expect, it } from 'vitest';

import { normalizarInsights } from './surveys-insights.wire';

describe('normalizarInsights', () => {
  it('lleva el cuerpo del contrato a los tipos de la vista', () => {
    const insights = normalizarInsights({
      privacy: { minCohort: 5, suppressed: false },
      totals: { issued: 10, answered: 6, responseRate: 0.6 },
      nps: { value: 33, promoters: 3, passives: 2, detractors: 1, n: 6 },
      byQuestion: [
        {
          questionId: 'q1',
          text: 'Satisfacción',
          dimension: 'satisfaccion_global',
          answerType: 'SCALE',
          n: 6,
          average: 4.17,
          distribution: [
            { value: 5, count: 3 },
            { value: 3, count: 1 },
          ],
        },
      ],
      trend: [{ period: '2026-10', answered: 6, average: 4.17 }],
      safetyAlerts: { n: 1 },
      comments: [{ text: 'Muy bien' }],
    });

    expect(insights.totals.answered).toBe(6);
    expect(insights.byQuestion[0]!.distribution.map((b) => b.value)).toEqual([3, 5]);
    expect(insights.byQuestion[0]!.optionCounts).toEqual([]);
    expect(insights.comments[0]).toEqual({ text: 'Muy bien' });
    expect(insights.byQuestion[0]!.suppressed).toBe(false);
    expect(insights.safetyAlerts.n).toBe(1);
    expect(insights.privacy).toEqual({ minCohort: 5, suppressed: false });
  });

  it('suprimido: sólo totales, y lo demás queda vacío en vez de romper', () => {
    const insights = normalizarInsights({
      privacy: { minCohort: 5, suppressed: true },
      totals: { issued: 8, answered: 3, responseRate: 0.375 },
    });
    expect(insights.privacy).toEqual({ minCohort: 5, suppressed: true });
    expect(insights.totals.answered).toBe(3);
    expect(insights.nps).toEqual({ value: null, promoters: 0, passives: 0, detractors: 0, n: 0 });
    expect(insights.byQuestion).toEqual([]);
    expect(insights.trend).toEqual([]);
    expect(insights.comments).toEqual([]);
    expect(insights.safetyAlerts.n).toBe(0);
  });

  it('sin `privacy` (servidor viejo) no suprime; `suppressed` que no es booleano tampoco', () => {
    expect(normalizarInsights({ totals: { answered: 1 } }).privacy).toEqual({ minCohort: 5, suppressed: false });
    expect(normalizarInsights({ privacy: { suppressed: 'true' } }).privacy.suppressed).toBe(false);
  });

  it('respeta el mínimo que manda el servidor', () => {
    expect(normalizarInsights({ privacy: { minCohort: 10, suppressed: true } }).privacy.minCohort).toBe(10);
  });

  it('un comentario es SÓLO su texto: si el servidor manda fecha, mes o autor, no se conservan', () => {
    const insights = normalizarInsights({
      comments: [
        { text: 'a', submittedAt: '2026-10-21T10:00:00.000Z', month: '2026-10', author: 'x', bookingId: 'b-1' },
        { text: 'b' },
      ],
    });
    expect(insights.comments).toEqual([{ text: 'a' }, { text: 'b' }]);
    expect(Object.keys(insights.comments[0]!)).toEqual(['text']);
  });

  it('una pregunta suprimida llega sin datos y marcada', () => {
    const insights = normalizarInsights({
      byQuestion: [{ questionId: 'q', text: 'T', dimension: 'comunicacion', answerType: 'SCALE', suppressed: true }],
    });
    expect(insights.byQuestion[0]).toMatchObject({ suppressed: true, n: 0, average: null, distribution: [], optionCounts: [] });
  });

  it('el NPS sin valor se conserva como null (n = 0): «sin datos suficientes», no cero', () => {
    const insights = normalizarInsights({ nps: { value: null, promoters: 0, passives: 0, detractors: 0, n: 0 } });
    expect(insights.nps.value).toBeNull();
  });

  it('acepta la distribución como lista de conteos desde el mínimo de la escala', () => {
    const una = normalizarInsights({ byQuestion: [{ questionId: 'a', answerType: 'SCALE', distribution: [0, 0, 2, 3, 5] }] });
    expect(una.byQuestion[0]!.distribution).toEqual([
      { value: 1, count: 0 },
      { value: 2, count: 0 },
      { value: 3, count: 2 },
      { value: 4, count: 3 },
      { value: 5, count: 5 },
    ]);
    const nps = normalizarInsights({ byQuestion: [{ questionId: 'b', answerType: 'SCALE', distribution: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4] }] });
    expect(nps.byQuestion[0]!.distribution[0]).toEqual({ value: 0, count: 1 });
    expect(nps.byQuestion[0]!.distribution[10]).toEqual({ value: 10, count: 4 });
  });

  it('acepta optionCounts como objeto', () => {
    const insights = normalizarInsights({
      byQuestion: [{ questionId: 'c', answerType: 'SINGLE_CHOICE', optionCounts: { Sí: 4, No: 1 } }],
    });
    expect(insights.byQuestion[0]!.optionCounts).toEqual([
      { option: 'Sí', count: 4 },
      { option: 'No', count: 1 },
    ]);
  });

  it('los nulos del cable no pasan como nulos donde el tipo promete otra cosa', () => {
    const insights = normalizarInsights({
      totals: null,
      nps: { value: null, promoters: null, n: null },
      byQuestion: [{ questionId: 'd', answerType: 'SCALE', n: null, average: null, dimension: null, distribution: null, optionCounts: null }],
      trend: null,
      comments: null,
      safetyAlerts: null,
    });
    expect(insights.totals).toEqual({ issued: 0, answered: 0, responseRate: 0 });
    expect(insights.nps).toEqual({ value: null, promoters: 0, passives: 0, detractors: 0, n: 0 });
    expect(insights.byQuestion[0]).toMatchObject({ n: 0, average: null, dimension: null, distribution: [], optionCounts: [] });
    expect(insights.trend).toEqual([]);
    expect(insights.comments).toEqual([]);
    expect(insights.safetyAlerts.n).toBe(0);
  });

  it('un cuerpo que no es objeto da un resumen vacío en vez de romper', () => {
    expect(normalizarInsights(null).totals.answered).toBe(0);
    expect(normalizarInsights('x').byQuestion).toEqual([]);
  });
});
