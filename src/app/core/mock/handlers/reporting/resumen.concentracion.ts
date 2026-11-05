import { hashTexto, redondear, rng, suma } from './reporting-dataset.util';
import type { BaseResumen } from './resumen.base';

/* Clientes de EJEMPLO con nombres comerciales inventados; ninguno corresponde a una entidad real. */
const CLIENTES = [
  'Clínica Horizonte Salud',
  'Farmacia Andina Plus',
  'Laboratorio Valle Claro',
  'Aseguradora Cumbre Vital',
  'Clínica del Sol Naciente',
  'Policlínico Ceibo',
  'Farmacia Altiplano',
  'Centro Médico Los Pinos',
  'Laboratorio Amanecer',
  'Clínica Mirador',
] as const;

export interface Concentracion {
  readonly clientes: readonly { readonly nombre: string; readonly ingreso: number }[];
  /** Suma de los diez, ya redondeada. */
  readonly top10: number;
  /** Porcentaje del total que concentran los diez, con un decimal. */
  readonly pct: number;
}

/**
 * Los diez mayores clientes: reparto decreciente del ingreso total. La parte que
 * concentran los diez (30–45 %) es de EJEMPLO, pero el importe sale del total
 * real de la composición, así que cambia con el periodo, la moneda y los filtros.
 */
export function computeConcentration(base: BaseResumen): Concentracion | null {
  if (base.total === null) {
    return null;
  }
  const { ctx } = base;
  const parte = 0.3 + rng(hashTexto(`conc:${ctx.periodo}:${ctx.alcance}`))() * 0.15;
  const pesos = CLIENTES.map((_, i) => 1 / (i + 1) ** 0.8);
  const sp = suma(pesos);
  const clientes = CLIENTES.map((nombre, i) => ({
    nombre,
    ingreso: redondear((base.total! * parte * pesos[i]!) / sp),
  }));
  const top10 = redondear(suma(clientes.map((c) => c.ingreso)));
  return { clientes, top10, pct: redondear((top10 / base.total) * 100, 1) };
}
