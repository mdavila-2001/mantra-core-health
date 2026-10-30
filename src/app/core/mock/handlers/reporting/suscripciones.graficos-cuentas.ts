import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec, ContextoReporte, DimensionFiltro } from '../../../data-access/reporting/reporting.types';
import { agrupar, daysInPeriod, redondear, suma, candlesFromSeries } from './reporting-dataset.util';
import {
  CIUDADES,
  contextAccounts,
  distribuirEnteros,
  ESPECIALIDADES,
  withoutDimension,
  type Corte,
} from './suscripciones.cortes';
import { aMoneda, info, unidadMoneda } from './suscripciones.info';
import {
  oscilar,
  participacionPlanes,
  PLANES,
  suscriptoresAlCierre,
  type ModeloSuscripciones,
} from './suscripciones.modelo';

const NO_ACCOUNTS = 'No hay cuentas activas en este corte; quite algún filtro para ver datos.';
const MUESTRA_MINIMA = 10;

/** Cuentas por plan al cierre, sin el filtro de plan: los planes se comparan entre sí y el clic solo resalta. */
export function accountsByPlan(ctx: ContextoReporte): number[] {
  return distribuirEnteros(suscriptoresAlCierre(withoutDimension(ctx, 'plan')), participacionPlanes(1, daysInPeriod(ctx.periodo)));
}

export function graficoMixPlan(ctx: ContextoReporte): ChartSpec {
  const valores = accountsByPlan(ctx);
  const total = suma(valores);
  const mayor = valores.indexOf(Math.max(...valores));
  return {
    id: 'mix-plan',
    titulo: 'Cuentas activas por plan',
    subtitulo: 'Al cierre del periodo',
    unidad: { tipo: 'numero' },
    datos: { tipo: 'partes', forma: 'dona', partes: PLANES.map((p, i) => ({ nombre: p.nombre, valor: valores[i]! })) },
    resumenAccesible: total > 0 ? `El plan ${PLANES[mayor]!.nombre} concentra ${valores[mayor]} de las ${total} cuentas activas.` : NO_ACCOUNTS,
    filtro: { dimension: 'plan' },
    info: info({
      definicion: 'Cuentas con suscripción vigente al cierre, repartidas por plan.',
      formula: 'Cuentas del plan = suscripciones activas cuyo plan es ese',
      fuente: 'payments.subscriptions · payments.subscription_plans (tier_concept_id)',
      salvedades: ['Con un filtro de plan activo este gráfico sigue mostrando los tres planes para poder compararlos; el plan elegido queda resaltado.'],
    }),
    velas: null,
    velasMotivo: 'Es un reparto en un instante (una foto), no una serie con apertura y cierre.',
    sinDatoMotivo: NO_ACCOUNTS,
  };
}

export function graficoEmbudo(m: ModeloSuscripciones): ChartSpec {
  const e = m.embudo;
  return {
    id: 'embudo-adquisicion',
    titulo: 'Embudo: de registro a cuenta pagante',
    subtitulo: 'Doctores que avanzan en el periodo',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'partes',
      forma: 'embudo',
      partes: [
        { nombre: 'Registrados', valor: e.registros },
        { nombre: 'Verificados', valor: e.verificados },
        { nombre: 'En prueba', valor: e.enPrueba },
        { nombre: 'Pagantes', valor: e.pagantes },
      ],
    },
    resumenAccesible: e.registros > 0 ? `De ${e.registros} registros, ${e.pagantes} llegan a pagar.` : NO_ACCOUNTS,
    filtro: null,
    filtroMotivo: 'Los pasos son etapas del recorrido, no segmentos de cuentas; filtrar por una etapa no cambia al resto del informe.',
    info: info({
      definicion: 'Cuántos doctores superan cada etapa: se registran, verifican su identidad, empiezan la prueba y pagan.',
      formula: 'Cada paso cuenta los doctores que lo alcanzaron en el periodo',
      fuente: 'identity_assurance · onboarding · payments.subscriptions',
      salvedades: ['Las etapas se cuentan por fecha del evento, no por cohorte: alguien puede registrarse en un periodo y pagar en el siguiente.'],
    }),
    velas: null,
    velasMotivo: 'Un embudo cuenta personas que avanzan; no es un saldo con apertura y cierre.',
    sinDatoMotivo: NO_ACCOUNTS,
  };
}

export function graficoUso(ctx: ContextoReporte): ChartSpec {
  const cuentas = contextAccounts(ctx);
  const valor = cuentas.length >= 5 ? redondear(Math.min(100, suma(cuentas.map((c) => c.usoPct)) / cuentas.length), 1) : null;
  return {
    id: 'uso-cuota',
    titulo: 'Uso medio de la cuota del plan',
    subtitulo: 'Por encima de 85 % conviene ofrecer un plan mayor',
    unidad: { tipo: 'porcentaje' },
    datos: { tipo: 'medidor', nombre: 'Uso de la cuota', valor, minimo: 0, maximo: 100, objetivo: 85 },
    resumenAccesible: valor === null ? 'Hay menos de 5 cuentas en este corte; no se calcula el uso medio.' : `Las cuentas usan en promedio ${formatearValor(valor, { tipo: 'porcentaje' })} de su cuota; el aviso de subida de plan es 85 %.`,
    filtro: null,
    filtroMotivo: 'Es un promedio de las cuentas del corte activo; la tabla de abajo lista las candidatas a subir de plan.',
    info: info({
      definicion: 'Consumo de consultas del mes respecto de las incluidas en el plan, promediado entre cuentas.',
      formula: 'Uso = consultas del mes ÷ cuota del plan, promedio simple de las cuentas',
      numerador: 'Consultas realizadas en el mes',
      denominador: 'Consultas incluidas en el plan',
      fuente: 'payments.subscription_usage_counters · payments.plan_quotas',
      salvedades: ['Promedio de una lista de cuentas de ejemplo; una cuenta puede pasar de 100 % y el medidor se detiene en 100 %.', 'Con menos de 5 cuentas en el corte no se calcula.'],
    }),
    velas: null,
    velasMotivo: 'Es un indicador de un instante; no tiene apertura y cierre.',
    alto: 240,
    sinDatoMotivo: 'Hay menos de 5 cuentas en este corte; un promedio de tan pocas no es confiable.',
  };
}

const VENTANAS = [
  { nombre: 'Hasta 7 días', pct: 0.045 },
  { nombre: '8 a 30 días', pct: 0.17 },
  { nombre: '31 a 60 días', pct: 0.26 },
] as const;

export function renovacionesProximas(m: ModeloSuscripciones) {
  return VENTANAS.map((v) => {
    const total = Math.round(m.subsFin * v.pct);
    const automaticas = Math.round(total * 0.72);
    return { nombre: v.nombre, total, automaticas, manuales: total - automaticas };
  });
}

export function graficoRenovaciones(m: ModeloSuscripciones): ChartSpec {
  const v = renovacionesProximas(m);
  return {
    id: 'renovaciones-proximas',
    titulo: 'Renovaciones próximas',
    subtitulo: 'Suscripciones que vencen en cada ventana',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'cartesiano',
      categorias: v.map((x) => x.nombre),
      series: [
        { nombre: 'Cobro automático', valores: v.map((x) => x.automaticas), forma: 'barra', apilar: 'renovacion' },
        { nombre: 'Renovación manual', valores: v.map((x) => x.manuales), forma: 'barra', apilar: 'renovacion' },
      ],
    },
    resumenAccesible: `Vencen ${v[0]!.total} suscripciones en 7 días y ${v[0]!.total + v[1]!.total} en 30; las de renovación manual son las que más riesgo de baja tienen.`,
    filtro: null,
    filtroMotivo: 'Las ventanas son rangos de fechas por venir, no segmentos de cuentas.',
    info: info({
      definicion: 'Suscripciones cuyo periodo vigente termina dentro de la ventana, según cobren solas o dependan de que el doctor pague.',
      formula: 'Renovaciones = suscripciones activas con fecha de fin dentro de la ventana',
      fuente: 'payments.subscriptions',
      salvedades: ['Las ventanas no se superponen: «8 a 30 días» no incluye las de 7 días.'],
    }),
    velas: null,
    velasMotivo: 'Es un conteo de vencimientos futuros; no tiene apertura y cierre.',
    sinDatoMotivo: NO_ACCOUNTS,
  };
}

function graficoCorte(
  ctx: ContextoReporte,
  id: string,
  titulo: string,
  dimension: DimensionFiltro,
  cortes: readonly Corte[],
  etiqueta: string,
): ChartSpec {
  const total = suscriptoresAlCierre(withoutDimension(ctx, dimension));
  const valores = distribuirEnteros(total, cortes.map((c) => c.peso));
  return {
    id,
    titulo,
    subtitulo: 'Cuentas activas al cierre',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: cortes.map((c) => c.nombre),
      series: [{ nombre: 'Cuentas activas', valores, forma: 'barra' }],
    },
    resumenAccesible: total > 0 ? `${cortes[0]!.nombre} concentra ${valores[0]} de las ${total} cuentas activas, la mayor ${etiqueta}.` : NO_ACCOUNTS,
    filtro: { dimension },
    info: info({
      definicion: `Cuentas con suscripción vigente al cierre, según su ${etiqueta}.`,
      formula: `Cuentas de la ${etiqueta} = suscripciones activas cuyo perfil tiene esa ${etiqueta}`,
      fuente: 'payments.subscriptions · directory · profiles',
      salvedades: [`Con un filtro de ${etiqueta} activo este gráfico sigue mostrando todas para poder compararlas; la elegida queda resaltada.`],
    }),
    velas: null,
    velasMotivo: 'Es un reparto en un instante (una foto), no una serie con apertura y cierre.',
    sinDatoMotivo: NO_ACCOUNTS,
  };
}

export const graficoEspecialidad = (ctx: ContextoReporte) =>
  graficoCorte(ctx, 'cuentas-especialidad', 'Cuentas por especialidad', 'especialidad', ESPECIALIDADES, 'especialidad');

export const graficoCiudad = (ctx: ContextoReporte) =>
  graficoCorte(ctx, 'cuentas-ciudad', 'Cuentas por ciudad', 'ciudad', CIUDADES, 'ciudad');

export function graficoChurnPlan(ctx: ContextoReporte): ChartSpec {
  const unfilteredCtx = withoutDimension(ctx, 'plan');
  const cuentas = accountsByPlan(ctx);
  const base = [3.4, 2.1, 0.9];
  const valores = PLANES.map((p, i) =>
    cuentas[i]! >= MUESTRA_MINIMA ? redondear(base[i]! * oscilar(unfilteredCtx, `churn-${p.nombre}`, 0.12), 1) : null,
  );
  return {
    id: 'churn-plan',
    titulo: 'Churn mensual por plan',
    subtitulo: 'Los planes más baratos pierden más cuentas',
    unidad: { tipo: 'porcentaje' },
    datos: { tipo: 'cartesiano', categorias: PLANES.map((p) => p.nombre), series: [{ nombre: 'Churn mensual', valores, forma: 'barra' }] },
    resumenAccesible: 'El plan Esencial tiene el churn más alto y el plan Clínica el más bajo.',
    filtro: { dimension: 'plan' },
    info: info({
      definicion: 'Porcentaje de las cuentas de cada plan que dejan de pagar en un mes.',
      formula: 'Churn del plan = bajas del plan en el mes ÷ cuentas del plan al inicio del mes',
      numerador: 'Bajas del plan en el mes',
      denominador: 'Cuentas del plan al inicio del mes',
      fuente: 'payments.subscriptions_history',
      salvedades: [`Un plan con menos de ${MUESTRA_MINIMA} cuentas en este corte sale sin dato.`],
    }),
    velas: null,
    velasMotivo: 'Son planes comparados entre sí en un mismo corte; no hay serie de tiempo con apertura y cierre.',
    sinDatoMotivo: `Ningún plan llega a ${MUESTRA_MINIMA} cuentas con estos filtros.`,
  };
}

export function graficoSaldoMora(m: ModeloSuscripciones, ctx: ContextoReporte): ChartSpec {
  const mon = aMoneda(ctx);
  const diario = m.mora.saldo.map(mon);
  const { etiquetas, valores } = agrupar(m.fechas, diario, m.gran, 'ultimo');
  const unidad = unidadMoneda(ctx);
  return {
    id: 'saldo-mora',
    titulo: 'Saldo en mora',
    subtitulo: 'Cobros de los últimos 30 días que siguen sin pagarse; subir es malo',
    unidad,
    datos: { tipo: 'cartesiano', categorias: etiquetas, series: [{ nombre: 'Saldo en mora', valores, forma: 'linea' }] },
    resumenAccesible: `El saldo en mora cierra en ${formatearValor(diario[diario.length - 1], unidad)}, frente a ${formatearValor(diario[0], unidad)} al inicio.`,
    filtro: null,
    filtroMotivo: 'Es el saldo total en el tiempo; el detalle por cuenta se ve en cobranza, no aquí.',
    info: info({
      definicion: 'Importe de cobros fallidos de los últimos 30 días que todavía no se recuperó.',
      formula: 'Saldo = Σ (cobros fallidos − recuperados) de los últimos 30 días',
      fuente: 'payments.payment_debts · payments.payment_intents',
      salvedades: ['Lo que supera 30 días pasa a cobranza externa y sale de este saldo.'],
    }),
    velas: {
      explicacion: 'Saldo en mora del tramo: apertura, máximo, mínimo y cierre. Una vela que sube es peor.',
      velas: candlesFromSeries(m.fechas, diario, m.gran),
      subirEsMalo: true,
    },
    sinDatoMotivo: NO_ACCOUNTS,
  };
}

export function graficoMoraFlujo(m: ModeloSuscripciones, ctx: ContextoReporte): ChartSpec {
  const mon = aMoneda(ctx);
  const newFailures = agrupar(m.fechas, m.mora.newFailures.map(mon), m.gran, 'suma');
  const recuperada = agrupar(m.fechas, m.mora.recuperada.map(mon), m.gran, 'suma');
  const unidad = unidadMoneda(ctx);
  const pct = m.mora.fallidos > 0 ? redondear((m.mora.recuperados / m.mora.fallidos) * 100, 1) : null;
  return {
    id: 'mora-recuperacion',
    titulo: 'Cobros fallidos y recuperados',
    subtitulo: 'Lo recuperado es lo que se cobró tras el reintento',
    unidad,
    datos: {
      tipo: 'cartesiano',
      categorias: newFailures.etiquetas,
      series: [
        { nombre: 'Cobros fallidos', valores: newFailures.valores.map((v) => redondear(v)), forma: 'barra' },
        { nombre: 'Recuperados tras reintento', valores: recuperada.valores.map((v) => redondear(v)), forma: 'barra' },
      ],
    },
    resumenAccesible: pct === null ? 'No hubo cobros fallidos en el periodo.' : `Se recuperó ${formatearValor(pct, { tipo: 'porcentaje' })} de los cobros fallidos tras el reintento.`,
    filtro: null,
    filtroMotivo: 'Son flujos del total de la base, por tramo de tiempo; no hay un segmento que tocar.',
    info: info({
      definicion: 'Cobros de suscripción que fallaron y cuánto de eso se cobró después del reintento automático.',
      formula: 'Recuperación = cobrado tras reintento ÷ cobros fallidos',
      numerador: 'Importe cobrado tras el reintento',
      denominador: 'Importe de cobros fallidos',
      fuente: 'payments.payment_intents · payments.payment_debts',
      salvedades: ['Lo recuperado se atribuye al periodo en que falló el cobro, no al día del reintento.'],
    }),
    velas: null,
    velasMotivo: 'Son flujos que se suman por tramo; las velas son para saldos (el saldo en mora ya las tiene).',
    sinDatoMotivo: NO_ACCOUNTS,
  };
}
