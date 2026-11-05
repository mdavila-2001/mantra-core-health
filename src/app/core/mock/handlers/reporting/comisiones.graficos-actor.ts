import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec, ContextoReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { FUENTE_COMISIONES, info } from './comisiones.info';
import { aMonto, ACTORES, NO_SCHEME_REASON, repartir, type FilaActor, type ModeloComisiones } from './comisiones.modelo';
import { ANCHOR_DATE, hashTexto, redondear, rng } from './reporting-dataset.util';

/* Gráficos «Por actor». Estos gráficos muestran SIEMPRE a todos los actores: el actor
   elegido por el filtro se resalta (`seleccion`) y mueve el resto del tablero, pero no
   borra a los demás de su propio gráfico. */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const NOMBRES = ACTORES.map((a) => a.nombre);
const NO_CANDLES_FLOW = 'Es un flujo acumulado del periodo (se suma), no un saldo con apertura y cierre.';

function moneda(ctx: ContextoReporte): UnidadValor {
  return { tipo: 'moneda', moneda: ctx.moneda };
}

function withData(filas: readonly FilaActor[], campo: (f: FilaActor) => number | null): FilaActor | null {
  let mejor: FilaActor | null = null;
  for (const f of filas) {
    const v = campo(f);
    if (v !== null && (mejor === null || v > (campo(mejor) ?? -1))) {
      mejor = f;
    }
  }
  return mejor;
}

export function byActorChart(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const unidad = moneda(ctx);
  const lider = withData(m.filas, (f) => f.devengadaC);
  const pendiente = withData(m.filas, (f) => f.pendienteC);
  return {
    id: 'comision-por-actor',
    titulo: 'Comisión devengada, liquidada y pendiente por actor',
    subtitulo: 'Liquidada + pendiente = devengada',
    unidad,
    datos: {
      tipo: 'cartesiano',
      categorias: NOMBRES,
      series: [
        { nombre: 'Liquidada', forma: 'barra', apilar: 'devengada', valores: m.filas.map((f) => aMonto(f.liquidadaC)) },
        { nombre: 'Pendiente', forma: 'barra', apilar: 'devengada', valores: m.filas.map((f) => aMonto(f.pendienteC)) },
      ],
    },
    resumenAccesible:
      `Barras apiladas por actor, en ${ctx.moneda}: lo liquidado y lo pendiente suman lo devengado. ` +
      (lider === null
        ? 'Ningún actor tiene comisión calculada.'
        : `${lider.actor.nombre} devenga más: ${formatearValor(aMonto(lider.devengadaC), unidad)}; ` +
          `lo pendiente se concentra en ${pendiente?.actor.nombre ?? 'ningún actor'}. `) +
      'El Visitador médico sale sin dato porque su esquema de comisión no está definido.',
    filtro: { dimension: 'actor' },
    info: info({
      definicion: 'Comisión que le corresponde a cada actor en el periodo, partida en lo ya liquidado y lo que sigue pendiente.',
      formula: 'devengada = liquidada + pendiente, por actor',
      fuente: FUENTE_COMISIONES,
    }),
    velas: null,
    velasMotivo: NO_CANDLES_FLOW,
    alto: 320,
    ancho: 'completo',
    sinDatoMotivo: NO_SCHEME_REASON,
  };
}

export function graficoRetenciones(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const unidad = moneda(ctx);
  const mayor = withData(m.filas, (f) => f.retenidoC);
  return {
    id: 'retenciones-contracargos',
    titulo: 'Retenciones y contracargos por actor',
    subtitulo: 'Lo retenido es parte de lo pendiente',
    unidad,
    datos: {
      tipo: 'cartesiano',
      categorias: NOMBRES,
      series: [
        { nombre: 'Retenido por disputas abiertas', forma: 'barra', valores: m.filas.map((f) => aMonto(f.retenidoC)) },
        { nombre: 'Contracargos perdidos', forma: 'barra', valores: m.filas.map((f) => aMonto(f.contracargosC)) },
      ],
    },
    resumenAccesible:
      `Barras agrupadas por actor, en ${ctx.moneda}: lo retenido por disputas abiertas y lo perdido por contracargos. ` +
      (mayor === null
        ? 'Sin dato en ningún actor.'
        : `${mayor.actor.nombre} tiene más comisión retenida: ${formatearValor(aMonto(mayor.retenidoC), unidad)}.`),
    filtro: { dimension: 'actor' },
    info: info({
      definicion: 'Comisión que no se paga todavía por una disputa abierta, y comisión revertida por contracargos o reembolsos perdidos.',
      formula: 'retenido = parte de la comisión pendiente con disputa abierta · contracargos = comisión revertida en el periodo',
      fuente: 'payments.payment_disputes, payments.refunds, payments.payouts',
      salvedades: ['Lo retenido NO se suma a lo pendiente: ya está dentro de él.'],
    }),
    velas: null,
    velasMotivo: 'Son importes del periodo por actor, no una serie de saldo con apertura y cierre.',
    alto: 300,
    sinDatoMotivo: NO_SCHEME_REASON,
  };
}

export function graficoProductividad(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const unidad = moneda(ctx);
  const valores = m.filas.map((f) =>
    f.devengadaC === null ? null : redondear(f.devengadaC / 100 / f.clientes, 2),
  );
  // Ranking: de mayor a menor, los «sin dato» al final. El orden no cambia el color: la serie es una.
  const orden = m.filas
    .map((f, i) => ({ nombre: f.actor.nombre, v: valores[i] ?? null }))
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  const mejor = orden[0];
  return {
    id: 'productividad-actor',
    titulo: 'Productividad: comisión por cliente activo',
    subtitulo: `Comisión devengada ÷ clientes activos, en ${ctx.moneda}`,
    unidad,
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: orden.map((o) => o.nombre),
      series: [{ nombre: 'Comisión por cliente activo', forma: 'barra', valores: orden.map((o) => o.v) }],
    },
    resumenAccesible:
      mejor?.v == null
        ? 'Barras horizontales: sin dato de productividad.'
        : `Barras horizontales ordenadas de mayor a menor. ${mejor.nombre} rinde más por cliente: ${formatearValor(mejor.v, unidad)}. ` +
          'El Visitador médico sale sin dato por no tener esquema de comisión.',
    filtro: { dimension: 'actor' },
    info: info({
      definicion: 'Cuánta comisión genera, en promedio, cada cliente activo de un actor.',
      formula: 'comisión devengada ÷ clientes activos del actor',
      numerador: 'Comisión devengada del actor en el periodo',
      denominador: 'Clientes activos del actor en el periodo',
      fuente: `${FUENTE_COMISIONES}, directory`,
      salvedades: ['Los clientes activos son un conteo de EJEMPLO por actor.'],
    }),
    velas: null,
    velasMotivo: 'Es una comparación entre actores en el periodo, no una serie en el tiempo.',
    alto: 300,
    sinDatoMotivo: NO_SCHEME_REASON,
  };
}

/** Meses que cubre el periodo, de más viejo a más nuevo (máximo 12). */
function periodMonths(dias: number): string[] {
  const n = Math.min(12, Math.max(1, Math.ceil(dias / 30)));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(ANCHOR_DATE.getUTCFullYear(), ANCHOR_DATE.getUTCMonth() - (n - 1 - i), 1));
    return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  });
}

export function graficoMapaCalor(ctx: ContextoReporte, m: ModeloComisiones): ChartSpec {
  const unidad = moneda(ctx);
  const columnas = periodMonths(m.dias);
  const celdas: (readonly [number, number, number | null])[] = [];
  m.filas.forEach((f, fila) => {
    if (f.liquidadaC === null) {
      columnas.forEach((_, col) => celdas.push([col, fila, null]));
      return;
    }
    const r = rng(hashTexto(`${f.actor.nombre}:${columnas.length}`));
    // Más peso a los meses recientes: el reparto de comisiones crece con la base.
    const pesos = columnas.map((_, i) => (1 + 0.05 * i) * (0.9 + 0.2 * r()));
    repartir(f.liquidadaC, pesos).forEach((c, col) => celdas.push([col, fila, c / 100]));
  });
  return {
    id: 'liquidado-actor-mes',
    titulo: 'Monto liquidado por actor y mes',
    subtitulo: `En ${ctx.moneda}; la suma de los meses es la comisión liquidada del actor`,
    unidad,
    datos: { tipo: 'mapa-calor', filas: NOMBRES, columnas, celdas, nombreValor: 'Monto liquidado' },
    resumenAccesible:
      `Mapa de calor de actor por mes con el monto liquidado en ${ctx.moneda}: cuanto más oscura la celda, más se liquidó. ` +
      'Las celdas del Visitador médico quedan sin dato porque no tiene esquema de comisión.',
    filtro: { dimension: 'actor' },
    info: info({
      definicion: 'Comisión efectivamente liquidada a cada actor, mes a mes.',
      formula: 'suma de payout_items liquidados por actor y mes de liquidación',
      fuente: FUENTE_COMISIONES,
      salvedades: ['El reparto entre meses es de EJEMPLO; sólo el total por actor coincide con la comisión liquidada.'],
    }),
    velas: null,
    velasMotivo: 'Es un monto liquidado por casilla (actor × mes), no una serie con apertura y cierre.',
    alto: 300,
    ancho: 'completo',
    sinDatoMotivo: NO_SCHEME_REASON,
  };
}
