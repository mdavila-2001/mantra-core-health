import type { ContextoReporte, FiltroActivo, PeriodoReporte } from '../../../data-access/reporting/reporting.types';
import {
  daysInPeriod,
  factorContexto,
  periodDates,
  granularidad,
  hashTexto,
  rng,
  suma,
} from './reporting-dataset.util';

/* ============================================================================
    Modelo de EJEMPLO de la pestaña «Suscripciones de doctores».

    Todo se calcula en BOB y se convierte al final (`convertir`) para que
    cambiar de moneda no cambie ni el ruido ni la forma de las series. Los
    números salen de UN solo modelo (cuentas → MRR → ingreso → mora) para que
    las tarjetas, los gráficos y las tablas no puedan contradecirse.
    ========================================================================== */

export interface Plan {
  readonly nombre: string;
  /** Precio mensual de EJEMPLO, en BOB. */
  readonly precio: number;
  /** Consultas incluidas por mes. */
  readonly cuota: number;
}

/** Planes inventados y neutros; ningún precio es una tarifa real. */
export const PLANES: readonly Plan[] = [
  { nombre: 'Esencial', precio: 190, cuota: 150 },
  { nombre: 'Profesional', precio: 420, cuota: 600 },
  { nombre: 'Clínica', precio: 1150, cuota: 2500 },
];

export const SUSCRIPTORES_BASE = 1240;
const CHURN_MENSUAL_PCT = 2.4;
const TRIALS_POR_MES = 150;
const TASA_PRUEBA_A_PAGO = 0.38;
const VENTANA_MORA_DIAS = 30;

const CRECIMIENTO_SUBS_PCT: Readonly<Record<PeriodoReporte, number>> = {
  '7d': 0.8,
  '30d': 2.6,
  '90d': 7,
  ytd: 22,
  '12m': 29,
};

export function claveFiltros(filtros: readonly FiltroActivo[]): string {
  return filtros
    .map((f) => `${f.dimension}:${f.valor}`)
    .sort()
    .join('|');
}

export function semillaDe(ctx: ContextoReporte): number {
  return hashTexto(`susc|${ctx.alcance}|${claveFiltros(ctx.filtros)}`);
}

/** Multiplicador ≈1 que depende del alcance y los filtros: cambia las TASAS entre cortes, no solo los conteos. */
export function oscilar(ctx: ContextoReporte, etiqueta: string, amplitud: number): number {
  const h = hashTexto(`${etiqueta}|${ctx.alcance}|${claveFiltros(ctx.filtros)}`) % 1000;
  return 1 + (h / 1000 - 0.5) * 2 * amplitud;
}

/** Suscriptores activos al cierre, sin pasar por el modelo diario (lo usan los cortes). */
export function suscriptoresAlCierre(ctx: ContextoReporte): number {
  return Math.round(SUSCRIPTORES_BASE * factorContexto(ctx));
}

/** Participación de cada plan en las cuentas activas; `t` ∈ [0,1] es la posición dentro del periodo. */
export function participacionPlanes(t: number, dias: number): readonly [number, number, number] {
  const d = Math.min(1, dias / 90);
  const esencial = 0.49 - 0.02 * d * t;
  const clinica = 0.115 + 0.01 * d * t;
  return [esencial, 1 - esencial - clinica, clinica];
}

/** Reparte `total` en `n` enteros que suman EXACTO `total` (mayor resto): el residuo se asigna, no se pierde. */
export function repartir(total: number, n: number, r: () => number): number[] {
  const pesos = Array.from({ length: n }, (_, i) => (0.6 + r() * 0.8) * (1 + 0.25 * Math.sin((i / 7) * 2 * Math.PI)));
  const s = suma(pesos);
  const crudo = pesos.map((p) => (total * p) / s);
  const base = crudo.map((c) => Math.floor(c));
  const resto = total - suma(base);
  const orden = crudo
    .map((c, i) => ({ i, frac: c - Math.floor(c) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < resto; k++) {
    base[orden[k]!.i]! += 1;
  }
  return base;
}

export interface ComponentesMrr {
  readonly inicial: number;
  readonly nuevas: number;
  readonly expansion: number;
  readonly contraccion: number;
  readonly bajas: number;
  readonly final: number;
}

export interface ModeloSuscripciones {
  readonly fechas: readonly string[];
  readonly gran: 'dia' | 'semana' | 'mes';
  readonly n: number;
  readonly meses: number;
  readonly subs: readonly number[];
  readonly subsIni: number;
  readonly subsFin: number;
  /** MRR diario total y por plan (mismo orden que `PLANES`), en BOB. */
  readonly mrr: readonly number[];
  readonly mrrPlan: readonly (readonly number[])[];
  readonly arpu: readonly number[];
  readonly altas: readonly number[];
  readonly bajas: readonly number[];
  readonly altasTotal: number;
  readonly bajasTotal: number;
  readonly churnMensualPct: number;
  readonly churnDia: readonly number[];
  /** Ingreso reconocido por día y plan (MRR ÷ 30), en BOB. */
  readonly ingresoPlan: readonly (readonly number[])[];
  readonly ingresoTotal: number;
  readonly mora: {
    readonly nueva: readonly number[];
    readonly recuperada: readonly number[];
    readonly saldo: readonly number[];
    readonly fallidos: number;
    readonly recuperados: number;
  };
  readonly embudo: { readonly registros: number; readonly verificados: number; readonly enPrueba: number; readonly pagantes: number };
  readonly mrrComp: ComponentesMrr;
}

export function modelarSuscripciones(ctx: ContextoReporte): ModeloSuscripciones {
  const fechas = periodDates(ctx.periodo);
  const n = fechas.length;
  const dias = daysInPeriod(ctx.periodo);
  const meses = dias / 30;
  const r = rng(semillaDe(ctx));

  const subsFin = suscriptoresAlCierre(ctx);
  const subsIni = Math.round(subsFin / (1 + CRECIMIENTO_SUBS_PCT[ctx.periodo] / 100));
  const subs = fechas.map((_, i) => {
    if (i === 0) return subsIni;
    if (i === n - 1) return subsFin;
    return Math.round((subsIni + ((subsFin - subsIni) * i) / (n - 1)) * (1 + (r() - 0.5) * 0.006));
  });

  const mrrPlan = PLANES.map((plan, p) =>
    subs.map((s, i) => s * participacionPlanes(i / (n - 1), dias)[p]! * plan.precio),
  );
  const mrr = fechas.map((_, i) => suma(mrrPlan.map((m) => m[i]!)));
  const arpu = mrr.map((m, i) => (subs[i]! > 0 ? m / subs[i]! : 0));
  const ingresoPlan = mrrPlan.map((m) => m.map((v) => v / 30));
  const ingresoTotal = suma(ingresoPlan.map((p) => suma(p)));

  const churnMensualPct = CHURN_MENSUAL_PCT * oscilar(ctx, 'churn', 0.18);
  const bajasTotal = Math.round((churnMensualPct / 100) * subsIni * meses);
  const altasTotal = Math.max(0, subsFin - subsIni + bajasTotal);
  const altas = repartir(altasTotal, n, r);
  const bajas = repartir(bajasTotal, n, r);

  let desvio = 0;
  const churnDia = fechas.map(() => {
    desvio = 0.9 * desvio + (r() - 0.5) * 0.35;
    return Math.max(0.2, churnMensualPct + desvio);
  });

  const mora = modelarMora(ctx, mrr, arpu, subsFin, n, r);

  const trials = Math.round(TRIALS_POR_MES * meses * factorContexto(ctx));
  const pagantes = Math.min(altasTotal, Math.round(trials * TASA_PRUEBA_A_PAGO * oscilar(ctx, 'conversion', 0.15)));
  const verificados = Math.round(trials / 0.8);
  const embudo = { registros: Math.round(verificados / 0.7), verificados, enPrueba: trials, pagantes };

  return {
    fechas, gran: granularidad(ctx.periodo), n, meses, subs, subsIni, subsFin, mrr, mrrPlan, arpu,
    altas, bajas, altasTotal, bajasTotal, churnMensualPct, churnDia, ingresoPlan, ingresoTotal, mora, embudo,
    mrrComp: componentesMrr(ctx, mrr, arpu, altasTotal, bajasTotal, meses),
  };
}

/** Cascada de MRR: el error de cierre se absorbe en un término que no pueda quedar negativo. */
function componentesMrr(
  ctx: ContextoReporte,
  mrr: readonly number[],
  arpu: readonly number[],
  altasTotal: number,
  bajasTotal: number,
  meses: number,
): ComponentesMrr {
  const inicial = mrr[0]!;
  const final = mrr[mrr.length - 1]!;
  const bajas = bajasTotal * arpu[0]!;
  const expansion = inicial * 0.011 * meses * oscilar(ctx, 'expansion', 0.2);
  let contraccion = inicial * 0.004 * meses * oscilar(ctx, 'contraccion', 0.2);
  let nuevas = altasTotal * arpu[0]! * 0.85;
  const error = final - (inicial + nuevas + expansion - contraccion - bajas);
  if (error >= 0) {
    nuevas += error;
  } else {
    contraccion -= error;
  }
  return { inicial, nuevas, expansion, contraccion, bajas, final };
}

/**
 * Mora: el saldo es la suma móvil de 30 días de lo que no se cobró en el primer
 * reintento; lo más viejo pasa a cobranza externa y sale del saldo. Así el
 * saldo SIGUE a los flujos que se dibujan al lado y no puede contradecirlos.
 */
function modelarMora(
  ctx: ContextoReporte,
  mrr: readonly number[],
  arpu: readonly number[],
  subsFin: number,
  n: number,
  r: () => number,
): ModeloSuscripciones['mora'] {
  const tasa = Math.min(0.95, 0.58 * oscilar(ctx, 'recuperacion', 0.1));
  const previo = VENTANA_MORA_DIAS - 1;
  const nuevaExt = Array.from({ length: n + previo }, (_, j) => (mrr[Math.max(0, j - previo)]! / 30) * 0.12 * (0.85 + 0.3 * r()));
  const sinResolver = nuevaExt.map((v) => v * (1 - tasa));
  const saldo = Array.from({ length: n }, (_, i) => suma(sinResolver.slice(i, i + VENTANA_MORA_DIAS)));
  const nueva = nuevaExt.slice(previo);
  const recuperada = nueva.map((v) => v * tasa);
  const ticket = suma(arpu) / n;
  const fallidos = ticket > 0 && subsFin > 0 ? Math.round(suma(nueva) / ticket) : 0;
  return { nueva, recuperada, saldo, fallidos, recuperados: Math.round(fallidos * tasa) };
}
