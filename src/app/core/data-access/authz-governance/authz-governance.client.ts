import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { queryParams, withDates, type Wire } from '../admin-portal/admin-portal.wire';
import { API_BASE_URL, apiUrl } from '../api';
import type { AdminPage } from '../authz-admin/authz-admin.types';
import type {
  AccessMap,
  AccessMapAssignment,
  AccessReview,
  AccessReviewDue,
  AccessReviewDuePage,
  AccessReviewDueQuery,
  AccessReviewsQuery,
  DecisionRequest,
  EndedResourceScopeGrant,
  FieldPermissionInput,
  HoldersQuery,
  LifecycleAction,
  LifecycleEvent,
  LifecycleResult,
  PermissionHoldersPage,
  ResourceScopeGrant,
  ResourceScopeGrantInput,
  ResourceScopeGrantsQuery,
  RoleFieldPermissions,
  RoleSaved,
  SetRolePermissionsInput,
  SimulationResult,
  UserLifecycle,
  UserLifecycleQuery,
} from './authz-governance.types';

type GrantBody = Wire<ResourceScopeGrant, 'validFrom' | 'validTo' | 'createdAt'>;
type EventBody = Wire<LifecycleEvent, 'recordedAt'>;
type ReviewBody = Wire<AccessReview, 'reviewedAt'>;
type DueBody = Wire<AccessReviewDue, 'lastReviewedAt'>;
type MapAssignmentBody = Wire<AccessMapAssignment, 'validFrom' | 'validTo'>;

const toGrant = (b: GrantBody): ResourceScopeGrant =>
  withDates<ResourceScopeGrant, 'validFrom' | 'validTo' | 'createdAt'>(b, ['validFrom', 'validTo', 'createdAt']);
const toEvent = (b: EventBody): LifecycleEvent => withDates<LifecycleEvent, 'recordedAt'>(b, ['recordedAt']);
const toReview = (b: ReviewBody): AccessReview => withDates<AccessReview, 'reviewedAt'>(b, ['reviewedAt']);
const toMapAssignment = (b: MapAssignmentBody): AccessMapAssignment =>
  withDates<AccessMapAssignment, 'validFrom' | 'validTo'>(b, ['validFrom', 'validTo']);
const toDue = (b: DueBody): AccessReviewDue => withDates<AccessReviewDue, 'lastReviewedAt'>(b, ['lastReviewedAt']);

/**
 * Cliente del gobierno de acceso: edición de permisos, permisos por campo y por
 * alcance de recurso, «quién puede qué», simulación del PDP, ciclo de vida de
 * cuentas internas y revisión de accesos. Las lecturas de roles, permisos y
 * asignaciones siguen en `AuthzAdminClient`; aquí sólo lo que ese cliente no
 * tenía.
 *
 * El ciclo de vida es de `iam` (`/iam/users/:id/...`); lo demás, de `authz`.
 * Todo lo que mira usuarios de TODA la plataforma (ciclo de vida, «quién puede
 * qué», revisiones, simulador) lo exige la API a un administrador de plataforma:
 * quien tiene alcance de una organización recibe 403 `ROLE_INSUFFICIENT`.
 */
@Injectable({ providedIn: 'root' })
export class AuthzGovernanceClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---- permisos por acción ---------------------------------------------- */

  /** `PUT /authz/roles/:id/permissions` — reemplaza los permisos activos del rol (queda auditado). */
  setRolePermissions(roleId: string, input: SetRolePermissionsInput): Observable<RoleSaved> {
    return this.http.put<RoleSaved>(this.url(`/authz/roles/${encodeURIComponent(roleId)}/permissions`), input);
  }

  /* ---- permisos por campo ----------------------------------------------- */

  /** `GET /authz/roles/:id/field-permissions`. */
  roleFieldPermissions(roleId: string): Observable<RoleFieldPermissions> {
    return this.http.get<RoleFieldPermissions>(
      this.url(`/authz/roles/${encodeURIComponent(roleId)}/field-permissions`),
    );
  }

  /** `PUT /authz/roles/:id/field-permissions` — upsert de reglas por (entidad, columna). */
  setFieldPermissions(roleId: string, fields: readonly FieldPermissionInput[]): Observable<{ readonly ok: boolean }> {
    return this.http.put<{ readonly ok: boolean }>(
      this.url(`/authz/roles/${encodeURIComponent(roleId)}/field-permissions`),
      { fields },
    );
  }

  /* ---- alcance de recurso ----------------------------------------------- */

  /** `GET /authz/resource-scope-grants`. */
  resourceScopeGrants(query: ResourceScopeGrantsQuery = {}): Observable<AdminPage<ResourceScopeGrant>> {
    return this.http
      .get<AdminPage<GrantBody>>(this.url('/authz/resource-scope-grants'), { params: queryParams({ ...query }) })
      .pipe(map((page) => ({ ...page, items: page.items.map(toGrant) })));
  }

  /** `POST /authz/resource-scope-grants`. */
  createResourceScopeGrant(input: ResourceScopeGrantInput): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(this.url('/authz/resource-scope-grants'), input);
  }

  /**
   * `DELETE /authz/resource-scope-grants/:id` — termina la vigencia (no borra la fila); 409 si ya había
   * terminado. Un permiso de efecto DENY exige `reason` (422 `RESOURCE_SCOPE_GRANT_DENY_REASON_REQUIRED`):
   * levantar una denegación abre un acceso.
   */
  endResourceScopeGrant(grantId: string, reason?: string): Observable<EndedResourceScopeGrant> {
    return this.http
      .request<Wire<EndedResourceScopeGrant, 'validTo'> & { readonly validTo: string }>(
        'DELETE',
        this.url(`/authz/resource-scope-grants/${encodeURIComponent(grantId)}`),
        { body: reason === undefined || reason.trim() === '' ? {} : { reason: reason.trim() } },
      )
      .pipe(map((b) => ({ id: b.id, validTo: new Date(b.validTo) })));
  }

  /* ---- PDP ---------------------------------------------------------------- */

  /**
   * `POST /authz/simulations` — la decisión del PDP real para una solicitud hipotética. Nada se concede ni
   * se cambia; queda en la bitácora (`ACCESS_DECISION_SIMULATED`).
   */
  simulate(request: DecisionRequest): Observable<SimulationResult> {
    return this.http.post<SimulationResult>(this.url('/authz/simulations'), request);
  }

  /* ---- «quién puede qué» -------------------------------------------------- */

  /** `GET /authz/users/:id/access-map` — roles, conteos de concesiones y última revisión. */
  accessMap(userId: string): Observable<AccessMap> {
    return this.http
      .get<
        Omit<AccessMap, 'lastReview' | 'assignments'> & {
          readonly lastReview: ReviewBody | null;
          readonly assignments: readonly MapAssignmentBody[];
        }
      >(this.url(`/authz/users/${encodeURIComponent(userId)}/access-map`))
      .pipe(
        map((b) => ({
          ...b,
          assignments: b.assignments.map(toMapAssignment),
          lastReview: b.lastReview ? toReview(b.lastReview) : null,
        })),
      );
  }

  /** `GET /authz/permissions/:id/holders` — quiénes tienen un permiso y por qué camino; una fila por persona. */
  permissionHolders(permissionId: string, query: HoldersQuery = {}): Observable<PermissionHoldersPage> {
    return this.http.get<PermissionHoldersPage>(
      this.url(`/authz/permissions/${encodeURIComponent(permissionId)}/holders`),
      { params: queryParams({ ...query }) },
    );
  }

  /* ---- ciclo de vida (iam) ------------------------------------------------ */

  /** `GET /iam/users/:id/lifecycle` — estado de la cuenta e historia paginada, de la más reciente a la más antigua. */
  lifecycleOf(userId: string, query: UserLifecycleQuery = {}): Observable<UserLifecycle> {
    return this.http
      .get<Omit<UserLifecycle, 'items'> & { readonly items: readonly EventBody[] }>(
        this.url(`/iam/users/${encodeURIComponent(userId)}/lifecycle`),
        { params: queryParams({ ...query }) },
      )
      .pipe(map((b) => ({ ...b, items: b.items.map(toEvent) })));
  }

  /**
   * `POST /iam/users/:id/{suspend,reactivate,deactivate}` — siempre con motivo. Idempotente: repetir sobre una
   * cuenta que ya está en ese estado responde 200 con `changed: false`. 409 `USER_LIFECYCLE_TRANSITION_INVALID`,
   * 422 `USER_SELF_LIFECYCLE_FORBIDDEN` / `USER_LAST_SECURITY_ADMIN`.
   */
  lifecycleAction(userId: string, action: LifecycleAction, reason: string): Observable<LifecycleResult> {
    return this.http.post<LifecycleResult>(this.url(`/iam/users/${encodeURIComponent(userId)}/${action}`), { reason });
  }

  /* ---- revisión de accesos ------------------------------------------------ */

  /** `GET /authz/access-reviews/due` — cuentas con acceso administrativo sin revisión en `olderThanDays` (90 por defecto). */
  accessReviewsDue(query: AccessReviewDueQuery = {}): Observable<AccessReviewDuePage> {
    return this.http
      .get<Omit<AccessReviewDuePage, 'items'> & { readonly items: readonly DueBody[] }>(
        this.url('/authz/access-reviews/due'),
        { params: queryParams({ ...query }) },
      )
      .pipe(map((b) => ({ ...b, items: b.items.map(toDue) })));
  }

  /** `GET /authz/access-reviews` — la historia de revisiones, filtrable por cuenta revisada y por revisor. */
  accessReviews(query: AccessReviewsQuery = {}): Observable<AdminPage<AccessReview>> {
    return this.http
      .get<AdminPage<ReviewBody>>(this.url('/authz/access-reviews'), { params: queryParams({ ...query }) })
      .pipe(map((page) => ({ ...page, items: page.items.map(toReview) })));
  }

  /**
   * `POST /authz/users/:id/access-reviews` — registra que revisaste los accesos de la cuenta. No lleva cuerpo y
   * no cambia ningún permiso. 422 `ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN` si es la propia cuenta.
   */
  recordAccessReview(userId: string): Observable<AccessReview> {
    return this.http
      .post<ReviewBody>(this.url(`/authz/users/${encodeURIComponent(userId)}/access-reviews`), {})
      .pipe(map(toReview));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
