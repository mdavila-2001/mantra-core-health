import { notFound, reply, type MockRequest, type MockRouter } from '../mock-router';
import {
  PII_MIN_SENSITIVITIES,
  PII_RECONCILIATION_KINDS,
  PII_SORTS,
  POLICY_SORTS,
  POLICY_TYPES,
  type PiiReconciliationKind,
} from '../../data-access/admin-portal/governance-policies.types';
import { REVIEW_STATUSES, SENSITIVITIES } from '../../data-access/admin-portal/data-catalog.types';
import { CAMBIOS, id, POLITICAS, type PoliticaSintetica } from '../fixtures/governance-policies';

/* ============================================================================
    Backend simulado de las políticas de gobierno, su bitácora de cambios y el
    inventario de datos personales. Cumple el contrato REAL de la API:

    - `GET /admin/governance/policies`, `/policies/:policyType/:id` y
      `/change-log` (módulo `system_ops`, `GovernanceReadController`);
    - `GET /admin/catalog/pii/summary`, `/pii/columns` y `/pii/reconciliation`
      (módulo `data_catalog`).

    **SIMULADO · DATOS SINTÉTICOS**, fijos: dos corridas dan lo mismo. Ningún
    nombre de política, tabla o columna sale de la base real ni de un catálogo
    oficial; cada política lleva el prefijo «SIM-» y el sufijo «(SIMULADO)» en su
    nombre. Reglas que la maqueta cumple igual que la API:
    - paginación por cursor opaco; un cursor emitido para otro orden es 400;
    - la lista de políticas no cuenta totales (la API tampoco);
    - de una regla de anonimización sólo salen los NOMBRES de sus parámetros;
    - la bitácora sin `from` mira los últimos 30 días, contados desde un «ahora»
      FIJO (2026-10-31) para que la maqueta no dependa del reloj;
    - parámetros desconocidos o fuera de rango son un 400 (la API valida con
      `forbidNonWhitelisted`).
    ========================================================================== */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const AHORA = new Date('2026-10-31T12:00:00.000Z');
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTIFICADOR = /^[A-Za-z0-9_]{1,63}$/;


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

function claveDesconocida(req: MockRequest, permitidas: ReadonlySet<string>): string | null {
  for (const clave of req.query.keys()) if (!permitidas.has(clave)) return clave;
  return null;
}

/**
 * `limit` y `cursor`. El cursor es un desplazamiento en texto, opaco para el cliente, que
 * lleva el orden con que se emitió: uno de otro orden es 400 (saltaría filas en silencio).
 */
function paginacion(
  req: MockRequest,
  orden: string,
): { offset: number; limit: number } | ReturnType<typeof reply> {
  const limitTexto = req.query.get('limit');
  const limit = limitTexto === null ? DEFAULT_LIMIT : Number(limitTexto);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return invalido('limit');
  const cursor = req.query.get('cursor');
  if (cursor === null) return { offset: 0, limit };
  const [emitidoPara, desplazamiento] = cursor.split('|');
  const offset = Number(desplazamiento);
  if (emitidoPara !== orden || !Number.isInteger(offset) || offset < 0) return invalido('cursor');
  return { offset, limit };
}

function pagina<T>(todos: readonly T[], p: { offset: number; limit: number }, orden: string) {
  const items = todos.slice(p.offset, p.offset + p.limit);
  const siguiente = p.offset + p.limit;
  return {
    items,
    nextCursor: siguiente < todos.length ? `${orden}|${siguiente}` : null,
    limit: p.limit,
  };
}

const CLAVES_POLITICAS = new Set(['type', 'state', 'q', 'sort', 'order', 'cursor', 'limit']);
const CLAVES_CAMBIOS = new Set([
  'targetType',
  'targetId',
  'changedBy',
  'from',
  'to',
  'cursor',
  'limit',
]);
const CLAVES_COLUMNAS = new Set([
  'schema',
  'minSensitivity',
  'sensitivity',
  'reviewStatus',
  'q',
  'sort',
  'cursor',
  'limit',
]);
const CLAVES_CONCILIACION = new Set(['kind', 'schema', 'cursor', 'limit']);

function iso(valor: string | null): Date | null | 'invalido' {
  if (valor === null) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? 'invalido' : d;
}

function registrarPoliticas(router: MockRouter): void {
  router.get('/admin/governance/policies', (req: MockRequest) => {
    const desconocida = claveDesconocida(req, CLAVES_POLITICAS);
    if (desconocida) return invalido(desconocida);
    const tipo = req.query.get('type');
    if (tipo !== null && !(POLICY_TYPES as readonly string[]).includes(tipo))
      return invalido('type');
    const sort = req.query.get('sort') ?? 'code';
    if (!(POLICY_SORTS as readonly string[]).includes(sort)) return invalido('sort');
    const order = req.query.get('order') ?? 'asc';
    if (order !== 'asc' && order !== 'desc') return invalido('order');
    const estado = req.query.get('state');
    if (estado !== null && !/^[A-Za-z0-9_.:-]{1,100}$/.test(estado)) return invalido('state');
    const q = req.query.get('q');
    if (q !== null && q.length > 120) return invalido('q');
    const p = paginacion(req, `${sort}:${order}`);
    if ('status' in p) return p;
    const signo = order === 'asc' ? 1 : -1;
    const clave = (x: PoliticaSintetica) => (sort === 'code' ? x.code : x.updatedAt);
    const filtradas = POLITICAS.filter(
      (x) =>
        (tipo === null || x.policyType === tipo) &&
        (estado === null || x.state === estado) &&
        coincide(q, x.code, x.name),
    ).sort(
      (a, b) =>
        signo * (clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0) || (a.id < b.id ? -1 : 1),
    );
    const page = pagina(filtradas, p, `${sort}:${order}`);
    return {
      ...page,
      items: page.items.map((x) => ({
        policyType: x.policyType,
        id: x.id,
        code: x.code,
        name: x.name,
        state: x.state,
        version: x.version,
        updatedAt: x.updatedAt,
      })),
      sort,
      order,
    };
  });

  router.get('/admin/governance/policies/:policyType/:id', (req: MockRequest) => {
    const tipo = req.params['policyType'] ?? '';
    const policyId = req.params['id'] ?? '';
    if (!(POLICY_TYPES as readonly string[]).includes(tipo)) return invalido('policyType');
    if (!UUID.test(policyId)) return invalido('id');
    // Un id que existe en otro tipo también es 404, como en la API.
    const encontrada = POLITICAS.find((x) => x.id === policyId && x.policyType === tipo);
    if (!encontrada) return notFound('Política no encontrada');
    const { policyType, id: pid, code, name, state, version, createdAt, updatedAt } = encontrada;
    return {
      policyType,
      id: pid,
      code,
      name,
      state,
      version,
      createdAt,
      updatedAt,
      createdByUserId: encontrada.createdByUserId,
      updatedByUserId: encontrada.updatedByUserId,
      settings: encontrada.settings,
      appliedTo: encontrada.appliedTo,
    };
  });

  router.get('/admin/governance/change-log', (req: MockRequest) => {
    const desconocida = claveDesconocida(req, CLAVES_CAMBIOS);
    if (desconocida) return invalido(desconocida);
    const targetType = req.query.get('targetType');
    if (targetType !== null && !IDENTIFICADOR.test(targetType)) return invalido('targetType');
    for (const clave of ['targetId', 'changedBy'] as const) {
      const valor = req.query.get(clave);
      if (valor !== null && !UUID.test(valor)) return invalido(clave);
    }
    const desde = iso(req.query.get('from'));
    const hasta = iso(req.query.get('to'));
    if (desde === 'invalido') return invalido('from');
    if (hasta === 'invalido') return invalido('to');
    const inicio = desde ?? new Date(AHORA.getTime() - 30 * MS_POR_DIA);
    if (hasta !== null && hasta <= inicio) return invalido('to');
    const p = paginacion(req, 'recorded_at desc');
    if ('status' in p) return p;
    const filtrados = CAMBIOS.filter((c) => {
      const cuando = new Date(c.recordedAt);
      return (
        cuando >= inicio &&
        (hasta === null || cuando < hasta) &&
        (targetType === null || c.targetType === targetType) &&
        (req.query.get('targetId') === null || c.targetId === req.query.get('targetId')) &&
        (req.query.get('changedBy') === null || c.changedByUserId === req.query.get('changedBy'))
      );
    });
    return {
      ...pagina(filtrados, p, 'recorded_at desc'),
      order: 'recorded_at desc, id desc',
    };
  });
}

/* ---- datos personales ---------------------------------------------------- */

interface ColumnaSintetica {
  readonly columnId: string;
  readonly objectId: string;
  readonly schemaName: string;
  readonly objectName: string;
  readonly columnName: string;
  readonly nativeType: string;
  readonly sensitivity: (typeof SENSITIVITIES)[number];
  readonly reviewStatus: (typeof REVIEW_STATUSES)[number];
  readonly origin: 'MANUAL' | 'AUTO_CLASSIFIER';
  readonly approved: boolean;
  readonly registryMarksPersonal: boolean | null;
}

let contador = 0;
const columna = (
  schemaName: string,
  objectName: string,
  columnName: string,
  sensitivity: ColumnaSintetica['sensitivity'],
  reviewStatus: ColumnaSintetica['reviewStatus'],
  registryMarksPersonal: boolean | null,
): ColumnaSintetica => {
  contador += 1;
  return {
    columnId: id(2000 + contador),
    objectId: id(3000 + contador),
    schemaName,
    objectName,
    columnName,
    nativeType: 'text',
    sensitivity,
    reviewStatus,
    origin: reviewStatus === 'AUTO_DETECTED' ? 'AUTO_CLASSIFIER' : 'MANUAL',
    approved: reviewStatus === 'APPROVED',
    registryMarksPersonal,
  };
};

const COLUMNAS: readonly ColumnaSintetica[] = [
  columna('sim_iam', 'people', 'documento', 'PHI_IDENTIFIER', 'APPROVED', true),
  columna('sim_iam', 'people', 'nombre', 'PERSONAL', 'APPROVED', true),
  columna('sim_iam', 'people', 'edad', 'PERSONAL', 'APPROVED', false),
  columna('sim_iam', 'people', 'correo', 'PERSONAL', 'AUTO_DETECTED', null),
  columna('sim_iam', 'people', 'telefono', 'PERSONAL', 'NEEDS_REVIEW', null),
  columna('sim_iam', 'credentials', 'secreto', 'CREDENTIAL', 'APPROVED', null),
  columna('sim_clinical', 'notes', 'diagnostico', 'PHI_SPECIAL', 'AUTO_DETECTED', null),
  columna('sim_clinical', 'notes', 'texto_libre', 'PHI_SENSITIVE', 'AUTO_DETECTED', null),
];

const rango = (nivel: string) => (SENSITIVITIES as readonly string[]).indexOf(nivel);
const nombre = (c: Pick<ColumnaSintetica, 'schemaName' | 'objectName' | 'columnName'>) =>
  `${c.schemaName}.${c.objectName}.${c.columnName}`;

/** Un campo que el registro declara y el último escaneo no observa. */
const HUERFANO = {
  schemaName: 'sim_clinical',
  objectName: 'patients',
  columnName: 'fecha_nacimiento',
  fieldRegistryId: id(4001),
  entityRegistryId: id(4002),
};

interface Discrepancia {
  kind: PiiReconciliationKind;
  schemaName: string;
  objectName: string;
  columnName: string;
  objectId: string | null;
  columnId: string | null;
  sensitivity: string | null;
  reviewStatus: string | null;
  entityRegistryId: string | null;
  fieldRegistryId: string | null;
}

function discrepancias(): Discrepancia[] {
  const filas: Discrepancia[] = COLUMNAS.flatMap((c): Discrepancia[] => {
    if (!c.approved || rango(c.sensitivity) < rango('PERSONAL')) return [];
    // Sin declarar en el registro: falta. Declarada sin marca PII/PHI: el registro discrepa.
    if (c.registryMarksPersonal === true) return [];
    const declarada = c.registryMarksPersonal === false;
    return [
      {
        kind: declarada ? 'REGISTRY_DISAGREES' : 'MISSING_IN_REGISTRY',
        schemaName: c.schemaName,
        objectName: c.objectName,
        columnName: c.columnName,
        objectId: c.objectId,
        columnId: c.columnId,
        sensitivity: c.sensitivity,
        reviewStatus: c.reviewStatus,
        entityRegistryId: declarada ? id(4003) : null,
        fieldRegistryId: declarada ? id(4004) : null,
      },
    ];
  });
  filas.push({
    kind: 'ORPHAN_IN_REGISTRY',
    schemaName: HUERFANO.schemaName,
    objectName: HUERFANO.objectName,
    columnName: HUERFANO.columnName,
    objectId: null,
    columnId: null,
    sensitivity: null,
    reviewStatus: null,
    entityRegistryId: HUERFANO.entityRegistryId,
    fieldRegistryId: HUERFANO.fieldRegistryId,
  });
  return filas.sort((a, b) => (`${nombre(a)}|${a.kind}` < `${nombre(b)}|${b.kind}` ? -1 : 1));
}

function registrarPersonales(router: MockRouter): void {
  router.get('/admin/catalog/pii/summary', () => {
    const personales = COLUMNAS.filter((c) => rango(c.sensitivity) >= rango('PERSONAL'));
    const niveles = [...new Set(personales.map((c) => c.sensitivity))].sort(
      (a, b) => rango(b) - rango(a),
    );
    return {
      source: 'catalog_annotations (SIMULADO)',
      // SIMULADO: el catálogo sintético tiene muchas más columnas que las que se listan.
      observedColumns: 912,
      classifiedColumns: 31,
      personalColumns: personales.length,
      objectsWithPersonalColumns: new Set(personales.map((c) => `${c.schemaName}.${c.objectName}`))
        .size,
      bySensitivity: niveles.map((sensitivity) => {
        const delNivel = personales.filter((c) => c.sensitivity === sensitivity);
        const cuenta = (estado: string) => delNivel.filter((c) => c.reviewStatus === estado).length;
        return {
          sensitivity,
          columns: delNivel.length,
          approved: cuenta('APPROVED'),
          needsReview: cuenta('NEEDS_REVIEW'),
          autoDetected: cuenta('AUTO_DETECTED'),
          other:
            delNivel.length - cuenta('APPROVED') - cuenta('NEEDS_REVIEW') - cuenta('AUTO_DETECTED'),
        };
      }),
      declaredRegistry: { entities: 2, entitiesPersonal: 1, fields: 3, fieldsPersonal: 2 },
      notMeasured: [
        {
          field: 'dataValues',
          reason:
            'El catálogo clasifica por nombre y tipo, no lee valores: una columna sin clasificar no está garantizada libre de datos personales.',
        },
      ],
    };
  });

  router.get('/admin/catalog/pii/columns', (req: MockRequest) => {
    const desconocida = claveDesconocida(req, CLAVES_COLUMNAS);
    if (desconocida) return invalido(desconocida);
    const esquema = req.query.get('schema');
    if (esquema !== null && !IDENTIFICADOR.test(esquema)) return invalido('schema');
    const minimo = req.query.get('minSensitivity') ?? 'PERSONAL';
    if (!(PII_MIN_SENSITIVITIES as readonly string[]).includes(minimo))
      return invalido('minSensitivity');
    const nivel = req.query.get('sensitivity');
    if (nivel !== null && !(SENSITIVITIES as readonly string[]).includes(nivel))
      return invalido('sensitivity');
    const revision = req.query.get('reviewStatus');
    if (revision !== null && !(REVIEW_STATUSES as readonly string[]).includes(revision))
      return invalido('reviewStatus');
    const q = req.query.get('q');
    if (q !== null && q.length > 120) return invalido('q');
    const sort = req.query.get('sort') ?? 'name';
    if (!(PII_SORTS as readonly string[]).includes(sort)) return invalido('sort');
    const p = paginacion(req, sort);
    if ('status' in p) return p;
    const filtradas = COLUMNAS.filter(
      (c) =>
        rango(c.sensitivity) >= rango(minimo) &&
        (esquema === null || c.schemaName === esquema) &&
        (nivel === null || c.sensitivity === nivel) &&
        (revision === null || c.reviewStatus === revision) &&
        coincide(q, nombre(c)),
    ).sort((a, b) =>
      sort === 'sensitivity' && a.sensitivity !== b.sensitivity
        ? rango(b.sensitivity) - rango(a.sensitivity)
        : nombre(a) < nombre(b)
          ? -1
          : 1,
    );
    return { ...pagina(filtradas, p, sort), sort };
  });

  router.get('/admin/catalog/pii/reconciliation', (req: MockRequest) => {
    const desconocida = claveDesconocida(req, CLAVES_CONCILIACION);
    if (desconocida) return invalido(desconocida);
    const clase = req.query.get('kind');
    if (clase !== null && !(PII_RECONCILIATION_KINDS as readonly string[]).includes(clase))
      return invalido('kind');
    const esquema = req.query.get('schema');
    if (esquema !== null && !IDENTIFICADOR.test(esquema)) return invalido('schema');
    const p = paginacion(req, 'conciliacion');
    if ('status' in p) return p;
    const delEsquema = discrepancias().filter((d) => esquema === null || d.schemaName === esquema);
    const byKind = Object.fromEntries(
      PII_RECONCILIATION_KINDS.map((k) => [k, delEsquema.filter((d) => d.kind === k).length]),
    );
    const filtradas = delEsquema.filter((d) => clase === null || d.kind === clase);
    return {
      summary: {
        approvedPersonalColumns: COLUMNAS.filter(
          (c) => c.approved && rango(c.sensitivity) >= rango('PERSONAL'),
        ).length,
        declaredFields: 3,
        registryEmpty: false,
        byKind,
        total: delEsquema.length,
      },
      ...pagina(filtradas, p, 'conciliacion'),
      order: 'schema_name, object_name, column_name, kind',
      notMeasured: [
        {
          field: 'unapprovedColumns',
          reason:
            'Sólo se concilian columnas con ficha aprobada y revisión vigente; las pendientes de revisión están en la pestaña Columnas.',
        },
      ],
    };
  });
}

export function registrarPoliticasGobierno(router: MockRouter): void {
  registrarPoliticas(router);
  registrarPersonales(router);
}
