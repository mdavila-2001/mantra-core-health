import type { Channel, DailyFact } from './insights-base';

/* ============================================================================
    AloVida Insights — contrato HTTP de `/marketing/insights/*`.

    Los tipos de respuesta GET se escriben a mano (el catálogo de contrato del
    simulador solo cubre cuerpos de petición); el simulador los usa como tipo de
    retorno, así que `tsc` cierra el círculo entre cliente, mock y pantallas.
    ========================================================================== */

/** De dónde sale el dato y hasta cuándo es cierto. Viaja en TODA respuesta. */
export interface InsightsMeta {
  /** `demo`: datos sintéticos declarados. Nunca se presenta como «en vivo». */
  readonly dataset: 'demo' | 'live';
  /** Último día con datos de la tabla consultada (`YYYY-MM-DD`). */
  readonly asOf: string;
  /** Día de corte del conjunto de datos. */
  readonly cutoff: string;
  readonly window: { readonly from: string; readonly to: string } | null;
  /** Texto que la interfaz muestra tal cual junto al dato. */
  readonly notice: string;
  /** Lo que no se mide: se dice, no se muestra como 0. */
  readonly notMeasured: readonly { readonly metric: string; readonly reason: string }[];
}

export interface InsightsResponse<T> {
  readonly data: T;
  readonly meta: InsightsMeta;
}

export interface InsightsCampaignDto {
  /** Código estable de la campaña (`c1`…): es el identificador que usan las pantallas. */
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly audience: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly budgetCents: number;
  readonly status: 'active' | 'ended' | 'planned';
  readonly revenuePerConversionCents: number;
  /** Objetivos propios por métrica (benchmark de campaña). */
  readonly targets: Readonly<Record<string, number>>;
  readonly channels: readonly Channel[];
}

export type InsightsMilestoneKind = 'launch' | 'viral' | 'press' | 'offer_change';

export interface InsightsMilestoneDto {
  readonly date: string;
  readonly label: string;
  readonly campaignId: string;
  readonly kind: InsightsMilestoneKind;
}

export interface InsightsCatalog {
  readonly campaigns: readonly InsightsCampaignDto[];
  readonly milestones: readonly InsightsMilestoneDto[];
}

export interface InsightsFactsQuery {
  readonly from: string;
  readonly to: string;
  readonly campaignIds?: readonly string[];
  readonly channels?: readonly Channel[];
}

export type { Channel, DailyFact };
