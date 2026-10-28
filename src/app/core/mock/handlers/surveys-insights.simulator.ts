import { uuid } from '../mock-store';

/* ============================================================================
    El resumen general del profesional (`GET /surveys/insights`), en el simulador.

    ## De dónde sale cada cifra

    NADA está escrito a mano: hay respuestas individuales simuladas (las de la
    encuesta base de consulta, las de la base de servicio y las de las encuestas
    propias del handler) y el resumen se CALCULA a partir de ellas con el mismo
    criterio que dice el diseño: n por pregunta, NPS = %promotores − %detractores,
    alertas = conteo de la opción de seguimiento, comentarios sin autor. Si el
    detalle de una encuesta y el resumen se contradicen, es un defecto de este
    archivo, no de los datos.

    ## Qué es contrato y qué es del simulador

    Las preguntas base son las del banco (`banco-preguntas.md` §10), con su texto
    EXACTO. Que el resumen devuelva `distribution` como `[{value,count}]` y
    `optionCounts` como `[{option,count}]` es una decisión del simulador mientras
    el backend no fije el contrato; el cliente (`surveys-insights.wire.ts`) acepta
    también las otras formas razonables.
    ========================================================================== */

export type TipoDeRespuesta = 'TEXT' | 'SCALE' | 'BOOLEAN' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';

/** Una pregunta de la encuesta base del sistema. */
export interface PreguntaBase {
  readonly id: string;
  readonly position: number;
  readonly questionText: string;
  readonly answerType: TipoDeRespuesta;
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
  readonly dimension: string;
  readonly source: 'SYSTEM';
}

const ESPERA = ['Menos de 15 minutos', 'De 15 a 30 minutos', 'De 31 a 60 minutos', 'Más de 1 hora', 'No lo recuerdo'] as const;

const SEGURIDAD = [
  'No, no tuve ningún problema',
  'Sí, y deseo que ALOVIDA me contacte para dar seguimiento',
  'Sí, pero no deseo que me contacten',
] as const;

function base(
  tipo: 'consulta' | 'servicio',
  position: number,
  dimension: string,
  questionText: string,
  answerType: TipoDeRespuesta,
  required: boolean,
  extra: Partial<PreguntaBase> = {},
): PreguntaBase {
  return {
    id: uuid(`q-base-${tipo}-${position}`),
    position,
    questionText,
    answerType,
    required,
    dimension,
    source: 'SYSTEM',
    ...extra,
  };
}

/** Encuesta base de CONSULTA: 9 preguntas, las 8 primeras obligatorias. */
export const PREGUNTAS_BASE_CONSULTA: readonly PreguntaBase[] = [
  base('consulta', 1, 'esfuerzo_acceso', '¿Qué tan fácil le resultó tener esta consulta, desde pedir la cita hasta que comenzó la atención? (1 = Muy difícil, 5 = Muy fácil)', 'SCALE', true, { scaleMin: 1, scaleMax: 5 }),
  base('consulta', 2, 'tiempo_espera', 'Desde la hora acordada, ¿cuánto tiempo esperó hasta que comenzó su consulta? Incluya la espera en sala o en la videollamada.', 'SINGLE_CHOICE', true, { options: ESPERA }),
  base('consulta', 3, 'comunicacion', 'En esta consulta, ¿con qué frecuencia el profesional le escuchó con atención? (1 = Nunca, 5 = Siempre)', 'SCALE', true, { scaleMin: 1, scaleMax: 5 }),
  base('consulta', 4, 'claridad_explicacion', 'En esta consulta, ¿con qué frecuencia el profesional le explicó las cosas de una forma que usted pudo entender? (1 = Nunca, 5 = Siempre)', 'SCALE', true, { scaleMin: 1, scaleMax: 5 }),
  base('consulta', 5, 'trato_respetuoso', 'En esta consulta, ¿con qué frecuencia el profesional le trató con cortesía y respeto? (1 = Nunca, 5 = Siempre)', 'SCALE', true, { scaleMin: 1, scaleMax: 5 }),
  base('consulta', 6, 'seguridad_percibida', 'Durante esta consulta, ¿tuvo algún problema de seguridad o de trato que quiera reportar? (por ejemplo: falta de respeto, falta de privacidad, un posible error o una indicación que le pareció insegura)', 'SINGLE_CHOICE', true, { options: SEGURIDAD }),
  base('consulta', 7, 'satisfaccion_global', 'En general, ¿cómo calificaría su experiencia con esta consulta? (1 = Muy mala, 5 = Excelente)', 'SCALE', true, { scaleMin: 1, scaleMax: 5 }),
  base('consulta', 8, 'recomendacion_nps', '¿Qué tan probable es que usted recomiende a este profesional a un familiar o a un amigo que necesite una atención parecida? (0 = Nada probable, 10 = Totalmente probable)', 'SCALE', true, { scaleMin: 0, scaleMax: 10 }),
  base('consulta', 9, 'comentario_abierto', 'Si lo desea, cuéntenos qué podríamos hacer mejor.', 'TEXT', false),
];

/** Encuesta base de SERVICIO: 7 preguntas, todas opcionales. */
export const PREGUNTAS_BASE_SERVICIO: readonly PreguntaBase[] = [
  base('servicio', 1, 'tiempo_espera', 'Desde la hora acordada (o desde que llegó, si no tenía hora), ¿cuánto esperó hasta que le atendieron?', 'SINGLE_CHOICE', false, { options: ESPERA }),
  base('servicio', 2, 'trato_respetuoso', 'Durante este servicio, ¿con qué frecuencia el personal le trató con cortesía y respeto? (1 = Nunca, 5 = Siempre)', 'SCALE', false, { scaleMin: 1, scaleMax: 5 }),
  base('servicio', 3, 'claridad_explicacion', '¿Qué tan claras fueron las explicaciones o instrucciones que recibió sobre este servicio (por ejemplo: preparación previa, cuidados posteriores o cómo recibirá sus resultados)? (1 = Nada claras, 5 = Muy claras)', 'SCALE', false, { scaleMin: 1, scaleMax: 5 }),
  base('servicio', 4, 'seguridad_percibida', 'Durante este servicio, ¿tuvo algún problema de seguridad o de trato que quiera reportar? (por ejemplo: falta de respeto, falta de privacidad, un posible error o un manejo que le pareció inseguro)', 'SINGLE_CHOICE', false, { options: SEGURIDAD }),
  base('servicio', 5, 'satisfaccion_global', 'En general, ¿cómo calificaría su experiencia con este servicio? (1 = Muy mala, 5 = Excelente)', 'SCALE', false, { scaleMin: 1, scaleMax: 5 }),
  base('servicio', 6, 'recomendacion_nps', '¿Qué tan probable es que usted recomiende este servicio a un familiar o a un amigo que necesite una atención parecida? (0 = Nada probable, 10 = Totalmente probable)', 'SCALE', false, { scaleMin: 0, scaleMax: 10 }),
  base('servicio', 7, 'comentario_abierto', 'Si lo desea, cuéntenos qué podríamos hacer mejor.', 'TEXT', false),
];

export const TITULO_BASE_CONSULTA = 'Encuesta de su consulta médica';
export const DESCRIPCION_BASE_CONSULTA =
  'Le pedimos un minuto para contarnos cómo fue su consulta. Sus respuestas son confidenciales y las ve el profesional que le atendió. Esta encuesta no es un canal de urgencias: si necesita atención inmediata, comuníquese con su profesional o acuda a un centro de salud.';
export const TITULO_BASE_SERVICIO = 'Encuesta de su servicio de salud';
export const DESCRIPCION_BASE_SERVICIO =
  'Le pedimos un minuto para contarnos cómo fue su servicio (laboratorio, imagenología, procedimiento u otro). Todas las preguntas son opcionales. Sus respuestas son confidenciales. Esta encuesta no es un canal de urgencias: si necesita atención inmediata, acuda a un centro de salud.';

/* ---- respuestas individuales simuladas ------------------------------------- */

/** Una respuesta a una pregunta, con la forma de `SurveyAnswer`. */
export interface RespuestaSimulada {
  readonly questionId: string;
  readonly valueNumber?: number;
  readonly valueText?: string;
  readonly valueBoolean?: boolean;
  readonly valueChoices?: readonly string[];
}

/** Un cuestionario respondido (o sólo emitido) y de qué fuente salió. */
export interface EmisionSimulada {
  readonly id: string;
  /** Qué cuestionario es: define las preguntas con las que se lee. */
  readonly fuente: string;
  /** `billing.service_catalog.id` del servicio, o `null` si fue una consulta. */
  readonly servicioId: string | null;
  /** `YYYY-MM-DD` del envío. */
  readonly emitidaEl: string;
  /** `YYYY-MM-DD` de la respuesta, o `null` si nadie respondió. */
  readonly respondidaEl: string | null;
  readonly respuestas: readonly RespuestaSimulada[];
}

/** Generador pseudoaleatorio con semilla (mulberry32): mismo resultado en cada carga. */
function aleatorio(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const acotar = (x: number): number => Math.min(1, Math.max(0, x));

/** Los comentarios que dejan los pacientes: sin nombres, sin datos que identifiquen. */
const COMENTARIOS = [
  'Muy buena atención, me explicó todo con calma.',
  'Tuve que esperar casi una hora aunque tenía hora fija.',
  'Me hubiera gustado más tiempo para hacer preguntas.',
  'Excelente trato. Volvería sin dudarlo.',
  'La videollamada se cortó dos veces, pero lo resolvieron rápido.',
  'Claro y amable. Me dio un plan que pude seguir.',
  'La sala de espera estaba muy llena.',
  'Todo bien, sólo mejoraría la puntualidad.',
  'Me sentí escuchada, gracias.',
  'Las indicaciones para el estudio fueron poco claras.',
  'Rápido y profesional.',
  'No me avisaron que la consulta se retrasaba.',
  'Muy recomendable.',
  'Podrían mandar las indicaciones por escrito.',
];

function elegir<T>(opciones: readonly T[], pesos: readonly number[], r: number): T {
  const total = pesos.reduce((a, b) => a + b, 0);
  let acumulado = 0;
  for (let i = 0; i < opciones.length; i += 1) {
    acumulado += pesos[i]! / total;
    if (r <= acumulado) return opciones[i]!;
  }
  return opciones[opciones.length - 1]!;
}

/** `YYYY-MM-DD` local, `dias` atrás desde hoy. */
function diaAtras(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * Responde una encuesta base. La calidad percibida (`q`) es una sola por
 * paciente y arrastra a todas las escalas, como pasa en la vida real: quien
 * sale contento puntúa alto en todo, y el NPS acompaña.
 */
function responderBase(preguntas: readonly PreguntaBase[], indice: number, opcional: boolean): readonly RespuestaSimulada[] {
  const r = aleatorio(9_001 + indice * 7919 + preguntas.length);
  const q = acotar(0.74 + (r() + r() + r() - 1.5) * 0.62);
  const salida: RespuestaSimulada[] = [];
  for (const p of preguntas) {
    // En el servicio todo es opcional: bastantes saltean preguntas (así algunas quedan con menos de 5 respuestas y llegan suprimidas). En consulta
    // sólo el comentario puede faltar.
    if (opcional && p.answerType !== 'TEXT' && r() < 0.22) continue;
    if (p.answerType === 'SCALE') {
      if (p.dimension === 'recomendacion_nps') {
        salida.push({ questionId: p.id, valueNumber: Math.round(10 * acotar(q + (r() - 0.5) * 0.5)) });
      } else {
        salida.push({ questionId: p.id, valueNumber: Math.max(1, Math.round(1 + 4 * acotar(q + (r() - 0.5) * 0.4))) });
      }
    } else if (p.answerType === 'SINGLE_CHOICE' && p.dimension === 'tiempo_espera') {
      const mala = q < 0.55;
      salida.push({
        questionId: p.id,
        valueChoices: [elegir(ESPERA, mala ? [1, 2, 4, 3, 1] : [6, 3, 1, 0.3, 0.7], r())],
      });
    } else if (p.answerType === 'SINGLE_CHOICE') {
      // Seguridad: casi todos «sin problema»; una de cada ~17 pide seguimiento
      // y una de cada ~23 prefiere no ser contactada.
      salida.push({
        questionId: p.id,
        valueChoices: [indice % 17 === 5 ? SEGURIDAD[1] : indice % 23 === 3 ? SEGURIDAD[2] : SEGURIDAD[0]],
      });
    } else if (p.answerType === 'TEXT') {
      if (r() < 0.42) salida.push({ questionId: p.id, valueText: COMENTARIOS[Math.floor(r() * COMENTARIOS.length)]! });
    }
  }
  return salida;
}

export const FUENTE_CONSULTA = 'base-consulta';
export const FUENTE_SERVICIO = 'base-servicio';

/** Cuántos envíos tiene cada servicio del médico de demostración (código de catálogo → n). */
const ENVIOS_POR_SERVICIO: readonly (readonly [string, number])[] = [
  ['ECG', 11],
  ['ECO-DOPPLER', 8],
  ['HOLTER', 5],
  ['ERGO', 3],
];

/**
 * Los envíos simulados de las encuestas base: ~65 de consulta y 27 de servicios,
 * repartidos en los últimos doce meses con más densidad en lo reciente. Cerca de
 * dos de cada tres se respondieron. Los de servicio salen para que cada filtro
 * muestre algo distinto: ECG tiene suficientes, Holter pocos, Prueba de esfuerzo
 * casi nada (el caso «pocas respuestas»).
 */
export function generarEnviosBase(): readonly EmisionSimulada[] {
  const envios: EmisionSimulada[] = [];

  const consultas = 65;
  for (let j = 0; j < consultas; j += 1) {
    const dias = Math.floor(Math.pow(j / consultas, 1.8) * 345) + (j % 3);
    const respondida = j % 5 !== 0 && j % 7 !== 0;
    const emitidaEl = diaAtras(dias + 1);
    envios.push({
      id: uuid(`envio-base-consulta-${j}`),
      fuente: FUENTE_CONSULTA,
      servicioId: null,
      emitidaEl,
      respondidaEl: respondida ? diaAtras(dias) : null,
      respuestas: respondida ? responderBase(PREGUNTAS_BASE_CONSULTA, j, false) : [],
    });
  }

  let k = 0;
  for (const [codigo, cantidad] of ENVIOS_POR_SERVICIO) {
    for (let j = 0; j < cantidad; j += 1) {
      const dias = Math.floor(Math.pow(j / cantidad, 1.5) * 300) + (k % 4);
      const respondida = (j + k) % 3 !== 0;
      envios.push({
        id: uuid(`envio-base-servicio-${codigo}-${j}`),
        fuente: FUENTE_SERVICIO,
        servicioId: uuid(`service-${codigo}`),
        emitidaEl: diaAtras(dias + 1),
        respondidaEl: respondida ? diaAtras(dias) : null,
        respuestas: respondida ? responderBase(PREGUNTAS_BASE_SERVICIO, 500 + k, true) : [],
      });
      k += 1;
    }
  }
  return envios;
}

/* ---- el cálculo ------------------------------------------------------------ */

/** Una fuente de preguntas: la base de consulta, la base de servicio o una encuesta propia. */
export interface FuenteDePreguntas {
  readonly fuente: string;
  readonly preguntas: readonly {
    readonly id: string;
    readonly questionText: string;
    readonly answerType: TipoDeRespuesta;
    readonly options?: readonly string[];
    readonly scaleMin?: number;
    readonly scaleMax?: number;
    readonly dimension?: string;
  }[];
}

export interface FiltroDeInsights {
  /** Día 1 de un mes (`YYYY-MM-DD`). */
  readonly from: string;
  /** Último día de un mes (`YYYY-MM-DD`). */
  readonly to: string;
  readonly serviceId?: string;
}

/** Cuántos meses calendario puede abarcar un rango, como en la API. */
export const MAX_MESES = 12;

/**
 * ¿Es un rango válido? `from` es día 1, `to` es el último día de su mes, y no hay
 * más de {@link MAX_MESES} meses. Devuelve el motivo o `null`.
 */
export function motivoDeRangoInvalido(from: string, to: string): string | null {
  const [fa, fm, fd] = from.split('-').map(Number) as [number, number, number];
  const [ta, tm, td] = to.split('-').map(Number) as [number, number, number];
  if (fd !== 1) return 'from must be the first day of a month';
  if (td !== new Date(ta, tm, 0).getDate()) return 'to must be the last day of a month';
  const meses = (ta - fa) * 12 + (tm - fm) + 1;
  if (meses < 1) return 'from must not be after to';
  if (meses > MAX_MESES) return `range must not exceed ${MAX_MESES} months`;
  return null;
}

/**
 * La regla anti-reidentificación del servidor: con menos de este número de
 * respuestas en el alcance filtrado sólo se devuelven los totales.
 */
export const MIN_COHORTE = 5;

const NPS_PROMOTOR = 9;
const NPS_DETRACTOR_HASTA = 6;

const redondear = (n: number, decimales = 2): number => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

/**
 * Un orden estable pero sin relación con las fechas: se ordena por un hash del
 * texto, así el resultado no depende de cuándo respondió cada quien.
 */
function mezclar(textos: readonly string[]): readonly string[] {
  const hash = (t: string): number => {
    let h = 2166136261;
    for (let i = 0; i < t.length; i += 1) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
    return h;
  };
  return [...textos].sort((a, b) => hash(a) - hash(b) || a.localeCompare(b, 'es'));
}

/** Lunes de la semana de un `YYYY-MM-DD`. */
function lunesDe(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(a, m - 1, d));
  const desfase = (fecha.getUTCDay() + 6) % 7;
  fecha.setUTCDate(fecha.getUTCDate() - desfase);
  return fecha.toISOString().slice(0, 10);
}

/** Cada período entre dos días: semanas (su lunes) si el rango es corto, meses si es largo. */
function periodosEntre(from: string, to: string): { readonly claves: readonly string[]; readonly de: (dia: string) => string } {
  const largo = (Date.parse(to) - Date.parse(from)) / 86_400_000 > 120;
  const de = (dia: string): string => (largo ? dia.slice(0, 7) : lunesDe(dia));
  const claves: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const fin = new Date(`${to}T12:00:00Z`);
  while (cursor <= fin) {
    const clave = de(cursor.toISOString().slice(0, 10));
    if (claves[claves.length - 1] !== clave) claves.push(clave);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { claves, de };
}

/**
 * Calcula el resumen a partir de los envíos y las preguntas de cada fuente.
 *
 * `from`/`to` incluyen ambos extremos y se comparan con el día del ENVÍO para lo
 * emitido y con el día de la RESPUESTA para lo respondido: la tasa de un período
 * compara cosas del mismo período. Con `serviceId`, sólo entran los envíos de ese
 * servicio; sin él, todo lo del médico.
 */
export function calcularInsights(
  envios: readonly EmisionSimulada[],
  fuentes: readonly FuenteDePreguntas[],
  filtro: FiltroDeInsights,
) {
  const enRango = (dia: string): boolean => dia >= filtro.from && dia <= filtro.to;
  const delServicio = (e: EmisionSimulada): boolean => filtro.serviceId === undefined || e.servicioId === filtro.serviceId;

  const emitidas = envios.filter((e) => delServicio(e) && enRango(e.emitidaEl));
  const respondidas = envios.filter((e) => delServicio(e) && e.respondidaEl !== null && enRango(e.respondidaEl));

  const preguntasDe = (fuente: string) => fuentes.find((f) => f.fuente === fuente)?.preguntas ?? [];

  const totals = {
    issued: emitidas.length,
    answered: respondidas.length,
    responseRate: emitidas.length === 0 ? 0 : redondear(respondidas.length / emitidas.length, 4),
  };

  // Con menos de `MIN_COHORTE` respuestas NO se calcula nada más: ni promedios,
  // ni NPS, ni comentarios. Es lo que hace el servidor, no un detalle de pantalla.
  if (respondidas.length < MIN_COHORTE) {
    return {
      privacy: { minCohort: MIN_COHORTE, suppressed: true },
      totals,
      nps: { value: null, promoters: 0, passives: 0, detractors: 0, n: 0 },
      byQuestion: [],
      trend: [],
      safetyAlerts: { n: 0 },
      comments: [],
    };
  }

  const byQuestion = fuentes.flatMap((f) => {
    const deEstaFuente = respondidas.filter((e) => e.fuente === f.fuente);
    if (deEstaFuente.length === 0) return [];
    return f.preguntas.map((p) => {
      const valores = deEstaFuente.flatMap((e) => e.respuestas.filter((r) => r.questionId === p.id));
      const numeros = valores.map((v) => v.valueNumber).filter((v): v is number => v !== undefined);
      const escala = p.answerType === 'SCALE';
      const minimo = p.scaleMin ?? 1;
      const maximo = p.scaleMax ?? 5;
      const distribution = escala
        ? Array.from({ length: maximo - minimo + 1 }, (_, i) => ({
            value: minimo + i,
            count: numeros.filter((n) => n === minimo + i).length,
          }))
        : [];
      const optionCounts =
        p.answerType === 'SINGLE_CHOICE' || p.answerType === 'MULTIPLE_CHOICE'
          ? (p.options ?? []).map((option) => ({
              option,
              count: valores.filter((v) => v.valueChoices?.includes(option)).length,
            }))
          : p.answerType === 'BOOLEAN'
            ? [true, false].map((b) => ({ option: b ? 'Sí' : 'No', count: valores.filter((v) => v.valueBoolean === b).length }))
            : [];
      // Menos de `MIN_COHORTE` respuestas a ESTA pregunta: llega suprimida, sin
      // distribución, sin opciones y sin promedio (ni siquiera `n`).
      if (valores.length < MIN_COHORTE) {
        return {
          questionId: p.id,
          text: p.questionText,
          dimension: p.dimension ?? null,
          answerType: p.answerType,
          suppressed: true,
          n: 0,
          average: null,
          distribution: [],
          optionCounts: [],
        };
      }
      return {
        questionId: p.id,
        text: p.questionText,
        dimension: p.dimension ?? null,
        answerType: p.answerType,
        suppressed: false,
        n: valores.length,
        average: escala && numeros.length > 0 ? redondear(numeros.reduce((a, b) => a + b, 0) / numeros.length) : null,
        distribution,
        optionCounts,
      };
    });
  });

  // NPS: todas las respuestas a la pregunta de recomendación, de cualquier fuente.
  const puntajes = respondidas.flatMap((e) =>
    preguntasDe(e.fuente)
      .filter((p) => p.dimension === 'recomendacion_nps')
      .flatMap((p) => e.respuestas.filter((r) => r.questionId === p.id).map((r) => r.valueNumber))
      .filter((v): v is number => v !== undefined),
  );
  // El NPS de menos de `MIN_COHORTE` personas no se calcula: llega sin valor.
  const nps = puntajes.length < MIN_COHORTE ? [] : puntajes;
  const promoters = nps.filter((v) => v >= NPS_PROMOTOR).length;
  const detractors = nps.filter((v) => v <= NPS_DETRACTOR_HASTA).length;
  const passives = nps.length - promoters - detractors;

  // Alertas: quienes eligieron «deseo que ALOVIDA me contacte» (options[1]).
  let alertas = 0;
  for (const e of respondidas) {
    for (const p of preguntasDe(e.fuente).filter((x) => x.dimension === 'seguridad_percibida')) {
      const opcion = p.options?.[1];
      alertas += e.respuestas.filter((r) => r.questionId === p.id && opcion !== undefined && r.valueChoices?.includes(opcion)).length;
    }
  }

  // Tendencia: respuestas por período y satisfacción global promedio.
  const { claves, de } = periodosEntre(filtro.from, filtro.to);
  const trend = claves.map((periodo) => {
    const delPeriodo = respondidas.filter((e) => de(e.respondidaEl!) === periodo);
    const satisfaccion = delPeriodo.flatMap((e) =>
      preguntasDe(e.fuente)
        .filter((p) => p.dimension === 'satisfaccion_global')
        .flatMap((p) => e.respuestas.filter((r) => r.questionId === p.id).map((r) => r.valueNumber))
        .filter((v): v is number => v !== undefined),
    );
    return {
      period: periodo,
      answered: delPeriodo.length,
      average: satisfaccion.length === 0 ? null : redondear(satisfaccion.reduce((a, b) => a + b, 0) / satisfaccion.length),
    };
  });

  // Comentarios: SÓLO el texto. Ni autor, ni reserva, ni servicio, ni fecha, ni mes,
  // y mezclados: el orden de llegada delataría cuál es más reciente. Sólo si hay al
  // menos `MIN_COHORTE`: con menos, el texto de uno solo ya lo señala.
  const todosLosComentarios = respondidas.flatMap((e) =>
    e.respuestas
      .filter((r) => r.valueText !== undefined && r.valueText.trim() !== '')
      .map((r) => r.valueText!.trim()),
  );
  const comments =
    todosLosComentarios.length < MIN_COHORTE
      ? []
      : mezclar(todosLosComentarios).slice(0, 8).map((text) => ({ text }));

  return {
    privacy: { minCohort: MIN_COHORTE, suppressed: false },
    totals,
    nps: {
      value: nps.length === 0 ? null : Math.round(((promoters - detractors) / nps.length) * 100),
      promoters,
      passives,
      detractors,
      n: nps.length,
    },
    byQuestion,
    trend,
    safetyAlerts: { n: alertas },
    comments,
  };
}
