import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { simulatorOnly } from '../simulator-only';
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
 *
 * **Sólo existe en el simulador**: la API de `origin/dev` no publica ninguna
 * ruta `/diagnostics/lab/*` (ver {@link LabPortalClient.simulated}).
 */
@Injectable({ providedIn: 'root' })
export class LabPortalClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---- servicios -------------------------------------------------------- */

  listServices(query: LabServiceQuery = {}): Observable<LabServicePage> {
    return this.simulated('Ver el catálogo de servicios del laboratorio', () =>
      this.http.get<LabServicePage>(this.url('/diagnostics/lab/services'), {
        params: parametros(query),
      }),
    );
  }

  createService(draft: LabServiceDraft): Observable<LabService> {
    return this.simulated('Agregar un servicio al catálogo del laboratorio', () =>
      this.http.post<LabService>(this.url('/diagnostics/lab/services'), draft),
    );
  }

  updateService(id: string, changes: LabServiceChanges): Observable<LabService> {
    return this.simulated('Editar un servicio del laboratorio', () =>
      this.http.patch<LabService>(
        this.url(`/diagnostics/lab/services/${encodeURIComponent(id)}`),
        changes,
      ),
    );
  }

  /** Retira el servicio: deja de verse en la vitrina, pero no se borra. */
  withdrawService(id: string): Observable<LabService> {
    return this.simulated('Retirar un servicio del laboratorio', () =>
      this.http.delete<LabService>(this.url(`/diagnostics/lab/services/${encodeURIComponent(id)}`)),
    );
  }

  importServices(mode: LabImportMode, rows: readonly LabImportRow[]): Observable<LabImportResult> {
    return this.simulated('Importar servicios del laboratorio', () =>
      this.http.post<LabImportResult>(this.url('/diagnostics/lab/services/import'), {
        mode,
        rows,
      }),
    );
  }

  /* ---- categorías ------------------------------------------------------- */

  listCategories(): Observable<LabCategoryPage> {
    return this.simulated('Ver las categorías del laboratorio', () =>
      this.http.get<LabCategoryPage>(this.url('/diagnostics/lab/categories')),
    );
  }

  createCategory(name: string): Observable<LabCategory> {
    return this.simulated('Crear una categoría del laboratorio', () =>
      this.http.post<LabCategory>(this.url('/diagnostics/lab/categories'), { name }),
    );
  }

  renameCategory(id: string, name: string): Observable<LabCategory> {
    return this.simulated('Renombrar una categoría del laboratorio', () =>
      this.http.patch<LabCategory>(
        this.url(`/diagnostics/lab/categories/${encodeURIComponent(id)}`),
        { name },
      ),
    );
  }

  deleteCategory(id: string): Observable<{ readonly ok: boolean }> {
    return this.simulated('Eliminar una categoría del laboratorio', () =>
      this.http.delete<{ readonly ok: boolean }>(
        this.url(`/diagnostics/lab/categories/${encodeURIComponent(id)}`),
      ),
    );
  }

  /* ---- resumen ---------------------------------------------------------- */

  getSummary(): Observable<LabSummary> {
    return this.simulated('Ver el resumen del laboratorio', () =>
      this.http.get<LabSummary>(this.url('/diagnostics/lab/summary')),
    );
  }

  /* ---- resultados ------------------------------------------------------- */

  listResultFiles(query: LabResultFileQuery = {}): Observable<LabResultFilePage> {
    return this.simulated('Ver los resultados subidos', () =>
      this.http.get<LabResultFilePage>(this.url('/diagnostics/lab/result-files'), {
        params: parametros(query),
      }),
    );
  }

  /** Las órdenes de la bandeja a las que se les puede atar un resultado. */
  listResultTargets(): Observable<LabResultTargetPage> {
    return this.simulated('Ver las órdenes a las que se adjunta un resultado', () =>
      this.http.get<LabResultTargetPage>(this.url('/diagnostics/lab/result-targets')),
    );
  }

  startUpload(start: LabResultUploadStart): Observable<LabResultUploadSession> {
    return this.simulated('Subir resultados', () =>
      this.http.post<LabResultUploadSession>(this.url('/diagnostics/lab/result-uploads'), start),
    );
  }

  /**
   * Manda una parte. El cuerpo es el `Blob` tal cual —un `slice` del `File`—,
   * sin `FormData` ni base64: el navegador lo lee del disco al enviarlo, así
   * que ni un archivo de varios gigas pasa entero por la memoria.
   */
  uploadPart(uploadId: string, index: number, part: Blob): Observable<void> {
    return this.simulated('Subir resultados', () =>
      this.http.put<void>(
        this.url(`/diagnostics/lab/result-uploads/${encodeURIComponent(uploadId)}/parts/${index}`),
        part,
        { headers: new HttpHeaders({ 'Content-Type': 'application/octet-stream' }) },
      ),
    );
  }

  completeUpload(uploadId: string): Observable<LabResultFile> {
    return this.simulated('Subir resultados', () =>
      this.http.post<LabResultFile>(
        this.url(`/diagnostics/lab/result-uploads/${encodeURIComponent(uploadId)}/complete`),
        {},
      ),
    );
  }

  abortUpload(uploadId: string): Observable<void> {
    return this.simulated('Cancelar una subida de resultados', () =>
      this.http.delete<void>(
        this.url(`/diagnostics/lab/result-uploads/${encodeURIComponent(uploadId)}`),
      ),
    );
  }

  /** Los bytes del archivo, para verlo o descargarlo. */
  resultContent(id: string): Observable<Blob> {
    return this.simulated('Ver un resultado subido', () =>
      this.http.get(this.url(`/diagnostics/lab/result-files/${encodeURIComponent(id)}/content`), {
        responseType: 'blob',
      }),
    );
  }

  /** Retira un archivo subido por error; queda en el historial, con el motivo. */
  withdrawResult(id: string, reason: string): Observable<LabResultFile> {
    return this.simulated('Retirar un resultado subido', () =>
      this.http.post<LabResultFile>(
        this.url(`/diagnostics/lab/result-files/${encodeURIComponent(id)}/withdrawal`),
        { reason },
      ),
    );
  }

  /**
   * Ninguna ruta de este portal existe en la API de `origin/dev` (informe B,
   * §2; figura en `PENDIENTES-BACKEND.md`): todo el portal es **sólo
   * simulador**. Contra la API real no sale ninguna petición y el error nombra
   * la función que falta, en vez de un 404 genérico.
   */
  private simulated<T>(feature: string, request: () => Observable<T>): Observable<T> {
    return simulatorOnly(feature, this.url('/diagnostics/lab'), request);
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
