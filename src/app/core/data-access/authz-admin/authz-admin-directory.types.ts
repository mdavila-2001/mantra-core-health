/* ============================================================================
    Directory of ALL app users: `GET /authz/users/directory` (API PR #1409,
    module `authz`, role `SECURITY_ADMIN`; only a platform `SUPERADMIN` crosses
    organizations, anyone else is held to the resolved one or gets 403).

    These types mirror the DTOs published in that PR (users-directory-query.dto,
    users-directory-response.dto). Not yet verified against a running API.

    Privacy is part of the contract: no passwords, documents or full e-mail
    (`maskedEmail` is already masked and is `null` unless the login is an
    e-mail). The client copies only the fields declared here. The API is the
    authority: the front lists and explains, it never authorizes.
    ========================================================================== */

import type { AdminPage, AdminPageQuery } from './authz-admin.types';

/** Account kind, as the API classifies it. `OTHER` = no rule matched. */
export const DIRECTORY_USER_TYPES = ['PATIENT', 'PRACTITIONER', 'PHARMACY', 'LABORATORY', 'INTERNAL', 'OTHER'] as const;
export type DirectoryUserType = (typeof DIRECTORY_USER_TYPES)[number];

/**
 * There is deliberately NO free-text filter: a name in the URL would land in
 * access logs. `status` is the uuid of an `iam.users.status_concept_id` concept.
 */
export interface DirectoryUsersQuery extends AdminPageQuery {
  readonly type?: DirectoryUserType;
  readonly status?: string;
  /** Upper-case code (`^[A-Z0-9_]+$`), max 64. */
  readonly roleCode?: string;
}

/** An active role assignment (`validTo` absent = no end date). */
export interface DirectoryRole {
  readonly assignmentId: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly tenantId: string | null;
  readonly validTo?: Date;
}

/** Effective permissions, deny wins. Counts only; the detail is not in this endpoint. */
export interface DirectoryPermissionSummary {
  readonly allowed: number;
  readonly denied: number;
  /** Of the allowed ones, how many are flagged dangerous. */
  readonly dangerous: number;
  /** Active direct grants outside any role. */
  readonly directGrants: number;
}

export interface DirectoryUser {
  readonly id: string;
  readonly displayName: string;
  readonly type: DirectoryUserType;
  /** Concept id: the front has no value set to translate it yet. */
  readonly statusConceptId: string;
  readonly mfaStatusConceptId: string | null;
  readonly lastLoginAt?: Date;
  /** Masked by the API (`u***@e***.org`); `null` when the login is not an e-mail. */
  readonly maskedEmail: string | null;
  readonly roles: readonly DirectoryRole[];
  readonly permissions: DirectoryPermissionSummary;
}

export interface DirectoryUsersPage extends AdminPage<DirectoryUser> {
  /** Scope the caller was held to; `null` if the API did not say. */
  readonly scope: 'PLATFORM' | 'TENANT' | null;
  /** `'SIMULATED'` only from the front-end simulator; the real API never sends it. */
  readonly source: 'SIMULATED' | null;
}
