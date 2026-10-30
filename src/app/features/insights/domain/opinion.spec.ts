import { describe, expect, it } from 'vitest';

import { departmentTable, mentionsSeries, opinionInsights, responseStats, select, shareOfVoice, sentimentSeries, sourceBreakdown, summarize, topicShifts, topicTable, type OpinionFilter } from './opinion';
import { SOURCES } from './opinion.data';

const OCT: OpinionFilter = { range: { from: '2026-10-01', to: '2026-10-29' }, sources: SOURCES };

describe('opinión pública', () => {
  it('es determinista: dos lecturas dan lo mismo', () => {
    expect(select(OCT).length).toBe(select(OCT).length);
    expect(summarize(select(OCT))).toEqual(summarize(select(OCT)));
  });

  it('el desglose por fuente y por día reconcilia con el total', () => {
    const total = select(OCT).length;
    expect(sourceBreakdown(OCT).reduce((s, r) => s + r.mentions, 0)).toBe(total);
    expect(mentionsSeries(OCT).values.reduce((s, v) => s + v, 0)).toBe(total);
    expect(departmentTable(OCT).reduce((s, r) => s + r.mentions, 0)).toBe(total);
  });

  it('sin muestra suficiente el sentimiento neto es null, no 0', () => {
    expect(summarize(select(OCT).slice(0, 5)).net).toBeNull();
    const one: OpinionFilter = { range: { from: '2026-10-29', to: '2026-10-29' }, sources: ['youtube'] };
    expect(summarize(select(one)).net).toBeNull();
  });

  it('el empeoramiento inyectado de la verificación de médicos se detecta como cambio reciente', () => {
    const shifts = topicShifts(OCT);
    expect(shifts[0]?.id === 'verification' || shifts[0]?.id === 'app').toBe(true);
    expect(shifts.find((s) => s.id === 'verification')?.delta).toBeLessThan(-0.2);
  });

  it('«Salud en zonas rurales» se marca emergente y los temas estables no', () => {
    const topics = topicTable(OCT);
    expect(topics.find((t) => t.id === 'rural')?.emerging).toBe(true);
    expect(topics.find((t) => t.id === 'telemedicine')?.emerging).toBe(false);
  });

  it('un departamento con pocas menciones declara representatividad baja', () => {
    const pando = departmentTable(OCT).find((d) => d.id === 'pnd');
    expect(pando?.representativity).toBe('low');
    expect(departmentTable(OCT).find((d) => d.id === 'scz')?.representativity).not.toBe('low');
  });

  it('la cuota de voz suma 100 % en cada columna', () => {
    const voice = shareOfVoice(OCT);
    for (const key of ['share', 'positiveShare', 'negativeShare'] as const) expect(voice.reduce((s, v) => s + v[key], 0)).toBeCloseTo(1, 6);
  });

  it('las series por día no dibujan un día sin muestra como si fuera 0', () => {
    const weak: OpinionFilter = { range: { from: '2026-10-25', to: '2026-10-29' }, sources: ['youtube'] };
    for (const p of sentimentSeries(weak, false)) expect(p.positive === null || p.n >= 20).toBe(true);
  });

  it('los hallazgos nunca declaran confianza alta (el sentimiento es una estimación)', () => {
    for (const i of opinionInsights(OCT)) expect(i.confidence).not.toBe('high');
    expect(opinionInsights(OCT).some((i) => i.id === 'worse-verification')).toBe(true);
  });

  it('la cola de respuesta cuenta solo lo que pide respuesta', () => {
    const stats = responseStats(OCT);
    expect(stats.pending).toBeLessThanOrEqual(stats.needing);
    expect(stats.rate).not.toBeNull();
  });
});
