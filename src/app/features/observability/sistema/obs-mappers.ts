import type {
  ChartSpec,
  EstadoKpi,
  InfoCalculo,
  KpiSpec,
  SerieCartesiana,
} from '@core/data-access/reporting/reporting.types';
import type {
  ErrorGroupDetail,
  LatencyBucket,
  LatencyPercentiles,
  Measure,
  ObsEndpointsPage,
  ObsInterval,
  ObsSummary,
  ObsTimeseries,
  TimeseriesSeries,
} from '@core/data-access/observability/observability.types';
import { etiquetaDeCubo, rejillaDeCubos } from './obs-format';

/* ============================================================================
    De la respuesta de la API a lo que pintan los widgets. Funciones puras:
    aquí se decide qué es «sin dato» (null) y qué es cero, y por qué.
    ========================================================================== */

const NUMERO = { tipo: 'numero' } as const;
const DURACION = { tipo: 'duracion' } as const;
const PORCENTAJE = { tipo: 'porcentaje' } as const;

/** Lo que la API dice con un código, dicho con palabras. Un código desconocido se muestra tal cual (no se inventa un motivo). */
const MOTIVOS: Readonly<Record<string, string>> = {
  NO_INSTANCE_REPORTED_IN_WINDOW: 'Ninguna instancia de la API reportó datos en esta ventana.',
  NO_REQUESTS_IN_WINDOW: 'No hubo peticiones en la ventana: la tasa no se puede calcular (no es 0 %).',
  SIN_MUESTRAS: 'Sin peticiones en la ventana: no hay con qué estimar el percentil.',
  MUESTRA_INSUFICIENTE: 'Hay menos peticiones que el mínimo para publicar un percentil.',
  ACTOR_HASH_NOT_AVAILABLE: 'La API no tiene configurado el secreto con que se anonimizan las personas afectadas.',
  WORKERS_NOT_REPORTING: 'Los latidos de los workers todavía no se recogen.',
  DEPENDENCIES_NOT_PROBED: 'Las sondas de dependencias todavía no corren.',
  SLO_NOT_COMPUTED: 'El cálculo de objetivos de servicio (SLO) todavía no corre.',
};

export function motivoLegible(reason: string | undefined): string | undefined {
  return reason === undefined ? undefined : (MOTIVOS[reason] ?? reason);
}

function info(definicion: string, formula: string, salvedades?: readonly string[]): InfoCalculo {
  return {
    definicion,
    formula,
    fuente: 'API · módulo observability (tabla de peticiones por minuto, volcada cada pocos segundos)',
    frescura: 'Se vuelca al almacenamiento cada ciclo de volcado; la cabecera dice cuándo fue el último.',
    ...(salvedades === undefined ? {} : { salvedades }),
  };
}

const SALVEDAD_PERCENTILES = 'Los percentiles se estiman por interpolación de un histograma de 11 cortes (5 ms a 10 s): no son exactos.';

/* ---- tarjetas del resumen ------------------------------------------------------ */

/** Tasa de 5xx: 5 % o más es crítico (la regla de alerta del proxy), 1 % o más pide atención. */
export function estadoDeTasa5xx(tasa: number | null): EstadoKpi | undefined {
  if (tasa === null) return undefined;
  if (tasa >= 0.05) return 'critico';
  if (tasa >= 0.01) return 'aviso';
  return 'bueno';
}

function numero(m: Measure<number>): { valor: number | null; motivoSinDato?: string } {
  const motivo = motivoLegible(m.reason);
  return { valor: m.value, ...(motivo === undefined ? {} : { motivoSinDato: motivo }) };
}

function latencia(s: ObsSummary): LatencyPercentiles | null {
  return 'p95' in s.kpis.latencyMs ? s.kpis.latencyMs : null;
}

export function kpisResumen(s: ObsSummary): KpiSpec[] {
  const k = s.kpis;
  const lat = latencia(s);
  const p95 = lat?.p95;
  const sinLatencia = !('p95' in k.latencyMs) ? motivoLegible(k.latencyMs.reason) : motivoLegible(p95?.reason);
  const grupos = k.errorGroups.value;
  const lentas = k.slowSql.value;
  const tasa5xx = k.errorRate5xx.value;
  return [
    {
      id: 'requests',
      titulo: 'Solicitudes',
      ...numero(k.requests),
      unidad: NUMERO,
      variacionPct: null,
      info: info('Peticiones HTTP que terminaron en la API durante la ventana.', 'Σ peticiones del volcado por minuto', [
        'Sin sondas de salud ni documentación. Lo que el proxy rechaza antes de llegar a la API no se cuenta.',
      ]),
    },
    {
      id: 'error-rate-5xx',
      titulo: 'Tasa de error del servidor (5xx)',
      ...numero(k.errorRate5xx),
      valor: tasa5xx === null ? null : tasa5xx * 100,
      unidad: PORCENTAJE,
      variacionPct: null,
      subirEsMalo: true,
      ...(estadoDeTasa5xx(tasa5xx) === undefined ? {} : { estado: estadoDeTasa5xx(tasa5xx) }),
      variante: 'hero',
      info: info('Qué parte de las peticiones terminó con un error del servidor (5xx).', '5xx ÷ solicitudes', [
        'Estado: crítico desde 5 %, atención desde 1 %.',
      ]),
    },
    {
      id: 'error-rate-4xx',
      titulo: 'Rechazos del cliente (4xx)',
      ...numero(k.errorRate4xx),
      valor: k.errorRate4xx.value === null ? null : k.errorRate4xx.value * 100,
      unidad: PORCENTAJE,
      variacionPct: null,
      subirEsMalo: true,
      info: info('Qué parte de las peticiones fue rechazada por validación, permisos o rutas inexistentes (4xx).', '4xx ÷ solicitudes'),
    },
    {
      id: 'latency-p95',
      titulo: 'Latencia p95',
      valor: p95?.value ?? null,
      ...(p95?.atLeast === true ? { prefijo: '≥ ' } : {}),
      ...(sinLatencia === undefined ? {} : { motivoSinDato: sinLatencia }),
      unidad: DURACION,
      variacionPct: null,
      subirEsMalo: true,
      info: info('El 95 % de las peticiones respondió en este tiempo o menos.', 'percentil 95 del histograma de latencia', [
        SALVEDAD_PERCENTILES,
        '«≥» indica que cayó en el último corte (10 s): es una cota inferior.',
      ]),
    },
    {
      id: 'error-groups',
      titulo: 'Grupos de error abiertos',
      valor: grupos?.open ?? null,
      ...(grupos === null ? { motivoSinDato: motivoLegible(k.errorGroups.reason) ?? 'La API no devolvió el conteo.' } : {}),
      unidad: NUMERO,
      variacionPct: null,
      subirEsMalo: true,
      info: info('Errores distintos (agrupados por huella) que siguen sin resolver, vistos en la ventana.', 'grupos NEW + SEEN con actividad en la ventana', [
        grupos === null ? 'Sin conteo.' : `${grupos.new} nuevos · ${grupos.regressed} reabiertos por regresión en la ventana.`,
      ]),
    },
    {
      id: 'slow-sql',
      titulo: 'Consultas SQL lentas',
      valor: lentas?.count ?? null,
      ...(lentas === null ? { motivoSinDato: motivoLegible(k.slowSql.reason) ?? 'La API no devolvió el conteo.' } : {}),
      unidad: NUMERO,
      variacionPct: null,
      subirEsMalo: true,
      info: info('Ejecuciones de SQL que superaron el umbral de lentitud de la API.', 'Σ ejecuciones lentas del volcado', [
        'Sólo se mide el SQL que pasa por el ORM (MikroORM); el que usa el driver pg directo no se ve.',
      ]),
    },
  ];
}

/* ---- series en el tiempo ----------------------------------------------------------- */

type Punto = ReadonlyMap<string, number | null>;

function puntosPorCubo(serie: TimeseriesSeries | undefined, intervalo: ObsInterval, zona: string): Punto {
  const m = new Map<string, number | null>();
  for (const p of serie?.points ?? []) {
    m.set(etiquetaDeCubo(new Date(p.bucket), intervalo, zona), p.value);
  }
  return m;
}

function categorias(ts: ObsTimeseries, zona: string): string[] {
  const { from, to, interval } = ts.window;
  return rejillaDeCubos(from, to, interval, zona).map((d) => etiquetaDeCubo(d, interval, zona));
}

const clave = (ts: ObsTimeseries, k: string): TimeseriesSeries | undefined => ts.series.find((s) => s.key === k);

function sumar(a: number | null | undefined, b: number | null | undefined): number | null {
  return a === null || a === undefined ? (b ?? null) : a + (b ?? 0);
}

/**
 * Solicitudes por cubo, apiladas por clase de respuesta. El color SIGNIFICA estado (éxito / 4xx / 5xx), no
 * posición. Un cubo sin NINGUNA fila es «sin dato» (hueco); un cubo con filas pero sin 5xx tiene 0 errores.
 */
export function specSolicitudes(ts: ObsTimeseries, zona: string): ChartSpec {
  const cats = categorias(ts, zona);
  const iv = ts.window.interval;
  const mapa = (k: string) => puntosPorCubo(clave(ts, k), iv, zona);
  const [m2, m3, m4, m5, mo] = [mapa('2xx'), mapa('3xx'), mapa('4xx'), mapa('5xx'), mapa('other')];
  const hayFila = (c: string) => [m2, m3, m4, m5, mo].some((m) => m.has(c));
  const col = (f: (c: string) => number | null): (number | null)[] => cats.map((c) => (hayFila(c) ? f(c) : null));
  const series: SerieCartesiana[] = [
    { nombre: 'Exitosas (2xx y 3xx)', forma: 'barra', apilar: 'estado', rol: 'exito', valores: col((c) => sumar(m2.get(c), m3.get(c)) ?? 0) },
    { nombre: 'Rechazos del cliente (4xx)', forma: 'barra', apilar: 'estado', rol: 'aviso', valores: col((c) => m4.get(c) ?? 0) },
    { nombre: 'Errores del servidor (5xx)', forma: 'barra', apilar: 'estado', rol: 'error', valores: col((c) => m5.get(c) ?? 0) },
  ];
  if (mo.size > 0) {
    series.push({ nombre: 'Otros códigos', forma: 'barra', apilar: 'estado', rol: 'aviso', valores: col((c) => mo.get(c) ?? 0) });
  }
  const total = series.reduce((a, s) => a + s.valores.reduce<number>((x, v) => x + (v ?? 0), 0), 0);
  const e5 = series[2]?.valores.reduce<number>((x, v) => x + (v ?? 0), 0) ?? 0;
  return {
    id: 'obs-solicitudes',
    titulo: 'Solicitudes en el tiempo',
    subtitulo: `Por ${iv === 'day' ? 'día' : iv === 'hour' ? 'hora' : 'minuto'} · ${zona === 'UTC' ? 'UTC' : 'hora de La Paz'}`,
    unidad: NUMERO,
    datos: { tipo: 'cartesiano', categorias: cats, paleta: 'estado', series },
    resumenAccesible: `Barras apiladas de solicitudes por ${iv === 'day' ? 'día' : 'hora'}: ${total} en total, ${e5} con error del servidor. Los intervalos sin datos quedan en blanco.`,
    filtro: null,
    filtroMotivo: 'El detalle por operación está en la pestaña Endpoints.',
    info: info('Peticiones por intervalo, apiladas por el resultado de la respuesta.', 'Σ peticiones por intervalo y clase (2xx/3xx, 4xx, 5xx)', [
      'Un intervalo sin ninguna fila es «sin dato» y se deja en blanco; no es cero.',
    ]),
    velas: null,
    velasMotivo: 'Es un conteo por intervalo, no un saldo con apertura y cierre.',
    sinDatoMotivo: 'No hay peticiones medidas en esta ventana.',
    ancho: 'completo',
    alto: 320,
  };
}

/** p95 y p99 en el tiempo (la API no publica una serie p50). El orden entre ellas ES el dato: una rampa ordinal. */
export function specLatenciaTiempo(p95: ObsTimeseries, p99: ObsTimeseries | null, zona: string, umbralMs: number): ChartSpec {
  const cats = categorias(p95, zona);
  const iv = p95.window.interval;
  const linea = (nombre: string, ts: ObsTimeseries): SerieCartesiana => {
    const m = puntosPorCubo(ts.series[0], iv, zona);
    return { nombre, forma: 'linea', valores: cats.map((c) => m.get(c) ?? null) };
  };
  const series = [linea('p95', p95), ...(p99 === null ? [] : [linea('p99', p99)])];
  const alMenosUno = series.some((s) => s.valores.some((v) => v !== null));
  return {
    id: 'obs-latencia-tiempo',
    titulo: 'Latencia en el tiempo (p95 y p99)',
    subtitulo: `Por ${iv === 'day' ? 'día' : 'hora'} · un intervalo con pocas peticiones queda en blanco`,
    unidad: DURACION,
    datos: {
      tipo: 'cartesiano',
      categorias: cats,
      paleta: 'ordinal',
      series,
      objetivo: { valor: umbralMs, etiqueta: `Referencia: ${umbralMs / 1000} s` },
    },
    resumenAccesible: alMenosUno
      ? `Líneas de latencia p95 y p99 por ${iv === 'day' ? 'día' : 'hora'}, con una referencia en ${umbralMs / 1000} s.`
      : 'No hay intervalos con peticiones suficientes para estimar la latencia.',
    filtro: null,
    filtroMotivo: 'La latencia por operación está en la tabla de operaciones más lentas.',
    info: info('Tiempo de respuesta p95 y p99 por intervalo.', 'percentil del histograma de cada intervalo (mínimo de muestra por intervalo)', [
      SALVEDAD_PERCENTILES,
      `La referencia de ${umbralMs / 1000} s es la del umbral de alerta propuesto en el plan, no un objetivo de servicio medido.`,
      'La API no publica una serie de p50.',
    ]),
    velas: null,
    velasMotivo: 'Es un percentil por intervalo, no un saldo con apertura y cierre.',
    sinDatoMotivo: 'Ningún intervalo de la ventana tiene peticiones suficientes para estimar un percentil.',
    ancho: 'completo',
    alto: 300,
  };
}

/** Los cortes ACUMULADOS (≤ le) de la API como cubos contiguos: cada cubo es la diferencia con el anterior. */
export function specHistogramaLatencia(buckets: readonly LatencyBucket[] | null): ChartSpec {
  const cortes = (buckets ?? []).filter((b): b is LatencyBucket & { leMs: number } => b.leMs !== null);
  const total = (buckets ?? []).find((b) => b.leMs === null)?.count ?? 0;
  const conteos: number[] = [];
  let previo = 0;
  for (const c of cortes) {
    conteos.push(Math.max(0, c.count - previo));
    previo = c.count;
  }
  conteos.push(Math.max(0, total - previo));
  return {
    id: 'obs-latencia-histograma',
    titulo: 'Distribución de la latencia',
    subtitulo: 'Cuántas peticiones cayeron en cada rango de tiempo de respuesta',
    unidad: NUMERO,
    datos: {
      tipo: 'histograma',
      bordes: buckets === null ? [] : [0, ...cortes.map((c) => c.leMs), null],
      conteos: buckets === null ? [] : conteos,
      unidadBorde: DURACION,
      nombreValor: 'Peticiones',
      cerrado: 'derecha',
    },
    resumenAccesible:
      buckets === null || total === 0
        ? 'No hay peticiones en la ventana para armar la distribución.'
        : `Histograma de ${total} peticiones por rango de latencia; el rango más poblado es ${rangoMasPoblado(cortes, conteos)}.`,
    filtro: null,
    filtroMotivo: 'Es una distribución del total de la ventana; no se filtra por cubo.',
    info: info('Cuántas peticiones tardaron cada rango de tiempo.', 'diferencia de los cortes acumulados (≤ 5 ms, ≤ 10 ms…)', ['La API publica cortes acumulados; aquí se restan para dibujar cubos contiguos.']),
    velas: null,
    velasMotivo: 'Es una distribución, no una serie en el tiempo.',
    sinDatoMotivo: 'No hay peticiones en la ventana.',
    alto: 280,
  };
}

function rangoMasPoblado(cortes: readonly { leMs: number }[], conteos: readonly number[]): string {
  const max = Math.max(...conteos);
  const i = conteos.indexOf(max);
  const hi = cortes[i]?.leMs;
  return hi === undefined ? `más de ${cortes[cortes.length - 1]?.leMs ?? 0} ms` : `hasta ${hi} ms`;
}

/** Operaciones por valor, barras horizontales con UNA tinta (nominal: el color no codifica el valor). */
export function specTopOperaciones(page: ObsEndpointsPage, por: 'requests' | 'p95'): ChartSpec {
  const items = page.items.slice(0, 10);
  const nombre = (e: (typeof items)[number]) => `${e.method} ${e.route}`;
  const valor = (e: (typeof items)[number]): number | null => (por === 'requests' ? e.requests : e.latencyMs.p95.value);
  const orden = [...items].filter((e) => valor(e) !== null).sort((a, b) => (valor(b) ?? 0) - (valor(a) ?? 0));
  return {
    id: por === 'requests' ? 'obs-top-trafico' : 'obs-top-lentas',
    titulo: por === 'requests' ? 'Operaciones con más tráfico' : 'Operaciones más lentas (p95)',
    subtitulo: 'Las 10 primeras de la ventana',
    unidad: por === 'requests' ? NUMERO : DURACION,
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: orden.map(nombre),
      series: [{ nombre: por === 'requests' ? 'Solicitudes' : 'p95', forma: 'barra', valores: orden.map((e) => valor(e)) }],
    },
    resumenAccesible: orden.length === 0 ? 'No hay operaciones con datos.' : `La operación con ${por === 'requests' ? 'más tráfico' : 'mayor p95'} es ${nombre(orden[0] as (typeof items)[number])}.`,
    filtro: null,
    filtroMotivo: 'La tabla de la pestaña Endpoints permite ordenar y ver el detalle.',
    info: info(por === 'requests' ? 'Peticiones por plantilla de ruta.' : 'Latencia p95 por plantilla de ruta.', por === 'requests' ? 'Σ peticiones por operación' : 'percentil 95 por operación', por === 'p95' ? [SALVEDAD_PERCENTILES] : undefined),
    velas: null,
    velasMotivo: 'Es un ranking, no una serie en el tiempo.',
    sinDatoMotivo: 'Ninguna operación tiene datos en la ventana.',
    alto: Math.max(220, 40 + orden.length * 30),
  };
}

/** Ocurrencias de un grupo de errores por intervalo (los de la API vienen por hora). */
export function specErroresSerie(d: ErrorGroupDetail, zona: string): ChartSpec {
  const pts = d.series.filter((p): p is { bucket: string; count: number } => p.bucket !== null);
  const cats = pts.map((p) => etiquetaDeCubo(new Date(p.bucket), 'hour', zona));
  return {
    id: 'obs-error-serie',
    titulo: 'Ocurrencias en el tiempo',
    unidad: NUMERO,
    datos: { tipo: 'cartesiano', categorias: cats, series: [{ nombre: 'Ocurrencias', forma: 'barra', valores: pts.map((p) => p.count) }] },
    resumenAccesible: `Ocurrencias de este error por hora: ${pts.reduce((a, p) => a + p.count, 0)} guardadas en la ventana.`,
    filtro: null,
    filtroMotivo: 'Es el detalle de un solo grupo.',
    info: null,
    infoMotivo: 'Conteo de eventos guardados; el total del grupo puede ser mayor si se superó el tope de muestreo.',
    velas: null,
    velasMotivo: 'Es un conteo por intervalo.',
    sinDatoMotivo: 'El grupo no tiene eventos guardados en la ventana.',
    alto: 220,
  };
}

export function specErroresPorModulo(d: ErrorGroupDetail): ChartSpec {
  const orden = [...d.byModule].sort((a, b) => b.events - a.events);
  return {
    id: 'obs-error-modulos',
    titulo: 'Eventos por módulo',
    unidad: NUMERO,
    datos: {
      tipo: 'cartesiano',
      horizontal: true,
      categorias: orden.map((m) => m.moduleCode),
      series: [{ nombre: 'Eventos', forma: 'barra', valores: orden.map((m) => m.events) }],
    },
    resumenAccesible: orden.length === 0 ? 'Sin eventos por módulo.' : `El módulo con más eventos es ${orden[0]?.moduleCode ?? ''}.`,
    filtro: null,
    filtroMotivo: 'Es el detalle de un solo grupo.',
    info: null,
    infoMotivo: 'Conteo de eventos guardados por módulo.',
    velas: null,
    velasMotivo: 'Es un conteo por categoría.',
    sinDatoMotivo: 'Sin eventos guardados.',
    alto: Math.max(160, 60 + orden.length * 30),
  };
}

export function specSqlTiempo(ts: ObsTimeseries, zona: string): ChartSpec {
  const cats = categorias(ts, zona);
  const m = puntosPorCubo(ts.series[0], ts.window.interval, zona);
  return {
    id: 'obs-sql-tiempo',
    titulo: 'Tiempo total de base de datos',
    subtitulo: 'Suma del tiempo de las consultas por intervalo (ORM)',
    unidad: DURACION,
    datos: { tipo: 'cartesiano', categorias: cats, series: [{ nombre: 'Tiempo en SQL', forma: 'linea', valores: cats.map((c) => m.get(c) ?? null) }] },
    resumenAccesible: 'Línea del tiempo total que la API pasó ejecutando SQL en cada intervalo.',
    filtro: null,
    filtroMotivo: 'Las sentencias están en la tabla de abajo.',
    info: info('Tiempo acumulado de las consultas SQL del ORM en cada intervalo.', 'Σ duración de consultas por intervalo', ['Sólo SQL que pasa por MikroORM.']),
    velas: null,
    velasMotivo: 'Es una suma por intervalo.',
    sinDatoMotivo: 'No hay consultas medidas en la ventana.',
    ancho: 'completo',
    alto: 240,
  };
}
