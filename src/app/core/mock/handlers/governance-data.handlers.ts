import { conflict, notFound, precondition, reply, type MockRequest, type MockRouter } from '../mock-router';
import type {
  QualityIssue,
  QualityIssueStatus,
  QualityRule,
  QualityRuleDetail,
  QualitySeverity,
} from '../../data-access/admin-portal/data-quality.types';
import {
  allowedTransitions,
  type PrivacyJurisdiction,
  type PrivacyStatus,
  type PrivacyType,
} from '../../data-access/admin-portal/privacy-requests.types';

/* ============================================================================
    Backend simulado de calidad de datos clínicos (`health_data`) y de solicitudes de
    privacidad (`GET/PATCH /privacy/dsar`, módulo `audit`).

    **DATOS SINTÉTICOS**, fijos: dos corridas dan lo mismo. Ningún nombre, ni
    documento ni cifra es de una persona real; los textos lo dicen («SIMULADO»).
    Reglas de la API que reproduce:
    - Resolver o descartar sólo funciona sobre una incidencia ABIERTA. Repetir la
      misma acción responde 200 con `alreadyApplied: true`; la contraria sobre una
      ya cerrada, 409. El motivo mide entre 10 y 2000 caracteres.
    - Un listado pagina por cursor y su `total` cuenta lo que cumple los filtros.
    - Una solicitud de privacidad en estado terminal no admite más transiciones
      (`PATCH /privacy/dsar/:id` → 422). La lectura va de la más reciente a la más
      antigua, trae `dueAt` (solicitud + 30 días) y `overdue`, y no trae conteos por
      estado ni las transiciones que admite.
    ========================================================================== */

const SIM = 'SIMULADO · ';
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

interface RuleSeed {
  readonly code: string;
  readonly name: string;
  readonly severity: QualitySeverity;
  readonly dimension: [code: string, display: string];
  readonly expression: string;
  readonly guidance: string | null;
}

const RULE_SEEDS: readonly RuleSeed[] = [
  {
    code: 'DQ-IDENT-001',
    name: `${SIM}El documento de identidad no puede estar vacío`,
    severity: 'ERROR',
    dimension: ['DQ_COMPLETENESS', 'Completitud'],
    expression: "identifier.where(system = 'documento').value.exists()",
    guidance: 'Pedir el documento en la admisión y reprocesar el registro.',
  },
  {
    code: 'DQ-ENC-014',
    name: `${SIM}La fecha de alta no puede ser anterior a la de ingreso`,
    severity: 'FATAL',
    dimension: ['DQ_CONSISTENCY', 'Consistencia'],
    expression: 'period.end >= period.start',
    guidance: null,
  },
  {
    code: 'DQ-OBS-203',
    name: `${SIM}El valor de laboratorio debe traer unidad`,
    severity: 'WARNING',
    dimension: ['DQ_VALIDITY', 'Validez'],
    expression: 'value.ofType(Quantity).unit.exists()',
    guidance: 'Mapear la unidad con el catálogo de terminología.',
  },
];

interface IssueSeed {
  readonly rule: number;
  readonly field: string;
  readonly status: QualityIssueStatus;
  readonly createdAt: string;
  readonly resolvedAt?: string;
  readonly text?: string;
}

const ISSUE_SEEDS: readonly IssueSeed[] = [
  { rule: 0, field: 'identifier[0].value', status: 'OPEN', createdAt: '2026-10-30T14:00:00.000Z' },
  { rule: 0, field: 'identifier[1].value', status: 'OPEN', createdAt: '2026-10-29T09:30:00.000Z' },
  { rule: 1, field: 'period.end', status: 'OPEN', createdAt: '2026-10-28T18:10:00.000Z' },
  { rule: 2, field: 'value.unit', status: 'OPEN', createdAt: '2026-10-27T11:00:00.000Z' },
  {
    rule: 2,
    field: 'value.unit',
    status: 'RESOLVED',
    createdAt: '2026-10-20T08:00:00.000Z',
    resolvedAt: '2026-10-21T10:00:00.000Z',
    text: 'Se mapeó la unidad en el catálogo y se reprocesó el lote.',
  },
  {
    rule: 1,
    field: '$',
    status: 'DISMISSED',
    createdAt: '2026-10-18T08:00:00.000Z',
    resolvedAt: '2026-10-19T10:00:00.000Z',
    text: 'Falso positivo: el encuentro es un ingreso programado a futuro.',
  },
];

/** Una solicitud como la sirve `GET /privacy/dsar` (fechas ISO; jurisdicción con el prefijo del concepto). */
interface DsarWire {
  readonly id: string;
  readonly subjectUserId: string;
  readonly type: PrivacyType;
  readonly status: PrivacyStatus;
  readonly jurisdiction: `JURISDICTION_${PrivacyJurisdiction}` | null;
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly dueAt: string;
  readonly overdue: boolean;
  readonly hasResultFile: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const DSAR_SEEDS: readonly {
  type: PrivacyType;
  status: PrivacyStatus;
  jurisdiction: DsarWire['jurisdiction'];
  requestedAt: string;
  completedAt?: string;
}[] = [
  { type: 'ACCESS', status: 'RECEIVED', jurisdiction: 'JURISDICTION_PE', requestedAt: '2026-09-20T10:00:00.000Z' },
  { type: 'ERASURE', status: 'IN_PROGRESS', jurisdiction: null, requestedAt: '2026-10-12T15:00:00.000Z' },
  { type: 'PORTABILITY', status: 'RECEIVED', jurisdiction: 'JURISDICTION_EU', requestedAt: '2026-10-20T09:00:00.000Z' },
  {
    type: 'RECTIFICATION',
    status: 'COMPLETED',
    jurisdiction: 'JURISDICTION_PE',
    requestedAt: '2026-09-15T09:00:00.000Z',
    completedAt: '2026-09-22T09:00:00.000Z',
  },
  { type: 'OBJECTION', status: 'REJECTED', jurisdiction: 'JURISDICTION_US', requestedAt: '2026-09-01T09:00:00.000Z' },
];

/** Plazo fijo de la API para `dueAt` y el «ahora» fijo con el que el simulador decide `overdue`. */
const DSAR_DUE_DAYS = 30;
const DSAR_REFERENCE_NOW = new Date('2026-10-31T12:00:00.000Z');

function dueAt(requestedAt: string): string {
  return new Date(new Date(requestedAt).getTime() + DSAR_DUE_DAYS * 86_400_000).toISOString();
}

const MAX_LIMIT = 100;

function limitOf(req: MockRequest): number {
  const raw = Number(req.query.get('limit') ?? 25);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), MAX_LIMIT) : 25;
}

function pageOf<T extends { id: string }>(req: MockRequest, rows: readonly T[]) {
  const limit = limitOf(req);
  const cursor = req.query.get('cursor');
  const from = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
  const items = rows.slice(from, from + limit);
  const more = from + limit < rows.length;
  return { items, nextCursor: more ? (items[items.length - 1]?.id ?? null) : null, limit, total: rows.length };
}

function badRequest(message: string) {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message,
    error: 'Bad Request',
    reason: 'VALIDATION_PIPE_REJECTED',
    details: { violations: [message] },
  });
}

export function registrarCalidadYPrivacidad(router: MockRouter): void {
  const rules: QualityRule[] = RULE_SEEDS.map((s, i) => ({
    id: uuid(100 + i),
    ruleCode: s.code,
    name: s.name,
    severity: s.severity,
    state: { code: 'ACTIVE', display: 'Activa' },
    dimension: { code: s.dimension[0], display: s.dimension[1] },
    ruleSet: { id: uuid(90), code: 'DQ-BASE', name: `${SIM}Reglas base`, version: '1.0' },
    openIssues: 0,
    totalIssues: 0,
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  }));
  const issues: QualityIssue[] = ISSUE_SEEDS.map((s, i) => ({
    id: uuid(200 + i),
    ruleId: rules[s.rule]!.id,
    ruleCode: rules[s.rule]!.ruleCode,
    ruleName: rules[s.rule]!.name,
    severity: rules[s.rule]!.severity,
    status: s.status,
    fieldPath: s.field,
    resourceId: null,
    assignedUserId: null,
    tenantId: uuid(1),
    runId: uuid(300),
    createdAt: new Date(s.createdAt),
    ...(s.resolvedAt ? { resolvedAt: new Date(s.resolvedAt) } : {}),
    resolutionText: s.text ?? null,
  }));
  const requests: DsarWire[] = DSAR_SEEDS.map((x, i) => {
    const open = x.status === 'RECEIVED' || x.status === 'IN_PROGRESS';
    const due = dueAt(x.requestedAt);
    return {
      id: uuid(400 + i),
      subjectUserId: uuid(500 + i),
      type: x.type,
      status: x.status,
      jurisdiction: x.jurisdiction,
      requestedAt: x.requestedAt,
      completedAt: x.completedAt ?? null,
      dueAt: due,
      overdue: open && DSAR_REFERENCE_NOW > new Date(due),
      hasResultFile: false,
      version: 1,
      createdAt: x.requestedAt,
      updatedAt: x.completedAt ?? x.requestedAt,
    };
  });

  const withCounts = (r: QualityRule): QualityRule => ({
    ...r,
    openIssues: issues.filter((i) => i.ruleId === r.id && i.status === 'OPEN').length,
    totalIssues: issues.filter((i) => i.ruleId === r.id).length,
  });

  // ---- incidencias ----
  router.get('/admin/governance/data-quality/issues', (req) => {
    const status = req.query.get('status');
    const severity = req.query.get('severity');
    const ruleId = req.query.get('ruleId');
    const q = (req.query.get('q') ?? '').toLowerCase();
    if (status && !['OPEN', 'RESOLVED', 'DISMISSED'].includes(status)) return badRequest('status inválido');
    const rows = issues
      .filter((i) => !status || i.status === status)
      .filter((i) => !severity || i.severity === severity)
      .filter((i) => !ruleId || i.ruleId === ruleId)
      .filter((i) => !q || `${i.fieldPath} ${i.ruleCode} ${i.ruleName}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
    return pageOf(req, rows);
  });

  router.get('/admin/governance/data-quality/issues/:id', (req) => {
    const issue = issues.find((i) => i.id === req.params['id']);
    return issue ?? notFound('Incidencia no encontrada');
  });

  router.post('/admin/governance/data-quality/issues/:id/resolution', (req) => {
    const issue = issues.find((i) => i.id === req.params['id']);
    if (!issue) return notFound('Incidencia no encontrada');
    const body = (req.body ?? {}) as { action?: string; note?: string };
    if (body.action !== 'RESOLVE' && body.action !== 'DISMISS') return badRequest('action inválida');
    const note = (body.note ?? '').trim();
    if (note.length < 10 || note.length > 2000)
      return badRequest('note debe medir entre 10 y 2000 caracteres');
    const target: QualityIssueStatus = body.action === 'RESOLVE' ? 'RESOLVED' : 'DISMISSED';
    if (issue.status === 'OPEN') {
      const index = issues.indexOf(issue);
      const closed: QualityIssue = { ...issue, status: target, resolvedAt: new Date(), resolutionText: note };
      issues[index] = closed;
      return { issue: closed, alreadyApplied: false };
    }
    if (issue.status === target) return { issue, alreadyApplied: true };
    return conflict('La incidencia ya no está abierta: otra persona la cerró con otro desenlace', {
      id: issue.id,
      currentStatus: issue.status,
    });
  });

  // ---- reglas ----
  router.get('/admin/governance/data-quality/rules', (req) => {
    const severity = req.query.get('severity');
    const dimension = req.query.get('dimension');
    const q = (req.query.get('q') ?? '').toLowerCase();
    const rows = rules
      .map(withCounts)
      .filter((r) => !severity || r.severity === severity)
      .filter((r) => !dimension || r.dimension.code === dimension)
      .filter((r) => !q || `${r.ruleCode} ${r.name}`.toLowerCase().includes(q))
      .sort((a, b) => a.ruleCode.localeCompare(b.ruleCode));
    return pageOf(req, rows);
  });

  router.get('/admin/governance/data-quality/rules/:id', (req) => {
    const index = rules.findIndex((r) => r.id === req.params['id']);
    if (index < 0) return notFound('Regla no encontrada');
    const rule = withCounts(rules[index]!);
    const mine = issues.filter((i) => i.ruleId === rule.id);
    const count = (s: QualityIssueStatus): number => mine.filter((i) => i.status === s).length;
    const detail: QualityRuleDetail = {
      ...rule,
      ruleExpression: RULE_SEEDS[index]!.expression,
      expressionLanguage: 'FHIRPATH',
      remediationGuidance: RULE_SEEDS[index]!.guidance,
      issuesByStatus: { OPEN: count('OPEN'), RESOLVED: count('RESOLVED'), DISMISSED: count('DISMISSED'), other: 0 },
      recentRuns: [
        {
          id: uuid(300),
          startedAt: new Date('2026-10-30T13:50:00.000Z'),
          completedAt: new Date('2026-10-30T14:00:00.000Z'),
          result: { code: 'QUAL_FAIL', display: 'Quality run failed' },
          recordsEvaluated: 1200,
          issuesDetected: 3,
        },
        {
          id: uuid(301),
          startedAt: new Date('2026-10-29T13:50:00.000Z'),
          result: { code: 'QUAL_PASS', display: 'Quality run passed' },
          recordsEvaluated: null,
          issuesDetected: 0,
        },
      ],
    };
    return detail;
  });

  // ---- solicitudes de privacidad (`audit`) ----
  router.get('/privacy/dsar', (req) => {
    const status = req.query.get('status');
    const type = req.query.get('type');
    const rows = requests
      .filter((r) => !status || r.status === status)
      .filter((r) => !type || r.type === type)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || b.id.localeCompare(a.id));
    const { items, nextCursor, limit } = pageOf(req, rows);
    return {
      items,
      nextCursor,
      limit,
      order: 'requested_at desc, id desc',
      notMeasured: [
        {
          field: 'resultFile',
          reason: 'SIMULADO · El paquete resultante no se expone desde esta lectura: sólo se indica si existe (hasResultFile)',
        },
        {
          field: 'slaPolicy',
          reason: `SIMULADO · dueAt usa un plazo fijo de ${DSAR_DUE_DAYS} días desde la solicitud; no hay plazo por jurisdicción`,
        },
      ],
    };
  });

  router.get('/privacy/dsar/:id', (req) => {
    return requests.find((r) => r.id === req.params['id']) ?? notFound('Solicitud DSAR no encontrada');
  });

  router.patch('/privacy/dsar/:id', (req) => {
    const index = requests.findIndex((r) => r.id === req.params['id']);
    if (index < 0) return notFound('Solicitud DSAR no encontrada');
    const current = requests[index]!;
    const target = (req.body as { status?: string } | null)?.status as PrivacyStatus | undefined;
    if (target !== 'IN_PROGRESS' && target !== 'COMPLETED' && target !== 'REJECTED')
      return badRequest('status debe ser IN_PROGRESS, COMPLETED o REJECTED');
    if (allowedTransitions(current.status).length === 0) {
      return precondition('La solicitud DSAR ya está en estado terminal', 'DSAR_TERMINAL', { id: current.id });
    }
    const now = new Date().toISOString();
    requests[index] = {
      ...current,
      status: target,
      ...(target === 'COMPLETED' ? { completedAt: now } : {}),
      overdue: target === 'IN_PROGRESS' ? current.overdue : false,
      updatedAt: now,
      version: current.version + 1,
    };
    return { id: current.id, userId: current.subjectUserId, rowVersion: current.version + 1 };
  });
}
