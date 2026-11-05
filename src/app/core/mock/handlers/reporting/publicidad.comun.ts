import type { ContextoReporte, InfoCalculo, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { CAMPANAS, MOTIVOS_RECHAZO } from './publicidad.catalogo';
import type { Modelo } from './publicidad.modelo';
import { INFO_EJEMPLO, convertir } from './reporting-dataset.util';

/** Aviso obligatorio y visible de la pestaña: el módulo aún no está cerrado. */
export const AVISO_MODULO =
  'Módulo en diseño: se modela como Meta Ads Manager; las métricas y la entrega son de EJEMPLO.';

export const FUENTE_ADS =
  'ads.insights_daily (entrega y gasto) · ads.campaigns · ads.ad_sets · ads.ads · ads.ad_invoices (módulo ads del API, por confirmar)';

export function unidadMoneda(ctx: ContextoReporte): UnidadValor {
  return { tipo: 'moneda', moneda: ctx.moneda };
}

export function aMoneda(ctx: ContextoReporte, bob: number): number {
  return convertir(bob, ctx.moneda);
}

export function aMonedaNull(ctx: ContextoReporte, bob: number | null): number | null {
  return bob === null ? null : convertir(bob, ctx.moneda);
}

/** Información de «cómo se calcula» con las salvedades que valen para toda la pestaña. */
export function info(
  datos: Omit<InfoCalculo, 'salvedades' | 'frescura' | 'fuente'> & {
    readonly fuente?: string;
    readonly salvedades?: readonly string[];
  },
): InfoCalculo {
  return {
    ...datos,
    fuente: datos.fuente ?? FUENTE_ADS,
    frescura: INFO_EJEMPLO.frescura,
    salvedades: [
      'Datos de EJEMPLO.',
      'Módulo de publicidad en diseño: se modela como Meta Ads Manager.',
      ...(datos.salvedades ?? []),
    ],
  };
}

/** Reparte un entero en partes que suman exactamente el total (mayor resto). */
export function repartir(total: number, partes: readonly number[]): number[] {
  const base = partes.map((p) => Math.floor(total * p));
  const restos = partes
    .map((p, i) => ({ i, resto: total * p - base[i]! }))
    .sort((a, b) => b.resto - a.resto);
  let faltan = total - base.reduce((a, b) => a + b, 0);
  for (const { i } of restos) {
    if (faltan <= 0) break;
    base[i] = base[i]! + 1;
    faltan -= 1;
  }
  return base;
}

export interface FilaModeracion {
  readonly motivo: string;
  readonly rechazados: number;
  readonly apelados: number;
  readonly ganadas: number;
  readonly corregidos: number;
}

export interface Moderacion {
  readonly revisados: number;
  readonly filas: readonly FilaModeracion[];
  readonly rechazados: number;
  readonly apelados: number;
  readonly ganadas: number;
  readonly corregidos: number;
}

/**
 * Moderación del periodo. Todo sale de los rechazos por motivo, así que lo que
 * se ve en el gráfico y en la tabla suma lo mismo.
 */
export function calcularModeracion(m: Modelo): Moderacion {
  const revisados = Math.round(m.dias * 3.4 * m.factorGeneral * (m.filas.length / CAMPANAS.length));
  const rechazadosTotal = Math.round(revisados * 0.11);
  const byReason = repartir(rechazadosTotal, MOTIVOS_RECHAZO.map((x) => x.parte));
  const filas = MOTIVOS_RECHAZO.map((x, i) => {
    const rechazados = byReason[i]!;
    const apelados = Math.round(rechazados * 0.6);
    return {
      motivo: x.nombre,
      rechazados,
      apelados,
      ganadas: Math.round(apelados * 0.42),
      corregidos: Math.round((rechazados - apelados) * 0.65),
    };
  });
  const total = (clave: 'rechazados' | 'apelados' | 'ganadas' | 'corregidos'): number =>
    filas.reduce((acc, f) => acc + f[clave], 0);
  return {
    revisados,
    filas,
    rechazados: total('rechazados'),
    apelados: total('apelados'),
    ganadas: total('ganadas'),
    corregidos: total('corregidos'),
  };
}
