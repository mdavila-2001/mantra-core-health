import { detectAllShifts, detectOnboardingShift, lastActiveDay, type Shift } from './anomalies';
import { CAMPAIGN_BY_ID } from './campaigns.data';
import { addDays } from './dates';
import { formatChange, formatMoney, formatPercent } from './format';
import type { Channel, MarketingAlert, MetricId } from './insights.types';
import { CHANNEL_LABELS, CHANNELS } from './insights.types';
import { timeSeries } from './kpi';

/* ============================================================================
    Alertas de marketing.

    Una alerta no es un número que cambió: es una señal con magnitud, fuente,
    evidencia, confianza y recomendación. La causa SIEMPRE se escribe como
    hipótesis (nunca como hecho) salvo que exista evidencia que la confirme, y
    el nivel se asigna por reglas explícitas:

      crítico       — un costo por resultado o un retorno se degrada ≥ 20 %
      posible riesgo — degradación entre 10 y 20 %, o una etapa del embudo se fuga
      anomalía      — cambio grande y no dañino (hay que verificarlo, no celebrarlo)
      oportunidad   — señal de demanda sin cobertura (ver `opportunityAlerts`)
    ========================================================================== */

function dailySeries(campaignId: string, metric: MetricId, end: string, channel: Channel | null): number[] {
  return timeSeries(
    {
      campaignIds: [campaignId],
      range: { from: addDays(end, -18), to: end },
      grain: 'day',
      channels: channel ? [channel] : CHANNELS,
      metric,
    },
    metric,
  )
    .map((p) => p.kpi.value)
    .filter((v): v is number => v !== null);
}

function find(shifts: readonly Shift[], campaignId: string, metric: MetricId, channel: Channel | null): Shift | undefined {
  return shifts.find((s) => s.campaignId === campaignId && s.metric === metric && s.channel === channel);
}

const pct = (fraction: number): string => formatPercent(Math.abs(fraction), 0);

export function campaignAlerts(): MarketingAlert[] {
  const shifts = detectAllShifts();
  const out: MarketingAlert[] = [];

  for (const campaign of CAMPAIGN_BY_ID.values()) {
    const end = lastActiveDay(campaign.id);
    if (!end) continue;
    const name = campaign.name;

    const cpa = find(shifts, campaign.id, 'cpa', null);
    const cac = find(shifts, campaign.id, 'cac', null);
    const roas = find(shifts, campaign.id, 'roas', null);
    const cost = [cpa, cac].filter((s): s is Shift => !!s && s.harmful).sort((a, b) => b.change - a.change)[0];
    if (cost) {
      const label = cost.metric.toUpperCase();
      out.push({
        id: `cost-${campaign.id}`,
        severity: cost.change >= 0.2 ? 'critical' : 'risk',
        title: `${label} de «${name}» aumentó ${pct(cost.change)} en 5 días`,
        what: `El costo por resultado de la campaña está ${pct(cost.change)} por encima de las dos semanas previas (${formatMoney(cost.recent)} frente a ${formatMoney(cost.baseline)}).`,
        detectedAt: end,
        magnitude: `${formatChange(cost.change)} · z = ${cost.z.toFixed(1).replace('.', ',')}`,
        source: 'Hechos diarios de campaña',
        cause:
          'Hipótesis: el encarecimiento de Instagram y Facebook (CPM al alza) coincide con una caída de leads en esos canales; no está confirmado que sea la causa única.',
        impact: roas ? `El ROAS cayó ${pct(roas.change)} en la misma ventana.` : 'Cada resultado adicional cuesta más; el presupuesto rinde menos.',
        confidence: cost.z > 5 ? 'high' : 'medium',
        recommendation: 'Revisar la entrega en Instagram y Facebook, redistribuir presupuesto hacia canales con CPA estable y comprobar el formulario de registro.',
        evidence: [
          `Ventana reciente de ${cost.recentDays} días frente a base de ${cost.baselineDays} días.`,
          `Variación diaria de la base: la puntuación z (${cost.z.toFixed(1).replace('.', ',')}) indica que no es ruido.`,
          ...(cac && cost.metric !== 'cac' ? [`CAC: ${formatChange(cac.change)}.`] : []),
        ],
        module: 'campaigns',
        query: { c: campaign.id, m: cost.metric, p: '30d' },
        series: dailySeries(campaign.id, cost.metric, end, null),
        status: 'open',
      });
    }

    for (const channel of ['instagram', 'facebook'] as const) {
      const cpm = find(shifts, campaign.id, 'cpm', channel);
      if (cpm && cpm.harmful) {
        out.push({
          id: `cpm-${campaign.id}-${channel}`,
          severity: 'risk',
          title: `El CPM de ${CHANNEL_LABELS[channel]} subió ${pct(cpm.change)}`,
          what: `Mil impresiones en ${CHANNEL_LABELS[channel]} cuestan ${formatMoney(cpm.recent)}, ${pct(cpm.change)} más que en las dos semanas previas.`,
          detectedAt: end,
          magnitude: `${formatChange(cpm.change)} · z = ${cpm.z.toFixed(1).replace('.', ',')}`,
          source: 'Hechos diarios por canal',
          cause: 'Hipótesis: mayor competencia en la subasta o audiencia demasiado acotada. Falta contrastar con la frecuencia y el calendario de otros anunciantes.',
          impact: 'A igual presupuesto se compran menos impresiones y se generan menos clics.',
          confidence: 'medium',
          recommendation: 'Ampliar la segmentación o probar otro horario de entrega antes de subir la puja.',
          evidence: [`Base de ${cpm.baselineDays} días y ventana de ${cpm.recentDays} días en ${CHANNEL_LABELS[channel]}.`],
          module: 'campaigns',
          query: { c: campaign.id, m: 'cpm', ch: channel, p: '30d' },
          series: dailySeries(campaign.id, 'cpm', end, channel),
          status: 'open',
        });
      }
    }

    const onboarding = detectOnboardingShift(campaign.id, end);
    if (onboarding && onboarding.change >= 0.1) {
      out.push({
        id: `onboarding-${campaign.id}`,
        severity: onboarding.change >= 0.25 ? 'critical' : 'risk',
        title: `El abandono del onboarding aumentó ${pct(onboarding.change)}`,
        what: `Entre quienes se registran en «${name}», no llegan a activarse el ${formatPercent(onboarding.abandonmentRecent, 1)} (antes ${formatPercent(onboarding.abandonmentBaseline, 1)}).`,
        detectedAt: end,
        magnitude: `${formatChange(onboarding.change)} · ${onboarding.registrations.toLocaleString('es-BO')} registros en la ventana`,
        source: 'Embudo de adquisición',
        cause: 'Hipótesis: un cambio reciente en el flujo de verificación o una mayor proporción de tráfico de baja intención. No se ha comprobado.',
        impact: 'Se paga por registros que no se convierten en usuarios activos: sube el CAC aunque el CPA parezca estable.',
        confidence: 'medium',
        recommendation: 'Revisar el flujo de onboarding paso a paso y comparar el abandono por canal de origen.',
        evidence: ['Ventana de 10 días contra los 14 anteriores.', `Más de ${Math.floor(onboarding.registrations / 100) * 100} registros en la ventana reciente: muestra suficiente.`],
        module: 'funnel',
        query: { c: campaign.id, p: '30d' },
        series: dailySeries(campaign.id, 'conversionRate', end, null),
        status: 'open',
      });
    }

    for (const channel of CHANNELS) {
      const ctr = find(shifts, campaign.id, 'ctr', channel);
      if (ctr && !ctr.harmful && ctr.change >= 0.5) {
        out.push({
          id: `ctr-${campaign.id}-${channel}`,
          severity: 'anomaly',
          title: `${CHANNEL_LABELS[channel]} presenta un CTR ${pct(ctr.change)} superior a su promedio reciente`,
          what: `El CTR de ${CHANNEL_LABELS[channel]} pasó de ${formatPercent(ctr.baseline)} a ${formatPercent(ctr.recent)}.`,
          detectedAt: end,
          magnitude: `${formatChange(ctr.change)} · z = ${ctr.z.toFixed(1).replace('.', ',')}`,
          source: 'Hechos diarios por canal',
          cause: 'Hipótesis: un creativo nuevo funciona mejor. También puede ser tráfico no humano o clics accidentales: no celebre hasta ver la conversión posterior.',
          impact: 'Si la conversión acompaña, es una oportunidad de redistribuir presupuesto; si no, el costo por clic engaña.',
          confidence: 'medium',
          recommendation: 'Contrastar con la tasa de conversión del canal y con la calidad de los registros antes de subir inversión.',
          evidence: [`Ventana de ${ctr.recentDays} días frente a base de ${ctr.baselineDays}.`],
          module: 'campaigns',
          query: { c: campaign.id, m: 'ctr', ch: channel, p: '30d' },
          series: dailySeries(campaign.id, 'ctr', end, channel),
          status: 'open',
        });
      }
    }
  }
  return out;
}

const SEVERITY_ORDER = { critical: 0, risk: 1, anomaly: 2, opportunity: 3 } as const;

/** Todas las alertas, ordenadas por gravedad y por fecha. */
export function buildAlerts(): MarketingAlert[] {
  return [...campaignAlerts()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.detectedAt.localeCompare(a.detectedAt),
  );
}
