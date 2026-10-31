import { describe, expect, it } from 'vitest';

import { buildAlerts } from './alerts';
import { buildReport, defaultSections, REPORT_AUDIENCES } from './report';
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
