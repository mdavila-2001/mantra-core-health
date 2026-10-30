import type { ContextoReporte } from '../../../data-access/reporting/reporting.types';
import { daysInPeriod, dateLabel, factorContexto, redondear, rng, suma } from './reporting-dataset.util';
import type { ModeloAdquisicion } from './adquisicion.modelo';

/* ============================================================================
    Promociones, referidos y salud de cuentas — datos de EJEMPLO.
    Mismo criterio que el modelo del embudo: todo entero, determinista y con
    `null` donde la muestra no alcanza (nunca un cero que no se midió).
    ========================================================================== */

/** Cuentas por celda del mapa de salud por debajo de las cuales no se publica la celda. */
export const MIN_MUESTRA_CELDA = 5;

/** Precio de lista mensual de EJEMPLO por cuenta pagante, en BOB. */
const PRECIO_MENSUAL_BOB = 290;
/** Cuentas pagantes de EJEMPLO que dan la base de ingreso contra la que se mide el costo de promociones. */
const BASE_CUENTAS = 2150;

export const ESTADOS_PROMOCION = ['Activa', 'Pausada', 'Agotada', 'Finalizada'] as const;

interface DefPromocion {
  readonly nombre: string;
  readonly estado: (typeof ESTADOS_PROMOCION)[number];
  readonly canjesDia: number;
  /** Descuento medio por canje, en BOB. */
  readonly descuentoBob: number;
}

// Promociones inventadas; no son las de ninguna organización real.
const PROMOCIONES: readonly DefPromocion[] = [
  { nombre: 'Bienvenida · primer mes', estado: 'Activa', canjesDia: 5.2, descuentoBob: 58 },
  { nombre: 'Invita a un colega', estado: 'Activa', canjesDia: 2.1, descuentoBob: 80 },
  { nombre: 'Plan anual con descuento', estado: 'Activa', canjesDia: 0.9, descuentoBob: 310 },
  { nombre: 'Reactivación a 90 días', estado: 'Pausada', canjesDia: 1.2, descuentoBob: 45 },
  { nombre: 'Alianza colegio médico', estado: 'Agotada', canjesDia: 0.6, descuentoBob: 120 },
  { nombre: 'Lanzamiento de verano', estado: 'Finalizada', canjesDia: 0.35, descuentoBob: 70 },
];

export interface FilaPromocion {
  readonly nombre: string;
  readonly estado: string;
  readonly canjes: number;
  readonly descuentoBob: number;
}

export interface ModeloPromociones {
  readonly promociones: readonly FilaPromocion[];
  /** Ingreso de la base de pagantes en el periodo, en BOB: denominador del costo de promociones. */
  readonly ingresoBob: number;
  readonly canjesTotal: number;
  readonly descuentoTotalBob: number;
}

export function calcularPromociones(ctx: ContextoReporte): ModeloPromociones {
  const n = daysInPeriod(ctx.periodo);
  const f = factorContexto(ctx);
  const r = rng(7301);
  const promociones = PROMOCIONES.map((p) => {
    const canjes = Math.round(p.canjesDia * n * f * (0.9 + 0.2 * r()));
    return { nombre: p.nombre, estado: p.estado, canjes, descuentoBob: redondear(canjes * p.descuentoBob) };
  });
  return {
    promociones,
    ingresoBob: redondear(BASE_CUENTAS * PRECIO_MENSUAL_BOB * (n / 30) * f),
    canjesTotal: suma(promociones.map((p) => p.canjes)),
    descuentoTotalBob: redondear(suma(promociones.map((p) => p.descuentoBob))),
  };
}

export interface ModeloReferidos {
  readonly invitaciones: number;
  readonly registros: number;
  readonly activaciones: number;
  readonly recompensas: number;
}

/** Referidos sale de la misma campaña «Invita a un colega» del embudo: una sola verdad. */
export function calcularReferidos(m: ModeloAdquisicion): ModeloReferidos {
  const c = m.campanas.find((x) => x.def.id === 'referidos')!;
  return {
    // 31 % de las invitaciones terminan en registro (supuesto de EJEMPLO).
    invitaciones: Math.ceil(c.registros / 0.31),
    registros: c.registros,
    activaciones: c.activas,
    // La recompensa se paga cuando la cuenta cumple 30 días: ~80 % de las activas ya la cobraron.
    recompensas: Math.round(c.activas * 0.8),
  };
}

/* ---- salud de cuenta ------------------------------------------------------------ */

export const PLANES = ['Inicial', 'Profesional', 'Premium', 'Clínica'] as const;
export const NIVELES_RIESGO = ['Bajo', 'Medio', 'Alto', 'Crítico'] as const;

const CUENTAS_ACTIVAS_BASE = 1840;
const PESO_PLAN = [0.38, 0.34, 0.18, 0.1];
// Reparto por nivel de riesgo según el plan (cada fila suma 1).
const RIESGO_POR_PLAN: readonly (readonly number[])[] = [
  [0.56, 0.24, 0.13, 0.07],
  [0.64, 0.22, 0.1, 0.04],
  [0.72, 0.18, 0.08, 0.02],
  [0.76, 0.16, 0.06, 0.02],
];

export interface ModeloSalud {
  /** Cuentas reales por plan×nivel, antes de ocultar las celdas chicas. */
  readonly cuentas: readonly (readonly number[])[];
  readonly total: number;
  readonly enRiesgo: number;
  /** `[nivel, plan, valor]` con `null` donde la celda no llega al mínimo. */
  readonly celdas: readonly (readonly [number, number, number | null])[];
}

export function calcularSalud(ctx: ContextoReporte): ModeloSalud {
  const f = factorContexto(ctx);
  const r = rng(7401);
  const cuentas = PLANES.map((_, p) =>
    NIVELES_RIESGO.map((__, nivel) =>
      Math.round(CUENTAS_ACTIVAS_BASE * f * PESO_PLAN[p]! * RIESGO_POR_PLAN[p]![nivel]! * (0.94 + 0.12 * r())),
    ),
  );
  const celdas = cuentas.flatMap((fila, p) =>
    fila.map((v, nivel): readonly [number, number, number | null] => [nivel, p, v < MIN_MUESTRA_CELDA ? null : v]),
  );
  return {
    cuentas,
    total: suma(cuentas.map(suma)),
    enRiesgo: suma(cuentas.map((fila) => fila[2]! + fila[3]!)),
    celdas,
  };
}

/* ---- cohortes de activación por semana ---------------------------------------------- */

export const SEMANAS_COHORTE = 6;
export const COHORTES = 8;

export interface ModeloCohortes {
  readonly filas: readonly string[];
  readonly columnas: readonly string[];
  readonly celdas: readonly (readonly [number, number, number | null])[];
}

/**
 * Porcentaje acumulado de cuentas activadas, por semana de registro y semanas
 * transcurridas. Las semanas que todavía no ocurrieron son `null`, no 0.
 */
export function calcularCohortes(ctx: ContextoReporte): ModeloCohortes {
  const f = factorContexto(ctx);
  const r = rng(7501);
  const celdas: [number, number, number | null][] = [];
  const filas: string[] = [];
  for (let c = 0; c < COHORTES; c++) {
    const semanasAtras = COHORTES - 1 - c;
    filas.push(`Semana del ${dateLabel(semanasAtras * 7 + 6)}`);
    const tamano = Math.round(210 * f * (0.92 + 0.16 * r()));
    const observadas = Math.min(SEMANAS_COHORTE, semanasAtras + 1);
    let previo = 0;
    for (let k = 0; k < SEMANAS_COHORTE; k++) {
      if (k >= observadas || tamano < MIN_MUESTRA_CELDA * 4) {
        celdas.push([k, c, null]);
        continue;
      }
      const curva = 62 * (1 - Math.exp(-(k + 1) / 2.2));
      const valor = Math.max(previo, redondear(curva * (0.96 + 0.08 * r()), 1));
      previo = valor;
      celdas.push([k, c, valor]);
    }
  }
  return { filas, columnas: Array.from({ length: SEMANAS_COHORTE }, (_, k) => `Semana ${k}`), celdas };
}
