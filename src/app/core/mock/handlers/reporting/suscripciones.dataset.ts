import type { ContextoReporte, KpiSpec, PestanaReporte } from '../../../data-access/reporting/reporting.types';
import { agrupar, kpi, redondear, suma, variacionContexto } from './reporting-dataset.util';
import {
  graficoCascada,
  graficoChurn,
  graficoCohortes,
  graficoIngresoPlan,
  graficoMovimiento,
  graficoMrr,
  ingresoPorPlan,
} from './suscripciones.graficos-mrr';
import {
  graficoChurnPlan,
  graficoCiudad,
  graficoEmbudo,
  graficoEspecialidad,
  graficoMixPlan,
  graficoMoraFlujo,
  graficoRenovaciones,
  graficoSaldoMora,
  graficoUso,
  renovacionesProximas,
} from './suscripciones.graficos-cuentas';
import { aMoneda, info, unidadMoneda } from './suscripciones.info';
import { modelarSuscripciones, semillaDe, type ModeloSuscripciones } from './suscripciones.modelo';
import { tablaCandidatas, tablaResumenPlanes } from './suscripciones.tablas';

/* ============================================================================
    Pestaña «Suscripciones de doctores» — datos de EJEMPLO.

    Un solo modelo (`suscripciones.modelo.ts`) alimenta tarjetas, gráficos y
    tablas, así que no pueden contradecirse. Los importes se generan en BOB y se
    convierten al final; un valor sin dato es `null` con su motivo, nunca 0.
    ========================================================================== */

const MUESTRA_MINIMA = 10;
const FUENTE = 'payments.subscriptions · payments.plan_prices';

/** Tendencia corta de una serie diaria, para la línea de la tarjeta. */
function tendencia(m: ModeloSuscripciones, diaria: readonly number[], agregar: 'ultimo' | 'promedio' | 'suma'): number[] {
  return agrupar(m.fechas, diaria as number[], m.gran, agregar).valores.map((v) => redondear(v));
}

function construirKpis(m: ModeloSuscripciones, ctx: ContextoReporte): KpiSpec[] {
  const mon = aMoneda(ctx);
  const moneda = unidadMoneda(ctx);
  const sem = semillaDe(ctx) + (ctx.comparar === 'mismo-periodo-ano-anterior' ? 1 : 0);
  const variacion = (valor: number | null, k: number): number | null => (valor === null ? null : variacionContexto(ctx, valor, sem + k));
  const mrrFin = mon(m.mrr[m.n - 1]!);
  const ing = ingresoPorPlan(m, ctx);
  const ingreso = redondear(suma(ing.series.flat()));
  const churnPct = m.subsIni > 0 ? redondear((m.bajasTotal / m.subsIni) * 100, 1) : null;
  const churnMensual = m.subsIni > 0 ? m.bajasTotal / m.subsIni / m.meses : null;
  const arpuFin = m.subsFin > 0 ? mon(m.arpu[m.n - 1]!) : null;
  // LTV: ARPU ÷ churn mensual. Con pocas bajas el churn es ruido y el LTV se dispara, así que exige muestra.
  const ltv = arpuFin !== null && churnMensual !== null && m.bajasTotal >= 5 ? redondear(arpuFin / churnMensual) : null;
  const e = m.embudo;
  const conversion = e.enPrueba >= MUESTRA_MINIMA ? redondear((e.pagantes / e.enPrueba) * 100, 1) : null;
  const rec = m.mora.fallidos >= MUESTRA_MINIMA ? redondear((m.mora.recuperados / m.mora.fallidos) * 100, 1) : null;
  const saldo = mon(m.mora.saldo[m.n - 1]!);
  const vence30 = renovacionesProximas(m).slice(0, 2).reduce((a, v) => a + v.total, 0);

  return [
    kpi({
      id: 'mrr', titulo: 'MRR', valor: mrrFin, unidad: moneda, variacionPct: variacion(mrrFin, 1),
      tendencia: tendencia(m, m.mrr.map(mon), 'ultimo'),
      info: info({ definicion: 'Ingreso mensual recurrente de las suscripciones activas al cierre.', formula: 'MRR = Σ (precio mensual × cuentas activas de cada plan)', fuente: FUENTE }),
    }),
    kpi({
      id: 'arr', titulo: 'ARR', valor: redondear(mrrFin * 12), unidad: moneda, variacionPct: variacion(mrrFin, 2),
      tendencia: tendencia(m, m.mrr.map((v) => mon(v) * 12), 'ultimo'),
      info: info({ definicion: 'El MRR de hoy llevado a un año.', formula: 'ARR = MRR × 12', fuente: FUENTE, salvedades: ['Es una proyección de lo que se paga hoy, no ingresos ya cobrados.'] }),
    }),
    kpi({
      id: 'suscriptores-activos', titulo: 'Suscriptores activos', valor: m.subsFin, unidad: { tipo: 'numero' }, variacionPct: variacion(m.subsFin, 3),
      tendencia: tendencia(m, m.subs, 'ultimo'),
      info: info({ definicion: 'Doctores o consultorios con una suscripción vigente al cierre del periodo.', formula: 'Suscriptores = suscripciones en estado activo', fuente: FUENTE }),
    }),
    kpi({
      id: 'churn-cuentas', titulo: 'Churn de cuentas', valor: churnPct, unidad: { tipo: 'porcentaje' }, subirEsMalo: true, variacionPct: variacion(churnPct, 4),
      numerador: m.bajasTotal, denominador: m.subsIni,
      motivoSinDato: churnPct === null ? 'No había cuentas activas al inicio del periodo en este corte; no hay base sobre la que medir bajas.' : undefined,
      tendencia: tendencia(m, m.churnDia, 'promedio'),
      info: info({
        definicion: 'Porcentaje de las cuentas activas al inicio del periodo que dejaron de pagar durante él.',
        formula: 'Churn = bajas del periodo ÷ cuentas activas al inicio', numerador: 'Cuentas dadas de baja en el periodo', denominador: 'Cuentas activas al inicio del periodo',
        fuente: 'payments.subscriptions_history', salvedades: ['La tasa es del periodo completo: un periodo largo da un porcentaje mayor que uno corto.'],
      }),
    }),
    kpi({
      id: 'arpu', titulo: 'ARPU', valor: arpuFin, unidad: moneda, variacionPct: variacion(arpuFin, 5),
      motivoSinDato: arpuFin === null ? 'No hay cuentas activas en este corte; el ingreso por cuenta no se puede calcular.' : undefined,
      tendencia: tendencia(m, m.arpu.map(mon), 'ultimo'),
      info: info({ definicion: 'Ingreso mensual promedio por cuenta activa.', formula: 'ARPU = MRR ÷ cuentas activas', numerador: 'MRR', denominador: 'Cuentas activas', fuente: FUENTE }),
    }),
    kpi({
      id: 'ingreso-periodo', titulo: 'Ingreso de suscripciones', valor: ingreso, unidad: moneda, variacionPct: variacion(ingreso, 6),
      tendencia: ing.etiquetas.map((_, i) => redondear(suma(ing.series.map((s) => s[i]!)))),
      info: info({ definicion: 'Ingreso de suscripciones reconocido durante el periodo.', formula: 'Ingreso = Σ días (MRR del día ÷ 30)', fuente: `${FUENTE} · accounting (mayor)`, salvedades: ['Es ingreso devengado, no caja.'] }),
    }),
    kpi({
      id: 'altas-netas', titulo: 'Cuentas netas', valor: m.altasTotal - m.bajasTotal, unidad: { tipo: 'numero' }, variacionPct: variacion(m.altasTotal - m.bajasTotal, 7),
      info: info({ definicion: 'Altas menos bajas del periodo.', formula: 'Netas = altas − bajas', fuente: 'payments.subscriptions_history' }),
    }),
    kpi({
      id: 'conversion-prueba-pago', titulo: 'Conversión de prueba a pago', valor: conversion, unidad: { tipo: 'porcentaje' }, variacionPct: variacion(conversion, 8),
      numerador: conversion === null ? null : e.pagantes, denominador: conversion === null ? null : e.enPrueba,
      motivoSinDato: conversion === null ? `Solo hubo ${e.enPrueba} pruebas iniciadas en este corte; con menos de ${MUESTRA_MINIMA} el porcentaje no es confiable.` : undefined,
      info: info({
        definicion: 'De los doctores que empezaron la prueba, cuántos pasaron a pagar.', formula: 'Conversión = pagantes ÷ pruebas iniciadas', numerador: 'Doctores que pasaron a pagar', denominador: 'Pruebas iniciadas',
        fuente: 'payments.subscription_plans (trial_days) · payments.subscriptions', salvedades: [`Con menos de ${MUESTRA_MINIMA} pruebas en el corte sale sin dato.`, 'Se cuentan por fecha del evento, no por cohorte.'],
      }),
    }),
    kpi({
      id: 'ltv', titulo: 'Valor de vida del cliente (LTV)', valor: ltv, unidad: moneda, variacionPct: variacion(ltv, 9),
      motivoSinDato: ltv === null ? 'Hay menos de 5 bajas en este corte: el churn es demasiado ruidoso para estimar cuánto dura una cuenta.' : undefined,
      info: info({ definicion: 'Ingreso que se espera de una cuenta durante toda su vida.', formula: 'LTV = ARPU ÷ churn mensual', numerador: 'ARPU', denominador: 'Churn mensual', fuente: 'payments.subscriptions_history', salvedades: ['Exige al menos 5 bajas en el periodo; con menos sale sin dato.', 'Supone que el churn actual se mantiene.'] }),
    }),
    kpi({
      id: 'saldo-mora', titulo: 'Saldo en mora', valor: saldo, unidad: moneda, subirEsMalo: true, variacionPct: variacion(saldo, 10),
      tendencia: tendencia(m, m.mora.saldo.map(mon), 'ultimo'),
      info: info({ definicion: 'Cobros de los últimos 30 días que siguen sin pagarse.', formula: 'Saldo = Σ (fallidos − recuperados) de los últimos 30 días', fuente: 'payments.payment_debts · payments.payment_intents' }),
    }),
    kpi({
      id: 'recuperacion-mora', titulo: 'Recuperación tras reintento', valor: rec, unidad: { tipo: 'porcentaje' }, variacionPct: variacion(rec, 11),
      numerador: rec === null ? null : m.mora.recuperados, denominador: rec === null ? null : m.mora.fallidos,
      motivoSinDato: rec === null ? `Hubo menos de ${MUESTRA_MINIMA} cobros fallidos en este corte; la tasa no es confiable.` : undefined,
      info: info({ definicion: 'De los cobros que fallaron, cuántos se cobraron después del reintento.', formula: 'Recuperación = cobros recuperados ÷ cobros fallidos', numerador: 'Cobros recuperados tras el reintento', denominador: 'Cobros fallidos', fuente: 'payments.payment_intents', salvedades: ['Se cuentan cobros: el número sale de dividir el importe entre el ticket medio.'] }),
    }),
    kpi({
      id: 'renovaciones-30d', titulo: 'Renovaciones en 30 días', valor: vence30, unidad: { tipo: 'numero' }, variacionPct: variacion(vence30, 12),
      info: info({ definicion: 'Suscripciones que vencen en los próximos 30 días.', formula: 'Renovaciones = suscripciones activas con fecha de fin dentro de 30 días', fuente: 'payments.subscriptions' }),
    }),
  ];
}

export function construirSuscripciones(ctx: ContextoReporte): PestanaReporte {
  const m = modelarSuscripciones(ctx);
  const graficos = [
    graficoMrr(m, ctx), graficoCascada(m, ctx), graficoIngresoPlan(m, ctx),
    graficoMovimiento(m), graficoEmbudo(m), graficoRenovaciones(m),
    graficoChurn(m), graficoCohortes(m, ctx), graficoChurnPlan(ctx),
    graficoUso(ctx), graficoSaldoMora(m, ctx), graficoMoraFlujo(m, ctx),
    graficoMixPlan(ctx), graficoEspecialidad(ctx), graficoCiudad(ctx),
  ];
  const tablas = [tablaCandidatas(ctx), tablaResumenPlanes(m, ctx)];
  return {
    pestana: 'suscripciones',
    generadoEn: '2026-10-30T09:00:00-04:00',
    origen: 'ejemplo',
    kpis: construirKpis(m, ctx),
    graficos,
    tablas,
    avisos: ['Datos de EJEMPLO: ninguna cifra, plan ni consultorio de esta pestaña es real.'],
    secciones: [
      { titulo: 'Ingresos recurrentes', descripcion: 'Cuánto entra por mes y de dónde sale el cambio.', graficos: ['mrr-evolucion', 'cascada-mrr', 'ingreso-plan'] },
      { titulo: 'Movimiento de cuentas', descripcion: 'Quién llega, quién se va y quién está por renovar.', graficos: ['movimiento-cuentas', 'embudo-adquisicion', 'renovaciones-proximas'] },
      { titulo: 'Retención', descripcion: 'Cuánto dura una cuenta una vez que paga.', graficos: ['churn-cuentas-velas', 'retencion-cohortes', 'churn-plan'] },
      { titulo: 'Uso y mora', descripcion: 'Quién necesita más plan y quién no está pagando.', graficos: ['uso-cuota', 'saldo-mora', 'mora-recuperacion'], tablas: ['candidatas-subir-plan'] },
      { titulo: 'Cortes', descripcion: 'La misma base vista por plan, especialidad y ciudad. Toque una barra para filtrar el informe.', graficos: ['mix-plan', 'cuentas-especialidad', 'cuentas-ciudad'], tablas: ['resumen-planes'] },
    ],
  };
}
