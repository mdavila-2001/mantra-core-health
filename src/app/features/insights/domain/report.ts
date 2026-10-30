import { buildAlerts } from './alerts';
import { summarize as summarizeUsage } from './app-usage';
import { assess } from './benchmarks';
import { campaignInsights } from './campaign-insights';
import { CAMPAIGN_BY_ID, SYNTHETIC_NOTICE } from './campaigns.data';
import { longDate, PROTOTYPE_TODAY } from './dates';
import { formatChange, formatInt, formatPercent, formatValue } from './format';
import { acquisitionFunnel } from './funnel';
import type { InsightsFilter, MetricId } from './insights.types';
import { CHANNEL_LABELS, HEALTH_LABELS, type Channel } from './insights.types';
import { breakdown } from './kpi';
import { METRIC_CATALOG } from './metric-catalog';
import { IMPACT_LABELS, OBSERVATORY } from './observatory';
import { formatNet, opinionInsights, responseStats, select as opinionSelect, summarize as summarizeOpinion, topicTable, type OpinionFilter } from './opinion';
import { SOURCES } from './opinion.data';
import { PLATFORMS, PLATFORM_NAMES, socialKpi } from './social';

/* ============================================================================
    Generador de informes.

    Un informe no inventa nada: cada sección se calcula con las mismas funciones
    que las pantallas, así que una cifra del informe es la cifra del módulo. Las
    secciones obligatorias (portada, resumen, método y limitaciones) no se
    pueden quitar: un informe sin sus límites se lee como más cierto de lo que es.
    ========================================================================== */

export type ReportType = 'executive' | 'campaign' | 'monthly';
export type ReportAudience = 'direction' | 'marketing' | 'product';
export type OptionalSection = 'kpis' | 'channels' | 'funnel' | 'app' | 'social' | 'opinion' | 'observatory' | 'alerts' | 'recommendations';

export const REPORT_TYPES: Readonly<Record<ReportType, { label: string; description: string; sections: readonly OptionalSection[] }>> = {
  executive: { label: 'Ejecutivo', description: 'Una página de lectura rápida para decidir.', sections: ['kpis', 'alerts', 'recommendations', 'opinion'] },
  campaign: { label: 'De campaña', description: 'Resultados, canales y embudo de las campañas elegidas.', sections: ['kpis', 'channels', 'funnel', 'alerts', 'recommendations'] },
  monthly: { label: 'Mensual completo', description: 'Todos los módulos del periodo.', sections: ['kpis', 'channels', 'funnel', 'app', 'social', 'opinion', 'observatory', 'alerts', 'recommendations'] },
};

export const REPORT_AUDIENCES: Readonly<Record<ReportAudience, { label: string; allowed: readonly OptionalSection[] }>> = {
  direction: { label: 'Dirección general', allowed: ['kpis', 'opinion', 'observatory', 'alerts', 'recommendations'] },
  marketing: { label: 'Equipo de marketing', allowed: ['kpis', 'channels', 'funnel', 'app', 'social', 'opinion', 'observatory', 'alerts', 'recommendations'] },
  product: { label: 'Producto y tecnología', allowed: ['funnel', 'app', 'opinion', 'observatory', 'alerts', 'recommendations'] },
};

export const SECTION_LABELS: Readonly<Record<OptionalSection, string>> = {
  kpis: 'Indicadores principales',
  channels: 'Resultados por canal',
  funnel: 'Embudo de adquisición',
  app: 'Uso de la app',
  social: 'Redes sociales',
  opinion: 'Opinión pública',
  observatory: 'Observatorio de salud',
  alerts: 'Alertas abiertas',
  recommendations: 'Hallazgos y recomendaciones',
};

export const OPTIONAL_SECTIONS = Object.keys(SECTION_LABELS) as OptionalSection[];

export function defaultSections(type: ReportType, audience: ReportAudience): OptionalSection[] {
  return REPORT_TYPES[type].sections.filter((s) => REPORT_AUDIENCES[audience].allowed.includes(s));
}

export interface ReportSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly bullets: readonly string[];
  readonly table: { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] } | null;
  readonly note: string | null;
}

export interface ReportConfig {
  readonly type: ReportType;
  readonly audience: ReportAudience;
  readonly sections: readonly OptionalSection[];
}

export interface ReportDoc {
  readonly title: string;
  readonly subtitle: string;
  readonly generatedOn: string;
  readonly sections: readonly ReportSection[];
}

const section = (id: string, title: string, parts: Partial<Omit<ReportSection, 'id' | 'title'>> = {}): ReportSection => ({
  id, title, paragraphs: parts.paragraphs ?? [], bullets: parts.bullets ?? [], table: parts.table ?? null, note: parts.note ?? null,
});

const KPI_ROWS: readonly MetricId[] = ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpa', 'roas', 'retention'];

function kpiSection(filter: InsightsFilter): ReportSection {
  const rows = KPI_ROWS.map((m) => {
    const a = assess(filter, m);
    const def = METRIC_CATALOG[m];
    return [def.label, formatValue(a.kpi.value, def.unit), a.changeVsPrevious === null ? '—' : formatChange(a.changeVsPrevious), a.target ? formatValue(a.target.value, def.unit) : '—', HEALTH_LABELS[a.status]];
  });
  return section('kpis', 'Indicadores principales', { table: { columns: ['Indicador', 'Valor', 'Vs. periodo anterior', 'Meta', 'Estado'], rows }, note: 'Una celda «Sin dato» no es cero: significa que la muestra no alcanza o el dato no existe.' });
}

function channelSection(filter: InsightsFilter): ReportSection {
  const metrics: MetricId[] = ['spend', 'ctr', 'conversions', 'cpa', 'roas'];
  const tables = metrics.map((m) => new Map(breakdown(filter, 'channel', m).map((r) => [r.key, r.kpi.value])));
  const keys = [...tables[0]!.keys()];
  const rows = keys.map((k) => [CHANNEL_LABELS[k as Channel] ?? k, ...metrics.map((m, i) => formatValue(tables[i]!.get(k) ?? null, METRIC_CATALOG[m].unit))]);
  return section('channels', 'Resultados por canal', { table: { columns: ['Canal', ...metrics.map((m) => METRIC_CATALOG[m].label)], rows }, note: 'Las tasas se calculan desde sumas, no promediando porcentajes.' });
}

function funnelSection(filter: InsightsFilter): ReportSection {
  const f = acquisitionFunnel(filter);
  const rows = f.stages.map((s, i) => [s.label, formatInt(s.value), i === 0 || !s.fromLabel ? '—' : formatPercent(s.value / Math.max(1, f.stages[i - 1]!.value))]);
  return section('funnel', 'Embudo de adquisición', {
    table: { columns: ['Etapa', 'Personas', 'De la etapa anterior'], rows },
    paragraphs: f.worst ? [`La mayor pérdida frente al benchmark histórico está en «${f.worst.label}» (${formatChange(f.worst.gap)}).`] : ['Ninguna etapa se aleja más de un 5 % de su benchmark histórico.'],
  });
}

function appSection(filter: InsightsFilter): ReportSection {
  const u = summarizeUsage(filter.range, 'all');
  if (!u) return section('app', 'Uso de la app', { paragraphs: ['No hay datos de uso en este periodo.'] });
  return section('app', 'Uso de la app', { table: { columns: ['Indicador', 'Valor'], rows: [['Usuarios activos por día (DAU)', formatInt(u.dau)], ['Usuarios activos por mes (MAU)', formatInt(u.mau)], ['Adherencia (DAU ÷ MAU)', formatPercent(u.stickiness)], ['Duración de sesión', `${u.avgMinutes.toFixed(1).replace('.', ',')} min`]] } });
}

function socialSection(filter: InsightsFilter): ReportSection {
  const rows = PLATFORMS.map((p) => { const k = socialKpi(p, 'er', filter.range); return [PLATFORM_NAMES[p], formatValue(k.value, 'percent'), k.changeVsPrevious === null ? '—' : formatChange(k.changeVsPrevious), HEALTH_LABELS[k.status]]; });
  return section('social', 'Redes sociales', { table: { columns: ['Plataforma', 'Tasa de interacción', 'Vs. periodo anterior', 'Estado'], rows } });
}

function opinionSection(of: OpinionFilter): ReportSection {
  const s = summarizeOpinion(opinionSelect(of));
  const top = topicTable(of).slice(0, 5);
  const q = responseStats(of);
  return section('opinion', 'Opinión pública', {
    paragraphs: [s.net === null ? 'No hay menciones suficientes para estimar el sentimiento.' : `Sentimiento neto de ${formatNet(s.net)} puntos sobre ${formatInt(s.n)} menciones; ${formatInt(q.pending)} esperan respuesta.`],
    table: { columns: ['Tema', 'Menciones', 'Sentimiento neto'], rows: top.map((t) => [t.label, formatInt(t.volume), formatNet(t.summary.net)]) },
    note: 'El sentimiento es una estimación automática, no una encuesta.',
  });
}

function observatorySection(): ReportSection {
  return section('observatory', 'Observatorio de salud', { bullets: OBSERVATORY.map((o) => `${o.title} — ${IMPACT_LABELS[o.impact]}.`), note: 'Elementos ilustrativos: en producción cada uno cita su fuente oficial.' });
}

function alertsSection(): ReportSection {
  const open = buildAlerts().filter((a) => a.status === 'open');
  return section('alerts', 'Alertas abiertas', { bullets: open.length ? open.map((a) => `${a.title}`) : ['No hay alertas abiertas.'] });
}

function recommendationsSection(filter: InsightsFilter, of: OpinionFilter): ReportSection {
  const items = [...campaignInsights(filter), ...opinionInsights(of)];
  const bullets = items.flatMap((i) => {
    const obs = i.statements.find((s) => s.level === 'observed');
    const hyp = i.statements.find((s) => s.level === 'hypothesis');
    return [`${i.title}. Dato: ${obs?.text ?? '—'} Hipótesis por confirmar: ${hyp?.text ?? '—'}`];
  });
  return section('recommendations', 'Hallazgos y recomendaciones', { bullets: bullets.length ? bullets : ['No hay hallazgos con evidencia suficiente en este periodo.'], note: 'Cada hallazgo separa el dato observado de la hipótesis: ninguna hipótesis es una conclusión confirmada.' });
}

export function buildReport(config: ReportConfig, filter: InsightsFilter): ReportDoc {
  const of: OpinionFilter = { range: filter.range, sources: SOURCES };
  const campaigns = filter.campaignIds.map((id) => CAMPAIGN_BY_ID.get(id)).filter((c) => !!c);
  const open = buildAlerts().filter((a) => a.status === 'open');
  const critical = open.filter((a) => a.severity === 'critical').length;
  const net = summarizeOpinion(opinionSelect(of)).net;
  const spend = assess(filter, 'spend').kpi.value;
  const conv = assess(filter, 'conversions').kpi.value;

  const body: Record<OptionalSection, () => ReportSection> = {
    kpis: () => kpiSection(filter), channels: () => channelSection(filter), funnel: () => funnelSection(filter), app: () => appSection(filter), social: () => socialSection(filter),
    opinion: () => opinionSection(of), observatory: observatorySection, alerts: alertsSection, recommendations: () => recommendationsSection(filter, of),
  };
  const chosen = OPTIONAL_SECTIONS.filter((s) => config.sections.includes(s));

  const sections: ReportSection[] = [
    section('summary', 'Resumen ejecutivo', {
      bullets: [
        `${campaigns.length === 1 ? '1 campaña analizada' : `${campaigns.length} campañas analizadas`}: ${campaigns.map((c) => c!.name).join(', ')}.`,
        spend !== null ? `Inversión de ${formatValue(spend, 'money')} y ${conv !== null ? formatInt(conv) : 'sin dato de'} conversiones.` : 'Sin dato de inversión en el periodo.',
        `${open.length === 1 ? '1 alerta abierta' : `${open.length} alertas abiertas`}, de las cuales ${critical === 1 ? '1 es crítica' : `${critical} son críticas`}.`,
        net === null ? 'Sentimiento sin muestra suficiente.' : `Sentimiento neto de la conversación pública: ${formatNet(net)} puntos.`,
      ],
    }),
    ...chosen.map((s) => body[s]()),
    section('method', 'Método y fuentes', {
      paragraphs: ['Las cifras se calculan desde hechos diarios por campaña y canal. Las tasas salen de sumas de numerador y denominador. Un dato que no se pudo medir se muestra como «Sin dato», nunca como cero.', 'Los estados de salud comparan contra metas y benchmarks históricos del propio sistema; la referencia sectorial se declara no verificada.'],
      note: SYNTHETIC_NOTICE,
    }),
    section('limits', 'Limitaciones', {
      bullets: ['Los datos son de demostración: no corresponden a campañas ni personas reales.', 'El sentimiento lo estima un clasificador automático; las redes no son una encuesta.', 'Las asociaciones entre variables no prueban causalidad: toda causa se escribe como hipótesis.'],
    }),
  ];

  return {
    title: `Informe ${REPORT_TYPES[config.type].label.toLowerCase()} de marketing`,
    subtitle: `${longDate(filter.range.from)} — ${longDate(filter.range.to)} · ${REPORT_AUDIENCES[config.audience].label}`,
    generatedOn: longDate(PROTOTYPE_TODAY),
    sections,
  };
}
