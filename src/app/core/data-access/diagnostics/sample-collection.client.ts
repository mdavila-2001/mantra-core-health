import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { SampleCollectionPoint } from './sample-collection.types';

/**
 * Cliente de los puntos de toma de muestra — franja F5b.
 *
 * La API ofrece sólo los puntos activos y disponibles (un punto bloqueado por
 * F2 no aparece) y valida la sugerencia al crear la orden: un punto que no es
 * `SAMPLE_COLLECTION` de la sede sugerida responde 422 `COLLECTION_POINT_INVALID`.
 */
@Injectable({ providedIn: 'root' })
export class SampleCollectionClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /sites/:siteId/sample-collection-points`. */
  listPoints(siteId: string): Observable<readonly SampleCollectionPoint[]> {
    return this.http.get<readonly SampleCollectionPoint[]>(apiUrl(this.baseUrl, `/sites/${encodeURIComponent(siteId)}/sample-collection-points`));
  }
}
