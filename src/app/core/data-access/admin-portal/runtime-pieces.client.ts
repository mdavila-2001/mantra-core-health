import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  DiscoveryReport,
  RuntimePieceDetail,
  RuntimePiecesPage,
  RuntimePiecesQuery,
} from './runtime-pieces.types';

/**
 * Piezas en ejecución (`/admin/ops/runtime-pieces`): el listado contrastado, la
 * ficha de una pieza y el descubrimiento idempotente que las registra.
 */
@Injectable({ providedIn: 'root' })
export class RuntimePiecesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(query: RuntimePiecesQuery = {}): Observable<RuntimePiecesPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      // Sólo lo que tiene valor: la API valida con lista blanca y un vacío es ruido.
      if (value !== undefined && value !== '' && value !== false)
        params = params.set(key, String(value));
    }
    return this.http.get<RuntimePiecesPage>(this.url('/admin/ops/runtime-pieces'), { params });
  }

  /** El id lleva puntos y se codifica: es una dirección, no texto libre. */
  get(id: string): Observable<RuntimePieceDetail> {
    return this.http.get<RuntimePieceDetail>(
      this.url(`/admin/ops/runtime-pieces/${encodeURIComponent(id)}`),
    );
  }

  /** `dryRun` calcula el efecto sin escribir. Repetirlo sin cambios en el código no cambia nada. */
  discover(options: { readonly dryRun?: boolean } = {}): Observable<DiscoveryReport> {
    return this.http.post<DiscoveryReport>(this.url('/admin/ops/runtime-pieces/discover'), {
      dryRun: options.dryRun === true,
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
