import type { InfoCalculo, UnidadValor } from '../../../data-access/reporting/reporting.types';
import type { ModeloCobros } from './cobros.modelo';
import { convertir, INFO_EJEMPLO, redondear } from './reporting-dataset.util';

/* Piezas que comparten los gráficos, los KPI y las tablas de «Cobros y caja». */

export const AVISO_EJEMPLO =
  'Datos de EJEMPLO: cifras inventadas para la maqueta; no provienen de ningún cobro real.';

export function info(
  p: Omit<InfoCalculo, 'frescura' | 'salvedades'> & { readonly salvedades?: readonly string[] },
): InfoCalculo {
  return { ...p, frescura: INFO_EJEMPLO.frescura, salvedades: [...(p.salvedades ?? []), AVISO_EJEMPLO] };
}

export function unidadMoneda(m: ModeloCobros): UnidadValor {
  return { tipo: 'moneda', moneda: m.ctx.moneda };
}

/** Pasa un importe en BOB a la moneda elegida, con centavos. */
export function enMoneda(m: ModeloCobros, valorBob: number): number {
  return redondear(convertir(valorBob, m.ctx.moneda), 2);
}

export function nombreGranularidad(m: ModeloCobros): string {
  return m.gran === 'dia' ? 'día' : m.gran === 'semana' ? 'semana' : 'mes';
}

export const SIN_VELAS_FLUJO =
  'Es un flujo que se suma día a día, no un saldo ni una razón: una vela (apertura, máximo, mínimo y cierre) no tendría sentido.';
export const SIN_VELAS_FOTO =
  'Es una foto de un tramo de tiempo, no una serie que cambia día a día: no hay apertura ni cierre que mostrar.';
export const SIN_FILTRO_ETAPAS =
  'Sus partes son etapas de un mismo recorrido; filtrar por una sola dejaría el resto del tablero sin sentido.';
