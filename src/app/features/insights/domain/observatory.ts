import { addDays, eachDay } from './dates';
import type { Confidence } from './insights.types';
import { noise } from './prng';

/* ============================================================================
    Observatorio de salud: el contexto del sector que explica la demanda.

    Los elementos son ILUSTRATIVOS. Un observatorio real se alimenta de fuentes
    oficiales (autoridad sanitaria, organismos internacionales, prensa
    especializada) y cada elemento cita su fuente y su fecha. Aquí no se cita
    ninguna porque inventar una fuente sería fabricar un hecho: la pantalla lo
    dice y marca cada elemento como «Ejemplo ilustrativo».

    Cada elemento responde las mismas siete preguntas, para que una noticia no
    quede en «interesante» y llegue a una decisión.
    ========================================================================== */

export const OBSERVATORY_NOTICE =
  'Elementos ilustrativos. En producción, cada uno cita su fuente oficial y su fecha; aquí no se cita ninguna porque sería inventarla.';

export type ObservatoryCategory = 'epidemiology' | 'regulation' | 'technology' | 'habits' | 'market';
export const CATEGORY_LABELS: Readonly<Record<ObservatoryCategory, string>> = {
  epidemiology: 'Epidemiología',
  regulation: 'Regulación',
  technology: 'Tecnología de salud',
  habits: 'Hábitos de salud',
  market: 'Mercado',
};

export type Relevance = 'high' | 'medium' | 'low';
export const RELEVANCE_LABELS: Readonly<Record<Relevance, string>> = { high: 'Relevancia alta', medium: 'Relevancia media', low: 'Relevancia baja' };

export type Impact = 'opportunity' | 'risk' | 'neutral';
export const IMPACT_LABELS: Readonly<Record<Impact, string>> = { opportunity: 'Oportunidad', risk: 'Riesgo', neutral: 'Sin efecto claro' };

export interface ObservatoryItem {
  readonly id: string;
  readonly category: ObservatoryCategory;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly relevance: Relevance;
  readonly impact: Impact;
  readonly confidence: Confidence;
  /** Las siete preguntas del observatorio. */
  readonly answers: {
    readonly happened: string;
    readonly whyItMatters: string;
    readonly whoIsAffected: string;
    readonly affectsAlovida: string;
    readonly risk: string;
    readonly opportunity: string;
    readonly monitor: string;
  };
  /** Pista de tendencia (índice relativo) para el mini-gráfico. */
  readonly trendSeed: string;
  readonly trendSlope: number;
  /** Módulos de Insights donde se contrasta el tema. */
  readonly relatedTopic: string | null;
}

export const OBSERVATORY: readonly ObservatoryItem[] = [
  {
    id: 'resp', category: 'epidemiology', date: '2026-10-27', title: 'Más consultas por infecciones respiratorias en la temporada de frío',
    summary: 'Ejemplo ilustrativo de un aumento estacional de cuadros respiratorios.', relevance: 'high', impact: 'opportunity', confidence: 'medium', trendSeed: 'resp', trendSlope: 0.9, relatedTopic: 'telemedicine',
    answers: {
      happened: 'Aumenta la demanda de atención por cuadros respiratorios en la temporada de frío.',
      whyItMatters: 'Una consulta simple y urgente es el caso donde la telemedicina compite mejor con ir a un centro.',
      whoIsAffected: 'Familias con niños pequeños y adultos mayores en zonas de altura.',
      affectsAlovida: 'Sí: sube la demanda potencial de telemedicina y de consulta rápida.',
      risk: 'Saturar los horarios de los médicos disponibles y subir los tiempos de espera.',
      opportunity: 'Comunicar consulta el mismo día y orientación inicial, con horarios ampliados.',
      monitor: 'Búsquedas de «consulta online», tiempos de espera y disponibilidad de horarios.',
    },
  },
  {
    id: 'reg', category: 'regulation', date: '2026-10-22', title: 'Debate sobre reglas de telemedicina y receta digital',
    summary: 'Ejemplo ilustrativo de una discusión regulatoria que puede cambiar qué se permite a distancia.', relevance: 'high', impact: 'risk', confidence: 'low', trendSeed: 'reg', trendSlope: 0.5, relatedTopic: 'pharmacy',
    answers: {
      happened: 'Se discute qué requisitos debe cumplir una receta digital y una consulta a distancia.',
      whyItMatters: 'Una regla nueva puede obligar a cambiar flujos de receta y de verificación de profesionales.',
      whoIsAffected: 'Plataformas de salud, médicos, farmacias y pacientes que usan receta digital.',
      affectsAlovida: 'Posiblemente: toca el módulo de recetas y la verificación de títulos.',
      risk: 'Tener que rehacer el flujo de receta con poco plazo.',
      opportunity: 'Posicionarse como plataforma que ya verifica profesionales y cumple la norma.',
      monitor: 'Texto oficial de la norma, plazos de adecuación y comunicados de colegios médicos.',
    },
  },
  {
    id: 'conn', category: 'technology', date: '2026-10-19', title: 'La brecha de conexión limita la atención remota fuera de las ciudades',
    summary: 'Ejemplo ilustrativo sobre acceso a internet en provincias.', relevance: 'medium', impact: 'opportunity', confidence: 'medium', trendSeed: 'conn', trendSlope: 0.7, relatedTopic: 'rural',
    answers: {
      happened: 'Se reporta que la calidad de conexión es el principal obstáculo de la atención remota en provincias.',
      whyItMatters: 'La mayor demanda insatisfecha de atención está donde hoy es más difícil conectarse.',
      whoIsAffected: 'Personas de zonas rurales y municipios alejados.',
      affectsAlovida: 'Sí: hay conversación creciente sobre salud rural sin ninguna campaña que la atienda.',
      risk: 'Prometer telemedicina a quien no puede sostener una videollamada genera frustración.',
      opportunity: 'Ofrecer consulta por mensaje o audio y de baja conexión como puerta de entrada.',
      monitor: 'Menciones de «provincia» y «sin señal», y abandono de videollamadas por región.',
    },
  },
  {
    id: 'mental', category: 'habits', date: '2026-10-15', title: 'Crece la búsqueda de apoyo psicológico entre jóvenes',
    summary: 'Ejemplo ilustrativo de un cambio de hábito en salud mental.', relevance: 'medium', impact: 'opportunity', confidence: 'low', trendSeed: 'mental', trendSlope: 0.6, relatedTopic: 'mental',
    answers: {
      happened: 'Más jóvenes buscan orientación psicológica y lo hacen primero en línea.',
      whyItMatters: 'Es un segmento nuevo con alta intención y poca oferta verificada.',
      whoIsAffected: 'Adolescentes y adultos jóvenes de las capitales.',
      affectsAlovida: 'Parcialmente: la salud mental ya genera conversación positiva pero con pocos horarios.',
      risk: 'Atender menores sin un protocolo claro de consentimiento y derivación.',
      opportunity: 'Ampliar la oferta de psicólogos verificados y comunicar privacidad.',
      monitor: 'Disponibilidad de horarios de psicología y conversación sobre privacidad.',
    },
  },
  {
    id: 'priv', category: 'regulation', date: '2026-10-11', title: 'Mayor preocupación pública por la privacidad de datos de salud',
    summary: 'Ejemplo ilustrativo de una inquietud ciudadana sobre datos personales.', relevance: 'medium', impact: 'risk', confidence: 'medium', trendSeed: 'priv', trendSlope: 0.4, relatedTopic: 'privacy',
    answers: {
      happened: 'Crece la inquietud por dónde y cómo se guardan los datos de salud.',
      whyItMatters: 'La confianza es la condición de uso de una plataforma de salud.',
      whoIsAffected: 'Cualquier persona que cargue su historia clínica en una app.',
      affectsAlovida: 'Sí: la privacidad ya aparece entre los temas con sentimiento negativo.',
      risk: 'Que la duda frene el registro de pacientes o la carga de historia clínica.',
      opportunity: 'Explicar con claridad el consentimiento y el control de los datos.',
      monitor: 'Sentimiento del tema «Privacidad de datos» y abandono en la pantalla de consentimiento.',
    },
  },
  {
    id: 'mkt', category: 'market', date: '2026-10-08', title: 'Una plataforma competidora ofrece consultas de bajo costo',
    summary: 'Ejemplo ilustrativo de movimiento de mercado (competidor genérico).', relevance: 'high', impact: 'risk', confidence: 'low', trendSeed: 'mkt', trendSlope: 0.5, relatedTopic: 'prices',
    answers: {
      happened: 'Un competidor genérico anuncia consultas a menor precio durante un periodo.',
      whyItMatters: 'El precio ya es un tema con sentimiento negativo en nuestra conversación.',
      whoIsAffected: 'Pacientes sensibles al precio en las capitales.',
      affectsAlovida: 'Sí: puede presionar la conversión de pacientes y la comparación de tarifas.',
      risk: 'Perder conversión si la diferencia de precio se vuelve el argumento principal.',
      opportunity: 'Comunicar el valor de la verificación y de la continuidad con el mismo médico.',
      monitor: 'Menciones de precio, cuota de voz y tasa de conversión de pacientes.',
    },
  },
];

export interface ObservatoryTrend {
  readonly labels: string[];
  readonly values: number[];
}

/** Índice relativo de atención al tema en los 30 días hasta la fecha de referencia. */
export function observatoryTrend(item: ObservatoryItem, until: string): ObservatoryTrend {
  const days = eachDay(addDays(until, -29), until);
  return { labels: days, values: days.map((d, i) => Math.max(0, 30 + i * item.trendSlope * 1.2 + (noise(`${item.trendSeed}|${d}`, 0.3) - 1) * 30)) };
}
