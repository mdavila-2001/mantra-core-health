import { ANOMALY_KIND_LABELS, type Anomaly } from '../../../core/data-access/access-governance';

/* ============================================================================
    La evidencia de una anomalía, lista para dibujar (CONTRATO-GOBIERNO §6.6, §9.3 fila 11).

    La API guarda la evidencia como un objeto libre (`evidence`): según la regla trae
    `permitsInWindow`, `dailyAverage`, `daysInactive`… y el simulador además trae una serie
    (`points` + `labels` + `baseline` + `description`). La pantalla no depende de la forma: si hay serie la
    dibuja; si no, dibuja lo observado, lo habitual y el umbral. **Siempre** hay una descripción en texto: el
    gráfico nunca es la única forma de enterarse.
   ========================================================================== */

/** Una barra del gráfico. */
export interface ChartBar {
  readonly label: string;
  readonly value: number;
  /** Alto relativo (0–100) respecto al mayor valor del gráfico. */
  readonly heightPct: number;
  /** `over` si supera el umbral, `at` si lo alcanza; se dice con texto, no solo con color. */
  readonly flag: 'over' | 'at' | null;
}

export interface AnomalyChart {
  readonly bars: readonly ChartBar[];
  readonly baseline: number | null;
  readonly baselinePct: number | null;
  readonly threshold: number;
  readonly thresholdPct: number;
  /** «Por hora», «Por día» o vacío. */
  readonly unitText: string;
  /** Lo que mide la serie («búsquedas de pacientes por hora»), si la regla lo dice. */
  readonly metric: string;
  readonly description: string;
}

const UNIT_TEXT: Readonly<Record<string, string>> = { hour: 'Por hora', day: 'Por día' };

/** Rótulo en lenguaje simple del tipo de anomalía. */
export function kindLabel(kind: string): string {
  return (ANOMALY_KIND_LABELS as Readonly<Record<string, string>>)[kind] ?? 'Actividad inusual';
}

const isNumberList = (value: unknown): value is readonly number[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((v) => typeof v === 'number' && Number.isFinite(v));
const isTextList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

function flagOf(value: number, threshold: number): ChartBar['flag'] {
  if (value > threshold) return 'over';
  return value === threshold ? 'at' : null;
}

/** El texto que acompaña al gráfico; el de la regla si lo trae, y si no uno armado con los números. */
export function evidenceDescription(anomaly: Anomaly): string {
  const text = anomaly.evidence['description'];
  if (typeof text === 'string' && text.trim() !== '') return text.trim();
  const habitual = anomaly.baseline === null ? '' : `, lo habitual es ${anomaly.baseline}`;
  return `${kindLabel(anomaly.kind)}: se observó ${anomaly.observed}${habitual} y el umbral de la organización es ${anomaly.threshold}.`;
}

/** Arma el gráfico de barras de una anomalía con la línea base y el umbral. */
export function anomalyChart(anomaly: Anomaly): AnomalyChart {
  const evidence = anomaly.evidence;
  const points = evidence['points'];
  const labels = evidence['labels'];
  const seriesBaseline =
    typeof evidence['baseline'] === 'number' ? evidence['baseline'] : anomaly.baseline;

  const raw: { label: string; value: number; flaggable: boolean }[] = isNumberList(points)
    ? points.map((value, i) => ({
        label: isTextList(labels) && labels[i] !== undefined ? labels[i] : String(i + 1),
        value,
        flaggable: true,
      }))
    : [
        { label: 'Observado', value: anomaly.observed, flaggable: true },
        ...(seriesBaseline === null
          ? []
          : [{ label: 'Habitual', value: seriesBaseline, flaggable: false }]),
        { label: 'Umbral', value: anomaly.threshold, flaggable: false },
      ];

  const top = Math.max(1, anomaly.threshold, seriesBaseline ?? 0, ...raw.map((bar) => bar.value));
  const pct = (value: number): number => Math.round((value / top) * 100);
  return {
    bars: raw.map((bar) => ({
      label: bar.label,
      value: bar.value,
      heightPct: pct(bar.value),
      flag: bar.flaggable ? flagOf(bar.value, anomaly.threshold) : null,
    })),
    baseline: seriesBaseline,
    baselinePct: seriesBaseline === null ? null : pct(seriesBaseline),
    threshold: anomaly.threshold,
    thresholdPct: pct(anomaly.threshold),
    unitText: typeof evidence['unit'] === 'string' ? (UNIT_TEXT[evidence['unit']] ?? '') : '',
    metric: typeof evidence['metric'] === 'string' ? evidence['metric'] : '',
    description: evidenceDescription(anomaly),
  };
}
