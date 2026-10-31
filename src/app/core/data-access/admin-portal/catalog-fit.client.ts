import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { SubmissionKeys, sendIdempotent } from '../idempotency';
import type { CatalogFit, FitRunAccepted } from './catalog-fit.types';

/**
 * Sonda de ajuste de la catalogación (`/admin/catalog/fit`): lee el último resultado y
 * pide una corrida.
 *
 * `POST …/run` exige `Idempotency-Key`: la misma clave devuelve la corrida ya aceptada, y la API
 * también une el pedido a una corrida en vuelo. La clave se reutiliza mientras el envío no
 * termine bien (doble clic, reintento tras un timeout) y se cierra al aceptarse: el clic siguiente
 * es una corrida nueva.
 */
@Injectable({ providedIn: 'root' })
export class CatalogFitClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly submissionKeys = new SubmissionKeys();

  /** `GET /admin/catalog/fit` — el último resultado vigente, con su antigüedad y su historial. */
  latest(): Observable<CatalogFit> {
    return this.http.get<CatalogFit>(this.url('/admin/catalog/fit'));
  }

  /** `POST /admin/catalog/fit/run` — pide una corrida (202); se ejecuta fuera de la petición. */
  run(): Observable<FitRunAccepted> {
    return sendIdempotent(this.submissionKeys, 'catalog-fit-run', {}, (headers) =>
      this.http.post<FitRunAccepted>(this.url('/admin/catalog/fit/run'), {}, { headers }),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
