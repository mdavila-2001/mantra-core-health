import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { nombreDeContentDisposition } from '../files/content-disposition';
import { sendIdempotent, SubmissionKeys } from '../idempotency';
import { queryParams } from './admin-portal.wire';
import type {
  ClinicalImportBatch,
  ClinicalImportCatalog,
  ClinicalImportDownload,
  ClinicalImportFormat,
  ClinicalImportLoaded,
  ClinicalImportReport,
  CreateClinicalImportInput,
} from './clinical-imports.types';

/** Cuántos lotes pide la lista por omisión (el tope de la API es 100). */
export const CLINICAL_IMPORTS_LIST_LIMIT = 25;

/**
 * Carga masiva especial de historias clínicas de la organización activa
 * (`/admin/clinical-imports`): catálogo, plantillas, lotes, vista previa,
 * confirmación idempotente, informe y lo cargado.
 *
 * La organización la pone el interceptor con `X-Tenant-Id`; un lote de otra
 * organización responde 404 (igual que uno inexistente). La autoridad sobre
 * quién puede cargar es la API: este cliente no decide nada.
 *
 * Ni la URL ni la consulta llevan datos de pacientes: sólo identificadores de
 * lote, tipo y formato.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalImportsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly submissionKeys = new SubmissionKeys();

  /** `GET /catalog` — los tipos de registro, los topes y el estado declarado del motor. */
  catalog(): Observable<ClinicalImportCatalog> {
    return this.http.get<ClinicalImportCatalog>(this.url('/admin/clinical-imports/catalog'));
  }

  /**
   * `GET /import-template?kind=&format=` — la plantilla de un tipo en CSV o JSON
   * (regla T1). El nombre lo decide el servidor; si la cabecera no viene se usa
   * el mismo nombre como reserva.
   */
  downloadTemplate(kind: string, format: ClinicalImportFormat): Observable<ClinicalImportDownload> {
    return this.http
      .get(this.url('/admin/clinical-imports/import-template'), {
        params: queryParams({ kind, format }),
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

  /** `GET /?limit=` — los lotes de la organización, del más reciente al más antiguo. */
  list(limit: number = CLINICAL_IMPORTS_LIST_LIMIT): Observable<readonly ClinicalImportBatch[]> {
    return this.http.get<readonly ClinicalImportBatch[]>(this.url('/admin/clinical-imports'), {
      params: queryParams({ limit }),
    });
  }

  /**
   * `POST /` — valida el archivo y devuelve la vista previa (`VALIDADO` o
   * `RECHAZADO`). No escribe nada en ninguna historia. Va como
   * `multipart/form-data`: el archivo, el tipo y las tres partes de la
   * declaración como texto.
   */
  create(input: CreateClinicalImportInput): Observable<ClinicalImportBatch> {
    const form = new FormData();
    form.append('file', input.file);
    form.append('kind', input.kind);
    form.append('sourceOrganization', input.declaration.sourceOrganization);
    form.append('legalBasis', input.declaration.legalBasis);
    form.append('loadedAt', input.declaration.loadedAt);
    return this.http.post<ClinicalImportBatch>(this.url('/admin/clinical-imports'), form);
  }

  /**
   * `POST /:id/confirm` — confirma un lote `VALIDADO` y lo encola (202). Viaja
   * con `Idempotency-Key`: reintentar la misma confirmación (doble clic, corte
   * de red) manda la **misma** clave y la API devuelve el lote como está, sin
   * volver a encolarlo.
   */
  confirm(id: string): Observable<ClinicalImportBatch> {
    return sendIdempotent(this.submissionKeys, `clinical-import-confirm:${id}`, { id }, (headers) =>
      this.http.post<ClinicalImportBatch>(
        this.url(`/admin/clinical-imports/${encodeURIComponent(id)}/confirm`),
        null,
        { headers },
      ),
    );
  }

  /** `GET /:id` — estado, vista previa y avance de un lote. */
  get(id: string): Observable<ClinicalImportBatch> {
    return this.http.get<ClinicalImportBatch>(
      this.url(`/admin/clinical-imports/${encodeURIComponent(id)}`),
    );
  }

  /** `GET /:id/report` — el informe para leer en pantalla. Leerlo deja rastro en la API. */
  report(id: string): Observable<ClinicalImportReport> {
    return this.http.get<ClinicalImportReport>(
      this.url(`/admin/clinical-imports/${encodeURIComponent(id)}/report`),
      { params: queryParams({ format: 'json' }) },
    );
  }

  /** `GET /:id/report?format=csv|json` — el informe como archivo. */
  downloadReport(id: string, format: ClinicalImportFormat): Observable<ClinicalImportDownload> {
    return this.http
      .get(this.url(`/admin/clinical-imports/${encodeURIComponent(id)}/report`), {
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

  /** `GET /:id/loaded` — qué agregó el lote y dónde: sólo identificadores. Leerlo deja rastro en la API. */
  loaded(id: string): Observable<ClinicalImportLoaded> {
    return this.http.get<ClinicalImportLoaded>(
      this.url(`/admin/clinical-imports/${encodeURIComponent(id)}/loaded`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
