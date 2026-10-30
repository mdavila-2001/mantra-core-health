import type { FunnelStage } from '../charts/funnel-chart';
import { CAMPAIGN_BY_ID } from './campaigns.data';
import { retentionAtWeek } from './cohorts';
import { addDays } from './dates';
import type { Channel, DailyFact, InsightsFilter } from './insights.types';
import { CHANNEL_LABELS, CHANNELS } from './insights.types';
import { buildScope, previousRange, selectFacts } from './kpi';
import { noise } from './prng';

/* ============================================================================
    Embudo de adquisición y recorrido del paciente.

    El embudo sale de los MISMOS hechos diarios que el módulo de campañas: las
    conversiones de aquí son las de allí. La etapa «Interacción» es el clic: la
    interacción con un anuncio que lleva a AloVida; las reacciones y comentarios
    no son un paso del camino de adquisición.
    ========================================================================== */

export interface StageDef {
  readonly id: string;
  readonly label: string;
  readonly pick: (s: ReturnType<typeof buildScope>) => number;
}

const STAGES: readonly StageDef[] = [
  { id: 'impressions', label: 'Impresión', pick: (s) => s.all.impressions },
  { id: 'clicks', label: 'Interacción (clic)', pick: (s) => s.all.clicks },
  { id: 'visits', label: 'Visita', pick: (s) => s.all.visits },
  { id: 'registrations', label: 'Registro', pick: (s) => s.all.registrations },
  { id: 'activations', label: 'Activación', pick: (s) => s.all.activations },
  { id: 'firstUses', label: 'Primer uso', pick: (s) => s.all.firstUses },
  { id: 'conversions', label: 'Conversión', pick: (s) => s.all.conversions },
];

function counts(facts: readonly DailyFact[]): number[] {
  const scope = buildScope(facts);
  return STAGES.map((s) => s.pick(scope));
}

function stepRates(values: readonly number[]): (number | null)[] {
  return values.map((v, i) => (i === 0 || (values[i - 1] ?? 0) === 0 ? null : v / (values[i - 1] ?? 1)));
}

export interface FunnelModel {
  readonly stages: FunnelStage[];
  /** Retención a 7 días de las cohortes ya observables (o null). */
  readonly retention7: { rate: number; cohortSize: number } | null;
  readonly overall: number | null;
  readonly worst: { label: string; gap: number } | null;
  readonly measured: number;
}

/** Embudo del filtro, con benchmark histórico de cada paso y variación contra el periodo anterior. */
export function acquisitionFunnel(filter: InsightsFilter): FunnelModel {
  const facts = selectFacts(filter);
  const now = counts(facts);
  const nowRates = stepRates(now);

  const prev = counts(selectFacts({ ...filter, range: previousRange(filter.range) }));
  const prevRates = stepRates(prev);

  const histFrom = addDays(filter.range.from, -60);
  const hist = counts(selectFacts({ campaignIds: [...CAMPAIGN_BY_ID.keys()], channels: filter.channels, range: { from: histFrom, to: addDays(filter.range.from, -1) } }));
  const histRates = stepRates(hist);

  const retention = retentionAtWeek(facts, 1);
  const stages: FunnelStage[] = STAGES.map((def, i) => {
    const r = nowRates[i] ?? null;
    const p = prevRates[i] ?? null;
    return {
      id: def.id,
      label: def.label,
      value: now[i] ?? 0,
      fromLabel: i > 0 ? STAGES[i - 1]?.label.toLowerCase() : undefined,
      benchmarkRate: histRates[i] ?? null,
      changeVsPrevious: r !== null && p !== null && p > 0 ? (r - p) / p : null,
    };
  });
  if (retention) {
    const conversions = now[STAGES.length - 1] ?? 0;
    stages.push({
      id: 'retention',
      label: 'Retención a 7 días',
      value: Math.round(conversions * retention.rate),
      fromLabel: 'conversión',
      note: `Retención de las cohortes con 7 días de antigüedad (${(retention.rate * 100).toFixed(1).replace('.', ',')} %) aplicada a quienes convirtieron.`,
    });
  }

  let worst: FunnelModel['worst'] = null;
  stages.slice(2).forEach((s, i) => {
    const prevStage = stages[i + 1];
    if (!prevStage || prevStage.value === 0 || !s.benchmarkRate) return;
    const gap = (s.value / prevStage.value - s.benchmarkRate) / s.benchmarkRate;
    if (gap < -0.05 && (worst === null || gap < worst.gap)) worst = { label: s.label, gap };
  });
  const top = now[1] ?? 0;
  return { stages, retention7: retention ? { rate: retention.rate, cohortSize: retention.cohortSize } : null, overall: top > 0 ? (now[STAGES.length - 1] ?? 0) / (now[2] ?? 1) : null, worst, measured: facts.length };
}

export interface ChannelFunnelRow {
  readonly channel: Channel;
  readonly label: string;
  readonly visits: number;
  readonly registrations: number;
  readonly activations: number;
  readonly conversions: number;
  /** Conversión visita → conversión. */
  readonly rate: number | null;
  readonly activation: number | null;
}

export function funnelByChannel(filter: InsightsFilter): ChannelFunnelRow[] {
  return CHANNELS.filter((c) => filter.channels.includes(c)).flatMap((channel) => {
    const s = buildScope(selectFacts({ ...filter, channels: [channel] })).all;
    if (s.visits === 0) return [];
    return [{
      channel,
      label: CHANNEL_LABELS[channel],
      visits: s.visits,
      registrations: s.registrations,
      activations: s.activations,
      conversions: s.conversions,
      rate: s.visits >= 500 ? s.conversions / s.visits : null,
      activation: s.registrations >= 100 ? s.activations / s.registrations : null,
    }];
  });
}

/* --------------------------------------------------------------- journey */

export interface JourneyStage {
  readonly id: string;
  readonly label: string;
  readonly users: number;
  /** Fracción de la etapa anterior. */
  readonly rate: number | null;
  readonly medianMinutes: number;
  readonly friction: 'low' | 'medium' | 'high';
  readonly blockers: readonly string[];
}

interface JourneyDef {
  readonly id: string;
  readonly label: string;
  readonly rate: number;
  readonly minutes: number;
  readonly blockers: readonly string[];
}

const JOURNEY: readonly JourneyDef[] = [
  { id: 'register', label: 'Registro', rate: 1, minutes: 3, blockers: [] },
  { id: 'onboarding', label: 'Onboarding', rate: 0, minutes: 4, blockers: ['Verificación de correo o teléfono', 'Pantallas de permisos', 'Carga de datos personales'] },
  { id: 'search', label: 'Búsqueda', rate: 0.93, minutes: 2, blockers: ['Filtros poco claros', 'Sin resultados en su ciudad'] },
  { id: 'explore', label: 'Exploración', rate: 0.88, minutes: 6, blockers: ['Perfiles sin fotografía', 'Poca información de precios'] },
  { id: 'select', label: 'Selección', rate: 0.71, minutes: 5, blockers: ['Falta de horarios cercanos', 'Dudas sobre la verificación del médico'] },
  { id: 'action', label: 'Consulta o acción', rate: 0.64, minutes: 7, blockers: ['Pasos de confirmación', 'Método de pago'] },
  { id: 'experience', label: 'Experiencia', rate: 0.93, minutes: 30, blockers: ['Tiempo de espera', 'Problemas de conexión en telemedicina'] },
  { id: 'satisfaction', label: 'Satisfacción', rate: 0.78, minutes: 2, blockers: ['Encuesta no visible'] },
  { id: 'repeat', label: 'Repetición', rate: 0.46, minutes: 14 * 24 * 60, blockers: ['Sin recordatorios', 'No encuentra a su médico anterior'] },
  { id: 'retention', label: 'Retención', rate: 0.62, minutes: 30 * 24 * 60, blockers: ['Sin motivo para volver'] },
];

export interface JourneyModel {
  readonly stages: JourneyStage[];
  readonly csat: number;
  readonly nps: number;
  readonly scopeNote: string | null;
  readonly registered: number;
}

const PATIENT_CAMPAIGNS = ['esp-sep', 'tel-oct'] as const;

/** El recorrido del paciente se mide sobre campañas de pacientes; si la selección no tiene, se avisa. */
export function patientJourney(filter: InsightsFilter, segmentMultiplier = 1): JourneyModel {
  const ids = filter.campaignIds.filter((id) => (PATIENT_CAMPAIGNS as readonly string[]).includes(id));
  const usedIds = ids.length ? ids : [...PATIENT_CAMPAIGNS];
  const range = ids.length ? filter.range : { from: '2026-09-01', to: '2026-10-30' };
  const scope = buildScope(selectFacts({ ...filter, campaignIds: usedIds, range }));
  const registered = scope.all.registrations;
  const activationRate = registered > 0 ? scope.all.activations / registered : 0;
  let users = registered;
  const stages = JOURNEY.map((def, i): JourneyStage => {
    const rate = i === 0 ? null : (def.id === 'onboarding' ? activationRate : def.rate * noise(`j|${def.id}|${usedIds.join()}`, 0.02)) * (i > 1 ? segmentMultiplier : 1);
    users = i === 0 ? registered : Math.round(users * Math.min(1, rate ?? 1));
    const friction = rate === null ? 'low' : rate < 0.65 ? 'high' : rate < 0.8 ? 'medium' : 'low';
    return { id: def.id, label: def.label, users, rate, medianMinutes: def.minutes, friction, blockers: def.blockers };
  });
  return {
    stages,
    csat: 4.3 * noise(`csat|${usedIds.join()}`, 0.03),
    nps: Math.round(41 * noise(`nps|${usedIds.join()}`, 0.1)),
    scopeNote: ids.length ? null : 'La selección no incluye campañas de pacientes: el recorrido se mide sobre las de Búsqueda de Especialistas y Telemedicina.',
    registered,
  };
}

export const JOURNEY_SEGMENTS: readonly { id: string; label: string; multiplier: number }[] = [
  { id: 'all', label: 'Todos los pacientes', multiplier: 1 },
  { id: 'android', label: 'Android', multiplier: 0.97 },
  { id: 'ios', label: 'iOS', multiplier: 1.04 },
  { id: 'web', label: 'Web', multiplier: 0.9 },
  { id: 'new', label: 'Pacientes nuevos', multiplier: 0.93 },
  { id: 'returning', label: 'Pacientes recurrentes', multiplier: 1.08 },
];

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${(minutes / 60).toFixed(1).replace('.', ',')} h`;
  return `${Math.round(minutes / (24 * 60))} días`;
}
