import type {
  ContextoReporte,
  KpiSpec,
  PestanaReporte,
  UnidadValor,
} from '../../../data-access/reporting/reporting.types';
import {
  calcularCohortes,
  calcularPromociones,
  calcularReferidos,
  calcularSalud,
} from './adquisicion.cuentas';
import {
  FUENTE_EMBUDO,
  graficoCacCanal,
  graficoCacVelas,
  graficoEmbudo,
  graficoLeadsRegistros,
  graficoPayback,
  graficoRendimientoCanal,
  infoCalculo,
  currencyUnit,
  NUMBER_UNIT,
  PORCENTAJE,
  tasaPct,
} from './adquisicion.graficos';
import {
  redemptionsByStatusChart,
  graficoCohortes,
  graficoCostoPromociones,
  discountByStatusChart,
  graficoReferidos,
  graficoSaludCuentas,
} from './adquisicion.graficos-cuentas';
import {
  calcularModelo,
  MARGEN_MENSUAL_BOB,
  MIN_MUESTRA_TASA,
  CANAL_ORGANICO,
  canalFiltrado,
  byBucket,
} from './adquisicion.modelo';
import { tablaCampanas, tablaCuentasEnRiesgo } from './adquisicion.tablas';
import { convertir, kpi, redondear, variacionContexto } from './reporting-dataset.util';

/* ============================================================================
    Pestaña «Adquisición y cuentas» — datos de EJEMPLO.

    Los ids `leads`, `cac`, `conversion-lead-activacion`, `registros` y
    `payback-cac-meses` son canónicos: otras pantallas (el resumen) los leen
    por nombre. Un KPI sin muestra o sin base de cálculo sale `null` con su
    motivo; nunca 0.
    ========================================================================== */

const MESES: UnidadValor = { tipo: 'razon', sufijo: ' meses' };
const sampleReason = (que: string): string => `Menos de ${MIN_MUESTRA_TASA} ${que}: muestra insuficiente para calcular la tasa.`;

export function construirAdquisicion(ctx: ContextoReporte): PestanaReporte {
  const m = calcularModelo(ctx);
  const promos = calcularPromociones(ctx);
  const referidos = calcularReferidos(m);
  const salud = calcularSalud(ctx);
  const cohortes = calcularCohortes(ctx);
  const u = currencyUnit(ctx);
  const e = m.embudo;
  const dinero = (bob: number | null): number | null => (bob === null ? null : redondear(convertir(bob, ctx.moneda)));
  const variacion = (valor: number | null, semilla: number): number | null =>
    valor === null ? null : variacionContexto(ctx, valor, semilla);

  const convActiva = tasaPct(e.activas, e.leads);
  const costoPct = redondear((promos.descuentoTotalBob / promos.ingresoBob) * 100, 2);
  const riesgoPct = tasaPct(salud.enRiesgo, salud.total);
  const payback = m.cacBob === null ? null : redondear(m.cacBob / MARGEN_MENSUAL_BOB, 1);
  const cac = dinero(m.cacBob);

  const kpis: KpiSpec[] = [
    kpi({
      id: 'leads',
      titulo: 'Leads',
      valor: e.leads,
      unidad: NUMBER_UNIT,
      variacionPct: variacion(e.leads, 7601),
      tendencia: byBucket(m, m.leadsDia).valores,
      info: infoCalculo({ definicion: 'Personas que dejaron sus datos o pidieron información en el periodo.', formula: 'Conteo de leads nuevos del periodo.', fuente: 'crm.crm_accounts · marketing.attribution_touches' }),
    }),
    kpi({
      id: 'registros',
      titulo: 'Registros',
      valor: e.registros,
      unidad: NUMBER_UNIT,
      variacionPct: variacion(e.registros, 7602),
      tendencia: byBucket(m, m.registrosDia).valores,
      info: infoCalculo({ definicion: 'Leads que completaron el registro de su cuenta.', formula: 'Conteo de registros completados en el periodo.', fuente: 'crm.crm_accounts · onboarding' }),
    }),
    kpi({
      id: 'conversion-lead-activacion',
      titulo: 'Conversión de lead a cuenta activa',
      valor: convActiva,
      unidad: PORCENTAJE,
      variacionPct: variacion(convActiva, 7603),
      numerador: e.activas,
      denominador: e.leads,
      motivoSinDato: convActiva === null ? sampleReason('leads') : undefined,
      info: infoCalculo({ definicion: 'Qué parte de los leads termina con una cuenta activa.', formula: 'Cuentas activas ÷ leads × 100.', numerador: 'Cuentas activas', denominador: 'Leads del periodo', fuente: FUENTE_EMBUDO }),
    }),
    kpi({
      id: 'cac',
      titulo: 'Costo por cliente nuevo (CAC)',
      valor: cac,
      unidad: u,
      subirEsMalo: true,
      variacionPct: variacion(cac, 7604),
      numerador: dinero(m.inversionBob),
      denominador: e.pagantes,
      motivoSinDato: m.noCacReason ?? undefined,
      info: infoCalculo({ definicion: 'Cuánto cuesta, en promedio, conseguir un cliente pagante nuevo.', formula: 'Inversión en adquisición ÷ clientes pagantes nuevos.', numerador: 'Inversión en adquisición', denominador: 'Clientes pagantes nuevos', fuente: 'marketing.marketing_campaigns · marketing.attribution_touches · payments.subscriptions' }, ['Es un CAC combinado: los clientes de canales sin inversión (orgánico) también cuentan en el denominador.']),
    }),
    kpi({
      id: 'payback-cac-meses',
      titulo: 'Payback del CAC',
      valor: payback,
      unidad: MESES,
      subirEsMalo: true,
      variacionPct: variacion(payback, 7605),
      numerador: cac,
      denominador: redondear(convertir(MARGEN_MENSUAL_BOB, ctx.moneda)),
      motivoSinDato: m.noCacReason ?? undefined,
      info: infoCalculo({ definicion: 'Meses que tarda un cliente nuevo en devolver lo que costó conseguirlo.', formula: 'CAC ÷ margen mensual por cliente pagante.', numerador: 'CAC', denominador: 'Margen mensual por cliente', fuente: 'payments.subscriptions · marketing.marketing_campaigns' }, ['El margen por cliente es un valor de EJEMPLO.']),
    }),
    kpi({
      id: 'clientes-nuevos',
      titulo: 'Clientes pagantes nuevos',
      valor: e.pagantes,
      unidad: NUMBER_UNIT,
      variacionPct: variacion(e.pagantes, 7606),
      tendencia: byBucket(m, m.newPerDay).valores,
      info: infoCalculo({ definicion: 'Cuentas que hicieron su primer pago en el periodo.', formula: 'Conteo de primeras suscripciones pagadas.', fuente: 'payments.subscriptions' }),
    }),
    kpi({
      id: 'inversion-adquisicion',
      titulo: 'Inversión en adquisición',
      valor: dinero(m.inversionBob),
      unidad: u,
      variacionPct: variacion(dinero(m.inversionBob), 7607),
      motivoSinDato: m.inversionBob === null ? (m.noCacReason ?? undefined) : undefined,
      info: infoCalculo({ definicion: 'Lo gastado en pauta, mensajes y recompensas para captar leads.', formula: 'Suma de la inversión de todas las campañas con costo atribuible.', fuente: 'marketing.marketing_campaigns' }),
    }),
    kpi({
      id: 'descuento-otorgado',
      titulo: 'Descuento otorgado en cupones',
      valor: dinero(promos.descuentoTotalBob),
      unidad: u,
      variacionPct: variacion(dinero(promos.descuentoTotalBob), 7608),
      info: infoCalculo({ definicion: 'Importe descontado a quienes canjearon un cupón.', formula: 'Canjes × descuento de cada canje.', fuente: 'promotions.coupons · promotions.redemptions' }),
    }),
    kpi({
      id: 'costo-promociones-pct',
      titulo: 'Costo de promociones sobre el ingreso',
      valor: costoPct,
      unidad: PORCENTAJE,
      subirEsMalo: true,
      variacionPct: variacion(costoPct, 7609),
      numerador: dinero(promos.descuentoTotalBob),
      denominador: dinero(promos.ingresoBob),
      info: infoCalculo({ definicion: 'Qué parte del ingreso del periodo se fue en descuentos.', formula: 'Descuento otorgado ÷ ingreso del periodo × 100.', numerador: 'Descuento otorgado', denominador: 'Ingreso del periodo (precio de lista × cuentas pagantes)', fuente: 'promotions.redemptions · payments.subscriptions' }, ['El ingreso se estima con el precio de lista; no es facturación real.']),
    }),
    kpi({
      id: 'cuentas-en-riesgo-pct',
      titulo: 'Cuentas en riesgo alto o crítico',
      valor: riesgoPct,
      unidad: PORCENTAJE,
      subirEsMalo: true,
      variacionPct: variacion(riesgoPct, 7610),
      numerador: salud.enRiesgo,
      denominador: salud.total,
      motivoSinDato: riesgoPct === null ? sampleReason('cuentas') : undefined,
      info: infoCalculo({ definicion: 'Qué parte de las cuentas activas está en riesgo alto o crítico de abandonar.', formula: 'Cuentas en riesgo alto o crítico ÷ cuentas activas × 100.', numerador: 'Cuentas en riesgo alto o crítico', denominador: 'Cuentas activas', fuente: 'subscription_usage_counters · payment_debts · feedback_tickets' }),
    }),
  ];

  const graficos = [
    graficoEmbudo(m),
    graficoLeadsRegistros(m),
    graficoCohortes(cohortes),
    graficoCacVelas(ctx, m),
    graficoRendimientoCanal(m),
    graficoCacCanal(ctx, m),
    graficoPayback(ctx, m),
    redemptionsByStatusChart(promos),
    discountByStatusChart(ctx, promos),
    graficoCostoPromociones(promos),
    graficoReferidos(referidos),
    graficoSaludCuentas(salud),
  ];
  const tablas = [tablaCampanas(ctx, m), tablaCuentasEnRiesgo(ctx)];

  const avisos = ['Datos de EJEMPLO: no provienen de ninguna fuente real.'];
  if (canalFiltrado(ctx) === CANAL_ORGANICO) {
    avisos.push('Canal orgánico: sin inversión atribuible, por eso el CAC, el payback y la inversión salen «Sin dato».');
  }

  return {
    pestana: 'adquisicion',
    generadoEn: '2026-10-30T09:00:00-04:00',
    origen: 'ejemplo',
    kpis,
    graficos,
    tablas,
    avisos,
    secciones: [
      { titulo: 'Embudo', descripcion: 'De lead a cliente pagante y cómo se activan las cuentas.', graficos: ['adq-embudo', 'adq-leads-registros', 'adq-cohortes'] },
      { titulo: 'Canales y costo', descripcion: 'Qué canal rinde y cuánto cuesta cada cliente nuevo.', graficos: ['adq-cac-tiempo', 'adq-rendimiento-canal', 'adq-cac-canal', 'adq-payback'], tablas: ['adq-tabla-campanas'] },
      { titulo: 'Promociones y referidos', descripcion: 'Canjes, descuento otorgado y programa de referidos.', graficos: ['adq-cupones-canjes', 'adq-cupones-descuento', 'adq-cupones-costo', 'adq-referidos'] },
      { titulo: 'Salud de cuentas', descripcion: 'Qué cuentas se están alejando de la plataforma.', graficos: ['adq-salud-cuentas'], tablas: ['adq-tabla-cuentas-riesgo'] },
    ],
  };
}
