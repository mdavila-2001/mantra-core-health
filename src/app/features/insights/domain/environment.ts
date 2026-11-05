import { CAMPAIGNS } from './campaigns.data';

/* ============================================================================
    Salud y economía: lo que pasa afuera y toca a las campañas.

    Elementos ILUSTRATIVOS: no se cita una fuente real porque inventarla sería falsificarla.
    Cada uno declara a qué campañas toca y si es riesgo o oportunidad para ellas (nivel 1–3).
    ========================================================================== */

export type EnvArea = 'Salud' | 'Economía';
export type EnvKind = 'Riesgo' | 'Oportunidad' | 'Vigilar';

export interface EnvItem {
  readonly id: string;
  readonly area: EnvArea;
  readonly date: string;
  readonly title: string;
  readonly kind: EnvKind;
  readonly relevance: number;
  /** Por campaña: `r` = riesgo, `o` = oportunidad, y su nivel (1 bajo, 3 alto). */
  readonly effects: Readonly<Record<string, readonly ['r' | 'o', 1 | 2 | 3]>>;
  readonly impact: string;
  readonly action: string;
  readonly monitor: string;
}

const item = (id: string, area: EnvArea, date: string, title: string, kind: EnvKind, relevance: number, effects: EnvItem['effects'], impact: string, action: string, monitor: string): EnvItem => ({ id, area, date, title, kind, relevance, effects, impact, action, monitor });

export const ENVIRONMENT: readonly EnvItem[] = [
  item('privacy', 'Salud', '2026-10-27', 'Debate público sobre la privacidad de los datos de salud', 'Riesgo', 92, { c4: ['r', 3], c2: ['r', 1] }, 'La gente duda de dónde queda su historial; el mensaje «todo en un solo lugar» puede leerse como riesgo.', 'Aclarar quién ve el historial y cómo se controla, antes de seguir empujando «un solo lugar».', 'Menciones de privacidad y su sentimiento cada semana.'),
  item('license', 'Salud', '2026-10-24', 'Una nueva norma exige verificar la matrícula de los profesionales', 'Oportunidad', 88, { c1: ['o', 2] }, 'AloVida ya verifica en 24 h: la norma vuelve valioso lo que hoy es un diferencial.', 'Poner la verificación como mensaje principal de la campaña de médicos.', 'Registros de médicos verificados por semana.'),
  item('vaccine', 'Salud', '2026-10-22', 'Campaña nacional de vacunación de invierno', 'Oportunidad', 61, { c2: ['o', 1] }, 'Más familias buscan dónde vacunarse y cómo agendar.', 'Probar una pieza corta sobre agendar sin filas.', 'Búsquedas de «vacunas» y «citas».'),
  item('prices', 'Economía', '2026-10-21', 'Suben los precios de medicamentos importados', 'Oportunidad', 84, { c3: ['o', 3] }, 'El ahorro en genéricos pasa de «ventaja» a «necesidad» para muchos hogares.', 'Reforzar «compare el precio de su receta» y los genéricos.', 'Consultas de precio y conversión de la campaña de ahorro.'),
  item('inflation', 'Economía', '2026-10-19', 'La inflación reduce el gasto de los hogares en salud', 'Riesgo', 73, { c3: ['r', 2], c4: ['r', 1] }, 'Una parte del público pospone consultas: puede bajar la conversión.', 'Mostrar el costo total de una consulta antes del pago.', 'Abandono entre «ver precio» y «pagar».'),
  item('telehealth', 'Salud', '2026-10-18', 'La ley de telemedicina se revisa en la Asamblea', 'Vigilar', 58, { c1: ['r', 1] }, 'Un cambio de reglas podría exigir ajustes en cómo se ofrece la consulta a distancia.', 'No prometer nada sobre telemedicina hasta que se publique el texto.', 'Calendario legislativo y nota de la asesoría legal.'),
  item('pharmacies', 'Economía', '2026-10-16', 'Cadenas de farmacias abren más sedes en Santa Cruz', 'Oportunidad', 66, { c3: ['o', 2] }, 'Más puntos donde canjear precios y retirar recetas.', 'Invitar a las nuevas sedes a sumarse a la red de aliadas.', 'Farmacias nuevas por zona.'),
  item('queues', 'Salud', '2026-10-14', 'Colapso de turnos en hospitales públicos', 'Oportunidad', 79, { c2: ['o', 2] }, 'El mensaje «sin filas» conecta con una molestia vivida esta semana.', 'Anclar la maqueta del anillo en la espera de turnos.', 'Menciones de «filas» y «turnos».'),
  item('rival', 'Salud', '2026-10-12', 'Un competidor lanza una agenda médica gratuita', 'Vigilar', 70, { c1: ['r', 2], c2: ['r', 1] }, 'Puede captar a médicos que buscan agenda sin costo.', 'Comparar propuesta de valor y precio antes de su próxima campaña.', 'Altas de médicos y menciones del competidor.'),
  item('fx', 'Economía', '2026-10-10', 'El tipo de cambio presiona los costos de publicidad digital', 'Vigilar', 55, { c1: ['r', 1], c2: ['r', 1], c3: ['r', 1] }, 'Las plataformas cobran en dólares: el costo por resultado puede subir sin que la campaña cambie.', 'Revisar el costo por resultado semanalmente y reasignar presupuesto.', 'CPM y CAC por canal.'),
  item('search', 'Salud', '2026-10-08', 'Aumenta la búsqueda de citas médicas en línea', 'Oportunidad', 77, { c2: ['o', 2], c1: ['o', 1] }, 'Hay demanda de agendar en línea que ninguna campaña atiende de frente.', 'Probar una pieza de búsqueda para «cita médica en línea».', 'Volumen de la búsqueda y registros desde Google.'),
  item('fraud', 'Salud', '2026-10-06', 'Aviso por falsos médicos en redes sociales', 'Riesgo', 81, { c1: ['r', 2], c4: ['r', 1] }, 'Crece la desconfianza hacia «médicos en línea»; golpea al mensaje de verificación.', 'Mostrar el sello de verificación y cómo comprobarlo.', 'Menciones de fraude y de verificación.'),
  item('insurance', 'Economía', '2026-10-04', 'Las empresas buscan seguros de salud para su personal', 'Oportunidad', 52, { c4: ['o', 1] }, 'Un historial portátil facilita el vínculo con aseguradoras.', 'Explorar un piloto con una empresa aliada.', 'Consultas de empresas.'),
  item('rain', 'Salud', '2026-10-02', 'Temporada de lluvias: más consultas respiratorias', 'Vigilar', 49, { c4: ['o', 1] }, 'Más gente necesita su historial a mano en una consulta urgente.', 'Preparar una pieza de «llevar mi historial a la consulta».', 'Consultas respiratorias y uso del historial.'),
];

/** Nivel de riesgo del entorno para una campaña: el máximo entre sus riesgos. */
export type Exposure = 0 | 1 | 2 | 3;

export const EXPOSURE_LABELS: Readonly<Record<Exposure, string>> = { 0: 'Sin señales', 1: 'Riesgo bajo', 2: 'Riesgo medio', 3: 'Riesgo alto' };

export interface CampaignExposure {
  readonly campaignId: string;
  readonly name: string;
  readonly goal: string;
  readonly risk: Exposure;
  readonly affecting: readonly { readonly item: EnvItem; readonly type: 'r' | 'o'; readonly level: 1 | 2 | 3 }[];
  readonly firstAction: string;
}

export function exposure(items: readonly EnvItem[] = ENVIRONMENT): CampaignExposure[] {
  return CAMPAIGNS.map((c) => {
    const affecting = items
      .flatMap((it) => (it.effects[c.id] ? [{ item: it, type: it.effects[c.id]![0], level: it.effects[c.id]![1] }] : []))
      .sort((a, b) => (a.type === b.type ? b.level - a.level : a.type === 'r' ? -1 : 1));
    const topRisk = affecting.find((a) => a.type === 'r');
    return {
      campaignId: c.id,
      name: c.name,
      goal: c.objective,
      risk: (topRisk?.level ?? 0) as Exposure,
      affecting,
      firstAction: topRisk ? topRisk.item.action : 'Mantener la campaña y seguir mirando el entorno.',
    };
  });
}
