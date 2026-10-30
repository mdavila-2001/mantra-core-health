import type {
  ChartSpec,
  ContextoReporte,
  InfoCalculo,
  KpiSpec,
  PestanaReporte,
  UnidadValor,
  VerticalReporte,
} from '../../../data-access/reporting/reporting.types';
import { construirAdquisicion } from './adquisicion.dataset';
import { construirCobros } from './cobros.dataset';
import { construirComisiones } from './comisiones.dataset';
import { construirPublicidad } from './publicidad.dataset';
import { construirSuscripciones } from './suscripciones.dataset';
import { hashTexto } from './reporting-dataset.util';

/* ============================================================================
    Catálogo VIVO de indicadores (pestaña «Calidad del dato y definiciones»).

    No se escribe a mano: se lee de lo que las otras pestañas publican (sus KPI
    y sus gráficos) y se le agrega lo que un catálogo de KPI como código exige
    (patrón AtlasDashboards, ADR 0004): fórmula, numerador, denominador, fuente,
    responsable, frescura y ESTADO REAL DE LA FUENTE.

    Todo lo que NO sale de la definición del indicador es una SUPOSICIÓN de
    EJEMPLO y se declara como tal: los estados de la fuente, los responsables y
    las frescuras. Ninguna tabla del API se verificó contra una base real.
    ========================================================================== */

/** Pestañas que se catalogan. El Resumen reusa indicadores de estas y esta misma no se autocataloga. */
export type PestanaCatalogada = Extract<
  VerticalReporte,
  'suscripciones' | 'publicidad' | 'comisiones' | 'cobros' | 'adquisicion'
>;

export const PESTANAS_CATALOGADAS: readonly PestanaCatalogada[] = [
  'suscripciones',
  'publicidad',
  'comisiones',
  'cobros',
  'adquisicion',
];

/** Etiquetas cortas para ejes y celdas (las largas están en `reporting-labels`). */
export const ETIQUETA_PESTANA: Readonly<Record<PestanaCatalogada, string>> = {
  suscripciones: 'Suscripciones',
  publicidad: 'Publicidad',
  comisiones: 'Comisiones',
  cobros: 'Cobros',
  adquisicion: 'Adquisición',
};

/* ---- estado real de la fuente (vocabulario del patrón Atlas, adaptado) ----- */

export type EstadoFuente =
  | 'fuente-localizada'
  | 'requiere-vista'
  | 'decision-pendiente'
  | 'no-existe'
  | 'manual';

export const ESTADOS_FUENTE: readonly EstadoFuente[] = [
  'fuente-localizada',
  'requiere-vista',
  'decision-pendiente',
  'no-existe',
  'manual',
];

export const ETIQUETA_ESTADO: Readonly<Record<EstadoFuente, string>> = {
  'fuente-localizada': 'Fuente localizada',
  'requiere-vista': 'Requiere vista',
  'decision-pendiente': 'Decisión pendiente',
  'no-existe': 'No existe',
  manual: 'Manual',
};

export const EXPLICACION_ESTADO: Readonly<Record<EstadoFuente, string>> = {
  'fuente-localizada': 'Hay una tabla candidata en el API; sus columnas están por verificar.',
  'requiere-vista': 'Habría que crear una vista de lectura que hoy no existe.',
  'decision-pendiente': 'Depende de una decisión de negocio que todavía no se tomó.',
  'no-existe': 'No hay fuente, o el indicador no declara cuál usa.',
  manual: 'Lo carga una persona; no sale de ningún sistema.',
};

/* Supuestos de EJEMPLO. Los ids los publican otros agentes en paralelo: además del mapa
   por id hay reglas por palabra del id, y todo lo que no calza queda en la hipótesis
   más optimista del plan (§3: «S»), que es la que menos se puede dar por cierta. */
const ESTADO_POR_ID: Readonly<Record<string, EstadoFuente>> = {
  'alertas-umbral': 'requiere-vista',
  'comision-por-actor': 'decision-pendiente', // A-4: sin esquema de actores
  'comisiones-por-actor': 'decision-pendiente',
  'productividad-actor': 'decision-pendiente',
  'entregas-push': 'decision-pendiente', // A-2: no hay canal push propio
  'aperturas-push': 'decision-pendiente',
  'ocupacion-inventario': 'decision-pendiente',
  'consentimiento-audiencia': 'decision-pendiente',
  'embudo-adquisicion': 'decision-pendiente',
  'salud-de-cuenta': 'decision-pendiente',
};

interface ReglaEstado {
  readonly pestana?: PestanaCatalogada;
  readonly palabras: readonly string[];
  readonly estado: EstadoFuente;
}

const REGLAS_ESTADO: readonly ReglaEstado[] = [
  { pestana: 'comisiones', palabras: ['actor', 'actores'], estado: 'decision-pendiente' },
  {
    pestana: 'publicidad',
    palabras: ['push', 'entregas', 'aperturas', 'ctr', 'inventario', 'ocupacion', 'consentimiento'],
    estado: 'decision-pendiente',
  },
  { palabras: ['embudo', 'cortes', 'salud'], estado: 'decision-pendiente' },
  { palabras: ['alerta', 'alertas'], estado: 'requiere-vista' },
  { palabras: ['meta', 'metas', 'objetivo', 'objetivos'], estado: 'manual' },
];

function estadoSupuesto(pestana: PestanaCatalogada, id: string): EstadoFuente {
  const porId = ESTADO_POR_ID[id];
  if (porId !== undefined) {
    return porId;
  }
  const palabras = id.split(/[-_.]/);
  const regla = REGLAS_ESTADO.find(
    (r) => (r.pestana === undefined || r.pestana === pestana) && r.palabras.some((p) => palabras.includes(p)),
  );
  return regla?.estado ?? 'fuente-localizada';
}

/* ---- responsables y frescura (inventados, por vertical) --------------------- */

export const RESPONSABLE: Readonly<Record<PestanaCatalogada, string>> = {
  suscripciones: 'Dirección comercial',
  publicidad: 'Operaciones de publicidad',
  comisiones: 'Finanzas · comisiones',
  cobros: 'Tesorería',
  adquisicion: 'Crecimiento y marketing',
};

/** Minutos que tarda el dato en llegar, por pestaña (EJEMPLO). Publicidad está pasada de su objetivo a propósito. */
export const FRESCURA_BASE_MIN: Readonly<Record<PestanaCatalogada, number>> = {
  suscripciones: 12,
  publicidad: 63,
  comisiones: 190,
  cobros: 20,
  adquisicion: 95,
};

export const FRESCURA_OBJETIVO_MIN: Readonly<Record<PestanaCatalogada, number>> = {
  suscripciones: 15,
  publicidad: 60,
  comisiones: 240,
  cobros: 30,
  adquisicion: 120,
};

/* ---- filas del catálogo ----------------------------------------------------- */

export interface FilaCatalogo {
  readonly id: string;
  readonly pestana: PestanaCatalogada;
  readonly tipo: 'KPI' | 'Gráfico';
  readonly titulo: string;
  readonly formula: string | null;
  readonly numerador: string | null;
  readonly denominador: string | null;
  readonly fuente: string | null;
  readonly responsable: string;
  readonly frescuraMin: number;
  readonly estado: EstadoFuente;
  /** Es una tasa: exige numerador y denominador. */
  readonly tasa: boolean;
  /** Partes de la definición que faltan; vacío = definición completa. */
  readonly faltan: readonly string[];
}

export const filaCompleta = (f: FilaCatalogo): boolean => f.faltan.length === 0;

const texto = (t: string | undefined | null): string | null => (t != null && t.trim() !== '' ? t : null);
const hayTexto = (t: string | undefined | null): boolean => texto(t) !== null;

function faltantesDe(info: InfoCalculo | null, tasa: boolean): string[] {
  const falta: string[] = [];
  if (!hayTexto(info?.definicion)) falta.push('definición');
  if (!hayTexto(info?.formula)) falta.push('fórmula');
  if (!hayTexto(info?.fuente)) falta.push('fuente');
  if (!hayTexto(info?.frescura)) falta.push('frescura');
  if (tasa && !hayTexto(info?.numerador)) falta.push('numerador');
  if (tasa && !hayTexto(info?.denominador)) falta.push('denominador');
  return falta;
}

function fila(
  pestana: PestanaCatalogada,
  tipo: FilaCatalogo['tipo'],
  id: string,
  titulo: string,
  unidad: UnidadValor,
  info: InfoCalculo | null,
  traeDenominador: boolean,
): FilaCatalogo {
  const tasa = unidad.tipo === 'porcentaje' || traeDenominador || hayTexto(info?.denominador);
  const faltan = faltantesDe(info, tasa);
  const declarado = estadoSupuesto(pestana, id);
  // Sin fórmula o sin fuente no se puede decir que la fuente está localizada.
  const sinBase = faltan.includes('fórmula') || faltan.includes('fuente');
  const estado = declarado === 'fuente-localizada' && sinBase ? 'no-existe' : declarado;
  const jitter = (hashTexto(`${pestana}/${tipo}/${id}`) % 7) - 3;
  return {
    id,
    pestana,
    tipo,
    titulo,
    formula: texto(info?.formula),
    numerador: texto(info?.numerador) ?? (tasa ? null : 'No aplica'),
    denominador: texto(info?.denominador) ?? (tasa ? null : 'No aplica'),
    fuente: texto(info?.fuente),
    responsable: RESPONSABLE[pestana],
    frescuraMin: Math.max(1, FRESCURA_BASE_MIN[pestana] + jitter),
    estado,
    tasa,
    faltan,
  };
}

const filaDeKpi = (p: PestanaCatalogada, k: KpiSpec): FilaCatalogo =>
  fila(p, 'KPI', k.id, k.titulo, k.unidad, k.info, k.denominador !== undefined);

const filaDeGrafico = (p: PestanaCatalogada, g: ChartSpec): FilaCatalogo =>
  fila(p, 'Gráfico', g.id, g.titulo, g.unidad, g.info, false);

export type PestanasLeidas = Readonly<Record<PestanaCatalogada, PestanaReporte | null>>;

export interface CatalogoLeido {
  /** Ordenado por pestaña, KPI antes que gráfico, y por id. */
  readonly filas: readonly FilaCatalogo[];
  /** Pestañas que no se pudieron leer (el constructor falló): se avisa, no se calla. */
  readonly sinLeer: readonly PestanaCatalogada[];
}

export function armarCatalogo(pestanas: PestanasLeidas): CatalogoLeido {
  const filas: FilaCatalogo[] = [];
  const sinLeer: PestanaCatalogada[] = [];
  for (const p of PESTANAS_CATALOGADAS) {
    const tab = pestanas[p];
    if (tab === null) {
      sinLeer.push(p);
      continue;
    }
    const delTab = [...tab.kpis.map((k) => filaDeKpi(p, k)), ...tab.graficos.map((g) => filaDeGrafico(p, g))];
    delTab.sort((a, b) => (a.tipo === b.tipo ? a.id.localeCompare(b.id) : a.tipo === 'KPI' ? -1 : 1));
    filas.push(...delTab);
  }
  return { filas, sinLeer };
}

/* Un catálogo es de definiciones, no de cifras: se lee siempre con el mismo contexto
   de referencia para que cambiar el periodo o la moneda no cambie qué indicadores hay. */
const CONTEXTO_REFERENCIA: ContextoReporte = {
  periodo: '30d',
  comparar: 'ninguna',
  moneda: 'BOB',
  alcance: 'plataforma',
  filtros: [],
};

function leer(construir: (ctx: ContextoReporte) => PestanaReporte): PestanaReporte | null {
  try {
    return construir(CONTEXTO_REFERENCIA);
  } catch {
    return null;
  }
}

export function leerPestanas(): PestanasLeidas {
  return {
    suscripciones: leer(construirSuscripciones),
    publicidad: leer(construirPublicidad),
    comisiones: leer(construirComisiones),
    cobros: leer(construirCobros),
    adquisicion: leer(construirAdquisicion),
  };
}

/* ---- filtro por clic «estado» ------------------------------------------------ */

const plano = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Estado al que apunta un valor de filtro (la etiqueta del gráfico o el código); `null` si no es ninguno. */
export function estadoDeFiltro(valor: string): EstadoFuente | null {
  const v = plano(valor);
  return ESTADOS_FUENTE.find((e) => plano(ETIQUETA_ESTADO[e]) === v || e === v) ?? null;
}

export function filtrarPorEstado(filas: readonly FilaCatalogo[], ctx: ContextoReporte): readonly FilaCatalogo[] {
  const valor = ctx.filtros.find((f) => f.dimension === 'estado')?.valor;
  const estado = valor === undefined ? null : estadoDeFiltro(valor);
  return estado === null ? filas : filas.filter((f) => f.estado === estado);
}
