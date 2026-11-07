/* ============================================================================
    PROVISIONAL CONTRACT — directory of ALL app users (session G, 2026-11-07).

    `GET /authz/directory-users` does not exist in the API yet: session E builds
    the real endpoint in parallel and the two sessions cannot talk. This file is
    the shape the screen needs; a person must reconcile it with E's endpoint
    (see docs/trabajo/2026-11-07-admin-portal/evidencia/g/CONTRATO-directorio-usuarios.md).
    Until then the simulator answers it and marks the page `source: 'SIMULATED'`.

    Privacy is part of the contract, not of the screen:
      - NO passwords, hashes, tokens, documents, phone numbers or addresses;
      - the e-mail travels already masked (`maskedEmail`), the API masks it;
      - the client copies only the fields declared here and drops anything else.
    The API is the authority: the front lists and explains, it never authorizes.
    ========================================================================== */

import type { AdminPage, AdminPageQuery } from './authz-admin.types';

/** Kind of account. `INTERNAL` = staff who operate the admin console. */
export const DIRECTORY_USER_TYPES = ['PATIENT', 'DOCTOR', 'PHARMACY', 'LABORATORY', 'INTERNAL'] as const;
export type DirectoryUserType = (typeof DIRECTORY_USER_TYPES)[number];

/** Account state. `OTHER` absorbs any value the API adds later. */
export const DIRECTORY_USER_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'BLOCKED'] as const;
export type DirectoryUserStatus = (typeof DIRECTORY_USER_STATUSES)[number] | 'OTHER';

export interface DirectoryUsersQuery extends AdminPageQuery {
  /** Text to look for in the display name. */
  readonly q?: string;
  readonly type?: DirectoryUserType;
  readonly status?: (typeof DIRECTORY_USER_STATUSES)[number];
  /** Only people holding this role, in any scope. */
  readonly roleCode?: string;
}

export interface DirectoryRole {
  readonly code: string;
  readonly name: string;
}

/** What the person can do, summarised: counts and the areas they touch, never the full list. */
export interface DirectoryPermissionSummary {
  /** Permissions granted through roles (effect ALLOW). */
  readonly allowed: number;
  /** Permissions explicitly denied. */
  readonly denied: number;
  /** Of the allowed ones, how many are flagged dangerous. */
  readonly dangerous: number;
  /** Resource areas covered (`audit`, `scheduling`, …). */
  readonly resources: readonly string[];
}

export interface DirectoryUser {
  readonly id: string;
  readonly type: DirectoryUserType;
  readonly displayName: string;
  /** Already masked by the API, e.g. `l***@gmail.com`. `null` when the account has none. */
  readonly maskedEmail: string | null;
  readonly status: DirectoryUserStatus;
  readonly lastLoginAt?: Date;
  readonly roles: readonly DirectoryRole[];
  readonly permissions: DirectoryPermissionSummary;
}

/** Total per account kind, for the same `q`/`status`/`roleCode` filters but ignoring `type`. */
export type DirectoryTypeCounts = Readonly<Record<DirectoryUserType, number>>;

export interface DirectoryUsersPage extends AdminPage<DirectoryUser> {
  readonly typeCounts: DirectoryTypeCounts | null;
  /** Account kinds whose source could not be read: the page is PARTIAL (M34). */
  readonly unavailableTypes: readonly DirectoryUserType[];
  /** `'SIMULATED'` while the data comes from the front-end simulator. */
  readonly source: 'SIMULATED' | null;
}
