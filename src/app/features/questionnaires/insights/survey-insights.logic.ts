import type {
  InsightsNps,
  InsightsQuestion,
  InsightsTotals,
  InsightsTrendPoint,
} from '../../../core/data-access/surveys/surveys.types';
import type { MetricTone } from '../../../shared/components/molecules/metric-card/metric-card.types';
import { armarBarras, type BarraDeResumen } from '../survey-detail/survey-detail';

/* ============================================================================
    «Cómo le va» — la lógica de presentación del resumen general.

    Todo lo que decide qué se ve (semáforo, «pocas respuestas», barras, rótulos)
    está acá como funciones puras, sin Angular, para poder probarlo sin montar
    una pantalla. El componente sólo las llama.
    ========================================================================== */

/* -- el período ------------------------------------------------------------- */

/**
 * Los períodos que se ofrecen. Son PRESETS de meses calendario, no rangos libres
 * (decisión de seguridad del contrato): con fechas arbitrarias se podrían ir
 * recortando ventanas hasta aislar a una persona.
 */
export type PeriodoId = 'mes' | '3m' | '12m';

export interface Periodo {
  readonly value: PeriodoId;
  readonly label: string;
  readonly descripcion: string;
  /** Cuántos meses calendario abarca, contando el actual. */
  readonly meses: number;
}

export const PERIODOS: readonly Periodo[] = [
  { value: 'mes', label: 'Este mes', descripcion: 'Este mes', meses: 1 },
  { value: '3m', label: '3 meses', descripcion: 'Últimos 3 meses: el actual y los 2 anteriores', meses: 3 },
  { value: '12m', label: '12 meses', descripcion: 'Últimos 12 meses: el actual y los 11 anteriores', meses: 12 },
];

/** El período con el que abre la pantalla: el de tres meses, que rara vez queda corto. */
export const PERIODO_INICIAL: PeriodoId = '3m';

/** `YYYY-MM-DD` en hora LOCAL: `toISOString` daría el día de Greenwich. */
export function diaLocal(fecha: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/**
 * El rango del período, alineado a meses calendario como exige el contrato:
 * `from` es el día 1 del primer mes y `to` el ÚLTIMO día del mes en curso (puede
 * ser futuro: el servidor lo acepta).
 */
export function rangoDe(periodo: PeriodoId, hoy: Date = new Date()): { from: string; to: string } {
  const meses = PERIODOS.find((p) => p.value === periodo)?.meses ?? 1;
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return { from: diaLocal(desde), to: diaLocal(hasta) };
}

/* -- NPS y tasa -------------------------------------------------------------- */

export type NivelNps = 'sin-datos' | 'a-mejorar' | 'aceptable' | 'bueno' | 'excelente';

export interface SemaforoNps {
  readonly nivel: NivelNps;
  /** Lo que se lee: el color nunca va solo. */
  readonly palabra: string;
  readonly tono: MetricTone;
}

/**
 * El semáforo del NPS.
 *
 * Cortes de uso corriente (no son una norma clínica): 50 o más, excelente; de
 * 30 a 49, bueno; de 0 a 29, aceptable; negativo, a mejorar. Sin datos no hay
 * color: un 0 inventado se leería como «aceptable».
 */
export function semaforoNps(valor: number | null): SemaforoNps {
  if (valor === null) return { nivel: 'sin-datos', palabra: 'Sin datos', tono: 'neutral' };
  if (valor >= 50) return { nivel: 'excelente', palabra: 'Excelente', tono: 'success' };
  if (valor >= 30) return { nivel: 'bueno', palabra: 'Bueno', tono: 'success' };
  if (valor >= 0) return { nivel: 'aceptable', palabra: 'Aceptable', tono: 'warning' };
  return { nivel: 'a-mejorar', palabra: 'A mejorar', tono: 'error' };
}

/** `+32`, `-10`, `0`. El signo explícito evita confundir NPS con un porcentaje. */
export function formatearNps(valor: number | null): string {
  if (valor === null) return '—';
  const entero = Math.round(valor);
  return entero > 0 ? `+${entero}` : String(entero);
}

/**
 * La tasa de respuesta en porcentaje entero, o `null` si no se envió nada.
 *
 * Se recalcula desde los dos conteos y no se lee `responseRate`: el contrato no
 * fija si es fracción o porcentaje, y los conteos no son ambiguos.
 */
export function tasaDeRespuesta(totales: InsightsTotals): number | null {
  if (totales.issued <= 0) return null;
  return Math.round((totales.answered / totales.issued) * 100);
}

export interface SegmentoNps {
  readonly clave: 'promoters' | 'passives' | 'detractors';
  readonly etiqueta: string;
  readonly descripcion: string;
  readonly cantidad: number;
  /** 0 a 100 sobre `nps.n`. */
  readonly porcentaje: number;
}

/** Promotores, pasivos y detractores, en ese orden, con su porcentaje. */
export function segmentosNps(nps: InsightsNps): readonly SegmentoNps[] {
  const sobre = (cantidad: number): number => (nps.n === 0 ? 0 : Math.round((cantidad / nps.n) * 100));
  return [
    { clave: 'promoters', etiqueta: 'Promotores', descripcion: '9 y 10', cantidad: nps.promoters, porcentaje: sobre(nps.promoters) },
    { clave: 'passives', etiqueta: 'Pasivos', descripcion: '7 y 8', cantidad: nps.passives, porcentaje: sobre(nps.passives) },
    { clave: 'detractors', etiqueta: 'Detractores', descripcion: '0 a 6', cantidad: nps.detractors, porcentaje: sobre(nps.detractors) },
  ];
}

/* -- satisfacción y preguntas ------------------------------------------------ */

/** La dimensión de la pregunta «¿cómo calificaría su experiencia?». */
export const DIMENSION_SATISFACCION = 'satisfaccion_global';

/** La dimensión de la pregunta de recomendación (la base del NPS). */
export const DIMENSION_NPS = 'recomendacion_nps';

/**
 * Satisfacción global del período: el promedio ponderado por `n` de todas las
 * preguntas de esa dimensión (la de consulta y la de servicio son preguntas
 * distintas con la misma escala 1–5), o `null` si nadie la contestó.
 */
export function satisfaccionGlobal(
  preguntas: readonly InsightsQuestion[],
): { readonly promedio: number; readonly n: number } | null {
  const mias = preguntas.filter((p) => p.dimension === DIMENSION_SATISFACCION && !p.suppressed && p.average !== null && p.n > 0);
  const n = mias.reduce((suma, p) => suma + p.n, 0);
  if (n === 0) return null;
  const total = mias.reduce((suma, p) => suma + (p.average ?? 0) * p.n, 0);
  return { promedio: total / n, n };
}

/** Rótulo corto de cada dimensión base; las preguntas propias no tienen. */
const ROTULO_DIMENSION: Readonly<Record<string, string>> = {
  esfuerzo_acceso: 'Facilidad de acceso',
  tiempo_espera: 'Tiempo de espera',
  comunicacion: 'Escucha',
  claridad_explicacion: 'Claridad de la explicación',
  trato_respetuoso: 'Trato respetuoso',
  tiempo_suficiente: 'Tiempo dedicado',
  inquietudes_resueltas: 'Dudas resueltas',
  revision_medicacion: 'Revisión de medicamentos',
  seguridad_percibida: 'Seguridad y trato',
  satisfaccion_global: 'Satisfacción global',
  recomendacion_nps: 'Recomendación',
};

/** El orden de lectura: el mismo del cuestionario base, las propias al final. */
const ORDEN_DIMENSION: readonly string[] = Object.keys(ROTULO_DIMENSION);

export function rotuloDeDimension(dimension: string | null): string {
  return (dimension !== null && ROTULO_DIMENSION[dimension]) || 'Pregunta propia';
}

/**
 * Las preguntas que se grafican, en orden estable: base por dimensión, propias
 * al final. El texto libre se excluye: no se agrega, se lee en «Comentarios».
 */
export function preguntasGraficables(preguntas: readonly InsightsQuestion[]): readonly InsightsQuestion[] {
  const posicion = (p: InsightsQuestion): number => {
    const i = p.dimension === null ? -1 : ORDEN_DIMENSION.indexOf(p.dimension);
    return i < 0 ? ORDEN_DIMENSION.length : i;
  };
  return preguntas
    .filter((p) => p.answerType !== 'TEXT')
    .map((p, orden) => ({ p, orden }))
    .sort((a, b) => posicion(a.p) - posicion(b.p) || a.orden - b.orden)
    .map(({ p }) => p);
}

/**
 * La pregunta de cada dimensión **sin hablar ni de «esta consulta» ni de «este
 * servicio»**. Es lo que se lee cuando la dimensión reúne las dos fuentes: el
 * enunciado de cualquiera de las dos le diría «servicio» a quien está mirando
 * consultas (o al revés).
 */
const PREGUNTA_NEUTRA: Readonly<Record<string, string>> = {
  esfuerzo_acceso: '¿Qué tan fácil le resultó acceder a la atención?',
  tiempo_espera: '¿Cuánto tiempo esperó hasta que comenzó la atención?',
  comunicacion: '¿Con qué frecuencia el profesional le escuchó con atención?',
  claridad_explicacion: '¿Con qué claridad le explicaron las cosas?',
  trato_respetuoso: '¿Con qué frecuencia le trataron con cortesía y respeto?',
  tiempo_suficiente: '¿Con qué frecuencia el profesional pasó suficiente tiempo con usted?',
  inquietudes_resueltas: '¿Salió sintiendo que todas sus inquietudes o preguntas habían sido contestadas?',
  revision_medicacion: '¿Hablaron sobre todas las medicinas recetadas que estaba tomando?',
  seguridad_percibida: '¿Tuvo algún problema de seguridad o de trato que quiera reportar?',
  satisfaccion_global: 'En general, ¿cómo calificaría su experiencia?',
  recomendacion_nps: '¿Qué tan probable es que lo recomiende a un familiar o a un amigo?',
};

/** El enunciado neutro de una dimensión; sin él, el rótulo mismo. */
export function preguntaNeutraDeDimension(dimension: string | null): string {
  return (dimension !== null && PREGUNTA_NEUTRA[dimension]) || rotuloDeDimension(dimension);
}

/**
 * Una pregunta a graficar. `combinada` si suma las de consulta y las de
 * servicio. `neutra` si el enunciado que se lee es el neutro de la dimensión:
 * sucede siempre que la dimensión reúne las dos fuentes, aunque una sola tenga
 * datos para mostrar.
 */
export interface PreguntaGraficable {
  readonly pregunta: InsightsQuestion;
  readonly combinada: boolean;
  readonly neutra: boolean;
}

/**
 * Cómo se lee la dimensión según lo que se está mirando.
 *
 * - `todo` (sin filtro de servicio): consultas y servicios entran juntos, así que
 *   una dimensión que existe en las dos fuentes nunca muestra el enunciado de una.
 * - `servicio` (un servicio elegido): lo que llega es de ese servicio y su
 *   propio enunciado es el correcto.
 */
export type AlcanceDelResumen = 'todo' | 'servicio';

/**
 * Junta las preguntas base que miden lo mismo en la consulta y en el servicio
 * (misma dimensión, mismo tipo): «Tiempo de espera» de consulta y de servicio
 * son una sola barra, no dos casi iguales una al lado de la otra.
 *
 * Suma los conteos, pondera el promedio por `n` y, como el enunciado de una
 * habla de «esta consulta» y el de la otra de «este servicio», **no conserva
 * ninguno**: la pregunta combinada lleva el rótulo de la dimensión y su
 * enunciado neutro (`preguntaNeutraDeDimension`). Las preguntas
 * propias (sin dimensión) y las que están solas pasan tal cual.
 */
export function combinarPorDimension(
  preguntas: readonly InsightsQuestion[],
  alcance: AlcanceDelResumen = 'todo',
): readonly PreguntaGraficable[] {
  const salida: PreguntaGraficable[] = [];
  const porClave = new Map<string, number>();
  /** Una dimensión con dos fuentes se lee con el enunciado neutro, si se mira todo. */
  const neutro = alcance === 'todo';
  const conTextoNeutro = (q: InsightsQuestion): InsightsQuestion => ({
    ...q,
    text: preguntaNeutraDeDimension(q.dimension),
  });
  for (const p of preguntas) {
    if (p.dimension === null) {
      salida.push({ pregunta: p, combinada: false, neutra: false });
      continue;
    }
    const clave = `${p.dimension}|${p.answerType}`;
    const indice = porClave.get(clave);
    if (indice === undefined) {
      porClave.set(clave, salida.length);
      salida.push({ pregunta: p, combinada: false, neutra: false });
      continue;
    }
    const previa = salida[indice]!.pregunta;
    // Una suprimida NO se suma a una que no lo está: el servidor la ocultó por
    // tener muy pocas respuestas, y sumarla de vuelta (o restarla del total)
    // reconstruiría lo que escondió. Gana la que sí tiene datos; si ninguna los
    // tiene, queda una sola fila suprimida.
    if (previa.suppressed || p.suppressed) {
      const ganadora = previa.suppressed && !p.suppressed ? p : previa;
      // La dimensión tiene dos fuentes aunque sólo una se vea: el enunciado de
      // la que quedó diría «servicio» (o «consulta») de más.
      salida[indice] = neutro
        ? { pregunta: conTextoNeutro(ganadora), combinada: false, neutra: true }
        : { pregunta: ganadora, combinada: false, neutra: false };
      continue;
    }
    const n = previa.n + p.n;
    const valores = new Map<number, number>();
    for (const b of [...previa.distribution, ...p.distribution]) valores.set(b.value, (valores.get(b.value) ?? 0) + b.count);
    const opciones = new Map<string, number>();
    for (const o of [...previa.optionCounts, ...p.optionCounts]) opciones.set(o.option, (opciones.get(o.option) ?? 0) + o.count);
    const conPromedio = [previa, p].filter((q) => q.average !== null && q.n > 0);
    const pesoTotal = conPromedio.reduce((suma, q) => suma + q.n, 0);
    salida[indice] = {
      combinada: true,
      neutra: true,
      pregunta: {
        ...previa,
        questionId: `${previa.questionId}+${p.questionId}`,
        text: preguntaNeutraDeDimension(p.dimension),
        n,
        average:
          pesoTotal === 0 ? null : conPromedio.reduce((suma, q) => suma + (q.average ?? 0) * q.n, 0) / pesoTotal,
        distribution: [...valores.entries()].sort((x, y) => x[0] - y[0]).map(([value, count]) => ({ value, count })),
        optionCounts: [...opciones.entries()].map(([option, count]) => ({ option, count })),
      },
    };
  }
  return salida;
}

/** El resumen de una pregunta ya agregada, con la misma forma que el de la ficha. */
export interface ResumenAgregado {
  readonly totalRespondida: number;
  readonly promedio: number | null;
  readonly barras: readonly BarraDeResumen[];
  /** `1-5`, `0-10` o `null` si no es de escala: es lo que dice el eje. */
  readonly escala: '1-5' | '0-10' | null;
}

/**
 * Convierte una pregunta agregada en barras.
 *
 * Reutiliza `armarBarras` de la ficha: el porcentaje se calcula igual (sobre
 * quienes respondieron ESTA pregunta) y se redondea igual, así la ficha y el
 * resumen general no dan cifras distintas para los mismos datos.
 */
export function resumirAgregado(pregunta: InsightsQuestion): ResumenAgregado {
  const total = pregunta.n;
  if (pregunta.answerType === 'SCALE') {
    const valores = pregunta.distribution.map((b) => b.value);
    const tope = Math.max(5, ...valores) > 5 ? 10 : 5;
    const piso = tope === 10 || valores.includes(0) ? 0 : 1;
    const etiquetas = Array.from({ length: tope - piso + 1 }, (_, i) => String(piso + i));
    const conteo = new Map(pregunta.distribution.map((b) => [String(b.value), b.count]));
    return {
      totalRespondida: total,
      promedio: pregunta.average,
      barras: armarBarras(total, etiquetas, (etiqueta) => conteo.get(etiqueta) ?? 0),
      escala: tope === 10 ? '0-10' : '1-5',
    };
  }
  if (pregunta.answerType === 'BOOLEAN') {
    const conteo = new Map(pregunta.optionCounts.map((o) => [o.option, o.count]));
    return {
      totalRespondida: total,
      promedio: null,
      barras: armarBarras(total, ['Sí', 'No'], (etiqueta) => conteo.get(etiqueta) ?? 0),
      escala: null,
    };
  }
  const conteo = new Map(pregunta.optionCounts.map((o) => [o.option, o.count]));
  return {
    totalRespondida: total,
    promedio: null,
    barras: armarBarras(
      total,
      pregunta.optionCounts.map((o) => o.option),
      (etiqueta) => conteo.get(etiqueta) ?? 0,
    ),
    escala: null,
  };
}

/* -- la tendencia ------------------------------------------------------------ */

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Rótulos de un período de la tendencia.
 *
 * `YYYY-MM-DD` es una semana (su lunes) y `YYYY-MM` un mes. Se arma a mano y no
 * con `Date`: una fecha sin hora se interpreta en UTC y en La Paz retrocedería
 * un día.
 */
export function etiquetaDePeriodo(periodo: string): { readonly corta: string; readonly larga: string } {
  const semana = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodo);
  if (semana) {
    const mes = MESES_CORTOS[Number(semana[2]) - 1] ?? semana[2]!;
    const dia = Number(semana[3]);
    return { corta: `${dia} ${mes}`, larga: `Semana del ${dia} de ${mes} de ${semana[1]}` };
  }
  const delMes = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (delMes) {
    const mes = MESES_CORTOS[Number(delMes[2]) - 1] ?? delMes[2]!;
    return { corta: mes, larga: `${mes} de ${delMes[1]}` };
  }
  return { corta: periodo, larga: periodo };
}

export interface BarraDeTendencia {
  readonly periodo: string;
  readonly corta: string;
  readonly larga: string;
  readonly answered: number;
  readonly average: number | null;
  /** 0 a 100 respecto del período con más respuestas. */
  readonly alturaPct: number;
}

/** Las barras de la tendencia, escaladas al máximo del rango. */
export function barrasDeTendencia(puntos: readonly InsightsTrendPoint[]): readonly BarraDeTendencia[] {
  const maximo = Math.max(1, ...puntos.map((p) => p.answered));
  return puntos.map((p) => ({
    periodo: p.period,
    ...etiquetaDePeriodo(p.period),
    answered: p.answered,
    average: p.average,
    // Un período con respuestas nunca queda en cero píxeles.
    alturaPct: p.answered === 0 ? 0 : Math.max(4, Math.round((p.answered / maximo) * 100)),
  }));
}

/** `4,3` — coma decimal, un decimal. */
export function formatearPromedio(valor: number): string {
  return valor.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
