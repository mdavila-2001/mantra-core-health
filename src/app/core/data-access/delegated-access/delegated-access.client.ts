import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccessRequestDecisionResult,
  AccessRequestResolution,
  ActorEvaluation,
  ActorEvaluationResult,
  CreatedResource,
  DelegationRevocation,
  ExpirySweepResult,
  NewAccessRequest,
  NewGrant,
  NewOrgUserAssignment,
  NewPermissionSet,
  NewPractitionerDelegate,
  NewSetVersion,
  OperationResult,
  OrgUserAssignmentUpdate,
  PermissionSetVersion,
} from './delegated-access.types';

interface CreatedResourceBody {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
}

function toCreatedResource(body: CreatedResourceBody): CreatedResource {
  return { id: body.id, status: body.status, createdAt: new Date(body.createdAt) };
}

/**
 * Cliente de `delegated_access` (M29): delegación de acceso con alcance.
 *
 * El módulo es **solo de comando**: 10 POST y 1 PATCH, ningún GET. Desde acá
 * se muta el estado de la delegación pero no se lo puede leer; los listados
 * quedan a la espera de sus endpoints de consulta.
 *
 * Los cuerpos viajan tal como los declaran los tipos: el backend valida con
 * `forbidNonWhitelisted`, así que una propiedad de más es un 400. Los campos
 * opcionales ausentes se omiten (la serialización descarta `undefined`).
 */
@Injectable({
  providedIn: 'root',
})
export class DelegatedAccessClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /org/:tenantMembershipId/user-assignments` — asignación con alcance. */
  createOrgUserAssignment(
    tenantMembershipId: string,
    assignment: NewOrgUserAssignment,
  ): Observable<CreatedResource> {
    return this.http
      .post<CreatedResourceBody>(
        this.url(`/org/${tenantMembershipId}/user-assignments`),
        assignment,
      )
      .pipe(map(toCreatedResource));
  }

  /** `PATCH /org/user-assignments/:id` — reasignar supervisor o suspender. */
  updateOrgUserAssignment(
    assignmentId: string,
    update: OrgUserAssignmentUpdate,
  ): Observable<OperationResult> {
    return this.http.patch<OperationResult>(
      this.url(`/org/user-assignments/${assignmentId}`),
      update,
    );
  }

  /** `POST /practitioner-delegates` — crear la delegación de un practitioner. */
  createPractitionerDelegate(delegate: NewPractitionerDelegate): Observable<CreatedResource> {
    return this.http
      .post<CreatedResourceBody>(this.url('/practitioner-delegates'), delegate)
      .pipe(map(toCreatedResource));
  }

  /** `POST /practitioner-delegates/:id/access-requests` — pedir acceso delegado. */
  requestDelegatedAccess(
    delegationId: string,
    request: NewAccessRequest,
  ): Observable<CreatedResource> {
    return this.http
      .post<CreatedResourceBody>(
        this.url(`/practitioner-delegates/${delegationId}/access-requests`),
        request,
      )
      .pipe(map(toCreatedResource));
  }

  /** `POST /practitioner-delegates/:id/grants` — grant temporal por propósito. */
  issueGrant(delegationId: string, grant: NewGrant): Observable<CreatedResource> {
    return this.http
      .post<CreatedResourceBody>(this.url(`/practitioner-delegates/${delegationId}/grants`), grant)
      .pipe(map(toCreatedResource));
  }

  /** `POST /practitioner-delegates/:id/revoke` — revocación inmediata, en cascada. */
  revokeDelegation(
    delegationId: string,
    revocation: DelegationRevocation,
  ): Observable<OperationResult> {
    return this.http.post<OperationResult>(
      this.url(`/practitioner-delegates/${delegationId}/revoke`),
      revocation,
    );
  }

  /** `POST /access-requests/:id/decision` — aprobar o denegar una solicitud. */
  resolveAccessRequest(
    requestId: string,
    resolution: AccessRequestResolution,
  ): Observable<AccessRequestDecisionResult> {
    return this.http.post<AccessRequestDecisionResult>(
      this.url(`/access-requests/${requestId}/decision`),
      resolution,
    );
  }

  /** `POST /authz/effective-actor/evaluate` — qué puede hacer un delegado. */
  evaluateEffectiveActor(evaluation: ActorEvaluation): Observable<ActorEvaluationResult> {
    return this.http.post<ActorEvaluationResult>(
      this.url('/authz/effective-actor/evaluate'),
      evaluation,
    );
  }

  /** `POST /delegated-access/expiry-sweep` — expirar lo vencido. Sin cuerpo. */
  runExpirySweep(): Observable<ExpirySweepResult> {
    return this.http.post<ExpirySweepResult>(this.url('/delegated-access/expiry-sweep'), null);
  }

  /** `POST /delegated-permission-sets` — publicar un set con su versión 1. */
  createPermissionSet(set: NewPermissionSet): Observable<PermissionSetVersion> {
    return this.http.post<PermissionSetVersion>(this.url('/delegated-permission-sets'), set);
  }

  /** `POST /delegated-permission-sets/:id/versions` — reemplazo all-or-nothing. */
  publishSetVersion(setId: string, version: NewSetVersion): Observable<PermissionSetVersion> {
    return this.http.post<PermissionSetVersion>(
      this.url(`/delegated-permission-sets/${setId}/versions`),
      version,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
