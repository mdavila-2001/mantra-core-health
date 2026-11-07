import { validation, type MockReply, type MockRequest, type MockRouter } from '../mock-router';

/* ============================================================================
    SIMULATED `GET /authz/users/directory`, shaped like the contract published
    in API PR #1409 (users-directory-query.dto / users-directory-response.dto).
    It is NOT the real endpoint: every record is synthetic and the page says
    `source: 'SIMULATED'` (a simulator-only marker the real API never sends).

    Mimicked rules: no free-text filter (an unknown query key is a 400, like the
    API's `forbidNonWhitelisted`), `status` is a uuid, `roleCode` is
    `^[A-Z0-9_]+$`, `limit` is 1..100 (default 50), opaque cursor, e-mail masked
    as `u***@e***.org` and `null` when the login is not an e-mail. No passwords,
    documents or phones. Contract notes: evidencia/g/CONTRATO-directorio-usuarios.md.
    ========================================================================== */

type UserType = 'PATIENT' | 'PRACTITIONER' | 'PHARMACY' | 'LABORATORY' | 'INTERNAL' | 'OTHER';

export interface InternalDirectoryUser {
  readonly id: string;
  readonly displayName: string;
  readonly roles: readonly { code: string; name: string }[];
  readonly lastLoginAt: string | null;
}

interface DirectoryRow {
  readonly id: string;
  readonly displayName: string;
  readonly type: UserType;
  readonly statusConceptId: string;
  readonly mfaStatusConceptId: string | null;
  readonly lastLoginAt: string | null;
  readonly maskedEmail: string | null;
  readonly roles: readonly { assignmentId: string; roleCode: string; roleName: string; tenantId: string | null; validTo: string | null }[];
  readonly permissions: { allowed: number; denied: number; dangerous: number; directGrants: number };
}

const TYPES: readonly UserType[] = ['PATIENT', 'PRACTITIONER', 'PHARMACY', 'LABORATORY', 'INTERNAL', 'OTHER'];
const KNOWN_KEYS = new Set(['type', 'status', 'roleCode', 'cursor', 'limit']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_ACTIVE = '00000000-0000-4000-8000-00000000c0f1';
const STATUS_SUSPENDED = '00000000-0000-4000-8000-00000000c0f2';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DAY_MS = 86_400_000;
const GIVEN = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elisa', 'Fabio', 'Gala', 'Hugo', 'Irma', 'Jorge'];
const FAMILY = ['Rojas', 'Mendoza', 'Salas', 'Vargas', 'Ibáñez', 'Cruz', 'Lara'];

const PER_TYPE: Record<Exclude<UserType, 'INTERNAL'>, {
  count: number;
  role: { code: string; name: string } | null;
  permissions: DirectoryRow['permissions'];
  label: (i: number) => string;
}> = {
  PATIENT: { count: 14, role: { code: 'PATIENT', name: 'Paciente' }, permissions: { allowed: 6, denied: 0, dangerous: 0, directGrants: 0 }, label: (i) => `${GIVEN[i % 10]} ${FAMILY[i % 7]}` },
  PRACTITIONER: { count: 9, role: { code: 'PRACTITIONER', name: 'Profesional de salud' }, permissions: { allowed: 21, denied: 1, dangerous: 2, directGrants: 1 }, label: (i) => `Dr. ${GIVEN[(i + 3) % 10]} ${FAMILY[(i + 2) % 7]}` },
  PHARMACY: { count: 5, role: { code: 'PHARMACY_STAFF', name: 'Farmacia' }, permissions: { allowed: 9, denied: 0, dangerous: 1, directGrants: 0 }, label: (i) => `Farmacia ${FAMILY[(i + 4) % 7]}` },
  LABORATORY: { count: 4, role: { code: 'LAB_STAFF', name: 'Laboratorio' }, permissions: { allowed: 8, denied: 0, dangerous: 0, directGrants: 0 }, label: (i) => `Laboratorio ${FAMILY[(i + 1) % 7]}` },
  OTHER: { count: 2, role: null, permissions: { allowed: 0, denied: 0, dangerous: 0, directGrants: 0 }, label: (i) => `Cuenta sin clasificar ${i + 1}` },
};

const mask = (local: string, domain: string) => `${local.charAt(0)}***@${domain.charAt(0)}***${domain.slice(domain.lastIndexOf('.'))}`;
const uuid = (series: number, n: number) => `00000000-0000-4000-${series}-${String(n).padStart(12, '0')}`;

function buildRows(internal: readonly InternalDirectoryUser[]): readonly DirectoryRow[] {
  const rows: DirectoryRow[] = [];
  let n = 0;
  for (const type of Object.keys(PER_TYPE) as (keyof typeof PER_TYPE)[]) {
    const def = PER_TYPE[type];
    for (let i = 0; i < def.count; i += 1) {
      n += 1;
      const name = def.label(i);
      rows.push({
        id: uuid(9200, n),
        displayName: `${name} (simulado)`,
        type,
        statusConceptId: n % 9 === 0 ? STATUS_SUSPENDED : STATUS_ACTIVE,
        mfaStatusConceptId: null,
        lastLoginAt: n % 7 === 0 ? null : new Date(Date.now() - (n % 30) * DAY_MS).toISOString(),
        // A login that is not an e-mail (national id) yields no mask: `null`, as the API.
        maskedEmail: n % 13 === 0 ? null : mask(name.replace(/[^a-z]/gi, '').toLowerCase(), 'ejemplo.test'),
        roles: def.role ? [{ assignmentId: uuid(9300, n), roleCode: def.role.code, roleName: def.role.name, tenantId: null, validTo: null }] : [],
        permissions: def.permissions,
      });
    }
  }
  for (const user of internal) {
    rows.push({
      id: user.id,
      displayName: user.displayName,
      type: 'INTERNAL',
      statusConceptId: STATUS_ACTIVE,
      mfaStatusConceptId: null,
      lastLoginAt: user.lastLoginAt,
      maskedEmail: mask(user.displayName.split(' ')[0]!.toLowerCase(), 'alovida.test'),
      roles: user.roles.map((r, i) => ({ assignmentId: uuid(9301, i), roleCode: r.code, roleName: r.name, tenantId: null, validTo: null })),
      permissions: { allowed: user.roles.length * 3, denied: user.roles.length > 1 ? 1 : 0, dangerous: user.roles.length, directGrants: 0 },
    });
  }
  // Same order as the API's keyset: display name, then id.
  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
}

function rejection(field: string, message: string): MockReply {
  return validation('Error de validación', [{ field, message }]);
}

function invalidQuery(req: MockRequest): MockReply | null {
  for (const key of req.query.keys()) {
    if (!KNOWN_KEYS.has(key)) return rejection(key, 'property should not exist');
  }
  const type = req.query.get('type');
  if (type !== null && !TYPES.includes(type as UserType)) return rejection('type', `must be one of the following values: ${TYPES.join(', ')}`);
  const status = req.query.get('status');
  if (status !== null && !UUID.test(status)) return rejection('status', 'must be a UUID');
  const roleCode = req.query.get('roleCode');
  if (roleCode !== null && !/^[A-Z0-9_]{1,64}$/.test(roleCode)) return rejection('roleCode', 'must match /^[A-Z0-9_]+$/ regular expression');
  const limit = req.query.get('limit');
  if (limit !== null && !(Number.isInteger(Number(limit)) && Number(limit) >= 1 && Number(limit) <= MAX_LIMIT)) {
    return rejection('limit', `must not be greater than ${MAX_LIMIT}`);
  }
  return null;
}

/** Registers the simulated directory; `internal` are the console staff the rest of the simulator already has. */
export function registerGovernanceDirectory(router: MockRouter, internal: readonly InternalDirectoryUser[]): void {
  const all = buildRows(internal);
  router.get('/authz/users/directory', (req) => {
    const invalid = invalidQuery(req);
    if (invalid) return invalid;
    const { type, status, roleCode } = Object.fromEntries(['type', 'status', 'roleCode'].map((k) => [k, req.query.get(k)]));
    const rows = all.filter(
      (u) =>
        (type === null || u.type === type) &&
        (status === null || u.statusConceptId === status) &&
        (roleCode === null || u.roles.some((r) => r.roleCode === roleCode)),
    );
    const limit = req.query.get('limit') === null ? DEFAULT_LIMIT : Number(req.query.get('limit'));
    const start = Number(req.query.get('cursor') ?? '0') || 0;
    return {
      items: rows.slice(start, start + limit),
      nextCursor: start + limit < rows.length ? String(start + limit) : null,
      limit,
      scope: 'PLATFORM',
      source: 'SIMULATED',
    };
  });
}
