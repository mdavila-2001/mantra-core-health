import { CAMPAIGNS } from './campaigns.data';
import { addDays, PROTOTYPE_TODAY } from './dates';
import type { MarketingAlert } from './insights.types';
import { OBSERVATORY } from './observatory';
import { formatNet, responseStats, select, summarize, topicShifts, topicTable, type OpinionFilter } from './opinion';
import { SOURCES, TOPICS } from './opinion.data';
import { formatPercent } from './format';

/* ============================================================================
    Alertas que nacen de señales distintas de la pauta: opinión pública y
    observatorio. Mismas reglas que las de campaña: la causa se escribe como
    hipótesis, el nivel sale de un umbral explícito y cada alerta lleva su
    evidencia.

      riesgo       — el sentimiento de un tema cae ≥ 20 puntos en la última semana
      crítico      — además cae ≥ 45 puntos y el volumen diario se duplica
      oportunidad  — un tema crece con volumen suficiente y NINGUNA campaña lo cubre
    ========================================================================== */

const LAST_DAY = addDays(PROTOTYPE_TODAY, -1);
const FILTER: OpinionFilter = { range: { from: addDays(LAST_DAY, -28), to: LAST_DAY }, sources: SOURCES };

function netSeries(topicId: string): number[] {
  const out: number[] = [];
  for (let back = 17; back >= 0; back -= 1) {
    const day = addDays(LAST_DAY, -back);
    const s = summarize(select({ range: { from: addDays(day, -2), to: day }, sources: SOURCES }).filter((m) => m.topic === topicId));
    if (s.net !== null) out.push(s.net * 100);
  }
  return out;
}

/** Palabras que delatan que una campaña atiende el tema. Por omisión, el nombre del tema. */
const COVERAGE_WORDS: Readonly<Record<string, readonly string[]>> = {
  rural: ['rural', 'provincia'],
  mental: ['mental', 'psicolog'],
  telemedicine: ['telemedicina'],
  pharmacy: ['farmacia', 'receta'],
};

const COVERED_BY_CAMPAIGN: Readonly<Record<string, boolean>> = Object.fromEntries(
  TOPICS.map((t) => {
    const words = COVERAGE_WORDS[t.id] ?? [t.label.toLowerCase()];
    return [t.id, CAMPAIGNS.some((c) => words.some((w) => `${c.name} ${c.objective}`.toLowerCase().includes(w)))];
  }),
);

export function signalAlerts(): MarketingAlert[] {
  const out: MarketingAlert[] = [];
  const total = select(FILTER).length;
  const base = { detectedAt: LAST_DAY, status: 'open' as const, module: 'opinion' as const, query: {} as Record<string, string> };

  for (const shift of topicShifts(FILTER, 40).filter((s) => s.delta <= -0.2)) {
    const surge = shift.baselineDailyVolume > 0 ? shift.recentDailyVolume / shift.baselineDailyVolume : 1;
    const critical = shift.delta <= -0.45 && surge >= 2;
    out.push({
      ...base,
      id: `sent-${shift.id}`,
      severity: critical ? 'critical' : 'risk',
      title: `El sentimiento sobre «${shift.label}» cayó ${(Math.abs(shift.delta) * 100).toFixed(0)} puntos en una semana`,
      what: `El sentimiento neto pasó de ${formatNet(shift.baselineNet)} a ${formatNet(shift.recentNet)} puntos y el volumen diario es ${surge.toFixed(1).replace('.', ',')}× el habitual.`,
      magnitude: `${formatNet(shift.delta)} pts · ${shift.recentVolume.toLocaleString('es-BO')} menciones recientes`,
      source: 'Opinión pública (menciones clasificadas)',
      cause: 'Hipótesis: un cambio reciente del producto, una nota de prensa o un caso viral. El clasificador estima el sentimiento y puede errar con la ironía; no hay causa confirmada.',
      impact: 'Una caída de confianza sobre este tema puede frenar el registro y la conversión aunque la pauta rinda.',
      confidence: shift.recentVolume >= 100 ? 'medium' : 'low',
      recommendation: 'Leer una muestra de las menciones negativas recientes, atender la cola de respuesta y avisar a producto si el tema es de funcionamiento.',
      evidence: [
        `Últimos 7 días (desde ${shift.since}) frente a las 3 semanas previas.`,
        `Volumen diario: ${shift.recentDailyVolume.toFixed(0)} frente a ${shift.baselineDailyVolume.toFixed(0)} menciones.`,
        'El sentimiento es estimado automáticamente; no es una encuesta.',
      ],
      series: netSeries(shift.id),
    });
  }

  const queue = responseStats(FILTER);
  if (queue.pending >= 100 && queue.rate !== null && queue.rate < 0.9) {
    out.push({
      ...base,
      id: 'response-backlog',
      severity: 'risk',
      title: `${queue.pending.toLocaleString('es-BO')} menciones esperan respuesta`,
      what: `Solo ${formatPercent(queue.rate, 0)} de las menciones con una pregunta o queja tiene respuesta registrada.`,
      magnitude: `${queue.pending.toLocaleString('es-BO')} de ${queue.needing.toLocaleString('es-BO')} sin atender`,
      source: 'Opinión pública (cola de respuesta)',
      cause: 'Hipótesis: el volumen de menciones creció más que la capacidad del equipo de comunidad. Falta medir el tiempo de primera respuesta.',
      impact: 'Una queja sin respuesta pública amplifica el sentimiento negativo y deja una necesidad sin resolver.',
      confidence: 'medium',
      recommendation: 'Priorizar la cola por alcance y gravedad, y preparar respuestas tipo para los temas con más quejas.',
      evidence: [`${queue.needing.toLocaleString('es-BO')} menciones piden respuesta en el periodo.`],
      series: [],
    });
  }

  const gap = topicTable(FILTER).find((t) => t.emerging && !COVERED_BY_CAMPAIGN[t.id] && (t.summary.net ?? 0) > 0);
  if (gap) {
    const context = OBSERVATORY.find((o) => o.relatedTopic === gap.id);
    out.push({
      ...base,
      id: `gap-${gap.id}`,
      severity: 'opportunity',
      title: `Brecha de oportunidad: crece la conversación sobre «${gap.label}» y ninguna campaña la atiende`,
      what: `${gap.volume.toLocaleString('es-BO')} menciones en 4 semanas (${gap.growth !== null ? `+${(gap.growth * 100).toFixed(0)} %` : 'crecimiento sin base comparable'}) con sentimiento neto ${formatNet(gap.summary.net)}.`,
      magnitude: `${gap.volume.toLocaleString('es-BO')} menciones · neto ${formatNet(gap.summary.net)}`,
      source: context ? 'Opinión pública y Observatorio de salud' : 'Opinión pública',
      cause: 'Hipótesis: hay una necesidad sin cobertura. Podría ser un efecto de una nota de prensa puntual; hay que ver si se sostiene varias semanas.',
      impact: 'Si la demanda es real, es una audiencia con intención y sin competencia directa en nuestra comunicación.',
      confidence: 'medium',
      recommendation: 'Validar la demanda con una prueba pequeña (un mensaje o formato de baja conexión) antes de dedicar presupuesto.',
      evidence: [
        'Ninguna campaña activa o reciente menciona este tema en su objetivo.',
        ...(context ? [`Contexto del observatorio (ilustrativo): ${context.title}.`] : []),
      ],
      series: netSeries(gap.id),
      module: 'observatory',
    });
  }
  return out;
}
