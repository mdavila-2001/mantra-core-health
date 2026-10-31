import type {
  Channel,
  InsightsCampaignDto,
  InsightsCatalog,
  InsightsMilestoneDto,
} from '../../../data-access/insights/insights.types';

/* ============================================================================
    Catálogo SINTÉTICO de AloVida Insights para el simulador.

    No son campañas reales de AloVida y la interfaz lo dice en cada pantalla.
    Los importes están en centavos de boliviano (enteros). Son los mismos datos
    que sembrará el modelo (`marketing.insights_campaigns`).
    ========================================================================== */

/** Escala de volumen y calidad del embudo de cada campaña: solo las usa el generador. */
export const CAMPAIGN_SCALE: Readonly<Record<string, { scale: number; funnelQuality: number }>> = {
  c1: { scale: 0.36, funnelQuality: 1 },
  c2: { scale: 0.3, funnelQuality: 1.1 },
  c3: { scale: 0.28, funnelQuality: 1.05 },
  c4: { scale: 0.2, funnelQuality: 1 },
};

const CHANNELS_OF: Readonly<Record<string, readonly Channel[]>> = {
  c1: ['google', 'instagram', 'facebook', 'youtube', 'email', 'web'],
  c2: ['tiktok', 'instagram', 'facebook', 'app', 'web'],
  c3: ['facebook', 'google', 'tiktok', 'email'],
  c4: ['instagram', 'youtube', 'google', 'web'],
};

export const MOCK_CAMPAIGNS: readonly InsightsCampaignDto[] = [
  {
    id: 'c1',
    name: 'Campaña Registro Médicos — Octubre 2026',
    objective: 'Registrar 650 médicos verificados en octubre',
    audience: 'Médicos generales y especialistas de Bolivia',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    budgetCents: 4_200_000,
    status: 'active',
    revenuePerConversionCents: 18_500,
    targets: { ctr: 0.025, cpa: 6500, roas: 3.2, conversions: 650, retention: 0.6 },
    channels: CHANNELS_OF['c1']!,
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
    revenuePerConversionCents: 7_200,
    targets: { ctr: 0.016, cpa: 4200, roas: 1.6, conversions: 1500, retention: 0.45 },
    channels: CHANNELS_OF['c2']!,
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
    revenuePerConversionCents: 12_800,
    targets: { ctr: 0.02, cpa: 5200, roas: 1.4, conversions: 520, retention: 0.5 },
    channels: CHANNELS_OF['c3']!,
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
    revenuePerConversionCents: 8_800,
    targets: { ctr: 0.018, cpa: 4800, roas: 1.5, conversions: 900, retention: 0.62 },
    channels: CHANNELS_OF['c4']!,
  },
];

/**
 * Hitos que marcan los datos. Los efectos que dejan en las series están inyectados a
 * propósito en `facts.dataset.ts` para que los detectores tengan algo real que encontrar;
 * esta lista es la etiqueta visible, no una entrada de los detectores.
 */
export const MOCK_MILESTONES: readonly InsightsMilestoneDto[] = [
  { date: '2026-09-15', label: 'Inicio de «Abran paso»', campaignId: 'c2', kind: 'launch' },
  { date: '2026-10-01', label: 'Inicio de Registro Médicos', campaignId: 'c1', kind: 'launch' },
  { date: '2026-10-05', label: 'Inicio de Ahorro en medicamentos', campaignId: 'c3', kind: 'launch' },
  { date: '2026-10-09', label: 'El video de la maqueta se viraliza en TikTok', campaignId: 'c2', kind: 'viral' },
  { date: '2026-10-17', label: 'Nota en prensa regional', campaignId: 'c2', kind: 'press' },
  { date: '2026-10-22', label: 'Cambio de oferta en Facebook', campaignId: 'c3', kind: 'offer_change' },
];

/** Día de corte del conjunto de datos de ejemplo. */
export const MOCK_CUTOFF = '2026-10-29';

export const MOCK_NOTICE =
  'Datos sintéticos de demostración. No corresponden a campañas ni a usuarios reales de AloVida.';

export const MOCK_CATALOG: InsightsCatalog = {
  campaigns: MOCK_CAMPAIGNS,
  milestones: MOCK_MILESTONES,
};
