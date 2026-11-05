import type {
  InsightsAlertRule,
  InsightsAlertSnapshot,
  InsightsAlertStatus,
  InsightsOwnerTeam,
  InsightsRuleCode,
} from '../../../core/data-access/insights/insights.types';
import type { MarketingAlert } from './insights.types';

/* ============================================================================
    Lo que las personas hacen con las alertas: estado y responsable. La DETECCIÓN sigue siendo
    del dominio (a partir de los hechos); esto es la capa de trabajo que el API persiste.
    ========================================================================== */

export const STATUS_LABELS: Readonly<Record<InsightsAlertStatus, string>> = {
  new: 'Nuevo',
  in_progress: 'En revisión',
  resolved: 'Resuelta',
  dismissed: 'Descartada',
};

export const OWNER_LABELS: Readonly<Record<InsightsOwnerTeam, string>> = {
  marketing: 'Marketing',
  innovation: 'Innovación',
  product: 'Producto',
  communication: 'Comunicación',
  content: 'Contenido',
  systems: 'Sistemas',
  direction: 'Dirección',
};

/** Una alerta cerrada ya no pide atención. */
export function isOpen(status: InsightsAlertStatus): boolean {
  return status === 'new' || status === 'in_progress';
}

/** La regla que detecta cada familia de alertas; las que no tienen regla (cola, brechas) siempre se muestran. */
export function ruleOf(alert: Pick<MarketingAlert, 'id' | 'severity'>): InsightsRuleCode | null {
  if (alert.id.startsWith('cost-') || alert.id.startsWith('cpm-')) return 'cac';
  if (alert.id.startsWith('ctr-')) return alert.severity === 'anomaly' ? 'ctrspike' : 'ctrdrop';
  if (alert.id.startsWith('onboarding-')) return 'onb';
  if (alert.id.startsWith('sent-')) return 'neg';
  return null;
}

/** Oculta las alertas de reglas apagadas. El umbral lo aplicará la detección del servidor. */
export function visibleByRules<T extends Pick<MarketingAlert, 'id' | 'severity'>>(alerts: readonly T[], rules: readonly InsightsAlertRule[]): T[] {
  const off = new Set(rules.filter((r) => !r.enabled).map((r) => r.code));
  return alerts.filter((a) => {
    const rule = ruleOf(a);
    return rule === null || !off.has(rule);
  });
}

/** Prioridad 1 (más urgente) a 4 según el nivel. */
export function priorityOf(alert: Pick<MarketingAlert, 'severity'>): number {
  return { critical: 1, risk: 2, anomaly: 3, opportunity: 4 }[alert.severity];
}

export function snapshotOf(alert: MarketingAlert): InsightsAlertSnapshot {
  return {
    severity: alert.severity,
    title: alert.title,
    whatText: alert.what,
    detectedOn: alert.detectedAt.slice(0, 10),
    moduleCode: alert.module,
    priority: priorityOf(alert),
  };
}
