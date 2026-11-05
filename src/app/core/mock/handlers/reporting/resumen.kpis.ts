import type { KpiSpec, PestanaReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { redondear, variacionPct } from './reporting-dataset.util';
import {
  VERTICAL_NAME,
  ORDEN,
  previousValue,
  buscarKpi,
  importeEnMoneda,
  infoEjemplo,
  incomeSeries,
  type BaseResumen,
  type ClaveVertical,
} from './resumen.base';
import { computeConcentration } from './resumen.concentracion';

const FUENTE_INGRESO =
  'Composición de las tres pestañas: suscripciones (payments.subscriptions), publicidad (ads.ad_accounts, ads.ad_invoices) y comisiones (broker_commission_statements, payment_splits); el total contable saldría del mayor (accounting).';

const SOURCE_BY_VERTICAL: Readonly<Record<ClaveVertical, string>> = {
  suscripciones: 'payments.subscriptions, payments.plan_prices',
  publicidad: 'ads.ad_accounts, ads.ad_invoices',
  comisiones: 'broker_commission_statements, payment_splits, fee_schedules',
};

/** Una vertical que no entregó el dato: el KPI queda «sin dato» con la causa, nunca en 0. */
function noData(
  id: string,
  titulo: string,
  unidad: UnidadValor,
  motivo: string,
  extra: Partial<KpiSpec> = {},
): KpiSpec {
  return {
    id,
    titulo,
    valor: null,
    unidad,
    variacionPct: null,
    motivoSinDato: motivo,
    info: null,
    infoMotivo: 'Sin dato: la fórmula se muestra cuando el KPI tiene valor.',
    ...extra,
  };
}

function incomeByVertical(base: BaseResumen, c: ClaveVertical): KpiSpec {
  const l = base.lecturas[c];
  const unidad: UnidadValor = { tipo: 'moneda', moneda: base.ctx.moneda };
  const id = `ingreso-${c}`;
  const titulo = `Ingreso de ${l.nombre.toLowerCase()}`;
  if (l.ingreso === null) {
    return noData(id, titulo, unidad, l.motivo ?? `Falta el ingreso de ${l.nombre}.`);
  }
  return {
    id,
    titulo,
    valor: l.ingreso,
    unidad,
    variacionPct: l.variacionPct,
    tendencia: incomeSeries(base).porVertical[c],
    info: infoEjemplo({
      definicion: `Ingreso reconocido de la vertical ${l.nombre.toLowerCase()} en el periodo.`,
      formula: `Es el KPI «ingreso del periodo» de la pestaña ${l.nombre}, sin recalcular.`,
      fuente: SOURCE_BY_VERTICAL[c],
      salvedades: ['Coincide con la pestaña de la vertical porque se lee de ella.'],
    }),
  };
}

export function construirKpis(base: BaseResumen): KpiSpec[] {
  const { ctx, lecturas, total, anterior, motivoTotal: totalReason } = base;
  const dinero: UnidadValor = { tipo: 'moneda', moneda: ctx.moneda };
  const generalReason = totalReason ?? 'Falta el ingreso total.';
  const susc = lecturas.suscripciones.pestana;
  const pub = lecturas.publicidad.pestana;
  const com = lecturas.comisiones.pestana;
  const out: KpiSpec[] = [];

  /* Ingreso total */
  out.push(
    total === null
      ? noData('ingreso-total', 'Ingreso total', dinero, generalReason)
      : {
          id: 'ingreso-total',
          titulo: 'Ingreso total',
          valor: total,
          unidad: dinero,
          variacionPct: variacionPct(total, anterior),
          tendencia: incomeSeries(base).total,
          info: infoEjemplo({
            definicion: 'Ingreso reconocido en el periodo por las tres verticales, en una sola moneda.',
            formula: 'Suscripciones + Publicidad + Comisiones (take rate de la plataforma)',
            fuente: FUENTE_INGRESO,
            salvedades: [
              'Sólo existe si las tres verticales tienen dato y están en la moneda elegida.',
              'No se convierten monedas: BOB y USD no se suman.',
            ],
          }),
        },
  );
  for (const c of ORDEN) {
    out.push(incomeByVertical(base, c));
  }

  /* Mix de ingreso: peso del ingreso recurrente (suscripciones) sobre el total */
  const s = lecturas.suscripciones;
  const pesoActual = total !== null && s.ingreso !== null ? redondear((s.ingreso / total) * 100, 1) : null;
  const pesoPrevio =
    anterior !== null && s.anterior !== null && anterior > 0 ? (s.anterior / anterior) * 100 : null;
  out.push(
    pesoActual === null
      ? noData('mix-ingreso', 'Ingreso recurrente sobre el total', { tipo: 'porcentaje' }, generalReason)
      : {
          id: 'mix-ingreso',
          titulo: 'Ingreso recurrente sobre el total',
          valor: pesoActual,
          unidad: { tipo: 'porcentaje' },
          variacionPct: variacionPct(pesoActual, pesoPrevio),
          numerador: s.ingreso,
          unidadNumerador: dinero,
          unidadDenominador: dinero,
          denominador: total,
          info: infoEjemplo({
            definicion: 'Qué parte del ingreso viene de suscripciones, que se repiten cada mes, y no de publicidad o comisiones.',
            formula: 'Ingreso de suscripciones ÷ Ingreso total × 100',
            numerador: 'Ingreso de suscripciones del periodo',
            denominador: 'Ingreso total del periodo',
            fuente: FUENTE_INGRESO,
            salvedades: ['La variación compara el peso entre periodos, no los importes.'],
          }),
        },
  );

  /* MRR */
  const kMrr = buscarKpi(susc, 'mrr');
  const mrr = importeEnMoneda(kMrr, ctx, 'el MRR de suscripciones');
  out.push(
    mrr.valor === null
      ? noData('mrr', 'MRR de suscripciones', dinero, mrr.motivo ?? 'Falta el MRR.')
      : {
          id: 'mrr',
          titulo: 'MRR de suscripciones',
          valor: mrr.valor,
          unidad: dinero,
          variacionPct: kMrr?.variacionPct ?? null,
          tendencia: kMrr?.tendencia,
          info: infoEjemplo({
            definicion: 'Ingreso mensual recurrente: el precio mensual de todas las suscripciones vigentes al cierre.',
            formula: 'Σ precio normalizado a mes de las suscripciones activas',
            fuente: SOURCE_BY_VERTICAL.suscripciones,
            salvedades: ['Es un saldo al cierre, no un flujo: no se suma entre periodos.'],
          }),
        },
  );

  /* Clientes activos: doctores con suscripción vigente + anunciantes con gasto */
  const kS = buscarKpi(susc, 'suscriptores-activos');
  const kA = buscarKpi(pub, 'anunciantes-activos');
  const nS = kS?.valor ?? null;
  const nA = kA?.valor ?? null;
  if (nS === null || nA === null) {
    const reason = nS === null ? 'Falta el número de suscriptores activos.' : 'Falta el número de anunciantes activos.';
    out.push(noData('clientes-activos', 'Clientes activos pagantes', { tipo: 'numero' }, reason));
  } else {
    const valor = nS + nA;
    const prevS = previousValue(nS, kS?.variacionPct ?? null, ctx);
    const prevA = previousValue(nA, kA?.variacionPct ?? null, ctx);
    out.push({
      id: 'clientes-activos',
      titulo: 'Clientes activos pagantes',
      valor,
      unidad: { tipo: 'numero' },
      variacionPct: prevS !== null && prevA !== null ? variacionPct(valor, prevS + prevA) : null,
      info: infoEjemplo({
        definicion: 'Doctores con suscripción vigente más anunciantes con gasto en el periodo.',
        formula: 'Suscriptores activos + Anunciantes activos',
        fuente: 'payments.subscriptions, ads.ad_accounts',
        salvedades: ['Una misma organización puede contar como doctor y como anunciante; aquí se cuentan por separado.'],
      }),
    });
  }

  /* Concentración */
  const conc = computeConcentration(base);
  out.push(
    conc === null || total === null
      ? noData('concentracion-top10', 'Concentración en los 10 mayores', { tipo: 'porcentaje' }, generalReason, { subirEsMalo: true })
      : {
          id: 'concentracion-top10',
          titulo: 'Concentración en los 10 mayores',
          valor: conc.pct,
          unidad: { tipo: 'porcentaje' },
          variacionPct: null,
          subirEsMalo: true,
          numerador: conc.top10,
          unidadNumerador: dinero,
          unidadDenominador: dinero,
          denominador: total,
          info: infoEjemplo({
            definicion: 'Qué parte del ingreso depende de sólo diez clientes; a más concentración, más riesgo si uno se va.',
            formula: 'Ingreso de los 10 mayores clientes ÷ Ingreso total × 100',
            numerador: 'Ingreso de los 10 mayores clientes',
            denominador: 'Ingreso total',
            fuente: FUENTE_INGRESO,
            salvedades: ['El reparto entre clientes es inventado; el total sí sale de la composición.'],
          }),
        },
  );

  /* Take rate, ROAS y comisión pendiente: se pasan tal cual desde su pestaña */
  out.push(pasar(com, 'take-rate', 'Take rate de la plataforma', { tipo: 'porcentaje' }, 'comisiones'));
  out.push(pasar(com, 'comision-pendiente', 'Comisión pendiente de pago', dinero, 'comisiones', true));
  out.push(pasar(pub, 'roas', 'ROAS de publicidad', { tipo: 'razon', sufijo: '×' }, 'publicidad'));
  return out;
}

function pasar(
  p: PestanaReporte,
  id: string,
  titulo: string,
  unidadPorDefecto: UnidadValor,
  vertical: ClaveVertical,
  subirEsMalo = false,
): KpiSpec {
  const k = buscarKpi(p, id);
  if (k === undefined) {
    return noData(id, titulo, unidadPorDefecto, `Falta ${titulo.toLowerCase()} en la pestaña ${VERTICAL_NAME[vertical]}.`, { subirEsMalo });
  }
  if (k.valor === null) {
    return { ...k, titulo, subirEsMalo: subirEsMalo || k.subirEsMalo };
  }
  return {
    ...k,
    titulo,
    subirEsMalo: subirEsMalo || k.subirEsMalo,
    info: infoEjemplo({
      definicion: `${titulo}, tal como lo calcula la pestaña ${VERTICAL_NAME[vertical]}.`,
      formula: k.info?.formula ?? `Se lee del KPI «${id}» de ${VERTICAL_NAME[vertical]}.`,
      numerador: k.info?.numerador,
      denominador: k.info?.denominador,
      fuente: k.info?.fuente ?? SOURCE_BY_VERTICAL[vertical],
      salvedades: ['Se muestra aquí sin recalcular, para que no pueda diferir de su pestaña.'],
    }),
  };
}
