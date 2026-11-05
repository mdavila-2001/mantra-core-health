import type {
  ContextoReporte,
  InfoCalculo,
  KpiSpec,
  PestanaReporte,
  TablaReporte,
} from '../../../data-access/reporting/reporting.types';
import {
  STATUS_LABEL,
  ETIQUETA_PESTANA,
  PESTANAS_CATALOGADAS,
  armarCatalogo,
  filaCompleta,
  filterByStatus,
  leerPestanas,
  type CatalogoLeido,
  type FilaCatalogo,
  type PestanasLeidas,
} from './calidad.catalogo';
import {
  graficoCobertura,
  graficoCompletitud,
  sourceStatusChart,
  tabStatusChart,
  graficoFrescura,
  graficoMapaReglas,
  rulesOverTimeChart,
} from './calidad.graficos';
import { ETIQUETA_RESULTADO, UMBRAL_REGLA_PCT, evaluarReglas, type ReglaEvaluada } from './calidad.reglas';
import { kpi, redondear, variacionContexto } from './reporting-dataset.util';

/* ============================================================================
    Pestaña 7 — Calidad del dato y definiciones (datos de EJEMPLO).

    Es el catálogo de indicadores como código del plan (§1.4, patrón
    AtlasDashboards): para que «MRR» signifique lo mismo en toda la empresa y
    para que un indicador sin fuente se vea como un hueco, no como un cero.
    El catálogo se lee de las otras pestañas; esta no se autocataloga.
    ========================================================================== */

const FUENTE_CATALOGO =
  'Catálogo vivo de esta maqueta, armado con los KPI y gráficos de las otras pestañas del dashboard comercial';
const EJEMPLO = 'Datos de EJEMPLO: los estados de la fuente, los responsables y las frescuras son suposiciones, no verificaciones contra el API.';
const NO_INDICATORS = 'No hay indicadores en el ámbito elegido; el cálculo necesita al menos uno.';

const info = (i: Omit<InfoCalculo, 'fuente' | 'frescura'>): InfoCalculo => ({
  fuente: FUENTE_CATALOGO,
  frescura: 'Se recalcula cada vez que se abre la pestaña.',
  ...i,
  salvedades: [...(i.salvedades ?? []), EJEMPLO],
});

function pct(parte: number, total: number): number | null {
  return total === 0 ? null : redondear((parte / total) * 100, 1);
}

function construirKpis(ctx: ContextoReporte, filas: readonly FilaCatalogo[], reglas: readonly ReglaEvaluada[]): KpiSpec[] {
  const total = filas.length;
  const completas = filas.filter(filaCompleta).length;
  const localizadas = filas.filter((f) => f.estado === 'fuente-localizada').length;
  const pendientes = filas.filter((f) => f.estado === 'decision-pendiente').length;
  const needsView = filas.filter((f) => f.estado === 'requiere-vista').length;
  const antiguedad = total === 0 ? null : redondear(filas.reduce((a, f) => a + f.frescuraMin, 0) / total, 1);
  const evaluadas = reglas.filter((r) => r.resultado !== 'sin-evaluar');
  const enFalla = evaluadas.filter((r) => r.resultado === 'falla').length;
  const withVariation = (valor: number | null, semilla: number): number | null =>
    valor === null || valor <= 0 ? null : variacionContexto(ctx, valor, semilla);

  return [
    kpi({
      id: 'indicadores-catalogados',
      titulo: 'Indicadores catalogados',
      valor: total,
      unidad: { tipo: 'numero' },
      variacionPct: withVariation(total, 701),
      info: info({
        definicion: 'Cantidad de KPI y gráficos de las pestañas comerciales que están en el catálogo con su definición.',
        formula: 'Σ (KPI + gráficos) de las pestañas catalogadas, dentro del filtro de estado activo',
        salvedades: ['Cuenta indicadores, no cifras: no dice nada de si los números son correctos.'],
      }),
    }),
    kpi({
      id: 'definicion-completa-pct',
      titulo: 'Con definición completa',
      valor: pct(completas, total),
      unidad: { tipo: 'porcentaje' },
      variacionPct: withVariation(pct(completas, total), 702),
      numerador: total === 0 ? null : completas,
      denominador: total === 0 ? null : total,
      motivoSinDato: total === 0 ? NO_INDICATORS : undefined,
      info: info({
        definicion: 'Porcentaje de indicadores que declaran definición, fórmula, fuente y frescura (y numerador y denominador si son tasa).',
        formula: 'Indicadores con definición completa ÷ indicadores catalogados × 100',
        numerador: 'Indicadores con definición completa',
        denominador: 'Indicadores catalogados',
      }),
    }),
    kpi({
      id: 'fuente-localizada-pct',
      titulo: 'Con fuente localizada',
      valor: pct(localizadas, total),
      unidad: { tipo: 'porcentaje' },
      variacionPct: withVariation(pct(localizadas, total), 703),
      numerador: total === 0 ? null : localizadas,
      denominador: total === 0 ? null : total,
      motivoSinDato: total === 0 ? NO_INDICATORS : undefined,
      info: info({
        definicion: 'Porcentaje de indicadores con una tabla candidata localizada en el API.',
        formula: 'Indicadores en estado «Fuente localizada» ÷ indicadores catalogados × 100',
        numerador: 'Indicadores en estado «Fuente localizada»',
        denominador: 'Indicadores catalogados',
        salvedades: ['«Localizada» no es «verificada»: las columnas todavía no se leyeron.'],
      }),
    }),
    kpi({
      id: 'decision-pendiente',
      titulo: 'Con decisión de negocio pendiente',
      valor: pendientes,
      unidad: { tipo: 'numero' },
      variacionPct: withVariation(pendientes, 704),
      subirEsMalo: true,
      info: info({
        definicion: 'Indicadores que no se pueden calcular hasta que negocio decida qué se mide (comisión por actor, publicidad push propia…).',
        formula: 'Σ indicadores en estado «Decisión pendiente»',
      }),
    }),
    kpi({
      id: 'requiere-vista',
      titulo: 'Que requieren una vista nueva',
      valor: needsView,
      unidad: { tipo: 'numero' },
      variacionPct: withVariation(needsView, 705),
      subirEsMalo: true,
      info: info({
        definicion: 'Indicadores cuya fuente habría que exponer en una vista de lectura que hoy no existe.',
        formula: 'Σ indicadores en estado «Requiere vista»',
      }),
    }),
    kpi({
      id: 'antiguedad-media-datos',
      titulo: 'Antigüedad media de los datos',
      valor: antiguedad,
      unidad: { tipo: 'razon', sufijo: ' min' },
      variacionPct: withVariation(antiguedad, 706),
      subirEsMalo: true,
      motivoSinDato: antiguedad === null ? NO_INDICATORS : undefined,
      info: info({
        definicion: 'Minutos promedio desde la última carga de los indicadores catalogados.',
        formula: 'Σ minutos desde la última carga ÷ indicadores catalogados',
        numerador: 'Minutos desde la última carga, sumados por indicador',
        denominador: 'Indicadores catalogados',
        salvedades: ['Las antigüedades por indicador son inventadas para la maqueta.'],
      }),
    }),
    kpi({
      id: 'reglas-en-falla',
      titulo: 'Reglas de calidad en falla',
      valor: evaluadas.length === 0 ? null : enFalla,
      unidad: { tipo: 'numero' },
      variacionPct: withVariation(evaluadas.length === 0 ? null : enFalla, 707),
      subirEsMalo: true,
      numerador: evaluadas.length === 0 ? null : enFalla,
      denominador: evaluadas.length === 0 ? null : evaluadas.length,
      motivoSinDato: evaluadas.length === 0 ? 'Ninguna regla se pudo evaluar: no hay indicadores en el ámbito elegido.' : undefined,
      info: info({
        definicion: `Reglas cuyo peor cumplimiento por pestaña está por debajo de ${UMBRAL_REGLA_PCT} %.`,
        formula: 'Reglas evaluadas con cumplimiento mínimo < umbral',
        numerador: 'Reglas en falla',
        denominador: 'Reglas evaluadas',
        salvedades: ['Una regla «sin evaluar» no cuenta ni como pasada ni como fallada.'],
      }),
    }),
  ];
}

function tablaCatalogo(filas: readonly FilaCatalogo[]): TablaReporte {
  return {
    id: 'calidad-catalogo-indicadores',
    titulo: 'Catálogo de indicadores',
    columnas: [
      { clave: 'id', etiqueta: 'Código' },
      { clave: 'pestana', etiqueta: 'Pestaña' },
      { clave: 'tipo', etiqueta: 'Tipo' },
      { clave: 'titulo', etiqueta: 'Indicador' },
      { clave: 'formula', etiqueta: 'Fórmula' },
      { clave: 'numerador', etiqueta: 'Numerador' },
      { clave: 'denominador', etiqueta: 'Denominador' },
      { clave: 'fuente', etiqueta: 'Fuente' },
      { clave: 'responsable', etiqueta: 'Responsable' },
      { clave: 'frescuraMin', etiqueta: 'Antigüedad (min)', alinear: 'der' },
      { clave: 'estado', etiqueta: 'Estado de la fuente' },
      { clave: 'definicion', etiqueta: 'Definición' },
    ],
    filas: filas.map((f) => ({
      id: f.id,
      pestana: ETIQUETA_PESTANA[f.pestana],
      tipo: f.tipo,
      titulo: f.titulo,
      formula: f.formula,
      numerador: f.numerador,
      denominador: f.denominador,
      fuente: f.fuente,
      responsable: f.responsable,
      frescuraMin: f.frescuraMin,
      estado: STATUS_LABEL[f.estado],
      definicion: filaCompleta(f) ? 'Completa' : `Falta: ${f.faltan.join(', ')}`,
    })),
    info: info({
      definicion: 'Una fila por cada KPI y gráfico de las pestañas comerciales, con lo que dice de sí mismo y el estado supuesto de su fuente.',
      formula: 'Fórmula, numerador, denominador y fuente tal como cada indicador los declara; una celda vacía es algo que el indicador no declara',
      salvedades: [
        'El estado de la fuente, el responsable y la antigüedad son SUPOSICIONES de EJEMPLO.',
        '«No aplica» en numerador y denominador significa que el indicador no es una tasa.',
      ],
    }),
  };
}

function tablaReglas(reglas: readonly ReglaEvaluada[]): TablaReporte {
  return {
    id: 'calidad-reglas',
    titulo: 'Reglas de calidad',
    columnas: [
      { clave: 'regla', etiqueta: 'Regla' },
      { clave: 'alcance', etiqueta: 'Alcance' },
      { clave: 'resultado', etiqueta: 'Resultado' },
      { clave: 'cumplimientoMin', etiqueta: 'Peor cumplimiento (%)', alinear: 'der' },
      { clave: 'ultimaCorrida', etiqueta: 'Última corrida' },
      { clave: 'origen', etiqueta: 'Cómo se obtuvo' },
    ],
    filas: reglas.map((r) => ({
      regla: r.nombre,
      alcance: r.alcance,
      resultado: ETIQUETA_RESULTADO[r.resultado],
      cumplimientoMin: r.minimo,
      ultimaCorrida: r.ultimaCorrida,
      origen: r.origen === 'catalogo' ? 'Calculada del catálogo' : 'Resultado simulado (EJEMPLO)',
    })),
    info: info({
      definicion: 'Cada regla con su resultado según el peor cumplimiento entre las pestañas a las que aplica.',
      formula: `Pasa si el cumplimiento de todas las pestañas aplicables ≥ ${UMBRAL_REGLA_PCT} %; falla si alguna queda por debajo`,
      salvedades: ['Las reglas «simuladas» no corrieron contra ninguna base: sus resultados están escritos a mano.'],
    }),
  };
}

function buildWarnings(leido: CatalogoLeido): string[] {
  const avisos = [
    'Datos de EJEMPLO: este catálogo describe una maqueta. Los estados de la fuente son suposiciones; ninguna tabla del API se verificó.',
    'El Resumen ejecutivo y esta pestaña no se catalogan aquí: el Resumen reusa indicadores de las demás y esta no se autocataloga.',
  ];
  for (const p of leido.unread) {
    avisos.push(`No se pudo leer la pestaña ${ETIQUETA_PESTANA[p]}; sus indicadores faltan en el catálogo.`);
  }
  if (leido.filas.length === 0 && leido.unread.length < PESTANAS_CATALOGADAS.length) {
    avisos.push('Las otras pestañas todavía no publican indicadores: el catálogo está vacío, y eso no es una nota perfecta de calidad.');
  }
  return avisos;
}

/** Puro: arma la pestaña a partir de lo que las otras pestañas publicaron. Lo usa la prueba con datos propios. */
export function buildQualityFromTabs(ctx: ContextoReporte, pestanas: PestanasLeidas): PestanaReporte {
  const leido = armarCatalogo(pestanas);
  const enAmbito = filterByStatus(leido.filas, ctx);
  const reglas = evaluarReglas(enAmbito);
  return {
    pestana: 'calidad',
    generadoEn: '2026-10-30T09:00:00-04:00',
    origen: 'ejemplo',
    kpis: construirKpis(ctx, enAmbito, reglas),
    graficos: [
      graficoCobertura(enAmbito),
      sourceStatusChart(leido.filas),
      tabStatusChart(leido.filas),
      graficoFrescura(enAmbito),
      rulesOverTimeChart(ctx, reglas),
      graficoCompletitud(ctx, enAmbito),
      graficoMapaReglas(reglas),
    ],
    tablas: [tablaCatalogo(enAmbito), tablaReglas(reglas)],
    avisos: buildWarnings(leido),
    secciones: [
      {
        titulo: 'Definiciones',
        descripcion: 'Qué significa cada indicador y qué tan completa está su definición.',
        graficos: ['calidad-cobertura-definicion'],
        tablas: ['calidad-catalogo-indicadores'],
      },
      {
        titulo: 'Estado de las fuentes',
        descripcion: 'De dónde saldría cada número y qué falta para que salga de verdad.',
        graficos: ['calidad-estado-fuente', 'calidad-estado-pestana'],
      },
      {
        titulo: 'Frescura y reglas',
        descripcion: 'Qué tan al día llega el dato y qué reglas de calidad se cumplen.',
        graficos: ['calidad-frescura-pestana', 'calidad-reglas-tiempo', 'calidad-completitud-fuentes', 'calidad-mapa-reglas'],
        tablas: ['calidad-reglas'],
      },
    ],
  };
}

export function construirCalidad(ctx: ContextoReporte): PestanaReporte {
  return buildQualityFromTabs(ctx, leerPestanas());
}
