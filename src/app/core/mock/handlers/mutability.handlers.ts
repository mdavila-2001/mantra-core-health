import { forbidden, notFound, reply, type MockRequest, type MockRouter } from '../mock-router';
import {
  DISPOSITIONS,
  EVIDENCE_LEVELS,
  FINDING_FILTERS,
  LEGAL_HOLD_STATES,
  WRITE_MODES,
  type MutabilityDetail,
  type MutabilityItem,
  type MutabilitySummary,
} from '../../data-access/admin-portal/mutability.types';
import { FILAS, type Sintetica } from '../fixtures/mutability';

/* ============================================================================
    Backend simulado de la mutabilidad de datos (`GET /admin/governance/mutability`,
    `/summary` y `/:schema/:table`).

    **SIMULADO · DATOS SINTÉTICOS**, fijos: dos corridas dan lo mismo. Las tablas
    viven en el esquema `sim` y no existen en ninguna base: ningún modo, nivel de
    evidencia, contradicción ni plazo sale del modelo real ni de una medición. Sólo
    reproducen las REGLAS del contrato de `MutabilityController` (API, módulo
    `system_ops`):
    - lectura sólo para los roles del portal de datos; el resto recibe 403;
    - paginación por cursor opaco con `total` del filtro entero;
    - filtros desconocidos o fuera de catálogo son un 400 (`forbidNonWhitelisted`);
    - cada valor trae su nivel de evidencia; sin evidencia es `UNKNOWN`, no «No»;
    - una contradicción conserva las dos evidencias y NO cambia el modo;
    - un plazo de retención sólo existe con fuente y siempre queda
      `PENDIENTE_DE_CUMPLIMIENTO`;
    - el resumen trae numerador y denominador, y las cuentas por modo suman el total.
    ========================================================================== */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/** Los mismos roles de lectura que `PORTAL_READ_ROLES` de la API. */
const ROLES_DE_LECTURA = [
  'SECURITY_ADMIN',
  'PLATFORM_ADMIN',
  'GOVERNANCE_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'DPO',
  'AUDITOR',
  'DATA_STEWARD',
] as const;


const CLAVE = (r: { schema: string; table: string }) => `${r.schema}.${r.table}`;

function aItem(f: Sintetica): MutabilityItem {
  return {
    schema: 'sim',
    table: f.table,
    database: 'main',
    writeMode: f.writeMode,
    writeModeLevel: f.writeModeLevel,
    disposition: f.disposition ?? 'UNKNOWN',
    dispositionLevel: f.dispositionLevel ?? 'UNKNOWN',
    retention: f.disposition
      ? {
          days: f.retention?.days ?? null,
          source: f.retention?.source ?? null,
          status: 'PENDIENTE_DE_CUMPLIMIENTO',
        }
      : null,
    legalHold: f.legalHold ?? 'UNKNOWN',
    legalHoldLevel: f.legalHold ? 'ENFORCED_CODE' : 'UNKNOWN',
    contradictions: (f.findings ?? []).filter((x) => x.kind === 'CONTRADICTION').length,
    gaps: (f.findings ?? []).filter((x) => x.kind === 'GAP').length,
    registered: f.registered ?? false,
  };
}

const ITEMS: readonly MutabilityItem[] = FILAS.map(aItem).sort((a, b) =>
  CLAVE(a) < CLAVE(b) ? -1 : 1,
);

function invalido(clave: string) {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: `Parámetro no válido: ${clave}`,
    error: 'Bad Request',
    details: { parameter: clave },
  });
}

const texto = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CLAVES = new Set([
  'schema',
  'writeMode',
  'evidence',
  'finding',
  'disposition',
  'legalHold',
  'database',
  'q',
  'cursor',
  'limit',
]);

function puedeLeer(req: MockRequest): boolean {
  return (req.user?.roles ?? []).some((r) => (ROLES_DE_LECTURA as readonly string[]).includes(r));
}

function en<T extends string>(valor: string | null, catalogo: readonly T[]): boolean {
  return valor === null || (catalogo as readonly string[]).includes(valor);
}

function resumen(): MutabilitySummary {
  const total = ITEMS.length;
  const razonar = (n: number) => ({ numerator: n, denominator: total });
  const cuenta = (p: (i: MutabilityItem) => boolean) => ITEMS.filter(p).length;
  const codigos = new Map<
    string,
    { kind: 'CONTRADICTION' | 'GAP'; findings: number; tables: number }
  >();
  for (const f of FILAS)
    for (const h of f.findings ?? []) {
      const previo = codigos.get(h.code) ?? { kind: h.kind, findings: 0, tables: 0 };
      codigos.set(h.code, { ...previo, findings: previo.findings + 1, tables: previo.tables + 1 });
    }
  return {
    totalTables: total,
    byWriteMode: WRITE_MODES.map((writeMode) => {
      const filas = ITEMS.filter((i) => i.writeMode === writeMode);
      const byEvidence: Record<string, number> = {};
      for (const nivel of EVIDENCE_LEVELS) {
        const n = filas.filter((i) => i.writeModeLevel === nivel).length;
        if (n > 0) byEvidence[nivel] = n;
      }
      return { writeMode, ...razonar(filas.length), byEvidence };
    }),
    byEvidence: EVIDENCE_LEVELS.map((level) => ({
      level,
      ...razonar(cuenta((i) => i.writeModeLevel === level)),
    })),
    decided: razonar(cuenta((i) => i.writeMode !== 'UNKNOWN')),
    enforcedByDatabase: razonar(cuenta((i) => i.writeModeLevel === 'ENFORCED_DB')),
    withContradictions: razonar(cuenta((i) => i.contradictions > 0)),
    withGaps: razonar(cuenta((i) => i.gaps > 0)),
    findingCodes: [...codigos.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) =>
        a.kind === b.kind ? b.tables - a.tables : a.kind === 'CONTRADICTION' ? -1 : 1,
      ),
    disposition: DISPOSITIONS.map((disposition) => ({
      disposition,
      ...razonar(cuenta((i) => i.disposition === disposition)),
    })),
    legalHold: LEGAL_HOLD_STATES.map((legalHold) => ({
      legalHold,
      ...razonar(cuenta((i) => i.legalHold === legalHold)),
    })),
    withDeclaredPeriod: cuenta((i) => i.retention?.days != null),
    pendingCompliance: cuenta((i) => i.retention !== null),
    registered: razonar(cuenta((i) => i.registered === true)),
    sources: { tables: total, simulated: 1 },
    generatedFrom: {
      modelRoot: 'SIMULADO',
      inventoryRoot: 'SIMULADO',
      modelVersion: null,
      note: 'Datos sintéticos de la maqueta: no salen del modelo real.',
    },
  };
}

export function registrarMutabilidad(router: MockRouter): void {
  router.get('/admin/governance/mutability', (req: MockRequest) => {
    if (!puedeLeer(req)) return forbidden();
    for (const clave of req.query.keys()) if (!CLAVES.has(clave)) return invalido(clave);
    const q = (k: string) => req.query.get(k);
    if (!en(q('writeMode'), WRITE_MODES)) return invalido('writeMode');
    if (!en(q('evidence'), EVIDENCE_LEVELS)) return invalido('evidence');
    if (!en(q('finding'), FINDING_FILTERS)) return invalido('finding');
    if (!en(q('disposition'), DISPOSITIONS)) return invalido('disposition');
    if (!en(q('legalHold'), LEGAL_HOLD_STATES)) return invalido('legalHold');
    if (!en(q('database'), ['main', 'pay'] as const)) return invalido('database');
    if (q('schema') !== null && !/^[a-z][a-z0-9_]*$/.test(q('schema')!)) return invalido('schema');
    const limitTexto = q('limit');
    const limit = limitTexto === null ? DEFAULT_LIMIT : Number(limitTexto);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return invalido('limit');
    const offset = q('cursor') === null ? 0 : Number(q('cursor'));
    if (!Number.isInteger(offset) || offset < 0) return invalido('cursor');

    const finding = q('finding');
    const filtradas = ITEMS.filter(
      (i) =>
        (q('schema') === null || i.schema === q('schema')) &&
        (q('writeMode') === null || i.writeMode === q('writeMode')) &&
        (q('evidence') === null || i.writeModeLevel === q('evidence')) &&
        (q('disposition') === null || i.disposition === q('disposition')) &&
        (q('legalHold') === null || i.legalHold === q('legalHold')) &&
        (q('database') === null || i.database === q('database')) &&
        (finding === null ||
          (finding === 'NONE' && i.contradictions + i.gaps === 0) ||
          (finding === 'ANY' && i.contradictions + i.gaps > 0) ||
          (finding === 'CONTRADICTION' && i.contradictions > 0) ||
          (finding === 'GAP' && i.gaps > 0)) &&
        (!q('q')?.trim() || texto(CLAVE(i)).includes(texto(q('q')!.trim()))),
    );
    const items = filtradas.slice(offset, offset + limit);
    const siguiente = offset + limit;
    return {
      items,
      nextCursor: siguiente < filtradas.length ? String(siguiente) : null,
      limit,
      total: filtradas.length,
    };
  });

  router.get('/admin/governance/mutability/summary', (req: MockRequest) =>
    puedeLeer(req) ? resumen() : forbidden(),
  );

  router.get('/admin/governance/mutability/:schema/:table', (req: MockRequest) => {
    if (!puedeLeer(req)) return forbidden();
    const fila = FILAS.find(
      (f) => `sim.${f.table}` === `${req.params['schema']}.${req.params['table']}`,
    );
    if (!fila) return notFound('La tabla no está en el catálogo de mutabilidad');
    const detalle: MutabilityDetail = {
      ...aItem(fila),
      evidence: fila.evidence,
      findings: fila.findings ?? [],
    };
    return detalle;
  });
}
