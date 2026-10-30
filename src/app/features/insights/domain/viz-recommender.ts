import type { AnalysisIntent, ChartType, MetricId, VizRecommendation } from './insights.types';
import { CHART_LABELS } from './insights.types';
import { METRIC_CATALOG } from './metric-catalog';

/* ============================================================================
    Recomendador de visualización.

    Principio: el tipo de gráfico lo decide la PREGUNTA estadística, no el gusto.
        métrica + intención + contexto  →  gráfico recomendado + razón escrita

    La recomendación es la opción por defecto, el usuario puede cambiarla, y
    cuando elige algo que no responde bien su pregunta el sistema se lo dice en
    lugar de prohibírselo. No se ofrece gráfico circular ni de anillo: los
    ángulos se comparan mal, y todo lo que el circular haría lo hace mejor una
    barra apilada al 100 %.
    ========================================================================== */

export interface VizContext {
  readonly intent?: AnalysisIntent;
  /** Puntos de la serie temporal (para avisar de series cortas). */
  readonly points?: number;
  /** Categorías a comparar (canales o campañas). */
  readonly categories?: number;
  /** Si el interés es la proporción y no el volumen absoluto. */
  readonly proportion?: boolean;
  readonly grain?: 'day' | 'week' | 'month';
  readonly rangeDays?: number;
}

/** Métricas que se pueden repartir por hora (todas las que salen de sumas simples de un día). */
const HOURLY: ReadonlySet<MetricId> = new Set([
  'impressions',
  'clicks',
  'ctr',
  'engagement',
  'engagementRate',
  'leads',
  'registrations',
  'conversions',
  'conversionRate',
  'cpc',
  'cpm',
  'videoViews',
]);

const ADDITIVE: ReadonlySet<MetricId> = new Set([
  'impressions',
  'clicks',
  'engagement',
  'videoViews',
  'leads',
  'registrations',
  'conversions',
  'spend',
  'revenue',
]);

const COMPARE_HORIZONTAL: ReadonlySet<MetricId> = new Set(['cpc', 'engagementRate', 'cac', 'cpa']);

const INTENT_OF_CHART: Readonly<Record<ChartType, AnalysisIntent>> = {
  line: 'trend',
  area: 'trend',
  bar: 'compare',
  hbar: 'compare',
  stacked: 'composition',
  stacked100: 'composition',
  funnel: 'process',
  heatmap: 'timing',
  scatter: 'relationship',
  histogram: 'distribution',
  boxplot: 'distribution',
  cohort: 'retention',
};

export function intentOf(chart: ChartType): AnalysisIntent {
  return INTENT_OF_CHART[chart];
}

function compareChart(metric: MetricId, categories: number): ChartType {
  if (categories > 6) return 'hbar';
  return COMPARE_HORIZONTAL.has(metric) ? 'hbar' : 'bar';
}

/** Recomendación por defecto para una métrica en un contexto. */
export function recommendVisualization(metric: MetricId, context: VizContext = {}): VizRecommendation {
  const def = METRIC_CATALOG[metric];
  const intent: AnalysisIntent = context.intent ?? (def.kind === 'curve' ? 'retention' : 'trend');
  const categories = context.categories ?? 0;
  const label = def.label;

  switch (intent) {
    case 'trend': {
      const volumeLike = metric === 'impressions' || metric === 'spend';
      const caution = trendCaution(context);
      return {
        recommended: 'line',
        alternatives: volumeLike ? ['area', 'bar'] : ['bar', 'area'],
        reason: `«${label}» se analiza como serie temporal: la línea muestra tendencia, variabilidad y cambios, y deja trazar benchmark, objetivo y umbrales sobre el mismo eje.`,
        caution,
      };
    }
    case 'compare': {
      const chart = compareChart(metric, categories);
      return {
        recommended: chart,
        alternatives: chart === 'hbar' ? ['bar'] : ['hbar'],
        reason:
          chart === 'hbar'
            ? `Para comparar «${label}» entre ${categories || 'varios'} elementos, las barras horizontales ordenadas dejan leer el ranking y los nombres completos.`
            : `Para comparar «${label}» entre pocos elementos, las barras dan una lectura directa de quién rinde mejor. El eje parte de cero.`,
        caution: def.kind === 'rate' ? 'Compare solo elementos con base similar: una tasa sobre pocas impresiones no es comparable.' : null,
      };
    }
    case 'composition':
      return {
        recommended: context.proportion ? 'stacked100' : 'stacked',
        alternatives: context.proportion ? ['stacked'] : ['stacked100'],
        reason: context.proportion
          ? 'La barra apilada al 100 % muestra qué parte del total aporta cada elemento.'
          : 'La barra apilada muestra el volumen absoluto y cómo se compone.',
        caution: 'No se ofrece gráfico circular: las proporciones se leen mejor en barras apiladas.',
      };
    case 'distribution':
      return {
        recommended: categories > 1 ? 'boxplot' : 'histogram',
        alternatives: categories > 1 ? ['histogram'] : ['boxplot'],
        reason:
          categories > 1
            ? 'La caja resume mediana, dispersión y valores atípicos de cada grupo; las barras esconden la variabilidad.'
            : 'El histograma muestra cómo se reparten los valores diarios, algo que un promedio oculta.',
        caution: null,
      };
    case 'relationship':
      return {
        recommended: 'scatter',
        alternatives: [],
        reason: 'La dispersión es el gráfico que responde si dos variables se relacionan; deja ver grupos y valores atípicos. La línea de tendencia solo se dibuja si la relación es estadísticamente sostenible.',
        caution: 'Correlación no es causalidad: la relación observada no prueba que una variable provoque la otra.',
      };
    case 'timing':
      return {
        recommended: 'heatmap',
        alternatives: ['bar', 'line'],
        reason: 'El mapa de calor cruza dos dimensiones (día y hora) con la intensidad de «' + label + '» y muestra dónde se concentra el rendimiento.',
        caution: null,
      };
    case 'process':
      return {
        recommended: 'funnel',
        alternatives: ['bar'],
        reason: 'Una conversión por etapas se muestra como embudo: se ve en qué paso se pierde cada persona. Nunca como un círculo.',
        caution: null,
      };
    case 'retention':
      return {
        recommended: 'cohort',
        alternatives: ['line'],
        reason: 'La retención es una curva por cohorte: un mapa de cohortes compara cómo se comportan los usuarios según su semana de llegada. Una tarjeta con un porcentaje la reduciría a una foto.',
        caution: null,
      };
  }
}

function trendCaution(context: VizContext): string | null {
  if (context.points !== undefined && context.points < 7) {
    return `La serie tiene solo ${context.points} puntos: la tendencia puede ser ruido. Amplíe el periodo antes de concluir.`;
  }
  if (context.grain === 'day' && (context.rangeDays ?? 0) > 90) {
    return 'Más de 90 puntos diarios dificultan la lectura: considere agrupar por semana.';
  }
  return null;
}

export interface ChartOption {
  readonly chart: ChartType;
  readonly label: string;
  readonly intent: AnalysisIntent;
  readonly available: boolean;
  readonly recommended: boolean;
  /** Por qué no está disponible, o cuándo conviene. */
  readonly note: string;
}

/** Todas las visualizaciones del selector, con la recomendada primero. */
export function chartOptionsFor(metric: MetricId, context: VizContext = {}): ChartOption[] {
  const def = METRIC_CATALOG[metric];
  const rec = recommendVisualization(metric, context);
  const additive = ADDITIVE.has(metric);
  const hourly = HOURLY.has(metric);
  const isCurve = def.kind === 'curve';

  const rules: Record<ChartType, { available: boolean; note: string }> = {
    line: { available: !isCurve, note: 'Evolución en el tiempo.' },
    area: { available: additive, note: additive ? 'Volumen y acumulado.' : 'El área solo tiene sentido para volúmenes sumables.' },
    bar: { available: true, note: 'Comparar canales o campañas.' },
    hbar: { available: true, note: 'Ranking de muchos elementos.' },
    stacked: { available: additive, note: additive ? 'Composición del volumen por canal.' : 'Solo para métricas que se suman.' },
    stacked100: { available: additive, note: additive ? 'Proporción que aporta cada canal.' : 'Solo para métricas que se suman.' },
    funnel: { available: false, note: 'Es el gráfico del módulo Embudo y Experiencia del Paciente.' },
    heatmap: { available: hourly, note: hourly ? 'Día de la semana por hora.' : 'Esta métrica no se mide por hora.' },
    scatter: { available: !isCurve, note: 'Relación con otra métrica.' },
    histogram: { available: !isCurve, note: 'Cómo se distribuyen los valores diarios.' },
    boxplot: { available: !isCurve, note: 'Variabilidad y atípicos por canal.' },
    cohort: { available: isCurve, note: isCurve ? 'Retención por semana de llegada.' : 'Solo para retención.' },
  };

  const order: ChartType[] = [rec.recommended, ...rec.alternatives, 'line', 'area', 'bar', 'hbar', 'heatmap', 'scatter', 'histogram', 'boxplot', 'stacked', 'stacked100', 'cohort'];
  const seen = new Set<ChartType>();
  const out: ChartOption[] = [];
  for (const chart of order) {
    if (seen.has(chart) || chart === 'funnel') continue;
    seen.add(chart);
    const rule = rules[chart];
    out.push({
      chart,
      label: CHART_LABELS[chart],
      intent: intentOf(chart),
      available: rule.available,
      recommended: chart === rec.recommended,
      note: rule.note,
    });
  }
  return out;
}

/** Aviso cuando la persona elige un gráfico que no responde bien su pregunta. */
export function manualChoiceWarning(metric: MetricId, chart: ChartType): string | null {
  const option = chartOptionsFor(metric).find((o) => o.chart === chart);
  return option && !option.available ? option.note : null;
}
