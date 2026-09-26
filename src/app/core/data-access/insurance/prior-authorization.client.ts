import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate } from '../wire';
import type {
  PriorAuthorizationDetail,
  PriorAuthorizationInboxFilter,
  PriorAuthorizationItem,
  PriorAuthorizationItemDecision,
  PriorAuthorizationItemDecisionInput,
  PriorAuthorizationSummary,
} from './prior-authorization.types';

type WireSummary = Omit<PriorAuthorizationSummary, 'submittedAt'> & {
  readonly submittedAt: string | null;
};

type WireItem = Omit<PriorAuthorizationItem, 'decision'> & {
  readonly decision:
    | (Omit<PriorAuthorizationItemDecision, 'decidedAt'> & {
        readonly decidedAt: string | null;
      })
    | null;
};

type WireDetail = Omit<PriorAuthorizationDetail, 'submittedAt' | 'decidedAt' | 'items'> & {
  readonly submittedAt: string | null;
  readonly decidedAt: string | null;
  readonly items: readonly WireItem[];
};

/**
 * Bandeja de solicitudes de aprobación **de la aseguradora** del tenant activo.
 *
 * El alcance lo decide el servidor (administración del tenant de la
 * aseguradora dueña de la cobertura); una solicitud ajena y una inexistente
 * responden el mismo 403. Esta clase no filtra nada por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class PriorAuthorizationClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /prior-authorization-requests/inbox`.
   *
   * @param status - `PENDING`, `DETERMINED`, o nada para todas.
   * @returns Las 200 más recientes, de la más nueva a la más vieja.
   */
  listInbox(
    status?: PriorAuthorizationInboxFilter,
  ): Observable<readonly PriorAuthorizationSummary[]> {
    const params = status ? new HttpParams().set('status', status) : new HttpParams();
    return this.http
      .get<{ readonly items: readonly WireSummary[] }>(
        this.url('/prior-authorization-requests/inbox'),
        { params },
      )
      .pipe(map((body) => body.items.map(toSummary)));
  }

  /**
   * `GET /prior-authorization-requests/:id` — con los ítems y la decisión vigente de cada uno.
   *
   * @param id - Solicitud consultada.
   */
  get(id: string): Observable<PriorAuthorizationDetail> {
    return this.http
      .get<WireDetail>(this.url(`/prior-authorization-requests/${encodeURIComponent(id)}`))
      .pipe(map(toDetail));
  }

  /**
   * `POST /prior-authorization-requests/:id/determinations` — APROBADO / NO
   * APROBADO por ítem. Todos los ítems se deciden en el mismo envío; la
   * decisión global (aprobada, parcial, no aprobada) la deriva el servidor.
   *
   * @param id - Solicitud decidida.
   * @param items - Una decisión por ítem.
   * @returns El identificador de la determinación.
   */
  decide(
    id: string,
    items: readonly PriorAuthorizationItemDecisionInput[],
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(`/prior-authorization-requests/${encodeURIComponent(id)}/determinations`),
      { items },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toSummary(body: WireSummary): PriorAuthorizationSummary {
  return { ...body, submittedAt: maybeDate(body.submittedAt) ?? null };
}

function toDetail(body: WireDetail): PriorAuthorizationDetail {
  return {
    ...body,
    submittedAt: maybeDate(body.submittedAt) ?? null,
    decidedAt: maybeDate(body.decidedAt) ?? null,
    items: body.items.map((item) => ({
      ...item,
      decision: item.decision
        ? { ...item.decision, decidedAt: maybeDate(item.decision.decidedAt) ?? null }
        : null,
    })),
  };
}
