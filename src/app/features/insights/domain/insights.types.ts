/* ============================================================================
    AloVida Insights — contratos del dominio.

    Todo lo que muestra la plataforma pasa por estos tipos. Dos reglas que no
    se negocian y que los tipos hacen cumplir:

    1. `null` no es cero. Una cifra que no se puede calcular es `null` con un
       motivo (`KpiGap`), nunca `0`.
    2. Una tasa viaja con su numerador y su denominador, y con el tamaño de
       muestra que la sostiene. Un porcentaje sin base es una opinión.
    ========================================================================== */

import { CHANNELS, type Channel, type DailyFact, PAID_CHANNELS, VIDEO_CHANNELS } from '../../../core/data-access/insights/insights-base';

export { CHANNELS, PAID_CHANNELS, VIDEO_CHANNELS };
export type { Channel, DailyFact };

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  google: 'Google',
  web: 'Web',
  app: 'App',
  email: 'Correo',
};

export type AdditiveField = Exclude<keyof DailyFact, 'date' | 'campaignId' | 'channel' | 'reach'>;

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly audience: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly budgetCents: number;
  readonly status: 'active' | 'ended' | 'planned';
  /** Objetivos propios de la campaña (benchmark de campaña). */
  readonly targets: Readonly<Partial<Record<MetricId, number>>>;
}

/* ---------------------------------------------------------------- métricas */

export const METRIC_IDS = [
  'reach',
  'impressions',
  'frequency',
  'cpm',
  'cpc',
  'ctr',
  'clicks',
  'engagement',
  'engagementRate',
  'videoViews',
  'watchTime',
  'leads',
  'registrations',
  'conversions',
  'conversionRate',
  'cpa',
  'cac',
  'retention',
  'roas',
  'spend',
  'revenue',
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

/** Naturaleza estadística de la métrica: decide qué gráfico la representa bien. */
export type MetricKind = 'volume' | 'rate' | 'cost' | 'ratio' | 'duration' | 'curve';
export type MetricUnit = 'count' | 'percent' | 'money' | 'ratio' | 'seconds' | 'times';

export interface MetricDefinition {
  readonly id: MetricId;
  readonly label: string;
  readonly kind: MetricKind;
  readonly unit: MetricUnit;
  /** Si una cifra más alta es mejor (`up`), peor (`down`) o no tiene sentido juzgarla (`none`). */
  readonly goodWhen: 'up' | 'down' | 'none';
  readonly definition: string;
  readonly decision: string;
  readonly ifUp: string;
  readonly ifDown: string;
  readonly action: string;
  readonly owner: string;
  readonly cadence: 'daily' | 'weekly' | 'monthly';
  /** Canales donde la métrica tiene sentido (`null` = todos). */
  readonly channels: readonly Channel[] | null;
  /** Mínimo de denominador para que la cifra se publique. */
  readonly minSample: number;
}

/* --------------------------------------------------------------------- KPI */

export type GapReason =
  | 'no-data'
  | 'not-applicable'
  | 'insufficient-sample'
  | 'no-spend'
  | 'no-denominator';

export interface KpiGap {
  readonly reason: GapReason;
  readonly message: string;
}

export interface KpiValue {
  readonly metric: MetricId;
  /** `null` = no se pudo calcular; el motivo está en `gap`. */
  readonly value: number | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly gap: KpiGap | null;
  /** Observaciones que sostienen la cifra (días con dato). */
  readonly sampleDays: number;
  /** Marca las cifras estimadas por un modelo (p. ej. alcance único). */
  readonly estimated: boolean;
}

/* ------------------------------------------------------------- benchmarks */

export type BenchmarkSource = 'historical' | 'campaign' | 'strategic' | 'sector' | 'statistical';

export const BENCHMARK_SOURCE_LABELS: Readonly<Record<BenchmarkSource, string>> = {
  historical: 'Histórico interno',
  campaign: 'Objetivo de campaña',
  strategic: 'Objetivo estratégico',
  sector: 'Referencia sectorial (prototipo)',
  statistical: 'Normalidad estadística',
};

export interface Benchmark {
  readonly source: BenchmarkSource;
  readonly value: number;
  /** Texto corto que dice de dónde sale y qué tan firme es. */
  readonly note: string;
  /** `true` solo si proviene de una fuente verificable; en el prototipo ninguno sectorial lo es. */
  readonly verified: boolean;
}

export type HealthStatus = 'optimal' | 'acceptable' | 'alert' | 'critical' | 'insufficient';

export const HEALTH_LABELS: Readonly<Record<HealthStatus, string>> = {
  optimal: 'Óptimo',
  acceptable: 'Aceptable',
  alert: 'Alerta',
  critical: 'Crítico',
  insufficient: 'Sin evidencia suficiente',
};

export interface KpiAssessment {
  readonly kpi: KpiValue;
  readonly benchmark: Benchmark | null;
  readonly target: Benchmark | null;
  readonly previous: number | null;
  /** Variación relativa contra el periodo anterior (fracción, 0.18 = +18 %). */
  readonly changeVsPrevious: number | null;
  /** Variación relativa contra el benchmark. */
  readonly changeVsBenchmark: number | null;
  readonly status: HealthStatus;
  readonly statusReason: string;
}

/* ---------------------------------------------------------- filtros / vista */

export type TimeGrain = 'day' | 'week' | 'month';

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export interface InsightsFilter {
  readonly campaignIds: readonly string[];
  readonly range: DateRange;
  readonly grain: TimeGrain;
  readonly channels: readonly Channel[];
  readonly metric: MetricId;
}

/* ----------------------------------------------------------- visualización */

export type ChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'hbar'
  | 'stacked'
  | 'stacked100'
  | 'funnel'
  | 'heatmap'
  | 'scatter'
  | 'histogram'
  | 'boxplot'
  | 'cohort';

export const CHART_LABELS: Readonly<Record<ChartType, string>> = {
  line: 'Línea temporal',
  area: 'Área',
  bar: 'Barras',
  hbar: 'Barras horizontales',
  stacked: 'Barras apiladas',
  stacked100: 'Apiladas al 100 %',
  funnel: 'Embudo',
  heatmap: 'Mapa de calor',
  scatter: 'Dispersión',
  histogram: 'Histograma',
  boxplot: 'Caja',
  cohort: 'Cohortes',
};

/** La pregunta que responde cada gráfico: si un gráfico no responde una, no se dibuja. */
export const CHART_QUESTIONS: Readonly<Record<ChartType, string>> = {
  line: '¿Cómo está evolucionando?',
  area: '¿Cómo evoluciona el volumen acumulado?',
  bar: '¿Quién rinde mejor?',
  hbar: '¿Cómo se ordenan los canales o campañas?',
  stacked: '¿Cómo está compuesto el resultado?',
  stacked100: '¿Qué proporción aporta cada parte?',
  funnel: '¿Dónde estamos perdiendo usuarios?',
  heatmap: '¿Dónde se concentra el comportamiento?',
  scatter: '¿Existe relación entre estas variables?',
  histogram: '¿Cómo se distribuyen los datos?',
  boxplot: '¿Qué tan variable es y hay valores atípicos?',
  cohort: '¿Cómo se comportan los usuarios según su periodo de llegada?',
};

/** Intención del análisis: junto con la métrica decide la visualización. */
export type AnalysisIntent =
  | 'trend'
  | 'compare'
  | 'composition'
  | 'distribution'
  | 'relationship'
  | 'timing'
  | 'process'
  | 'retention';

export const INTENT_LABELS: Readonly<Record<AnalysisIntent, string>> = {
  trend: 'Evolución',
  compare: 'Comparación',
  composition: 'Composición',
  distribution: 'Distribución',
  relationship: 'Relación',
  timing: 'Horario',
  process: 'Proceso',
  retention: 'Retención',
};

export interface VizRecommendation {
  readonly recommended: ChartType;
  readonly alternatives: readonly ChartType[];
  /** Por qué se recomienda: se muestra al usuario. */
  readonly reason: string;
  /** Qué NO conviene y por qué (p. ej. «circular»). */
  readonly caution: string | null;
}

/* ------------------------------------------------- insights y trazabilidad */

/** La IA nunca mezcla estos cuatro niveles: cada frase declara cuál es. */
export type EvidenceLevel = 'observed' | 'interpretation' | 'hypothesis' | 'confirmed';

export const EVIDENCE_LABELS: Readonly<Record<EvidenceLevel, string>> = {
  observed: 'Dato observado',
  interpretation: 'Interpretación',
  hypothesis: 'Hipótesis',
  confirmed: 'Conclusión confirmada',
};

export type Confidence = 'high' | 'medium' | 'low';

export const CONFIDENCE_LABELS: Readonly<Record<Confidence, string>> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export interface InsightStatement {
  readonly level: EvidenceLevel;
  readonly text: string;
}

export interface TraceSource {
  readonly label: string;
  readonly count: number;
  readonly unit: string;
}

export type InsightModuleId =
  | 'campaigns'
  | 'funnel'
  | 'app'
  | 'social'
  | 'opinion'
  | 'reports'
  | 'observatory'
  | 'alerts';

export interface Insight {
  readonly id: string;
  readonly module: InsightModuleId;
  readonly title: string;
  readonly statements: readonly InsightStatement[];
  readonly confidence: Confidence;
  readonly confidenceFactors: readonly string[];
  readonly trace: {
    readonly period: string;
    readonly sources: readonly TraceSource[];
    readonly method: string;
  };
  readonly action: { readonly label: string; readonly module: InsightModuleId; readonly query?: Readonly<Record<string, string>> };
}

/* ----------------------------------------------------------------- alertas */

export type AlertSeverity = 'critical' | 'risk' | 'anomaly' | 'opportunity';

export const ALERT_LABELS: Readonly<Record<AlertSeverity, string>> = {
  critical: 'Crítico',
  risk: 'Posible riesgo',
  anomaly: 'Anomalía',
  opportunity: 'Brecha de oportunidad',
};

export interface MarketingAlert {
  readonly id: string;
  readonly severity: AlertSeverity;
  readonly title: string;
  readonly what: string;
  readonly detectedAt: string;
  readonly magnitude: string;
  readonly source: string;
  readonly cause: string;
  readonly impact: string;
  readonly confidence: Confidence;
  readonly recommendation: string;
  readonly evidence: readonly string[];
  readonly module: InsightModuleId;
  readonly query: Readonly<Record<string, string>>;
  readonly series: readonly number[];
  readonly status: 'open' | 'seen' | 'resolved';
}
