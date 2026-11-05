import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { nombreDeContentDisposition } from '../files/content-disposition';
import { sendIdempotent, SubmissionKeys } from '../idempotency';
import { queryParams } from './admin-portal.wire';
import type {
  BulkImportBatch,
  BulkImportCatalog,
  BulkImportDownload,
  BulkImportFormat,
  BulkImportReport,
  CreateBulkImportInput,
} from './bulk-imports.types';

/** Cuántos lotes pide la lista por omisión (el tope de la API es 100). */
export const BULK_IMPORTS_LIST_LIMIT = 25;

/**
 * Cargas masivas de la organización activa (`/admin/bulk-imports`): catálogo y
 * plantillas, lotes, vista previa, confirmación idempotente e informe.
 *
 * La organización la pone el interceptor con `X-Tenant-Id`; los lotes de otra
 * organización responden 404 (la misma respuesta que uno inexistente).
 */
@Injectable({ providedIn: 'root' })
export class BulkImportsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly submissionKeys = new SubmissionKeys();

  /** `GET /templates` — los tipos de carga, los topes y el estado declarado del motor. */
  catalog(): Observable<BulkImportCatalog> {
    return this.http.get<BulkImportCatalog>(this.url('/admin/bulk-imports/templates'));
  }

  /**
   * `GET /templates/:kind?format=` — la plantilla de un tipo en CSV o JSON.
   * El nombre lo decide el servidor (`plantilla-<tipo>-v1.<ext>`); si la
   * cabecera no viene se usa el mismo nombre como reserva.
   */
  downloadTemplate(kind: string, format: BulkImportFormat): Observable<BulkImportDownload> {
    return this.http
      .get(this.url(`/admin/bulk-imports/templates/${encodeURIComponent(kind)}`), {
        params: queryParams({ format }),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body ?? new Blob([]),
          fileName:
            nombreDeContentDisposition(respuesta.headers.get('Content-Disposition')) ??
            `plantilla-${kind}-v1.${format}`,
        })),
      );
  }

  /** `GET /?limit=` — los lotes de la organización que la sesión puede ver. */
  list(limit: number = BULK_IMPORTS_LIST_LIMIT): Observable<readonly BulkImportBatch[]> {
    return this.http.get<readonly BulkImportBatch[]>(this.url('/admin/bulk-imports'), {
      params: queryParams({ limit }),
    });
  }

  /**
   * `POST /` — valida el archivo y devuelve la vista previa (`VALIDADO` o
   * `RECHAZADO`). No escribe nada en el sistema. Va como `multipart/form-data`
   * con los campos de la declaración como texto; los que no vienen no se mandan
   * (la API rechaza los que no corresponden al tipo).
   */
  create(input: CreateBulkImportInput): Observable<BulkImportBatch> {
    const form = new FormData();
    form.append('file', input.file);
    form.append('kind', input.kind);
    for (const [campo, valor] of Object.entries(input.declaration)) {
      if (typeof valor === 'string' && valor !== '') form.append(campo, valor);
    }
    return this.http.post<BulkImportBatch>(this.url('/admin/bulk-imports'), form);
  }

  /**
   * `POST /:id/confirm` — confirma un lote `VALIDADO` y lo encola (202). Viaja
   * con `Idempotency-Key`: reintentar la misma confirmación (doble clic, corte
   * de red) manda la **misma** clave y la API devuelve el lote como está, sin
   * volver a encolarlo.
   */
  confirm(id: string): Observable<BulkImportBatch> {
    return sendIdempotent(this.submissionKeys, `bulk-import-confirm:${id}`, { id }, (headers) =>
      this.http.post<BulkImportBatch>(
        this.url(`/admin/bulk-imports/${encodeURIComponent(id)}/confirm`),
        null,
        { headers },
      ),
    );
  }

  /** `GET /:id` — estado, vista previa y avance de un lote. */
  get(id: string): Observable<BulkImportBatch> {
    return this.http.get<BulkImportBatch>(this.url(`/admin/bulk-imports/${encodeURIComponent(id)}`));
  }

  /** `GET /:id/report?format=json` — el informe para leer en pantalla. */
  report(id: string): Observable<BulkImportReport> {
    return this.http.get<BulkImportReport>(
      this.url(`/admin/bulk-imports/${encodeURIComponent(id)}/report`),
      { params: queryParams({ format: 'json' }) },
    );
  }

  /** `GET /:id/report?format=csv|json` — el informe como archivo. */
  downloadReport(id: string, format: BulkImportFormat): Observable<BulkImportDownload> {
    return this.http
      .get(this.url(`/admin/bulk-imports/${encodeURIComponent(id)}/report`), {
        params: queryParams({ format }),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((respuesta) => ({
          blob: respuesta.body ?? new Blob([]),
          fileName:
            nombreDeContentDisposition(respuesta.headers.get('Content-Disposition')) ??
            `informe-${id}.${format}`,
        })),
      );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
