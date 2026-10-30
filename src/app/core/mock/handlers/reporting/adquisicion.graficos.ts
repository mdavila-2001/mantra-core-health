import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type {
  ChartSpec,
  ContextoReporte,
  InfoCalculo,
  UnidadValor,
} from '../../../data-access/reporting/reporting.types';
import {
  CANAL_ORGANICO,
  MARGEN_MENSUAL_BOB,
  MIN_MUESTRA_TASA,
  OBJETIVO_PAYBACK_MESES,
  porTramo,
  velasDelCac,
  type ModeloAdquisicion,
} from './adquisicion.modelo';
import { convertir, INFO_EJEMPLO, redondear } from './reporting-dataset.util';

/* ============================================================================
    Gráficos del embudo, la serie diaria, los canales y el payback.
    Los de cupones, referidos y salud de cuentas viven en
    `adquisicion.graficos-cuentas.ts` para no pasar de ~300 líneas por archivo.
    ========================================================================== */

export const NUMERO: UnidadValor = { tipo: 'numero' };
export const PORCENTAJE: UnidadValor = { tipo: 'porcentaje' };

export function monedaDe(ctx: ContextoReporte): UnidadValor {
  return { tipo: 'moneda', moneda: ctx.moneda };
}

/** «cómo se calcula» con la salvedad de EJEMPLO que exige el brief. */
export function infoCalculo(
  base: Omit<InfoCalculo, 'frescura' | 'salvedades'>,
  salvedades: readonly string[] = [],
): InfoCalculo {
  return { ...base, frescura: INFO_EJEMPLO.frescura, salvedades: [...salvedades, 'Datos de EJEMPLO.'] };
}

/** Tasa en %, o `null` cuando el denominador no alcanza la muestra mínima. */
export function tasaPct(numerador: number, denominador: number, minimo = MIN_MUESTRA_TASA): number | null {
  return denominador < minimo ? null : redondear((numerador / denominador) * 100, 1);
}

export const FUENTE_EMBUDO = 'crm.crm_accounts · marketing.attribution_touches · onboarding (verificación de identidad) · payments.subscriptions';

const SIN_VELAS_FLUJO = 'Son conteos que se suman día a día; las velas solo valen para saldos o razones.';

export function graficoEmbudo(m: ModeloAdquisicion): ChartSpec {
  const e = m.embudo;
  const etapas = [
    { nombre: 'Lead', valor: e.leads },
    { nombre: 'Registro', valor: e.registros },
    { nombre: 'Identidad verificada', valor: e.identidad },
    { nombre: 'Cuenta activa', valor: e.activas },
    { nombre: 'Pagante', valor: e.pagantes },
  ];
  let peor = 1;
  for (let i = 2; i < etapas.length; i++) {
    if (etapas[i]!.valor / Math.max(1, etapas[i - 1]!.valor) < etapas[peor]!.valor / Math.max(1, etapas[peor - 1]!.valor)) peor = i;
  }
  const llegan = tasaPct(e.pagantes, e.leads);
  return {
    id: 'adq-embudo',
    titulo: 'Embudo de adquisición',
    subtitulo: 'De lead a cliente pagante',
    unidad: NUMERO,
    datos: { tipo: 'partes', forma: 'embudo', partes: etapas },
    resumenAccesible: `De ${formatearValor(e.leads, NUMERO)} leads, ${formatearValor(e.pagantes, NUMERO)} llegan a pagar${llegan === null ? '' : ` (${formatearValor(llegan, PORCENTAJE)})`}. La mayor pérdida está entre «${etapas[peor - 1]!.nombre}» y «${etapas[peor]!.nombre}».`,
    filtro: null,
    filtroMotivo: 'Las etapas del embudo no son una dimensión de filtro; para acotar por origen use los canales.',
    info: infoCalculo(
      {
        definicion: 'Personas que avanzan por cada etapa de adquisición en el periodo; cada etapa cuenta una sola vez a quien la alcanzó.',
        formula: 'Conteo de personas que alcanzaron la etapa; la pérdida entre etapas es la diferencia con la anterior.',
        numerador: 'Personas que alcanzaron la etapa',
        denominador: 'Leads del periodo (primera etapa)',
        fuente: FUENTE_EMBUDO,
      },
      ['«Identidad verificada» depende del módulo de onboarding, aún por confirmar.'],
    ),
    velas: null,
    velasMotivo: SIN_VELAS_FLUJO,
    alto: 340,
    ancho: 'medio',
  };
}

export function graficoLeadsRegistros(m: ModeloAdquisicion): ChartSpec {
  const leads = porTramo(m, m.leadsDia);
  const registros = porTramo(m, m.registrosDia);
  const L = leads.valores.reduce((a, b) => a + b, 0);
  const R = registros.valores.reduce((a, b) => a + b, 0);
  return {
    id: 'adq-leads-registros',
    titulo: 'Leads y registros en el tiempo',
    subtitulo: m.gran === 'dia' ? 'Por día' : m.gran === 'semana' ? 'Por semana' : 'Por mes',
    unidad: NUMERO,
    datos: {
      tipo: 'cartesiano',
      categorias: leads.etiquetas,
      series: [
        { nombre: 'Leads', valores: leads.valores, forma: 'area' },
        { nombre: 'Registros', valores: registros.valores, forma: 'linea' },
      ],
    },
    resumenAccesible: `En el periodo entraron ${formatearValor(L, NUMERO)} leads y ${formatearValor(R, NUMERO)} se registraron; la línea de registros acompaña a la de leads con menor volumen.`,
    filtro: null,
    filtroMotivo: 'Es una serie en el tiempo; el filtro por canal se aplica desde los gráficos de canales.',
    info: infoCalculo({
      definicion: 'Leads captados y registros completados por tramo de tiempo.',
      formula: 'Suma de leads y de registros de cada tramo.',
      fuente: 'crm.crm_accounts · marketing.attribution_touches',
    }),
    velas: null,
    velasMotivo: SIN_VELAS_FLUJO,
    ancho: 'medio',
  };
}

export function graficoCacVelas(ctx: ContextoReporte, m: ModeloAdquisicion): ChartSpec {
  const velasBob = velasDelCac(m);
  const conVelas = velasBob.length >= 2;
  const velas = velasBob.map((v) => ({
    fecha: v.fecha,
    apertura: redondear(convertir(v.apertura, ctx.moneda)),
    cierre: redondear(convertir(v.cierre, ctx.moneda)),
    minimo: redondear(convertir(v.minimo, ctx.moneda)),
    maximo: redondear(convertir(v.maximo, ctx.moneda)),
  }));
  const u = monedaDe(ctx);
  const ultimo = velas[velas.length - 1];
  return {
    id: 'adq-cac-tiempo',
    titulo: 'Costo por cliente nuevo (CAC) en el tiempo',
    subtitulo: 'CAC móvil de 7 días al cierre de cada tramo',
    unidad: u,
    datos: {
      tipo: 'cartesiano',
      categorias: velas.map((v) => v.fecha),
      series: [{ nombre: 'CAC', valores: velas.map((v) => v.cierre), forma: 'linea' }],
    },
    resumenAccesible:
      ultimo === undefined || !conVelas
        ? (m.motivoSinCac ?? 'Todavía no hay suficientes clientes nuevos para calcular el costo por cliente.')
        : `El CAC cerró el último tramo en ${formatearValor(ultimo.cierre, u)}, desde ${formatearValor(velas[0]!.cierre, u)} al inicio; subir es malo.`,
    filtro: null,
    filtroMotivo: 'Es una serie en el tiempo; el filtro por canal se aplica desde el gráfico de CAC por canal.',
    info: infoCalculo(
      {
        definicion: 'Cuánto cuesta, en promedio, conseguir un cliente pagante nuevo; se mira en ventana móvil de 7 días para que un día sin altas no lo dispare.',
        formula: 'Inversión de los últimos 7 días ÷ clientes pagantes nuevos de esos 7 días.',
        numerador: 'Inversión en adquisición',
        denominador: 'Clientes pagantes nuevos',
        fuente: 'marketing.marketing_campaigns · marketing.attribution_touches · payments.subscriptions',
      },
      ['Es un CAC combinado: incluye altas de canales sin inversión (orgánico).'],
    ),
    velas: conVelas
      ? {
          explicacion: 'CAC móvil de 7 días: apertura, máximo, mínimo y cierre de cada tramo. Subir es malo.',
          velas,
          subirEsMalo: true,
        }
      : null,
    velasMotivo: conVelas ? undefined : (m.motivoSinCac ?? 'No hay clientes nuevos suficientes para dibujar velas.'),
    sinDatoMotivo: m.motivoSinCac ?? 'Todavía no hay suficientes clientes nuevos para calcular el CAC.',
    ancho: 'medio',
  };
}

export function graficoRendimientoCanal(m: ModeloAdquisicion): ChartSpec {
  const canales = m.canales;
  const mejor = canales
    .map((c) => ({ c, t: tasaPct(c.activas, c.leads, 10) }))
    .filter((x): x is { c: (typeof canales)[number]; t: number } => x.t !== null)
    .sort((a, b) => b.t - a.t)[0];
  return {
    id: 'adq-rendimiento-canal',
    titulo: 'Rendimiento por canal',
    subtitulo: 'Conversión del lead hasta registro y hasta cuenta activa',
    unidad: PORCENTAJE,
    datos: {
      tipo: 'cartesiano',
      categorias: canales.map((c) => c.nombre),
      series: [
        { nombre: 'Lead → registro', valores: canales.map((c) => tasaPct(c.registros, c.leads, 10)), forma: 'barra' },
        { nombre: 'Lead → cuenta activa', valores: canales.map((c) => tasaPct(c.activas, c.leads, 10)), forma: 'barra' },
      ],
    },
    resumenAccesible:
      mejor === undefined
        ? 'No hay leads suficientes por canal para calcular conversiones.'
        : `«${mejor.c.nombre}» convierte mejor: ${formatearValor(mejor.t, PORCENTAJE)} de sus leads llegan a cuenta activa.`,
    filtro: { dimension: 'canal' },
    info: infoCalculo(
      {
        definicion: 'Qué parte de los leads de cada canal se registra y qué parte termina con cuenta activa.',
        formula: 'Registros (o cuentas activas) del canal ÷ leads del canal × 100.',
        numerador: 'Registros o cuentas activas del canal',
        denominador: 'Leads del canal',
        fuente: 'marketing.attribution_touches · crm.crm_accounts',
      },
      [`Un canal con menos de 10 leads sale «Sin dato».`],
    ),
    velas: null,
    velasMotivo: 'Son tasas por categoría, sin serie de apertura y cierre.',
    ancho: 'medio',
  };
}

export function graficoCacCanal(ctx: ContextoReporte, m: ModeloAdquisicion): ChartSpec {
  const u = monedaDe(ctx);
  const valores = m.canales.map((c) => (c.cacBob === null || m.inversionBob === null ? null : redondear(convertir(c.cacBob, ctx.moneda))));
  const baratos = m.canales
    .map((c, i) => ({ c, v: valores[i]! }))
    .filter((x): x is { c: (typeof m.canales)[number]; v: number } => x.v !== null)
    .sort((a, b) => a.v - b.v)[0];
  return {
    id: 'adq-cac-canal',
    titulo: 'CAC por canal',
    subtitulo: 'Costo por cliente pagante nuevo',
    unidad: u,
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: m.canales.map((c) => c.nombre),
      series: [{ nombre: 'CAC', valores, forma: 'barra' }],
    },
    resumenAccesible:
      baratos === undefined
        ? (m.motivoSinCac ?? 'No hay clientes nuevos suficientes para calcular el CAC por canal.')
        : `«${baratos.c.nombre}» es el canal más barato por cliente (${formatearValor(baratos.v, u)}). ${CANAL_ORGANICO} no tiene CAC: no hay inversión atribuible.`,
    filtro: { dimension: 'canal' },
    info: infoCalculo(
      {
        definicion: 'Inversión de cada canal dividida por los clientes pagantes nuevos que trajo.',
        formula: 'Inversión del canal ÷ clientes pagantes nuevos del canal.',
        numerador: 'Inversión del canal (pauta, mensajes, recompensas)',
        denominador: 'Clientes pagantes nuevos del canal',
        fuente: 'marketing.marketing_campaigns · marketing.attribution_touches · promotions.member_referrals',
      },
      ['«Orgánico y buscadores» sale «Sin dato»: sin inversión atribuible no hay costo por cliente.', 'En Referidos la inversión son las recompensas.'],
    ),
    velas: null,
    velasMotivo: 'Es una comparación entre canales en el periodo; las velas se ven en el CAC en el tiempo.',
    sinDatoMotivo: m.motivoSinCac ?? 'No hay clientes nuevos suficientes para calcular el CAC por canal.',
    ancho: 'medio',
  };
}

export function graficoPayback(ctx: ContextoReporte, m: ModeloAdquisicion): ChartSpec {
  const meses = m.cacBob === null ? null : redondear(m.cacBob / MARGEN_MENSUAL_BOB, 1);
  const u: UnidadValor = { tipo: 'razon', sufijo: ' meses' };
  return {
    id: 'adq-payback',
    titulo: 'Payback del CAC',
    subtitulo: `Meses para recuperar el CAC · objetivo de ejemplo ${OBJETIVO_PAYBACK_MESES} meses`,
    unidad: u,
    datos: { tipo: 'medidor', nombre: 'Payback', valor: meses, minimo: 0, maximo: 12, objetivo: OBJETIVO_PAYBACK_MESES },
    resumenAccesible:
      meses === null
        ? (m.motivoSinCac ?? 'Sin dato: no hay CAC para calcular el payback.')
        : `El CAC se recupera en ${formatearValor(meses, u)}; ${meses <= OBJETIVO_PAYBACK_MESES ? 'dentro' : 'por encima'} del objetivo de ${OBJETIVO_PAYBACK_MESES} meses.`,
    filtro: null,
    filtroMotivo: 'Es un único indicador; no hay elementos que filtrar.',
    info: infoCalculo(
      {
        definicion: 'Tiempo que tarda un cliente nuevo en devolver lo que costó conseguirlo.',
        formula: 'CAC ÷ margen mensual por cliente pagante.',
        numerador: `CAC combinado (${formatearValor(m.cacBob === null ? null : convertir(m.cacBob, ctx.moneda), monedaDe(ctx))})`,
        denominador: `Margen mensual por cliente (${formatearValor(convertir(MARGEN_MENSUAL_BOB, ctx.moneda), monedaDe(ctx))})`,
        fuente: 'payments.subscriptions · marketing.marketing_campaigns',
      },
      ['El margen por cliente y el objetivo de 6 meses son valores de EJEMPLO, no metas aprobadas.'],
    ),
    velas: null,
    velasMotivo: 'Es un indicador puntual; la serie del costo está en el CAC en el tiempo.',
    sinDatoMotivo: m.motivoSinCac ?? 'Sin dato: no hay CAC para calcular el payback.',
    alto: 280,
    ancho: 'medio',
  };
}
