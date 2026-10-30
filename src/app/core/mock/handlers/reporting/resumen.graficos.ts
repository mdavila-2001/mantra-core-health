import { formatearValor } from '../../../data-access/reporting/reporting-format';
import type { ChartSpec, UnidadValor } from '../../../data-access/reporting/reporting.types';
import {
  daysInPeriod,
  periodDates,
  agrupar,
  granularidad,
  hashTexto,
  redondear,
  rng,
  suma,
  candlesFromSeries,
} from './reporting-dataset.util';
import {
  NOMBRE_VERTICAL,
  CRECIMIENTO,
  ORDEN,
  buscarKpi,
  importeEnMoneda,
  infoEjemplo,
  saldoDiario,
  serieDeIngreso,
  type BaseResumen,
} from './resumen.base';
import { concentracionDe } from './resumen.concentracion';

const FUENTE =
  'Composición de las pestañas Suscripciones, Publicidad y Comisiones (payments.subscriptions, ads.ad_invoices, broker_commission_statements, payment_splits).';

function dineroDe(base: BaseResumen): UnidadValor {
  return { tipo: 'moneda', moneda: base.ctx.moneda };
}

function m(base: BaseResumen, v: number | null): string {
  return formatearValor(v, dineroDe(base));
}

/* 1 · Ingreso por vertical en el tiempo (barras apiladas) */
function ingresoEnElTiempo(base: BaseResumen): ChartSpec {
  const s = serieDeIngreso(base);
  const lectura =
    base.total === null
      ? 'No hay total: falta el ingreso de al menos una vertical.'
      : `En el periodo el ingreso total fue ${m(base, base.total)}; cada barra es un tramo del periodo y sus colores son las tres verticales.`;
  return {
    id: 'ingreso-vertical-tiempo',
    titulo: 'Ingreso por vertical en el tiempo',
    subtitulo: 'Cada barra suma las tres verticales',
    unidad: dineroDe(base),
    datos: {
      tipo: 'cartesiano',
      categorias: s.etiquetas,
      series: ORDEN.map((c) => ({
        nombre: NOMBRE_VERTICAL[c],
        valores: s.porVertical[c],
        forma: 'barra' as const,
        apilar: 'ingreso',
      })),
    },
    resumenAccesible: `Barras apiladas del ingreso por vertical a lo largo del periodo. ${lectura}`,
    filtro: null,
    filtroMotivo: 'El eje es el tiempo: filtrar por un tramo repetiría el selector de periodo de arriba.',
    info: infoEjemplo({
      definicion: 'Ingreso reconocido de cada vertical, repartido en tramos del periodo.',
      formula: 'Por tramo: ingreso de Suscripciones + Publicidad + Comisiones',
      fuente: FUENTE,
      salvedades: [
        'La suma de todos los tramos es igual al «Ingreso total» de arriba; el reparto dentro del periodo es una forma de EJEMPLO calibrada a ese total.',
        'Si una vertical no tiene dato, su tramo queda vacío y el total no se calcula.',
      ],
    }),
    velas: null,
    velasMotivo: 'El ingreso es un flujo que se suma; las velas sólo tienen sentido en saldos y razones.',
    ancho: 'completo',
    sinDatoMotivo: base.motivoTotal ?? 'Sin ingreso en el periodo elegido.',
  };
}

/* 2 · Mix de ingresos (dona) */
function mixDeIngresos(base: BaseResumen): ChartSpec {
  const partes = ORDEN.map((c) => ({ nombre: NOMBRE_VERTICAL[c], valor: base.lecturas[c].ingreso }));
  const mayor = base.total === null ? null : [...partes].sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))[0]!;
  return {
    id: 'mix-ingresos',
    titulo: 'Mix de ingresos',
    subtitulo: 'Qué parte del total aporta cada vertical',
    unidad: dineroDe(base),
    datos: { tipo: 'partes', forma: 'dona', partes },
    resumenAccesible:
      mayor === null || base.total === null
        ? 'Dona del mix de ingresos. Sin dato: falta el ingreso de al menos una vertical.'
        : `Dona con tres partes. ${mayor.nombre} aporta ${formatearValor(redondear(((mayor.valor ?? 0) / base.total) * 100, 1), { tipo: 'porcentaje' })} del total, la mayor parte.`,
    filtro: null,
    filtroMotivo: 'El filtro por vertical no es una dimensión transversal: las pestañas se eligen arriba, no con un clic aquí.',
    info: infoEjemplo({
      definicion: 'Peso de cada vertical sobre el ingreso total.',
      formula: 'Ingreso de la vertical ÷ Ingreso total × 100',
      numerador: 'Ingreso de la vertical',
      denominador: 'Ingreso total',
      fuente: FUENTE,
    }),
    velas: null,
    velasMotivo: 'Son partes de un total en un solo corte; no hay serie de apertura y cierre.',
    sinDatoMotivo: base.motivoTotal ?? 'Sin ingreso en el periodo.',
  };
}

/* 3 · MRR total con velas */
function mrrConVelas(base: BaseResumen): ChartSpec {
  const { ctx } = base;
  const k = buscarKpi(base.lecturas.suscripciones.pestana, 'mrr');
  const mrr = importeEnMoneda(k, ctx, 'el MRR de suscripciones');
  const fechas = periodDates(ctx.periodo);
  const gran = granularidad(ctx.periodo);
  const diario =
    mrr.valor === null ? null : saldoDiario(hashTexto(`resumen:mrr:${ctx.periodo}`), daysInPeriod(ctx.periodo), mrr.valor, k?.variacionPct ?? null);
  const cubos = diario === null ? null : agrupar(fechas, diario, gran, 'ultimo');
  const etiquetas = cubos?.etiquetas ?? agrupar(fechas, fechas.map(() => 0), gran, 'ultimo').etiquetas;
  return {
    id: 'mrr-total',
    titulo: 'MRR de suscripciones al cierre de cada tramo',
    subtitulo: 'Saldo mensual recurrente; cambia a velas para ver su rango',
    unidad: dineroDe(base),
    datos: {
      tipo: 'cartesiano',
      categorias: etiquetas,
      series: [{ nombre: 'MRR', valores: cubos?.valores ?? etiquetas.map(() => null), forma: 'linea' }],
    },
    resumenAccesible:
      mrr.valor === null
        ? `Línea del MRR. Sin dato: ${mrr.motivo}`
        : `Línea del MRR de suscripciones; cierra el periodo en ${m(base, mrr.valor)}.`,
    filtro: null,
    filtroMotivo: 'Es un saldo en el tiempo: no hay categorías sobre las que filtrar.',
    info: infoEjemplo({
      definicion: 'Ingreso mensual recurrente de las suscripciones vigentes, medido al cierre de cada tramo.',
      formula: 'Σ precio normalizado a mes de las suscripciones activas',
      fuente: 'payments.subscriptions, payments.plan_prices',
      salvedades: ['El último punto es el MRR del KPI de arriba; la trayectoria anterior es de EJEMPLO.'],
    }),
    velas:
      diario === null || mrr.valor === null
        ? null
        : {
            explicacion: 'Cada vela resume un tramo del MRR: apertura (primer día), cierre (último), mínimo y máximo.',
            velas: candlesFromSeries(fechas, diario, gran),
          },
    velasMotivo: 'Sin MRR no hay serie con apertura y cierre que mostrar.',
    ancho: 'completo',
    sinDatoMotivo: mrr.motivo ?? 'Sin MRR en el periodo.',
  };
}

/* 4 · Cascada del periodo anterior al actual */
function cascada(base: BaseResumen): ChartSpec {
  const { ctx, total, anterior } = base;
  const completo = total !== null && anterior !== null;
  const pasos: { nombre: string; valor: number; total?: boolean }[] = [];
  if (completo) {
    const deltas = ORDEN.map((c) => redondear((base.lecturas[c].ingreso ?? 0) - (base.lecturas[c].anterior ?? 0)));
    // El residuo del redondeo cae en el último paso: anterior + variaciones = actual, exacto.
    deltas[deltas.length - 1] = redondear(total - anterior - suma(deltas.slice(0, -1)));
    pasos.push({ nombre: 'Periodo anterior', valor: anterior, total: true });
    ORDEN.forEach((c, i) => pasos.push({ nombre: NOMBRE_VERTICAL[c], valor: deltas[i]! }));
    pasos.push({ nombre: 'Periodo actual', valor: total, total: true });
  }
  const motivo =
    ctx.comparar === 'ninguna'
      ? 'Elige comparar con el periodo anterior para ver qué vertical movió el ingreso.'
      : (base.motivoTotal ?? 'Falta el comparativo de alguna vertical.');
  return {
    id: 'cascada-ingreso',
    titulo: 'De qué se compone el cambio del ingreso',
    subtitulo: 'Periodo anterior → variación de cada vertical → periodo actual',
    unidad: dineroDe(base),
    datos: { tipo: 'cascada', pasos },
    resumenAccesible: completo
      ? `Cascada: el ingreso pasó de ${m(base, anterior)} a ${m(base, total)}; las barras intermedias son lo que sumó o restó cada vertical.`
      : `Cascada del cambio del ingreso. Sin dato: ${motivo}`,
    filtro: null,
    filtroMotivo: 'Cada barra ya es una vertical; filtrar por ella no cambiaría ningún otro gráfico.',
    info: infoEjemplo({
      definicion: 'Descompone la diferencia de ingreso entre dos periodos en lo que aportó cada vertical.',
      formula: 'Ingreso actual − Ingreso del periodo de comparación, por vertical',
      fuente: FUENTE,
      salvedades: ['El periodo de comparación sale de la variación que declara cada pestaña.'],
    }),
    velas: null,
    velasMotivo: 'Compara dos cortes del periodo; no es una serie con apertura y cierre.',
    sinDatoMotivo: motivo,
  };
}

/* 5 · Avance contra una meta de EJEMPLO (medidor) */
function avanceMeta(base: BaseResumen): ChartSpec {
  const { ctx, total, anterior } = base;
  const referencia = anterior ?? (total === null ? null : total / 1.05);
  const objetivo = 1.06 + rng(hashTexto(`meta:${ctx.periodo}`))() * 0.08;
  const meta = referencia === null ? null : redondear(referencia * objetivo);
  const avance = total === null || meta === null || meta === 0 ? null : redondear((total / meta) * 100, 1);
  return {
    id: 'avance-meta',
    titulo: 'Avance contra la meta de ingreso',
    subtitulo: meta === null ? 'Meta de EJEMPLO' : `Meta de EJEMPLO: ${m(base, meta)}`,
    unidad: { tipo: 'porcentaje' },
    datos: { tipo: 'medidor', nombre: 'Avance de la meta', valor: avance, minimo: 0, maximo: 120, objetivo: 100 },
    resumenAccesible:
      avance === null
        ? 'Medidor de avance contra la meta. Sin dato: falta el ingreso total.'
        : `El ingreso total lleva ${formatearValor(avance, { tipo: 'porcentaje' })} de la meta de ejemplo; la marca está en el 100 %.`,
    filtro: null,
    filtroMotivo: 'Es un único indicador contra una meta: no tiene categorías.',
    info: infoEjemplo({
      definicion: 'Cuánto del objetivo de ingreso se alcanzó en el periodo.',
      formula: 'Ingreso total ÷ Meta × 100',
      numerador: 'Ingreso total del periodo',
      denominador: 'Meta de ingreso del periodo',
      fuente: 'Ingreso total (composición) y una meta de EJEMPLO.',
      salvedades: ['La meta es inventada: el periodo anterior más un crecimiento objetivo de 6 a 14 %. Alovida aún no registra metas.'],
    }),
    velas: null,
    velasMotivo: 'Es un único valor contra una meta; no hay serie.',
    sinDatoMotivo: base.motivoTotal ?? 'Sin ingreso total para medir el avance.',
  };
}

/* 6 · Concentración: top 10 clientes */
function topClientes(base: BaseResumen): ChartSpec {
  const c = concentracionDe(base);
  return {
    id: 'top10-clientes',
    titulo: 'Los 10 clientes que más ingreso aportan',
    subtitulo: c === null ? undefined : `Concentran ${formatearValor(c.pct, { tipo: 'porcentaje' })} del ingreso total`,
    unidad: dineroDe(base),
    datos: {
      tipo: 'cartesiano',
      categorias: c === null ? [] : c.clientes.map((x) => x.nombre),
      series: [{ nombre: 'Ingreso', valores: c === null ? [] : c.clientes.map((x) => x.ingreso), forma: 'barra' }],
      horizontal: true,
    },
    resumenAccesible:
      c === null
        ? 'Barras de los diez mayores clientes. Sin dato: falta el ingreso total.'
        : `Los diez mayores clientes suman ${m(base, c.top10)}, el ${formatearValor(c.pct, { tipo: 'porcentaje' })} del ingreso; el mayor es ${c.clientes[0]!.nombre}.`,
    filtro: { dimension: 'organizacion' },
    info: infoEjemplo({
      definicion: 'Ingreso de los diez clientes (doctores, clínicas, farmacias, laboratorios, aseguradoras) que más aportan.',
      formula: 'Σ ingreso por cliente, ordenado de mayor a menor, primeros 10',
      fuente: 'payments.subscriptions, ads.ad_invoices, broker_commission_statements, directory',
      salvedades: ['Nombres comerciales inventados. El reparto entre clientes es de EJEMPLO.'],
    }),
    velas: null,
    velasMotivo: 'Es un ranking en un corte; no hay serie con apertura y cierre.',
    sinDatoMotivo: base.motivoTotal ?? 'Sin ingreso para repartir entre clientes.',
  };
}

/* 7 · Embudo global de adquisición a ingreso */
function embudo(base: BaseResumen): ChartSpec {
  const kS = buscarKpi(base.lecturas.suscripciones.pestana, 'suscriptores-activos');
  const kA = buscarKpi(base.lecturas.publicidad.pestana, 'anunciantes-activos');
  const nS = kS?.valor ?? null;
  const nA = kA?.valor ?? null;
  const pagantes = nS === null || nA === null ? null : nS + nA;
  const r = rng(hashTexto(`embudo:${base.ctx.periodo}`));
  const paso = (mult: number): number | null =>
    pagantes === null ? null : Math.round(pagantes * mult * (0.95 + r() * 0.1));
  const partes = [
    { nombre: 'Registros', valor: paso(11.5) },
    { nombre: 'Verificados', valor: paso(6.4) },
    { nombre: 'En prueba o con campaña creada', valor: paso(2.3) },
    { nombre: 'Clientes pagantes', valor: pagantes },
  ];
  return {
    id: 'embudo-global',
    titulo: 'Del registro al cliente que paga',
    subtitulo: 'Doctores y anunciantes juntos',
    unidad: { tipo: 'numero' },
    datos: { tipo: 'partes', forma: 'embudo', partes },
    resumenAccesible:
      pagantes === null
        ? 'Embudo de adquisición a ingreso. Sin dato: falta el número de suscriptores o de anunciantes.'
        : `Embudo de ${formatearValor(partes[0]!.valor, { tipo: 'numero' })} registros a ${formatearValor(pagantes, { tipo: 'numero' })} clientes pagantes.`,
    filtro: null,
    filtroMotivo: 'Las etapas del embudo no son una dimensión por la que se pueda filtrar el resto.',
    info: infoEjemplo({
      definicion: 'Cuántas cuentas llegan a cada etapa entre el registro y el primer pago.',
      formula: 'Conteo de cuentas por etapa; la última es suscriptores activos + anunciantes activos',
      fuente: 'identity_assurance, onboarding, payments.subscriptions, ads.ad_accounts',
      salvedades: ['Las etapas previas al pago son de EJEMPLO: la última sí es la del KPI «Clientes activos pagantes».'],
    }),
    velas: null,
    velasMotivo: 'Es un conteo por etapa en un corte; no hay serie con apertura y cierre.',
    sinDatoMotivo: 'Falta el número de suscriptores o de anunciantes activos.',
  };
}

/* 8 · Mapa de calor vertical × mes */
const MESES = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

function calorMensual(base: BaseResumen): ChartSpec {
  const dias = daysInPeriod(base.ctx.periodo);
  const celdas: [number, number, number | null][] = [];
  ORDEN.forEach((c, fila) => {
    const ingreso = base.lecturas[c].ingreso;
    const r = rng(hashTexto(`calor:${c}:${base.ctx.periodo}`));
    MESES.forEach((_, col) => {
      if (ingreso === null) {
        celdas.push([col, fila, null]);
        return;
      }
      const ritmo = (ingreso * 30) / dias; // lo que el periodo equivale a un mes
      const forma = col === MESES.length - 1 ? 1 : (1 - (CRECIMIENTO[c] / 100) * ((MESES.length - 1 - col) / (MESES.length - 1))) * (0.97 + r() * 0.06);
      celdas.push([col, fila, redondear(ritmo * forma)]);
    });
  });
  const hayDato = celdas.some((x) => x[2] !== null);
  return {
    id: 'calor-vertical-mes',
    titulo: 'Ingreso mensual por vertical',
    subtitulo: 'Más oscuro = más ingreso en ese mes',
    unidad: dineroDe(base),
    datos: { tipo: 'mapa-calor', filas: ORDEN.map((c) => NOMBRE_VERTICAL[c]), columnas: MESES, celdas, nombreValor: 'Ingreso del mes' },
    resumenAccesible: hayDato
      ? 'Mapa de calor del ingreso mensual de cada vertical en los últimos seis meses; el mes más reciente es el de mayor ingreso en las tres.'
      : 'Mapa de calor del ingreso mensual. Sin dato: faltan los ingresos de las verticales.',
    filtro: { dimension: 'mes' },
    info: infoEjemplo({
      definicion: 'Ingreso reconocido de cada vertical en cada uno de los últimos seis meses.',
      formula: 'Ingreso del mes por vertical',
      fuente: FUENTE,
      salvedades: ['El último mes equivale al ritmo mensual del periodo elegido; los anteriores son de EJEMPLO.', 'Un mes sin dato queda vacío, no en cero.'],
    }),
    velas: null,
    velasMotivo: 'Es una matriz vertical × mes; no es una serie con apertura y cierre.',
    ancho: 'completo',
    sinDatoMotivo: 'Faltan los ingresos de las verticales para dibujar el mapa.',
  };
}

export function construirGraficos(base: BaseResumen): ChartSpec[] {
  return [
    ingresoEnElTiempo(base),
    mixDeIngresos(base),
    mrrConVelas(base),
    cascada(base),
    avanceMeta(base),
    topClientes(base),
    embudo(base),
    calorMensual(base),
  ];
}
