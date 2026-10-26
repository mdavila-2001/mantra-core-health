import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos } from '../wire';
import type { PracticeInvitationInput, RoleAssignmentRow } from './role-assignments.types';

/** Lo que viaja: los textos opcionales llegan `null`. */
type WireRow = { readonly [K in keyof RoleAssignmentRow]: RoleAssignmentRow[K] | null };

function toRow(wire: WireRow): RoleAssignmentRow {
  // `healthcareServiceId`, `serviceConceptId` y `serviceDisplay` son `string | null` en la vista:
  // la ausencia del procedimiento ES el dato, así que el `null` se conserva.
  return {
    ...sinNulos(wire),
    healthcareServiceId: wire.healthcareServiceId ?? null,
    serviceConceptId: wire.serviceConceptId ?? null,
    serviceDisplay: wire.serviceDisplay ?? null,
  } as RoleAssignmentRow;
}

/**
 * Afiliación de médicos a centros médicos, en las dos puntas (CM-07).
 *
 * La afiliación nunca se activa sola: el centro invita y el médico acepta, o el
 * médico pide y el centro aprueba. `POST /practices/:practiceId/role-assignments`
 * (activa sin aceptación) no se usa.
 */
@Injectable({ providedIn: 'root' })
export class RoleAssignmentsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practices/:practiceId/role-assignments` — los médicos del centro, con estado e iniciador. */
  listForPractice(practiceId: string): Observable<readonly RoleAssignmentRow[]> {
    return this.http
      .get<readonly WireRow[]>(this.url(`/practices/${encodeURIComponent(practiceId)}/role-assignments`))
      .pipe(map((rows) => rows.map(toRow)));
  }

  /** `POST /practices/:practiceId/role-assignments/invitations` — el centro invita; una fila `INVITED` por procedimiento. */
  invite(practiceId: string, input: PracticeInvitationInput): Observable<readonly RoleAssignmentRow[]> {
    return this.http
      .post<{ readonly items: readonly WireRow[] }>(
        this.url(`/practices/${encodeURIComponent(practiceId)}/role-assignments/invitations`),
        input,
      )
      .pipe(map((body) => body.items.map(toRow)));
  }

  /** `POST /practitioners/me/role-assignments/:roleId/accept` — el médico acepta; la fila queda `ACTIVE`. */
  accept(roleId: string): Observable<RoleAssignmentRow> {
    return this.mine(roleId, 'accept');
  }

  /** `POST /practitioners/me/role-assignments/:roleId/decline` — el médico declina; la fila queda `REJECTED`. */
  decline(roleId: string): Observable<RoleAssignmentRow> {
    return this.mine(roleId, 'decline');
  }

  /** `POST /role-assignments/:roleId/approve` — el centro aprueba una solicitud; la fila queda `ACTIVE`. */
  approve(roleId: string): Observable<RoleAssignmentRow> {
    return this.ofPractice(roleId, 'approve');
  }

  /** `POST /role-assignments/:roleId/reject` — el centro rechaza una solicitud; la fila queda `REJECTED`. */
  reject(roleId: string): Observable<RoleAssignmentRow> {
    return this.ofPractice(roleId, 'reject');
  }

  private mine(roleId: string, action: 'accept' | 'decline'): Observable<RoleAssignmentRow> {
    return this.http
      .post<WireRow>(this.url(`/practitioners/me/role-assignments/${encodeURIComponent(roleId)}/${action}`), {})
      .pipe(map(toRow));
  }

  private ofPractice(roleId: string, action: 'approve' | 'reject'): Observable<RoleAssignmentRow> {
    return this.http
      .post<WireRow>(this.url(`/role-assignments/${encodeURIComponent(roleId)}/${action}`), {})
      .pipe(map(toRow));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
