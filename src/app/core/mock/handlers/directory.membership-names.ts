import { MOCK_USERS } from '../mock-session';
import { ROL_TENANT } from '../fixtures/directory-apoyo';
import { PROFESSIONALS } from '../fixtures/people';

/** Role code by concept id, the same mapping the API applies when listing memberships. */
const ROLE_CODE_BY_CONCEPT: Readonly<Record<string, string>> = {
  [ROL_TENANT.OWNER]: 'OWNER',
  [ROL_TENANT.ADMIN]: 'ADMIN',
  [ROL_TENANT.STAFF]: 'STAFF',
};

/** Adds what the real API sends beside the ids: the person's name and the role code. */
export function withMembershipNames<T extends { userId: string; tenantRoleConceptId: string }>(
  membership: T,
): T & { userName: string | null; tenantRoleCode: string | null } {
  const user = MOCK_USERS.find((u) => u.id === membership.userId);
  const professional = PROFESSIONALS.find((p) => p.userId === membership.userId);
  return {
    ...membership,
    userName: user?.displayName ?? professional?.displayName ?? null,
    tenantRoleCode: ROLE_CODE_BY_CONCEPT[membership.tenantRoleConceptId] ?? null,
  };
}
