import type {
  ChartSpec,
  ContextoReporte,
  FiltroActivo,
  InfoCalculo,
  KpiSpec,
  Moneda,
  PeriodoReporte,
  Vela,
} from '../../../data-access/reporting/reporting.types';

/* ============================================================================
    Utilidades compartidas de los datos de EJEMPLO del portal de reportería.

    TODO lo que sale de acá es inventado, determinista y se declara como
    `origen: 'ejemplo'`. Dos reglas que las pestañas heredan:
      · La misma consulta da siempre los mismos números (semilla fija y fecha
        ancla), porque unas capturas que cambian solas no prueban nada.
      · Un filtro cambia los números de verdad: si hacer clic en un gráfico no
        mueve nada, el clic no filtra.
    ========================================================================== */

/** Fecha ancla de la maqueta: «hoy» no se mueve. */
export const ANCHOR_DATE = new Date(Date.UTC(2026, 9, 30));

/** Tipo de cambio de EJEMPLO para pasar BOB a USD. No es una cotización. */
export const BOB_PER_USD = 6.96;

export function rng(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DIAS: Readonly<Record<PeriodoReporte, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  ytd: 303,
  '12m': 365,
};

export function daysInPeriod(periodo: PeriodoReporte): number {
  return DIAS[periodo];
}

export function dateLabel(desplazamientoDias: number): string {
  const d = new Date(ANCHOR_DATE.getTime() - desplazamientoDias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Fechas ISO (día) del periodo, de la más vieja a la más nueva. */
export function periodDates(periodo: PeriodoReporte): string[] {
  const n = daysInPeriod(periodo);
  return Array.from({ length: n }, (_, i) => dateLabel(n - 1 - i));
}

/** Cubos para no dibujar 365 puntos: ≤ 31 → diario, ≤ 120 → semanal, resto → mensual. */
export function granularidad(periodo: PeriodoReporte): 'dia' | 'semana' | 'mes' {
  const n = daysInPeriod(periodo);
  return n <= 31 ? 'dia' : n <= 120 ? 'semana' : 'mes';
}

/** Factor (0–1] que aplican el alcance y los filtros activos a cualquier magnitud. */
export function factorContexto(ctx: ContextoReporte): number {
  let f = ctx.alcance === 'organizacion' ? 0.22 : 1;
  for (const filtro of ctx.filtros) {
    f *= filterFactor(filtro);
  }
  return f;
}

export function filterFactor(filtro: FiltroActivo): number {
  const h = hashTexto(`${filtro.dimension}:${filtro.valor}`) % 1000;
  return 0.18 + (h / 1000) * 0.4; // 0,18 – 0,58
}

export function convertir(valorBob: number, moneda: Moneda): number {
  return moneda === 'USD' ? valorBob / BOB_PER_USD : valorBob;
}

/** Serie con tendencia, estacionalidad semanal y ruido. */
export function serie(
  semilla: number,
  n: number,
  base: number,
  crecimientoTotalPct: number,
  ruidoPct = 4,
): number[] {
  const r = rng(semilla);
  return Array.from({ length: n }, (_, i) => {
    const tendencia = base * (1 + (crecimientoTotalPct / 100) * (i / Math.max(1, n - 1)));
    const semanal = 1 + 0.05 * Math.sin((i / 7) * 2 * Math.PI);
    const ruido = 1 + ((r() - 0.5) * 2 * ruidoPct) / 100;
    return Math.max(0, tendencia * semanal * ruido);
  });
}

export function redondear(valor: number, decimales = 2): number {
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

export function suma(valores: readonly (number | null)[]): number {
  return valores.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/** Agrupa una serie diaria en cubos; `agregar` decide si suma o toma el último. */
export function agrupar(
  fechas: readonly string[],
  valores: readonly number[],
  gran: 'dia' | 'semana' | 'mes',
  agregar: 'suma' | 'ultimo' | 'promedio',
): { etiquetas: string[]; valores: number[] } {
  if (gran === 'dia') {
    return { etiquetas: [...fechas], valores: [...valores] };
  }
  const tamano = gran === 'semana' ? 7 : 30;
  const etiquetas: string[] = [];
  const out: number[] = [];
  for (let i = 0; i < valores.length; i += tamano) {
    const trozo = valores.slice(i, i + tamano);
    etiquetas.push(fechas[i]!);
    out.push(
      agregar === 'suma'
        ? suma(trozo)
        : agregar === 'ultimo'
          ? trozo[trozo.length - 1]!
          : suma(trozo) / trozo.length,
    );
  }
  return { etiquetas, valores: out };
}

/**
 * Velas a partir de una serie diaria: cada vela resume un cubo (apertura = primer
 * día, cierre = último, mínimo y máximo del cubo). Para series de SALDO o de
 * RAZÓN (MRR, CPM, saldo por pagar) — no para flujos que se suman.
 */
export function candlesFromSeries(
  fechas: readonly string[],
  valores: readonly number[],
  gran: 'dia' | 'semana' | 'mes',
): Vela[] {
  const tamano = gran === 'dia' ? 3 : gran === 'semana' ? 7 : 30;
  const velas: Vela[] = [];
  for (let i = 0; i < valores.length; i += tamano) {
    const t = valores.slice(i, i + tamano);
    if (t.length === 0) {
      continue;
    }
    velas.push({
      fecha: fechas[i]!,
      apertura: redondear(t[0]!),
      cierre: redondear(t[t.length - 1]!),
      minimo: redondear(Math.min(...t)),
      maximo: redondear(Math.max(...t)),
    });
  }
  return velas;
}

export function variacionPct(actual: number | null, anterior: number | null): number | null {
  if (actual === null || anterior === null || anterior === 0) {
    return null;
  }
  return redondear(((actual - anterior) / anterior) * 100, 1);
}

/** Variación según la comparación elegida; con «ninguna» no hay comparativo (`null`). */
export function variacionContexto(ctx: ContextoReporte, actual: number, semilla: number): number | null {
  if (ctx.comparar === 'ninguna') {
    return null;
  }
  const r = rng(semilla);
  const prev = actual / (1 + (r() * 0.3 - 0.08));
  return variacionPct(actual, prev);
}

export const INFO_EJEMPLO: Pick<InfoCalculo, 'frescura'> = {
  frescura: 'Datos de EJEMPLO generados en el navegador; no provienen de ninguna fuente real.',
};

/** Construye un KPI cumpliendo el contrato (info o motivo). */
export function kpi(
  k: Omit<KpiSpec, 'info' | 'infoMotivo'> & { info: InfoCalculo | null; infoMotivo?: string },
): KpiSpec {
  return k;
}

/** Atajo para tests y para verificar que un gráfico declara lo que debe. */
export function contractGaps(spec: ChartSpec): string[] {
  const huecos: string[] = [];
  if (spec.titulo.trim() === '') huecos.push('titulo');
  if (spec.resumenAccesible.trim() === '') huecos.push('resumenAccesible');
  if (spec.filtro === null && !spec.filtroMotivo) huecos.push('filtroMotivo');
  if (spec.info === null && !spec.infoMotivo) huecos.push('infoMotivo');
  if (spec.velas === null && !spec.velasMotivo) huecos.push('velasMotivo');
  return huecos;
}
