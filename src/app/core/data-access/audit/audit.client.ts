import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { queryParams } from '../admin-portal/admin-portal.wire';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  AuditLogEntry,
  AuditLogQuery,
  AuditPage,
  DataAccessEntry,
  DataAccessQuery,
} from './audit.types';

/** Lo que llega por la red: la fecha como ISO. */
type Wire<T extends { readonly recordedAt: Date }> = Omit<T, 'recordedAt'> & {
  readonly recordedAt: string;
};

function withRecordedAt<T extends { readonly recordedAt: Date }>(body: Wire<T>): T {
  return { ...body, recordedAt: new Date(body.recordedAt) } as T;
}

function toPage<T extends { readonly recordedAt: Date }>(page: AuditPage<Wire<T>>): AuditPage<T> {
  return { ...page, items: page.items.map((item) => withRecordedAt<T>(item)) };
}

/**
 * Cliente de la bitácora de auditoría (`/audit/log`, `/audit/data-access`).
 *
 * Sólo lee. Los filtros viajan sin claves vacías: la API valida con
 * `forbidNonWhitelisted` y una clave en blanco vuelve como 400.
 */
@Injectable({ providedIn: 'root' })
export class AuditClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Acciones que mutaron algo, con su riesgo para la seguridad de la salud. */
  log(query: AuditLogQuery = {}): Observable<AuditPage<AuditLogEntry>> {
    return this.http
      .get<AuditPage<Wire<AuditLogEntry>>>(this.url('/audit/log'), {
        params: queryParams({ ...query }),
      })
      .pipe(map((page) => toPage<AuditLogEntry>(page)));
  }

  /** Lecturas (y escrituras) de datos sensibles. */
  dataAccess(query: DataAccessQuery = {}): Observable<AuditPage<DataAccessEntry>> {
    return this.http
      .get<AuditPage<Wire<DataAccessEntry>>>(this.url('/audit/data-access'), {
        params: queryParams({ ...query }),
      })
      .pipe(map((page) => toPage<DataAccessEntry>(page)));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
