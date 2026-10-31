import { forbidden, notFound, reply, type MockRequest, type MockRouter } from '../mock-router';
import {
  DISPOSITIONS,
  EVIDENCE_LEVELS,
  FINDING_FILTERS,
  LEGAL_HOLD_STATES,
  WRITE_MODES,
  type Disposition,
  type EvidenceLevel,
  type LegalHoldState,
  type MutabilityDetail,
  type MutabilityEvidence,
  type MutabilityFinding,
  type MutabilityItem,
  type MutabilitySummary,
  type WriteMode,
} from '../../data-access/admin-portal/mutability.types';

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

type Ev = MutabilityEvidence;
const ev = (
  kind: string,
  level: EvidenceLevel,
  supports: Ev['supports'],
  source: string,
  claim: string,
): Ev => ({ kind, level, supports, source, claim });

interface Sintetica {
  readonly table: string;
  readonly writeMode: WriteMode;
  readonly writeModeLevel: EvidenceLevel;
  readonly disposition?: Disposition;
  readonly dispositionLevel?: EvidenceLevel;
  readonly retention?: { days: number | null; source: string | null };
  readonly legalHold?: LegalHoldState;
  readonly registered?: boolean;
  readonly evidence: readonly Ev[];
  readonly findings?: readonly MutabilityFinding[];
}

const MODELO = 'simulado:modelo/sim.sql';

const DISPARADOR = (t: string): Ev =>
  ev(
    'TRIGGER_BLOCK',
    'ENFORCED_DB',
    'WRITE_MODE',
    `${MODELO}:${t}`,
    'trg_sim → forbid_mutation: impide UPDATE + DELETE',
  );

const FILAS: readonly Sintetica[] = [
  {
    table: 'bitacora_inmutable',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'ENFORCED_DB',
    registered: true,
    evidence: [
      DISPARADOR('12'),
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:20',
        'Diagrama: <<IMMUTABLE>>',
      ),
    ],
  },
  {
    table: 'eventos_de_acceso',
    writeMode: 'APPEND_ONLY_PURGEABLE',
    writeModeLevel: 'ENFORCED_DB',
    disposition: 'PURGE_BY_RETENTION',
    dispositionLevel: 'ENFORCED_CODE',
    legalHold: 'HOLD_CAPABLE_NOT_ENFORCED',
    registered: true,
    retention: { days: 90, source: 'simulado:matriz.md:7' },
    evidence: [
      ev(
        'TRIGGER_BLOCK',
        'ENFORCED_DB',
        'WRITE_MODE',
        `${MODELO}:31`,
        'trg_sim → forbid_mutation: impide UPDATE',
      ),
      ev(
        'CODE_PURGE_PATH',
        'ENFORCED_CODE',
        'DISPOSITION',
        'simulado:src/purga.ts:40',
        'El repositorio borra filas anteriores a una fecha de corte',
      ),
      ev(
        'RETENTION_DECLARED',
        'DECLARED_MODEL',
        'DISPOSITION',
        'simulado:matriz.md:7',
        'Matriz de integridad: RETENTION 90 days',
      ),
      ev(
        'CODE_NO_HOLD_SWEEP',
        'ENFORCED_CODE',
        'LEGAL_HOLD',
        'simulado:src/modulo.ts:79',
        'Ningún barrido genérico consulta legal_holds',
      ),
    ],
  },
  {
    table: 'revisiones_de_politica',
    writeMode: 'LIFECYCLE_ONLY',
    writeModeLevel: 'ENFORCED_DB',
    registered: true,
    evidence: [
      ev(
        'LIFECYCLE_GUARD',
        'ENFORCED_DB',
        'WRITE_MODE',
        `${MODELO}:55`,
        'guarda de ciclo de vida: impide UPDATE parcial + DELETE',
      ),
    ],
    findings: [
      {
        kind: 'CONTRADICTION',
        code: 'ENFORCED_WITHOUT_DECLARATION',
        severity: 'MEDIUM',
        summary:
          'Hay una barrera física en la base de datos, pero ni el diagrama, ni la matriz de integridad ni el README la declaran: el modelo se contradice a sí mismo.',
        a: ev(
          'LIFECYCLE_GUARD',
          'ENFORCED_DB',
          'WRITE_MODE',
          `${MODELO}:55`,
          'guarda de ciclo de vida: impide UPDATE parcial + DELETE',
        ),
      },
    ],
  },
  {
    table: 'firmas_de_nota',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_MODEL',
    registered: false,
    evidence: [
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:88',
        'Diagrama: <<IMMUTABLE>>',
      ),
      ev(
        'CODE_UPDATE',
        'ENFORCED_CODE',
        'WRITE_MODE',
        'simulado:src/notas.ts:558',
        'Inventario de endpoints: ACTUALIZA (confianza DIRECTA)',
      ),
    ],
    findings: [
      {
        kind: 'CONTRADICTION',
        code: 'DECLARED_VS_CODE_UPDATE',
        severity: 'HIGH',
        summary:
          'Declaración del modelo impide UPDATE, pero el inventario de código registra ACTUALIZA (1 observación(es); confianza DIRECTA). No se resuelve: decide el dueño del dominio.',
        a: ev(
          'STEREOTYPE',
          'DECLARED_MODEL',
          'WRITE_MODE',
          'simulado:diagrama.puml:88',
          'Diagrama: <<IMMUTABLE>>',
        ),
        b: ev(
          'CODE_UPDATE',
          'ENFORCED_CODE',
          'WRITE_MODE',
          'simulado:src/notas.ts:558',
          'Inventario de endpoints: ACTUALIZA (confianza DIRECTA)',
        ),
      },
    ],
  },
  {
    table: 'versiones_de_informe',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_MODEL',
    registered: false,
    evidence: [
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:101',
        'Diagrama: <<IMMUTABLE>>',
      ),
      ev(
        'CODE_UPDATE',
        'INFERRED',
        'WRITE_MODE',
        'simulado:src/informes.ts:190',
        'Inventario de endpoints: ACTUALIZA (confianza POR_TIPO, inferida por tipo de endpoint: no prueba la sentencia)',
      ),
    ],
    findings: [
      {
        kind: 'CONTRADICTION',
        code: 'DECLARED_VS_CODE_UPDATE',
        severity: 'LOW',
        summary:
          'Declaración del modelo impide UPDATE, pero el inventario de código registra ACTUALIZA (1 observación(es); confianza POR_TIPO: inferida, no probada). No se resuelve: decide el dueño del dominio.',
        a: ev(
          'STEREOTYPE',
          'DECLARED_MODEL',
          'WRITE_MODE',
          'simulado:diagrama.puml:101',
          'Diagrama: <<IMMUTABLE>>',
        ),
        b: ev(
          'CODE_UPDATE',
          'INFERRED',
          'WRITE_MODE',
          'simulado:src/informes.ts:190',
          'Inventario de endpoints: ACTUALIZA (confianza POR_TIPO)',
        ),
      },
    ],
  },
  {
    table: 'historial_declarado',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_DOC',
    registered: true,
    evidence: [
      ev(
        'README_DECLARATION',
        'DECLARED_DOC',
        'WRITE_MODE',
        'simulado:README.md:93',
        'README del módulo la lista como append-only',
      ),
    ],
    findings: [
      {
        kind: 'GAP',
        code: 'DECLARED_NOT_ENFORCED',
        severity: 'LOW',
        summary:
          'Está declarada append-only/inmutable pero no hay disparador ni REVOKE que lo impida: es una intención sin imponer.',
        a: ev(
          'README_DECLARATION',
          'DECLARED_DOC',
          'WRITE_MODE',
          'simulado:README.md:93',
          'README del módulo la lista como append-only',
        ),
      },
    ],
  },
  {
    table: 'resultados_verificados',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_MODEL',
    registered: true,
    evidence: [
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:140',
        'Diagrama: <<IMMUTABLE>>',
      ),
    ],
    findings: [
      {
        kind: 'GAP',
        code: 'DECLARED_NOT_ENFORCED',
        severity: 'MEDIUM',
        summary:
          'Está declarada append-only/inmutable pero no hay disparador ni REVOKE que lo impida: es una intención sin imponer.',
        a: ev(
          'STEREOTYPE',
          'DECLARED_MODEL',
          'WRITE_MODE',
          'simulado:diagrama.puml:140',
          'Diagrama: <<IMMUTABLE>>',
        ),
      },
    ],
  },
  {
    table: 'archivos_adjuntos',
    writeMode: 'UPDATABLE_DELETABLE',
    writeModeLevel: 'ENFORCED_CODE',
    disposition: 'PURGE_BY_RETENTION',
    dispositionLevel: 'ENFORCED_CODE',
    legalHold: 'HOLD_AWARE',
    registered: true,
    retention: { days: null, source: null },
    evidence: [
      ev(
        'CODE_DELETE',
        'ENFORCED_CODE',
        'WRITE_MODE',
        'simulado:src/disposicion.ts:124',
        'Inventario de endpoints: BORRA (confianza POR_SQL)',
      ),
      ev(
        'CODE_HOLD_RESOLVER',
        'ENFORCED_CODE',
        'LEGAL_HOLD',
        'simulado:src/holds.ts:30',
        'Un resolvedor único combina holds antes de disponer',
      ),
    ],
  },
  {
    table: 'catalogo_editable',
    writeMode: 'UPDATABLE',
    writeModeLevel: 'ENFORCED_CODE',
    registered: true,
    evidence: [
      ev(
        'CODE_UPDATE',
        'ENFORCED_CODE',
        'WRITE_MODE',
        'simulado:src/catalogo.ts:77',
        'Inventario de endpoints: ACTUALIZA (confianza DIRECTA)',
      ),
    ],
  },
  {
    table: 'mensajes_directos',
    writeMode: 'SOFT_DELETE',
    writeModeLevel: 'INFERRED',
    registered: false,
    evidence: [
      ev(
        'COLUMN_SOFT_DELETE',
        'INFERRED',
        'WRITE_MODE',
        'simulado:modelo/sim.sql:210',
        'Columna deleted_at: pista de borrado lógico (no prueba que se use)',
      ),
    ],
  },
  {
    table: 'perfil_con_version',
    writeMode: 'UPDATABLE',
    writeModeLevel: 'INFERRED',
    registered: false,
    evidence: [
      ev(
        'COLUMN_VERSIONING',
        'INFERRED',
        'WRITE_MODE',
        'simulado:modelo/sim.sql:240',
        'Columna row_version, updated_at: la fila se actualiza (pista estructural)',
      ),
    ],
  },
  {
    table: 'tabla_sin_evidencia',
    writeMode: 'UNKNOWN',
    writeModeLevel: 'UNKNOWN',
    registered: false,
    evidence: [
      ev(
        'STRUCTURE_HINT',
        'INFERRED',
        'CONTEXT',
        'simulado:modelo/sim.sql:260',
        'Sin updated_at, row_version ni deleted_at: candidata a append-only o derivada. NO decidida.',
      ),
    ],
  },
  {
    table: 'otra_sin_evidencia',
    writeMode: 'UNKNOWN',
    writeModeLevel: 'UNKNOWN',
    registered: false,
    evidence: [],
  },
];

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
