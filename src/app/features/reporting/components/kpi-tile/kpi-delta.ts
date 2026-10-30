import { formatearVariacion } from '@core/data-access/reporting/reporting-format';

export type DeltaDirection = 'up' | 'down' | 'flat' | 'none';
export type DeltaVerdict = 'better' | 'worse' | 'same' | 'unknown';

export interface DeltaReading {
  /** «+4,2 %», «−1,0 %» o «Sin comparativo». */
  readonly text: string;
  /** Palabra que acompaña al número: el significado nunca depende solo del color. */
  readonly word: string;
  readonly direction: DeltaDirection;
  readonly verdict: DeltaVerdict;
}

/** Por debajo de esto el número se redondea a «0,0 %» y no vale la pena decir que sube o baja. */
const FLAT_BELOW_PCT = 0.05;

/**
 * Lee una variación porcentual. Que suba no es bueno ni malo por sí mismo:
 * depende del indicador. El churn y la mora mejoran cuando bajan, así que
 * `riseIsBad` invierte el veredicto —y solo el veredicto: la flecha sigue
 * apuntando adonde fue el número—.
 */
export function readDelta(pct: number | null, riseIsBad = false): DeltaReading {
  if (pct === null || Number.isNaN(pct)) {
    return { text: formatearVariacion(null), word: '', direction: 'none', verdict: 'unknown' };
  }
  const text = formatearVariacion(pct);
  if (Math.abs(pct) < FLAT_BELOW_PCT) {
    return { text, word: 'sin cambio', direction: 'flat', verdict: 'same' };
  }
  const rose = pct > 0;
  const better = rose !== riseIsBad;
  return {
    text,
    word: better ? 'mejora' : 'empeora',
    direction: rose ? 'up' : 'down',
    verdict: better ? 'better' : 'worse',
  };
}
