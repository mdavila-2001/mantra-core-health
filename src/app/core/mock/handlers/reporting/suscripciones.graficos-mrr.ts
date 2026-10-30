import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec, ContextoReporte } from '../../../data-access/reporting/reporting.types';
import { agrupar, ANCHOR_DATE, factorContexto, redondear, rng, suma, candlesFromSeries } from './reporting-dataset.util';
import { aMoneda, info, unidadMoneda } from './suscripciones.info';
import { PLANES, seedOf, type ModeloSuscripciones } from './suscripciones.modelo';

const NO_DATA_REASON = 'No hay cuentas activas en este corte: sin cuentas no hay MRR ni movimientos que mostrar.';
const FUENTE_SUSC = 'payments.subscriptions · payments.plan_prices';
const FUENTE_HIST = 'payments.subscriptions_history';

/** Ingreso reconocido por plan y por cubo, ya en la moneda del contexto; lo comparten el gráfico y la tarjeta. */
export function revenueByPlan(m: ModeloSuscripciones, ctx: ContextoReporte) {
  const mon = aMoneda(ctx);
  const series = m.ingresoPlan.map((dia) => agrupar(m.fechas, dia.map(mon), m.gran, 'suma'));
  return { etiquetas: series[0]!.etiquetas, series: series.map((s) => s.valores.map((v) => redondear(v))) };
}

export function graficoMrr(m: ModeloSuscripciones, ctx: ContextoReporte): ChartSpec {
  const mon = aMoneda(ctx);
  const diario = m.mrr.map(mon);
  const { etiquetas, valores } = agrupar(m.fechas, diario, m.gran, 'ultimo');
  const unidad = unidadMoneda(ctx);
  return {
    id: 'mrr-evolucion',
    titulo: 'Ingreso mensual recurrente (MRR)',
    subtitulo: 'Saldo de MRR al cierre de cada corte',
    unidad,
    ancho: 'completo',
    datos: { tipo: 'cartesiano', categorias: etiquetas, series: [{ nombre: 'MRR', valores, forma: 'linea' }] },
    resumenAccesible: `El MRR pasó de ${formatearValor(diario[0], unidad)} a ${formatearValor(diario[diario.length - 1], unidad)} en el periodo.`,
    filtro: null,
    filtroMotivo: 'Es una serie en el tiempo: tocar un día no separa cuentas. Para cortar por plan, especialidad o ciudad use los gráficos de «Cortes».',
    info: info({
      definicion: 'Ingreso mensual que generan las suscripciones activas, normalizado a un mes.',
      formula: 'MRR = Σ (precio mensual del plan × cuentas activas de ese plan)',
      fuente: FUENTE_SUSC,
      salvedades: ['Un plan anual se divide en 12; los descuentos y cupones no están modelados.', 'La vela resume el MRR de cada tramo: apertura, mínimo, máximo y cierre.'],
    }),
    velas: {
      explicacion: 'MRR del tramo: apertura (primer día), máximo, mínimo y cierre (último día).',
      velas: candlesFromSeries(m.fechas, diario, m.gran),
    },
    sinDatoMotivo: NO_DATA_REASON,
  };
}

export function graficoCascada(m: ModeloSuscripciones, ctx: ContextoReporte): ChartSpec {
  const mon = aMoneda(ctx);
  const c = m.mrrComp;
  const unidad = unidadMoneda(ctx);
  return {
    id: 'cascada-mrr',
    titulo: 'De dónde viene el cambio del MRR',
    subtitulo: 'MRR inicial + nuevas + expansión − contracción − bajas = MRR final',
    unidad,
    datos: {
      tipo: 'cascada',
      pasos: [
        { nombre: 'MRR inicial', valor: mon(c.inicial), total: true },
        { nombre: 'Cuentas nuevas', valor: mon(c.newMrr) },
        { nombre: 'Expansión', valor: mon(c.expansion) },
        { nombre: 'Contracción', valor: -mon(c.contraccion) },
        { nombre: 'Bajas', valor: -mon(c.bajas) },
        { nombre: 'MRR final', valor: mon(c.final), total: true },
      ],
    },
    resumenAccesible: `Las cuentas nuevas aportan ${formatearValor(mon(c.newMrr), unidad)} y las bajas restan ${formatearValor(mon(c.bajas), unidad)}; el MRR termina en ${formatearValor(mon(c.final), unidad)}.`,
    filtro: null,
    filtroMotivo: 'Cada barra es un concepto del puente, no un segmento de cuentas; no hay nada que filtrar.',
    info: info({
      definicion: 'Puente que explica el cambio del MRR entre el inicio y el cierre del periodo.',
      formula: 'MRR final = MRR inicial + nuevas + expansión − contracción − bajas',
      fuente: FUENTE_HIST,
      salvedades: ['La expansión y la contracción son cambios de plan (subir o bajar) de cuentas que siguen activas.', 'Cualquier diferencia de redondeo se absorbe en «Cuentas nuevas» o «Contracción».'],
    }),
    velas: null,
    velasMotivo: 'Es un puente entre dos fechas, no una serie con apertura y cierre.',
    sinDatoMotivo: NO_DATA_REASON,
  };
}

export function graficoIngresoPlan(m: ModeloSuscripciones, ctx: ContextoReporte): ChartSpec {
  const { etiquetas, series } = revenueByPlan(m, ctx);
  const unidad = unidadMoneda(ctx);
  const total = suma(series.flat());
  return {
    id: 'ingreso-plan',
    titulo: 'Ingreso reconocido de suscripciones por plan',
    subtitulo: 'Cada corte suma lo devengado en sus días',
    unidad,
    ancho: 'completo',
    datos: {
      tipo: 'cartesiano',
      categorias: etiquetas,
      series: PLANES.map((p, i) => ({ nombre: p.nombre, valores: series[i]!, forma: 'barra', apilar: 'ingreso' })),
    },
    resumenAccesible: `Las suscripciones reconocieron ${formatearValor(total, unidad)} en el periodo, repartidos entre los tres planes.`,
    filtro: { dimension: 'plan' },
    info: info({
      definicion: 'Ingreso de suscripciones que corresponde al periodo, repartido por plan.',
      formula: 'Ingreso = Σ días (MRR del día ÷ 30)',
      fuente: `${FUENTE_SUSC} · accounting (mayor)`,
      salvedades: ['Es ingreso devengado, no caja: un cobro atrasado no aparece aquí hasta reconocerse.'],
    }),
    velas: null,
    velasMotivo: 'Es un flujo que se suma por tramo; las velas son para saldos y razones.',
    sinDatoMotivo: NO_DATA_REASON,
  };
}

export function graficoMovimiento(m: ModeloSuscripciones): ChartSpec {
  const altas = agrupar(m.fechas, m.altas as number[], m.gran, 'suma');
  const bajas = agrupar(m.fechas, m.bajas as number[], m.gran, 'suma');
  const netas = altas.valores.map((v, i) => v - bajas.valores[i]!);
  return {
    id: 'movimiento-cuentas',
    titulo: 'Altas, bajas y cuentas netas',
    subtitulo: 'Las bajas se dibujan hacia abajo',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'cartesiano',
      categorias: altas.etiquetas,
      series: [
        { nombre: 'Altas', valores: altas.valores, forma: 'barra', apilar: 'movimiento' },
        { nombre: 'Bajas', valores: bajas.valores.map((v) => -v), forma: 'barra', apilar: 'movimiento' },
        { nombre: 'Netas', valores: netas, forma: 'linea' },
      ],
    },
    resumenAccesible: `Hubo ${m.altasTotal} altas y ${m.bajasTotal} bajas: ${m.altasTotal - m.bajasTotal >= 0 ? 'crece' : 'se reduce'} la base en ${Math.abs(m.altasTotal - m.bajasTotal)} cuentas.`,
    filtro: null,
    filtroMotivo: 'Cada corte es un tramo de tiempo, no un segmento. Para ver altas por plan use el corte por plan.',
    info: info({
      definicion: 'Cuentas que empiezan y dejan de pagar, y su diferencia.',
      formula: 'Netas = altas − bajas',
      fuente: FUENTE_HIST,
      salvedades: ['Una baja es una suscripción que dejó de estar vigente, no una cancelación solicitada.'],
    }),
    velas: null,
    velasMotivo: 'Son altas y bajas que se suman por tramo; no son un saldo con apertura y cierre.',
    sinDatoMotivo: NO_DATA_REASON,
  };
}

export function graficoChurn(m: ModeloSuscripciones): ChartSpec {
  const { etiquetas, valores } = agrupar(m.fechas, m.churnDia as number[], m.gran, 'promedio');
  return {
    id: 'churn-cuentas-velas',
    titulo: 'Churn mensual de cuentas',
    subtitulo: 'Tasa móvil de 30 días; subir es malo',
    unidad: { tipo: 'porcentaje' },
    datos: {
      tipo: 'cartesiano',
      categorias: etiquetas,
      series: [{ nombre: 'Churn mensual', valores: valores.map((v) => redondear(v)), forma: 'linea' }],
    },
    resumenAccesible: `El churn mensual ronda ${formatearValor(m.churnMensualPct, { tipo: 'porcentaje' })}; cada punto es la tasa de bajas de los 30 días previos.`,
    filtro: null,
    filtroMotivo: 'La serie es del total de la base. El churn por plan está en el gráfico de al lado y ese sí filtra.',
    info: info({
      definicion: 'Porcentaje de las cuentas activas al inicio de la ventana que dejaron de pagar durante ella.',
      formula: 'Churn = bajas de la ventana ÷ cuentas activas al inicio de la ventana',
      numerador: 'Cuentas dadas de baja en los 30 días previos',
      denominador: 'Cuentas activas al inicio de esos 30 días',
      fuente: FUENTE_HIST,
      salvedades: ['Con pocas cuentas la tasa salta mucho de un día a otro.'],
    }),
    velas: {
      explicacion: 'Churn móvil del tramo: apertura, máximo, mínimo y cierre. Una vela que sube es peor.',
      velas: candlesFromSeries(m.fechas, m.churnDia, m.gran),
      subirEsMalo: true,
    },
    sinDatoMotivo: NO_DATA_REASON,
  };
}

const MESES_COHORTE = { '7d': 6, '30d': 6, '90d': 8, ytd: 10, '12m': 12 } as const;
const MUESTRA_MINIMA_COHORTE = 10;

export function graficoCohortes(m: ModeloSuscripciones, ctx: ContextoReporte): ChartSpec {
  const cohortes = MESES_COHORTE[ctx.periodo];
  const f = factorContexto(ctx);
  const filas = Array.from({ length: cohortes }, (_, c) =>
    new Date(Date.UTC(ANCHOR_DATE.getUTCFullYear(), ANCHOR_DATE.getUTCMonth() - (cohortes - 1 - c), 1)).toISOString().slice(0, 7),
  );
  const columnas = Array.from({ length: cohortes }, (_, k) => `Mes ${k}`);
  const celdas: [number, number, number | null][] = [];
  filas.forEach((_, c) => {
    const edad = cohortes - 1 - c;
    const tamano = Math.round(62 * f * (0.85 + 0.03 * c));
    const r = rng(seedOf(ctx) + c * 7919);
    let ret = 100;
    for (let k = 0; k < cohortes; k++) {
      if (k > edad || tamano < MUESTRA_MINIMA_COHORTE) {
        celdas.push([k, c, null]);
        continue;
      }
      if (k > 0) {
        const baja = (m.churnMensualPct / 100) * (k === 1 ? 4 : 1.2) * (0.85 + 0.3 * r());
        ret = Math.min(ret, ret * (1 - baja));
      }
      celdas.push([k, c, redondear(ret, 1)]);
    }
  });
  return {
    id: 'retencion-cohortes',
    titulo: 'Retención por mes de alta',
    subtitulo: 'Cada fila es el mes en que se dieron de alta; cada columna, los meses que llevan pagando',
    unidad: { tipo: 'porcentaje' },
    ancho: 'completo',
    datos: { tipo: 'mapa-calor', filas, columnas, celdas, nombreValor: 'Retención' },
    resumenAccesible: 'El mayor descenso de cada cohorte ocurre en el primer mes y después la curva se estabiliza; los meses que todavía no ocurrieron quedan sin dato.',
    filtro: null,
    filtroMotivo: 'Una celda es una cohorte a una edad, no un segmento de cuentas; filtrarla no tendría efecto en el resto del informe.',
    info: info({
      definicion: 'De las cuentas que se dieron de alta en un mes, qué porcentaje sigue pagando N meses después.',
      formula: 'Retención del mes N = cuentas de la cohorte que siguen activas en el mes N ÷ cuentas de la cohorte',
      numerador: 'Cuentas de la cohorte activas al mes N',
      denominador: 'Cuentas dadas de alta en el mes de la cohorte',
      fuente: FUENTE_HIST,
      salvedades: [
        'Los meses que aún no ocurrieron para una cohorte salen sin dato (no son 0 %).',
        `Una cohorte con menos de ${MUESTRA_MINIMA_COHORTE} cuentas en este corte se muestra sin dato: con tan pocas, el porcentaje engaña.`,
      ],
    }),
    velas: null,
    velasMotivo: 'Es una matriz de cohortes; no es una serie con apertura y cierre.',
    sinDatoMotivo: `Ninguna cohorte llega a ${MUESTRA_MINIMA_COHORTE} cuentas con estos filtros; quite alguno para ver la retención.`,
  };
}
