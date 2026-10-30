import type { ContextoReporte, KpiSpec, PestanaReporte, UnidadValor } from '../../../data-access/reporting/reporting.types';
import { AVISO_MODULO, aMoneda, aMonedaNull, info, unidadMoneda } from './publicidad.comun';
import { graficoModeracion, graficoCitasCiudad, campaignStatusChart, advertiserChart, campaignChart } from './publicidad.graficos-campanas';
import {
  graficoCpaUbicacion,
  graficoCtrHora,
  graficoDispositivo,
  graficoEmbudo,
  graficoGastoDiario,
  graficoOcupacion,
  graficoPacing,
  graficoUbicacion,
  graficoValorAtribuido,
} from './publicidad.graficos';
import { advertisersWithSpend, calcularModelo, ratio, type Modelo } from './publicidad.modelo';
import { tablaAnunciosPeorCosto, tablaCampanas, tablaModeracion } from './publicidad.tablas';
import { hashTexto, kpi, variacionContexto } from './reporting-dataset.util';

/* ============================================================================
    Pestaña «Publicidad push y pauteo» — datos de EJEMPLO.

    El módulo de publicidad AÚN NO ESTÁ CERRADO: se modela como Meta Ads Manager
    (campaña → conjunto de anuncios → anuncio). Resultados = citas agendadas o
    clientes potenciales; nunca datos de pacientes. Todo sale de `calcularModelo`
    (publicidad.modelo.ts), así que tarjetas, gráficos y tablas cuadran entre sí.
    ========================================================================== */

const NO_DELIVERY = 'La selección no tuvo entrega en el periodo: no hay impresiones sobre las que calcular.';
const NO_APPOINTMENTS = 'La selección no incluye campañas con citas atribuidas (objetivo distinto de «Citas agendadas» o sin entrega).';

/** Reduce una serie a ≤ 24 puntos (media por tramo) para la línea de tendencia. */
function muestrear(valores: readonly number[] | null): number[] | undefined {
  if (valores === null || valores.length === 0) {
    return undefined;
  }
  const tramo = Math.ceil(valores.length / 24);
  const out: number[] = [];
  for (let i = 0; i < valores.length; i += tramo) {
    const t = valores.slice(i, i + tramo);
    out.push(t.reduce((a, b) => a + b, 0) / t.length);
  }
  return out;
}

function buildKpis(ctx: ContextoReporte, m: Modelo): KpiSpec[] {
  const moneda = unidadMoneda(ctx);
  const ratioTimes: UnidadValor = { tipo: 'razon', sufijo: ' veces' };
  const roasU: UnidadValor = { tipo: 'razon', sufijo: ' ×' };
  const variacion = (id: string, valor: number | null): number | null =>
    valor === null ? null : variacionContexto(ctx, valor, hashTexto(`pub:var:${id}`));
  const frecuencia = ratio(m.impresiones, m.alcance);
  const ctr = ratio(m.clics * 100, m.impresiones);
  const cpmBob = ratio(m.gasto, m.impresiones);
  const cpm = cpmBob === null ? null : cpmBob * 1000;
  const cpaBob = m.citas === null || m.citas <= 0 ? null : ratio(m.gastoCitas, m.citas);
  const roas = m.citas === null || m.citas <= 0 ? null : ratio(m.valor, m.gastoCitas);
  const impresionesDia = m.cpmDia === null ? null : m.gastoDia.map((g, i) => (g / m.cpmDia![i]!) * 1000);
  const activos = advertisersWithSpend(m).length;

  return [
    kpi({
      id: 'ingreso-periodo',
      titulo: 'Ingreso publicitario',
      valor: aMoneda(ctx, m.gasto),
      unidad: moneda,
      variacionPct: variacion('ingreso', m.gasto),
      tendencia: muestrear(m.gastoDia.map((g) => aMoneda(ctx, g))),
      info: info({
        definicion: 'Lo que los anunciantes gastaron en Alovida en el periodo: es el ingreso de la plataforma por publicidad.',
        formula: 'Σ gasto de todas las campañas',
        fuente: 'ads.insights_daily.spend · ads.ad_invoices',
        salvedades: ['Es gasto entregado; lo facturado puede diferir hasta el cierre de la factura.'],
      }),
    }),
    kpi({
      id: 'impresiones',
      titulo: 'Impresiones',
      valor: m.impresiones,
      unidad: { tipo: 'numero' },
      variacionPct: variacion('impresiones', m.impresiones),
      tendencia: muestrear(impresionesDia),
      info: info({
        definicion: 'Cuántas veces se mostraron los anuncios (push, banner y listado destacado).',
        formula: 'Σ impresiones',
        fuente: 'ads.insights_daily.impressions',
        salvedades: ['Una misma persona puede ver varias impresiones; para personas distintas, mira el alcance.'],
      }),
    }),
    kpi({
      id: 'alcance',
      titulo: 'Alcance',
      valor: m.alcance,
      unidad: { tipo: 'numero' },
      variacionPct: variacion('alcance', m.alcance),
      info: info({
        definicion: 'Personas distintas que vieron al menos un anuncio.',
        formula: 'Personas únicas alcanzadas (sin repetir entre campañas)',
        fuente: 'ads.insights_daily.reach',
        salvedades: ['No es la suma de las campañas: quien ve dos anuncios cuenta una vez.'],
      }),
    }),
    kpi({
      id: 'frecuencia',
      titulo: 'Frecuencia',
      valor: frecuencia,
      unidad: ratioTimes,
      variacionPct: variacion('frecuencia', frecuencia),
      subirEsMalo: true,
      numerador: m.impresiones,
      denominador: m.alcance,
      motivoSinDato: frecuencia === null ? NO_DELIVERY : undefined,
      info: info({
        definicion: 'Cuántas veces, en promedio, vio cada persona alcanzada un anuncio.',
        formula: 'Frecuencia = impresiones ÷ alcance',
        numerador: 'Impresiones',
        denominador: 'Alcance (personas únicas)',
        fuente: 'ads.insights_daily · ads.frequency_caps',
        salvedades: ['Una frecuencia alta cansa a la audiencia; se marca como «subir es malo».'],
      }),
    }),
    kpi({
      id: 'ctr',
      titulo: 'CTR (enlace)',
      valor: ctr,
      unidad: { tipo: 'porcentaje' },
      variacionPct: variacion('ctr', ctr),
      numerador: m.clics,
      denominador: m.impresiones,
      motivoSinDato: ctr === null ? NO_DELIVERY : undefined,
      tendencia: muestrear(m.ctrDia),
      info: info({
        definicion: 'De cada cien veces que se mostró un anuncio, cuántas se hizo clic en su enlace.',
        formula: 'CTR (enlace) = clics en el enlace ÷ impresiones',
        numerador: 'Clics en el enlace',
        denominador: 'Impresiones',
        fuente: 'ads.insights_daily (inline_link_clicks, impressions)',
      }),
    }),
    kpi({
      id: 'cpm',
      titulo: 'CPM',
      valor: aMonedaNull(ctx, cpm),
      unidad: moneda,
      variacionPct: variacion('cpm', cpm),
      subirEsMalo: true,
      numerador: aMoneda(ctx, m.gasto),
      denominador: m.impresiones,
      motivoSinDato: cpm === null ? NO_DELIVERY : undefined,
      tendencia: muestrear(m.cpmDia?.map((v) => aMoneda(ctx, v)) ?? null),
      info: info({
        definicion: 'Lo que cuesta mostrar un anuncio mil veces.',
        formula: 'CPM = gasto ÷ impresiones × 1000',
        numerador: 'Gasto',
        denominador: 'Impresiones ÷ 1000',
        fuente: 'ads.insights_daily (spend, impressions)',
      }),
    }),
    kpi({
      id: 'resultados',
      titulo: 'Citas agendadas',
      valor: m.citas,
      unidad: { tipo: 'numero' },
      variacionPct: variacion('citas', m.citas),
      motivoSinDato: m.citas === null ? NO_APPOINTMENTS : undefined,
      info: info({
        definicion: 'Citas que se agendaron tras ver o tocar un anuncio. Solo cantidades: nada de datos de pacientes.',
        formula: 'Σ citas atribuidas de campañas con objetivo «Citas agendadas»',
        fuente: 'ads.conversion_attributions',
        salvedades: ['Las campañas de clientes potenciales o de alcance no atribuyen citas: no se les asigna un cero.'],
      }),
    }),
    kpi({
      id: 'cpa',
      titulo: 'Costo por cita (CPA)',
      valor: aMonedaNull(ctx, cpaBob),
      unidad: moneda,
      variacionPct: variacion('cpa', cpaBob),
      subirEsMalo: true,
      numerador: aMoneda(ctx, m.gastoCitas),
      denominador: m.citas,
      motivoSinDato: cpaBob === null ? NO_APPOINTMENTS : undefined,
      tendencia: muestrear(m.cpaDia?.map((v) => aMoneda(ctx, v)) ?? null),
      info: info({
        definicion: 'Lo que cuesta conseguir una cita agendada desde un anuncio.',
        formula: 'CPA = gasto de campañas con citas ÷ citas agendadas',
        numerador: 'Gasto de campañas con objetivo «Citas agendadas»',
        denominador: 'Citas agendadas atribuidas',
        fuente: 'ads.conversion_attributions · ads.insights_daily',
      }),
    }),
    kpi({
      id: 'roas',
      titulo: 'ROAS',
      valor: roas,
      unidad: roasU,
      variacionPct: variacion('roas', roas),
      numerador: m.valor === null ? null : aMoneda(ctx, m.valor),
      denominador: aMoneda(ctx, m.gastoCitas),
      motivoSinDato: roas === null ? NO_APPOINTMENTS : undefined,
      tendencia: muestrear(m.roasDia),
      info: info({
        definicion: 'Cuántos bolivianos de valor generan las citas por cada boliviano gastado en anuncios.',
        formula: 'ROAS = valor atribuido ÷ gasto de campañas con citas',
        numerador: 'Σ citas × valor de la cita (de EJEMPLO)',
        denominador: 'Gasto de campañas con objetivo «Citas agendadas»',
        fuente: 'ads.conversion_attributions · ads.insights_daily',
        salvedades: ['Sin citas atribuidas no hay ROAS: se muestra «Sin dato», nunca 0 ni infinito.'],
      }),
    }),
    kpi({
      id: 'anunciantes-activos',
      titulo: 'Anunciantes activos',
      valor: Math.ceil(activos * m.factorGeneral),
      unidad: { tipo: 'numero' },
      variacionPct: variacion('anunciantes', Math.ceil(activos * m.factorGeneral)),
      info: info({
        definicion: 'Anunciantes (doctores, clínicas, farmacias, laboratorios y aseguradoras) con gasto en el periodo.',
        formula: 'Anunciantes distintos con gasto > 0',
        fuente: 'ads.ad_accounts · ads.insights_daily',
        salvedades: ['Nombres comerciales inventados.'],
      }),
    }),
  ];
}

export function construirPublicidad(ctx: ContextoReporte): PestanaReporte {
  const m = calcularModelo(ctx);
  const graficos = [
    graficoGastoDiario(ctx, m),
    graficoValorAtribuido(ctx, m),
    graficoEmbudo(m),
    graficoPacing(m),
    graficoOcupacion(ctx),
    graficoDispositivo(m),
    graficoCitasCiudad(calcularModelo(ctx, 'ciudad')),
    graficoUbicacion(ctx, calcularModelo(ctx, 'canal')),
    graficoCpaUbicacion(ctx),
    graficoCtrHora(m),
    campaignChart(ctx, calcularModelo(ctx, 'campana')),
    advertiserChart(ctx, calcularModelo(ctx, 'anunciante')),
    campaignStatusChart(calcularModelo(ctx, 'estado')),
    graficoModeracion(m),
  ];
  const tablas = [tablaCampanas(ctx, m), tablaAnunciosPeorCosto(ctx, m), tablaModeracion(m)];
  const ids = (...claves: string[]) => claves.map((c) => `pub-${c}`);

  return {
    pestana: 'publicidad',
    generadoEn: '2026-10-30T09:00:00-04:00',
    origen: 'ejemplo',
    kpis: buildKpis(ctx, m),
    graficos,
    tablas,
    avisos: [AVISO_MODULO],
    secciones: [
      {
        titulo: 'Resultados',
        descripcion: 'Cuánto gastan los anunciantes, qué retorno obtienen y cómo avanza la gente de la impresión a la cita.',
        graficos: ids('gasto-diario', 'valor-atribuido', 'embudo'),
      },
      {
        titulo: 'Entrega y alcance',
        descripcion: 'Si las campañas gastan al ritmo previsto, cuánto inventario queda y a quién llegan.',
        graficos: ids('pacing', 'ocupacion', 'dispositivo', 'citas-ciudad'),
      },
      {
        titulo: 'Rendimiento por ubicación y horario',
        descripcion: 'Dónde y cuándo rinden mejor los anuncios.',
        graficos: ids('ubicacion', 'cpa-ubicacion', 'ctr-hora'),
      },
      {
        titulo: 'Campañas',
        descripcion: 'Campaña → conjunto de anuncios → anuncio, con las columnas de un gestor de anuncios.',
        graficos: ids('por-campana', 'por-anunciante', 'estado-campanas'),
        tablas: ids('tabla-campanas', 'tabla-anuncios'),
      },
      {
        titulo: 'Moderación',
        descripcion: 'Anuncios rechazados por la política de salud y apelaciones.',
        graficos: ids('moderacion'),
        tablas: ids('tabla-moderacion'),
      },
    ],
  };
}
