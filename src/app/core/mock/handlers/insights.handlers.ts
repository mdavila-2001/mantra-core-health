import { daysBetween } from '../../data-access/insights/insights-dates';
import type {
  Channel,
  DailyFact,
  InsightsMeta,
  InsightsResponse,
} from '../../data-access/insights/insights.types';
import { forbidden, validation, type MockRequest, type MockRouter } from '../mock-router';
import {
  MOCK_CATALOG,
  MOCK_CUTOFF,
  MOCK_NOTICE,
} from './insights/catalog.dataset';
import { mockCampaignFacts } from './insights/facts.dataset';

/* ============================================================================
    AloVida Insights — servidor SIMULADO (`/marketing/insights/*`).

    Datos de EJEMPLO: la API real sirve el mismo contrato desde las tablas
    `marketing.insights_*`. Cuando exista, este archivo deja de usarse en
    producción; el contrato (`insights.types.ts`) no cambia.
    ========================================================================== */

/** Los roles que la API deja leer Insights (alcance plataforma). Espejo de `ROLES_INSIGHTS`. */
const READ_ROLES: readonly string[] = [
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'MARKETING_MANAGER',
];

/** Ventana máxima de una consulta, igual que la API (`MAX_WINDOW_DAYS`). */
const MAX_WINDOW_DAYS = 92;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function allowed(req: MockRequest): boolean {
  return req.user === null || req.user.roles.some((role) => READ_ROLES.includes(role));
}

function meta(window: InsightsMeta['window']): InsightsMeta {
  return {
    dataset: 'demo',
    asOf: MOCK_CUTOFF,
    cutoff: MOCK_CUTOFF,
    window,
    notice: MOCK_NOTICE,
    notMeasured: [],
  };
}

function list(raw: string | null): string[] {
  return raw === null || raw === '' ? [] : raw.split(',').filter((v) => v !== '');
}

export function registrarInsights(router: MockRouter): void {
  router.get('/marketing/insights/catalog', (req) => {
    if (!allowed(req)) {
      return forbidden('Su rol no puede ver AloVida Insights.');
    }
    const body: InsightsResponse<typeof MOCK_CATALOG> = { data: MOCK_CATALOG, meta: meta(null) };
    return body;
  });

  router.get('/marketing/insights/campaign-facts', (req) => {
    if (!allowed(req)) {
      return forbidden('Su rol no puede ver AloVida Insights.');
    }
    const from = req.query.get('from') ?? '';
    const to = req.query.get('to') ?? '';
    if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) {
      return validation('La ventana de consulta necesita «from» y «to» con formato AAAA-MM-DD.', [
        { field: 'from', message: 'debe ser una fecha AAAA-MM-DD' },
      ]);
    }
    if (to < from) {
      return validation('La ventana de consulta está vacía: «to» es anterior a «from».', [
        { field: 'to', message: 'no puede ser anterior a from' },
      ]);
    }
    if (daysBetween(from, to) + 1 > MAX_WINDOW_DAYS) {
      return validation(`La ventana de consulta no puede pasar de ${MAX_WINDOW_DAYS} días.`, [
        { field: 'to', message: `máximo ${MAX_WINDOW_DAYS} días` },
      ]);
    }
    const campaigns = list(req.query.get('campaignIds'));
    const channels = list(req.query.get('channels')) as Channel[];
    const rows: DailyFact[] = mockCampaignFacts().filter(
      (f) =>
        f.date >= from &&
        f.date <= to &&
        (campaigns.length === 0 || campaigns.includes(f.campaignId)) &&
        (channels.length === 0 || channels.includes(f.channel)),
    );
    const body: InsightsResponse<DailyFact[]> = { data: rows, meta: meta({ from, to }) };
    return body;
  });
}
