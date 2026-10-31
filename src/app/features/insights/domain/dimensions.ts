import { distribute } from './hourly';
import type { InsightsFilter } from './insights.types';
import { buildScope, selectFacts } from './kpi';
import { PAID_CHANNELS } from './insights.types';

/* ============================================================================
    Rendimiento por creativo, formato, audiencia y CTA.

    Los datos de origen son por canal y día. Para repartirlos por dimensión
    creativa se usan pesos declarados y se garantiza que cada fila suma EXACTAMENTE
    el total pagado de la selección (mayor residuo): los cuatro cortes cuadran
    con el resumen. En producción esta tabla se alimenta del gestor de anuncios.
    ========================================================================== */

export type DimensionId = 'creative' | 'format' | 'audience' | 'cta';

interface Item {
  readonly id: string;
  readonly label: string;
  readonly exposure: number;
  readonly ctr: number;
  readonly conversion: number;
}

export const DIMENSION_LABELS: Readonly<Record<DimensionId, string>> = {
  creative: 'Creativo',
  format: 'Formato',
  audience: 'Audiencia',
  cta: 'Llamado a la acción',
};

const ITEMS: Readonly<Record<DimensionId, readonly Item[]>> = {
  creative: [
    { id: 'c1', label: 'Testimonio de un médico', exposure: 0.28, ctr: 1.18, conversion: 1.22 },
    { id: 'c2', label: 'Demostración del perfil', exposure: 0.24, ctr: 1.05, conversion: 1.1 },
    { id: 'c3', label: 'Pacientes que lo encuentran', exposure: 0.22, ctr: 0.96, conversion: 0.94 },
    { id: 'c4', label: 'Verificación en 24 horas', exposure: 0.16, ctr: 0.88, conversion: 1.05 },
    { id: 'c5', label: 'Mensaje general de marca', exposure: 0.1, ctr: 0.7, conversion: 0.62 },
  ],
  format: [
    { id: 'f1', label: 'Vídeo corto vertical', exposure: 0.4, ctr: 1.2, conversion: 0.95 },
    { id: 'f2', label: 'Imagen única', exposure: 0.24, ctr: 0.85, conversion: 1.05 },
    { id: 'f3', label: 'Carrusel', exposure: 0.2, ctr: 1.0, conversion: 1.12 },
    { id: 'f4', label: 'Anuncio de búsqueda', exposure: 0.16, ctr: 1.05, conversion: 1.2 },
  ],
  audience: [
    { id: 'a1', label: 'Médicos generales', exposure: 0.34, ctr: 1.0, conversion: 1.0 },
    { id: 'a2', label: 'Especialistas', exposure: 0.26, ctr: 1.1, conversion: 1.25 },
    { id: 'a3', label: 'Médicos recién titulados', exposure: 0.2, ctr: 1.25, conversion: 0.85 },
    { id: 'a4', label: 'Lookalike de registrados', exposure: 0.14, ctr: 0.9, conversion: 1.3 },
    { id: 'a5', label: 'Audiencia amplia', exposure: 0.06, ctr: 0.6, conversion: 0.55 },
  ],
  cta: [
    { id: 't1', label: 'Registre su perfil', exposure: 0.4, ctr: 1.0, conversion: 1.05 },
    { id: 't2', label: 'Verifique su título', exposure: 0.25, ctr: 0.85, conversion: 1.2 },
    { id: 't3', label: 'Conozca AloVida', exposure: 0.22, ctr: 1.3, conversion: 0.7 },
    { id: 't4', label: 'Pida una demostración', exposure: 0.13, ctr: 0.72, conversion: 1.35 },
  ],
};

export interface DimensionRow {
  readonly id: string;
  readonly label: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly spendCents: number;
  readonly revenueCents: number;
  readonly ctr: number | null;
  readonly cpa: number | null;
  readonly roas: number | null;
}

function normalized(values: readonly number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  return values.map((v) => v / total);
}

export function breakdownByDimension(filter: InsightsFilter, dimension: DimensionId): DimensionRow[] {
  const paid = selectFacts({ ...filter, channels: filter.channels.filter((c) => PAID_CHANNELS.includes(c)) });
  const t = buildScope(paid).all;
  const items = ITEMS[dimension];
  if (t.impressions === 0) return [];

  const impressionShare = normalized(items.map((i) => i.exposure));
  const impressions = distribute(t.impressions, impressionShare);
  const clickShare = normalized(items.map((i, k) => (impressions[k] ?? 0) * i.ctr));
  const clicks = distribute(t.clicks, clickShare);
  const conversionShare = normalized(items.map((i, k) => (clicks[k] ?? 0) * i.conversion));
  const conversions = distribute(t.conversions, conversionShare);
  const spend = distribute(t.spendCents, impressionShare);
  const revenue = distribute(t.revenueCents, conversionShare);

  return items.map((item, k) => {
    const imp = impressions[k] ?? 0;
    const clk = clicks[k] ?? 0;
    const conv = conversions[k] ?? 0;
    const sp = spend[k] ?? 0;
    const rev = revenue[k] ?? 0;
    return {
      id: item.id,
      label: item.label,
      impressions: imp,
      clicks: clk,
      conversions: conv,
      spendCents: sp,
      revenueCents: rev,
      ctr: imp >= 5000 ? clk / imp : null,
      cpa: conv >= 10 ? sp / conv : null,
      roas: sp > 0 && conv >= 10 ? rev / sp : null,
    };
  });
}
