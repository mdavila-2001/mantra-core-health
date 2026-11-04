import { describe, expect, it } from 'vitest';

import { buildAlerts } from './alerts';
import { buildReport, defaultSections, REPORT_AUDIENCES, REPORT_TYPES } from './report';
import type { InsightsFilter } from './insights.types';
import { CHANNELS } from './insights.types';

const FILTER: InsightsFilter = { campaignIds: ['c1'], range: { from: '2026-10-01', to: '2026-10-29' }, grain: 'day', channels: CHANNELS, metric: 'ctr' };

describe('informes y alertas combinadas', () => {
  it('siempre incluye resumen, método y limitaciones, aunque no se elija nada', () => {
    const ids = buildReport({ type: 'executive', audience: 'direction', sections: [] }, FILTER).sections.map((s) => s.id);
    expect(ids).toEqual(['summary', 'method', 'limits']);
  });

  it('la audiencia filtra el contenido propuesto', () => {
    const direction = defaultSections('monthly', 'direction');
    for (const s of direction) expect(REPORT_AUDIENCES.direction.allowed).toContain(s);
    expect(direction).not.toContain('app');
    expect(defaultSections('monthly', 'marketing')).toContain('app');
  });

  it('las cifras del informe son las de los módulos: una sección de KPI no inventa filas', () => {
    const doc = buildReport({ type: 'campaign', audience: 'marketing', sections: ['kpis', 'channels'] }, FILTER);
    const kpis = doc.sections.find((s) => s.id === 'kpis')!;
    expect(kpis.table!.rows.length).toBe(8);
    for (const row of kpis.table!.rows) expect(row.every((c) => c.length > 0)).toBe(true);
    expect(doc.sections.find((s) => s.id === 'channels')!.table!.rows.length).toBeGreaterThan(3);
  });

  it('un informe declara que los datos son de demostración', () => {
    const doc = buildReport({ type: 'executive', audience: 'direction', sections: ['kpis'] }, FILTER);
    expect(doc.sections.find((s) => s.id === 'method')!.note).toContain('sintéticos');
  });

  it('el centro de alertas reúne campañas y opinión, y la brecha rural es oportunidad', () => {
    const alerts = buildAlerts();
    expect(alerts.some((a) => a.module === 'campaigns')).toBe(true);
    expect(alerts.some((a) => a.id === 'sent-verification' && a.severity !== 'opportunity')).toBe(true);
    expect(alerts.find((a) => a.id === 'gap-rural')?.severity).toBe('opportunity');
    expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
  });

  it('toda alerta lleva causa como hipótesis y evidencia', () => {
    for (const a of buildAlerts()) {
      expect(a.cause.toLowerCase()).toContain('hipótesis');
      expect(a.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe('informes para más lectores', () => {
  const filter: InsightsFilter = { campaignIds: ['c1', 'c2'], range: { from: '2026-10-01', to: '2026-10-29' }, grain: 'day', channels: CHANNELS, metric: 'ctr' };

  it('hay siete tipos y cinco audiencias', () => {
    expect(Object.keys(REPORT_TYPES)).toHaveLength(7);
    expect(Object.keys(REPORT_AUDIENCES)).toHaveLength(5);
  });

  it('NEGATIVO: para un cliente o un aliado no aparece ningún costo ni sección interna', () => {
    for (const audience of ['client', 'partner'] as const) {
      const doc = buildReport({ type: 'monthly', audience, sections: ['kpis', 'channels', 'alerts', 'next', 'recommendations'] }, filter);
      const text = JSON.stringify(doc);
      expect(text).not.toMatch(/Inversión|CPA|CAC|ROAS|Costo/i);
      const ids = doc.sections.map((s) => s.id);
      expect(ids).not.toContain('alerts');
      expect(ids).not.toContain('next');
      expect(ids).not.toContain('recommendations');
    }
  });

  it('un lector interno sí ve los costos', () => {
    const doc = buildReport({ type: 'campaign', audience: 'marketing', sections: ['kpis', 'channels'] }, filter);
    expect(JSON.stringify(doc)).toMatch(/Inversión/);
  });

  it('respeta el orden elegido y no repite secciones', () => {
    const doc = buildReport({ type: 'custom', audience: 'marketing', sections: ['opinion', 'kpis', 'opinion'] }, filter);
    const middle = doc.sections.map((s) => s.id).filter((id) => id === 'opinion' || id === 'kpis');
    expect(middle).toEqual(['opinion', 'kpis']);
  });

  it('el título propio reemplaza al de fábrica y las secciones obligatorias no se quitan', () => {
    const doc = buildReport({ type: 'executive', audience: 'direction', sections: [], title: '  Mi informe  ' }, filter);
    expect(doc.title).toBe('Mi informe');
    const ids = doc.sections.map((s) => s.id);
    for (const must of ['summary', 'method', 'limits']) expect(ids).toContain(must);
  });
});
