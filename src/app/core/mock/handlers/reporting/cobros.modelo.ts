import type { ContextoReporte } from '../../../data-access/reporting/reporting.types';
import {
  agrupar,
  factorContexto,
  fechasDelPeriodo,
  granularidad,
  redondear,
  rng,
  serie,
  suma,
} from './reporting-dataset.util';

/* ============================================================================
    Modelo de datos de EJEMPLO de la pestaña «Cobros y caja».

    Un solo modelo alimenta KPI, gráficos y tablas: así el embudo, la tasa de
    éxito y el rezago cuentan la misma historia. Todo está inventado, es
    determinista y trabaja en BOB (la moneda se convierte al final).

    Cómo reacciona al contexto:
      · El alcance y los filtros escalan los volúmenes (`factorContexto`).
      · Un filtro por método de pago NO escala: recorta el cálculo a ese método,
        y por eso los porcentajes del resumen pasan a ser los de ese método.
    ========================================================================== */

export const METODOS = ['Tarjeta', 'QR', 'Transferencia', 'Efectivo en caja'] as const;
export type Metodo = (typeof METODOS)[number];

export const TRAMOS_REZAGO = ['0 días', '1 día', '2 días', '3 a 5 días', '6 días o más'] as const;
/** Día que representa a cada tramo al calcular el promedio (6 o más cuenta como 7). */
export const DIA_DEL_TRAMO = [0, 1, 2, 4, 7] as const;
/** Antigüedad mínima de un cobro para que su tramo ya pueda estar liquidado. */
const ANTIGUEDAD_MINIMA = [0, 1, 2, 5, 7] as const;

export const MOTIVOS_RECHAZO = [
  'Fondos insuficientes',
  'Rechazo del banco emisor',
  'Verificación 3-D Secure sin completar',
  'Tiempo de espera agotado',
  'Otros motivos',
] as const;

export const ESTADOS_SIAT = ['Emitida', 'Pendiente de emisión', 'Observada por el SIAT', 'Anulada'] as const;
/** La emisión SIAT de la maqueta está conectada desde el 01/07/2026: 122 días hasta el ancla. */
export const DIAS_CON_SIAT = 122;

export const CAUSAS_DESCUADRE = [
  'Monto distinto',
  'Sin registro en el proveedor',
  'Sin registro propio',
  'Duplicado',
] as const;
export const TRAMOS_ANTIGUEDAD = ['0 a 2 días', '3 a 7 días', '8 a 15 días', '16 a 30 días', 'Más de 30 días'] as const;
const BASE_DESCUADRES: readonly (readonly number[])[] = [
  [18, 12, 8, 5, 3],
  [12, 9, 6, 3, 2],
  [9, 6, 5, 3, 1],
  [6, 3, 2, 1, 1],
];

interface ParamMetodo {
  readonly semilla: number;
  readonly mezcla: number;
  /** Cuánto cambia la mezcla entre el primer y el último día del periodo. */
  readonly deriva: number;
  readonly autorizacion: number;
  readonly captura: number;
  readonly ticketBob: number;
  readonly comisionPct: number;
  readonly reembolsoPct: number;
  readonly disputaPct: number;
  readonly rezago: readonly number[];
  readonly fraccionPendienteSiat: number;
  readonly motivos: readonly number[];
}

export const PARAM: Readonly<Record<Metodo, ParamMetodo>> = {
  Tarjeta: {
    semilla: 5101, mezcla: 0.42, deriva: -0.05, autorizacion: 0.862, captura: 0.985, ticketBob: 240,
    comisionPct: 3.2, reembolsoPct: 2.4, disputaPct: 0.7, rezago: [0.02, 0.18, 0.52, 0.22, 0.06],
    fraccionPendienteSiat: 0.04, motivos: [0.3, 0.32, 0.24, 0.06, 0.08],
  },
  QR: {
    semilla: 5102, mezcla: 0.33, deriva: 0.05, autorizacion: 0.953, captura: 0.992, ticketBob: 150,
    comisionPct: 1.1, reembolsoPct: 1.5, disputaPct: 0.1, rezago: [0.1, 0.62, 0.2, 0.07, 0.01],
    fraccionPendienteSiat: 0.035, motivos: [0.28, 0.05, 0.02, 0.5, 0.15],
  },
  Transferencia: {
    semilla: 5103, mezcla: 0.15, deriva: 0, autorizacion: 0.931, captura: 0.996, ticketBob: 320,
    comisionPct: 0.6, reembolsoPct: 1.8, disputaPct: 0.15, rezago: [0.55, 0.35, 0.07, 0.025, 0.005],
    fraccionPendienteSiat: 0.05, motivos: [0.22, 0.1, 0.02, 0.4, 0.26],
  },
  'Efectivo en caja': {
    semilla: 5104, mezcla: 0.1, deriva: 0, autorizacion: 0.996, captura: 1, ticketBob: 180,
    comisionPct: 0, reembolsoPct: 0.9, disputaPct: 0.05, rezago: [0.8, 0.17, 0.02, 0.008, 0.002],
    fraccionPendienteSiat: 0.09, motivos: [0.05, 0.05, 0.02, 0.3, 0.58],
  },
};

export interface SerieMetodo {
  readonly intentos: number[];
  readonly autorizados: number[];
  readonly capturados: number[];
  readonly liquidados: number[];
  readonly volumen: number[];
  readonly reembolsos: number[];
  readonly disputas: number[];
  readonly comisiones: number[];
  /** Cobros liquidados por tramo de rezago, en todo el periodo. */
  readonly tramos: number[];
}

export type CamposDia = Omit<SerieMetodo, 'tramos'>;

export interface SiatMetodo {
  readonly metodo: Metodo;
  /** Cantidad de comprobantes por `ESTADOS_SIAT`; `null` si el método quedó fuera del filtro. */
  readonly porEstado: readonly number[] | null;
}

export interface ModeloCobros {
  readonly ctx: ContextoReporte;
  readonly fechas: string[];
  readonly gran: 'dia' | 'semana' | 'mes';
  readonly seleccion: Metodo | null;
  readonly factor: number;
  readonly activos: readonly Metodo[];
  /** Todos los métodos, sin recortar por el filtro: el gráfico de comparación los necesita. */
  readonly porMetodo: Readonly<Record<Metodo, SerieMetodo>>;
  /** Suma diaria de los métodos activos. */
  readonly dia: CamposDia;
  readonly tramos: number[];
  readonly total: Readonly<Record<keyof CamposDia, number>>;
  readonly rechazos: number[];
  /** `null` si la emisión SIAT no cubre todo el periodo elegido. */
  readonly siat: readonly SiatMetodo[] | null;
  readonly descuadres: number[][];
}

function sumarSeries(lista: readonly number[][], n: number): number[] {
  return Array.from({ length: n }, (_, i) => lista.reduce((a, s) => a + s[i]!, 0));
}

function construirMetodo(m: Metodo, n: number, base: readonly number[], factor: number): SerieMetodo {
  const p = PARAM[m];
  const r = rng(p.semilla);
  const s: SerieMetodo = {
    intentos: [], autorizados: [], capturados: [], liquidados: [], volumen: [],
    reembolsos: [], disputas: [], comisiones: [], tramos: [0, 0, 0, 0, 0],
  };
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 1;
    const antiguedad = n - 1 - i;
    const intentos = Math.round(base[i]! * factor * (p.mezcla + p.deriva * t));
    const tasaAut = Math.min(0.999, Math.max(0.5, p.autorizacion + 0.012 * t + (r() - 0.5) * 0.03));
    const autorizados = Math.round(intentos * tasaAut);
    const capturados = Math.round(autorizados * p.captura);
    const ticket = p.ticketBob * (1 + (r() - 0.5) * 0.06 + 0.05 * t);
    const volumen = capturados * ticket;
    let liquidados = 0;
    p.rezago.forEach((parte, k) => {
      const cuenta = antiguedad >= ANTIGUEDAD_MINIMA[k]! ? Math.floor(capturados * parte) : 0;
      s.tramos[k]! += cuenta;
      liquidados += cuenta;
    });
    s.intentos.push(intentos);
    s.autorizados.push(autorizados);
    s.capturados.push(capturados);
    s.liquidados.push(liquidados);
    s.volumen.push(volumen);
    s.reembolsos.push((volumen * p.reembolsoPct * (1 + (r() - 0.5) * 0.5)) / 100);
    s.disputas.push((volumen * p.disputaPct * (1 + (r() - 0.5) * 0.6)) / 100);
    s.comisiones.push((volumen * p.comisionPct * (1 + (r() - 0.5) * 0.08)) / 100);
  }
  return s;
}

function repartoSiat(m: Metodo, capturados: number): number[] {
  const pendiente = Math.round(capturados * PARAM[m].fraccionPendienteSiat);
  const observada = Math.round(capturados * 0.025);
  const anulada = Math.round(capturados * 0.015);
  return [Math.max(0, capturados - pendiente - observada - anulada), pendiente, observada, anulada];
}

export function construirModelo(ctx: ContextoReporte): ModeloCobros {
  const fechas = fechasDelPeriodo(ctx.periodo);
  const n = fechas.length;
  const filtroMetodo = ctx.filtros.find((f) => f.dimension === 'metodo-pago');
  const seleccion = METODOS.find((m) => m === filtroMetodo?.valor) ?? null;
  // Un filtro de método válido recorta; no escala. Uno desconocido sí escala (como cualquier otro).
  const factor =
    seleccion === null
      ? factorContexto(ctx)
      : factorContexto({ ...ctx, filtros: ctx.filtros.filter((f) => f.dimension !== 'metodo-pago') });
  const base = serie(7001, n, 260, 18, 5);
  const porMetodo = Object.fromEntries(METODOS.map((m) => [m, construirMetodo(m, n, base, factor)])) as Record<Metodo, SerieMetodo>;
  const activos: readonly Metodo[] = seleccion === null ? METODOS : [seleccion];

  const campo = (k: keyof CamposDia) => sumarSeries(activos.map((m) => porMetodo[m][k]), n);
  const dia: CamposDia = {
    intentos: campo('intentos'), autorizados: campo('autorizados'), capturados: campo('capturados'),
    liquidados: campo('liquidados'), volumen: campo('volumen'), reembolsos: campo('reembolsos'),
    disputas: campo('disputas'), comisiones: campo('comisiones'),
  };
  const total = Object.fromEntries((Object.keys(dia) as (keyof CamposDia)[]).map((k) => [k, suma(dia[k])])) as Record<keyof CamposDia, number>;
  const tramos = TRAMOS_REZAGO.map((_, k) => activos.reduce((a, m) => a + porMetodo[m].tramos[k]!, 0));

  // Rechazados = intentos que no llegaron a autorizarse; «Otros motivos» absorbe el redondeo.
  const rechazos: number[] = MOTIVOS_RECHAZO.map(() => 0);
  for (const m of activos) {
    const rechazados = suma(porMetodo[m].intentos) - suma(porMetodo[m].autorizados);
    const partes = PARAM[m].motivos.slice(0, 4).map((p) => Math.round(rechazados * p));
    partes.forEach((v, k) => (rechazos[k]! += v));
    rechazos[4]! += Math.max(0, rechazados - suma(partes));
  }

  const siat: readonly SiatMetodo[] | null =
    n > DIAS_CON_SIAT
      ? null
      : METODOS.map((m) => ({
          metodo: m,
          porEstado: activos.includes(m) ? repartoSiat(m, suma(porMetodo[m].capturados)) : null,
        }));

  // Foto de hoy: no depende del periodo, sí del alcance y de los filtros.
  const fDescuadres = factorContexto(ctx);
  const descuadres = BASE_DESCUADRES.map((fila) => fila.map((v) => Math.round(v * fDescuadres)));

  return { ctx, fechas, gran: granularidad(ctx.periodo), seleccion, factor, activos, porMetodo, dia, tramos, total, rechazos, siat, descuadres };
}

/** Razón por cubo (suma de numeradores ÷ suma de denominadores), en %; `null` si no hay denominador. */
export function razonPorCubo(
  fechas: readonly string[],
  num: readonly number[],
  den: readonly number[],
  gran: 'dia' | 'semana' | 'mes',
): { etiquetas: string[]; valores: (number | null)[] } {
  const a = agrupar(fechas, num, gran, 'suma');
  const b = agrupar(fechas, den, gran, 'suma');
  return {
    etiquetas: a.etiquetas,
    valores: a.valores.map((v, i) => (b.valores[i]! > 0 ? redondear((v / b.valores[i]!) * 100, 2) : null)),
  };
}

/** Razón diaria en %; un día sin denominador toma `respaldo` para que las velas no tengan huecos. */
export function razonDiaria(num: readonly number[], den: readonly number[], respaldo: number): number[] {
  return num.map((v, i) => (den[i]! > 0 ? (v / den[i]!) * 100 : respaldo));
}

export function tasaEnPct(num: number, den: number): number | null {
  return den > 0 ? redondear((num / den) * 100, 2) : null;
}

/** Promedio de días de rezago ponderado por cobros liquidados; `null` si no se liquidó nada. */
export function rezagoPromedio(tramos: readonly number[]): number | null {
  const total = suma(tramos);
  return total > 0 ? redondear(tramos.reduce((a, v, k) => a + v * DIA_DEL_TRAMO[k]!, 0) / total, 2) : null;
}
