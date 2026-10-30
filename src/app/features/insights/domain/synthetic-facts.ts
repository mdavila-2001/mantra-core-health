import { CAMPAIGNS, CAMPAIGN_CHANNELS, CAMPAIGN_ECONOMICS } from './campaigns.data';
import { eachDay, weekdayIndex, PROTOTYPE_TODAY } from './dates';
import type { Channel, DailyFact } from './insights.types';
import { PAID_CHANNELS, VIDEO_CHANNELS } from './insights.types';
import { noise } from './prng';

/* ============================================================================
    Generador de hechos diarios.

    UNA sola fuente alimenta todos los módulos: lo que Campañas muestra como
    «conversiones» es lo que Embudo grafica y lo que Alertas detecta. Los
    números no se escriben a mano en cada pantalla.

    Los eventos de abajo (`eventEffect`) son hechos inyectados A PROPÓSITO para
    que los detectores de anomalías tengan algo real que encontrar; los
    detectores no conocen esta tabla.
    ========================================================================== */

interface ChannelModel {
  /** Gasto diario base en bolivianos (solo canales pagados). */
  readonly dailySpendBs: number;
  /** CPM base en bolivianos. */
  readonly cpmBs: number;
  /** Impresiones diarias base (solo canales propios). */
  readonly ownedImpressions: number;
  readonly ctr: number;
  readonly engagementRate: number;
  readonly visitRate: number;
  /** Multiplicador de calidad aguas abajo (lead → conversión). */
  readonly quality: number;
  /** Frecuencia diaria (impresiones ÷ alcance diario). */
  readonly dailyFrequency: number;
  readonly videoRate: number;
  readonly avgWatchSeconds: number;
}

const CHANNEL_MODEL: Readonly<Record<Channel, ChannelModel>> = {
  instagram: { dailySpendBs: 1300, cpmBs: 22, ownedImpressions: 0, ctr: 0.024, engagementRate: 0.048, visitRate: 0.78, quality: 1.0, dailyFrequency: 1.22, videoRate: 0.42, avgWatchSeconds: 7.2 },
  facebook: { dailySpendBs: 700, cpmBs: 18, ownedImpressions: 0, ctr: 0.016, engagementRate: 0.021, visitRate: 0.76, quality: 0.95, dailyFrequency: 1.3, videoRate: 0.3, avgWatchSeconds: 6.1 },
  tiktok: { dailySpendBs: 800, cpmBs: 14, ownedImpressions: 0, ctr: 0.031, engagementRate: 0.062, visitRate: 0.7, quality: 0.72, dailyFrequency: 1.18, videoRate: 0.65, avgWatchSeconds: 9.5 },
  youtube: { dailySpendBs: 350, cpmBs: 30, ownedImpressions: 0, ctr: 0.009, engagementRate: 0.014, visitRate: 0.82, quality: 1.15, dailyFrequency: 1.12, videoRate: 0.45, avgWatchSeconds: 21 },
  google: { dailySpendBs: 700, cpmBs: 38, ownedImpressions: 0, ctr: 0.036, engagementRate: 0.002, visitRate: 0.88, quality: 1.3, dailyFrequency: 1.08, videoRate: 0, avgWatchSeconds: 0 },
  web: { dailySpendBs: 0, cpmBs: 0, ownedImpressions: 9000, ctr: 0.06, engagementRate: 0.011, visitRate: 0.96, quality: 1.35, dailyFrequency: 1.4, videoRate: 0, avgWatchSeconds: 0 },
  app: { dailySpendBs: 0, cpmBs: 0, ownedImpressions: 15000, ctr: 0.05, engagementRate: 0.018, visitRate: 0.98, quality: 1.5, dailyFrequency: 2.1, videoRate: 0, avgWatchSeconds: 0 },
  email: { dailySpendBs: 0, cpmBs: 0, ownedImpressions: 6000, ctr: 0.034, engagementRate: 0.052, visitRate: 0.94, quality: 1.45, dailyFrequency: 1.05, videoRate: 0, avgWatchSeconds: 0 },
};

/** Tasas de cada etapa del embudo (por visita), antes de calidad y de eventos. */
const STAGE = { lead: 0.12, registration: 0.55, activation: 0.68, firstUse: 0.8, conversion: 0.5 } as const;

/** Actividad por día de la semana (lunes … domingo). */
const WEEKDAY_FACTOR = [1, 1.06, 1.05, 1, 0.94, 0.8, 0.74] as const;

interface EventEffect {
  readonly cpm: number;
  readonly ctr: number;
  readonly lead: number;
  readonly activation: number;
  readonly conversion: number;
}

const NEUTRAL: EventEffect = { cpm: 1, ctr: 1, lead: 1, activation: 1, conversion: 1 };

/**
 * Hechos inyectados en «Registro Médicos — Octubre»:
 *  · desde el 20: el onboarding pierde gente (activación cae);
 *  · 25 al 29: Instagram y Facebook se encarecen y convierten peor;
 *  · 26 al 29: TikTok dispara su CTR.
 */
function eventEffect(campaignId: string, channel: Channel, date: string): EventEffect {
  if (campaignId !== 'reg-oct') return NEUTRAL;
  let effect = NEUTRAL;
  if (date >= '2026-10-20') effect = { ...effect, activation: 0.905 };
  if (date >= '2026-10-25' && (channel === 'instagram' || channel === 'facebook')) {
    effect = { ...effect, cpm: 1.4, lead: 0.42, conversion: 0.78 };
  }
  if (date >= '2026-10-26' && channel === 'tiktok') effect = { ...effect, ctr: 1.9 };
  return effect;
}

function flightFactor(date: string, start: string, end: string): number {
  const startMs = Date.parse(start);
  const day = (Date.parse(date) - startMs) / 86_400_000;
  const total = (Date.parse(end) - startMs) / 86_400_000;
  const ramp = Math.min(1, 0.55 + day * 0.15);
  const taper = day > total - 2 ? 0.85 : 1;
  return ramp * taper;
}

function buildFact(campaignId: string, channel: Channel, date: string): DailyFact {
  const campaign = CAMPAIGNS.find((c) => c.id === campaignId);
  const econ = CAMPAIGN_ECONOMICS[campaignId];
  if (!campaign || !econ) throw new Error(`Campaña sin economía: ${campaignId}`);
  const model = CHANNEL_MODEL[channel];
  const effect = eventEffect(campaignId, channel, date);
  const key = `${campaignId}|${channel}|${date}`;
  const dayFactor =
    WEEKDAY_FACTOR[weekdayIndex(date)]! * flightFactor(date, campaign.startDate, campaign.endDate);
  const paid = PAID_CHANNELS.includes(channel);

  const spendBs = paid ? model.dailySpendBs * econ.scale * dayFactor * noise(`${key}|s`, 0.06) : 0;
  const cpm = model.cpmBs * effect.cpm * noise(`${key}|cpm`, 0.07);
  const impressions = paid
    ? (spendBs / cpm) * 1000
    : model.ownedImpressions * econ.scale * dayFactor * noise(`${key}|i`, 0.09);
  const ctr = model.ctr * effect.ctr * noise(`${key}|ctr`, 0.09);
  const clicks = impressions * ctr;
  const visits = clicks * model.visitRate * noise(`${key}|v`, 0.03);
  const q = model.quality * econ.funnelQuality;
  const leads = visits * STAGE.lead * q * effect.lead * noise(`${key}|l`, 0.07);
  const registrations = leads * STAGE.registration * noise(`${key}|r`, 0.06);
  const activations = registrations * STAGE.activation * effect.activation * noise(`${key}|a`, 0.05);
  const firstUses = activations * STAGE.firstUse * noise(`${key}|u`, 0.04);
  const conversions = firstUses * STAGE.conversion * effect.conversion * noise(`${key}|c`, 0.06);
  const views = VIDEO_CHANNELS.includes(channel) ? impressions * model.videoRate * noise(`${key}|vv`, 0.08) : 0;

  const r = Math.round;
  const impressionsInt = r(impressions);
  const clicksInt = Math.min(r(clicks), impressionsInt);
  const visitsInt = Math.min(r(visits), clicksInt);
  const leadsInt = Math.min(r(leads), visitsInt);
  const registrationsInt = Math.min(r(registrations), leadsInt);
  const activationsInt = Math.min(r(activations), registrationsInt);
  const firstUsesInt = Math.min(r(firstUses), activationsInt);
  const conversionsInt = Math.min(r(conversions), firstUsesInt);

  return {
    date,
    campaignId,
    channel,
    impressions: impressionsInt,
    reach: r(impressions / (model.dailyFrequency * noise(`${key}|f`, 0.04))),
    engagements: r(impressions * model.engagementRate * noise(`${key}|e`, 0.1)),
    clicks: clicksInt,
    videoViews: r(views),
    watchSeconds: r(views * model.avgWatchSeconds * noise(`${key}|w`, 0.06)),
    visits: visitsInt,
    leads: leadsInt,
    registrations: registrationsInt,
    activations: activationsInt,
    firstUses: firstUsesInt,
    conversions: conversionsInt,
    spendCents: r(spendBs * 100),
    revenueCents: r(conversionsInt * econ.revenuePerConversionCents * noise(`${key}|rev`, 0.05)),
  };
}

let cache: readonly DailyFact[] | null = null;

/** Todos los hechos diarios, ordenados por fecha, campaña y canal. Se calculan una vez. */
export function allFacts(): readonly DailyFact[] {
  if (cache) return cache;
  const facts: DailyFact[] = [];
  for (const campaign of CAMPAIGNS) {
    const last = campaign.endDate < PROTOTYPE_TODAY ? campaign.endDate : PROTOTYPE_TODAY;
    const channels = CAMPAIGN_CHANNELS[campaign.id] ?? [];
    for (const date of eachDay(campaign.startDate, last)) {
      for (const channel of channels) facts.push(buildFact(campaign.id, channel, date));
    }
  }
  facts.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.campaignId.localeCompare(b.campaignId) || a.channel.localeCompare(b.channel),
  );
  cache = facts;
  return facts;
}
