import type { Campaign, Channel } from './insights.types';

/* ============================================================================
    Campañas SINTÉTICAS del prototipo. No son campañas reales de AloVida y la
    interfaz lo dice en cada pantalla (`SYNTHETIC_NOTICE`).

    Los importes están en centavos de boliviano (enteros): ningún importe de
    dinero pasa por un decimal flotante.
    ========================================================================== */

export const SYNTHETIC_NOTICE =
  'Datos sintéticos de demostración. No corresponden a campañas ni a usuarios reales de AloVida.';

export const CAMPAIGNS: readonly Campaign[] = [
  {
    id: 'c1',
    name: 'Campaña Registro Médicos — Octubre 2026',
    objective: 'Registrar 650 médicos verificados en octubre',
    audience: 'Médicos generales y especialistas de Bolivia',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    budgetCents: 4_200_000,
    status: 'active',
    targets: { ctr: 0.025, cpa: 6500, roas: 3.2, conversions: 650, retention: 0.6 },
  },
  {
    id: 'c2',
    name: 'Abran paso · La maqueta de los anillos',
    objective: '4.800 registros de pacientes por QR y redes',
    audience: 'Pacientes de Santa Cruz, de 18 a 44 años',
    startDate: '2026-09-15',
    endDate: '2026-11-14',
    budgetCents: 5_000_000,
    status: 'active',
    targets: { ctr: 0.016, cpa: 4200, roas: 1.6, conversions: 1500, retention: 0.45 },
  },
  {
    id: 'c3',
    name: 'Ahorro en medicamentos · Farmacias aliadas',
    objective: '1.900 usuarios que consultan precios de genéricos',
    audience: 'Familias que compran medicamentos con frecuencia',
    startDate: '2026-10-05',
    endDate: '2026-11-04',
    budgetCents: 2_000_000,
    status: 'active',
    targets: { ctr: 0.02, cpa: 5200, roas: 1.4, conversions: 520, retention: 0.5 },
  },
  {
    id: 'c4',
    name: 'Historial de salud en un solo lugar',
    objective: 'Siempre activa: sostener 900 registros al mes',
    audience: 'Pacientes crónicos y cuidadores',
    startDate: '2026-09-01',
    endDate: '2026-12-31',
    budgetCents: 5_600_000,
    status: 'active',
    targets: { ctr: 0.018, cpa: 4800, roas: 1.5, conversions: 900, retention: 0.62 },
  },
];

export const CAMPAIGN_BY_ID: ReadonlyMap<string, Campaign> = new Map(CAMPAIGNS.map((c) => [c.id, c]));

/** Canales usados por cada campaña. */
export const CAMPAIGN_CHANNELS: Readonly<Record<string, readonly Channel[]>> = {
  c1: ['google', 'instagram', 'facebook', 'youtube', 'email', 'web'],
  c2: ['tiktok', 'instagram', 'facebook', 'app', 'web'],
  c3: ['facebook', 'google', 'tiktok', 'email'],
  c4: ['instagram', 'youtube', 'google', 'web'],
};

/** Escala de volumen de cada campaña y valor atribuido por conversión (centavos, 90 días). */
export const CAMPAIGN_ECONOMICS: Readonly<
  Record<string, { scale: number; revenuePerConversionCents: number; funnelQuality: number }>
> = {
  c1: { scale: 0.36, revenuePerConversionCents: 18_500, funnelQuality: 1 },
  c2: { scale: 0.3, revenuePerConversionCents: 7_200, funnelQuality: 1.1 },
  c3: { scale: 0.28, revenuePerConversionCents: 12_800, funnelQuality: 1.05 },
  c4: { scale: 0.2, revenuePerConversionCents: 8_800, funnelQuality: 1 },
};

/** Tipo de hito: lo que lo hace visible en los gráficos. */
export type MilestoneKind = 'launch' | 'viral' | 'press' | 'offer_change';

export interface Milestone {
  readonly date: string;
  readonly label: string;
  readonly campaignId: string;
  readonly kind: MilestoneKind;
}

/**
 * Hitos que marcan los datos. Los efectos que dejan en las series (`eventEffect` en
 * `synthetic-facts.ts`) están inyectados a propósito para que los detectores tengan algo real
 * que encontrar; esta lista es la etiqueta visible, no una entrada de los detectores.
 */
export const MILESTONES: readonly Milestone[] = [
  { date: '2026-09-15', label: 'Inicio de «Abran paso»', campaignId: 'c2', kind: 'launch' },
  { date: '2026-10-01', label: 'Inicio de Registro Médicos', campaignId: 'c1', kind: 'launch' },
  { date: '2026-10-05', label: 'Inicio de Ahorro en medicamentos', campaignId: 'c3', kind: 'launch' },
  { date: '2026-10-09', label: 'El video de la maqueta se viraliza en TikTok', campaignId: 'c2', kind: 'viral' },
  { date: '2026-10-17', label: 'Nota en prensa regional', campaignId: 'c2', kind: 'press' },
  { date: '2026-10-22', label: 'Cambio de oferta en Facebook', campaignId: 'c3', kind: 'offer_change' },
];

export function campaignName(id: string): string {
  return CAMPAIGN_BY_ID.get(id)?.name ?? id;
}
