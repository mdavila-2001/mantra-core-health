import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, reduce, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { simulatorOnly } from '../simulator-only';
import type { LabOrderFromQr, LabPatientMatch, NewLabOrder } from './lab-order-intake.types';
import type {
  LabCategory,
  LabCategoryPage,
  LabImportMode,
  LabImportResult,
  LabImportRow,
  LabOrder,
  LabOrderAction,
  LabOrderPage,
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
import type { LabCatalog, LabCatalogImportResult } from './lab-import.types';

/** The API caps `limit` at 500; asking for the cap keeps the page count low. */
const ORDER_PAGE_SIZE = 500;
const MAX_ORDER_PAGES = 20;

/**
 * El cliente del portal de la cuenta de laboratorio: su catálogo de servicios,
 * sus categorías, la carga masiva, el resumen y los resultados.
 *
 * Ninguna ruta lleva el id del laboratorio: el servidor lo resuelve con el
 * tenant del contexto, que el interceptor de sesión ya manda en `X-Tenant-Id`.
 *
 * The real API publishes every `/diagnostics/lab/*` route (04/11/2026), so the
 * calls go to the network; under `development,demo` the simulator answers them
 * (`core/mock/handlers/lab-portal.handlers.ts`, `lab-orders.handlers.ts`).
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
    return this.http.delete<LabService>(this.url(`/diagnostics/lab/services/${encodeURIComponent(id)}`));
  }

  importServices(mode: LabImportMode, rows: readonly LabImportRow[]): Observable<LabImportResult> {
    return this.http.post<LabImportResult>(this.url('/diagnostics/lab/services/import'), {
      mode,
      rows,
    });
  }

  /** The LOINC study catalog with components and suggested prices (4.2). */
  getCatalog(): Observable<LabCatalog> {
    return this.http.get<LabCatalog>(this.url('/diagnostics/lab/catalog'));
  }

  /** Adds catalog análisis: panel, one service per component, suggested prices. */
  importCatalog(conceptIds: readonly string[]): Observable<LabCatalogImportResult> {
    return this.http.post<LabCatalogImportResult>(this.url('/diagnostics/lab/catalog/import'), {
      conceptIds,
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

  /* ---- órdenes ---------------------------------------------------------- */

  /**
   * Every order of the lab with its status (the tabs filter on screen). The API
   * pages the list, so this follows `nextCursor` up to `MAX_ORDER_PAGES` pages
   * and returns one merged page: `count` is the lab's total and a `nextCursor`
   * left over means the cap was hit.
   */
  listOrders(): Observable<LabOrderPage> {
    const fetchPage = (cursor?: string) =>
      this.http.get<LabOrderPage>(this.url('/diagnostics/lab/orders'), {
        params: parametros({ limit: ORDER_PAGE_SIZE, cursor }),
      });
    return fetchPage().pipe(
      expand((page, index) =>
        page.nextCursor !== undefined && index + 1 < MAX_ORDER_PAGES ? fetchPage(page.nextCursor) : EMPTY,
      ),
      reduce((all, page) => ({
        items: [...all.items, ...page.items],
        count: all.count,
        nextCursor: page.nextCursor,
      })),
    );
  }

  /** Finds the patient by national id (in the body: it is PHI). 404 when nobody holds it. */
  lookupPatient(nationalId: string): Observable<LabPatientMatch> {
    return this.http.post<LabPatientMatch>(this.url('/diagnostics/lab/patients/lookup'), { nationalId });
  }

  /** The center registers an order that arrives on paper or at the counter. */
  createOrder(order: NewLabOrder): Observable<LabOrder> {
    return this.http.post<LabOrder>(this.url('/diagnostics/lab/orders'), order);
  }

  /** Simulator-only: creates the order from the QR the patient sent. Idempotent per code. */
  createOrderFromQr(code: string): Observable<LabOrderFromQr> {
    return simulatorOnly('Crear una orden con el QR del paciente', this.url('/diagnostics/lab/orders'), () =>
      this.http
        .post<LabOrder>(this.url('/diagnostics/lab/orders/from-qr'), { code }, { observe: 'response' })
        .pipe(map((res) => ({ order: res.body as LabOrder, created: res.status === 201 }))),
    );
  }

  /**
   * Un paso del camino de la orden. Un paso que el estado actual no admite
   * responde 409: la pantalla no decide, sólo pregunta.
   */
  transitionOrder(orderId: string, action: LabOrderAction, reason?: string): Observable<LabOrder> {
    return this.http.post<LabOrder>(
      this.url(`/diagnostics/lab/orders/${encodeURIComponent(orderId)}/transitions`),
      reason === undefined ? { action } : { action, reason },
    );
  }

  /* ---- resultados ------------------------------------------------------- */

  /**
   * The API rejects `q` in the URL (it may carry patient data): a text search
   * goes as `POST …/result-files/search` with the filters in the body.
   */
  listResultFiles(query: LabResultFileQuery = {}): Observable<LabResultFilePage> {
    if (query.q !== undefined && query.q.trim() !== '') {
      return this.http.post<LabResultFilePage>(this.url('/diagnostics/lab/result-files/search'), withoutEmpty(query));
    }
    return this.http.get<LabResultFilePage>(this.url('/diagnostics/lab/result-files'), {
      params: parametros(query),
    });
  }

  /** Las órdenes de la bandeja a las que se les puede atar un resultado. */
  listResultTargets(): Observable<LabResultTargetPage> {
    return this.http.get<LabResultTargetPage>(this.url('/diagnostics/lab/result-targets'));
  }

  startUpload(start: LabResultUploadStart): Observable<LabResultUploadSession> {
    return this.http.post<LabResultUploadSession>(this.url('/diagnostics/lab/result-uploads'), start);
  }

  /**
   * Manda una parte. El cuerpo es el `Blob` tal cual —un `slice` del `File`—,
   * sin `FormData` ni base64: el navegador lo lee del disco al enviarlo, así
   * que ni un archivo de varios gigas pasa entero por la memoria.
   */
  uploadPart(uploadId: string, index: number, part: Blob): Observable<void> {
    return this.http.put<void>(
      this.url(`/diagnostics/lab/result-uploads/${encodeURIComponent(uploadId)}/parts/${index}`),
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
    return this.http.get(this.url(`/diagnostics/lab/result-files/${encodeURIComponent(id)}/content`), {
      responseType: 'blob',
    });
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

/** The same filters as a JSON body, without empty values (`forbidNonWhitelisted`). */
function withoutEmpty(query: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}
