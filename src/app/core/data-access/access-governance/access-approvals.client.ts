import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, reduce, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  ApprovalDecision,
  ApprovalDecisionResult,
  NewSupportApproval,
  SupportApproval,
  SupportApprovalList,
} from './access-reviews.types';

/**
 * Cliente del **cuatro ojos** (CONTRATO-GOBIERNO §6.5, §8.3 bloque C).
 *
 * Quien pide ≠ quien aprueba ≠ el beneficiario. Una aprobación de acción se consume **una** sola vez y el reintento
 * de la acción la presenta con el encabezado `X-Approval-Id` (lo pone `AccessChallengeService`, no este cliente).
 */
@Injectable({ providedIn: 'root' })
export class AccessApprovalsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /me/support-approvals` — la persona de apoyo pide aprobación para una acción (la organización va en el cuerpo). */
  createApproval(request: NewSupportApproval): Observable<SupportApproval> {
    return this.http.post<SupportApproval>(this.url('/me/support-approvals'), request);
  }

  /** `GET /me/support-approvals` — los propios, por estado. */
  listMyApprovals(): Observable<SupportApprovalList> {
    return this.http.get<SupportApprovalList>(this.url('/me/support-approvals'));
  }

  /** `POST /me/support-approvals/:id/cancel` — 409 `FOUR_EYES_NOT_PENDING` si ya no está pendiente. */
  cancelMyApproval(approvalId: string): Observable<SupportApproval> {
    return this.http.post<SupportApproval>(
      this.url(`/me/support-approvals/${encodeURIComponent(approvalId)}/cancel`),
      {},
    );
  }

  /**
   * `GET /approvals/pending` — lo que **yo** puedo decidir. La API pagina (`limit` 1-100, 50 por omisión, `cursor`/`nextCursor`): acá se
   * juntan las páginas (de 100 en 100, con un tope de 20) para que la pantalla vea todo lo que le espera.
   */
  listPending(): Observable<SupportApprovalList> {
    const pagina = (cursor?: string): Observable<SupportApprovalList> =>
      this.http.get<SupportApprovalList>(this.url('/approvals/pending'), {
        params:
          cursor === undefined
            ? new HttpParams().set('limit', '100')
            : new HttpParams().set('limit', '100').set('cursor', cursor),
      });
    let vistas = 0;
    return pagina().pipe(
      expand((p) =>
        p.nextCursor !== undefined && p.nextCursor !== null && p.nextCursor !== '' && ++vistas < 20
          ? pagina(p.nextCursor)
          : EMPTY,
      ),
      reduce<SupportApprovalList, readonly SupportApproval[]>(
        (todas, p) => [...todas, ...p.items],
        [],
      ),
      map((items) => ({ items, count: items.length })),
    );
  }

  /** `POST /approvals/:id/decision` — aprobar o rechazar (el rechazo lleva comentario; las críticas piden paso extra). */
  decide(approvalId: string, decision: ApprovalDecision): Observable<ApprovalDecisionResult> {
    return this.http.post<ApprovalDecisionResult>(
      this.url(`/approvals/${encodeURIComponent(approvalId)}/decision`),
      decision,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
