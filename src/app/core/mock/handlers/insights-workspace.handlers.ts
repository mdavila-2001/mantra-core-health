import {
  INSIGHTS_OWNER_TEAMS,
  type InsightsAlertRule,
  type InsightsAlertStatus,
  type InsightsAlertTransition,
  type InsightsAlertWorkflow,
  type InsightsMeta,
  type InsightsNotificationPreferences,
  type InsightsReportRecord,
  type InsightsResponse,
  type InsightsRuleCode,
  type InsightsSavedView,
  type InsightsUserPreferences,
  type PatchAlertRuleBody,
  type PutAlertWorkflowBody,
  type PutNotificationPreferencesBody,
  type PutReportBody,
  type PutSavedViewBody,
  type PutUserPreferencesBody,
} from '../../data-access/insights/insights.types';
import { forbidden, noContent, notFound, reply, validation, type MockRequest, type MockRouter } from '../mock-router';
import { MOCK_CUTOFF, MOCK_NOTICE } from './insights/catalog.dataset';

/* ============================================================================
    AloVida Insights — lo que las personas hacen y se queda (servidor SIMULADO).

    El estado vive en `localStorage` bajo `mock:insights:<usuario>:…` para que una recarga
    del navegador lo conserve, igual que lo haría la API. Las reglas son compartidas (no llevan
    usuario); todo lo demás es de quien pide. Mismas reglas que el API: `If-Match` en alertas y
    reglas (412), nombre único de vista (409), máximo 12 informes, umbral 1–500 (422).
    ========================================================================== */

const READ_ROLES: readonly string[] = ['SUPERADMIN', 'PLATFORM_ADMIN', 'DATA_PLATFORM_ADMIN', 'MARKETING_MANAGER'];
const STATUSES: readonly InsightsAlertStatus[] = ['new', 'in_progress', 'resolved', 'dismissed'];
const MAX_REPORTS = 12;

const DEFAULT_RULES: readonly InsightsAlertRule[] = [
  { code: 'cac', name: 'El CAC sube en un canal', description: 'Costo por registro de un canal frente a los días previos', severity: 'critical', unit: 'percent', threshold: 20, defaultThreshold: 20, direction: '+', enabled: true, rowVersion: 1 },
  { code: 'ctrdrop', name: 'El CTR cae de golpe', description: 'Clics sobre impresiones frente a los días previos', severity: 'risk', unit: 'percent', threshold: 12, defaultThreshold: 12, direction: '-', enabled: true, rowVersion: 1 },
  { code: 'ctrspike', name: 'El CTR sube fuera de lo normal', description: 'Salto del CTR que conviene verificar antes de celebrarlo', severity: 'anomaly', unit: 'percent', threshold: 50, defaultThreshold: 50, direction: '+', enabled: true, rowVersion: 1 },
  { code: 'cvr', name: 'La conversión baja en una campaña', description: 'Conversión de la campaña frente a la semana anterior', severity: 'risk', unit: 'percent', threshold: 15, defaultThreshold: 15, direction: '-', enabled: true, rowVersion: 1 },
  { code: 'neg', name: 'Sube la proporción de menciones negativas', description: 'Menciones negativas sobre el total frente a la semana anterior', severity: 'risk', unit: 'percent', threshold: 25, defaultThreshold: 25, direction: '+', enabled: true, rowVersion: 1 },
  { code: 'onb', name: 'Aumenta el abandono del onboarding', description: 'Abandono entre «Crea cuenta» y «Completa perfil»', severity: 'risk', unit: 'percent', threshold: 20, defaultThreshold: 20, direction: '+', enabled: true, rowVersion: 1 },
  { code: 'feed', name: 'Una fuente no manda datos', description: 'Horas sin datos de una fuente conectada', severity: 'critical', unit: 'hours', threshold: 24, defaultThreshold: 24, direction: '+', enabled: true, rowVersion: 1 },
];

const DEFAULT_NOTIFICATIONS: InsightsNotificationPreferences = {
  matrix: { critical: ['app', 'mail', 'slack'], risk: ['app', 'mail'], anomaly: ['app'], opportunity: ['app'] },
  frequency: 'immediate',
  digestHour: 8,
  quietFrom: '22:00',
  quietTo: '07:00',
  quietExemptCritical: true,
  nothingIsSent: true,
  rowVersion: 1,
};

const DEFAULT_USER_PREFS: InsightsUserPreferences = { density: 'comfortable', theme: 'system', navCollapsed: false, timezone: 'America/La_Paz', rowVersion: 1 };

function allowed(req: MockRequest): boolean {
  return req.user === null || req.user.roles.some((role) => READ_ROLES.includes(role));
}

function who(req: MockRequest): string {
  return req.user?.id ?? 'anon';
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(`mock:insights:${key}`);
    return raw === null || raw === undefined ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(`mock:insights:${key}`, JSON.stringify(value));
  } catch {
    /* sin almacenamiento el simulador no persiste entre recargas, pero sigue respondiendo */
  }
}

function meta(): InsightsMeta {
  return { dataset: 'demo', asOf: MOCK_CUTOFF, cutoff: MOCK_CUTOFF, window: null, notice: MOCK_NOTICE, notMeasured: [] };
}

function ok<T>(data: T): InsightsResponse<T> {
  return { data, meta: meta() };
}

function expectedVersion(req: MockRequest): number | null {
  const raw = req.headers.get('If-Match');
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) ? n : null;
}

function versionMismatch() {
  return reply(412, { statusCode: 412, code: 'PRECONDITION_FAILED', reason: 'MARKETING_INSIGHTS_VERSION_MISMATCH', message: 'Otra persona cambió esto antes que usted. Recargue y vuelva a intentar.', error: 'Precondition Failed' });
}

export function registrarInsightsWorkspace(router: MockRouter): void {
  const guard = (req: MockRequest) => (allowed(req) ? null : forbidden('Su rol no puede ver AloVida Insights.'));

  /* ----------------------------------------------------------- alertas */
  router.get('/marketing/insights/alert-workflow', (req) => guard(req) ?? ok(Object.values(read<Record<string, InsightsAlertWorkflow>>('workflow', {}))));

  router.put('/marketing/insights/alert-workflow/:fingerprint', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    const fp = decodeURIComponent(req.params['fingerprint'] ?? '');
    const body = req.body as PutAlertWorkflowBody | null;
    if (!body || !STATUSES.includes(body.status)) return validation('El estado de la alerta no es válido.', [{ field: 'status', message: `debe ser uno de ${STATUSES.join(', ')}` }]);
    if (body.ownerTeam !== null && !INSIGHTS_OWNER_TEAMS.includes(body.ownerTeam)) return validation('El responsable no es válido.', [{ field: 'ownerTeam', message: 'equipo desconocido' }]);
    if (!body.snapshot?.title) return validation('Falta la descripción de la alerta.', [{ field: 'snapshot', message: 'es obligatorio' }]);
    const store = read<Record<string, InsightsAlertWorkflow>>('workflow', {});
    const current = store[fp];
    const sent = expectedVersion(req);
    if (current && sent !== current.rowVersion) return versionMismatch();
    const changed = !current || current.status !== body.status || current.ownerTeam !== body.ownerTeam;
    const transition: InsightsAlertTransition = {
      at: new Date().toISOString(),
      fromStatus: current?.status ?? null,
      toStatus: body.status,
      fromOwner: current?.ownerTeam ?? null,
      toOwner: body.ownerTeam,
      note: body.note ?? null,
    };
    const next: InsightsAlertWorkflow = {
      fingerprint: fp,
      status: body.status,
      ownerTeam: body.ownerTeam,
      rowVersion: (current?.rowVersion ?? 0) + (changed ? 1 : 0),
      updatedAt: transition.at,
      transitions: changed ? [...(current?.transitions ?? []), transition] : (current?.transitions ?? []),
    };
    store[fp] = next;
    write('workflow', store);
    return ok(next);
  });

  /* ------------------------------------------------------------- reglas */
  router.get('/marketing/insights/alert-rules', (req) => guard(req) ?? ok(read<InsightsAlertRule[]>('rules', [...DEFAULT_RULES])));

  router.patch('/marketing/insights/alert-rules/:code', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    const rules = read<InsightsAlertRule[]>('rules', [...DEFAULT_RULES]);
    const i = rules.findIndex((r) => r.code === (req.params['code'] as InsightsRuleCode));
    if (i < 0) return notFound('La regla no existe.');
    const body = (req.body ?? {}) as PatchAlertRuleBody;
    if (body.threshold !== undefined && (!Number.isFinite(body.threshold) || body.threshold < 1 || body.threshold > 500)) {
      return validation('El umbral debe estar entre 1 y 500.', [{ field: 'threshold', message: 'entre 1 y 500' }]);
    }
    if (expectedVersion(req) !== rules[i]!.rowVersion) return versionMismatch();
    const next: InsightsAlertRule = { ...rules[i]!, ...(body.enabled === undefined ? {} : { enabled: body.enabled }), ...(body.threshold === undefined ? {} : { threshold: body.threshold }), rowVersion: rules[i]!.rowVersion + 1 };
    rules[i] = next;
    write('rules', rules);
    return ok(next);
  });

  /* ------------------------------------------------- preferencias (usuario) */
  router.get('/marketing/insights/notification-preferences', (req) => guard(req) ?? ok(read(`${who(req)}:notif`, DEFAULT_NOTIFICATIONS)));
  router.put('/marketing/insights/notification-preferences', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    const body = req.body as PutNotificationPreferencesBody | null;
    if (!body?.matrix) return validation('Faltan las preferencias de aviso.', [{ field: 'matrix', message: 'es obligatorio' }]);
    const current = read(`${who(req)}:notif`, DEFAULT_NOTIFICATIONS);
    const sent = expectedVersion(req);
    if (sent !== null && sent !== current.rowVersion) return versionMismatch();
    const next: InsightsNotificationPreferences = { ...body, nothingIsSent: true, rowVersion: current.rowVersion + 1 };
    write(`${who(req)}:notif`, next);
    return ok(next);
  });

  router.get('/marketing/insights/user-preferences', (req) => guard(req) ?? ok(read(`${who(req)}:prefs`, DEFAULT_USER_PREFS)));
  router.put('/marketing/insights/user-preferences', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    const body = req.body as PutUserPreferencesBody | null;
    if (!body || !['comfortable', 'compact'].includes(body.density) || !['system', 'light', 'dark'].includes(body.theme)) {
      return validation('Las preferencias no son válidas.', [{ field: 'density', message: 'comfortable o compact' }]);
    }
    const current = read(`${who(req)}:prefs`, DEFAULT_USER_PREFS);
    const sent = expectedVersion(req);
    if (sent !== null && sent !== current.rowVersion) return versionMismatch();
    const next: InsightsUserPreferences = { ...body, rowVersion: current.rowVersion + 1 };
    write(`${who(req)}:prefs`, next);
    return ok(next);
  });

  /* ---------------------------------------------------- vistas guardadas */
  router.get('/marketing/insights/saved-views', (req) => guard(req) ?? ok(read<InsightsSavedView[]>(`${who(req)}:views`, [])));
  router.put('/marketing/insights/saved-views/:id', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    const body = req.body as PutSavedViewBody | null;
    if (!body?.name?.trim() || !(body.url === '/insights' || body.url?.startsWith('/insights/') || body.url?.startsWith('/insights?'))) return validation('La vista necesita nombre y una dirección de Insights.', [{ field: 'name', message: 'obligatorio' }]);
    const views = read<InsightsSavedView[]>(`${who(req)}:views`, []);
    const id = req.params['id'] ?? '';
    if (views.some((v) => v.id !== id && v.name.toLowerCase() === body.name.trim().toLowerCase())) return conflictName();
    const i = views.findIndex((v) => v.id === id);
    const next: InsightsSavedView = { id, name: body.name.trim(), url: body.url, rowVersion: (i >= 0 ? views[i]!.rowVersion : 0) + 1 };
    if (i >= 0) views[i] = next;
    else views.push(next);
    write(`${who(req)}:views`, views);
    return ok(next);
  });
  router.delete('/marketing/insights/saved-views/:id', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    write(`${who(req)}:views`, read<InsightsSavedView[]>(`${who(req)}:views`, []).filter((v) => v.id !== req.params['id']));
    return noContent();
  });

  /* ------------------------------------------------------------ informes */
  router.get('/marketing/insights/reports', (req) => guard(req) ?? ok(read<InsightsReportRecord[]>(`${who(req)}:reports`, [])));
  router.put('/marketing/insights/reports/:id', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    const body = req.body as PutReportBody | null;
    if (!body?.title?.trim() || body.title.length > 90) return validation('El informe necesita un título de hasta 90 caracteres.', [{ field: 'title', message: '1 a 90 caracteres' }]);
    const list = read<InsightsReportRecord[]>(`${who(req)}:reports`, []);
    const id = req.params['id'] ?? '';
    const i = list.findIndex((r) => r.id === id);
    const record: InsightsReportRecord = { ...body, id, createdAt: i >= 0 ? list[i]!.createdAt : new Date().toISOString(), rowVersion: (i >= 0 ? list[i]!.rowVersion : 0) + 1 };
    if (i >= 0) list[i] = record;
    else list.unshift(record);
    write(`${who(req)}:reports`, list.slice(0, MAX_REPORTS));
    return ok(record);
  });
  router.delete('/marketing/insights/reports/:id', (req) => {
    const denied = guard(req);
    if (denied) return denied;
    write(`${who(req)}:reports`, read<InsightsReportRecord[]>(`${who(req)}:reports`, []).filter((r) => r.id !== req.params['id']));
    return noContent();
  });
}

function conflictName() {
  return reply(409, { statusCode: 409, code: 'CONFLICT', reason: 'MARKETING_INSIGHTS_VIEW_NAME_TAKEN', message: 'Ya tiene una vista con ese nombre.', error: 'Conflict' });
}
