import { formatearValor, formatearVariacion } from '../../../data-access/reporting/reporting-format';
import type { ContextoReporte, TablaReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { ANUNCIOS, CAMPANAS } from './publicidad.catalogo';
import { aMoneda, aMonedaNull, calcularModeracion, info, unidadMoneda } from './publicidad.comun';
import { razon, type FilaCampana, type Modelo } from './publicidad.modelo';
import { variacionPct, suma } from './reporting-dataset.util';

/** Resultado mínimo de un anuncio para que su costo por resultado se compare. */
const MIN_RESULTADOS_ANUNCIO = 5;

/** Texto con unidad, o `null` cuando no hay dato (la tabla lo muestra como «Sin dato», nunca como 0). */
function f(valor: number | null, unidad: UnidadValor): string | null {
  return valor === null ? null : formatearValor(valor, unidad);
}

const NUM: UnidadValor = { tipo: 'numero' };
const PCT: UnidadValor = { tipo: 'porcentaje' };
const ROAS: UnidadValor = { tipo: 'razon', sufijo: ' ×' };

export function tablaCampanas(ctx: ContextoReporte, m: Modelo): TablaReporte {
  const moneda = unidadMoneda(ctx);
  const orden = [...m.filas].sort((a, b) => b.gasto - a.gasto || a.indice - b.indice);
  const filas = orden.map((r: FilaCampana) => {
    const cpmBob = razon(r.gasto, r.impresiones);
    const roas = r.citas !== null && r.citas > 0 ? razon(r.valor, r.gasto) : null;
    return {
      campana: r.campana.nombre,
      anunciante: `${r.anunciante.nombre} · ${r.anunciante.tipo}`,
      objetivo: r.campana.objetivo,
      entrega: r.campana.estado,
      presupuesto: f(aMonedaNull(ctx, r.presupuesto), moneda),
      gastado: f(aMoneda(ctx, r.gasto), moneda),
      pacing: f(r.campana.pacing === null || !r.entrega ? null : r.campana.pacing * 100, PCT),
      alcance: f(r.alcance, NUM),
      impresiones: f(r.impresiones, NUM),
      frecuencia: f(razon(r.impresiones, r.alcance), { tipo: 'razon', sufijo: '' }),
      cpm: f(aMonedaNull(ctx, cpmBob === null ? null : cpmBob * 1000), moneda),
      ctr: f(r.clics === null ? null : razon(r.clics * 100, r.impresiones), PCT),
      cpc: f(aMonedaNull(ctx, razon(r.gasto, r.clics)), moneda),
      resultados: f(r.resultados, NUM),
      tipoResultado: r.tipoResultado,
      costoResultado: f(aMonedaNull(ctx, razon(r.gasto, r.resultados)), moneda),
      roas: f(roas, ROAS),
    };
  });
  return {
    id: 'pub-tabla-campanas',
    titulo: 'Campañas',
    columnas: [
      { clave: 'campana', etiqueta: 'Campaña' },
      { clave: 'anunciante', etiqueta: 'Anunciante' },
      { clave: 'objetivo', etiqueta: 'Objetivo' },
      { clave: 'entrega', etiqueta: 'Entrega' },
      { clave: 'presupuesto', etiqueta: 'Presupuesto', alinear: 'der' },
      { clave: 'gastado', etiqueta: 'Gastado', alinear: 'der' },
      { clave: 'pacing', etiqueta: 'Pacing', alinear: 'der' },
      { clave: 'alcance', etiqueta: 'Alcance', alinear: 'der' },
      { clave: 'impresiones', etiqueta: 'Impresiones', alinear: 'der' },
      { clave: 'frecuencia', etiqueta: 'Frecuencia', alinear: 'der' },
      { clave: 'cpm', etiqueta: 'CPM', alinear: 'der' },
      { clave: 'ctr', etiqueta: 'CTR (enlace)', alinear: 'der' },
      { clave: 'cpc', etiqueta: 'CPC', alinear: 'der' },
      { clave: 'resultados', etiqueta: 'Resultados', alinear: 'der' },
      { clave: 'tipoResultado', etiqueta: 'Tipo de resultado' },
      { clave: 'costoResultado', etiqueta: 'Costo por resultado', alinear: 'der' },
      { clave: 'roas', etiqueta: 'ROAS', alinear: 'der' },
    ],
    filas,
    info: info({
      definicion: 'Las campañas con las columnas de un gestor de anuncios: objetivo, estado de entrega, presupuesto, gasto, alcance, frecuencia y costos.',
      formula: 'CPM = gasto ÷ impresiones × 1000 · CTR = clics ÷ impresiones · CPC = gasto ÷ clics · Costo por resultado = gasto ÷ resultados · ROAS = valor atribuido ÷ gasto',
      fuente: 'ads.campaigns · ads.ad_sets · ads.insights_daily',
      salvedades: [
        '«Sin dato» no es cero: una campaña en revisión, rechazada o sin entrega no tiene impresiones ni costos.',
        'El resultado depende del objetivo: citas agendadas, clientes potenciales o personas alcanzadas; no se suman entre sí.',
        'ROAS solo existe donde hay citas con valor atribuido (objetivo «Citas agendadas»).',
        'El alcance total no es la suma de las filas: una persona alcanzada por dos campañas cuenta una vez.',
      ],
    }),
  };
}

export function tablaAnunciosPeorCosto(ctx: ContextoReporte, m: Modelo): TablaReporte {
  const moneda = unidadMoneda(ctx);
  const candidatos = ANUNCIOS.flatMap((a) => {
    const fila = m.filas.find((r) => r.indice === a.campana);
    if (fila === undefined || fila.resultados === null || fila.resultados <= 0 || fila.gasto <= 0) {
      return [];
    }
    const denominador = suma(ANUNCIOS.filter((x) => x.campana === a.campana).map((x) => x.peso / x.sesgoCosto));
    const resultados = (fila.resultados * (a.peso / a.sesgoCosto)) / denominador;
    const gasto = fila.gasto * a.peso;
    const costo = gasto / resultados;
    const costoCampana = fila.gasto / fila.resultados;
    return resultados >= MIN_RESULTADOS_ANUNCIO ? [{ a, fila, resultados, gasto, costo, delta: variacionPct(costo, costoCampana) }] : [];
  });
  const peores = candidatos.sort((x, y) => (y.delta ?? 0) - (x.delta ?? 0)).slice(0, 8);
  return {
    id: 'pub-tabla-anuncios',
    titulo: 'Anuncios con peor costo por resultado',
    columnas: [
      { clave: 'anuncio', etiqueta: 'Anuncio' },
      { clave: 'campana', etiqueta: 'Campaña' },
      { clave: 'conjunto', etiqueta: 'Conjunto de anuncios' },
      { clave: 'formato', etiqueta: 'Formato' },
      { clave: 'gastado', etiqueta: 'Gastado', alinear: 'der' },
      { clave: 'resultados', etiqueta: 'Resultados', alinear: 'der' },
      { clave: 'tipoResultado', etiqueta: 'Tipo de resultado' },
      { clave: 'costoResultado', etiqueta: 'Costo por resultado', alinear: 'der' },
      { clave: 'contraCampana', etiqueta: 'Contra su campaña', alinear: 'der' },
    ],
    filas: peores.map(({ a, fila, resultados, gasto, costo, delta }) => ({
      anuncio: a.nombre,
      campana: CAMPANAS[a.campana]!.nombre,
      conjunto: a.conjunto,
      formato: a.formato,
      gastado: f(aMoneda(ctx, gasto), moneda),
      resultados: f(resultados, NUM),
      tipoResultado: fila.tipoResultado,
      costoResultado: f(aMoneda(ctx, costo), moneda),
      contraCampana: delta === null ? null : formatearVariacion(delta),
    })),
    info: info({
      definicion: 'Los anuncios que cuestan más por resultado que el promedio de su propia campaña: candidatos a pausar o rehacer.',
      formula: 'Contra su campaña = costo por resultado del anuncio ÷ costo por resultado de la campaña − 1',
      numerador: 'Gasto del anuncio',
      denominador: 'Resultados del anuncio (citas, clientes potenciales o personas alcanzadas)',
      fuente: 'ads.ads · ads.ad_sets · ads.insights_daily',
      salvedades: [`Solo anuncios con al menos ${MIN_RESULTADOS_ANUNCIO} resultados en el periodo; con menos, el costo no es comparable y no se muestra.`],
    }),
  };
}

export function tablaModeracion(m: Modelo): TablaReporte {
  const mo = calcularModeracion(m);
  const fila = (motivo: string, r: number, a: number, g: number, c: number) => ({
    motivo,
    rechazados: f(r, NUM),
    corregidos: f(c, NUM),
    apelados: f(a, NUM),
    ganadas: f(g, NUM),
    tasaGanada: f(a > 0 ? (g / a) * 100 : null, PCT),
  });
  return {
    id: 'pub-tabla-moderacion',
    titulo: 'Rechazos y apelaciones por motivo',
    columnas: [
      { clave: 'motivo', etiqueta: 'Motivo de la política' },
      { clave: 'rechazados', etiqueta: 'Rechazados', alinear: 'der' },
      { clave: 'corregidos', etiqueta: 'Corregidos', alinear: 'der' },
      { clave: 'apelados', etiqueta: 'Apelados', alinear: 'der' },
      { clave: 'ganadas', etiqueta: 'Apelaciones ganadas', alinear: 'der' },
      { clave: 'tasaGanada', etiqueta: 'Apelaciones ganadas (%)', alinear: 'der' },
    ],
    filas: [
      ...mo.filas.map((x) => fila(x.motivo, x.rechazados, x.apelados, x.ganadas, x.corregidos)),
      fila('Total', mo.rechazados, mo.apelados, mo.ganadas, mo.corregidos),
    ],
    info: info({
      definicion: 'Por qué se rechazan anuncios de salud y cuántas apelaciones prosperan.',
      formula: 'Apelaciones ganadas (%) = apelaciones ganadas ÷ apelados',
      numerador: 'Apelaciones resueltas a favor del anunciante',
      denominador: 'Anuncios apelados',
      fuente: 'ads.ad_policy_violations · ads.ad_policy_appeals · ads.ad_review_events',
      salvedades: ['Con cero apelados el porcentaje queda «Sin dato», no en 0 %.'],
    }),
  };
}
