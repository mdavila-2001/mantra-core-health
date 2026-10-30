import type { ChartSpec, ContextoReporte, InfoCalculo } from '../../../data-access/reporting/reporting.types';
import {
  ESTADOS_FUENTE,
  ETIQUETA_ESTADO,
  ETIQUETA_PESTANA,
  FRESCURA_OBJETIVO_MIN,
  PESTANAS_CATALOGADAS,
  filaCompleta,
  type FilaCatalogo,
} from './calidad.catalogo';
import { UMBRAL_REGLA_PCT, type ReglaEvaluada } from './calidad.reglas';
import { agrupar, fechasDelPeriodo, granularidad, redondear, rng, velasDeSerie } from './reporting-dataset.util';

/* Gráficos de la pestaña «Calidad del dato». Todos nacen del catálogo vivo (calidad.catalogo)
   y de las reglas (calidad.reglas); ninguno pinta un cero donde no hay indicadores. */

const FUENTE =
  'Catálogo vivo armado con los KPI y gráficos de las pestañas Suscripciones, Publicidad, Comisiones, Cobros y Adquisición';
const EJEMPLO = 'Datos de EJEMPLO: el catálogo sale de una maqueta y los estados de la fuente son una suposición, no una verificación.';
const SIN_INDICADORES = 'No hay indicadores en el ámbito elegido: no se puede calcular, y no se muestra como cero.';

const infoDe = (i: Omit<InfoCalculo, 'fuente' | 'frescura'> & Partial<Pick<InfoCalculo, 'fuente'>>): InfoCalculo => ({
  fuente: FUENTE,
  frescura: 'Se recalcula cada vez que se abre la pestaña.',
  ...i,
  salvedades: [...(i.salvedades ?? []), EJEMPLO],
});

const cuenta = (filas: readonly FilaCatalogo[], pred: (f: FilaCatalogo) => boolean): number => filas.filter(pred).length;
const NUMERO = { tipo: 'numero' } as const;
const MIN = { tipo: 'razon', sufijo: ' min' } as const;
const PCT = { tipo: 'porcentaje' } as const;

/** Indicadores por estado de la fuente. Es el origen del filtro: siempre muestra el catálogo entero. */
export function graficoEstadoFuente(todas: readonly FilaCatalogo[]): ChartSpec {
  const hay = todas.length > 0;
  const partes = ESTADOS_FUENTE.map((e) => ({
    nombre: ETIQUETA_ESTADO[e],
    valor: hay ? cuenta(todas, (f) => f.estado === e) : null,
  }));
  const localizadas = cuenta(todas, (f) => f.estado === 'fuente-localizada');
  return {
    id: 'calidad-estado-fuente',
    titulo: 'Indicadores por estado de la fuente',
    subtitulo: 'Haz clic en un estado para ver solo esos indicadores',
    unidad: NUMERO,
    datos: { tipo: 'partes', forma: 'dona', partes },
    resumenAccesible: hay
      ? `De ${todas.length} indicadores, ${localizadas} tienen la fuente localizada y ${todas.length - localizadas} dependen de una vista, una decisión, un dato manual o no tienen fuente.`
      : 'No hay indicadores catalogados todavía.',
    filtro: { dimension: 'estado' },
    info: infoDe({
      definicion: 'Cuántos indicadores hay en cada estado de su fuente de datos.',
      formula: 'Recuento de indicadores agrupados por estado de la fuente',
      fuente: FUENTE,
      salvedades: ['El estado «Fuente localizada» significa que hay una tabla candidata, no que sus columnas estén verificadas.'],
    }),
    velas: null,
    velasMotivo: 'Es un recuento por categoría en un momento dado; no es una serie con apertura y cierre.',
    sinDatoMotivo: SIN_INDICADORES,
    alto: 300,
  };
}

/** Los mismos indicadores, abiertos por pestaña. Barras apiladas: las partes suman el total del estado. */
export function graficoEstadoPestana(todas: readonly FilaCatalogo[]): ChartSpec {
  const hay = todas.length > 0;
  return {
    id: 'calidad-estado-pestana',
    titulo: 'Estado de la fuente según la pestaña',
    subtitulo: 'Cada barra es un estado; sus tramos son las pestañas',
    unidad: NUMERO,
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: ESTADOS_FUENTE.map((e) => ETIQUETA_ESTADO[e]),
      series: PESTANAS_CATALOGADAS.map((p) => ({
        nombre: ETIQUETA_PESTANA[p],
        forma: 'barra' as const,
        apilar: 'pestanas',
        unidad: NUMERO,
        valores: ESTADOS_FUENTE.map((e) => (hay ? cuenta(todas, (f) => f.pestana === p && f.estado === e) : null)),
      })),
    },
    resumenAccesible: hay
      ? `Reparto de ${todas.length} indicadores por estado de la fuente y por pestaña; muestra en qué pestañas se concentran las decisiones pendientes y las vistas por crear.`
      : 'No hay indicadores catalogados todavía.',
    filtro: { dimension: 'estado' },
    info: infoDe({
      definicion: 'Indicadores de cada estado de la fuente, abiertos por la pestaña a la que pertenecen.',
      formula: 'Recuento de indicadores por (estado de la fuente, pestaña)',
    }),
    velas: null,
    velasMotivo: 'Es un recuento por categoría; las velas son para series de saldo o razón en el tiempo.',
    sinDatoMotivo: SIN_INDICADORES,
    alto: 320,
    ancho: 'medio',
  };
}

/** Antigüedad media del dato por pestaña contra su objetivo. */
export function graficoFrescura(filas: readonly FilaCatalogo[]): ChartSpec {
  const media = (p: (typeof PESTANAS_CATALOGADAS)[number]): number | null => {
    const delTab = filas.filter((f) => f.pestana === p);
    return delTab.length === 0 ? null : Math.round(delTab.reduce((a, f) => a + f.frescuraMin, 0) / delTab.length);
  };
  const medias = PESTANAS_CATALOGADAS.map(media);
  const pasadas = PESTANAS_CATALOGADAS.filter((p, i) => medias[i] !== null && medias[i]! > FRESCURA_OBJETIVO_MIN[p]).map((p) => ETIQUETA_PESTANA[p]);
  return {
    id: 'calidad-frescura-pestana',
    titulo: 'Frescura del dato por pestaña',
    subtitulo: 'Minutos desde la última carga, contra el objetivo de cada pestaña',
    unidad: MIN,
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: PESTANAS_CATALOGADAS.map((p) => ETIQUETA_PESTANA[p]),
      series: [
        { nombre: 'Antigüedad del dato', forma: 'barra', unidad: MIN, valores: medias },
        {
          nombre: 'Objetivo de frescura',
          forma: 'barra',
          unidad: MIN,
          valores: PESTANAS_CATALOGADAS.map((p, i) => (medias[i] === null ? null : FRESCURA_OBJETIVO_MIN[p])),
        },
      ],
    },
    resumenAccesible: medias.every((m) => m === null)
      ? 'No hay indicadores con frescura medible.'
      : pasadas.length === 0
        ? 'Todas las pestañas con indicadores están dentro de su objetivo de frescura.'
        : `Fuera de su objetivo de frescura: ${pasadas.join(', ')}. Las demás pestañas están dentro.`,
    filtro: null,
    filtroMotivo: 'Las barras son pestañas y el portal no filtra por pestaña; el estado de la fuente se filtra desde los gráficos de arriba.',
    info: infoDe({
      definicion: 'Minutos que pasaron entre la última carga de la fuente y este informe, comparados con el objetivo acordado para cada pestaña.',
      formula: 'Promedio de minutos desde la última carga de los indicadores de la pestaña',
      salvedades: ['Las antigüedades y los objetivos son valores inventados para la maqueta, no mediciones.'],
    }),
    velas: null,
    velasMotivo: 'Es una foto de la antigüedad actual; no tiene apertura ni cierre.',
    sinDatoMotivo: SIN_INDICADORES,
    alto: 300,
  };
}

/** Cobertura de definición: % de indicadores con su definición completa. */
export function graficoCobertura(filas: readonly FilaCatalogo[]): ChartSpec {
  const valor = filas.length === 0 ? null : redondear((cuenta(filas, filaCompleta) / filas.length) * 100, 1);
  return {
    id: 'calidad-cobertura-definicion',
    titulo: 'Cobertura de definición',
    subtitulo: 'Indicadores con definición, fórmula, fuente y frescura declaradas',
    unidad: PCT,
    datos: { tipo: 'medidor', nombre: 'Definición completa', valor, minimo: 0, maximo: 100, objetivo: 100 },
    resumenAccesible:
      valor === null
        ? 'No hay indicadores para medir la cobertura de definición.'
        : `${valor} % de los ${filas.length} indicadores tiene su definición completa; el objetivo es 100 %.`,
    filtro: null,
    filtroMotivo: 'Es un único valor; no hay categorías que elegir.',
    info: infoDe({
      definicion: 'Porcentaje de indicadores que declaran todo lo que un indicador necesita para significar lo mismo en toda la empresa.',
      formula: 'Indicadores con definición completa ÷ indicadores catalogados × 100',
      numerador: 'Indicadores con definición, fórmula, fuente y frescura (y numerador y denominador si son tasa)',
      denominador: 'Indicadores catalogados en el ámbito elegido',
    }),
    velas: null,
    velasMotivo: 'Es el valor de hoy; la serie en el tiempo de completitud está en el gráfico de velas.',
    sinDatoMotivo: SIN_INDICADORES,
    alto: 260,
  };
}

function etiquetasDelPeriodo(ctx: ContextoReporte): { fechas: string[]; gran: ReturnType<typeof granularidad> } {
  return { fechas: fechasDelPeriodo(ctx.periodo), gran: granularidad(ctx.periodo) };
}

/** Corridas de reglas pasadas y falladas por periodo. La última barra es el estado actual, calculado. */
export function graficoReglasEnElTiempo(ctx: ContextoReporte, reglas: readonly ReglaEvaluada[]): ChartSpec {
  const evaluadas = reglas.filter((r) => r.resultado !== 'sin-evaluar');
  const total = evaluadas.length;
  const fallan = evaluadas.filter((r) => r.resultado === 'falla').length;
  const { fechas, gran } = etiquetasDelPeriodo(ctx);
  const etiquetas = agrupar(fechas, fechas.map(() => 0), gran, 'suma').etiquetas;
  const r = rng(4401);
  const falladas = etiquetas.map((_, i) => {
    if (i === etiquetas.length - 1) return fallan;
    const margen = 1 - i / (etiquetas.length - 1); // antes había más fallos
    return Math.max(0, Math.min(total, fallan + Math.round((r() * 2 - 0.6) * margen * 2)));
  });
  const hay = total > 0;
  return {
    id: 'calidad-reglas-tiempo',
    titulo: 'Reglas de calidad pasadas y falladas',
    subtitulo: 'Una corrida de todas las reglas por periodo',
    unidad: NUMERO,
    datos: {
      tipo: 'cartesiano',
      categorias: etiquetas,
      series: [
        { nombre: 'Pasadas', forma: 'barra', apilar: 'corridas', unidad: NUMERO, valores: hay ? falladas.map((f) => total - f) : etiquetas.map(() => null) },
        { nombre: 'Falladas', forma: 'barra', apilar: 'corridas', unidad: NUMERO, valores: hay ? falladas : etiquetas.map(() => null) },
      ],
    },
    resumenAccesible: hay
      ? `En la corrida más reciente fallan ${fallan} de ${total} reglas evaluadas; las barras anteriores son un historial de EJEMPLO.`
      : 'No hay reglas evaluables en el ámbito elegido.',
    filtro: null,
    filtroMotivo: 'Las barras son periodos; ningún otro bloque de esta pestaña se reparte por periodo.',
    info: infoDe({
      definicion: 'Cuántas reglas de calidad pasaron y cuántas fallaron en cada corrida.',
      formula: 'Reglas con cumplimiento mínimo ≥ umbral (pasadas) y < umbral (falladas), por corrida',
      salvedades: [`Una regla pasa si todas las pestañas a las que aplica cumplen al menos ${UMBRAL_REGLA_PCT} %.`, 'Solo la última barra se calcula del catálogo; el historial anterior es inventado.'],
    }),
    velas: null,
    velasMotivo: 'Los recuentos de reglas se suman por corrida; no son un saldo ni una razón con apertura y cierre.',
    sinDatoMotivo: SIN_INDICADORES,
    alto: 300,
  };
}

/** Completitud de las columnas obligatorias de las fuentes: una razón, por eso admite velas. */
export function graficoCompletitud(ctx: ContextoReporte, filas: readonly FilaCatalogo[]): ChartSpec {
  const { fechas, gran } = etiquetasDelPeriodo(ctx);
  const hay = filas.length > 0;
  const localizadas = hay ? cuenta(filas, (f) => f.estado === 'fuente-localizada') / filas.length : 0;
  const base = 93 + 5 * localizadas;
  const r = rng(7702);
  const diaria = fechas.map((_, i) => redondear(Math.min(100, base + 0.8 * (i / Math.max(1, fechas.length - 1)) + (r() - 0.5) * 1.2), 2));
  const puntos = agrupar(fechas, diaria, gran, 'ultimo');
  return {
    id: 'calidad-completitud-fuentes',
    titulo: 'Completitud de las fuentes',
    subtitulo: '% de filas con todos sus campos obligatorios',
    unidad: PCT,
    datos: {
      tipo: 'cartesiano',
      categorias: puntos.etiquetas,
      series: [{ nombre: 'Completitud', forma: 'linea', unidad: PCT, valores: hay ? puntos.valores : puntos.valores.map(() => null) }],
    },
    resumenAccesible: hay
      ? `La completitud de las fuentes termina el periodo en ${diaria[diaria.length - 1]} %, de EJEMPLO; sube cuando más indicadores tienen su fuente localizada.`
      : 'No hay indicadores en el ámbito elegido, así que no hay serie de completitud.',
    filtro: null,
    filtroMotivo: 'Es una serie en el tiempo de un solo indicador; no hay categorías que elegir.',
    info: infoDe({
      definicion: 'Proporción de filas de las tablas de origen que traen todos los campos obligatorios.',
      formula: 'Filas con todos los campos obligatorios ÷ filas leídas × 100',
      numerador: 'Filas con todos los campos obligatorios',
      denominador: 'Filas leídas de la fuente en el día',
      salvedades: ['La serie es inventada; en ella influye cuántos indicadores del ámbito tienen la fuente localizada.'],
    }),
    velas: hay
      ? {
          explicacion: 'Completitud: apertura, máximo, mínimo y cierre de cada tramo del periodo.',
          velas: velasDeSerie(fechas, diaria, gran),
          subirEsMalo: false,
        }
      : null,
    velasMotivo: hay ? undefined : 'Sin indicadores en el ámbito no hay serie con la que dibujar velas.',
    sinDatoMotivo: SIN_INDICADORES,
    alto: 300,
  };
}

/** Reglas × pestaña. Una celda vacía es «no aplica» o «sin indicadores», nunca 0. */
export function graficoMapaReglas(reglas: readonly ReglaEvaluada[]): ChartSpec {
  const celdas = reglas.flatMap((regla, fila) =>
    regla.celdas.map((valor, col) => [col, fila, valor] as const),
  );
  const falla = reglas.filter((r) => r.resultado === 'falla').map((r) => r.nombre);
  return {
    id: 'calidad-mapa-reglas',
    titulo: 'Cumplimiento de cada regla por pestaña',
    subtitulo: 'Celda vacía: la regla no aplica o la pestaña no tiene indicadores',
    unidad: PCT,
    datos: {
      tipo: 'mapa-calor',
      filas: reglas.map((r) => r.nombre),
      columnas: PESTANAS_CATALOGADAS.map((p) => ETIQUETA_PESTANA[p]),
      celdas,
      nombreValor: 'Cumplimiento',
    },
    resumenAccesible:
      falla.length === 0
        ? 'Ninguna regla evaluada está por debajo del umbral de cumplimiento.'
        : `Reglas por debajo del umbral de ${UMBRAL_REGLA_PCT} %: ${falla.join('; ')}.`,
    filtro: null,
    filtroMotivo: 'Las filas son reglas y el portal no tiene un filtro por regla.',
    info: infoDe({
      definicion: 'Porcentaje de verificaciones cumplidas por cada regla de calidad en cada pestaña.',
      formula: 'Verificaciones cumplidas ÷ verificaciones hechas × 100, por (regla, pestaña)',
      numerador: 'Verificaciones cumplidas',
      denominador: 'Verificaciones hechas',
      salvedades: ['Cinco reglas se calculan del catálogo; las demás tienen resultados de EJEMPLO escritos a mano.'],
    }),
    velas: null,
    velasMotivo: 'Es una matriz de cumplimiento en un momento dado; no es una serie en el tiempo.',
    sinDatoMotivo: 'Ninguna regla se pudo evaluar: no hay indicadores en el ámbito elegido.',
    alto: 380,
    ancho: 'completo',
  };
}
