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

/* ============================================================================
    Flujo de trabajo de las alertas, reglas, preferencias, informes y vistas.

    Las alertas se DETECTAN en el dominio de la pantalla a partir de los hechos (cada una con un
    `fingerprint` estable); lo que persiste en el API es lo que hacen las personas con ellas:
    su estado, su responsable y su historial. Las mutaciones llevan `If-Match` con `rowVersion`
    (412 `INSIGHTS_VERSION_MISMATCH` si está vieja).
    ========================================================================== */

export type InsightsAlertStatus = 'new' | 'in_progress' | 'resolved' | 'dismissed';
export type InsightsAlertSeverity = 'critical' | 'risk' | 'anomaly' | 'opportunity';

export const INSIGHTS_OWNER_TEAMS = ['marketing', 'innovation', 'product', 'communication', 'content', 'systems', 'direction'] as const;
export type InsightsOwnerTeam = (typeof INSIGHTS_OWNER_TEAMS)[number];

/** Lo que el API necesita saber de una alerta la primera vez que alguien la toca. */
export interface InsightsAlertSnapshot {
  readonly severity: InsightsAlertSeverity;
  readonly title: string;
  readonly whatText: string;
  readonly detectedOn: string;
  readonly moduleCode: string;
  readonly priority: number;
}

export interface InsightsAlertTransition {
  readonly at: string;
  readonly fromStatus: InsightsAlertStatus | null;
  readonly toStatus: InsightsAlertStatus;
  readonly fromOwner: InsightsOwnerTeam | null;
  readonly toOwner: InsightsOwnerTeam | null;
  readonly note: string | null;
}

export interface InsightsAlertWorkflow {
  readonly fingerprint: string;
  readonly status: InsightsAlertStatus;
  readonly ownerTeam: InsightsOwnerTeam | null;
  readonly rowVersion: number;
  readonly updatedAt: string;
  readonly transitions: readonly InsightsAlertTransition[];
}

export interface PutAlertWorkflowBody {
  readonly status: InsightsAlertStatus;
  readonly ownerTeam: InsightsOwnerTeam | null;
  readonly note?: string;
  readonly snapshot: InsightsAlertSnapshot;
}

export type InsightsRuleCode = 'cac' | 'ctrdrop' | 'ctrspike' | 'cvr' | 'neg' | 'onb' | 'feed';

export interface InsightsAlertRule {
  readonly code: InsightsRuleCode;
  readonly name: string;
  readonly description: string | null;
  readonly severity: InsightsAlertSeverity;
  readonly unit: string;
  readonly threshold: number;
  readonly defaultThreshold: number;
  readonly direction: '+' | '-';
  readonly enabled: boolean;
  readonly rowVersion: number;
}

export interface PatchAlertRuleBody {
  readonly enabled?: boolean;
  /** 1 a 500. */
  readonly threshold?: number;
}

export type InsightsChannelKey = 'app' | 'mail' | 'slack';

export interface InsightsNotificationPreferences {
  /** Por tipo de alerta, por dónde quiere enterarse. */
  readonly matrix: Readonly<Record<InsightsAlertSeverity, readonly InsightsChannelKey[]>>;
  readonly frequency: 'immediate' | 'daily_digest';
  readonly digestHour: number;
  readonly quietFrom: string | null;
  readonly quietTo: string | null;
  readonly quietExemptCritical: boolean;
  /** Siempre `true`: el prototipo no envía nada. Se dice en pantalla. */
  readonly nothingIsSent: boolean;
  readonly rowVersion: number;
}

export type PutNotificationPreferencesBody = Omit<InsightsNotificationPreferences, 'nothingIsSent' | 'rowVersion'>;

export interface InsightsUserPreferences {
  readonly density: 'comfortable' | 'compact';
  readonly theme: 'system' | 'light' | 'dark';
  readonly navCollapsed: boolean;
  readonly timezone: string | null;
  readonly rowVersion: number;
}

export type PutUserPreferencesBody = Omit<InsightsUserPreferences, 'rowVersion'>;

export interface InsightsSavedView {
  readonly id: string;
  readonly name: string;
  /** Módulo y query completos de la vista (`/insights/campaigns?c=c1&p=30d`). */
  readonly url: string;
  readonly rowVersion: number;
}

export interface PutSavedViewBody {
  readonly name: string;
  readonly url: string;
}

export interface InsightsReportRecord {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly audience: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly campaignIds: readonly string[];
  readonly channels: readonly string[];
  readonly sections: readonly string[];
  readonly createdAt: string;
  readonly rowVersion: number;
}

export interface PutReportBody {
  readonly title: string;
  readonly type: string;
  readonly audience: string;
  readonly periodFrom: string;
  readonly periodTo: string;
  readonly campaignIds: readonly string[];
  readonly channels: readonly string[];
  readonly sections: readonly string[];
}
