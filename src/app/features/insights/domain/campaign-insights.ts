import { campaignName } from './campaigns.data';
import { longDate, WEEKDAY_LONG } from './dates';
import { formatChange, formatMoney, formatPercent } from './format';
import { hourlyGrid } from './hourly';
import type { Channel, Confidence, Insight, InsightsFilter } from './insights.types';
import { CHANNEL_LABELS } from './insights.types';
import { breakdown, buildScope, computeKpi, selectFacts } from './kpi';

/* ============================================================================
    Hallazgos del módulo «Resumen de campañas».

    Cada hallazgo separa el DATO OBSERVADO, la INTERPRETACIÓN y la HIPÓTESIS.
    Nada se presenta como conclusión confirmada: un resumen de campañas no puede
    probar causalidad sin un experimento.
    ========================================================================== */

export function confidenceFor(units: number, days: number): { level: Confidence; factors: string[] } {
  const factors = [`${units.toLocaleString('es-BO')} observaciones`, `${days} días con dato`];
  if (units >= 50_000 && days >= 14) return { level: 'high', factors: [...factors, 'muestra amplia y serie larga'] };
  if (units >= 5_000 && days >= 7) return { level: 'medium', factors: [...factors, 'muestra suficiente, serie corta'] };
  return { level: 'low', factors: [...factors, 'muestra o serie insuficiente'] };
}

function trace(filter: InsightsFilter, method: string) {
  const facts = selectFacts(filter);
  const s = buildScope(facts);
  return {
    period: `${longDate(filter.range.from)} — ${longDate(filter.range.to)}`,
    sources: [
      { label: filter.campaignIds.map(campaignName).join(', '), count: facts.length, unit: 'registros diarios' },
      { label: 'Impresiones analizadas', count: s.all.impressions, unit: 'impresiones' },
      { label: 'Clics analizados', count: s.all.clicks, unit: 'clics' },
    ],
    method,
  };
}

export function campaignInsights(filter: InsightsFilter): Insight[] {
  const out: Insight[] = [];
  const facts = selectFacts(filter);
  if (facts.length === 0) return out;
  const scope = buildScope(facts);
  const conf = confidenceFor(scope.all.clicks, scope.days);
  const base = { module: 'campaigns' as const, confidence: conf.level, confidenceFactors: conf.factors };

  // A · eficiencia después del clic: el canal con mejor CTR no siempre convierte mejor.
  const ctr = breakdown(filter, 'channel', 'ctr').filter((r) => r.kpi.value !== null);
  const cvr = new Map(breakdown(filter, 'channel', 'conversionRate').map((r) => [r.key, r.kpi.value]));
  const topCtr = [...ctr].sort((a, b) => (b.kpi.value ?? 0) - (a.kpi.value ?? 0))[0];
  const overallCvr = computeKpi(filter, 'conversionRate').value;
  const topCvr = topCtr ? cvr.get(topCtr.key) : null;
  if (topCtr && topCvr !== null && topCvr !== undefined && overallCvr !== null && topCvr < overallCvr * 0.9) {
    const name = CHANNEL_LABELS[topCtr.key as Channel];
    out.push({
      ...base,
      id: `eff-${topCtr.key}`,
      title: `${name} atrae más clics, pero convierte menos que el promedio`,
      statements: [
        { level: 'observed', text: `${name} tiene el CTR más alto (${formatPercent(topCtr.kpi.value ?? 0)}) y una tasa de conversión de ${formatPercent(topCvr)}, frente a ${formatPercent(overallCvr)} del total.` },
        { level: 'interpretation', text: 'El volumen de clics no se traduce en registros verificados en la misma proporción: se pierde eficiencia después del clic.' },
        { level: 'hypothesis', text: 'Es posible que el canal atraiga curiosidad más que intención de registrarse. Falta comparar la calidad de los registros por origen.' },
      ],
      trace: trace(filter, 'Comparación de CTR y tasa de conversión calculadas desde sumas por canal.'),
      action: { label: 'Investigar el embudo', module: 'funnel', query: { c: filter.campaignIds.join(',') } },
    });
  }

  // B · mejor franja horaria.
  const grid = hourlyGrid(filter, 'ctr');
  if (grid.best) {
    const { weekday, hour, value } = grid.best;
    const overall = computeKpi(filter, 'ctr').value;
    out.push({
      ...base,
      id: 'timing',
      title: `El CTR es más alto los ${WEEKDAY_LONG[weekday]} a las ${String(hour).padStart(2, '0')}:00`,
      statements: [
        { level: 'observed', text: `Esa franja alcanza ${formatPercent(value)} de CTR${overall ? `, ${formatChange((value - overall) / overall)} frente al promedio` : ''}.` },
        { level: 'interpretation', text: 'La respuesta a los anuncios no es uniforme a lo largo del día: concentrar entrega donde la intención es mayor mejora el costo por clic.' },
        { level: 'hypothesis', text: 'La hora puede estar reflejando el momento libre del público médico y no el efecto del anuncio. Pruebe un horario distinto antes de reasignar presupuesto.' },
      ],
      trace: trace(filter, 'Reparto horario de los hechos diarios con perfiles de actividad por canal (prototipo).'),
      action: { label: 'Ver el rendimiento por horario', module: 'campaigns', query: { m: 'ctr' } },
    });
  }

  // C · reasignación de presupuesto por ROAS.
  const roas = breakdown(filter, 'channel', 'roas').filter((r) => r.kpi.value !== null);
  if (roas.length >= 2) {
    const sorted = [...roas].sort((a, b) => (b.kpi.value ?? 0) - (a.kpi.value ?? 0));
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    const spendOf = (key: string) => computeKpi({ ...filter, channels: [key as Channel] }, 'spend').value ?? 0;
    out.push({
      ...base,
      id: 'allocation',
      title: `${CHANNEL_LABELS[best.key as Channel]} retorna ${(((best.kpi.value ?? 0) / (worst.kpi.value ?? 1)) * 100 - 100).toFixed(0)} % más que ${CHANNEL_LABELS[worst.key as Channel]}`,
      statements: [
        { level: 'observed', text: `ROAS de ${CHANNEL_LABELS[best.key as Channel]}: ${(best.kpi.value ?? 0).toFixed(2).replace('.', ',')}× con ${formatMoney(spendOf(best.key))} invertidos; ${CHANNEL_LABELS[worst.key as Channel]}: ${(worst.kpi.value ?? 0).toFixed(2).replace('.', ',')}× con ${formatMoney(spendOf(worst.key))}.` },
        { level: 'interpretation', text: 'Una parte del presupuesto está en el canal que menos retorna por cada boliviano.' },
        { level: 'hypothesis', text: 'Mover inversión hacia el canal con mayor ROAS podría mejorar el retorno total, pero el retorno marginal suele caer al escalar: pruebe con un incremento pequeño.' },
      ],
      trace: trace(filter, 'ROAS por canal = ingresos atribuidos ÷ inversión de medios, desde sumas.'),
      action: { label: 'Comparar por canal', module: 'campaigns', query: { m: 'roas' } },
    });
  }
  return out;
}
