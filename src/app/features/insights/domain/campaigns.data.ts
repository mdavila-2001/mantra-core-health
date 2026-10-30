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
    id: 'reg-oct',
    name: 'Registro Médicos — Octubre 2026',
    objective: 'Registrar y verificar profesionales de la salud',
    audience: 'Médicos y especialistas de Bolivia',
    startDate: '2026-10-01',
    endDate: '2026-10-29',
    budgetCents: 4_200_000,
    status: 'ended',
    targets: { ctr: 0.025, cpa: 6500, roas: 3.2, conversions: 650, retention: 0.6 },
  },
  {
    id: 'esp-sep',
    name: 'Búsqueda de Especialistas — Septiembre 2026',
    objective: 'Que pacientes encuentren y reserven con un especialista',
    audience: 'Pacientes de Santa Cruz, La Paz y Cochabamba',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    budgetCents: 6_000_000,
    status: 'ended',
    targets: { ctr: 0.022, cpa: 4200, roas: 1.6, conversions: 1500, retention: 0.45 },
  },
  {
    id: 'tel-oct',
    name: 'Telemedicina — Octubre 2026',
    objective: 'Activar consultas por videollamada',
    audience: 'Pacientes con acceso limitado a especialistas',
    startDate: '2026-10-05',
    endDate: '2026-10-31',
    budgetCents: 3_000_000,
    status: 'active',
    targets: { ctr: 0.02, cpa: 5200, roas: 2.0, conversions: 520, retention: 0.5 },
  },
  {
    id: 'far-ago',
    name: 'Farmacias Aliadas — Agosto y Septiembre 2026',
    objective: 'Sumar farmacias a la red de AloVida',
    audience: 'Propietarios y regentes de farmacia',
    startDate: '2026-08-15',
    endDate: '2026-09-30',
    budgetCents: 2_500_000,
    status: 'ended',
    targets: { ctr: 0.018, cpa: 9800, roas: 2.4, conversions: 180, retention: 0.62 },
  },
];

export const CAMPAIGN_BY_ID: ReadonlyMap<string, Campaign> = new Map(CAMPAIGNS.map((c) => [c.id, c]));

/** Canales usados por cada campaña. */
export const CAMPAIGN_CHANNELS: Readonly<Record<string, readonly Channel[]>> = {
  'reg-oct': ['instagram', 'facebook', 'tiktok', 'youtube', 'google', 'web', 'app', 'email'],
  'esp-sep': ['instagram', 'facebook', 'tiktok', 'google', 'web', 'app', 'email'],
  'tel-oct': ['instagram', 'facebook', 'tiktok', 'youtube', 'google', 'web', 'app'],
  'far-ago': ['facebook', 'google', 'web', 'email'],
};

/** Escala de volumen de cada campaña y valor atribuido por conversión (centavos, 90 días). */
export const CAMPAIGN_ECONOMICS: Readonly<
  Record<string, { scale: number; revenuePerConversionCents: number; funnelQuality: number }>
> = {
  'reg-oct': { scale: 0.36, revenuePerConversionCents: 18_500, funnelQuality: 1 },
  'esp-sep': { scale: 0.6, revenuePerConversionCents: 7_200, funnelQuality: 1.25 },
  'tel-oct': { scale: 0.28, revenuePerConversionCents: 12_800, funnelQuality: 1.1 },
  'far-ago': { scale: 0.2, revenuePerConversionCents: 31_000, funnelQuality: 0.85 },
};

export function campaignName(id: string): string {
  return CAMPAIGN_BY_ID.get(id)?.name ?? id;
}
