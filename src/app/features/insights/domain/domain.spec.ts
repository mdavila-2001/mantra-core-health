import { detectAllShifts, detectOnboardingShift, isSignal } from './anomalies';
import { assess, judge, resolveBenchmarks } from './benchmarks';
import { buildCohorts, isObserved, retentionAtWeek } from './cohorts';
import { distribute, hourlyGrid } from './hourly';
import type { InsightsFilter, MetricId } from './insights.types';
import { CHANNELS, METRIC_IDS } from './insights.types';
import { breakdown, computeKpi, estimateUniqueReach, selectFacts, timeSeries } from './kpi';
import { ALL_METRICS, isCompleteDefinition } from './metric-catalog';
import { chartOptionsFor, recommendVisualization } from './viz-recommender';
import { allFacts } from './facts-source';

const REG: InsightsFilter = {
  campaignIds: ['c1'],
  range: { from: '2026-10-01', to: '2026-10-29' },
  grain: 'day',
  channels: CHANNELS,
  metric: 'ctr',
};

describe('catálogo de métricas', () => {
  it('cada métrica responde las columnas del principio de gerencia', () => {
    for (const def of ALL_METRICS) expect(isCompleteDefinition(def), def.id).toBe(true);
    expect(ALL_METRICS).toHaveLength(METRIC_IDS.length);
  });
});

describe('hechos sintéticos', () => {
  it('son deterministas: dos lecturas dan lo mismo', () => {
    const a = allFacts();
    const b = allFacts();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(500);
  });

  it('respetan el embudo: cada etapa no supera a la anterior', () => {
    for (const f of allFacts()) {
      expect(f.clicks).toBeLessThanOrEqual(f.impressions);
      expect(f.visits).toBeLessThanOrEqual(f.clicks);
      expect(f.leads).toBeLessThanOrEqual(f.visits);
      expect(f.registrations).toBeLessThanOrEqual(f.leads);
      expect(f.activations).toBeLessThanOrEqual(f.registrations);
      expect(f.firstUses).toBeLessThanOrEqual(f.activations);
      expect(f.conversions).toBeLessThanOrEqual(f.firstUses);
    }
  });

  it('los canales propios no tienen inversión', () => {
    for (const f of allFacts().filter((x) => ['web', 'app', 'email'].includes(x.channel))) expect(f.spendCents).toBe(0);
  });
});

describe('cálculo de KPI', () => {
  it('los conteos son aditivos: la suma por canal es el total', () => {
    const total = computeKpi(REG, 'conversions').value ?? 0;
    const byChannel = breakdown(REG, 'channel', 'conversions').reduce((s, r) => s + (r.kpi.value ?? 0), 0);
    expect(byChannel).toBe(total);
  });

  it('una tasa sale de sumas, no del promedio de tasas diarias', () => {
    const facts = selectFacts(REG);
    const clicks = facts.reduce((s, f) => s + f.clicks, 0);
    const impressions = facts.reduce((s, f) => s + f.impressions, 0);
    const kpi = computeKpi(REG, 'ctr');
    expect(kpi.value).toBeCloseTo(clicks / impressions, 12);
    expect(kpi.numerator).toBe(clicks);
    expect(kpi.denominator).toBe(impressions);
  });

  it('un periodo sin datos devuelve null con motivo, nunca cero', () => {
    const empty: InsightsFilter = { ...REG, range: { from: '2026-01-01', to: '2026-01-31' } };
    for (const metric of METRIC_IDS) {
      const kpi = computeKpi(empty, metric);
      expect(kpi.value, metric).toBeNull();
      expect(kpi.gap?.reason, metric).toBe('no-data');
    }
  });

  it('el costo de medios no aplica a canales propios', () => {
    const owned: InsightsFilter = { ...REG, channels: ['web', 'app', 'email'] };
    for (const metric of ['cpm', 'cpc', 'cpa', 'cac', 'roas', 'frequency'] as MetricId[]) {
      const kpi = computeKpi(owned, metric);
      expect(kpi.value, metric).toBeNull();
    }
    expect(computeKpi(owned, 'spend').gap?.reason).toBe('not-applicable');
  });

  it('las reproducciones solo existen en canales de vídeo', () => {
    const search: InsightsFilter = { ...REG, channels: ['google', 'web'] };
    expect(computeKpi(search, 'videoViews').gap?.reason).toBe('not-applicable');
    expect(computeKpi(REG, 'videoViews').value).toBeGreaterThan(0);
  });

  it('una tasa con base menor al mínimo no se publica', () => {
    const tiny: InsightsFilter = { ...REG, channels: ['email'], range: { from: '2026-10-01', to: '2026-10-01' } };
    const kpi = computeKpi(tiny, 'ctr');
    expect(kpi.value).toBeNull();
    expect(kpi.gap?.reason).toBe('insufficient-sample');
  });

  it('el alcance es único y estimado: menor que la suma de los alcances diarios', () => {
    const facts = selectFacts(REG);
    const summed = facts.reduce((s, f) => s + f.reach, 0);
    const unique = estimateUniqueReach(facts);
    expect(unique).toBeGreaterThan(0);
    expect(unique).toBeLessThan(summed);
    const kpi = computeKpi(REG, 'reach');
    expect(kpi.estimated).toBe(true);
    expect(kpi.value).toBe(unique);
  });

  it('la serie semanal calcula cada cubeta desde sus sumas', () => {
    const weekly = timeSeries({ ...REG, grain: 'week' }, 'ctr');
    expect(weekly.length).toBeGreaterThanOrEqual(4);
    const firstWeek = weekly[0];
    expect(firstWeek?.kpi.denominator).toBeGreaterThan(0);
  });
});

describe('cohortes', () => {
  it('las semanas que aún no terminan son null, no cero', () => {
    const cohorts = buildCohorts(selectFacts(REG));
    expect(cohorts.length).toBeGreaterThan(0);
    const inProgress = cohorts[cohorts.length - 1];
    const closed = cohorts[cohorts.length - 2];
    // La semana del 26 de oct. no ha terminado el 30: ni siquiera su semana 0 se puede medir.
    expect(inProgress?.weekStart).toBe('2026-10-26');
    expect(inProgress?.retention[0]).toBeNull();
    expect(closed?.retention[0]).not.toBeNull();
    expect(closed?.retention[8]).toBeNull();
    expect(isObserved('2026-10-26', 1)).toBe(false);
  });

  it('la retención a 30 días de una campaña de octubre aún no se puede calcular', () => {
    const kpi = computeKpi(REG, 'retention');
    expect(kpi.value).toBeNull();
    expect(kpi.gap?.reason).toBe('insufficient-sample');
    const september = computeKpi({ ...REG, campaignIds: ['c2'], range: { from: '2026-09-01', to: '2026-09-30' } }, 'retention');
    expect(september.value).not.toBeNull();
  });

  it('retención a 7 días existe para octubre', () => {
    expect(retentionAtWeek(selectFacts(REG), 1)?.rate).toBeGreaterThan(0.5);
  });
});

describe('reparto por hora', () => {
  it('distribute conserva el total exacto', () => {
    const weights = Array.from({ length: 24 }, (_, i) => i + 1);
    const total = weights.reduce((s, v) => s + v, 0);
    const parts = distribute(12_345, weights.map((w) => w / total));
    expect(parts.reduce((s, v) => s + v, 0)).toBe(12_345);
  });

  it('la suma de las 168 celdas de impresiones es el total del periodo', () => {
    const grid = hourlyGrid(REG, 'impressions');
    expect(grid.cells).toHaveLength(168);
    const sum = grid.cells.reduce((s, c) => s + (c.kpi.value ?? 0), 0);
    expect(sum).toBe(computeKpi(REG, 'impressions').value);
  });

  it('encuentra una mejor franja horaria', () => {
    const grid = hourlyGrid(REG, 'ctr');
    expect(grid.best).not.toBeNull();
  });
});

describe('recomendador de visualización', () => {
  it('la evolución de una tasa o costo se recomienda como línea con razón escrita', () => {
    for (const metric of ['ctr', 'cpa', 'cpc', 'roas', 'reach'] as MetricId[]) {
      const rec = recommendVisualization(metric);
      expect(rec.recommended, metric).toBe('line');
      expect(rec.reason.length).toBeGreaterThan(20);
    }
  });

  it('comparar muchos elementos usa barras horizontales; pocos, barras', () => {
    expect(recommendVisualization('ctr', { intent: 'compare', categories: 8 }).recommended).toBe('hbar');
    expect(recommendVisualization('ctr', { intent: 'compare', categories: 4 }).recommended).toBe('bar');
    expect(recommendVisualization('cpc', { intent: 'compare', categories: 4 }).recommended).toBe('hbar');
  });

  it('la retención se recomienda como cohortes, nunca como un número', () => {
    expect(recommendVisualization('retention').recommended).toBe('cohort');
  });

  it('cruzar dos dimensiones recomienda mapa de calor; relacionar dos variables, dispersión', () => {
    expect(recommendVisualization('ctr', { intent: 'timing' }).recommended).toBe('heatmap');
    expect(recommendVisualization('ctr', { intent: 'relationship' }).recommended).toBe('scatter');
  });

  it('nunca ofrece un gráfico circular', () => {
    for (const metric of METRIC_IDS) {
      expect(chartOptionsFor(metric).map((o) => String(o.chart))).not.toContain('pie');
    }
  });

  it('marca como no disponible lo que no responde la pregunta', () => {
    const cpa = chartOptionsFor('cpa');
    expect(cpa.find((o) => o.chart === 'heatmap')?.available).toBe(false);
    expect(cpa.find((o) => o.chart === 'area')?.available).toBe(false);
    expect(chartOptionsFor('conversions').find((o) => o.chart === 'area')?.available).toBe(true);
    expect(chartOptionsFor('retention').find((o) => o.chart === 'cohort')?.available).toBe(true);
    expect(chartOptionsFor('ctr')[0]?.recommended).toBe(true);
  });

  it('avisa de una serie demasiado corta', () => {
    expect(recommendVisualization('ctr', { points: 4 }).caution).toContain('4 puntos');
  });
});

describe('benchmarks y estados', () => {
  it('el benchmark sectorial nunca se presenta como verificado', () => {
    const set = resolveBenchmarks(REG, 'ctr');
    expect(set.sector?.verified).toBe(false);
    expect(set.campaign?.value).toBe(0.025);
    expect(set.historical?.verified).toBe(true);
  });

  it('juzga respetando el sentido: menos costo es mejor, más CTR es mejor', () => {
    const ctr = computeKpi(REG, 'ctr');
    const cpa = computeKpi(REG, 'cpa');
    const target = (value: number) => ({ source: 'campaign' as const, value, note: 'x', verified: true });
    expect(judge(ctr, target((ctr.value ?? 0) * 0.8), null, REG).status).toBe('optimal');
    expect(judge(ctr, target((ctr.value ?? 0) * 1.5), null, REG).status).toBe('critical');
    expect(judge(cpa, target((cpa.value ?? 0) * 1.3), null, REG).status).toBe('optimal');
    expect(judge(cpa, target((cpa.value ?? 0) * 0.6), null, REG).status).toBe('critical');
  });

  it('sin referencia o sin dato no fuerza una conclusión', () => {
    const none = computeKpi({ ...REG, range: { from: '2026-01-01', to: '2026-01-31' } }, 'ctr');
    expect(judge(none, null, null, REG).status).toBe('insufficient');
    expect(judge(computeKpi(REG, 'clicks'), null, null, REG, null).status).toBe('insufficient');
  });

  it('los volúmenes se juzgan contra su objetivo, no contra otras campañas', () => {
    expect(assess(REG, 'conversions').status).not.toBe('insufficient');
    expect(assess(REG, 'impressions').benchmark).toBeNull();
  });

  it('la frecuencia tiene umbrales propios', () => {
    const f = computeKpi(REG, 'frequency');
    expect(['optimal', 'acceptable']).toContain(judge(f, null, null, REG).status);
  });
});

describe('detección de cambios', () => {
  const shifts = detectAllShifts();

  it('encuentra el encarecimiento de Facebook tras el cambio de oferta de «Ahorro en medicamentos»', () => {
    const cpm = shifts.find((s) => s.campaignId === 'c3' && s.channel === 'facebook' && s.metric === 'cpm');
    expect(cpm?.harmful).toBe(true);
    expect(cpm?.change).toBeGreaterThan(0.15);
  });

  it('encuentra el salto de CTR de TikTok como cambio no dañino', () => {
    const tiktok = shifts.find((s) => s.channel === 'tiktok' && s.metric === 'ctr' && s.campaignId === 'c2');
    expect(tiktok?.change).toBeGreaterThan(0.3);
    expect(tiktok?.harmful).toBe(false);
  });

  it('encuentra el aumento del abandono del onboarding', () => {
    const onboarding = detectOnboardingShift('c1', '2026-10-29');
    expect(onboarding?.change).toBeGreaterThan(0.1);
  });

  it('un cambio pequeño o dentro del ruido no es señal', () => {
    expect(isSignal({ ...shifts[0]!, change: 0.05, z: 5 })).toBe(false);
    expect(isSignal({ ...shifts[0]!, change: 0.4, z: 0.5 })).toBe(false);
  });
});
