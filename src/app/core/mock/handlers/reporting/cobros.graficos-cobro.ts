import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec } from '../../../data-access/reporting/reporting.types';
import {
  enMoneda,
  info,
  nombreGranularidad,
  SIN_FILTRO_ETAPAS,
  SIN_VELAS_FLUJO,
  SIN_VELAS_FOTO,
  unidadMoneda,
} from './cobros.comun';
import {
  METODOS,
  MOTIVOS_RECHAZO,
  razonDiaria,
  razonPorCubo,
  tasaEnPct,
  type Metodo,
  type ModeloCobros,
} from './cobros.modelo';
import { agrupar, redondear, suma, candlesFromSeries } from './reporting-dataset.util';

const PCT = { tipo: 'porcentaje' } as const;
const NUM = { tipo: 'numero' } as const;

/** Pasarelas de EJEMPLO (nombres inventados) y el método de pago que atienden. */
const PASARELAS: readonly { readonly nombre: string; readonly metodo: Metodo; readonly ajuste: number }[] = [
  { nombre: 'Pasarela Andina · tarjetas', metodo: 'Tarjeta', ajuste: 0.8 },
  { nombre: 'Pasarela Altiplano · tarjetas', metodo: 'Tarjeta', ajuste: -1.4 },
  { nombre: 'Red QR nacional', metodo: 'QR', ajuste: 0 },
  { nombre: 'Débito bancario directo', metodo: 'Transferencia', ajuste: 0 },
  { nombre: 'Caja central', metodo: 'Efectivo en caja', ajuste: 0 },
];

function volumenDiario(m: ModeloCobros): ChartSpec {
  const g = agrupar(m.fechas, m.dia.volumen.map((v) => enMoneda(m, v)), m.gran, 'suma');
  const total = suma(m.dia.volumen);
  return {
    id: 'volumen-cobrado-diario',
    titulo: 'Volumen cobrado',
    subtitulo: `Por ${nombreGranularidad(m)}, solo pagos capturados`,
    unidad: unidadMoneda(m),
    datos: {
      tipo: 'cartesiano',
      categorias: g.etiquetas,
      series: [{ nombre: 'Volumen cobrado', valores: g.valores.map((v) => redondear(v, 2)), forma: 'barra' }],
    },
    resumenAccesible: `Barras del dinero cobrado por ${nombreGranularidad(m)}. En el periodo suma ${formatearValor(enMoneda(m, total), unidadMoneda(m))}; se lee la tendencia y los días más flojos.`,
    filtro: null,
    filtroMotivo: 'Cada barra es un tramo de tiempo, no una categoría; para filtrar se usa el método de pago o el estado de los otros gráficos.',
    info: info({
      definicion: 'Dinero de los pagos capturados (cobrados de verdad), sin contar reembolsos ni contracargos.',
      formula: 'Σ importe de las transacciones capturadas, agrupadas por día de captura.',
      fuente: 'payments.payment_transactions (estado capturada o liquidada) · payment_intents',
      salvedades: ['Los importes se guardan en BOB y se convierten con un tipo de cambio de ejemplo.'],
    }),
    velas: null,
    velasMotivo: SIN_VELAS_FLUJO,
    alto: 300,
    ancho: 'completo',
  };
}

function embudo(m: ModeloCobros): ChartSpec {
  const t = m.total;
  const pasos = [
    { nombre: 'la autorización', perdidos: t.intentos - t.autorizados },
    { nombre: 'la captura', perdidos: t.autorizados - t.capturados },
    { nombre: 'la liquidación (que incluye los cobros recientes aún en camino)', perdidos: t.capturados - t.liquidados },
  ];
  const mayor = pasos.reduce((a, p) => (p.perdidos > a.perdidos ? p : a), pasos[0]!);
  return {
    id: 'embudo-pago',
    titulo: 'Embudo de pago',
    subtitulo: 'De cada intento al dinero liquidado',
    unidad: NUM,
    datos: {
      tipo: 'partes',
      forma: 'embudo',
      partes: [
        { nombre: 'Intentos de pago', valor: t.intentos },
        { nombre: 'Autorizados', valor: t.autorizados },
        { nombre: 'Capturados', valor: t.capturados },
        { nombre: 'Liquidados', valor: t.liquidados },
      ],
    },
    resumenAccesible: `De ${formatearValor(t.intentos, NUM)} intentos se autorizan ${formatearValor(t.autorizados, NUM)}, se capturan ${formatearValor(t.capturados, NUM)} y ya se liquidaron ${formatearValor(t.liquidados, NUM)}; la etapa donde más se pierde es ${mayor.nombre}.`,
    filtro: null,
    filtroMotivo: SIN_FILTRO_ETAPAS,
    info: info({
      definicion: 'Cuántos pagos sobreviven en cada etapa del recorrido, de la intención al dinero liquidado por el gateway.',
      formula: 'Conteo de intentos → autorizados → capturados → liquidados (cada etapa es parte de la anterior).',
      fuente: 'payments.payment_intents · payment_transactions · settlement_lines',
      salvedades: ['Los cobros de los últimos días todavía no se liquidan, por eso «Liquidados» queda por debajo de «Capturados».'],
    }),
    velas: null,
    velasMotivo: SIN_VELAS_FOTO,
    alto: 300,
  };
}

function cascadaNeto(m: ModeloCobros): ChartSpec {
  const cobrado = enMoneda(m, m.total.volumen);
  const reembolsos = enMoneda(m, m.total.reembolsos);
  const disputas = enMoneda(m, m.total.disputas);
  const comisiones = enMoneda(m, m.total.comisiones);
  const neto = redondear(cobrado - reembolsos - disputas - comisiones, 2);
  const u = unidadMoneda(m);
  const descuentos = [
    { nombre: 'los reembolsos', v: reembolsos },
    { nombre: 'los contracargos', v: disputas },
    { nombre: 'las comisiones', v: comisiones },
  ];
  const mayor = descuentos.reduce((a, d) => (d.v > a.v ? d : a), descuentos[0]!);
  return {
    id: 'cobrado-a-neto',
    titulo: 'Del cobro al neto a recibir',
    subtitulo: 'Qué se descuenta antes de que el dinero llegue',
    unidad: u,
    datos: {
      tipo: 'cascada',
      pasos: [
        { nombre: 'Cobrado', valor: cobrado, total: true },
        { nombre: 'Reembolsos', valor: -reembolsos },
        { nombre: 'Contracargos', valor: -disputas },
        { nombre: 'Comisiones del gateway', valor: -comisiones },
        { nombre: 'Neto a recibir', valor: neto, total: true },
      ],
    },
    resumenAccesible: `De ${formatearValor(cobrado, u)} cobrados quedan ${formatearValor(neto, u)} netos tras reembolsos, contracargos y comisiones; el descuento mayor son ${mayor.nombre}.`,
    filtro: null,
    filtroMotivo: 'Cada paso es un concepto de descuento, no una categoría de los demás gráficos.',
    info: info({
      definicion: 'Dinero que queda después de devolver, perder disputas y pagar las comisiones del gateway.',
      formula: 'Cobrado − reembolsos − contracargos − comisiones del gateway.',
      fuente: 'payments.payment_transactions · refunds · payment_disputes · transaction_fees',
      salvedades: ['Los contracargos se cuentan por el monto en disputa, aunque algunos se ganan después.'],
    }),
    velas: null,
    velasMotivo: SIN_VELAS_FLUJO,
    alto: 300,
  };
}

function tasaExitoVelas(m: ModeloCobros): ChartSpec {
  const r = razonPorCubo(m.fechas, m.dia.capturados, m.dia.intentos, m.gran);
  const global = tasaEnPct(m.total.capturados, m.total.intentos);
  const diaria = razonDiaria(m.dia.capturados, m.dia.intentos, global ?? 0);
  return {
    id: 'tasa-exito-pago',
    titulo: 'Tasa de éxito de pago',
    subtitulo: `Pagos capturados ÷ intentos, por ${nombreGranularidad(m)}`,
    unidad: PCT,
    datos: { tipo: 'cartesiano', categorias: r.etiquetas, series: [{ nombre: 'Tasa de éxito', valores: r.valores, forma: 'linea' }] },
    resumenAccesible: `Línea de la tasa de éxito de pago por ${nombreGranularidad(m)}; en el periodo es ${formatearValor(global, PCT)}. Si baja, más clientes se quedan sin pagar.`,
    filtro: null,
    filtroMotivo: 'Cada punto es un tramo de tiempo; para filtrar se usa el gráfico de éxito por método de pago.',
    info: info({
      definicion: 'Qué parte de los intentos de pago termina en un cobro capturado.',
      formula: 'Pagos capturados ÷ intentos de pago × 100 (ponderada: se suman antes de dividir).',
      numerador: 'Pagos capturados',
      denominador: 'Intentos de pago iniciados',
      fuente: 'payments.payment_transactions · payment_intents · payment_gateway_metric_series',
    }),
    velas: {
      explicacion: 'Tasa de éxito por tramo: apertura = primer día, cierre = último día, mínimo y máximo del tramo.',
      velas: candlesFromSeries(m.fechas, diaria, m.gran),
    },
    alto: 300,
    ancho: 'completo',
  };
}

function exitoPorMetodo(m: ModeloCobros): ChartSpec {
  const tasas = METODOS.map((k) => tasaEnPct(suma(m.porMetodo[k].capturados), suma(m.porMetodo[k].intentos)));
  const conDato = METODOS.map((k, i) => ({ k, v: tasas[i] ?? null })).filter((x): x is { k: Metodo; v: number } => x.v !== null);
  const mejor = conDato.reduce((a, x) => (x.v > a.v ? x : a), conDato[0]!);
  const peor = conDato.reduce((a, x) => (x.v < a.v ? x : a), conDato[0]!);
  return {
    id: 'exito-por-metodo',
    titulo: 'Éxito de pago por método',
    subtitulo: 'Haz clic en un método para filtrar el tablero',
    unidad: PCT,
    datos: { tipo: 'cartesiano', categorias: [...METODOS], series: [{ nombre: 'Tasa de éxito', valores: tasas, forma: 'barra' }] },
    resumenAccesible: `Barras de la tasa de éxito por método de pago: ${METODOS.map((k, i) => `${k} ${formatearValor(tasas[i], PCT)}`).join(', ')}. ${conDato.length > 1 ? `El método más sólido es ${mejor.k} y el más débil, ${peor.k}.` : ''}`,
    filtro: { dimension: 'metodo-pago' },
    info: info({
      definicion: 'Tasa de éxito de pago separada por método (tarjeta, QR, transferencia, efectivo en caja).',
      formula: 'Pagos capturados del método ÷ intentos del método × 100.',
      numerador: 'Pagos capturados del método',
      denominador: 'Intentos del método',
      fuente: 'payments.payment_transactions · payment_methods',
      salvedades: ['Muestra siempre los cuatro métodos, aunque haya uno filtrado, para poder compararlos.'],
    }),
    velas: null,
    velasMotivo: 'Compara métodos en un mismo periodo; no es una serie que cambie día a día.',
    alto: 300,
  };
}

function exitoPorPasarela(m: ModeloCobros): ChartSpec {
  const valores = PASARELAS.map((p) => {
    const base = tasaEnPct(suma(m.porMetodo[p.metodo].capturados), suma(m.porMetodo[p.metodo].intentos));
    return base === null || !m.activos.includes(p.metodo) ? null : redondear(Math.min(100, Math.max(0, base + p.ajuste)), 2);
  });
  return {
    id: 'exito-por-pasarela',
    titulo: 'Éxito de pago por pasarela',
    subtitulo: 'Cada pasarela atiende un método de pago',
    unidad: PCT,
    datos: { tipo: 'cartesiano', horizontal: true, categorias: PASARELAS.map((p) => p.nombre), series: [{ nombre: 'Tasa de éxito', valores, forma: 'barra' }] },
    resumenAccesible: `Barras horizontales de la tasa de éxito por pasarela, de ${PASARELAS.length} pasarelas; sirven para decidir a cuál mandar más tráfico. Una pasarela sin barra no tiene datos con el filtro actual.`,
    filtro: null,
    filtroMotivo: 'Las pasarelas aún no son una dimensión de filtro del tablero; la dimensión disponible es el método de pago.',
    info: info({
      definicion: 'Tasa de éxito de pago de cada pasarela conectada.',
      formula: 'Pagos capturados por la pasarela ÷ intentos enviados a la pasarela × 100.',
      numerador: 'Pagos capturados por la pasarela',
      denominador: 'Intentos enviados a la pasarela',
      fuente: 'payments.payment_gateways · payment_transactions · payment_gateway_metric_series',
      salvedades: ['Los nombres de las pasarelas son inventados.', 'Con un método filtrado solo aparecen las pasarelas de ese método.'],
    }),
    velas: null,
    velasMotivo: 'Compara pasarelas en un mismo periodo; no es una serie que cambie día a día.',
    alto: 300,
  };
}

function motivosRechazo(m: ModeloCobros): ChartSpec {
  const partes = MOTIVOS_RECHAZO.map((nombre, k) => ({ nombre, valor: m.rechazos[k]! }));
  const mayor = partes.reduce((a, p) => (p.valor > a.valor ? p : a), partes[0]!);
  return {
    id: 'motivos-rechazo',
    titulo: 'Motivos de rechazo',
    subtitulo: 'Intentos que no llegaron a autorizarse',
    unidad: NUM,
    datos: { tipo: 'partes', forma: 'dona', partes },
    resumenAccesible: `Dona con ${partes.length} motivos por los que se rechazan los pagos; el principal es «${mayor.nombre}» con ${formatearValor(mayor.valor, NUM)} intentos.`,
    filtro: null,
    filtroMotivo: 'El motivo de rechazo todavía no es una dimensión por la que se pueda filtrar el resto del tablero.',
    info: info({
      definicion: 'Razón declarada por el banco o la pasarela cuando un intento de pago no se autoriza.',
      formula: 'Conteo de intentos no autorizados, agrupados por motivo (hasta 5 motivos; el resto va en «Otros motivos»).',
      fuente: 'payments.payment_transactions · provider_api_attempts',
      salvedades: ['No incluye pagos autorizados que luego no se capturaron.'],
    }),
    velas: null,
    velasMotivo: SIN_VELAS_FOTO,
    alto: 300,
  };
}

export function graficosDeCobro(m: ModeloCobros): ChartSpec[] {
  return [volumenDiario(m), embudo(m), cascadaNeto(m), tasaExitoVelas(m), exitoPorMetodo(m), exitoPorPasarela(m), motivosRechazo(m)];
}
