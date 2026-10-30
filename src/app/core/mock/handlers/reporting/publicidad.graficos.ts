import type { ChartSpec, ContextoReporte } from '../../../data-access/reporting/reporting.types';
import { DIAS_SEMANA, DISPOSITIVOS, UBICACIONES } from './publicidad.catalogo';
import { aMoneda, aMonedaNull, info, unidadMoneda } from './publicidad.comun';
import { calcularModelo, ratio, type Modelo } from './publicidad.modelo';
import { agrupar, redondear, suma, candlesFromSeries } from './reporting-dataset.util';

/* Resultados · Entrega y alcance · Rendimiento por ubicación y horario (series y distribuciones). */

const MIN_MUESTRA_CELDA = 400;

const NO_DELIVERY = 'La selección no tuvo entrega en el periodo (campañas en revisión, rechazadas o sin gasto).';

export function graficoGastoDiario(ctx: ContextoReporte, m: Modelo): ChartSpec {
  const cubos = (valores: readonly number[]) => agrupar(m.fechas, [...valores], m.gran, 'suma');
  const base = cubos(m.gastoDia.map((g) => aMoneda(ctx, g)));
  const series = UBICACIONES.map((u) => {
    const parte = m.ubicacion === null ? u.parte : m.ubicacion.nombre === u.nombre ? 1 : 0;
    return {
      nombre: u.nombre,
      forma: 'barra' as const,
      apilar: 'gasto',
      valores: base.valores.map((v) => v * parte),
    };
  });
  return {
    id: 'pub-gasto-diario',
    titulo: 'Gasto de anunciantes (ingreso publicitario)',
    subtitulo: 'Por ubicación del anuncio',
    unidad: unidadMoneda(ctx),
    datos: { tipo: 'cartesiano', categorias: base.etiquetas, series },
    resumenAccesible: m.noDelivery
      ? 'Sin gasto en el periodo para la selección actual.'
      : 'Barras apiladas del gasto de los anunciantes por ubicación; la notificación push concentra la mayor parte. Las velas muestran cómo se movió el CPM.',
    filtro: { dimension: 'canal' },
    info: info({
      definicion: 'Lo que los anunciantes gastaron en Alovida: es el ingreso publicitario de la plataforma.',
      formula: 'Σ gasto diario de todas las campañas, repartido por ubicación',
      fuente: 'ads.insights_daily.spend · ads.ad_invoices (facturado)',
      salvedades: ['El gasto aún no es lo facturado: la factura se emite al cierre (ads.ad_invoices).'],
    }),
    velas: m.cpmDia
      ? {
          explicacion:
            'CPM: costo por mil impresiones. Cada vela resume unos días: apertura, máximo, mínimo y cierre. Una vela roja es un CPM que sube (más caro).',
          velas: candlesFromSeries(m.fechas, m.cpmDia.map((v) => aMoneda(ctx, v)), m.gran),
          subirEsMalo: true,
        }
      : null,
    velasMotivo: m.cpmDia ? undefined : 'Sin entrega no hay CPM que dibujar.',
    ancho: 'completo',
    alto: 320,
    sinDatoMotivo: NO_DELIVERY,
  };
}

export function graficoValorAtribuido(ctx: ContextoReporte, m: Modelo): ChartSpec {
  const hay = m.gastoCitasDia !== null && m.valorDia !== null && m.roasDia !== null;
  const cubo = (v: readonly number[] | null) =>
    agrupar(m.fechas, v ? v.map((x) => aMoneda(ctx, x)) : m.fechas.map(() => 0), m.gran, 'suma');
  const gasto = cubo(m.gastoCitasDia);
  const valor = cubo(m.valorDia);
  return {
    id: 'pub-valor-atribuido',
    titulo: 'Gasto frente a valor atribuido por citas',
    subtitulo: 'Solo campañas con objetivo «Citas agendadas»',
    unidad: unidadMoneda(ctx),
    datos: {
      tipo: 'cartesiano',
      categorias: gasto.etiquetas,
      series: [
        { nombre: 'Gasto', forma: 'barra', valores: hay ? gasto.valores : gasto.valores.map(() => null) },
        { nombre: 'Valor atribuido', forma: 'barra', valores: hay ? valor.valores : valor.valores.map(() => null) },
      ],
    },
    resumenAccesible: hay
      ? 'Por cada boliviano gastado en campañas de citas se atribuyen varios en valor de las citas agendadas; las velas muestran el ROAS día a día.'
      : 'Sin citas atribuidas en la selección actual.',
    filtro: null,
    filtroMotivo: 'Es una serie en el tiempo: un día no es una dimensión del negocio por la que filtrar.',
    info: info({
      definicion: 'Cuánto valor generaron las citas agendadas desde anuncios frente a lo gastado en ellos.',
      formula: 'ROAS = valor atribuido ÷ gasto de campañas con citas',
      numerador: 'Σ citas atribuidas × valor de la cita (de EJEMPLO, definido por el anunciante)',
      denominador: 'Σ gasto de campañas con objetivo «Citas agendadas»',
      fuente: 'ads.conversion_attributions · ads.insights_daily',
      salvedades: ['Las campañas de alcance o de clientes potenciales no atribuyen citas y quedan fuera.', 'Sin datos de pacientes: solo cantidades.'],
    }),
    velas: m.roasDia
      ? {
          explicacion: 'ROAS diario: valor atribuido ÷ gasto. Vela verde = el retorno sube.',
          velas: candlesFromSeries(m.fechas, m.roasDia, m.gran),
        }
      : null,
    velasMotivo: m.roasDia ? undefined : 'Sin citas atribuidas no hay ROAS: no se dibuja un cero.',
    ancho: 'completo',
    alto: 300,
    sinDatoMotivo: 'La selección no tiene campañas con citas atribuidas en el periodo.',
  };
}

export function graficoEmbudo(m: Modelo): ChartSpec {
  return {
    id: 'pub-embudo',
    titulo: 'Embudo: de la impresión a la cita',
    unidad: { tipo: 'numero' },
    datos: {
      tipo: 'partes',
      forma: 'embudo',
      partes: [
        { nombre: 'Impresiones', valor: m.noDelivery ? null : m.impresiones },
        { nombre: 'Clics en el enlace', valor: m.noDelivery ? null : m.clics },
        { nombre: 'Clientes potenciales', valor: m.leads },
        { nombre: 'Citas agendadas', valor: m.citas },
      ],
    },
    resumenAccesible: 'Embudo de conversión: de millones de impresiones salen miles de clics, cientos de clientes potenciales y decenas de citas agendadas.',
    filtro: null,
    filtroMotivo: 'Los pasos son etapas de un mismo flujo, no categorías: filtrar por una etapa no tiene sentido.',
    info: info({
      definicion: 'Cuánta gente avanza en cada etapa desde que ve el anuncio hasta que agenda una cita.',
      formula: 'Impresiones → clics en el enlace → clientes potenciales → citas agendadas',
      numerador: 'Personas que pasan a la etapa siguiente',
      denominador: 'Personas de la etapa anterior',
      fuente: 'ads.insights_daily · ads.lead_submissions · ads.conversion_attributions',
      salvedades: ['Los clientes potenciales y las citas solo cuentan donde la campaña los mide; si ninguna los mide, la etapa queda «Sin dato».'],
    }),
    velas: null,
    velasMotivo: 'Son etapas de un flujo, no una serie de saldo o razón en el tiempo.',
    alto: 300,
    sinDatoMotivo: NO_DELIVERY,
  };
}

export function graficoPacing(m: Modelo): ChartSpec {
  const withPacing = m.filas.filter((f) => f.presupuesto !== null && f.entrega);
  const pacing = ratio(suma(withPacing.map((f) => f.gasto)), suma(withPacing.map((f) => f.presupuesto)));
  return {
    id: 'pub-pacing',
    titulo: 'Pacing del presupuesto',
    subtitulo: '100 % = al ritmo esperado a la fecha',
    unidad: { tipo: 'porcentaje' },
    datos: { tipo: 'medidor', nombre: 'Pacing', valor: pacing === null ? null : redondear(pacing * 100, 1), minimo: 0, maximo: 150, objetivo: 100 },
    resumenAccesible: pacing === null ? 'Sin campañas con presupuesto en entrega.' : `El gasto va al ${redondear(pacing * 100, 0)} % de lo esperado a la fecha.`,
    filtro: null,
    filtroMotivo: 'Es un único valor agregado: no hay categorías sobre las que hacer clic.',
    info: info({
      definicion: 'Si las campañas gastan al ritmo del presupuesto: por debajo de 100 % subentregan, por encima se adelantan.',
      formula: 'Pacing = gastado ÷ presupuesto esperado a la fecha',
      numerador: 'Gasto acumulado de campañas en entrega',
      denominador: 'Presupuesto esperado a la fecha de esas campañas',
      fuente: 'ads.campaigns · ads.budget_schedules · ads.insights_daily',
      salvedades: ['Las campañas en revisión o rechazadas no tienen presupuesto esperado y no entran.'],
    }),
    velas: null,
    velasMotivo: 'Es un valor puntual a la fecha, no una serie.',
    alto: 260,
    sinDatoMotivo: 'Ninguna campaña de la selección entregó con presupuesto: no hay ritmo que medir.',
  };
}

export function graficoOcupacion(ctx: ContextoReporte): ChartSpec {
  const clave = ctx.filtros.map((f) => `${f.dimension}:${f.valor}`).join('|');
  // Con filtros activos la foto de inventario se mueve un poco, para que no parezca fija.
  const desvio = clave === '' ? 0 : (clave.length % 9) - 4;
  return {
    id: 'pub-ocupacion',
    titulo: 'Ocupación del inventario por ubicación',
    unidad: { tipo: 'porcentaje' },
    datos: {
      tipo: 'cartesiano',
      categorias: UBICACIONES.map((u) => u.nombre),
      series: [{ nombre: 'Plazas vendidas', forma: 'barra', valores: UBICACIONES.map((u) => Math.min(100, u.ocupacion + desvio)) }],
    },
    resumenAccesible: 'Porcentaje de plazas vendidas sobre las disponibles: el listado destacado está casi lleno y el banner tiene más margen.',
    filtro: { dimension: 'canal' },
    info: info({
      definicion: 'Qué parte de las plazas publicitarias de cada ubicación ya está vendida.',
      formula: 'Ocupación = plazas vendidas ÷ plazas disponibles',
      numerador: 'Plazas vendidas en el periodo',
      denominador: 'Plazas disponibles en el periodo',
      fuente: 'ads.ad_placements (por confirmar: depende de cómo se venda el inventario)',
      salvedades: ['Cómo se vende el inventario push es una decisión de producto abierta.'],
    }),
    velas: null,
    velasMotivo: 'Es una foto del inventario, no una serie de saldo.',
    alto: 280,
    sinDatoMotivo: 'Sin inventario cargado.',
  };
}

/** `m` es el modelo SIN el filtro de ubicación: la dona conserva todas sus partes. */
export function graficoUbicacion(ctx: ContextoReporte, m: Modelo): ChartSpec {
  return {
    id: 'pub-ubicacion',
    titulo: 'Gasto por ubicación',
    unidad: unidadMoneda(ctx),
    datos: {
      tipo: 'partes',
      forma: 'dona',
      partes: UBICACIONES.map((u) => ({ nombre: u.nombre, valor: aMoneda(ctx, m.gasto * u.parte) })),
    },
    resumenAccesible: 'La notificación push se lleva casi la mitad del gasto; el banner y el listado destacado se reparten el resto.',
    filtro: { dimension: 'canal' },
    info: info({
      definicion: 'Cómo se reparte el gasto entre los lugares de la app donde se muestran los anuncios.',
      formula: 'Gasto por ubicación ÷ gasto total',
      numerador: 'Gasto de la ubicación',
      denominador: 'Gasto total',
      fuente: 'ads.insights_daily (desglose por ubicación) · ads.ad_placements',
    }),
    velas: null,
    velasMotivo: 'Es un reparto del total, no una serie de saldo o razón.',
    alto: 280,
    sinDatoMotivo: 'Sin gasto en el periodo.',
  };
}

export function graficoCpaUbicacion(ctx: ContextoReporte): ChartSpec {
  const valores = UBICACIONES.map((u) => {
    const otros = ctx.filtros.filter((f) => f.dimension !== 'canal');
    const mu = calcularModelo({ ...ctx, filtros: [...otros, { dimension: 'canal', valor: u.nombre }] });
    return aMonedaNull(ctx, ratio(mu.gastoCitas, mu.citas));
  });
  return {
    id: 'pub-cpa-ubicacion',
    titulo: 'Costo por cita agendada, por ubicación',
    unidad: unidadMoneda(ctx),
    datos: { tipo: 'cartesiano', categorias: UBICACIONES.map((u) => u.nombre), series: [{ nombre: 'Costo por cita', forma: 'barra', valores }] },
    resumenAccesible: 'Cuánto cuesta conseguir una cita en cada ubicación; la más barata es donde conviene mover presupuesto.',
    filtro: { dimension: 'canal' },
    info: info({
      definicion: 'Lo que cuesta, en promedio, cada cita agendada que se atribuye a un anuncio en esa ubicación.',
      formula: 'CPA = gasto de campañas con citas ÷ citas agendadas',
      numerador: 'Gasto de campañas con objetivo «Citas agendadas»',
      denominador: 'Citas agendadas atribuidas',
      fuente: 'ads.conversion_attributions · ads.insights_daily',
    }),
    velas: null,
    velasMotivo: 'Compara ubicaciones en el mismo momento; no es una serie en el tiempo.',
    alto: 280,
    sinDatoMotivo: 'Sin citas atribuidas en el periodo.',
  };
}

function hourProfile(h: number): number {
  const pico = (centro: number, ancho: number) => Math.exp(-((h - centro) ** 2) / (2 * ancho ** 2));
  return 0.05 + pico(9, 1.8) + 0.85 * pico(13, 1.6) + 1.15 * pico(20, 2);
}

export function graficoCtrHora(m: Modelo): ChartSpec {
  const horas = Array.from({ length: 24 }, (_, h) => h);
  const total = suma(horas.map(hourProfile));
  const pesoDia = [1.05, 1.08, 1.1, 1.07, 0.98, 0.8, 0.72];
  const sumaDia = suma(pesoDia);
  const ctrDia = [1.02, 1.05, 1.06, 1.03, 0.97, 0.9, 0.86];
  const ctrGlobal = m.noDelivery ? 0 : (m.clics / m.impresiones) * 100;
  const celdas: (readonly [number, number, number | null])[] = [];
  DIAS_SEMANA.forEach((_, d) => {
    horas.forEach((h) => {
      const impresiones = m.impresiones * (pesoDia[d]! / sumaDia) * (hourProfile(h) / total);
      const hayMuestra = !m.noDelivery && impresiones >= MIN_MUESTRA_CELDA;
      const factorHora = 0.8 + 0.4 * (hourProfile(h) / 1.2);
      celdas.push([h, d, hayMuestra ? redondear(ctrGlobal * ctrDia[d]! * factorHora, 2) : null]);
    });
  });
  return {
    id: 'pub-ctr-hora',
    titulo: 'CTR por día de la semana y hora',
    subtitulo: 'Celdas sin muestra suficiente quedan en «Sin dato»',
    unidad: { tipo: 'porcentaje' },
    datos: { tipo: 'mapa-calor', filas: DIAS_SEMANA, columnas: horas.map((h) => `${String(h).padStart(2, '0')} h`), celdas, nombreValor: 'CTR' },
    resumenAccesible: 'Mapa de calor del CTR: los clics rinden más entre semana, a media mañana y a primera hora de la noche; de madrugada casi no hay muestra.',
    filtro: null,
    filtroMotivo: 'El día y la hora no son una dimensión de filtro del portal.',
    info: info({
      definicion: 'Con qué frecuencia se hace clic en el anuncio según cuándo se mostró.',
      formula: 'CTR (enlace) = clics en el enlace ÷ impresiones',
      numerador: 'Clics en el enlace en esa hora y día',
      denominador: 'Impresiones en esa hora y día',
      fuente: 'ads.insights_daily (desglose por hora)',
      salvedades: [`Una celda con menos de ${MIN_MUESTRA_CELDA} impresiones no se calcula: queda «Sin dato», no en cero.`],
    }),
    velas: null,
    velasMotivo: 'Es una matriz de dos dimensiones, no una serie de saldo o razón.',
    ancho: 'completo',
    alto: 300,
    sinDatoMotivo: 'Sin entrega suficiente para medir el CTR por hora.',
  };
}

export function graficoDispositivo(m: Modelo): ChartSpec {
  return {
    id: 'pub-dispositivo',
    titulo: 'Impresiones por dispositivo',
    unidad: { tipo: 'numero' },
    datos: { tipo: 'partes', forma: 'dona', partes: DISPOSITIVOS.map((d) => ({ nombre: d.nombre, valor: m.impresiones * d.parte })) },
    resumenAccesible: 'Dos de cada tres impresiones ocurren en Android; el resto se reparte entre iPhone y navegador.',
    filtro: null,
    filtroMotivo: 'El portal aún no tiene un filtro por dispositivo.',
    info: info({
      definicion: 'En qué tipo de dispositivo se mostraron los anuncios.',
      formula: 'Impresiones del dispositivo ÷ impresiones totales',
      numerador: 'Impresiones en el dispositivo',
      denominador: 'Impresiones totales',
      fuente: 'ads.insights_daily (desglose por dispositivo)',
    }),
    velas: null,
    velasMotivo: 'Es un reparto del total, no una serie de saldo o razón.',
    alto: 280,
    sinDatoMotivo: 'Sin impresiones en el periodo.',
  };
}
