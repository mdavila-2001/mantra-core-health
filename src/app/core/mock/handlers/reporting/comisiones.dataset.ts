import type {
  ChartSpec,
  ContextoReporte,
  PestanaReporte,
} from '../../../data-access/reporting/reporting.types';
import { AVISO_TASAS } from './comisiones.info';
import { graficoMapaCalor, graficoPorActor, graficoProductividad, graficoRetenciones } from './comisiones.graficos-actor';
import {
  graficoAging,
  graficoCascada,
  graficoConciliacion,
  graficoDescuadres,
  graficoPayouts,
  graficoSaldoPorPagar,
  graficoTakeRate,
} from './comisiones.graficos-pagos';
import { construirKpis } from './comisiones.kpis';
import { construirModelo } from './comisiones.modelo';
import { tablaPayoutsFallidos, tablaRanking } from './comisiones.tablas';

/* ============================================================================
    Pestaña «Comisiones y actores» — datos de EJEMPLO.

    Unifica en una vista de LECTURA tres mecanismos que hoy viven separados
    (comisión de corredor de seguros, reparto multi-parte de un cobro y
    referidos/puntos) sin tocar sus reglas de cálculo. La contabilidad está en
    `comisiones.modelo.ts`; acá sólo se ensambla.
    ========================================================================== */

const GENERADO_EN = '2026-10-30T09:00:00-04:00';

/** Últimos puntos de una serie, para la mini-línea de la tarjeta. */
function cola(grafico: ChartSpec): readonly (number | null)[] {
  return grafico.datos.tipo === 'cartesiano' ? (grafico.datos.series[0]?.valores.slice(-14) ?? []) : [];
}

export function construirComisiones(ctx: ContextoReporte): PestanaReporte {
  const m = construirModelo(ctx);

  const cascada = graficoCascada(ctx, m);
  const takeRate = graficoTakeRate(ctx, m);
  const porActor = graficoPorActor(ctx, m);
  const productividad = graficoProductividad(ctx, m);
  const retenciones = graficoRetenciones(ctx, m);
  const mapaCalor = graficoMapaCalor(ctx, m);
  const payouts = graficoPayouts(ctx, m);
  const aging = graficoAging(ctx, m);
  const saldo = graficoSaldoPorPagar(ctx, m);
  const conciliacion = graficoConciliacion(ctx, m);
  const descuadres = graficoDescuadres(ctx, m);

  const ranking = tablaRanking(ctx, m);
  const fallidos = tablaPayoutsFallidos(ctx, m);

  return {
    pestana: 'comisiones',
    generadoEn: GENERADO_EN,
    origen: 'ejemplo',
    kpis: construirKpis(ctx, m, { takeRate: cola(takeRate), saldo: cola(saldo) }),
    graficos: [cascada, takeRate, porActor, productividad, retenciones, mapaCalor, payouts, aging, saldo, conciliacion, descuadres],
    tablas: [ranking, fallidos],
    avisos: [
      AVISO_TASAS,
      'Visitador médico: esquema de comisión sin definir (decisión de negocio pendiente). Sus importes salen como «Sin dato» y no entran en los totales.',
      'La Plataforma retiene su parte al cobrar: se muestra, pero no suma a las comisiones por pagar.',
      'Unifica tres mecanismos que hoy están separados (corredor de seguros, reparto de cobros, referidos) sin cambiar sus reglas. Datos de EJEMPLO.',
    ],
    secciones: [
      {
        titulo: 'Resultado de la plataforma',
        descripcion: 'Cuánto de lo que se mueve se queda como ingreso neto, y cómo evoluciona.',
        graficos: [cascada.id, takeRate.id],
      },
      {
        titulo: 'Por actor',
        descripcion: 'Qué devenga, cobra y rinde cada actor.',
        graficos: [porActor.id, productividad.id, retenciones.id, mapaCalor.id],
        tablas: [ranking.id],
      },
      {
        titulo: 'Pagos y antigüedad',
        descripcion: 'Estado de los payouts, cuánto se debe y desde cuándo.',
        graficos: [payouts.id, aging.id, saldo.id],
        tablas: [fallidos.id],
      },
      {
        titulo: 'Conciliación',
        descripcion: 'Si lo cobrado cuadra con lo que informa el gateway.',
        graficos: [conciliacion.id, descuadres.id],
      },
    ],
  };
}
