import type { ContextoReporte, KpiSpec, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { FUENTE_COMISIONES, FUENTE_CONCILIACION, FUENTE_FEES, FUENTE_PAYOUTS, info } from './comisiones.info';
import type { ModeloComisiones } from './comisiones.modelo';
import { aMonto, NO_SCHEME_REASON, porcentaje } from './comisiones.modelo';
import { hashTexto, kpi, variacionContexto } from './reporting-dataset.util';

/** Variación contra el periodo de comparación; sin valor no hay variación (no se inventa). */
function variacion(ctx: ContextoReporte, id: string, valor: number | null): number | null {
  return valor === null ? null : variacionContexto(ctx, valor, hashTexto(`comisiones:kpi:${id}`));
}

export function construirKpis(ctx: ContextoReporte, m: ModeloComisiones, tendencia: {
  readonly takeRate: readonly (number | null)[];
  readonly saldo: readonly (number | null)[];
}): KpiSpec[] {
  const a = m.alcance;
  const dinero: UnidadValor = { tipo: 'moneda', moneda: ctx.moneda };
  const pct: UnidadValor = { tipo: 'porcentaje' };
  const countUnit: UnidadValor = { tipo: 'numero' };
  const actorReason = a.comisionesC === null || a.devengadaC === null ? NO_SCHEME_REASON : undefined;

  const importe = (id: string, titulo: string, centimos: number | null, extra: Partial<KpiSpec>, def: Parameters<typeof info>[0]): KpiSpec => {
    const valor = aMonto(centimos);
    return kpi({
      id,
      titulo,
      valor,
      unidad: dinero,
      variacionPct: variacion(ctx, id, valor),
      ...(valor === null ? { motivoSinDato: NO_SCHEME_REASON } : {}),
      info: info(def),
      ...extra,
    });
  };

  const take = porcentaje(a.ingresoNetoC, a.volumenC);
  const pagos = a.payouts === null ? null : a.payouts.emitidos + a.payouts.enProceso + a.payouts.fallidos;
  const fallidosPct = a.payouts === null || pagos === null ? null : porcentaje(a.payouts.fallidos, pagos);
  const conciliado = porcentaje(a.volumenC - a.descuadreC, a.volumenC);

  return [
    importe('ingreso-periodo', 'Ingreso neto de la plataforma', a.ingresoNetoC, {}, {
      definicion: 'Lo que le queda a la plataforma por comisiones y fees en el periodo, después del gateway y de las comisiones a actores.',
      formula: 'fees brutos − costo del gateway − comisiones a actores',
      fuente: `${FUENTE_FEES}, ${FUENTE_COMISIONES}`,
      salvedades: ['Sin el Visitador médico es un techo: su comisión futura lo reducirá.'],
    }),
    importe('comision-devengada', 'Comisión devengada', a.devengadaC, {}, {
      definicion: 'Comisión que ganaron los actores en el periodo, se haya pagado o no.',
      formula: 'liquidada + pendiente, sumada por actor',
      fuente: FUENTE_COMISIONES,
    }),
    importe('comision-liquidada', 'Comisión liquidada', a.liquidadaC, {}, {
      definicion: 'Parte de lo devengado que ya se pagó a los actores.',
      formula: 'suma de payout_items liquidados',
      fuente: FUENTE_PAYOUTS,
    }),
    importe('comision-pendiente', 'Comisión pendiente de pago', a.pendienteC, { subirEsMalo: true, tendencia: tendencia.saldo }, {
      definicion: 'Parte de lo devengado que todavía no se paga. Incluye lo retenido por disputas.',
      formula: 'devengada − liquidada',
      fuente: FUENTE_PAYOUTS,
    }),
    kpi({
      id: 'take-rate',
      titulo: 'Take rate',
      valor: take,
      unidad: pct,
      variacionPct: variacion(ctx, 'take-rate', take),
      numerador: aMonto(a.ingresoNetoC),
      denominador: aMonto(a.volumenC),
      ...(take === null ? { motivoSinDato: actorReason ?? 'Sin volumen transaccionado en el periodo' } : {}),
      tendencia: tendencia.takeRate,
      info: info({
        definicion: 'Qué parte del dinero que mueve la plataforma se queda como ingreso neto.',
        formula: 'ingreso neto ÷ volumen transaccionado × 100',
        numerador: 'Ingreso neto de la plataforma',
        denominador: 'Volumen transaccionado',
        fuente: FUENTE_FEES,
      }),
    }),
    kpi({
      id: 'payouts-fallidos-pct',
      titulo: 'Payouts fallidos',
      valor: fallidosPct,
      unidad: pct,
      subirEsMalo: true,
      variacionPct: variacion(ctx, 'payouts-fallidos-pct', fallidosPct),
      numerador: a.payouts?.fallidos ?? null,
      denominador: pagos,
      ...(fallidosPct === null
        ? { motivoSinDato: a.payouts === null ? 'Este actor no recibe payouts o no tiene esquema de comisión definido' : 'Sin payouts en el periodo' }
        : {}),
      info: info({
        definicion: 'Qué parte de los pagos a actores falló y hay que reintentar o corregir.',
        formula: 'payouts fallidos ÷ payouts totales × 100',
        numerador: 'Payouts fallidos',
        denominador: 'Payouts emitidos + en proceso + fallidos',
        fuente: FUENTE_PAYOUTS,
      }),
    }),
    importe('comision-retenida', 'Comisión retenida por disputas', a.retenidoC, { subirEsMalo: true }, {
      definicion: 'Comisión pendiente que no se paga porque hay una disputa abierta.',
      formula: 'parte de la comisión pendiente con disputa o contracargo abierto',
      fuente: 'payments.payment_disputes, payments.refunds',
      salvedades: ['Ya está dentro de la comisión pendiente: no se suma a ella.'],
    }),
    kpi({
      id: 'conciliado-pct',
      titulo: 'Volumen conciliado',
      valor: conciliado,
      unidad: pct,
      variacionPct: variacion(ctx, 'conciliado-pct', conciliado),
      numerador: aMonto(a.volumenC - a.descuadreC),
      denominador: aMonto(a.volumenC),
      ...(conciliado === null ? { motivoSinDato: 'Sin volumen transaccionado en el periodo' } : {}),
      info: info({
        definicion: 'Qué parte del dinero cobrado coincide entre el gateway y el libro.',
        formula: '(volumen − descuadres) ÷ volumen × 100',
        numerador: 'Volumen conciliado',
        denominador: 'Volumen transaccionado',
        fuente: FUENTE_CONCILIACION,
        esComision: false,
      }),
    }),
    kpi({
      id: 'descuadres-abiertos',
      titulo: 'Descuadres abiertos',
      valor: a.descuadres,
      unidad: countUnit,
      subirEsMalo: true,
      variacionPct: variacion(ctx, 'descuadres-abiertos', a.descuadres),
      info: info({
        definicion: 'Excepciones de conciliación con el gateway que nadie resolvió todavía.',
        formula: 'conteo de reconciliation_exceptions abiertas',
        fuente: FUENTE_CONCILIACION,
        esComision: false,
      }),
    }),
  ];
}
