import type { ChartSpec, ContextoReporte } from '../../../data-access/reporting/reporting.types';
import { CIUDADES, ESTADOS } from './publicidad.catalogo';
import { aMoneda, calcularModeracion, info, unidadMoneda } from './publicidad.comun';
import { anunciantesConGasto, type Modelo } from './publicidad.modelo';
import { redondear } from './reporting-dataset.util';

/* Campañas y moderación. Cada gráfico categórico recibe el modelo SIN su propio
   filtro, para conservar todas sus barras y poder resaltar la elegida. */

const NO_SERIE = 'Compara entidades en el mismo momento; no es una serie de saldo o razón en el tiempo.';

export function graficoPorCampana(ctx: ContextoReporte, m: Modelo): ChartSpec {
  const filas = m.filas.filter((f) => f.gasto > 0).sort((a, b) => b.gasto - a.gasto);
  return {
    id: 'pub-por-campana',
    titulo: 'Gasto por campaña',
    unidad: unidadMoneda(ctx),
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: filas.map((f) => f.campana.nombre),
      series: [{ nombre: 'Gasto', forma: 'barra', valores: filas.map((f) => aMoneda(ctx, f.gasto)) }],
    },
    resumenAccesible: 'Las campañas ordenadas por gasto: unas pocas concentran la mayor parte de lo invertido. Haz clic en una para filtrar toda la pestaña.',
    filtro: { dimension: 'campana' },
    info: info({
      definicion: 'Cuánto gastó cada campaña con entrega en el periodo.',
      formula: 'Σ gasto diario de la campaña',
      fuente: 'ads.campaigns · ads.insights_daily.spend',
      salvedades: ['Las campañas en revisión, rechazadas o sin gasto no aparecen aquí: están en la tabla y en el estado de campañas.'],
    }),
    velas: null,
    velasMotivo: NO_SERIE,
    alto: Math.max(260, 44 * filas.length + 60),
    sinDatoMotivo: 'Ninguna campaña tuvo gasto en el periodo.',
  };
}

export function graficoPorAnunciante(ctx: ContextoReporte, m: Modelo): ChartSpec {
  const filas = anunciantesConGasto(m).sort((a, b) => b.gasto - a.gasto);
  return {
    id: 'pub-por-anunciante',
    titulo: 'Gasto por anunciante',
    subtitulo: 'Doctores, clínicas, farmacias, laboratorios y aseguradoras (de EJEMPLO)',
    unidad: unidadMoneda(ctx),
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: filas.map((f) => f.nombre),
      series: [{ nombre: 'Gasto', forma: 'barra', valores: filas.map((f) => aMoneda(ctx, f.gasto)) }],
    },
    resumenAccesible: 'Los anunciantes ordenados por gasto: las clínicas y las aseguradoras lideran. Haz clic en uno para filtrar toda la pestaña.',
    filtro: { dimension: 'anunciante' },
    info: info({
      definicion: 'Cuánto gastó cada anunciante sumando todas sus campañas.',
      formula: 'Σ gasto de las campañas del anunciante',
      fuente: 'ads.ad_accounts · ads.campaigns · ads.insights_daily.spend',
      salvedades: ['Nombres comerciales inventados; no corresponden a ninguna organización real.'],
    }),
    velas: null,
    velasMotivo: NO_SERIE,
    alto: Math.max(260, 40 * filas.length + 60),
    sinDatoMotivo: 'Ningún anunciante tuvo gasto en el periodo.',
  };
}

export function graficoEstadoCampanas(m: Modelo): ChartSpec {
  return {
    id: 'pub-estado-campanas',
    titulo: 'Estado de entrega de las campañas',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: [...ESTADOS],
      series: [
        {
          nombre: 'Campañas',
          forma: 'barra',
          valores: ESTADOS.map((e) => Math.round(m.filas.filter((f) => f.campana.estado === e).length * m.factorGeneral)),
        },
      ],
    },
    resumenAccesible: 'Cuántas campañas hay en cada estado de entrega: la mayoría está activa, algunas aprendiendo y pocas en revisión o rechazadas.',
    filtro: { dimension: 'estado' },
    info: info({
      definicion: 'Cuántas campañas hay en cada estado de entrega, como en un gestor de anuncios.',
      formula: 'Conteo de campañas por estado de entrega',
      fuente: 'ads.campaigns.status · ads.delivery_status_snapshots · ads.ad_review_events',
      salvedades: [
        '«En fase de aprendizaje» y «Aprendizaje limitada» salen de ads.adset_learning_snapshots.',
        'En revisión y rechazada no entregan: no tienen gasto ni métricas.',
      ],
    }),
    velas: null,
    velasMotivo: 'Es un conteo por estado, no una serie de saldo o razón.',
    alto: 280,
    sinDatoMotivo: 'No hay campañas para la selección.',
  };
}

export function graficoCitasCiudad(m: Modelo): ChartSpec {
  return {
    id: 'pub-citas-ciudad',
    titulo: 'Citas agendadas por ciudad',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: CIUDADES.map((c) => c.nombre),
      series: [{ nombre: 'Citas', forma: 'barra', valores: CIUDADES.map((c) => (m.citas === null ? null : redondear(m.citas * c.parte, 0))) }],
    },
    resumenAccesible: 'Las citas agendadas desde anuncios se concentran en La Paz y Santa Cruz.',
    filtro: { dimension: 'ciudad' },
    info: info({
      definicion: 'Citas agendadas atribuidas a anuncios, según la ciudad de quien agenda.',
      formula: 'Citas atribuidas por ciudad',
      fuente: 'ads.conversion_attributions · directory (ciudad)',
      salvedades: ['Solo cantidades por ciudad; ningún dato de pacientes.'],
    }),
    velas: null,
    velasMotivo: NO_SERIE,
    alto: 280,
    sinDatoMotivo: 'Ninguna campaña de la selección atribuye citas.',
  };
}

export function graficoModeracion(m: Modelo): ChartSpec {
  const mo = calcularModeracion(m);
  return {
    id: 'pub-moderacion',
    titulo: 'De anuncios rechazados a anuncios que siguen fuera',
    subtitulo: `${mo.revisados} anuncios revisados en el periodo`,
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'cascada',
      pasos: [
        { nombre: 'Rechazados', valor: mo.rechazados, total: true },
        { nombre: 'Corregidos y reenviados', valor: -mo.corregidos },
        { nombre: 'Apelaciones ganadas', valor: -mo.ganadas },
        { nombre: 'Siguen rechazados', valor: mo.rechazados - mo.corregidos - mo.ganadas, total: true },
      ],
    },
    resumenAccesible: `De ${mo.rechazados} anuncios rechazados, ${mo.corregidos} se corrigieron y ${mo.ganadas} ganaron su apelación; ${mo.rechazados - mo.corregidos - mo.ganadas} siguen rechazados.`,
    filtro: null,
    filtroMotivo: 'Los pasos son etapas de un proceso de revisión, no categorías para filtrar.',
    info: info({
      definicion: 'Qué pasa con los anuncios que moderación rechaza: se corrigen, se apelan con éxito o siguen fuera.',
      formula: 'Siguen rechazados = rechazados − corregidos y reenviados − apelaciones ganadas',
      fuente: 'ads.ad_review_events · ads.ad_policy_violations · ads.ad_policy_appeals',
      salvedades: ['Las apelaciones perdidas siguen dentro de «Siguen rechazados».'],
    }),
    velas: null,
    velasMotivo: 'Es un flujo de conteos del periodo, no una serie de saldo o razón.',
    alto: 280,
    sinDatoMotivo: 'No hubo anuncios revisados en el periodo.',
  };
}
