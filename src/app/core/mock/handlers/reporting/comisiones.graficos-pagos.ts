import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec, ContextoReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { FUENTE_CONCILIACION, FUENTE_COMISIONES, FUENTE_FEES, FUENTE_PAYOUTS, info } from './comisiones.info';
import { aMonto, MOTIVO_SIN_ESQUEMA, porcentaje, repartir, type ModeloComisiones } from './comisiones.modelo';
import {
  agrupar,
  fechasDelPeriodo,
  granularidad,
  hashTexto,
  redondear,
  serie,
  velasDeSerie,
} from './reporting-dataset.util';

/* Gráficos «Resultado de la plataforma», «Pagos y antigüedad» y «Conciliación». */

const TRAMOS = ['0-30 días', '31-60 días', '61-90 días', 'Más de 90 días'];
const PESOS_TRAMOS = [0.46, 0.27, 0.15, 0.12];
const TIPOS_DESCUADRE = [
  'Monto distinto al del gateway',
  'Cobro sin registro en el libro',
  'Registro del gateway sin cobro',
  'Posible duplicado',
];
const PESOS_DESCUADRE = [0.38, 0.27, 0.22, 0.13];

const moneda = (ctx: ContextoReporte): UnidadValor => ({ tipo: 'moneda', moneda: ctx.moneda });
const porcentajeU: UnidadValor = { tipo: 'porcentaje' };

export function graficoCascada(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const a = m.alcance;
  const unidad = moneda(ctx);
  const neto = aMonto(a.ingresoNetoC);
  return {
    id: 'cascada-resultado',
    titulo: 'De los fees cobrados al ingreso neto de la plataforma',
    subtitulo: `En ${ctx.moneda}; el volumen transaccionado es la base del take rate`,
    unidad,
    datos: {
      tipo: 'cascada',
      pasos:
        a.ingresoNetoC === null || a.comisionesC === null
          ? []
          : [
              { nombre: 'Fees brutos cobrados', valor: a.feesC / 100, total: true },
              { nombre: 'Costo del gateway', valor: -a.gatewayC / 100 },
              { nombre: 'Comisiones a actores', valor: -a.comisionesC / 100 },
              { nombre: 'Ingreso neto de la plataforma', valor: a.ingresoNetoC / 100, total: true },
            ],
    },
    resumenAccesible:
      neto === null
        ? 'Cascada sin dato: el actor elegido no tiene esquema de comisión definido, así que no se puede calcular el ingreso neto.'
        : `Cascada en ${ctx.moneda}: de ${formatearValor(a.feesC / 100, unidad)} de fees brutos se descuentan ` +
          `${formatearValor(a.gatewayC / 100, unidad)} del gateway y ${formatearValor((a.comisionesC ?? 0) / 100, unidad)} de comisiones; ` +
          `queda un ingreso neto de ${formatearValor(neto, unidad)}.`,
    filtro: null,
    filtroMotivo: 'Los pasos de la cascada son conceptos contables, no entidades por las que se filtre el resto del tablero.',
    info: info({
      definicion: 'Cómo los fees que cobra la plataforma se convierten en su ingreso neto, después del gateway y de lo que se paga a los actores.',
      formula: 'ingreso neto = fees brutos − costo del gateway − comisiones a actores',
      fuente: `${FUENTE_FEES}, ${FUENTE_COMISIONES}`,
      salvedades: ['Sin el Visitador médico el ingreso neto es un techo: su comisión futura lo reducirá.'],
    }),
    velas: null,
    velasMotivo: 'Es un desglose contable de un solo periodo, no una serie con apertura y cierre.',
    alto: 320,
    sinDatoMotivo: MOTIVO_SIN_ESQUEMA,
  };
}

export function graficoTakeRate(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const a = m.alcance;
  const take = porcentaje(a.ingresoNetoC, a.volumenC);
  const fechas = fechasDelPeriodo(ctx.periodo);
  const gran = granularidad(ctx.periodo);
  const diaria =
    take === null ? null : serie(hashTexto(`comisiones:take:${ctx.periodo}`), fechas.length, take / 1.0125, 2.5, 2.5).map((v) => redondear(v, 2));
  const cubos = diaria === null ? { etiquetas: agrupar(fechas, fechas.map(() => 0), gran, 'promedio').etiquetas, valores: null } : agrupar(fechas, diaria, gran, 'promedio');
  const unidad = porcentajeU;
  return {
    id: 'take-rate-tiempo',
    titulo: 'Take rate en el tiempo',
    subtitulo: 'Ingreso neto de la plataforma ÷ volumen transaccionado',
    unidad,
    datos: {
      tipo: 'cartesiano',
      categorias: cubos.etiquetas,
      series: [
        {
          nombre: 'Take rate',
          forma: 'linea',
          valores: cubos.valores === null ? cubos.etiquetas.map(() => null) : cubos.valores.map((v) => redondear(v, 2)),
        },
      ],
    },
    resumenAccesible:
      take === null
        ? 'Línea del take rate sin dato: el actor elegido no tiene esquema de comisión definido.'
        : `Línea del take rate por ${gran === 'dia' ? 'día' : gran === 'semana' ? 'semana' : 'mes'}. En el periodo es de ${formatearValor(take, unidad)}; ` +
          'cada vela de la versión en velas resume apertura, máximo, mínimo y cierre del tramo.',
    filtro: null,
    filtroMotivo: 'La línea de tiempo no tiene una categoría por la que filtrar el resto; para ver un actor se usan los gráficos por actor.',
    info: info({
      definicion: 'Qué parte del dinero que se mueve por la plataforma se queda como ingreso neto.',
      formula: 'ingreso neto ÷ volumen transaccionado × 100',
      numerador: 'Ingreso neto de la plataforma (fees − gateway − comisiones)',
      denominador: 'Volumen transaccionado',
      fuente: FUENTE_FEES,
      salvedades: ['La serie diaria es de EJEMPLO y orienta la tendencia; el KPI se calcula sobre el total del periodo.'],
    }),
    velas:
      diaria === null
        ? null
        : {
            explicacion: 'Take rate: apertura, máximo, mínimo y cierre de cada tramo. Es una razón, no un flujo que se suma.',
            velas: velasDeSerie(fechas, diaria, gran),
          },
    velasMotivo: diaria === null ? 'Sin dato no hay velas que dibujar.' : undefined,
    alto: 300,
    sinDatoMotivo: MOTIVO_SIN_ESQUEMA,
  };
}

export function graficoSaldoPorPagar(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const pendiente = aMonto(m.alcance.pendienteC);
  const fechas = fechasDelPeriodo(ctx.periodo);
  const gran = granularidad(ctx.periodo);
  const unidad = moneda(ctx);
  let diaria: number[] | null = null;
  if (pendiente !== null) {
    const cruda = serie(hashTexto(`comisiones:saldo:${ctx.periodo}`), fechas.length, 100, 22, 3.5);
    // El saldo de hoy ES la comisión pendiente: la serie se escala para terminar ahí.
    const k = pendiente / cruda[cruda.length - 1]!;
    diaria = cruda.map((v) => redondear(v * k, 2));
  }
  const cubos = diaria === null ? { etiquetas: agrupar(fechas, fechas.map(() => 0), gran, 'ultimo').etiquetas, valores: null } : agrupar(fechas, diaria, gran, 'ultimo');
  return {
    id: 'saldo-por-pagar',
    titulo: 'Saldo de comisiones por pagar',
    subtitulo: `Cierre de cada tramo, en ${ctx.moneda}`,
    unidad,
    datos: {
      tipo: 'cartesiano',
      categorias: cubos.etiquetas,
      series: [
        {
          nombre: 'Saldo por pagar',
          forma: 'area',
          valores: cubos.valores === null ? cubos.etiquetas.map(() => null) : cubos.valores.map((v) => redondear(v, 2)),
        },
      ],
    },
    resumenAccesible:
      pendiente === null
        ? 'Saldo por pagar sin dato: el actor elegido no tiene esquema de comisión definido.'
        : `Área del saldo de comisiones por pagar; hoy es de ${formatearValor(pendiente, unidad)}. Si sube, se está pagando más lento de lo que se devenga.`,
    filtro: null,
    filtroMotivo: 'Es una línea de tiempo del saldo total; el desglose por actor está en los gráficos por actor.',
    info: info({
      definicion: 'Lo que la plataforma le debe a los actores por comisiones devengadas y todavía no liquidadas, día a día.',
      formula: 'saldo(t) = saldo(t−1) + comisión devengada(t) − comisión liquidada(t)',
      fuente: `${FUENTE_PAYOUTS}, ${FUENTE_COMISIONES}`,
      salvedades: ['El saldo de hoy coincide con la comisión pendiente; el recorrido anterior es de EJEMPLO.'],
    }),
    velas:
      diaria === null
        ? null
        : {
            explicacion: 'Saldo por pagar: apertura, máximo, mínimo y cierre de cada tramo. Subir es malo: es deuda acumulada.',
            velas: velasDeSerie(fechas, diaria, gran),
            subirEsMalo: true,
          },
    velasMotivo: diaria === null ? 'Sin dato no hay velas que dibujar.' : undefined,
    alto: 300,
    sinDatoMotivo: MOTIVO_SIN_ESQUEMA,
  };
}

export function graficoPayouts(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const p = m.alcance.payouts;
  const total = p === null ? null : p.emitidos + p.enProceso + p.fallidos;
  return {
    id: 'estado-payouts',
    titulo: 'Estado de los payouts',
    subtitulo: 'Cantidad de pagos a actores en el periodo',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'partes',
      forma: 'dona',
      partes: [
        { nombre: 'Emitidos', valor: p?.emitidos ?? null },
        { nombre: 'En proceso', valor: p?.enProceso ?? null },
        { nombre: 'Fallidos', valor: p?.fallidos ?? null },
      ],
    },
    resumenAccesible:
      p === null || total === null
        ? 'Dona de payouts sin dato: el actor elegido no recibe payouts o no tiene esquema de comisión definido.'
        : `Dona de ${total} payouts: ${p.emitidos} emitidos, ${p.enProceso} en proceso y ${p.fallidos} fallidos` +
          `${total > 0 ? ` (${redondear((p.fallidos / total) * 100, 1)} % fallidos)` : ''}.`,
    filtro: { dimension: 'estado' },
    info: info({
      definicion: 'Cuántos pagos a actores se emitieron, siguen en proceso o fallaron.',
      formula: 'conteo de payouts por estado',
      fuente: FUENTE_PAYOUTS,
      salvedades: ['La Plataforma no recibe payouts: retiene su parte al cobrar.'],
    }),
    velas: null,
    velasMotivo: 'Son conteos del periodo repartidos por estado, no un saldo con apertura y cierre.',
    alto: 300,
    sinDatoMotivo: 'Este actor no recibe payouts o no tiene un esquema de comisión definido (decisión de negocio pendiente).',
  };
}

export function graficoAging(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const pendienteC = m.alcance.pendienteC;
  const partes = pendienteC === null ? null : repartir(pendienteC, PESOS_TRAMOS);
  const unidad = moneda(ctx);
  return {
    id: 'aging-pendiente',
    titulo: 'Antigüedad de lo pendiente de pago',
    subtitulo: `Comisión pendiente por tramo de días, en ${ctx.moneda}`,
    unidad,
    datos: {
      tipo: 'cartesiano',
      categorias: TRAMOS,
      series: [{ nombre: 'Pendiente de pago', forma: 'barra', valores: TRAMOS.map((_, i) => (partes === null ? null : partes[i]! / 100)) }],
    },
    resumenAccesible:
      partes === null || pendienteC === null
        ? 'Barras de antigüedad sin dato: el actor elegido no tiene esquema de comisión definido.'
        : `Barras por tramo de antigüedad. Los tramos suman la comisión pendiente (${formatearValor(pendienteC / 100, unidad)}); ` +
          `${formatearValor(partes[3]! / 100, unidad)} lleva más de 90 días sin pagarse.`,
    filtro: null,
    filtroMotivo: 'Los tramos de antigüedad no son una dimensión por la que se filtre el resto del tablero.',
    info: info({
      definicion: 'Cuánto tiempo lleva sin pagarse cada boliviano de comisión pendiente.',
      formula: 'comisión pendiente agrupada por días desde su devengo: 0-30 · 31-60 · 61-90 · más de 90',
      fuente: `${FUENTE_PAYOUTS}, insurance.broker_commission_statements`,
      salvedades: ['El reparto entre tramos es de EJEMPLO; la suma de los tramos sí es la comisión pendiente.'],
    }),
    velas: null,
    velasMotivo: 'Es una foto de la deuda de hoy repartida por antigüedad, no una serie en el tiempo.',
    alto: 300,
    sinDatoMotivo: MOTIVO_SIN_ESQUEMA,
  };
}

export function graficoConciliacion(_ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const a = m.alcance;
  const pct = porcentaje(a.volumenC - a.descuadreC, a.volumenC);
  return {
    id: 'conciliacion-pct',
    titulo: 'Porcentaje conciliado con el gateway',
    subtitulo: 'Volumen que cuadra entre el gateway y el libro',
    unidad: porcentajeU,
    datos: { tipo: 'medidor', nombre: 'Conciliado', valor: pct, minimo: 90, maximo: 100, objetivo: 99.5 },
    resumenAccesible:
      pct === null
        ? 'Medidor de conciliación sin dato: no hay volumen en el periodo.'
        : `Medidor de ${formatearValor(pct, porcentajeU)} del volumen conciliado, con objetivo de 99,5 %. La escala va de 90 a 100 % porque los valores sanos están cerca del tope.`,
    filtro: null,
    filtroMotivo: 'Es un único indicador del periodo; no tiene categorías por las que filtrar.',
    info: info({
      definicion: 'Qué parte del dinero cobrado coincide entre lo que informa el gateway y lo que registra la plataforma.',
      formula: '(volumen − importe en descuadre) ÷ volumen × 100',
      numerador: 'Volumen conciliado (volumen − importe en descuadre)',
      denominador: 'Volumen transaccionado',
      fuente: FUENTE_CONCILIACION,
      esComision: false,
    }),
    velas: null,
    velasMotivo: 'Es un único valor del periodo; no hay serie con apertura y cierre.',
    alto: 280,
    sinDatoMotivo: 'No hubo volumen transaccionado en el periodo.',
  };
}

export function graficoDescuadres(_ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const n = m.alcance.descuadres;
  const partes = repartir(n, PESOS_DESCUADRE);
  return {
    id: 'descuadres-por-tipo',
    titulo: 'Descuadres abiertos con el gateway',
    subtitulo: 'Excepciones de conciliación sin resolver, por tipo',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: TIPOS_DESCUADRE,
      series: [{ nombre: 'Descuadres abiertos', forma: 'barra', valores: partes }],
    },
    resumenAccesible:
      n === 0
        ? 'Barras de descuadres abiertos: no hay ninguno en el periodo.'
        : `Barras horizontales: ${n} descuadres abiertos; el tipo más frecuente es «${TIPOS_DESCUADRE[0]}» con ${partes[0]}.`,
    filtro: null,
    filtroMotivo: 'Los tipos de descuadre son del equipo de conciliación y no filtran el resto del tablero.',
    info: info({
      definicion: 'Diferencias entre lo que dice el gateway y lo que dice el libro que todavía nadie resolvió.',
      formula: 'conteo de reconciliation_exceptions abiertas, por tipo',
      fuente: FUENTE_CONCILIACION,
      esComision: false,
    }),
    velas: null,
    velasMotivo: 'Es un conteo de excepciones abiertas por tipo, no una serie con apertura y cierre.',
    alto: 280,
    sinDatoMotivo: 'No hay descuadres abiertos en el periodo.',
  };
}
