import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  LabCategory,
  LabCategoryPage,
  LabImportMode,
  LabImportResult,
  LabImportRow,
  LabResultFile,
  LabResultFilePage,
  LabResultFileQuery,
  LabResultTargetPage,
  LabResultUploadSession,
  LabResultUploadStart,
  LabService,
  LabServiceChanges,
  LabServiceDraft,
  LabServicePage,
  LabServiceQuery,
  LabSummary,
} from './lab-portal.types';

/**
 * El cliente del portal de la cuenta de laboratorio: su catálogo de servicios,
 * sus categorías, la carga masiva, el resumen y los resultados.
 *
 * Ninguna ruta lleva el id del laboratorio: el servidor lo resuelve con el
 * tenant del contexto, que el interceptor de sesión ya manda en `X-Tenant-Id`.
 */
@Injectable({ providedIn: 'root' })
export class LabPortalClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---- servicios -------------------------------------------------------- */

  listServices(query: LabServiceQuery = {}): Observable<LabServicePage> {
    return this.http.get<LabServicePage>(this.url('/diagnostics/lab/services'), {
      params: parametros(query),
    });
  }

  createService(draft: LabServiceDraft): Observable<LabService> {
    return this.http.post<LabService>(this.url('/diagnostics/lab/services'), draft);
  }

  updateService(id: string, changes: LabServiceChanges): Observable<LabService> {
    return this.http.patch<LabService>(
      this.url(`/diagnostics/lab/services/${encodeURIComponent(id)}`),
      changes,
    );
  }

  /** Retira el servicio: deja de verse en la vitrina, pero no se borra. */
  withdrawService(id: string): Observable<LabService> {
    return this.http.delete<LabService>(
      this.url(`/diagnostics/lab/services/${encodeURIComponent(id)}`),
    );
  }

  importServices(
    mode: LabImportMode,
    rows: readonly LabImportRow[],
  ): Observable<LabImportResult> {
    return this.http.post<LabImportResult>(this.url('/diagnostics/lab/services/import'), {
      mode,
      rows,
    });
  }

  /* ---- categorías ------------------------------------------------------- */

  listCategories(): Observable<LabCategoryPage> {
    return this.http.get<LabCategoryPage>(this.url('/diagnostics/lab/categories'));
  }

  createCategory(name: string): Observable<LabCategory> {
    return this.http.post<LabCategory>(this.url('/diagnostics/lab/categories'), { name });
  }

  renameCategory(id: string, name: string): Observable<LabCategory> {
    return this.http.patch<LabCategory>(
      this.url(`/diagnostics/lab/categories/${encodeURIComponent(id)}`),
      { name },
    );
  }

  deleteCategory(id: string): Observable<{ readonly ok: boolean }> {
    return this.http.delete<{ readonly ok: boolean }>(
      this.url(`/diagnostics/lab/categories/${encodeURIComponent(id)}`),
    );
  }

  /* ---- resumen ---------------------------------------------------------- */

  getSummary(): Observable<LabSummary> {
    return this.http.get<LabSummary>(this.url('/diagnostics/lab/summary'));
  }

  /* ---- resultados ------------------------------------------------------- */

  listResultFiles(query: LabResultFileQuery = {}): Observable<LabResultFilePage> {
    return this.http.get<LabResultFilePage>(this.url('/diagnostics/lab/result-files'), {
      params: parametros(query),
    });
  }

  /** Las órdenes de la bandeja a las que se les puede atar un resultado. */
  listResultTargets(): Observable<LabResultTargetPage> {
    return this.http.get<LabResultTargetPage>(this.url('/diagnostics/lab/result-targets'));
  }

  startUpload(start: LabResultUploadStart): Observable<LabResultUploadSession> {
    return this.http.post<LabResultUploadSession>(
      this.url('/diagnostics/lab/result-uploads'),
      start,
    );
  }

  /**
   * Manda una parte. El cuerpo es el `Blob` tal cual —un `slice` del `File`—,
   * sin `FormData` ni base64: el navegador lo lee del disco al enviarlo, así
   * que ni un archivo de varios gigas pasa entero por la memoria.
   */
  uploadPart(uploadId: string, index: number, part: Blob): Observable<void> {
    return this.http.put<void>(
      this.url(
        `/diagnostics/lab/result-uploads/${encodeURIComponent(uploadId)}/parts/${index}`,
      ),
      part,
      { headers: new HttpHeaders({ 'Content-Type': 'application/octet-stream' }) },
    );
  }

  completeUpload(uploadId: string): Observable<LabResultFile> {
    return this.http.post<LabResultFile>(
      this.url(`/diagnostics/lab/result-uploads/${encodeURIComponent(uploadId)}/complete`),
      {},
    );
  }

  abortUpload(uploadId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/diagnostics/lab/result-uploads/${encodeURIComponent(uploadId)}`),
    );
  }

  /** Los bytes del archivo, para verlo o descargarlo. */
  resultContent(id: string): Observable<Blob> {
    return this.http.get(
      this.url(`/diagnostics/lab/result-files/${encodeURIComponent(id)}/content`),
      { responseType: 'blob' },
    );
  }

  /** Retira un archivo subido por error; queda en el historial, con el motivo. */
  withdrawResult(id: string, reason: string): Observable<LabResultFile> {
    return this.http.post<LabResultFile>(
      this.url(`/diagnostics/lab/result-files/${encodeURIComponent(id)}/withdrawal`),
      { reason },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * Parámetro a parámetro, sin los vacíos: el backend valida con
 * `forbidNonWhitelisted` y un opcional en `undefined` vuelve 400.
 */
function parametros(query: object): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (valor === undefined || valor === null || valor === '') {
      continue;
    }
    params = params.set(clave, String(valor));
  }
  return params;
}
