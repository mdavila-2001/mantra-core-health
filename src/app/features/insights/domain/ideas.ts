import { formatInt, formatPercent } from './format';
import { formatNet, topicTable, type OpinionFilter } from './opinion';

/* ============================================================================
    Ideas de campaña: lo que los datos sugieren probar. Una idea NO es un resultado:
    lleva su evidencia (calculada de la conversación), un límite que no puede
    sobrepasar y cómo se mediría. Ordenadas por qué tan pronto conviene hacerla.
    ========================================================================== */

export type IdeaPriority = 'Hacer ya' | 'Probar en chico' | 'Validar antes' | 'Vigilar';
export const IDEA_PRIORITIES: readonly IdeaPriority[] = ['Hacer ya', 'Probar en chico', 'Validar antes', 'Vigilar'];

export interface Idea {
  readonly id: string;
  readonly title: string;
  readonly priority: IdeaPriority;
  readonly confidence: 'Alta' | 'Media' | 'Baja';
  /** Campaña existente a la que se suma, o `null` si sería una campaña nueva. */
  readonly campaignId: string | null;
  readonly evidence: readonly string[];
  readonly who: string;
  readonly channel: string;
  readonly angle: string;
  readonly measure: string;
  readonly guard: string;
  /** Elementos del entorno que la sostienen. */
  readonly environment: readonly string[];
}


interface Base extends Omit<Idea, 'evidence'> {
  readonly topic: string;
}

const BASES: readonly Base[] = [
  { id: 'i1', topic: 'pharmacy', title: 'Sin recorrer farmacias', priority: 'Probar en chico', confidence: 'Media', campaignId: 'c3', who: 'Familias que compran medicamentos cada mes', channel: 'Facebook y correo', angle: 'Compare el precio de su receta antes de salir de casa.', measure: 'Consultas de precio por semana y conversión a canje.', guard: 'No afirmar ahorros que no estén en el catálogo de la farmacia aliada.', environment: ['prices', 'pharmacies'] },
  { id: 'i2', topic: 'privacy', title: 'Sus datos, sus reglas', priority: 'Hacer ya', confidence: 'Alta', campaignId: 'c4', who: 'Pacientes crónicos y cuidadores', channel: 'Instagram y YouTube', angle: 'Usted decide quién ve su historial, y puede cambiarlo cuando quiera.', measure: 'Sentimiento sobre privacidad y registros del historial.', guard: 'No prometer seguridad absoluta ni citar normas que no se hayan verificado.', environment: ['privacy'] },
  { id: 'i3', topic: 'telemedicine', title: 'Su cita sin vueltas', priority: 'Validar antes', confidence: 'Baja', campaignId: null, who: 'Personas que buscan agendar en línea', channel: 'Búsqueda y TikTok', angle: 'Agende en línea con médicos verificados, sin llamadas.', measure: 'Búsquedas atendidas y citas agendadas desde la pieza.', guard: 'Validar primero que haya agenda disponible en las especialidades más buscadas.', environment: ['search', 'queues'] },
  { id: 'i4', topic: 'verification', title: 'Médicos que dan la cara', priority: 'Probar en chico', confidence: 'Media', campaignId: 'c1', who: 'Médicos generales y especialistas', channel: 'Google y correo', angle: 'Verificación en 24 horas, con un sello que el paciente puede comprobar.', measure: 'Altas de médicos verificados por semana.', guard: 'Resolver antes los reclamos abiertos sobre la verificación.', environment: ['license', 'fraud'] },
  { id: 'i5', topic: 'none', title: 'Su historial a mano en temporada de lluvias', priority: 'Vigilar', confidence: 'Baja', campaignId: 'c4', who: 'Familias con niños y adultos mayores', channel: 'Instagram', angle: 'Lleve su historial a la consulta de urgencia.', measure: 'Uso del historial en consultas respiratorias.', guard: 'No es una pieza médica: no sugerir diagnósticos ni tratamientos.', environment: ['rain'] },
  { id: 'i6', topic: 'prices', title: 'Cuánto gasta su hogar en salud', priority: 'Validar antes', confidence: 'Baja', campaignId: null, who: 'Hogares con presupuesto ajustado', channel: 'Facebook', angle: 'Vea cuánto gasta y dónde puede ahorrar.', measure: 'Uso de la vista de gastos y registros nuevos.', guard: 'Validar con una muestra de usuarios antes de invertir.', environment: ['inflation'] },
];

/** Cada idea con su evidencia calculada de la conversación del periodo. */
export function ideas(filter: OpinionFilter): Idea[] {
  const topics = topicTable(filter);
  const byTopic = (id: string) => topics.find((t) => t.id === id) ?? null;
  const out = BASES.map(({ topic, ...b }) => {
    const t = byTopic(topic);
    const evidence = t
      ? [`«${t.label}»: ${formatInt(t.volume)} menciones en el periodo${t.growth !== null ? ` (${t.growth >= 0 ? '+' : ''}${formatPercent(t.growth, 0)} frente al anterior)` : ''}.`, t.summary.net === null ? 'Sentimiento sin muestra suficiente.' : `Sentimiento neto de ${formatNet(t.summary.net)} puntos.`]
      : ['Todavía no hay menciones suficientes de este tema para medirlo: es una hipótesis del equipo, no un hallazgo.'];
    return { ...b, evidence } satisfies Idea;
  });
  return out.sort((a, b) => IDEA_PRIORITIES.indexOf(a.priority) - IDEA_PRIORITIES.indexOf(b.priority));
}
