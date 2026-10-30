import type { ContextoReporte, TablaReporte } from '../../../data-access/reporting/reporting.types';
import { redondear, suma } from './reporting-dataset.util';
import { contextAccounts, withoutDimension } from './suscripciones.cortes';
import { accountsByPlan } from './suscripciones.graficos-cuentas';
import { aMoneda, info } from './suscripciones.info';
import { oscilar, PLANES, suscriptoresAlCierre, type ModeloSuscripciones } from './suscripciones.modelo';

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

/**
 * Redondea el MRR de cada plan y asigna el residuo de centavos a la fila mayor, para que las filas sumen EXACTO lo
 * que la tarjeta «MRR» muestra (el redondeo de cada fila por separado dejaba el total un centavo aparte).
 */
function mrrRepartido(exactos: readonly number[], mon: (valorBob: number) => number): number[] {
  const filas = exactos.map(mon);
  const objetivo = mon(suma(exactos));
  const mayor = filas.reduce((iMax, v, i) => (v > filas[iMax]! ? i : iMax), 0);
  if (filas.length > 0) {
    filas[mayor] = redondear(filas[mayor]! + (objetivo - suma(filas)));
  }
  return filas;
}

/** Una fila por plan y un total; el total se compone de las filas, no de otra cuenta. */
export function tablaResumenPlanes(m: ModeloSuscripciones, ctx: ContextoReporte): TablaReporte {
  const mon = aMoneda(ctx);
  const cuentas = accountsByPlan(ctx);
  const hasPlan = ctx.filtros.some((f) => f.dimension === 'plan');
  // Con un filtro de plan activo la tabla se reduce a ese plan: es el detalle del corte elegido.
  const visibles = PLANES.map((p, i) => ({ p, i })).filter(({ p }) => !hasPlan || ctx.filtros.some((f) => f.dimension === 'plan' && f.valor === p.nombre));
  // El MRR de cada plan sale del mismo modelo que la tarjeta «MRR»: con cuentas enteras × precio el total
  // se separaba de la tarjeta (490.340 frente a 490.068,67) en la misma pantalla.
  const mrrExacto = visibles.map(({ i }) => m.mrrPlan[i]![m.n - 1]!);
  const mrrFilas = mrrRepartido(mrrExacto, mon);
  // Cuentas y MRR tienen que salir del MISMO corte: las cuentas por plan se calculan sin el filtro de plan,
  // pero el MRR del modelo sí lo lleva; sin este factor el ingreso por cuenta salía a una fracción del precio.
  const sinPlan = suscriptoresAlCierre(withoutDimension(ctx, 'plan'));
  const factor = hasPlan && sinPlan > 0 ? suscriptoresAlCierre(ctx) / sinPlan : 1;
  const filas = visibles.map(({ p, i }, k) => {
    const n = Math.round(cuentas[i]! * factor);
    const mrr = mrrFilas[k]!;
    return {
      plan: p.nombre,
      cuentas: n,
      mrr,
      arpu: n > 0 ? redondear(mrr / n) : null,
      churn: n >= 10 ? redondear(m.churnMensualPct * (i === 0 ? 1.4 : i === 1 ? 0.9 : 0.4) * oscilar(ctx, `res-${p.nombre}`, 0.08), 1) : null,
      cuota: p.cuota,
    };
  });
  const totalCuentas = suma(filas.map((f) => f.cuentas));
  const totalMrr = mon(suma(mrrExacto));
  return {
    id: 'resumen-planes',
    titulo: 'Resumen por plan',
    columnas: [
      { clave: 'plan', etiqueta: 'Plan' },
      { clave: 'cuentas', etiqueta: 'Cuentas activas', alinear: 'der', unidad: { tipo: 'numero' } },
      { clave: 'mrr', etiqueta: `MRR (${simbolo(ctx)})`, alinear: 'der', unidad: { tipo: 'moneda', moneda: ctx.moneda } },
      { clave: 'arpu', etiqueta: `Ingreso por cuenta (${simbolo(ctx)})`, alinear: 'der', unidad: { tipo: 'moneda', moneda: ctx.moneda } },
      { clave: 'churn', etiqueta: 'Churn mensual (%)', alinear: 'der', unidad: { tipo: 'porcentaje' } },
      { clave: 'cuota', etiqueta: 'Consultas incluidas', alinear: 'der' },
    ],
    filas: [
      ...filas,
      { plan: 'Total', cuentas: totalCuentas, mrr: totalMrr, arpu: totalCuentas > 0 ? redondear(totalMrr / totalCuentas) : null, churn: null, cuota: null },
    ],
    info: info({
      definicion: 'Cada plan con sus cuentas, su MRR y su churn; la fila de total suma las filas de arriba.',
      formula: 'MRR del plan = el del modelo de suscripciones al cierre (el mismo de la tarjeta «MRR»); ingreso por cuenta = MRR ÷ cuentas',
      fuente: 'payments.subscriptions · payments.plan_prices',
      salvedades: ['El churn por plan sale sin dato si el plan tiene menos de 10 cuentas en el corte.', 'El total no tiene churn propio: el de toda la base está en el gráfico de churn.', 'El MRR de cada plan sale del mismo cálculo que la tarjeta «MRR»; el total es el de la tarjeta y los centavos de redondeo se asignan a la fila mayor.'],
    }),
  };
}
