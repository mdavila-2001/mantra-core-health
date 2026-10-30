import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec, ContextoReporte } from '../../../data-access/reporting/reporting.types';
import {
  ESTADOS_PROMOCION,
  MIN_MUESTRA_CELDA,
  NIVELES_RIESGO,
  PLANES,
  type ModeloPromociones,
  type ModeloReferidos,
  type ModeloSalud,
  type ModeloCohortes,
} from './adquisicion.cuentas';
import { infoCalculo, monedaDe, NUMERO, PORCENTAJE } from './adquisicion.graficos';
import { convertir, redondear, suma } from './reporting-dataset.util';

/* ============================================================================
    Gráficos de promociones, referidos, salud de cuentas y cohortes.
    ========================================================================== */

const FUENTE_PROMOS = 'promotions.promotions · promotions.coupons · promotions.redemptions';

function porEstado(p: ModeloPromociones, campo: 'canjes' | 'descuentoBob'): number[] {
  return ESTADOS_PROMOCION.map((e) => suma(p.promociones.filter((x) => x.estado === e).map((x) => x[campo])));
}

export function graficoCanjesPorEstado(p: ModeloPromociones): ChartSpec {
  const valores = porEstado(p, 'canjes');
  const i = valores.indexOf(Math.max(...valores));
  return {
    id: 'adq-cupones-canjes',
    titulo: 'Canjes de cupones por estado de la promoción',
    subtitulo: 'Cuántas veces se usó un cupón',
    unidad: NUMERO,
    datos: { tipo: 'cartesiano', categorias: [...ESTADOS_PROMOCION], series: [{ nombre: 'Canjes', valores, forma: 'barra' }] },
    resumenAccesible: `Se canjearon ${formatearValor(p.canjesTotal, NUMERO)} cupones; las promociones en estado «${ESTADOS_PROMOCION[i]}» concentran ${formatearValor(valores[i]!, NUMERO)}.`,
    filtro: { dimension: 'estado' },
    info: infoCalculo({
      definicion: 'Canjes de cupón en el periodo, agrupados por el estado actual de la promoción a la que pertenecen.',
      formula: 'Conteo de canjes registrados en el periodo.',
      fuente: FUENTE_PROMOS,
    }),
    velas: null,
    velasMotivo: 'Son conteos que se suman; las velas solo valen para saldos o razones.',
    ancho: 'medio',
  };
}

export function graficoDescuentoPorEstado(ctx: ContextoReporte, p: ModeloPromociones): ChartSpec {
  const u = monedaDe(ctx);
  const valores = porEstado(p, 'descuentoBob').map((v) => redondear(convertir(v, ctx.moneda)));
  return {
    id: 'adq-cupones-descuento',
    titulo: 'Descuento otorgado por estado de la promoción',
    subtitulo: 'Lo que se dejó de cobrar por cupones canjeados',
    unidad: u,
    datos: { tipo: 'cartesiano', categorias: [...ESTADOS_PROMOCION], series: [{ nombre: 'Descuento otorgado', valores, forma: 'barra' }] },
    resumenAccesible: `El descuento otorgado suma ${formatearValor(convertir(p.descuentoTotalBob, ctx.moneda), u)} en el periodo.`,
    filtro: { dimension: 'estado' },
    info: infoCalculo({
      definicion: 'Importe que se descontó a quienes canjearon un cupón.',
      formula: 'Canjes × descuento aplicado a cada canje.',
      fuente: FUENTE_PROMOS,
    }),
    velas: null,
    velasMotivo: 'Es un importe que se suma por periodo; las velas solo valen para saldos o razones.',
    ancho: 'medio',
  };
}

export function graficoCostoPromociones(p: ModeloPromociones): ChartSpec {
  const valores = p.promociones.map((x) => redondear((x.descuentoBob / p.ingresoBob) * 100, 2));
  const total = redondear((p.descuentoTotalBob / p.ingresoBob) * 100, 2);
  return {
    id: 'adq-cupones-costo',
    titulo: 'Costo de cada promoción sobre el ingreso',
    subtitulo: 'Descuento otorgado ÷ ingreso del periodo',
    unidad: PORCENTAJE,
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: p.promociones.map((x) => x.nombre),
      series: [{ nombre: 'Costo sobre el ingreso', valores, forma: 'barra' }],
    },
    resumenAccesible: `En conjunto las promociones cuestan ${formatearValor(total, PORCENTAJE)} del ingreso del periodo.`,
    filtro: null,
    filtroMotivo: 'La promoción no es una dimensión de filtro del tablero; para acotar use el estado en los gráficos de canjes.',
    info: infoCalculo(
      {
        definicion: 'Qué parte del ingreso se fue en descuentos de cada promoción.',
        formula: 'Descuento otorgado por la promoción ÷ ingreso del periodo × 100.',
        numerador: 'Descuento otorgado por la promoción',
        denominador: 'Ingreso del periodo de la base de cuentas pagantes',
        fuente: `${FUENTE_PROMOS} · payments.subscriptions`,
      },
      ['El ingreso del periodo se estima con el precio de lista; no es facturación real.'],
    ),
    velas: null,
    velasMotivo: 'Compara promociones entre sí; no hay serie de apertura y cierre.',
    alto: 320,
    ancho: 'medio',
  };
}

export function graficoReferidos(r: ModeloReferidos): ChartSpec {
  const cae = (x: number): number => (x === 0 ? 0 : -x);
  return {
    id: 'adq-referidos',
    titulo: 'Programa de referidos',
    subtitulo: 'De la invitación a la recompensa pagada',
    unidad: NUMERO,
    datos: {
      tipo: 'cascada',
      pasos: [
        { nombre: 'Invitaciones', valor: r.invitaciones, total: true },
        { nombre: 'No se registraron', valor: cae(r.invitaciones - r.registros) },
        { nombre: 'Registros', valor: r.registros, total: true },
        { nombre: 'No se activaron', valor: cae(r.registros - r.activaciones) },
        { nombre: 'Activaciones', valor: r.activaciones, total: true },
        { nombre: 'Recompensa por pagar', valor: cae(r.activaciones - r.recompensas) },
        { nombre: 'Recompensas pagadas', valor: r.recompensas, total: true },
      ],
    },
    resumenAccesible: `De ${formatearValor(r.invitaciones, NUMERO)} invitaciones, ${formatearValor(r.registros, NUMERO)} se registraron, ${formatearValor(r.activaciones, NUMERO)} activaron la cuenta y se pagaron ${formatearValor(r.recompensas, NUMERO)} recompensas.`,
    filtro: null,
    filtroMotivo: 'Los pasos del programa no son una dimensión de filtro.',
    info: infoCalculo(
      {
        definicion: 'Cuántas invitaciones del programa «Invita a un colega» llegan a registro, a cuenta activa y a recompensa pagada.',
        formula: 'Invitaciones − pérdida por paso = personas que llegan al paso siguiente.',
        fuente: 'promotions.member_referrals · promotions.referral_programs',
      },
      ['La recompensa se paga cuando la cuenta cumple 30 días; parte de las activaciones recientes aún no la cobró.'],
    ),
    velas: null,
    velasMotivo: 'Es un embudo de conteos que se suman; no hay saldo ni razón para velas.',
    alto: 320,
    ancho: 'medio',
  };
}

export function graficoSaludCuentas(s: ModeloSalud): ChartSpec {
  return {
    id: 'adq-salud-cuentas',
    titulo: 'Salud de las cuentas',
    subtitulo: 'Cuentas por plan y nivel de riesgo',
    unidad: NUMERO,
    datos: { tipo: 'mapa-calor', filas: [...PLANES], columnas: [...NIVELES_RIESGO], celdas: s.celdas, nombreValor: 'Cuentas' },
    resumenAccesible: `Hay ${formatearValor(s.enRiesgo, NUMERO)} cuentas en riesgo alto o crítico sobre ${formatearValor(s.total, NUMERO)}. Las celdas con menos de ${MIN_MUESTRA_CELDA} cuentas salen «Sin dato».`,
    filtro: { dimension: 'plan' },
    info: infoCalculo(
      {
        definicion: 'Cuentas activas clasificadas por plan y por nivel de riesgo según su uso, su mora y sus tickets abiertos.',
        formula: 'Conteo de cuentas por plan y nivel; el nivel resume días sin uso, deuda vencida y tickets abiertos.',
        fuente: 'subscription_usage_counters · payment_debts · feedback_tickets',
      },
      [`Una celda con menos de ${MIN_MUESTRA_CELDA} cuentas no se publica: sale «Sin dato», no 0.`, 'La regla que define cada nivel de riesgo es de EJEMPLO y está por validar con Éxito del cliente.'],
    ),
    velas: null,
    velasMotivo: 'Es una foto de cuentas por categoría, no una serie de saldo.',
    sinDatoMotivo: `Ninguna celda llega a ${MIN_MUESTRA_CELDA} cuentas en este alcance.`,
    alto: 320,
    ancho: 'medio',
  };
}

export function graficoCohortes(c: ModeloCohortes): ChartSpec {
  return {
    id: 'adq-cohortes',
    titulo: 'Activación por cohorte semanal',
    subtitulo: '% de cuentas registradas esa semana que ya están activas',
    unidad: PORCENTAJE,
    datos: { tipo: 'mapa-calor', filas: c.filas, columnas: c.columnas, celdas: c.celdas, nombreValor: 'Cuentas activas' },
    resumenAccesible: 'Cada fila es la semana en que se registraron las cuentas; cada columna, las semanas transcurridas. Las semanas que aún no ocurrieron salen «Sin dato».',
    filtro: null,
    filtroMotivo: 'Las cohortes son semanas de calendario, que no son una dimensión de filtro.',
    info: infoCalculo(
      {
        definicion: 'Qué parte de cada cohorte semanal de registros llegó a tener cuenta activa, semana a semana.',
        formula: 'Cuentas activas acumuladas de la cohorte ÷ registros de la cohorte × 100.',
        numerador: 'Cuentas de la cohorte con actividad',
        denominador: 'Registros de la semana',
        fuente: 'crm.crm_accounts · onboarding',
      },
      ['Una semana que todavía no transcurrió no tiene valor: se muestra «Sin dato», no 0 %.'],
    ),
    velas: null,
    velasMotivo: 'Es una matriz de cohortes; no hay serie de apertura y cierre.',
    sinDatoMotivo: 'Las cohortes son demasiado chicas en este alcance para publicar un porcentaje.',
    alto: 340,
    ancho: 'medio',
  };
}
