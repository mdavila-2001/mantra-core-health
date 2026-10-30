import type { ContextoReporte, TablaReporte } from '../../../data-access/reporting/reporting.types';
import { redondear, suma } from './reporting-dataset.util';
import { contextAccounts } from './suscripciones.cortes';
import { accountsByPlan } from './suscripciones.graficos-cuentas';
import { aMoneda, info } from './suscripciones.info';
import { oscilar, PLANES, type ModeloSuscripciones } from './suscripciones.modelo';

const UMBRAL_SUBIDA = 85;

function simbolo(ctx: ContextoReporte): string {
  return ctx.moneda === 'USD' ? 'US$' : 'Bs';
}

/** Cuentas que ya consumen casi toda su cuota: son las que probablemente necesitan el plan siguiente. */
export function tablaCandidatas(ctx: ContextoReporte): TablaReporte {
  const mon = aMoneda(ctx);
  const filas = contextAccounts(ctx)
    .filter((c) => c.usoPct >= UMBRAL_SUBIDA && c.plan < PLANES.length - 1)
    .sort((a, b) => b.usoPct - a.usoPct || a.nombre.localeCompare(b.nombre))
    .slice(0, 10)
    .map((c) => ({
      cuenta: c.nombre,
      plan: PLANES[c.plan]!.nombre,
      uso: c.usoPct,
      consultas: Math.round((PLANES[c.plan]!.cuota * c.usoPct) / 100),
      cuota: PLANES[c.plan]!.cuota,
      sugerido: PLANES[c.plan + 1]!.nombre,
      aumento: mon(PLANES[c.plan + 1]!.precio - PLANES[c.plan]!.precio),
    }));
  return {
    id: 'candidatas-subir-plan',
    titulo: 'Cuentas candidatas a subir de plan',
    columnas: [
      { clave: 'cuenta', etiqueta: 'Cuenta' },
      { clave: 'plan', etiqueta: 'Plan actual' },
      { clave: 'uso', etiqueta: 'Uso de la cuota (%)', alinear: 'der' },
      { clave: 'consultas', etiqueta: 'Consultas del mes', alinear: 'der' },
      { clave: 'cuota', etiqueta: 'Cuota del plan', alinear: 'der' },
      { clave: 'sugerido', etiqueta: 'Plan sugerido' },
      { clave: 'aumento', etiqueta: `Aumento de MRR (${simbolo(ctx)})`, alinear: 'der' },
    ],
    filas,
    info: info({
      definicion: `Las diez cuentas con más uso de su cuota, desde ${UMBRAL_SUBIDA} %, que todavía no están en el plan más alto.`,
      formula: `Candidata = uso de la cuota ≥ ${UMBRAL_SUBIDA} % y plan distinto de «${PLANES[PLANES.length - 1]!.nombre}»`,
      fuente: 'payments.subscription_usage_counters · payments.plan_quotas · payments.plan_prices',
      salvedades: ['Una lista vacía significa que ninguna cuenta del corte supera el umbral, no que falten datos.', 'Consultorios de ejemplo: ninguno corresponde a una persona u organización real.'],
    }),
  };
}

/** Una fila por plan y un total; el total se compone de las filas, no de otra cuenta. */
export function tablaResumenPlanes(m: ModeloSuscripciones, ctx: ContextoReporte): TablaReporte {
  const mon = aMoneda(ctx);
  const cuentas = accountsByPlan(ctx);
  const hasPlan = ctx.filtros.some((f) => f.dimension === 'plan');
  // Con un filtro de plan activo la tabla se reduce a ese plan: es el detalle del corte elegido.
  const visibles = PLANES.map((p, i) => ({ p, i })).filter(({ p }) => !hasPlan || ctx.filtros.some((f) => f.dimension === 'plan' && f.valor === p.nombre));
  const filas = visibles.map(({ p, i }) => {
    const n = cuentas[i]!;
    const mrr = n * p.precio;
    return {
      plan: p.nombre,
      cuentas: n,
      mrr: mon(mrr),
      arpu: n > 0 ? mon(p.precio) : null,
      churn: n >= 10 ? redondear(m.churnMensualPct * (i === 0 ? 1.4 : i === 1 ? 0.9 : 0.4) * oscilar(ctx, `res-${p.nombre}`, 0.08), 1) : null,
      cuota: p.cuota,
    };
  });
  const totalCuentas = suma(filas.map((f) => f.cuentas));
  const totalMrr = redondear(suma(filas.map((f) => f.mrr)));
  return {
    id: 'resumen-planes',
    titulo: 'Resumen por plan',
    columnas: [
      { clave: 'plan', etiqueta: 'Plan' },
      { clave: 'cuentas', etiqueta: 'Cuentas activas', alinear: 'der' },
      { clave: 'mrr', etiqueta: `MRR (${simbolo(ctx)})`, alinear: 'der' },
      { clave: 'arpu', etiqueta: `Ingreso por cuenta (${simbolo(ctx)})`, alinear: 'der' },
      { clave: 'churn', etiqueta: 'Churn mensual (%)', alinear: 'der' },
      { clave: 'cuota', etiqueta: 'Consultas incluidas', alinear: 'der' },
    ],
    filas: [
      ...filas,
      { plan: 'Total', cuentas: totalCuentas, mrr: totalMrr, arpu: totalCuentas > 0 ? redondear(totalMrr / totalCuentas) : null, churn: null, cuota: null },
    ],
    info: info({
      definicion: 'Cada plan con sus cuentas, su MRR y su churn; la fila de total suma las filas de arriba.',
      formula: 'MRR del plan = cuentas activas × precio mensual; ingreso por cuenta = MRR ÷ cuentas',
      fuente: 'payments.subscriptions · payments.plan_prices',
      salvedades: ['El churn por plan sale sin dato si el plan tiene menos de 10 cuentas en el corte.', 'El total no tiene churn propio: el de toda la base está en el gráfico de churn.', 'Aquí las cuentas son enteras por plan, así que el total puede diferir del MRR de la tarjeta en menos de 0,1 % por redondeo.'],
    }),
  };
}
