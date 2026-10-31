import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { queryParams, withDates, type Wire } from '../admin-portal/admin-portal.wire';
import { API_BASE_URL, apiUrl } from '../api';
import type { AdminPage } from '../authz-admin/authz-admin.types';
import type {
  AccessReview,
  AccessReviewDue,
  AccessReviewDuePage,
  DecisionRequest,
  DecisionResult,
  EndedResourceScopeGrant,
  FieldPermissionInput,
  LifecycleAction,
  LifecycleEvent,
  LifecycleResult,
  RecordAccessReviewInput,
  ResourceScopeGrant,
  ResourceScopeGrantInput,
  ResourceScopeGrantsQuery,
  RoleFieldPermissions,
  RoleSaved,
  SetRolePermissionsInput,
  UserAccessReviews,
  UserLifecycle,
} from './authz-governance.types';

type GrantBody = Wire<ResourceScopeGrant, 'validFrom' | 'validTo' | 'createdAt'>;
type EventBody = Wire<LifecycleEvent, 'recordedAt'>;
type ReviewBody = Wire<AccessReview, 'reviewedAt'>;
type DueBody = Wire<AccessReviewDue, 'lastReviewedAt'>;

const toGrant = (b: GrantBody): ResourceScopeGrant =>
  withDates<ResourceScopeGrant, 'validFrom' | 'validTo' | 'createdAt'>(b, ['validFrom', 'validTo', 'createdAt']);
const toEvent = (b: EventBody): LifecycleEvent => withDates<LifecycleEvent, 'recordedAt'>(b, ['recordedAt']);
const toReview = (b: ReviewBody): AccessReview => withDates<AccessReview, 'reviewedAt'>(b, ['reviewedAt']);
const toDue = (b: DueBody): AccessReviewDue => withDates<AccessReviewDue, 'lastReviewedAt'>(b, ['lastReviewedAt']);

/**
 * Cliente del gobierno de acceso: edición de permisos, permisos por campo y por
 * alcance de recurso, simulación del PDP, ciclo de vida de cuentas internas y
 * revisión de accesos. Las lecturas de roles, permisos y asignaciones siguen en
 * `AuthzAdminClient`; aquí sólo lo que ese cliente no tenía.
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

  /** `DELETE /authz/resource-scope-grants/:id` — termina la vigencia; 409 si ya había terminado. */
  endResourceScopeGrant(grantId: string): Observable<EndedResourceScopeGrant> {
    return this.http
      .delete<Wire<EndedResourceScopeGrant, 'validTo'> & { readonly validTo: string }>(
        this.url(`/authz/resource-scope-grants/${encodeURIComponent(grantId)}`),
      )
      .pipe(map((b) => ({ id: b.id, validTo: new Date(b.validTo) })));
  }

  /* ---- PDP ---------------------------------------------------------------- */

  /** `POST /authz/decisions/evaluate` — la decisión efectiva del PDP real (queda auditada). */
  evaluate(request: DecisionRequest): Observable<DecisionResult> {
    return this.http.post<DecisionResult>(this.url('/authz/decisions/evaluate'), request);
  }

  /* ---- ciclo de vida ------------------------------------------------------ */

  /** `GET /authz/users/:id/lifecycle`. */
  lifecycleOf(userId: string): Observable<UserLifecycle> {
    return this.http
      .get<Omit<UserLifecycle, 'history'> & { readonly history: readonly EventBody[] }>(
        this.url(`/authz/users/${encodeURIComponent(userId)}/lifecycle`),
      )
      .pipe(map((b) => ({ ...b, history: b.history.map(toEvent) })));
  }

  /** Suspender, reactivar o dar de baja, siempre con motivo. 409/422 traen su `reason`. */
  lifecycleAction(userId: string, action: LifecycleAction, reason: string): Observable<LifecycleResult> {
    return this.http.post<LifecycleResult>(
      this.url(`/authz/users/${encodeURIComponent(userId)}/lifecycle/${action}`),
      { reason },
    );
  }

  /* ---- revisión de accesos ------------------------------------------------ */

  /** `GET /authz/access-reviews/due` — con `olderThanDays`, sólo lo no revisado en ese plazo. */
  accessReviewsDue(olderThanDays?: number): Observable<AccessReviewDuePage> {
    return this.http
      .get<Omit<AccessReviewDuePage, 'items'> & { readonly items: readonly DueBody[] }>(
        this.url('/authz/access-reviews/due'),
        { params: queryParams({ olderThanDays }) },
      )
      .pipe(map((b) => ({ ...b, items: b.items.map(toDue) })));
  }

  /** `GET /authz/users/:id/access-reviews` — el historial de revisiones. */
  accessReviewsOf(userId: string): Observable<UserAccessReviews> {
    return this.http
      .get<Omit<UserAccessReviews, 'items'> & { readonly items: readonly ReviewBody[] }>(
        this.url(`/authz/users/${encodeURIComponent(userId)}/access-reviews`),
      )
      .pipe(map((b) => ({ ...b, items: b.items.map(toReview) })));
  }

  /** `POST /authz/users/:id/access-reviews`. */
  recordAccessReview(userId: string, input: RecordAccessReviewInput): Observable<AccessReview> {
    return this.http
      .post<ReviewBody>(this.url(`/authz/users/${encodeURIComponent(userId)}/access-reviews`), input)
      .pipe(map(toReview));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
