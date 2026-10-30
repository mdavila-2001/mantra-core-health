import type { ContextoReporte, KpiSpec, PestanaReporte } from '../../../data-access/reporting/reporting.types';
import { AVISO_EJEMPLO, enMoneda, info, unidadMoneda } from './cobros.comun';
import { graficosDeCobro } from './cobros.graficos-cobro';
import { graficosDeLiquidacion } from './cobros.graficos-liquidacion';
import { construirModelo, razonPorCubo, rezagoPromedio, tasaEnPct, DIAS_CON_SIAT, type ModeloCobros } from './cobros.modelo';
import { tablaAtipicas, tablaExcepciones } from './cobros.tablas';
import { agrupar, rng, suma, variacionContexto, variacionPct } from './reporting-dataset.util';

/* ============================================================================
    Pestaña «Cobros y caja» — datos de EJEMPLO.
    Cálculos en `cobros.modelo.ts`; gráficos y tablas en sus archivos hermanos.
    ========================================================================== */

const PCT = { tipo: 'porcentaje' } as const;
const NUM = { tipo: 'numero' } as const;

/** Variación de una tasa: pequeña (puntos de una razón no cambian un 30 % entre periodos). */
function variacionSuave(ctx: ContextoReporte, actual: number | null, semilla: number): number | null {
  if (ctx.comparar === 'ninguna' || actual === null) {
    return null;
  }
  const amplitud = ctx.comparar === 'mismo-periodo-ano-anterior' ? 0.12 : 0.06;
  const anterior = actual * (1 + (rng(semilla)() - 0.5) * 2 * amplitud);
  return variacionPct(actual, anterior);
}

function kpis(m: ModeloCobros): KpiSpec[] {
  const { ctx, total: t } = m;
  const u = unidadMoneda(m);
  const cubo = (num: readonly number[], den: readonly number[]) => razonPorCubo(m.fechas, num, den, m.gran).valores;

  const tasa = tasaEnPct(t.capturados, t.intentos);
  const reembolsos = tasaEnPct(t.reembolsos, t.volumen);
  const costo = tasaEnPct(t.comisiones, t.volumen);
  const disputas = tasaEnPct(t.disputas, t.volumen);
  const rezago = rezagoPromedio(m.tramos);
  const volumen = enMoneda(m, t.volumen);
  const abiertos = suma(m.descuadres.map((f) => suma(f)));

  const comprobantes = m.siat === null ? null : suma(m.siat.map((s) => suma(s.porEstado ?? [])));
  const emitidos = m.siat === null ? null : suma(m.siat.map((s) => s.porEstado?.[0] ?? 0));
  const facturado = comprobantes === null || emitidos === null ? null : tasaEnPct(emitidos, comprobantes);

  return [
    {
      id: 'tasa-exito-pago', titulo: 'Tasa de éxito de pago', valor: tasa, unidad: PCT,
      variacionPct: variacionSuave(ctx, tasa, 8101), numerador: t.capturados, denominador: t.intentos,
      motivoSinDato: tasa === null ? 'No hubo intentos de pago en el periodo y con los filtros elegidos.' : undefined,
      tendencia: cubo(m.dia.capturados, m.dia.intentos),
      info: info({
        definicion: 'Qué parte de los intentos de pago termina en un cobro capturado.',
        formula: 'Pagos capturados ÷ intentos de pago × 100.',
        numerador: 'Pagos capturados', denominador: 'Intentos de pago iniciados',
        fuente: 'payments.payment_transactions · payment_intents',
      }),
    },
    {
      id: 'volumen-cobrado', titulo: 'Volumen cobrado', valor: volumen, unidad: u,
      variacionPct: variacionContexto(ctx, volumen, 8102),
      tendencia: agrupar(m.fechas, m.dia.volumen.map((v) => enMoneda(m, v)), m.gran, 'suma').valores,
      info: info({
        definicion: 'Dinero de los pagos capturados en el periodo.',
        formula: 'Σ importe de las transacciones capturadas.',
        fuente: 'payments.payment_transactions',
        salvedades: ['Importes guardados en BOB y convertidos con un tipo de cambio de ejemplo.'],
      }),
    },
    {
      id: 'reembolsos-pct', titulo: 'Reembolsos', valor: reembolsos, unidad: PCT, subirEsMalo: true,
      variacionPct: variacionSuave(ctx, reembolsos, 8103),
      numerador: enMoneda(m, t.reembolsos), denominador: volumen,
      motivoSinDato: reembolsos === null ? 'No hubo cobros en el periodo, así que no hay contra qué medir los reembolsos.' : undefined,
      tendencia: cubo(m.dia.reembolsos, m.dia.volumen),
      info: info({
        definicion: 'Dinero devuelto a clientes como porcentaje de lo cobrado.',
        formula: 'Monto reembolsado ÷ monto cobrado × 100.',
        numerador: 'Monto reembolsado', denominador: 'Monto cobrado',
        fuente: 'payments.refunds · payment_transactions',
      }),
    },
    {
      id: 'rezago-liquidacion-dias', titulo: 'Rezago de liquidación', valor: rezago,
      unidad: { tipo: 'razon', sufijo: ' días' }, subirEsMalo: true, variacionPct: variacionSuave(ctx, rezago, 8104),
      motivoSinDato: rezago === null ? 'Todavía no se liquidó ningún cobro del periodo elegido.' : undefined,
      info: info({
        definicion: 'Días promedio entre que se cobra y que el gateway liquida el dinero.',
        formula: 'Promedio de (fecha de liquidación − fecha de captura), ponderado por cobros.',
        fuente: 'payments.gateway_settlements · settlement_lines',
        salvedades: ['Solo cuenta cobros ya liquidados; «6 días o más» se cuenta como 7.'],
      }),
    },
    {
      id: 'costo-gateway-pct', titulo: 'Costo del gateway', valor: costo, unidad: PCT, subirEsMalo: true,
      variacionPct: variacionSuave(ctx, costo, 8105), numerador: enMoneda(m, t.comisiones), denominador: volumen,
      motivoSinDato: costo === null ? 'No hubo cobros en el periodo, así que no hay costo que medir.' : undefined,
      tendencia: cubo(m.dia.comisiones, m.dia.volumen),
      info: info({
        definicion: 'Comisiones pagadas al gateway por cada boliviano cobrado.',
        formula: 'Comisiones y tarifas ÷ volumen cobrado × 100.',
        numerador: 'Comisiones y tarifas del gateway', denominador: 'Volumen cobrado',
        fuente: 'payments.transaction_fees · fee_schedules',
      }),
    },
    {
      id: 'disputas-pct', titulo: 'Disputas', valor: disputas, unidad: PCT, subirEsMalo: true,
      variacionPct: variacionSuave(ctx, disputas, 8106), numerador: enMoneda(m, t.disputas), denominador: volumen,
      motivoSinDato: disputas === null ? 'No hubo cobros en el periodo, así que no hay contra qué medir las disputas.' : undefined,
      tendencia: cubo(m.dia.disputas, m.dia.volumen),
      info: info({
        definicion: 'Dinero en disputa (contracargos) como porcentaje de lo cobrado.',
        formula: 'Monto en disputa ÷ monto cobrado × 100.',
        numerador: 'Monto en disputa', denominador: 'Monto cobrado',
        fuente: 'payments.payment_disputes · payment_transactions',
      }),
    },
    {
      id: 'facturas-emitidas-pct', titulo: 'Facturas SIAT emitidas', valor: facturado, unidad: PCT,
      variacionPct: variacionSuave(ctx, facturado, 8107), numerador: emitidos, denominador: comprobantes,
      motivoSinDato:
        m.siat === null
          ? `La emisión SIAT está conectada desde el 01/07/2026; el periodo elegido empieza antes (máximo ${DIAS_CON_SIAT} días).`
          : facturado === null ? 'No hubo cobros que facturar en el periodo.' : undefined,
      info: info({
        definicion: 'Qué parte de los cobros ya tiene su comprobante fiscal emitido.',
        formula: 'Comprobantes en estado «Emitida» ÷ todos los comprobantes del periodo × 100.',
        numerador: 'Comprobantes emitidos', denominador: 'Comprobantes del periodo (emitidos, pendientes, observados y anulados)',
        fuente: 'billing.invoices · payments.provider_invoice_artifacts',
        salvedades: ['Sin emisión conectada en parte del periodo, el indicador sale «Sin dato» en vez de un número parcial.'],
      }),
    },
    {
      id: 'descuadres-abiertos', titulo: 'Descuadres abiertos', valor: abiertos, unidad: NUM, subirEsMalo: true,
      variacionPct: variacionSuave(ctx, abiertos, 8108),
      info: info({
        definicion: 'Diferencias entre el gateway y la contabilidad que siguen sin resolverse, hoy.',
        formula: 'Conteo de excepciones de conciliación abiertas.',
        fuente: 'payments.reconciliation_exceptions',
        salvedades: ['Es una foto de hoy: no cambia con el periodo.'],
      }),
    },
  ];
}

/** Pestaña «Cobros y caja»: cuánto se cobra, con qué calidad, cuánto cuesta y qué falta por cuadrar. */
export function construirCobros(ctx: ContextoReporte): PestanaReporte {
  const m = construirModelo(ctx);
  const graficos = [...graficosDeCobro(m), ...graficosDeLiquidacion(m)];
  const tablas = [tablaAtipicas(m), tablaExcepciones(m)];
  const ids = (...nombres: string[]) => nombres.filter((n) => graficos.some((g) => g.id === n));
  return {
    pestana: 'cobros',
    generadoEn: '2026-10-30T09:00:00-04:00',
    origen: 'ejemplo',
    kpis: kpis(m),
    graficos,
    tablas,
    avisos: [
      AVISO_EJEMPLO,
      ...(m.siat === null ? [`La facturación SIAT no cubre el periodo elegido (la emisión está conectada desde el 01/07/2026): esos indicadores salen «Sin dato».`] : []),
    ],
    secciones: [
      {
        titulo: 'Cobros',
        descripcion: 'Cuánto dinero entra y por dónde se pierde el camino hasta la cuenta.',
        graficos: ids('volumen-cobrado-diario', 'embudo-pago', 'cobrado-a-neto'),
      },
      {
        titulo: 'Calidad del cobro',
        descripcion: 'Qué tan bien salen los pagos, por método y pasarela, y por qué fallan.',
        graficos: ids('tasa-exito-pago', 'exito-por-metodo', 'exito-por-pasarela', 'motivos-rechazo', 'reembolsos-disputas'),
        tablas: ['transacciones-atipicas'],
      },
      {
        titulo: 'Liquidación y costo',
        descripcion: 'Cuánto tarda en llegar el dinero y cuánto cuesta el gateway.',
        graficos: ids('rezago-liquidacion', 'costo-gateway'),
      },
      {
        titulo: 'Facturación y conciliación',
        descripcion: 'Comprobantes fiscales pendientes y diferencias por cuadrar.',
        graficos: ids('facturacion-siat', 'descuadres-antiguedad'),
        tablas: ['excepciones-conciliacion'],
      },
    ],
  };
}
