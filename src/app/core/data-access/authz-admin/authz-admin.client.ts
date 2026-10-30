import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { queryParams, withDates, type Wire } from '../admin-portal/admin-portal.wire';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  AdminPage,
  AssignableRole,
  CreatedAssignment,
  InternalUser,
  InternalUserAssignment,
  InternalUsersQuery,
  PermissionSummary,
  PermissionsQuery,
  RevokedAssignment,
  RoleAssignment,
  RoleAssignmentInput,
  RolePermissions,
  UserRoleAssignments,
} from './authz-admin.types';

const ASSIGNMENT_DATES = ['validFrom', 'validTo'] as const;

type AssignmentBody = Wire<RoleAssignment, 'validFrom' | 'validTo' | 'createdAt'>;
type InternalUserBody = Omit<Wire<InternalUser, 'lastLoginAt'>, 'assignments'> & {
  readonly assignments: readonly Wire<InternalUserAssignment, 'validTo'>[];
};

function toAssignment(body: AssignmentBody): RoleAssignment {
  return withDates<RoleAssignment, 'validFrom' | 'validTo' | 'createdAt'>(body, [
    ...ASSIGNMENT_DATES,
    'createdAt',
  ]);
}

function toInternalUser(body: InternalUserBody): InternalUser {
  const user = withDates<Omit<InternalUser, 'assignments'>, 'lastLoginAt'>(body, ['lastLoginAt']);
  return {
    ...user,
    assignments: body.assignments.map((a) =>
      withDates<InternalUserAssignment, 'validTo'>(a, ['validTo']),
    ),
  };
}

/**
 * El motivo estable de un rechazo de la API (`reason`), o `null`.
 *
 * El filtro de errores de la API lo manda en la raíz del cuerpo; algunos
 * rechazos de guardas lo mandan dentro de `details`. Se leen los dos lugares,
 * en ese orden. Nunca se ramifica por `message`, que es texto para personas.
 */
export function rejectionReason(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  if (typeof record['reason'] === 'string') return record['reason'];
  const details = record['details'];
  if (typeof details === 'object' && details !== null) {
    const nested = (details as Record<string, unknown>)['reason'];
    if (typeof nested === 'string') return nested;
  }
  return null;
}

/**
 * Cliente de la administración de acceso: usuarios internos, asignaciones de
 * rol (alta y revocación), permisos y permisos por rol. Todo lo decide la API.
 */
@Injectable({ providedIn: 'root' })
export class AuthzAdminClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Quienes tienen un rol de plataforma o uno de ámbito global; con `roleCode`, quienes tienen ese rol. */
  internalUsers(query: InternalUsersQuery = {}): Observable<AdminPage<InternalUser>> {
    return this.http
      .get<AdminPage<InternalUserBody>>(this.url('/authz/internal-users'), {
        params: queryParams({ ...query }),
      })
      .pipe(map((page) => ({ ...page, items: page.items.map(toInternalUser) })));
  }

  /** Todas las asignaciones de un usuario, activas o no. */
  assignmentsOf(userId: string): Observable<UserRoleAssignments> {
    return this.http
      .get<{ readonly userId: string; readonly items: readonly AssignmentBody[] }>(
        this.url(`/authz/users/${encodeURIComponent(userId)}/role-assignments`),
      )
      .pipe(map((body) => ({ userId: body.userId, items: body.items.map(toAssignment) })));
  }

  /** Asigna un rol. Un rol global con organización vuelve 422 con su `reason`. */
  assignRole(userId: string, input: RoleAssignmentInput): Observable<CreatedAssignment> {
    return this.http.post<CreatedAssignment>(
      this.url(`/authz/users/${encodeURIComponent(userId)}/role-assignments`),
      input,
    );
  }

  /** Revocación lógica: la fila queda como historia. */
  revoke(userId: string, assignmentId: string): Observable<RevokedAssignment> {
    return this.http.delete<RevokedAssignment>(
      this.url(
        `/authz/users/${encodeURIComponent(userId)}/role-assignments/${encodeURIComponent(assignmentId)}`,
      ),
    );
  }

  /**
   * El nombre visible de una persona (`GET /iam/users/:id`, también de
   * `SECURITY_ADMIN`). Hace falta para quien no está en la lista de usuarios
   * internos —todavía sin roles— y se abre por su dirección.
   */
  displayNameOf(userId: string): Observable<string> {
    return this.http
      .get<{ readonly displayName: string }>(this.url(`/iam/users/${encodeURIComponent(userId)}`))
      .pipe(map((body) => body.displayName));
  }

  /** Los roles que se pueden asignar. */
  assignableRoles(): Observable<readonly AssignableRole[]> {
    return this.http.get<readonly AssignableRole[]>(this.url('/authz/roles'));
  }

  /** El catálogo de permisos, paginado por código. */
  permissions(query: PermissionsQuery = {}): Observable<AdminPage<PermissionSummary>> {
    return this.http.get<AdminPage<PermissionSummary>>(this.url('/authz/permissions'), {
      params: queryParams({ ...query }),
    });
  }

  /** Los permisos activos de un rol, con su efecto y ámbito. */
  rolePermissions(roleId: string): Observable<RolePermissions> {
    return this.http.get<RolePermissions>(
      this.url(`/authz/roles/${encodeURIComponent(roleId)}/permissions`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
