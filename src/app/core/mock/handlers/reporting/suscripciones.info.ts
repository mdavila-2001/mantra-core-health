import type { ContextoReporte, InfoCalculo, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { convertir, INFO_EJEMPLO, redondear } from './reporting-dataset.util';

/** Ayudas comunes de la pestaña: moneda, ficha «cómo se calcula» y la salvedad que nunca falta. */

export const SALVEDAD_EJEMPLO =
  'Datos de EJEMPLO: no provienen de ninguna cuenta real; los planes, precios y consultorios son inventados.';

export function unidadMoneda(ctx: ContextoReporte): UnidadValor {
  return { tipo: 'moneda', moneda: ctx.moneda };
}

/** BOB → moneda del contexto, con 2 decimales. Un `null` no pasa por aquí: se queda `null` en quien lo llama. */
export function aMoneda(ctx: ContextoReporte): (valorBob: number) => number {
  return (v) => redondear(convertir(v, ctx.moneda));
}

export function info(p: {
  readonly definicion: string;
  readonly formula: string;
  readonly numerador?: string;
  readonly denominador?: string;
  readonly fuente: string;
  readonly salvedades?: readonly string[];
}): InfoCalculo {
  return {
    definicion: p.definicion,
    formula: p.formula,
    numerador: p.numerador,
    denominador: p.denominador,
    fuente: p.fuente,
    frescura: INFO_EJEMPLO.frescura,
    salvedades: [SALVEDAD_EJEMPLO, ...(p.salvedades ?? [])],
  };
}
