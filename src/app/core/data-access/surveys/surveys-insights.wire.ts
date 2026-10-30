import type {
  AnswerType,
  InsightsBucket,
  InsightsComment,
  InsightsOptionCount,
  InsightsQuestion,
  InsightsTrendPoint,
  SurveyInsights,
} from './surveys.types';

/* ============================================================================
    `GET /surveys/insights` — del cable a los tipos de la vista.

    El contrato lo implementa el backend en paralelo y deja dos formas abiertas
    (cómo viaja `distribution` y cómo viaja `optionCounts`). Se normaliza acá,
    en la frontera, aceptando las formas razonables, para que la pantalla trabaje
    con UNA y el día que el contrato se fije sólo haya que tocar este archivo:

    - `distribution`: `[{ value, count }]`, o una lista de conteos que empieza en
      el mínimo de la escala (11 posiciones = 0–10, otra longitud = desde 1).
    - `optionCounts`: `[{ option, count }]` o un objeto `{ opción: conteo }`.

    Los opcionales vacíos pueden llegar como `null` (ver `wire.ts`): ninguno se
    deja pasar como `null` donde el tipo promete otra cosa.
    ========================================================================== */

type Crudo = Readonly<Record<string, unknown>>;

/** El mínimo que declara el contrato cuando el servidor no lo repite. */
const MIN_COHORTE_POR_DEFECTO = 5;

const esObjeto = (valor: unknown): valor is Crudo =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

const numero = (valor: unknown, porDefecto = 0): number =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : porDefecto;

const numeroONulo = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null;

const lista = (valor: unknown): readonly unknown[] => (Array.isArray(valor) ? valor : []);

/** Mínimo de la escala cuando la distribución viaja como lista de conteos. */
function minimoDeEscala(longitud: number): number {
  return longitud === 11 ? 0 : 1;
}

function aDistribucion(valor: unknown): readonly InsightsBucket[] {
  const elementos = lista(valor);
  if (elementos.length > 0 && elementos.every((e) => typeof e === 'number')) {
    const minimo = minimoDeEscala(elementos.length);
    return (elementos as readonly number[]).map((count, i) => ({ value: minimo + i, count }));
  }
  return elementos
    .filter(esObjeto)
    .map((e) => ({ value: numero(e['value']), count: numero(e['count']) }))
    .sort((a, b) => a.value - b.value);
}

function aOpciones(valor: unknown): readonly InsightsOptionCount[] {
  if (esObjeto(valor)) {
    return Object.entries(valor).map(([option, count]) => ({ option, count: numero(count) }));
  }
  return lista(valor)
    .filter(esObjeto)
    .map((e) => ({ option: String(e['option'] ?? ''), count: numero(e['count']) }));
}

function aPregunta(crudo: Crudo): InsightsQuestion {
  return {
    questionId: String(crudo['questionId'] ?? ''),
    text: String(crudo['text'] ?? ''),
    dimension: typeof crudo['dimension'] === 'string' ? crudo['dimension'] : null,
    answerType: String(crudo['answerType'] ?? 'TEXT') as AnswerType,
    suppressed: crudo['suppressed'] === true,
    n: numero(crudo['n']),
    average: numeroONulo(crudo['average']),
    distribution: aDistribucion(crudo['distribution']),
    optionCounts: aOpciones(crudo['optionCounts']),
  };
}

function aTendencia(crudo: Crudo): InsightsTrendPoint {
  return {
    period: String(crudo['period'] ?? ''),
    answered: numero(crudo['answered']),
    average: numeroONulo(crudo['average']),
  };
}

/**
 * El comentario es SÓLO su texto: si el servidor mandara fecha, mes o cualquier
 * otro campo, no se conserva. Lo que no llega a la pantalla no puede mostrarse.
 */
function aComentario(crudo: Crudo): InsightsComment {
  return { text: String(crudo['text'] ?? '') };
}

/** Convierte el cuerpo de `GET /surveys/insights` a {@link SurveyInsights}. */
export function normalizarInsights(cuerpo: unknown): SurveyInsights {
  const crudo: Crudo = esObjeto(cuerpo) ? cuerpo : {};
  const totales = esObjeto(crudo['totals']) ? crudo['totals'] : {};
  const nps = esObjeto(crudo['nps']) ? crudo['nps'] : {};
  const alertas = esObjeto(crudo['safetyAlerts']) ? crudo['safetyAlerts'] : {};
  const privacidad = esObjeto(crudo['privacy']) ? crudo['privacy'] : {};
  return {
    privacy: {
      minCohort: numero(privacidad['minCohort'], MIN_COHORTE_POR_DEFECTO),
      // Sólo `true` suprime: un servidor que todavía no manda `privacy` no
      // esconde nada, y una clave que no es booleana no se interpreta.
      suppressed: privacidad['suppressed'] === true,
    },
    totals: {
      issued: numero(totales['issued']),
      answered: numero(totales['answered']),
      responseRate: numero(totales['responseRate']),
    },
    nps: {
      value: numeroONulo(nps['value']),
      promoters: numero(nps['promoters']),
      passives: numero(nps['passives']),
      detractors: numero(nps['detractors']),
      n: numero(nps['n']),
    },
    byQuestion: lista(crudo['byQuestion']).filter(esObjeto).map(aPregunta),
    trend: lista(crudo['trend']).filter(esObjeto).map(aTendencia),
    safetyAlerts: { n: numero(alertas['n']) },
    comments: lista(crudo['comments']).filter(esObjeto).map(aComentario),
  };
}
