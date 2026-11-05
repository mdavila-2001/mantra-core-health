import { reply, type MockRequest, type MockRouter } from '../mock-router';
import type {
  DeviceBreakdownItem,
  DevicesBreakdown,
  DevicesPortal,
} from '../../data-access/admin-portal/analytics-devices.types';

/* ============================================================================
    Backend simulado de dispositivos (`GET /admin/analytics/devices`).

    **DATOS SINTÉTICOS**, fijos: dos corridas dan lo mismo. Ninguna cifra es una
    medición. Reglas de la API que reproduce:
    - Cada desglose suma como máximo `totals.contexts`; los bots van aparte y
      no están en ningún desglose.
    - Un contexto que no informó la dimensión es `UNSPECIFIED`.
    - `from` debe ser anterior a `to`; el portal es WEB o MOBILE.
    - Una ventana sin contextos devuelve ceros, desgloses vacíos y
      `lastContextAt: null`.
    ========================================================================== */

const MS_DIA = 24 * 3_600_000;
const MAX_DIAS = 92;

type Desglose = readonly [code: string, label: string, contexts: number][];

const POR_PORTAL: Readonly<
  Record<
    DevicesPortal,
    {
      contexts: number;
      bots: number;
      tipo: Desglose;
      so: Desglose;
      navegador: Desglose;
      version: Desglose;
    }
  >
> = {
  WEB: {
    contexts: 1000,
    bots: 37,
    tipo: [
      ['DESKTOP', 'Escritorio', 640],
      ['MOBILE', 'Móvil', 310],
      ['TABLET', 'Tableta', 40],
      ['UNSPECIFIED', 'UNSPECIFIED', 10],
    ],
    so: [
      ['WINDOWS', 'Windows', 480],
      ['ANDROID', 'Android', 250],
      ['IOS', 'iOS', 120],
      ['MACOS', 'macOS', 90],
      ['UNSPECIFIED', 'UNSPECIFIED', 60],
    ],
    navegador: [
      ['CHROME', 'Chrome', 620],
      ['SAFARI', 'Safari', 200],
      ['EDGE', 'Edge', 110],
      ['FIREFOX', 'Firefox', 60],
      ['UNSPECIFIED', 'UNSPECIFIED', 10],
    ],
    version: [['UNSPECIFIED', 'UNSPECIFIED', 1000]],
  },
  MOBILE: {
    contexts: 400,
    bots: 0,
    tipo: [
      ['MOBILE', 'Móvil', 380],
      ['TABLET', 'Tableta', 20],
    ],
    so: [
      ['ANDROID', 'Android', 290],
      ['IOS', 'iOS', 110],
    ],
    navegador: [['UNSPECIFIED', 'UNSPECIFIED', 400]],
    version: [
      ['2.4.1', '2.4.1', 240],
      ['2.4.0', '2.4.0', 110],
      ['2.3.7', '2.3.7', 40],
      ['UNSPECIFIED', 'UNSPECIFIED', 10],
    ],
  },
};

const items = (d: Desglose): readonly DeviceBreakdownItem[] =>
  d.map(([code, label, contexts]) => ({ code, label, contexts }));

function combinar(a: Desglose, b: Desglose): Desglose {
  const porCodigo = new Map<string, [string, string, number]>();
  for (const [code, label, n] of [...a, ...b]) {
    const previo = porCodigo.get(code);
    porCodigo.set(code, previo ? [code, label, previo[2] + n] : [code, label, n]);
  }
  return [...porCodigo.values()].sort((x, y) => y[2] - x[2] || x[0].localeCompare(y[0]));
}

function invalida(reason: string, message: string) {
  return reply(422, {
    statusCode: 422,
    code: 'VALIDATION_FAILED',
    message,
    error: 'Unprocessable Entity',
    details: { reason },
  });
}

/** Misma ventana que el resto de `/admin/analytics`: por omisión, los últimos 7 días. */
function resolverVentana(req: MockRequest) {
  const aTexto = req.query.get('to');
  const to = aTexto ? new Date(aTexto) : new Date();
  if (Number.isNaN(to.getTime())) return invalida('INVALID_DATE', 'Fecha de ventana no válida');
  const desdeTexto = req.query.get('from');
  const from = desdeTexto ? new Date(desdeTexto) : new Date(to.getTime() - 7 * MS_DIA);
  if (Number.isNaN(from.getTime())) return invalida('INVALID_DATE', 'Fecha de ventana no válida');
  if (from.getTime() >= to.getTime())
    return invalida('EMPTY_WINDOW', '"from" debe ser anterior a "to"');
  if (to.getTime() - from.getTime() > MAX_DIAS * MS_DIA)
    return invalida('WINDOW_TOO_LARGE', `La ventana no puede pasar de ${MAX_DIAS} días`);
  return { from, to };
}

export function registrarDispositivos(router: MockRouter): void {
  router.get('/admin/analytics/devices', (req: MockRequest) => {
    const ventana = resolverVentana(req);
    if ('status' in ventana) return ventana;
    const portalTexto = req.query.get('portal');
    if (portalTexto !== null && portalTexto !== 'WEB' && portalTexto !== 'MOBILE') {
      return invalida('INVALID_PORTAL', 'El portal debe ser WEB o MOBILE');
    }
    const portal = portalTexto as DevicesPortal | null;
    const fuentes = portal ? [POR_PORTAL[portal]] : [POR_PORTAL.WEB, POR_PORTAL.MOBILE];
    const unir = (campo: 'tipo' | 'so' | 'navegador' | 'version'): Desglose =>
      fuentes.map((f) => f[campo]).reduce<Desglose>((acc, d) => combinar(acc, d), []);
    const contexts = fuentes.reduce((s, f) => s + f.contexts, 0);
    const respuesta: DevicesBreakdown = {
      window: {
        from: ventana.from.toISOString(),
        to: ventana.to.toISOString(),
        interval: 'day',
        timezone: 'UTC',
        portal,
      },
      totals: { contexts, bots: fuentes.reduce((s, f) => s + f.bots, 0) },
      byDeviceType: items(unir('tipo')),
      byOsFamily: items(unir('so')),
      byBrowserFamily: items(unir('navegador')),
      byAppVersion: items(unir('version')),
      lastContextAt: new Date(
        Math.floor(ventana.to.getTime() / 60_000) * 60_000 - 120_000,
      ).toISOString(),
      notMeasured: [
        {
          metric: 'botsExcluded',
          reason: 'SIMULADO · Los bots se cuentan aparte y no entran en ningún desglose.',
        },
        {
          metric: 'appVersionWeb',
          reason: 'SIMULADO · El portal web no informa versión de app: aparece como UNSPECIFIED.',
        },
        {
          metric: 'breakdownRowCap',
          reason:
            'SIMULADO · Cada desglose tiene un tope de filas; la suma puede quedar por debajo del total.',
        },
      ],
    };
    return respuesta;
  });
}
