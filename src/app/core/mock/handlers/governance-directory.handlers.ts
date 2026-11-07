import { validation, type MockRequest, type MockRouter } from '../mock-router';

/* ============================================================================
    SIMULATED directory of all app users (`GET /authz/directory-users`).

    PROVISIONAL CONTRACT defined by the front (session G); session E builds the
    real endpoint and a person must reconcile both. See
    docs/trabajo/2026-11-07-admin-portal/evidencia/g/CONTRATO-directorio-usuarios.md.

    Every record is synthetic. The response says `source: 'SIMULATED'` so the
    screen can say so. Like the real thing it carries no passwords, documents or
    phones, and the e-mail is masked on the "server" side.
    ========================================================================== */

type UserType = 'PATIENT' | 'DOCTOR' | 'PHARMACY' | 'LABORATORY' | 'INTERNAL';
type Status = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'BLOCKED';

export interface InternalDirectoryUser {
  readonly id: string;
  readonly displayName: string;
  readonly roles: readonly { code: string; name: string }[];
  readonly lastLoginAt: string | null;
}

interface DirectoryRow {
  readonly id: string;
  readonly type: UserType;
  readonly displayName: string;
  readonly maskedEmail: string | null;
  readonly status: Status;
  readonly lastLoginAt: string | null;
  readonly roles: readonly { code: string; name: string }[];
  readonly permissions: { allowed: number; denied: number; dangerous: number; resources: readonly string[] };
}

const TYPES: readonly UserType[] = ['PATIENT', 'DOCTOR', 'PHARMACY', 'LABORATORY', 'INTERNAL'];
const STATUSES: readonly Status[] = ['ACTIVE', 'PENDING', 'SUSPENDED', 'BLOCKED'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const DAY_MS = 86_400_000;

const GIVEN = ['Ana', 'Bruno', 'Camila', 'Diego', 'Elisa', 'Fabio', 'Gala', 'Hugo', 'Irma', 'Jorge'];
const FAMILY = ['Rojas', 'Mendoza', 'Salas', 'Vargas', 'Ibáñez', 'Cruz', 'Lara'];

const PER_TYPE: Record<Exclude<UserType, 'INTERNAL'>, {
  count: number;
  role: { code: string; name: string };
  permissions: DirectoryRow['permissions'];
  label: (i: number) => string;
}> = {
  PATIENT: {
    count: 18,
    role: { code: 'PATIENT', name: 'Paciente' },
    permissions: { allowed: 6, denied: 0, dangerous: 0, resources: ['own_record', 'appointments'] },
    label: (i) => `${GIVEN[i % 10]} ${FAMILY[i % 7]}`,
  },
  DOCTOR: {
    count: 9,
    role: { code: 'DOCTOR', name: 'Médico' },
    permissions: { allowed: 21, denied: 1, dangerous: 2, resources: ['clinical_record', 'prescriptions', 'scheduling'] },
    label: (i) => `Dr. ${GIVEN[(i + 3) % 10]} ${FAMILY[(i + 2) % 7]}`,
  },
  PHARMACY: {
    count: 5,
    role: { code: 'PHARMACY_STAFF', name: 'Farmacia' },
    permissions: { allowed: 9, denied: 0, dangerous: 1, resources: ['dispensing', 'inventory'] },
    label: (i) => `Farmacia ${FAMILY[(i + 4) % 7]}`,
  },
  LABORATORY: {
    count: 4,
    role: { code: 'LAB_STAFF', name: 'Laboratorio' },
    permissions: { allowed: 8, denied: 0, dangerous: 0, resources: ['lab_orders', 'results'] },
    label: (i) => `Laboratorio ${FAMILY[(i + 1) % 7]}`,
  },
};

const mask = (local: string, domain: string) => `${local.charAt(0)}***@${domain}`;

function buildRows(internal: readonly InternalDirectoryUser[]): readonly DirectoryRow[] {
  const rows: DirectoryRow[] = [];
  let n = 0;
  for (const type of Object.keys(PER_TYPE) as (keyof typeof PER_TYPE)[]) {
    const def = PER_TYPE[type];
    for (let i = 0; i < def.count; i += 1) {
      n += 1;
      const status = STATUSES[n % 9 === 0 ? 2 : n % 7 === 0 ? 1 : n % 11 === 0 ? 3 : 0]!;
      rows.push({
        id: `00000000-0000-4000-9200-${String(n).padStart(12, '0')}`,
        type,
        displayName: `${def.label(i)} (simulado)`,
        maskedEmail: n % 13 === 0 ? null : mask(def.label(i).replace(/[^a-z]/gi, '').toLowerCase(), 'ejemplo.test'),
        status,
        lastLoginAt: status === 'PENDING' ? null : new Date(Date.now() - (n % 30) * DAY_MS).toISOString(),
        roles: [def.role],
        permissions: def.permissions,
      });
    }
  }
  for (const user of internal) {
    rows.push({
      id: user.id,
      type: 'INTERNAL',
      displayName: user.displayName,
      maskedEmail: mask(user.displayName.split(' ')[0]!.toLowerCase(), 'alovida.test'),
      status: 'ACTIVE',
      lastLoginAt: user.lastLoginAt,
      roles: user.roles,
      permissions: { allowed: user.roles.length * 3, denied: user.roles.length > 1 ? 1 : 0, dangerous: user.roles.length, resources: ['audit', 'authz'] },
    });
  }
  return rows;
}

function pageOf(req: MockRequest, rows: readonly DirectoryRow[]) {
  const raw = req.query.get('limit');
  const limit = raw === null ? DEFAULT_LIMIT : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return validation('Error de validación', [{ field: 'limit', message: `must not be greater than ${MAX_LIMIT}` }]);
  }
  const start = Number(req.query.get('cursor') ?? '0') || 0;
  return {
    items: rows.slice(start, start + limit),
    nextCursor: start + limit < rows.length ? String(start + limit) : null,
    limit,
  };
}

/** Registers the simulated directory; `internal` are the console staff the rest of the simulator already has. */
export function registerGovernanceDirectory(router: MockRouter, internal: readonly InternalDirectoryUser[]): void {
  const all = buildRows(internal);
  router.get('/authz/directory-users', (req) => {
    const type = req.query.get('type');
    const status = req.query.get('status');
    if (type !== null && !TYPES.includes(type as UserType)) {
      return validation('Error de validación', [{ field: 'type', message: `must be one of the following values: ${TYPES.join(', ')}` }]);
    }
    if (status !== null && !STATUSES.includes(status as Status)) {
      return validation('Error de validación', [{ field: 'status', message: `must be one of the following values: ${STATUSES.join(', ')}` }]);
    }
    const text = req.query.get('q')?.trim().toLowerCase() ?? '';
    const roleCode = req.query.get('roleCode');
    const sameExceptType = all.filter(
      (u) =>
        (text === '' || u.displayName.toLowerCase().includes(text)) &&
        (status === null || u.status === status) &&
        (roleCode === null || u.roles.some((r) => r.code === roleCode)),
    );
    const rows = type === null ? sameExceptType : sameExceptType.filter((u) => u.type === type);
    const page = pageOf(req, rows);
    if (!('items' in page)) return page;
    return {
      ...page,
      typeCounts: Object.fromEntries(TYPES.map((t) => [t, sameExceptType.filter((u) => u.type === t).length])),
      unavailableTypes: [],
      source: 'SIMULATED',
    };
  });
}
