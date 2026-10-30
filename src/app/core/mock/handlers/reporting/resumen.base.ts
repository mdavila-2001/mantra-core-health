import type {
  ContextoReporte,
  InfoCalculo,
  KpiSpec,
  PestanaReporte,
} from '../../../data-access/reporting/reporting.types';
import { construirComisiones } from './comisiones.dataset';
import { construirPublicidad } from './publicidad.dataset';
import { construirSuscripciones } from './suscripciones.dataset';
import {
  INFO_EJEMPLO,
  agrupar,
  daysInPeriod,
  periodDates,
  granularidad,
  hashTexto,
  redondear,
  rng,
  serie,
  suma,
} from './reporting-dataset.util';

/* ============================================================================
    Base del Resumen ejecutivo.

    El Resumen NO inventa dinero: lee el KPI `ingreso-periodo` de las tres
    verticales y lo compone. Así el total del Resumen coincide por construcción
    con lo que dice cada pestaña. Si falta una de las tres, el compuesto es
    «sin dato» con su motivo: una suma parcial parecería un total y mentiría.
    ========================================================================== */

export type ClaveVertical = 'suscripciones' | 'publicidad' | 'comisiones';

export const VERTICAL_NAME: Readonly<Record<ClaveVertical, string>> = {
  suscripciones: 'Suscripciones',
  publicidad: 'Publicidad',
  comisiones: 'Comisiones',
};

export const ORDEN: readonly ClaveVertical[] = ['suscripciones', 'publicidad', 'comisiones'];

/** Crecimiento total del periodo que imaginamos para cada vertical (forma de la serie, no su nivel). */
export const CRECIMIENTO: Readonly<Record<ClaveVertical, number>> = {
  suscripciones: 14,
  publicidad: 28,
  comisiones: 20,
};

export interface LecturaVertical {
  readonly clave: ClaveVertical;
  readonly nombre: string;
  readonly pestana: PestanaReporte;
  /** Ingreso del periodo en la moneda del contexto; `null` = sin dato. */
  readonly ingreso: number | null;
  readonly motivo: string | null;
  readonly variacionPct: number | null;
  /** Ingreso del periodo de comparación, derivado de la variación que declara la vertical. */
  readonly anterior: number | null;
}

export interface BaseResumen {
  readonly ctx: ContextoReporte;
  readonly lecturas: Readonly<Record<ClaveVertical, LecturaVertical>>;
  readonly total: number | null;
  readonly anterior: number | null;
  readonly motivoTotal: string | null;
}

export function buscarKpi(p: PestanaReporte, ...ids: string[]): KpiSpec | undefined {
  for (const id of ids) {
    const k = p.kpis.find((x) => x.id === id);
    if (k !== undefined) {
      return k;
    }
  }
  return undefined;
}

/** Valor del KPI sólo si es un importe en la moneda del contexto; si no, `null` y el porqué. */
export function importeEnMoneda(
  k: KpiSpec | undefined,
  ctx: ContextoReporte,
  cosa: string,
): { valor: number | null; motivo: string | null } {
  if (k === undefined) {
    return { valor: null, motivo: `Falta ${cosa}.` };
  }
  if (k.valor === null || Number.isNaN(k.valor)) {
    const causa = k.motivoSinDato?.trim();
    return { valor: null, motivo: `Falta ${cosa}${causa ? `: ${causa}` : '.'}` };
  }
  if (k.unidad.tipo !== 'moneda' || k.unidad.moneda !== ctx.moneda) {
    return { valor: null, motivo: `${cosa[0]!.toUpperCase()}${cosa.slice(1)} no viene en ${ctx.moneda}; no se suman monedas distintas.` };
  }
  return { valor: k.valor, motivo: null };
}

export function previousValue(valor: number | null, pct: number | null, ctx: ContextoReporte): number | null {
  if (valor === null || pct === null || ctx.comparar === 'ninguna' || pct <= -100) {
    return null;
  }
  return redondear(valor / (1 + pct / 100));
}

function leer(clave: ClaveVertical, pestana: PestanaReporte, ctx: ContextoReporte): LecturaVertical {
  const name = VERTICAL_NAME[clave];
  const k = buscarKpi(pestana, 'ingreso-periodo');
  const { valor, motivo } = importeEnMoneda(k, ctx, `el ingreso de ${name}`);
  const pct = valor === null ? null : (k?.variacionPct ?? null);
  return { clave, nombre: name, pestana, ingreso: valor, motivo, variacionPct: pct, anterior: previousValue(valor, pct, ctx) };
}

/** De dónde sale cada vertical. Se inyecta sólo en las pruebas, para simular una vertical vacía. */
export type FuentesResumen = Readonly<Record<ClaveVertical, (ctx: ContextoReporte) => PestanaReporte>>;

export const FUENTES_REALES: FuentesResumen = {
  suscripciones: construirSuscripciones,
  publicidad: construirPublicidad,
  comisiones: construirComisiones,
};

export function componerBase(ctx: ContextoReporte, fuentes: FuentesResumen = FUENTES_REALES): BaseResumen {
  const lecturas: Record<ClaveVertical, LecturaVertical> = {
    suscripciones: leer('suscripciones', fuentes.suscripciones(ctx), ctx),
    publicidad: leer('publicidad', fuentes.publicidad(ctx), ctx),
    comisiones: leer('comisiones', fuentes.comisiones(ctx), ctx),
  };
  const faltan = ORDEN.map((c) => lecturas[c]).filter((l) => l.ingreso === null);
  const total =
    faltan.length === 0 ? redondear(suma(ORDEN.map((c) => lecturas[c].ingreso))) : null;
  const priors = ORDEN.map((c) => lecturas[c].anterior);
  const anterior = total !== null && priors.every((p) => p !== null) ? redondear(suma(priors)) : null;
  const totalReason =
    faltan.length === 0
      ? null
      : `${faltan.map((l) => l.motivo ?? `Falta el ingreso de ${l.nombre}.`).join(' ')} Sin las tres verticales no hay total: una suma parcial parecería completa.`;
  return { ctx, lecturas, total, anterior, motivoTotal: totalReason };
}

/* ---- series ------------------------------------------------------------------ */

export interface SerieIngreso {
  readonly etiquetas: string[];
  readonly porVertical: Readonly<Record<ClaveVertical, (number | null)[]>>;
  /** `null` en un cubo si falta alguna vertical. */
  readonly total: (number | null)[];
}

/**
 * Reparte el ingreso de cada vertical a lo largo del periodo con una forma
 * propia y lo CALIBRA para que la suma de los cubos sea exactamente el ingreso:
 * el residuo del redondeo cae en el último cubo, nunca se pierde.
 */
export function incomeSeries(base: BaseResumen): SerieIngreso {
  const { ctx } = base;
  const fechas = periodDates(ctx.periodo);
  const gran = granularidad(ctx.periodo);
  const n = daysInPeriod(ctx.periodo);
  let etiquetas: string[] = [];
  const byVertical = {} as Record<ClaveVertical, (number | null)[]>;
  for (const c of ORDEN) {
    const ingreso = base.lecturas[c].ingreso;
    const diaria = serie(hashTexto(`resumen:${c}:${ctx.periodo}`), n, 1, CRECIMIENTO[c], 5);
    const g = agrupar(fechas, diaria, gran, 'suma');
    etiquetas = g.etiquetas;
    if (ingreso === null) {
      byVertical[c] = g.valores.map(() => null);
      continue;
    }
    const k = ingreso / suma(g.valores);
    const cubos = g.valores.map((v) => redondear(v * k));
    const residuo = redondear(ingreso - suma(cubos));
    cubos[cubos.length - 1] = redondear(cubos[cubos.length - 1]! + residuo);
    byVertical[c] = cubos;
  }
  const total = etiquetas.map((_, i) => {
    const partes = ORDEN.map((c) => byVertical[c][i] ?? null);
    return partes.every((p) => p !== null) ? redondear(suma(partes)) : null;
  });
  return { etiquetas, porVertical: byVertical, total };
}

/** Saldo diario que termina EXACTAMENTE en `cierre` (para MRR: es un saldo, no un flujo). */
export function saldoDiario(semilla: number, n: number, cierre: number, variacion: number | null): number[] {
  const inicio = cierre / (variacion !== null && variacion > -100 ? 1 + variacion / 100 : 1.06);
  const r = rng(semilla);
  return Array.from({ length: n }, (_, i) => {
    if (i === n - 1) {
      return redondear(cierre);
    }
    const lineal = inicio + (cierre - inicio) * (i / Math.max(1, n - 1));
    return redondear(lineal * (1 + (r() - 0.5) * 0.012));
  });
}

export function infoEjemplo(
  i: Omit<InfoCalculo, 'frescura'> & { frescura?: string },
): InfoCalculo {
  return {
    ...i,
    frescura: i.frescura ?? INFO_EJEMPLO.frescura,
    salvedades: ['Datos de EJEMPLO.', ...(i.salvedades ?? [])],
  };
}
