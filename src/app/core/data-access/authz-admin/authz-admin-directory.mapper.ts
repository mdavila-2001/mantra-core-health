import {
  DIRECTORY_USER_STATUSES,
  DIRECTORY_USER_TYPES,
  type DirectoryPermissionSummary,
  type DirectoryTypeCounts,
  type DirectoryUser,
  type DirectoryUserStatus,
  type DirectoryUserType,
  type DirectoryUsersPage,
} from './authz-admin-directory.types';

/* Wire -> view mapping of the provisional directory contract. It is a WHITELIST:
   any extra field the server sends (a hash, a document number, a phone) is
   dropped here and can never reach a template, a log or a state snapshot. */

type Raw = Readonly<Record<string, unknown>>;

export interface DirectoryUsersBody {
  readonly items: readonly Raw[];
  readonly nextCursor?: string | null;
  readonly limit: number;
  readonly typeCounts?: Raw | null;
  readonly unavailableTypes?: readonly string[] | null;
  readonly source?: string | null;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
const asCount = (value: unknown): number => (typeof value === 'number' && value >= 0 ? value : 0);
const asList = (value: unknown): readonly Raw[] =>
  Array.isArray(value) ? value.filter((v): v is Raw => typeof v === 'object' && v !== null) : [];

function typeOf(value: unknown): DirectoryUserType | null {
  return DIRECTORY_USER_TYPES.find((t) => t === value) ?? null;
}

function statusOf(value: unknown): DirectoryUserStatus {
  return DIRECTORY_USER_STATUSES.find((s) => s === value) ?? 'OTHER';
}

function permissionsOf(value: unknown): DirectoryPermissionSummary {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Raw;
  return {
    allowed: asCount(raw['allowed']),
    denied: asCount(raw['denied']),
    dangerous: asCount(raw['dangerous']),
    resources: Array.isArray(raw['resources']) ? raw['resources'].filter((r): r is string => typeof r === 'string') : [],
  };
}

function toUser(raw: Raw): DirectoryUser | null {
  const type = typeOf(raw['type']);
  const id = asText(raw['id']);
  if (type === null || id === '') return null;
  const lastLogin = asText(raw['lastLoginAt']);
  return {
    id,
    type,
    displayName: asText(raw['displayName']),
    maskedEmail: asText(raw['maskedEmail']) || null,
    status: statusOf(raw['status']),
    ...(lastLogin ? { lastLoginAt: new Date(lastLogin) } : {}),
    roles: asList(raw['roles']).map((r) => ({ code: asText(r['code']), name: asText(r['name']) })),
    permissions: permissionsOf(raw['permissions']),
  };
}

function countsOf(raw: Raw | null | undefined): DirectoryTypeCounts | null {
  if (!raw) return null;
  return Object.fromEntries(DIRECTORY_USER_TYPES.map((t) => [t, asCount(raw[t])])) as DirectoryTypeCounts;
}

export function toDirectoryUsersPage(body: DirectoryUsersBody): DirectoryUsersPage {
  return {
    items: body.items.map(toUser).filter((u): u is DirectoryUser => u !== null),
    nextCursor: body.nextCursor ?? null,
    limit: body.limit,
    typeCounts: countsOf(body.typeCounts),
    unavailableTypes: (body.unavailableTypes ?? []).map(typeOf).filter((t): t is DirectoryUserType => t !== null),
    source: body.source === 'SIMULATED' ? 'SIMULATED' : null,
  };
}
