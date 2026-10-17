import { reply, type MockRequest, type MockRouter } from '../mock-router';

/* ============================================================================
    Backend simulado del tráfico HTTP (`/admin/ops/traffic*`).

    Reproduce las reglas de la API real: la ventana por defecto arranca a las
    00:00 UTC del día de `to`; una ventana vacía es 422 `VALIDATION_FAILED` con
    su razón; el total es la suma de los endpoints y la serie suma el total; la
    respuesta nunca trae un identificador y `route` es siempre una plantilla.

    Los números son sintéticos y fijos: dos corridas dan lo mismo.
    ========================================================================== */

const MS_HORA = 3_600_000;
const MS_DIA = 24 * MS_HORA;

interface FilaSintetica {
  readonly method: string;
  readonly route: string;
  readonly operationId: string | null;
  readonly requests: number;
  readonly failed4xx: number;
  readonly failed5xx: number;
  readonly avg: number;
  readonly p95: number;
  readonly max: number;
}

const ENDPOINTS: readonly FilaSintetica[] = [
  { method: 'GET', route: '/auth/me', operationId: 'AuthController_me', requests: 4180, failed4xx: 38, failed5xx: 0, avg: 9, p95: 25, max: 140 },
  { method: 'GET', route: '/appointments', operationId: 'AppointmentsController_list', requests: 2310, failed4xx: 12, failed5xx: 3, avg: 41, p95: 250, max: 1900 },
  { method: 'POST', route: '/iam/auth/login', operationId: 'AuthController_login', requests: 1260, failed4xx: 210, failed5xx: 0, avg: 118, p95: 500, max: 2300 },
  { method: 'GET', route: '/patients/:id', operationId: 'PatientsController_get', requests: 940, failed4xx: 27, failed5xx: 1, avg: 34, p95: 100, max: 880 },
  { method: 'GET', route: '/admin/ops/readiness', operationId: 'OpsConsoleController_readiness', requests: 88, failed4xx: 0, failed5xx: 0, avg: 310, p95: 1000, max: 1840 },
  { method: 'POST', route: '/payments/qr', operationId: 'PaymentsController_createQr', requests: 64, failed4xx: 4, failed5xx: 9, avg: 760, p95: 5000, max: 9800 },
  { method: 'GET', route: 'UNMATCHED', operationId: null, requests: 51, failed4xx: 51, failed5xx: 0, avg: 2, p95: 5, max: 12 },
];

const TOTAL = ENDPOINTS.reduce((s, e) => s + e.requests, 0);
const F4 = ENDPOINTS.reduce((s, e) => s + e.failed4xx, 0);
const F5 = ENDPOINTS.reduce((s, e) => s + e.failed5xx, 0);

const NO_MEDIDO = [
  { metric: 'rejectedBeforeApi', reason: 'Lo que Traefik o nginx contestan antes de llegar a la API no pasa por esta medición.' },
  { metric: 'lastMinuteNotFlushed', reason: 'Lo agregado y aún no volcado (hasta un ciclo de volcado) no aparece, y se pierde si el proceso cae.' },
  { metric: 'healthchecksExcluded', reason: 'Las sondas de salud, la documentación y los preflight OPTIONS no se cuentan a propósito.' },
  { metric: 'workersNotHttp', reason: 'Los workers y los jobs no son peticiones HTTP: sólo se mide la API.' },
  { metric: 'unmatchedAggregated', reason: 'Las peticiones a rutas inexistentes se agrupan como UNMATCHED; nunca se guarda su dirección.' },
  { metric: 'percentilesEstimated', reason: 'La latencia se guarda como histograma: los percentiles son una estimación por interpolación, no un valor exacto.' },
];

function ventanaInvalida(reason: string, message: string) {
  return reply(422, { statusCode: 422, code: 'VALIDATION_FAILED', message, error: 'Unprocessable Entity', details: { reason } });
}

/** Misma regla que la API: `from` por defecto es la medianoche UTC del día de `to`. */
function resolverVentana(req: MockRequest) {
  const aTexto = req.query.get('to');
  const to = aTexto ? new Date(aTexto) : new Date();
  if (Number.isNaN(to.getTime())) return ventanaInvalida('INVALID_DATE', 'Fecha de ventana no válida');
  const medianoche = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  const desdeTexto = req.query.get('from');
  const from = desdeTexto ? new Date(desdeTexto) : new Date(medianoche < to.getTime() ? medianoche : medianoche - MS_DIA);
  if (Number.isNaN(from.getTime())) return ventanaInvalida('INVALID_DATE', 'Fecha de ventana no válida');
  if (from.getTime() >= to.getTime()) return ventanaInvalida('EMPTY_WINDOW', '"from" debe ser anterior a "to"');
  return { from, to };
}

function estimar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function registrarTrafico(router: MockRouter): void {
  router.get('/admin/ops/traffic', (req: MockRequest) => {
    const ventana = resolverVentana(req);
    if ('status' in ventana) return ventana;
    const interval = req.query.get('interval') === 'day' ? 'day' : 'hour';
    const paso = interval === 'day' ? MS_DIA : MS_HORA;

    // Cubos alineados a la hora/día UTC dentro de la ventana, con un reparto fijo.
    const inicio = Math.floor(ventana.from.getTime() / paso) * paso;
    const cubos: number[] = [];
    for (let t = inicio; t < ventana.to.getTime() && cubos.length < 200; t += paso) cubos.push(t);
    const pesos = cubos.map((_, i) => 1 + ((i * 7) % 5));
    const suma = pesos.reduce((s, p) => s + p, 0);
    let resto = TOTAL;
    let resto4 = F4;
    let resto5 = F5;
    const series = cubos.map((t, i) => {
      const ultimo = i === cubos.length - 1;
      const requests = ultimo ? resto : Math.floor((TOTAL * pesos[i]!) / suma);
      const failed4xx = ultimo ? resto4 : Math.floor((F4 * pesos[i]!) / suma);
      const failed5xx = ultimo ? resto5 : Math.floor((F5 * pesos[i]!) / suma);
      resto -= requests;
      resto4 -= failed4xx;
      resto5 -= failed5xx;
      return { bucket: new Date(t).toISOString(), requests, failed4xx, failed5xx, p95Ms: requests === 0 ? null : 100 + ((i * 37) % 400) };
    });

    const avg = ENDPOINTS.reduce((s, e) => s + e.avg * e.requests, 0) / TOTAL;
    return {
      window: { from: ventana.from.toISOString(), to: ventana.to.toISOString(), interval, timezone: 'UTC' },
      measured: {
        requests: TOTAL,
        succeeded: TOTAL - F4 - F5,
        failed: { client4xx: F4, server5xx: F5 },
        successRatio: estimar((TOTAL - F4 - F5) / TOTAL),
        latencyMs: { avg: estimar(avg), p50: 25, p95: 250, max: Math.max(...ENDPOINTS.map((e) => e.max)), method: 'histogram-estimate', approximate: false },
        activeUsers: {
          sessionsActiveNow: 14,
          usersActiveNow: 11,
          usersActiveInWindow: 63,
          definition:
            'Ahora: sesiones de IAM en estado ACTIVE y no vencidas. En la ventana: usuarios distintos que abrieron sesión dentro de ella. No son usuarios que hicieron peticiones: la medición de peticiones no guarda quién las hizo.',
        },
        lastDataAt: new Date(Math.floor(ventana.to.getTime() / 60_000) * 60_000 - 60_000).toISOString(),
      },
      series,
      notMeasured: NO_MEDIDO,
    };
  });

  router.get('/admin/ops/traffic/endpoints', (req: MockRequest) => {
    const ventana = resolverVentana(req);
    if ('status' in ventana) return ventana;
    const sort = (['requests', 'failed', 'p95'] as const).find((s) => s === req.query.get('sort')) ?? 'requests';
    const limite = Math.min(Number(req.query.get('limit') ?? 50) || 50, 200);
    const clave = (e: FilaSintetica): number => (sort === 'failed' ? e.failed4xx + e.failed5xx : sort === 'p95' ? e.p95 : e.requests);
    const ordenadas = [...ENDPOINTS].sort((a, b) => clave(b) - clave(a) || a.route.localeCompare(b.route) || a.method.localeCompare(b.method));
    return {
      window: { from: ventana.from.toISOString(), to: ventana.to.toISOString(), interval: 'hour', timezone: 'UTC' },
      sort,
      items: ordenadas.slice(0, limite).map((e) => ({
        method: e.method,
        route: e.route,
        operationId: e.operationId,
        requests: e.requests,
        succeeded: e.requests - e.failed4xx - e.failed5xx,
        failed4xx: e.failed4xx,
        failed5xx: e.failed5xx,
        latencyMs: { avg: e.avg, p95: e.p95, max: e.max },
        firstSeenAt: ventana.from.toISOString(),
        lastSeenAt: new Date(ventana.to.getTime() - 60_000).toISOString(),
      })),
      truncated: ordenadas.length > limite,
      note: 'Las rutas son plantillas (/patients/:id), nunca la dirección real. UNMATCHED agrupa lo que no coincidió con ninguna ruta; __overflow__, lo que superó el tope de cardinalidad por minuto.',
    };
  });
}
