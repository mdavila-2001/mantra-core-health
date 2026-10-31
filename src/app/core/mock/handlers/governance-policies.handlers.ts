import { notFound, reply, type MockRequest, type MockRouter } from '../mock-router';
import {
  POLICY_TYPES,
  PII_SENSITIVITIES,
  PII_SOURCES,
} from '../../data-access/admin-portal/governance-policies.types';

/* ============================================================================
    Backend simulado de las políticas de gobierno y del inventario de campos con
    datos personales (`GET /admin/governance/policies`, `/policies/:id` y
    `/pii-fields`).

    **SIMULADO · DATOS SINTÉTICOS**, fijos: dos corridas dan lo mismo. Ningún
    nombre de política, tabla o columna sale de la base real ni de un catálogo
    oficial; cada código lleva el sufijo «(SIMULADO)» en su nombre. El contrato
    lo cumple `GovernanceReadController` de la API (módulo `system_ops`):
    - paginación por cursor opaco (`nextCursor`) con `total` del filtro entero;
    - `byType` cuenta sobre la búsqueda, ignorando el filtro de tipo;
    - la configuración de una regla oculta lo que parece un secreto;
    - filtros desconocidos o fuera de rango son un 400 (la API valida con
      `forbidNonWhitelisted`).
    ========================================================================== */

const SIMULADO = ' (SIMULADO)';
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const ACTIVO = { stateCode: 'ACTIVE', stateLabel: 'Activo' } as const;

interface PoliticaSintetica {
  readonly id: string;
  readonly type: (typeof POLICY_TYPES)[number];
  readonly code: string;
  readonly name: string | null;
  readonly stateCode: string | null;
  readonly stateLabel: string | null;
  readonly attributes: Record<string, string | number | boolean | null>;
  readonly updatedAt: string | null;
  readonly configuration: unknown;
  readonly appliesTo: readonly {
    kind: 'ENTITY' | 'FIELD' | 'TENANT_BINDING';
    total: number;
    items: readonly string[];
    truncated: boolean;
  }[];
  readonly history: readonly {
    id: string;
    action: string | null;
    changedByUserId: string;
    reason: string | null;
    recordedAt: string;
  }[];
}

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const POLITICAS: readonly PoliticaSintetica[] = [
  {
    id: id(1),
    type: 'WRITE',
    code: 'SIM-WRITE-APPEND',
    name: `Sólo agregar${SIMULADO}`,
    ...ACTIVO,
    attributes: {
      insertMode: 'Permitido',
      updateMode: 'Prohibido',
      deleteMode: 'Prohibido',
      requiresReason: true,
      requiresApproval: false,
      dualControl: false,
      maxBatchSize: 500,
    },
    updatedAt: '2026-10-01T14:00:00.000Z',
    configuration: null,
    appliesTo: [
      {
        kind: 'ENTITY',
        total: 3,
        items: ['sim_ledger.entries', 'sim_ledger.movements', 'sim_audit.events'],
        truncated: false,
      },
    ],
    history: [
      {
        id: id(901),
        action: 'Alta',
        changedByUserId: id(800),
        reason: 'Carga inicial sintética',
        recordedAt: '2026-10-01T14:00:00.000Z',
      },
    ],
  },
  {
    id: id(2),
    type: 'WRITE',
    code: 'SIM-WRITE-DUAL',
    name: `Doble control${SIMULADO}`,
    ...ACTIVO,
    attributes: {
      insertMode: 'Con aprobación',
      updateMode: 'Con aprobación',
      deleteMode: 'Prohibido',
      requiresReason: true,
      requiresApproval: true,
      dualControl: true,
      maxBatchSize: null,
    },
    updatedAt: '2026-10-03T09:30:00.000Z',
    configuration: null,
    appliesTo: [{ kind: 'ENTITY', total: 0, items: [], truncated: false }],
    history: [],
  },
  {
    id: id(3),
    type: 'RETENTION',
    code: 'SIM-RET-10Y',
    name: `Diez años${SIMULADO}`,
    ...ACTIVO,
    attributes: {
      retentionPeriodDays: 3650,
      legalBasis: 'Obligación legal',
      disposition: 'Archivar',
      jurisdiction: 'Bolivia',
    },
    updatedAt: '2026-09-28T10:00:00.000Z',
    configuration: null,
    appliesTo: [
      {
        kind: 'ENTITY',
        total: 2,
        items: ['sim_clinical.notes', 'sim_clinical.orders'],
        truncated: false,
      },
    ],
    history: [
      {
        id: id(902),
        action: 'Cambio de plazo',
        changedByUserId: id(800),
        reason: 'Ajuste sintético',
        recordedAt: '2026-09-28T10:00:00.000Z',
      },
    ],
  },
  {
    id: id(4),
    type: 'RETENTION',
    code: 'SIM-RET-NODEADLINE',
    name: `Sin plazo declarado${SIMULADO}`,
    stateCode: 'DRAFT',
    stateLabel: 'Borrador',
    attributes: {
      retentionPeriodDays: null,
      legalBasis: null,
      disposition: null,
      jurisdiction: null,
    },
    updatedAt: null,
    configuration: null,
    appliesTo: [{ kind: 'ENTITY', total: 0, items: [], truncated: false }],
    history: [],
  },
  {
    id: id(5),
    type: 'ANONYMIZATION',
    code: 'SIM-ANON-HASH',
    name: null,
    stateCode: null,
    stateLabel: null,
    attributes: {
      technique: 'Hash con sal',
      description: `Hash irreversible de identificadores${SIMULADO}`,
    },
    updatedAt: '2026-09-20T08:00:00.000Z',
    // El servidor oculta lo que parece un secreto: la maqueta lo cumple igual.
    configuration: { algorithm: 'sha256', salt: '[oculto]', keepLast: 0 },
    appliesTo: [
      {
        kind: 'FIELD',
        total: 52,
        items: Array.from(
          { length: 50 },
          (_, i) => `sim_iam.people.campo_${String(i + 1).padStart(2, '0')}`,
        ),
        truncated: true,
      },
    ],
    history: [],
  },
  {
    id: id(6),
    type: 'CLASSIFICATION',
    code: 'SIM-PERSONAL',
    name: `Datos personales${SIMULADO}`,
    ...ACTIVO,
    attributes: { rank: 50, isPii: true, isPhi: false },
    updatedAt: '2026-09-15T12:00:00.000Z',
    configuration: { encryptAtRest: true, maskInLogs: true },
    appliesTo: [
      { kind: 'ENTITY', total: 1, items: ['sim_iam.people'], truncated: false },
      {
        kind: 'FIELD',
        total: 2,
        items: ['sim_iam.people.nombre', 'sim_iam.people.documento'],
        truncated: false,
      },
    ],
    history: [],
  },
  {
    id: id(7),
    type: 'RESIDENCY',
    code: 'SIM-RES-BO',
    name: null,
    stateCode: 'ACTIVE',
    stateLabel: 'Vigente',
    attributes: {
      jurisdiction: 'Bolivia',
      dataClassification: 'SIM-PERSONAL',
      transferBasis: null,
      transferImpactAssessmentRequired: true,
      encryptionKeyRegionLocked: true,
      validFrom: '2026-01-01T00:00:00.000Z',
      validTo: null,
    },
    updatedAt: '2026-08-01T00:00:00.000Z',
    configuration: null,
    appliesTo: [{ kind: 'TENANT_BINDING', total: 4, items: [], truncated: false }],
    history: [],
  },
];

interface Campo {
  schemaName: string;
  tableName: string;
  columnName: string;
  sensitivity: string | null;
  reviewStatus: string | null;
  source: (typeof PII_SOURCES)[number];
  registry: null | {
    isPii: boolean | null;
    isPhi: boolean | null;
    classification: string | null;
    maskingStrategy: string | null;
    anonymizationRule: string | null;
  };
}

const campo = (
  schemaName: string,
  tableName: string,
  columnName: string,
  sensitivity: string | null,
  reviewStatus: string | null,
  registry: Campo['registry'],
): Campo => ({
  schemaName,
  tableName,
  columnName,
  sensitivity,
  reviewStatus,
  registry,
  source: sensitivity && registry ? 'BOTH' : sensitivity ? 'CATALOG' : 'REGISTRY',
});

const protegido = {
  isPii: true,
  isPhi: false,
  classification: 'SIM-PERSONAL',
  maskingStrategy: 'MASK_LAST4',
  anonymizationRule: 'SIM-ANON-HASH',
};

const CAMPOS: readonly Campo[] = [
  campo('sim_iam', 'people', 'documento', 'PHI_IDENTIFIER', 'APPROVED', protegido),
  campo('sim_iam', 'people', 'nombre', 'PERSONAL', 'APPROVED', protegido),
  campo('sim_iam', 'people', 'correo', 'PERSONAL', 'AUTO_DETECTED', null),
  campo('sim_iam', 'people', 'telefono', 'PERSONAL', 'NEEDS_REVIEW', null),
  campo('sim_iam', 'credentials', 'secreto', 'CREDENTIAL', 'APPROVED', null),
  campo('sim_clinical', 'notes', 'diagnostico', 'PHI_SPECIAL', 'AUTO_DETECTED', null),
  campo('sim_clinical', 'notes', 'texto_libre', 'PHI_SENSITIVE', 'AUTO_DETECTED', null),
  campo('sim_clinical', 'patients', 'fecha_nacimiento', null, null, {
    isPii: true,
    isPhi: false,
    classification: null,
    maskingStrategy: null,
    anonymizationRule: null,
  }),
];

function invalido(clave: string) {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: `Parámetro no válido: ${clave}`,
    error: 'Bad Request',
    details: { parameter: clave },
  });
}

function texto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function coincide(q: string | null, ...campos: (string | null)[]): boolean {
  if (!q?.trim()) return true;
  return campos.some((c) => c && texto(c).includes(texto(q.trim())));
}

/** `limit` y `cursor` (un desplazamiento en texto, opaco para el cliente). */
function paginacion(
  req: MockRequest,
): { offset: number; limit: number } | ReturnType<typeof reply> {
  const limitTexto = req.query.get('limit');
  const limit = limitTexto === null ? DEFAULT_LIMIT : Number(limitTexto);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return invalido('limit');
  const cursor = req.query.get('cursor');
  const offset = cursor === null ? 0 : Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) return invalido('cursor');
  return { offset, limit };
}

function pagina<T>(todos: readonly T[], p: { offset: number; limit: number }) {
  const items = todos.slice(p.offset, p.offset + p.limit);
  const siguiente = p.offset + p.limit;
  return {
    items,
    nextCursor: siguiente < todos.length ? String(siguiente) : null,
    limit: p.limit,
    total: todos.length,
  };
}

const CLAVES_POLITICAS = new Set(['type', 'q', 'cursor', 'limit']);
const CLAVES_PII = new Set(['q', 'schema', 'sensitivity', 'source', 'cursor', 'limit']);

function claveDesconocida(req: MockRequest, permitidas: ReadonlySet<string>): string | null {
  for (const clave of req.query.keys()) if (!permitidas.has(clave)) return clave;
  return null;
}

export function registrarPoliticasGobierno(router: MockRouter): void {
  router.get('/admin/governance/policies', (req: MockRequest) => {
    const desconocida = claveDesconocida(req, CLAVES_POLITICAS);
    if (desconocida) return invalido(desconocida);
    const tipo = req.query.get('type');
    if (tipo !== null && !(POLICY_TYPES as readonly string[]).includes(tipo))
      return invalido('type');
    const p = paginacion(req);
    if ('status' in p) return p;
    const q = req.query.get('q');
    const buscadas = POLITICAS.filter((x) => coincide(q, x.code, x.name));
    const filtradas = buscadas
      .filter((x) => tipo === null || x.type === tipo)
      .sort((a, b) => (`${a.type}|${a.code}` < `${b.type}|${b.code}` ? -1 : 1));
    const page = pagina(filtradas, p);
    return {
      ...page,
      items: page.items.map(
        ({ configuration: _c, appliesTo: _a, history: _h, ...resumen }) => resumen,
      ),
      byType: POLICY_TYPES.map((type) => ({
        type,
        total: buscadas.filter((x) => x.type === type).length,
      })),
    };
  });

  router.get('/admin/governance/policies/:id', (req: MockRequest) => {
    const encontrada = POLITICAS.find((x) => x.id === req.params['id']);
    return encontrada ?? notFound('Política no encontrada');
  });

  router.get('/admin/governance/pii-fields', (req: MockRequest) => {
    const desconocida = claveDesconocida(req, CLAVES_PII);
    if (desconocida) return invalido(desconocida);
    const nivel = req.query.get('sensitivity');
    if (nivel !== null && !(PII_SENSITIVITIES as readonly string[]).includes(nivel))
      return invalido('sensitivity');
    const fuente = req.query.get('source');
    if (fuente !== null && !(PII_SOURCES as readonly string[]).includes(fuente))
      return invalido('source');
    const esquema = req.query.get('schema');
    if (esquema !== null && !/^[A-Za-z0-9_]{1,80}$/.test(esquema)) return invalido('schema');
    const p = paginacion(req);
    if ('status' in p) return p;
    const q = req.query.get('q');
    const filtrados = CAMPOS.filter(
      (c) =>
        (esquema === null || c.schemaName === esquema) &&
        (nivel === null || c.sensitivity === nivel) &&
        (fuente === null || c.source === fuente) &&
        coincide(q, c.schemaName, c.tableName, c.columnName),
    ).sort((a, b) =>
      `${a.schemaName}|${a.tableName}|${a.columnName}` <
      `${b.schemaName}|${b.tableName}|${b.columnName}`
        ? -1
        : 1,
    );
    const bySensitivity: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const c of filtrados) {
      const k = c.sensitivity ?? 'SIN_NIVEL_EN_CATALOGO';
      bySensitivity[k] = (bySensitivity[k] ?? 0) + 1;
      bySource[c.source] = (bySource[c.source] ?? 0) + 1;
    }
    return {
      ...pagina(filtrados, p),
      summary: {
        fields: filtrados.length,
        tables: new Set(filtrados.map((c) => `${c.schemaName}.${c.tableName}`)).size,
        approved: filtrados.filter((c) => c.reviewStatus === 'APPROVED').length,
        withoutProtection: filtrados.filter(
          (c) => !c.registry || (!c.registry.maskingStrategy && !c.registry.anonymizationRule),
        ).length,
        bySensitivity,
        bySource,
      },
      // SIMULADO: el catálogo sintético tiene muchas más columnas que las que se listan.
      sources: { catalogColumns: 912, registryFields: 3 },
    };
  });
}
