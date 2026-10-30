import { eachDay, PROTOTYPE_TODAY, weekdayIndex } from './dates';
import { hashSeed, mulberry32 } from './prng';

/* ============================================================================
    Menciones sintéticas de opinión pública.

    Todo es de demostración: los textos son plantillas genéricas, no hay
    personas ni cuentas reales. Se generan por día con una semilla estable para
    que dos cargas muestren lo mismo. Se inyectan tres hechos que los análisis
    deben encontrar: la verificación de médicos empeora desde el 22 de octubre,
    el rendimiento de la app se queja más desde el 20, y «salud en zonas
    rurales» crece sin que ninguna campaña lo cubra.
    ========================================================================== */

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type MentionKind = 'question' | 'complaint' | 'praise' | 'suggestion' | 'rumor' | 'comment';
export type MentionSource = 'instagram' | 'tiktok' | 'facebook' | 'youtube' | 'prensa' | 'foros';

export const SOURCES: readonly MentionSource[] = ['instagram', 'tiktok', 'facebook', 'youtube', 'prensa', 'foros'];
export const SOURCE_NAMES: Readonly<Record<MentionSource, string>> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  prensa: 'Prensa digital',
  foros: 'Foros y reseñas',
};

export const SENTIMENT_LABELS: Readonly<Record<Sentiment, string>> = { positive: 'Positivo', neutral: 'Neutral', negative: 'Negativo' };
export const KIND_LABELS: Readonly<Record<MentionKind, string>> = {
  question: 'Pregunta',
  complaint: 'Queja',
  praise: 'Elogio',
  suggestion: 'Sugerencia',
  rumor: 'Rumor',
  comment: 'Comentario',
};

export interface TopicDef {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly positive: number;
  readonly negative: number;
  readonly texts: Readonly<Record<Sentiment, readonly string[]>>;
}

export const TOPICS: readonly TopicDef[] = [
  { id: 'telemedicine', label: 'Telemedicina', weight: 0.17, positive: 0.58, negative: 0.12, texts: { positive: ['Pude consultar sin viajar, muy práctico.', 'La videollamada con el especialista salió muy bien.'], neutral: ['¿La telemedicina sirve para todas las especialidades?', 'Quisiera saber cómo se agenda una videoconsulta.'], negative: ['La videollamada se cortó a mitad de la consulta.', 'Pagué la telemedicina y no pude conectarme.'] } },
  { id: 'verification', label: 'Verificación de médicos', weight: 0.1, positive: 0.5, negative: 0.15, texts: { positive: ['Me da confianza que los perfiles estén verificados.', 'Ver el título verificado del médico me tranquiliza.'], neutral: ['¿Cómo verifican los títulos de los especialistas?', '¿Dónde veo que el médico está registrado?'], negative: ['Encontré un perfil sin verificar atendiendo.', 'Tardaron mucho en verificar a mi médico de cabecera.'] } },
  { id: 'prices', label: 'Precios y costos', weight: 0.12, positive: 0.25, negative: 0.35, texts: { positive: ['El precio de la consulta es razonable.', 'Me ahorré dinero comparando tarifas.'], neutral: ['¿Cuánto cuesta una consulta con un especialista?', '¿Aceptan seguros o solo pago directo?'], negative: ['Las consultas están caras para lo que ofrecen.', 'No entiendo el cobro adicional que me hicieron.'] } },
  { id: 'waiting', label: 'Tiempos de espera', weight: 0.1, positive: 0.2, negative: 0.4, texts: { positive: ['Me atendieron a la hora acordada.', 'Casi no esperé en la sala virtual.'], neutral: ['¿Cuánto tarda normalmente una cita?', '¿Hay horarios disponibles esta semana?'], negative: ['Esperé más de media hora para que me atendieran.', 'No hay horarios cercanos, todo está lleno.'] } },
  { id: 'app', label: 'Rendimiento de la app', weight: 0.12, positive: 0.3, negative: 0.38, texts: { positive: ['La app es fácil de usar.', 'Reservé mi cita en un minuto desde el celular.'], neutral: ['¿Hay versión de la app para iPhone?', '¿Cómo actualizo la app?'], negative: ['La app se queda cargando al registrarme.', 'Se cierra sola cuando abro mi historia clínica.'] } },
  { id: 'privacy', label: 'Privacidad de datos', weight: 0.06, positive: 0.2, negative: 0.3, texts: { positive: ['Me explicaron claramente cómo cuidan mis datos.', 'Agradezco que pidan mi consentimiento.'], neutral: ['¿Quién puede ver mi historia clínica?', '¿Dónde se guardan mis datos?'], negative: ['No me queda claro qué hacen con mi información.', 'Me preocupa que mis datos de salud estén en una app.'] } },
  { id: 'support', label: 'Atención al cliente', weight: 0.1, positive: 0.45, negative: 0.25, texts: { positive: ['El soporte me respondió rápido y con amabilidad.', 'Resolvieron mi duda en el mismo día.'], neutral: ['¿Hay un número de contacto de soporte?', '¿En qué horario atienden los reclamos?'], negative: ['Escribí al soporte y nadie respondió.', 'Tuve que repetir mi problema tres veces.'] } },
  { id: 'pharmacy', label: 'Farmacia y recetas', weight: 0.08, positive: 0.4, negative: 0.2, texts: { positive: ['Pedir mis medicamentos desde la receta fue sencillo.', 'La receta digital me ahorró una visita.'], neutral: ['¿Las farmacias aceptan la receta digital?', '¿Hay envío a domicilio de medicamentos?'], negative: ['La farmacia no reconoció mi receta digital.', 'Mi pedido de medicamentos llegó incompleto.'] } },
  { id: 'rural', label: 'Salud en zonas rurales', weight: 0.04, positive: 0.55, negative: 0.1, texts: { positive: ['Sería ideal para quienes vivimos lejos de la ciudad.', 'Ojalá llegue pronto a mi provincia.'], neutral: ['¿Funciona con poca señal de internet?', '¿Atienden a comunidades fuera de las capitales?'], negative: ['Donde vivo la conexión no alcanza para una videollamada.', 'No hay médicos de AloVida cerca de mi localidad.'] } },
  { id: 'mental', label: 'Salud mental', weight: 0.05, positive: 0.5, negative: 0.1, texts: { positive: ['Me ayudó poder hablar con un psicólogo desde casa.', 'Es bueno que existan opciones de salud mental.'], neutral: ['¿Tienen psicólogos para adolescentes?', '¿Cuántas sesiones incluye el plan?'], negative: ['Cuesta encontrar un psicólogo con horario disponible.', 'La primera sesión fue muy corta.'] } },
];

export const DEPARTMENTS: readonly { id: string; label: string; weight: number }[] = [
  { id: 'scz', label: 'Santa Cruz', weight: 0.36 },
  { id: 'lpz', label: 'La Paz', weight: 0.26 },
  { id: 'cbba', label: 'Cochabamba', weight: 0.17 },
  { id: 'chq', label: 'Chuquisaca', weight: 0.06 },
  { id: 'tja', label: 'Tarija', weight: 0.05 },
  { id: 'oru', label: 'Oruro', weight: 0.03 },
  { id: 'pts', label: 'Potosí', weight: 0.03 },
  { id: 'ben', label: 'Beni', weight: 0.025 },
  { id: 'pnd', label: 'Pando', weight: 0.005 },
];

const SOURCE_WEIGHTS: Readonly<Record<MentionSource, number>> = { instagram: 0.27, tiktok: 0.2, facebook: 0.22, youtube: 0.08, prensa: 0.05, foros: 0.18 };

export interface Mention {
  readonly id: string;
  readonly date: string;
  readonly source: MentionSource;
  readonly topic: string;
  readonly sentiment: Sentiment;
  readonly kind: MentionKind;
  readonly department: string;
  readonly text: string;
  readonly reach: number;
  readonly needsResponse: boolean;
  readonly responded: boolean;
}

export const OPINION_START = '2026-08-01';

/** Peso del tema el día `date`, con los hechos inyectados. */
function topicWeight(topic: TopicDef, date: string): number {
  if (topic.id === 'verification' && date >= '2026-10-22') return topic.weight * 2.4;
  if (topic.id === 'app' && date >= '2026-10-20') return topic.weight * 1.5;
  if (topic.id === 'rural' && date >= '2026-10-12') return topic.weight * (1 + Math.min(4, (Date.parse(date) - Date.parse('2026-10-12')) / 86_400_000 / 4));
  return topic.weight;
}

/** Proporción [positiva, negativa] del tema ese día, con los hechos inyectados. */
function shares(topic: TopicDef, date: string): readonly [number, number] {
  if (topic.id === 'verification' && date >= '2026-10-22') return [0.3, 0.6];
  if (topic.id === 'app' && date >= '2026-10-20') return [0.15, 0.7];
  return [topic.positive, topic.negative];
}

function pick<T>(items: readonly { item: T; w: number }[], r: number): T {
  const total = items.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of items) {
    acc += x.w / total;
    if (r <= acc) return x.item;
  }
  return items[items.length - 1]!.item;
}

function kindOf(sentiment: Sentiment, topic: string, r: number): MentionKind {
  if (sentiment === 'positive') return r < 0.7 ? 'praise' : 'comment';
  if (sentiment === 'negative') return r < 0.65 ? 'complaint' : r < 0.9 ? 'suggestion' : 'rumor';
  return r < 0.75 ? 'question' : topic === 'privacy' ? 'rumor' : 'comment';
}

let cache: readonly Mention[] | null = null;

export function allMentions(): readonly Mention[] {
  if (cache) return cache;
  const out: Mention[] = [];
  for (const date of eachDay(OPINION_START, PROTOTYPE_TODAY)) {
    const rand = mulberry32(hashSeed(`op|${date}`));
    const weekend = weekdayIndex(date) >= 5 ? 0.8 : 1;
    const campaignBoost = date >= '2026-10-01' ? 1.25 : 1;
    const count = Math.round(62 * weekend * campaignBoost * (0.88 + rand() * 0.24));
    const ageDays = Math.round((Date.parse(PROTOTYPE_TODAY) - Date.parse(date)) / 86_400_000);
    for (let i = 0; i < count; i += 1) {
      const topic = pick(TOPICS.map((t) => ({ item: t, w: topicWeight(t, date) })), rand());
      const [pos, neg] = shares(topic, date);
      const r = rand();
      const sentiment: Sentiment = r < pos ? 'positive' : r < pos + neg ? 'negative' : 'neutral';
      const kind = kindOf(sentiment, topic.id, rand());
      const source = pick(SOURCES.map((s) => ({ item: s, w: SOURCE_WEIGHTS[s] })), rand());
      const department = pick(DEPARTMENTS.map((d) => ({ item: d.id, w: d.weight })), rand());
      const texts = topic.texts[sentiment];
      const reach = Math.round(40 + Math.pow(rand(), 3) * (source === 'prensa' ? 9000 : 1800));
      // Se responde casi todo lo antiguo; lo reciente queda pendiente. La cola es la parte real del módulo.
      const needsResponse = sentiment === 'negative' || kind === 'question';
      const responded = needsResponse && (ageDays > 4 ? rand() < 0.92 : ageDays > 1 ? rand() < 0.6 : rand() < 0.2);
      out.push({ id: `m-${date}-${i}`, date, source, topic: topic.id, sentiment, kind, department, text: texts[Math.floor(rand() * texts.length)]!, reach, needsResponse, responded });
    }
  }
  cache = out;
  return out;
}
