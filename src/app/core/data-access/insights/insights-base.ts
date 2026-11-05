/* ============================================================================
    AloVida Insights — piezas base compartidas entre el contrato con la API, el
    simulador y el dominio. Viven en `core` porque `core` no puede importar de
    `features`; el dominio las re-exporta.
    ========================================================================== */

/** Canales conectados. Los tres últimos son canales propios (sin inversión de medios). */
export const CHANNELS = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'google',
  'web',
  'app',
  'email',
] as const;
export type Channel = (typeof CHANNELS)[number];

/** Canales con anuncios pagados: los únicos con costo por clic, por mil y por resultado. */
export const PAID_CHANNELS: readonly Channel[] = ['instagram', 'facebook', 'tiktok', 'youtube', 'google'];

/** Canales con vídeo: los únicos donde «reproducciones» y «tiempo de visualización» tienen sentido. */
export const VIDEO_CHANNELS: readonly Channel[] = ['instagram', 'tiktok', 'youtube', 'facebook'];

/** Un día de una campaña en un canal. Los importes son enteros en centavos de boliviano. */
export interface DailyFact {
  readonly date: string; // YYYY-MM-DD
  readonly campaignId: string;
  readonly channel: Channel;
  readonly impressions: number;
  /** Alcance DIARIO del canal (personas distintas ese día). No se suma entre días: ver `estimateUniqueReach`. */
  readonly reach: number;
  readonly engagements: number;
  readonly clicks: number;
  readonly videoViews: number;
  readonly watchSeconds: number;
  readonly visits: number;
  readonly leads: number;
  readonly registrations: number;
  readonly activations: number;
  readonly firstUses: number;
  readonly conversions: number;
  readonly spendCents: number;
  readonly revenueCents: number;
}
