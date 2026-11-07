import {
  DIRECTORY_USER_TYPES,
  type DirectoryPermissionSummary,
  type DirectoryUser,
  type DirectoryUserType,
  type DirectoryUsersPage,
} from './authz-admin-directory.types';

/* Wire -> view mapping of `GET /authz/users/directory`. It is a WHITELIST: any
   extra field the server sends (a hash, a document number, a phone) is dropped
   here and can never reach a template, a log or a state snapshot. */

type Raw = Readonly<Record<string, unknown>>;

export interface DirectoryUsersBody {
  readonly items: readonly Raw[];
  readonly nextCursor?: string | null;
  readonly limit: number;
  readonly scope?: string | null;
  readonly source?: string | null;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
const asCount = (value: unknown): number => (typeof value === 'number' && value >= 0 ? value : 0);
const asList = (value: unknown): readonly Raw[] =>
  Array.isArray(value) ? value.filter((v): v is Raw => typeof v === 'object' && v !== null) : [];

/** A kind the front does not know (the API added one) falls into `OTHER`, never disappears. */
function typeOf(value: unknown): DirectoryUserType {
  return DIRECTORY_USER_TYPES.find((t) => t === value) ?? 'OTHER';
}

function permissionsOf(value: unknown): DirectoryPermissionSummary {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Raw;
  return {
    allowed: asCount(raw['allowed']),
    denied: asCount(raw['denied']),
    dangerous: asCount(raw['dangerous']),
    directGrants: asCount(raw['directGrants']),
  };
}

function toUser(raw: Raw): DirectoryUser | null {
  const id = asText(raw['id']);
  if (id === '') return null;
  const lastLogin = asText(raw['lastLoginAt']);
  return {
    id,
    displayName: asText(raw['displayName']),
    type: typeOf(raw['type']),
    statusConceptId: asText(raw['statusConceptId']),
    mfaStatusConceptId: asText(raw['mfaStatusConceptId']) || null,
    maskedEmail: asText(raw['maskedEmail']) || null,
    ...(lastLogin ? { lastLoginAt: new Date(lastLogin) } : {}),
    roles: asList(raw['roles']).map((r) => {
      const validTo = asText(r['validTo']);
      return {
        assignmentId: asText(r['assignmentId']),
        roleCode: asText(r['roleCode']),
        roleName: asText(r['roleName']),
        tenantId: asText(r['tenantId']) || null,
        ...(validTo ? { validTo: new Date(validTo) } : {}),
      };
    }),
    permissions: permissionsOf(raw['permissions']),
  };
}

export function toDirectoryUsersPage(body: DirectoryUsersBody): DirectoryUsersPage {
  return {
    items: body.items.map(toUser).filter((u): u is DirectoryUser => u !== null),
    nextCursor: body.nextCursor ?? null,
    limit: body.limit,
    scope: body.scope === 'PLATFORM' || body.scope === 'TENANT' ? body.scope : null,
    source: body.source === 'SIMULATED' ? 'SIMULATED' : null,
  };
}
