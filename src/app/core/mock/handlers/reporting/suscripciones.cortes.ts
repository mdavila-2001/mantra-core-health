import type { ContextoReporte, DimensionFiltro, FiltroActivo } from '../../../data-access/reporting/reporting.types';
import { rng, suma } from './reporting-dataset.util';
import { PLANES } from './suscripciones.modelo';

/* Cortes de EJEMPLO: especialidades, ciudades y una lista de cuentas inventadas.
   Ningún nombre es de una persona real: son «Consultorio Ejemplo NN». */

export interface Corte {
  readonly nombre: string;
  readonly peso: number;
}

export const ESPECIALIDADES: readonly Corte[] = [
  { nombre: 'Medicina general', peso: 24 },
  { nombre: 'Pediatría', peso: 14 },
  { nombre: 'Psicología', peso: 14 },
  { nombre: 'Ginecología', peso: 12 },
  { nombre: 'Odontología', peso: 10 },
  { nombre: 'Cardiología', peso: 9 },
  { nombre: 'Dermatología', peso: 9 },
  { nombre: 'Traumatología', peso: 8 },
];

export const CIUDADES: readonly Corte[] = [
  { nombre: 'Santa Cruz', peso: 34 },
  { nombre: 'La Paz', peso: 28 },
  { nombre: 'Cochabamba', peso: 20 },
  { nombre: 'Sucre', peso: 7 },
  { nombre: 'Tarija', peso: 6 },
  { nombre: 'Oruro', peso: 5 },
];

/** Reparte `total` en enteros proporcionales a `pesos` que suman EXACTO `total` (mayor resto). */
export function distribuirEnteros(total: number, pesos: readonly number[]): number[] {
  const s = suma(pesos);
  const crudo = pesos.map((p) => (total * p) / s);
  const base = crudo.map((c) => Math.floor(c));
  const orden = crudo
    .map((c, i) => ({ i, frac: c - Math.floor(c) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const resto = total - suma(base);
  for (let k = 0; k < resto; k++) {
    base[orden[k]!.i]! += 1;
  }
  return base;
}

/** El contexto sin los filtros de una dimensión: un gráfico por corte se compara con sus hermanos y solo se resalta. */
export function withoutDimension(ctx: ContextoReporte, dimension: DimensionFiltro): ContextoReporte {
  return { ...ctx, filtros: ctx.filtros.filter((f) => f.dimension !== dimension) };
}

export interface Account {
  readonly nombre: string;
  readonly plan: number;
  readonly especialidad: string;
  readonly ciudad: string;
  readonly organizacion: string;
  /** Consumo de la cuota del mes, en %; puede pasar de 100. */
  readonly usoPct: number;
}

export const OWN_ORGANIZATION = 'Organización Ejemplo 1';

function elegir(cortes: readonly Corte[], u: number): string {
  const total = suma(cortes.map((c) => c.peso));
  let acumulado = 0;
  for (const c of cortes) {
    acumulado += c.peso;
    if (u * total < acumulado) return c.nombre;
  }
  return cortes[cortes.length - 1]!.nombre;
}

/** 60 cuentas de EJEMPLO, siempre las mismas: la semilla no depende del contexto. */
export const CUENTAS: readonly Account[] = (() => {
  const r = rng(20261030);
  return Array.from({ length: 60 }, (_, i) => {
    const u = r();
    const plan = u < 0.48 ? 0 : u < 0.88 ? 1 : 2;
    return {
      nombre: `Consultorio Ejemplo ${i + 1}`,
      plan,
      especialidad: elegir(ESPECIALIDADES, r()),
      ciudad: elegir(CIUDADES, r()),
      organizacion: `Organización Ejemplo ${(i % 5) + 1}`,
      usoPct: Math.round(25 + r() * 105),
    };
  });
})();

function coincide(c: Account, f: FiltroActivo): boolean {
  switch (f.dimension) {
    case 'plan':
      return PLANES[c.plan]!.nombre === f.valor;
    case 'especialidad':
      return c.especialidad === f.valor;
    case 'ciudad':
      return c.ciudad === f.valor;
    case 'organizacion':
      return c.organizacion === f.valor;
    default:
      return true;
  }
}

/** Cuentas que quedan con el alcance y los filtros activos (un admin de organización solo ve las suyas). */
export function contextAccounts(ctx: ContextoReporte): Account[] {
  return CUENTAS.filter(
    (c) => (ctx.alcance === 'plataforma' || c.organizacion === OWN_ORGANIZATION) && ctx.filtros.every((f) => coincide(c, f)),
  );
}
