import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec } from '../../../data-access/reporting/reporting.types';
import { info, granularityName, NO_CANDLES_SNAPSHOT } from './cobros.comun';
import {
  CAUSAS_DESCUADRE,
  SIAT_COVERED_DAYS,
  ESTADOS_SIAT,
  METODOS,
  dailyRatio,
  ratioPerBucket,
  rezagoPromedio,
  tasaEnPct,
  TRAMOS_ANTIGUEDAD,
  TRAMOS_REZAGO,
  type ModeloCobros,
} from './cobros.modelo';
import { suma, candlesFromSeries } from './reporting-dataset.util';

const PCT = { tipo: 'porcentaje' } as const;
const NUM = { tipo: 'numero' } as const;

function reembolsosYDisputas(m: ModeloCobros): ChartSpec {
  const reemb = ratioPerBucket(m.fechas, m.dia.reembolsos, m.dia.volumen, m.gran);
  const disp = ratioPerBucket(m.fechas, m.dia.disputas, m.dia.volumen, m.gran);
  const global = tasaEnPct(m.total.reembolsos, m.total.volumen);
  const diaria = dailyRatio(m.dia.reembolsos, m.dia.volumen, global ?? 0);
  return {
    id: 'reembolsos-disputas',
    titulo: 'Reembolsos y disputas',
    subtitulo: `Como % de lo cobrado, por ${granularityName(m)}`,
    unidad: PCT,
    datos: {
      tipo: 'cartesiano',
      categorias: reemb.etiquetas,
      series: [
        { nombre: 'Reembolsos', valores: reemb.valores, forma: 'linea' },
        { nombre: 'Disputas', valores: disp.valores, forma: 'linea' },
      ],
    },
    resumenAccesible: `Dos líneas con el monto reembolsado y el monto en disputa como porcentaje de lo cobrado; en el periodo los reembolsos son ${formatearValor(global, PCT)}. Subir es malo.`,
    filtro: null,
    filtroMotivo: 'Cada punto es un tramo de tiempo; para filtrar se usa el método de pago desde su gráfico.',
    info: info({
      definicion: 'Dinero devuelto a clientes y dinero en disputa (contracargos), contra lo cobrado.',
      formula: 'Monto reembolsado (o en disputa) ÷ monto cobrado × 100, por tramo.',
      numerador: 'Monto reembolsado, o monto en disputa',
      denominador: 'Monto cobrado',
      fuente: 'payments.refunds · payment_disputes · payment_transactions',
      salvedades: ['El reembolso se cuenta en el día en que se emite, no en el día del cobro original.'],
    }),
    velas: {
      explicacion: 'Reembolsos como % de lo cobrado por tramo: apertura, máximo, mínimo y cierre. Una vela que sube es peor.',
      velas: candlesFromSeries(m.fechas, diaria, m.gran),
      subirEsMalo: true,
    },
    alto: 300,
  };
}

function rezagoLiquidacion(m: ModeloCobros): ChartSpec {
  const prom = rezagoPromedio(m.tramos);
  return {
    id: 'rezago-liquidacion',
    titulo: 'Rezago de liquidación',
    subtitulo: 'Días entre el cobro y la liquidación del gateway',
    unidad: NUM,
    datos: { tipo: 'cartesiano', categorias: [...TRAMOS_REZAGO], series: [{ nombre: 'Cobros liquidados', valores: m.tramos, forma: 'barra' }] },
    resumenAccesible: `Histograma de cuántos cobros se liquidaron al cabo de 0, 1, 2, 3 a 5 y 6 o más días; el promedio es ${prom === null ? 'Sin dato' : `${prom} días`}. Una barra alta a la derecha es dinero que tarda en llegar.`,
    filtro: null,
    filtroMotivo: 'Cada barra es un tramo de días, no una categoría por la que se pueda filtrar.',
    info: info({
      definicion: 'Cuánto tarda el dinero en llegar a la cuenta desde que se cobra, agrupado en tramos de días.',
      formula: 'Cantidad de cobros liquidados por tramo de (fecha de liquidación − fecha de captura).',
      fuente: 'payments.gateway_settlements · settlement_lines · payment_transactions',
      salvedades: ['Solo cuenta cobros ya liquidados; los de los últimos días aún no aparecen.', 'Para el promedio, «6 días o más» se cuenta como 7 días.'],
    }),
    velas: null,
    velasMotivo: NO_CANDLES_SNAPSHOT,
    alto: 300,
  };
}

function costoGateway(m: ModeloCobros): ChartSpec {
  const costo = ratioPerBucket(m.fechas, m.dia.comisiones, m.dia.volumen, m.gran);
  const global = tasaEnPct(m.total.comisiones, m.total.volumen);
  const diaria = dailyRatio(m.dia.comisiones, m.dia.volumen, global ?? 0);
  return {
    id: 'costo-gateway',
    titulo: 'Costo del gateway',
    subtitulo: `Comisiones como % del volumen, por ${granularityName(m)}`,
    unidad: PCT,
    datos: { tipo: 'cartesiano', categorias: costo.etiquetas, series: [{ nombre: 'Costo del gateway', valores: costo.valores, forma: 'linea' }] },
    resumenAccesible: `Línea del costo del gateway como porcentaje del volumen cobrado; en el periodo es ${formatearValor(global, PCT)}. Depende de la mezcla de métodos: QR y transferencia cuestan menos que la tarjeta.`,
    filtro: null,
    filtroMotivo: 'Cada punto es un tramo de tiempo; el costo por método se ve filtrando desde el gráfico de éxito por método.',
    info: info({
      definicion: 'Cuánto se paga al gateway en comisiones por cada boliviano cobrado.',
      formula: 'Comisiones y tarifas de transacción ÷ volumen cobrado × 100.',
      numerador: 'Comisiones y tarifas cobradas por el gateway',
      denominador: 'Volumen cobrado',
      fuente: 'payments.transaction_fees · fee_schedules · payment_transactions',
    }),
    velas: {
      explicacion: 'Costo del gateway por tramo: apertura, máximo, mínimo y cierre. Una vela que sube es peor.',
      velas: candlesFromSeries(m.fechas, diaria, m.gran),
      subirEsMalo: true,
    },
    alto: 300,
  };
}

function facturacionSiat(m: ModeloCobros): ChartSpec {
  const siat = m.siat;
  const series = METODOS.map((metodo) => {
    const fila = siat?.find((s) => s.metodo === metodo)?.porEstado ?? null;
    return {
      nombre: metodo,
      valores: ESTADOS_SIAT.map((_, k) => (fila === null ? null : fila[k]!)),
      forma: 'barra' as const,
      apilar: 'siat',
    };
  });
  const emitidas = siat === null ? null : suma(series.map((s) => s.valores[0] ?? 0));
  return {
    id: 'facturacion-siat',
    titulo: 'Facturación SIAT',
    subtitulo: 'Comprobantes por estado, según el método de pago',
    unidad: NUM,
    datos: { tipo: 'cartesiano', categorias: [...ESTADOS_SIAT], series },
    resumenAccesible:
      siat === null
        ? 'Sin dato: la emisión SIAT no cubre todo el periodo elegido.'
        : `Barras apiladas con los comprobantes por estado y método de pago; ${formatearValor(emitidas, NUM)} ya están emitidos. Lo pendiente y lo observado es trabajo para facturación.`,
    filtro: { dimension: 'estado' },
    info: info({
      definicion: 'Estado de los comprobantes fiscales de cada cobro capturado: emitido, pendiente, observado por el SIAT o anulado.',
      formula: 'Conteo de comprobantes por estado, apilados por método de pago del cobro.',
      fuente: 'billing.invoices · payments.provider_invoice_artifacts',
      salvedades: [`La emisión SIAT está conectada desde el 01/07/2026: con periodos de más de ${SIAT_COVERED_DAYS} días este gráfico y su indicador salen «Sin dato», no en cero.`],
    }),
    velas: null,
    velasMotivo: 'Es un conteo de comprobantes por estado, no una serie de saldo ni de razón.',
    sinDatoMotivo: `La emisión SIAT está conectada desde el 01/07/2026 y el periodo elegido empieza antes (máximo ${SIAT_COVERED_DAYS} días). Elige 90 días o menos.`,
    alto: 300,
  };
}

function descuadres(m: ModeloCobros): ChartSpec {
  const celdas: [number, number, number][] = [];
  CAUSAS_DESCUADRE.forEach((_, fila) => TRAMOS_ANTIGUEDAD.forEach((__, col) => celdas.push([col, fila, m.descuadres[fila]![col]!])));
  const total = suma(m.descuadres.map((f) => suma(f)));
  const viejos = suma(m.descuadres.map((f) => f[4]!));
  return {
    id: 'descuadres-antiguedad',
    titulo: 'Descuadres de conciliación abiertos',
    subtitulo: 'Por causa y antigüedad, al día de hoy',
    unidad: NUM,
    datos: { tipo: 'mapa-calor', filas: [...CAUSAS_DESCUADRE], columnas: [...TRAMOS_ANTIGUEDAD], celdas, nombreValor: 'Descuadres abiertos' },
    resumenAccesible: `Mapa de calor con ${formatearValor(total, NUM)} descuadres abiertos entre el gateway y la contabilidad; ${formatearValor(viejos, NUM)} llevan más de 30 días y son los más urgentes.`,
    filtro: null,
    filtroMotivo: 'Las filas son causas de descuadre, que todavía no son una dimensión de filtro del tablero.',
    info: info({
      definicion: 'Diferencias entre lo que dice el gateway y lo que registra la contabilidad que siguen sin resolverse.',
      formula: 'Conteo de excepciones de conciliación abiertas por causa y por días desde que se abrieron.',
      fuente: 'payments.reconciliation_exceptions · reconciliation_runs · provider_reconciliation_records',
      salvedades: ['Es una foto de hoy: no cambia con el periodo, solo con el alcance y los filtros.'],
    }),
    velas: null,
    velasMotivo: NO_CANDLES_SNAPSHOT,
    alto: 300,
  };
}

export function settlementCharts(m: ModeloCobros): ChartSpec[] {
  return [reembolsosYDisputas(m), rezagoLiquidacion(m), costoGateway(m), facturacionSiat(m), descuadres(m)];
}
