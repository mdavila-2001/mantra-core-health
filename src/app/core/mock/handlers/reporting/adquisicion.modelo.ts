import type { ContextoReporte, Vela } from '../../../data-access/reporting/reporting.types';
import {
  agrupar,
  daysInPeriod,
  factorContexto,
  periodDates,
  granularidad,
  redondear,
  rng,
  serie,
  suma,
} from './reporting-dataset.util';

/* ============================================================================
    Modelo de EJEMPLO de la pestaña «Adquisición y cuentas».

    Se construye de arriba abajo para que NADA se contradiga:
      leads por día → leads por campaña (reparto exacto) → cada etapa del embudo
      se reparte entre las campañas con tope en la etapa anterior → los canales
      son la suma de sus campañas.
    Así el embudo es monótono por construcción y «CAC = inversión ÷ clientes
    nuevos» se cumple al céntimo, sin ajustes posteriores.
    ========================================================================== */

/** Por debajo de este tamaño una tasa no se calcula: sale «Sin dato», no un 0 ni un 100 %. */
export const MIN_MUESTRA_TASA = 30;

export const CANAL_ORGANICO = 'Orgánico y buscadores';
export const ORGANIC_REASON = 'Canal orgánico: sin inversión atribuible';
export const NO_CLIENTS_REASON = 'Sin clientes nuevos en el periodo: el costo por cliente no se puede calcular.';

export const CANALES = [
  'Búsqueda de pago',
  'Redes sociales',
  'Correo y WhatsApp',
  'Alianzas con clínicas',
  'Referidos',
  CANAL_ORGANICO,
] as const;

/** Margen mensual de EJEMPLO por cliente pagante (precio de lista × margen), en BOB. */
export const MARGEN_MENSUAL_BOB = 208.8;
/** Objetivo de EJEMPLO del payback del CAC, en meses. */
export const OBJETIVO_PAYBACK_MESES = 6;

export interface DefCampana {
  readonly id: string;
  readonly nombre: string;
  readonly canal: (typeof CANALES)[number];
  /** Parte de los leads del periodo. Suman 1. */
  readonly cuota: number;
  /** Paso a paso: lead→registro, registro→identidad, identidad→activa, activa→pagante. */
  readonly tasas: readonly [number, number, number, number];
  /** Costo por lead en BOB; `null` = sin inversión atribuible (orgánico). */
  readonly cplBob: number | null;
}

// Nombres comerciales de campaña INVENTADOS; ninguno corresponde a una campaña real.
export const CAMPANAS: readonly DefCampana[] = [
  { id: 'busq-gen', nombre: 'Búsqueda · doctores generalistas', canal: 'Búsqueda de pago', cuota: 0.13, tasas: [0.64, 0.72, 0.75, 0.6], cplBob: 260 },
  { id: 'busq-esp', nombre: 'Búsqueda · especialistas', canal: 'Búsqueda de pago', cuota: 0.1, tasas: [0.68, 0.74, 0.78, 0.66], cplBob: 340 },
  { id: 'redes-lanz', nombre: 'Redes · lanzamiento para clínicas', canal: 'Redes sociales', cuota: 0.15, tasas: [0.52, 0.66, 0.7, 0.5], cplBob: 170 },
  { id: 'redes-react', nombre: 'Redes · reactivación de doctores', canal: 'Redes sociales', cuota: 0.11, tasas: [0.58, 0.7, 0.72, 0.55], cplBob: 210 },
  { id: 'correo', nombre: 'Correo · nutrición de leads', canal: 'Correo y WhatsApp', cuota: 0.07, tasas: [0.74, 0.78, 0.8, 0.62], cplBob: 30 },
  { id: 'wa', nombre: 'WhatsApp · seguimiento', canal: 'Correo y WhatsApp', cuota: 0.05, tasas: [0.81, 0.8, 0.82, 0.68], cplBob: 45 },
  { id: 'alianza', nombre: 'Alianza · colegio médico regional', canal: 'Alianzas con clínicas', cuota: 0.09, tasas: [0.7, 0.8, 0.84, 0.72], cplBob: 230 },
  { id: 'referidos', nombre: 'Programa «Invita a un colega»', canal: 'Referidos', cuota: 0.12, tasas: [0.78, 0.82, 0.86, 0.74], cplBob: 120 },
  { id: 'organico', nombre: 'Contenido y buscadores', canal: CANAL_ORGANICO, cuota: 0.18, tasas: [0.6, 0.7, 0.72, 0.52], cplBob: null },
];

/**
 * Reparte `total` (entero) entre `pesos` por el método del mayor resto. Con
 * `topes` ningún destino pasa de su tope. La suma da `total` siempre que
 * `total ≤ Σ topes`: es lo que mantiene los embudos exactos.
 */
export function repartir(total: number, pesos: readonly number[], topes?: readonly number[]): number[] {
  const tope = (i: number): number => topes?.[i] ?? Number.POSITIVE_INFINITY;
  const s = suma(pesos);
  const exacto = pesos.map((p) => (s > 0 ? (total * p) / s : 0));
  const out = exacto.map((x, i) => Math.min(Math.floor(x), tope(i)));
  let resto = total - suma(out);
  while (resto > 0) {
    let mejor = -1;
    let deficit = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < out.length; i++) {
      if (out[i]! < tope(i) && exacto[i]! - out[i]! > deficit) {
        deficit = exacto[i]! - out[i]!;
        mejor = i;
      }
    }
    if (mejor < 0) break;
    out[mejor] = out[mejor]! + 1;
    resto--;
  }
  return out;
}

export interface FilaCampana {
  readonly def: DefCampana;
  readonly leads: number;
  readonly registros: number;
  readonly identidad: number;
  readonly activas: number;
  readonly pagantes: number;
  readonly inversionBob: number | null;
}

export interface FilaCanal {
  readonly nombre: string;
  readonly organico: boolean;
  readonly leads: number;
  readonly registros: number;
  readonly activas: number;
  readonly pagantes: number;
  readonly inversionBob: number | null;
  readonly cacBob: number | null;
}

export interface ModeloAdquisicion {
  readonly factor: number;
  readonly gran: 'dia' | 'semana' | 'mes';
  readonly fechas: readonly string[];
  readonly leadsDia: readonly number[];
  readonly registrosDia: readonly number[];
  readonly newPerDay: readonly number[];
  readonly embudo: { readonly leads: number; readonly registros: number; readonly identidad: number; readonly activas: number; readonly pagantes: number };
  readonly campanas: readonly FilaCampana[];
  readonly canales: readonly FilaCanal[];
  readonly inversionBob: number | null;
  readonly cacBob: number | null;
  /** Por qué no hay CAC (o `null` si lo hay). */
  readonly noCacReason: string | null;
  /** CAC móvil de 7 días por día, en BOB; `null` = sin clientes nuevos en la ventana. */
  readonly cacMovil: readonly (number | null)[];
}

export function canalFiltrado(ctx: ContextoReporte): string | null {
  return ctx.filtros.find((f) => f.dimension === 'canal')?.valor ?? null;
}

export function calcularModelo(ctx: ContextoReporte): ModeloAdquisicion {
  const n = daysInPeriod(ctx.periodo);
  const factor = factorContexto(ctx);
  const fechas = periodDates(ctx.periodo);
  const gran = granularidad(ctx.periodo);

  const leadsDia = serie(7101, n, 46, 18, 7).map((v) => Math.round(v * factor));
  const leads = suma(leadsDia);

  // Etapas por campaña. Cada total de etapa sale de la suma de lo esperado por campaña.
  const lc = repartir(leads, CAMPANAS.map((c) => c.cuota));
  const esperado = (previo: readonly number[], k: 0 | 1 | 2 | 3): number =>
    Math.round(suma(previo.map((v, i) => v * CAMPANAS[i]!.tasas[k])));
  const etapa = (total: number, previo: readonly number[], k: 0 | 1 | 2 | 3): number[] =>
    repartir(total, previo.map((v, i) => v * CAMPANAS[i]!.tasas[k]), previo);

  const rc = etapa(esperado(lc, 0), lc, 0);
  const ic = etapa(esperado(rc, 1), rc, 1);
  const ac = etapa(esperado(ic, 2), ic, 2);
  const pc = etapa(esperado(ac, 3), ac, 3);

  const campanas: FilaCampana[] = CAMPANAS.map((def, i) => ({
    def,
    leads: lc[i]!,
    registros: rc[i]!,
    identidad: ic[i]!,
    activas: ac[i]!,
    pagantes: pc[i]!,
    inversionBob: def.cplBob === null ? null : redondear(lc[i]! * def.cplBob),
  }));

  const canales: FilaCanal[] = CANALES.map((nombre) => {
    const g = campanas.filter((c) => c.def.canal === nombre);
    const organico = g.every((c) => c.inversionBob === null);
    const inversionBob = organico ? null : redondear(suma(g.map((c) => c.inversionBob)));
    const pagantes = suma(g.map((c) => c.pagantes));
    return {
      nombre,
      organico,
      leads: suma(g.map((c) => c.leads)),
      registros: suma(g.map((c) => c.registros)),
      activas: suma(g.map((c) => c.activas)),
      pagantes,
      inversionBob,
      cacBob: inversionBob === null || pagantes === 0 ? null : redondear(inversionBob / pagantes),
    };
  });

  const embudo = {
    leads,
    registros: suma(rc),
    identidad: suma(ic),
    activas: suma(ac),
    pagantes: suma(pc),
  };

  // Series diarias que suman exactamente lo del embudo (tope: lo del día anterior en el embudo).
  const r = rng(7102);
  const registrosDia = repartir(embudo.registros, leadsDia.map((v) => v * (0.92 + 0.16 * r())), leadsDia);
  const newPerDay = repartir(embudo.pagantes, registrosDia.map((v) => v * (0.85 + 0.3 * r())), registrosDia);

  const organicoFiltrado = canalFiltrado(ctx) === CANAL_ORGANICO;
  const inversionTotal = organicoFiltrado ? null : redondear(suma(campanas.map((c) => c.inversionBob)));
  const cacBob =
    inversionTotal === null || embudo.pagantes === 0 ? null : redondear(inversionTotal / embudo.pagantes);
  const noCacReason = organicoFiltrado ? ORGANIC_REASON : embudo.pagantes === 0 ? NO_CLIENTS_REASON : null;

  // La inversión diaria se reparte en céntimos para que la suma sea exacta.
  const centDia =
    inversionTotal === null
      ? null
      : repartir(Math.round(inversionTotal * 100), leadsDia.map((v) => v * (0.9 + 0.2 * r())));
  const cacMovil = fechas.map((_, i): number | null => {
    if (centDia === null) return null;
    const start = Math.max(0, i - 6);
    const newCustomers = suma(newPerDay.slice(start, i + 1));
    return newCustomers === 0 ? null : redondear(suma(centDia.slice(start, i + 1)) / 100 / newCustomers);
  });

  return { factor, gran, fechas, leadsDia, registrosDia, newPerDay, embudo, campanas, canales, inversionBob: inversionTotal, cacBob, noCacReason, cacMovil };
}

/** Suma por tramo de la granularidad del periodo (para ejes y mini-series). */
export function byBucket(m: ModeloAdquisicion, valores: readonly number[]): { etiquetas: string[]; valores: number[] } {
  return agrupar(m.fechas, valores, m.gran, 'suma');
}

/**
 * Velas del CAC móvil: cada vela resume un tramo de días. Solo cuentan los días
 * con CAC calculable; un tramo sin ninguno no dibuja vela (no se inventa uno).
 */
export function cacCandles(m: ModeloAdquisicion): Vela[] {
  const tamano = m.gran === 'dia' ? 3 : m.gran === 'semana' ? 7 : 30;
  const velas: Vela[] = [];
  for (let i = 0; i < m.cacMovil.length; i += tamano) {
    const t = m.cacMovil.slice(i, i + tamano).filter((v): v is number => v !== null);
    if (t.length === 0) continue;
    velas.push({ fecha: m.fechas[i]!, apertura: t[0]!, cierre: t[t.length - 1]!, minimo: Math.min(...t), maximo: Math.max(...t) });
  }
  return velas;
}
