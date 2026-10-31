import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import {
  PRIVACY_JURISDICTIONS,
  PRIVACY_STATUSES,
  PRIVACY_TYPES,
  allowedTransitions,
  type PrivacyJurisdiction,
  type PrivacyNotMeasured,
  type PrivacyRequest,
  type PrivacyRequestsQuery,
  type PrivacyRequestsResult,
  type PrivacyStatus,
  type PrivacyTransition,
  type PrivacyType,
} from './privacy-requests.types';

/** Un ítem de `GET /privacy/dsar` tal como viaja (fechas ISO, códigos sin prefijo de módulo). */
interface RequestBody {
  readonly id: string;
  readonly subjectUserId: string;
  readonly type: string | null;
  readonly status: string | null;
  readonly jurisdiction: string | null;
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly dueAt: string;
  readonly overdue: boolean;
  readonly hasResultFile: boolean;
  readonly version: number;
  readonly updatedAt: string;
}

interface PageBody {
  readonly items: readonly RequestBody[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly notMeasured?: readonly PrivacyNotMeasured[];
}

/** Devuelve el código si es uno conocido; cualquier otro llega como `null` y la vista lo dice. */
function known<T extends string>(codes: readonly T[], value: string | null): T | null {
  return value !== null && (codes as readonly string[]).includes(value) ? (value as T) : null;
}

/** `JURISDICTION_PE` (o `AUDIT_JURISDICTION_PE`) → `PE`: la lectura no le quita el prefijo del concepto. */
function jurisdictionOf(value: string | null): PrivacyJurisdiction | null {
  return known(PRIVACY_JURISDICTIONS, value === null ? null : value.replace(/^(?:AUDIT_)?JURISDICTION_/, ''));
}

export function toPrivacyRequest(body: RequestBody): PrivacyRequest {
  const status = known<PrivacyStatus>(PRIVACY_STATUSES, body.status);
  return {
    id: body.id,
    subjectUserId: body.subjectUserId,
    type: known<PrivacyType>(PRIVACY_TYPES, body.type),
    status,
    jurisdiction: jurisdictionOf(body.jurisdiction),
    requestedAt: new Date(body.requestedAt),
    ...(body.completedAt ? { completedAt: new Date(body.completedAt) } : {}),
    dueAt: new Date(body.dueAt),
    overdue: body.overdue,
    hasResultFile: body.hasResultFile,
    updatedAt: new Date(body.updatedAt),
    rowVersion: body.version,
    allowedTransitions: allowedTransitions(status),
  };
}

/** Cliente de las solicitudes de privacidad. La API decide si una transición cabe en el estado. */
@Injectable({ providedIn: 'root' })
export class PrivacyRequestsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Las más recientes primero (`requested_at desc`). Roles de lectura: auditor, DPO y administrador de seguridad. */
  list(query: PrivacyRequestsQuery = {}): Observable<PrivacyRequestsResult> {
    return this.http
      .get<PageBody>(this.url('/privacy/dsar'), { params: queryParams({ ...query }) })
      .pipe(
        map((page) => ({
          items: page.items.map(toPrivacyRequest),
          nextCursor: page.nextCursor,
          limit: page.limit,
          notMeasured: page.notMeasured ?? [],
        })),
      );
  }

  get(id: string): Observable<PrivacyRequest> {
    return this.http
      .get<RequestBody>(this.url(`/privacy/dsar/${encodeURIComponent(id)}`))
      .pipe(map(toPrivacyRequest));
  }

  /**
   * Mueve la solicitud (`PATCH /privacy/dsar/:id`, sólo `SECURITY_ADMIN`). La respuesta de
   * esa ruta trae conceptos, no códigos: quien llama vuelve a leer con {@link get}.
   */
  transition(id: string, status: PrivacyTransition): Observable<void> {
    return this.http
      .patch<unknown>(this.url(`/privacy/dsar/${encodeURIComponent(id)}`), { status })
      .pipe(map(() => undefined));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
