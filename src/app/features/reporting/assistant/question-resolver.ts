import type { PestanaReporte, VerticalReporte } from '@core/data-access/reporting/reporting.types';

import { CONCEPTOS_GENERICOS, PALABRAS_VACIAS, PEOPLE_PATTERNS, SINONIMOS } from './question-lexicon';

/* ============================================================================
    Resolvedor de preguntas (MAQUETA). Función pura, sin red ni reloj.

    Traduce una pregunta en lenguaje natural a UNA medida del catálogo de KPI de
    las siete pestañas. No hay modelo de lenguaje: puntúa el solapamiento de
    términos con el título y la definición de cada medida, ayudado por una
    lista de sinónimos del dominio. Lo que el resolvedor NUNCA hace:

      · calcular, estimar ni escribir una cifra (la cifra la pone el reporte);
      · interpretar la entrada como instrucción o consulta: «DROP TABLE» es una
        pregunta como cualquier otra, que no casa con ninguna medida;
      · buscar datos de personas: se rechaza antes de puntuar.
    ========================================================================== */

/** Lo mínimo que el resolvedor necesita saber de un KPI. */
export interface MedidaCatalogo {
  readonly pestana: VerticalReporte;
  readonly kpiId: string;
  readonly titulo: string;
  readonly definicion: string;
}

/** Una medida con sus términos ya normalizados (se calcula una sola vez). */
export interface MedidaIndexada extends MedidaCatalogo {
  readonly tituloNormalizado: string;
  readonly tokensTitulo: readonly string[];
  readonly tokensDefinicion: readonly string[];
  readonly conceptosTitulo: ReadonlySet<string>;
  readonly conceptosDefinicion: ReadonlySet<string>;
}

export type CatalogoIndexado = readonly MedidaIndexada[];

export type ResolucionPregunta =
  | { readonly tipo: 'vacia' }
  | { readonly tipo: 'personas' }
  | { readonly tipo: 'medida'; readonly medida: MedidaIndexada; readonly puntaje: number }
  | { readonly tipo: 'ambigua'; readonly opciones: readonly MedidaIndexada[] }
  | { readonly tipo: 'sin-medida'; readonly sugerencias: readonly MedidaIndexada[] };

/** Más allá de esto la pregunta se recorta: no hay medida que lo necesite. */
export const MAX_CARACTERES_PREGUNTA = 300;
const MAX_TOKENS = 60;
/** Puntaje mínimo (sin el bonus de cobertura) para contestar. */
export const UMBRAL_RESPUESTA = 2;
/** Una medida con nombre propio (4) o dos términos del título: evidencia que aguanta una palabra desconocida. */
const EVIDENCIA_FUERTE = 4;
/** Dos medidas a menos de esta distancia de puntaje son «parecidas»: se pregunta cuál. */
const MARGEN_AMBIGUEDAD = 0.75;

/* ---- normalización ------------------------------------------------------------ */

/** Minúsculas, sin tildes ni signos; espacios simples. */
export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Singulariza de forma tosca pero estable (se aplica a ambos lados de la comparación). */
function raiz(token: string): string {
  if (token.length <= 3) {
    return token;
  }
  if (token.endsWith('ciones')) {
    return `${token.slice(0, -6)}cion`;
  }
  if (token.endsWith('es') && token.length > 5) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenizar(textoNormalizado: string): string[] {
  return textoNormalizado === '' ? [] : textoNormalizado.split(' ').slice(0, MAX_TOKENS);
}

/** Distancia de edición con transposiciones (Damerau restringida), con corte temprano. */
export function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) {
    return tope + 1;
  }
  const filas: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    filas.push(new Array<number>(b.length + 1).fill(0));
    filas[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    filas[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(filas[i - 1][j] + 1, filas[i][j - 1] + 1, filas[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, filas[i - 2][j - 2] + 1);
      }
      filas[i][j] = d;
    }
  }
  return filas[a.length][b.length];
}

/**
 * Dos raíces «son la misma palabra». Las siglas y palabras cortas (mrr, cac,
 * ctr…) piden igualdad exacta: una errata en tres letras es otra palabra.
 */
export function mismaPalabra(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const corta = Math.min(a.length, b.length);
  if (corta < 5) {
    return false;
  }
  return distancia(a, b, corta >= 9 ? 2 : 1) <= (corta >= 9 ? 2 : 1);
}

const esSignificativo = (token: string): boolean =>
  token.length >= 3 && !PALABRAS_VACIAS.has(token);

/* ---- conceptos (sinónimos) ------------------------------------------------------ */

interface FraseConcepto {
  readonly concepto: string;
  readonly raices: readonly string[];
}

const FRASES: readonly FraseConcepto[] = Object.entries(SINONIMOS).flatMap(([concepto, frases]) =>
  frases.map((frase) => ({ concepto, raices: tokenizar(normalizar(frase)).map(raiz) })),
);

/** Conceptos presentes en un texto, con los índices de palabra que cubre cada frase hallada. */
function conceptsOf(raices: readonly string[]): {
  conceptos: Set<string>;
  cubiertos: Set<number>;
} {
  const conceptos = new Set<string>();
  const cubiertos = new Set<number>();
  for (const { concepto, raices: frase } of FRASES) {
    for (let i = 0; i + frase.length <= raices.length; i++) {
      if (frase.every((r, k) => mismaPalabra(raices[i + k], r))) {
        conceptos.add(concepto);
        frase.forEach((_, k) => cubiertos.add(i + k));
      }
    }
  }
  return { conceptos, cubiertos };
}

/* ---- catálogo -------------------------------------------------------------------- */

function indexar(medida: MedidaCatalogo): MedidaIndexada {
  const tituloNormalizado = normalizar(medida.titulo);
  const raicesTitulo = tokenizar(tituloNormalizado).map(raiz);
  const raicesDefinicion = tokenizar(normalizar(medida.definicion)).map(raiz);
  return {
    ...medida,
    tituloNormalizado,
    tokensTitulo: tokenizar(tituloNormalizado).filter(esSignificativo).map(raiz),
    tokensDefinicion: tokenizar(normalizar(medida.definicion)).filter(esSignificativo).map(raiz),
    conceptosTitulo: conceptsOf(raicesTitulo).conceptos,
    conceptosDefinicion: conceptsOf(raicesDefinicion).conceptos,
  };
}

/**
 * Arma el catálogo a partir de lo que devolvieron las pestañas. Las medidas del
 * «resumen» que repiten una medida de su pestaña dueña (mismo título, o el
 * título entre paréntesis del otro: «MRR» ↔ «Ingreso recurrente mensual (MRR)»)
 * se descartan: la respuesta apunta a la pestaña donde la medida vive.
 */
export function construirCatalogo(pestanas: readonly PestanaReporte[]): CatalogoIndexado {
  const orden = [
    ...pestanas.filter((p) => p.pestana !== 'resumen'),
    ...pestanas.filter((p) => p.pestana === 'resumen'),
  ];
  const todas = orden.flatMap((p) =>
    p.kpis.map((kpi) =>
      indexar({
        pestana: p.pestana,
        kpiId: kpi.id,
        titulo: kpi.titulo,
        definicion: kpi.info?.definicion ?? '',
      }),
    ),
  );
  const propias = todas.filter((m) => m.pestana !== 'resumen');
  return todas.filter(
    (m) =>
      m.pestana !== 'resumen' ||
      !propias.some(
        (o) =>
          o.tituloNormalizado === m.tituloNormalizado ||
          o.titulo.includes(`(${m.titulo})`),
      ),
  );
}

/* ---- puntaje ---------------------------------------------------------------------- */

interface Pregunta {
  readonly conceptos: ReadonlySet<string>;
  /** Palabras significativas que ninguna frase de sinónimos explica. */
  readonly sueltas: readonly string[];
  /** Todo lo que la pregunta «dice», incluidas las frases de sus conceptos (para la cobertura). */
  readonly expandidas: readonly string[];
}

function analizar(normalizada: string): Pregunta {
  const tokens = tokenizar(normalizada);
  const raices = tokens.map(raiz);
  const { conceptos, cubiertos } = conceptsOf(raices);
  const sueltas = [
    ...new Set(
      tokens.flatMap((t, i) => (!cubiertos.has(i) && esSignificativo(t) ? [raices[i]] : [])),
    ),
  ];
  const conceptRoots = FRASES.filter((f) => conceptos.has(f.concepto)).flatMap((f) => f.raices);
  return {
    conceptos,
    sueltas,
    expandidas: [...new Set([...raices.filter((r, i) => esSignificativo(tokens[i])), ...conceptRoots])],
  };
}

const tiene = (lista: readonly string[], palabra: string): boolean =>
  lista.some((t) => mismaPalabra(t, palabra));

interface Puntaje {
  readonly medida: MedidaIndexada;
  /** Evidencia de que la pregunta habla de esta medida. */
  readonly base: number;
  /** Base + cobertura del título: desempata entre medidas que comparten términos. */
  readonly total: number;
}

function puntuar(medida: MedidaIndexada, p: Pregunta): Puntaje {
  let base = 0;
  for (const c of p.conceptos) {
    const generico = CONCEPTOS_GENERICOS.has(c);
    if (medida.conceptosTitulo.has(c)) {
      base += generico ? 2.5 : 4;
    } else if (medida.conceptosDefinicion.has(c)) {
      base += generico ? 1 : 1.5;
    }
  }
  let enDefinicion = 0;
  for (const palabra of p.sueltas) {
    if (tiene(medida.tokensTitulo, palabra)) {
      base += 2;
    } else if (tiene(medida.tokensDefinicion, palabra)) {
      enDefinicion = Math.min(2, enDefinicion + 0.5);
    }
  }
  base += enDefinicion;
  const cobertura =
    medida.tokensTitulo.length === 0
      ? 0
      : medida.tokensTitulo.filter((t) => tiene(p.expandidas, t)).length / medida.tokensTitulo.length;
  return { medida, base, total: base + 2 * cobertura };
}

/** Una medida por pestaña (las primeras), para sugerir algo cuando nada se parece. */
function variadas(catalogo: CatalogoIndexado): MedidaIndexada[] {
  const vistas = new Set<VerticalReporte>();
  const salida: MedidaIndexada[] = [];
  for (const m of catalogo) {
    if (!vistas.has(m.pestana)) {
      vistas.add(m.pestana);
      salida.push(m);
    }
    if (salida.length === 3) {
      break;
    }
  }
  return salida;
}

/* ---- API ---------------------------------------------------------------------------- */

export function asksForPersonalData(normalizada: string): boolean {
  return PEOPLE_PATTERNS.some((patron) => patron.test(normalizada));
}

export function resolverPregunta(pregunta: string, catalogo: CatalogoIndexado): ResolucionPregunta {
  const normalizada = normalizar(pregunta.slice(0, MAX_CARACTERES_PREGUNTA));
  if (normalizada === '') {
    return { tipo: 'vacia' };
  }
  if (asksForPersonalData(normalizada)) {
    return { tipo: 'personas' };
  }

  const analizada = analizar(normalizada);
  const ordenados = catalogo
    .map((m) => puntuar(m, analizada))
    .filter((s) => s.base > 0)
    .sort((a, b) => b.total - a.total);

  const mejor = ordenados[0];
  // Una palabra que NINGUNA medida explica («NPS») junto a evidencia floja
  // (un término genérico como «doctores») es una medida que no existe, no una
  // medida parecida: se dice, en vez de ofrecer lo que casa por casualidad.
  const huerfanas = analizada.sueltas.filter(
    (palabra) => !catalogo.some((m) => tiene(m.tokensTitulo, palabra) || tiene(m.tokensDefinicion, palabra)),
  ).length;
  const evidenciaFloja = mejor !== undefined && mejor.base < EVIDENCIA_FUERTE && huerfanas > 0;
  if (mejor === undefined || mejor.base < UMBRAL_RESPUESTA || evidenciaFloja) {
    const cercanas = ordenados.slice(0, 3).map((s) => s.medida);
    return { tipo: 'sin-medida', sugerencias: cercanas.length > 0 ? cercanas : variadas(catalogo) };
  }

  const parecidas = ordenados
    .filter((s) => s.base >= UMBRAL_RESPUESTA && mejor.total - s.total <= MARGEN_AMBIGUEDAD)
    .slice(0, 3);
  if (parecidas.length > 1) {
    return { tipo: 'ambigua', opciones: parecidas.map((s) => s.medida) };
  }
  return { tipo: 'medida', medida: mejor.medida, puntaje: mejor.total };
}
