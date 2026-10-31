import type {
  InsightsCatalog,
  InsightsMilestoneKind,
} from '../../../core/data-access/insights/insights.types';
import type { Campaign, Channel } from './insights.types';

/* ============================================================================
    Catálogo de campañas de AloVida Insights tal como lo sirve la API.

    El dominio lee de acá y no sabe de dónde vino: el shell lo instala una vez
    cargado (`installCatalog`). Antes de eso está vacío a propósito: una pantalla
    que lo lea sin que el catálogo esté listo ve «no hay campañas», no campañas
    inventadas.

    Los importes están en centavos de boliviano (enteros): ningún importe de
    dinero pasa por un decimal flotante.
    ========================================================================== */

export const SYNTHETIC_NOTICE =
  'Datos sintéticos de demostración. No corresponden a campañas ni a usuarios reales de AloVida.';

export interface Milestone {
  readonly date: string;
  readonly label: string;
  readonly campaignId: string;
  readonly kind: InsightsMilestoneKind;
}

/* Los `let` se reasignan solo en `installCatalog`; los demás módulos los importan como
   enlaces vivos y ven el catálogo nuevo sin cambiar una línea. */
export let CAMPAIGNS: readonly Campaign[] = [];
export let CAMPAIGN_BY_ID: ReadonlyMap<string, Campaign> = new Map();
/** Canales usados por cada campaña. */
export let CAMPAIGN_CHANNELS: Readonly<Record<string, readonly Channel[]>> = {};
/** Hitos que marcan los datos: la etiqueta visible, no una entrada de los detectores. */
export let MILESTONES: readonly Milestone[] = [];

let revenuePerConversion: ReadonlyMap<string, number> = new Map();

/** Instala el catálogo cargado de la API. */
export function installCatalog(catalog: InsightsCatalog): void {
  CAMPAIGNS = catalog.campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    objective: c.objective,
    audience: c.audience,
    startDate: c.startDate,
    endDate: c.endDate,
    budgetCents: c.budgetCents,
    status: c.status,
    targets: c.targets as Campaign['targets'],
  }));
  CAMPAIGN_BY_ID = new Map(CAMPAIGNS.map((c) => [c.id, c]));
  CAMPAIGN_CHANNELS = Object.fromEntries(catalog.campaigns.map((c) => [c.id, c.channels]));
  MILESTONES = catalog.milestones.map((m) => ({ ...m }));
  revenuePerConversion = new Map(catalog.campaigns.map((c) => [c.id, c.revenuePerConversionCents]));
}

/** Valor atribuido a cada conversión de la campaña, en centavos (0 si la campaña no existe). */
export function revenuePerConversionCents(campaignId: string): number {
  return revenuePerConversion.get(campaignId) ?? 0;
}

export function campaignName(id: string): string {
  return CAMPAIGN_BY_ID.get(id)?.name ?? id;
}
