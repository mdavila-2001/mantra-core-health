import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  PendingProcedure,
  ProcedureCentersQuery,
  ProcedureCentersResult,
} from './procedure-centers.types';

type WireProcedure = Omit<PendingProcedure, 'requestedAt'> & { readonly requestedAt: string };
type WireResult = Omit<ProcedureCentersResult, 'procedures'> & {
  readonly procedures: readonly WireProcedure[];
};

/**
 * «Dónde me hago los procedimientos que me pidieron» (carril 19).
 *
 * El servidor resuelve al titular por la cuenta y lee él mismo sus órdenes: lo
 * que le pidieron a una persona es PHI y no viaja en la URL. Desde acá sólo se
 * manda el origen, y sólo si la persona lo eligió.
 */
@Injectable({ providedIn: 'root' })
export class ProcedureCentersClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /clinical/me/procedure-centers` — lo pendiente y las sedes que lo ofrecen. */
  getOwn(query: ProcedureCentersQuery = {}): Observable<ProcedureCentersResult> {
    let params = new HttpParams();
    if (query.origin !== undefined) {
      params = params.set('lat', String(query.origin.lat)).set('lng', String(query.origin.lng));
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    return this.http
      .get<WireResult>(this.url('/clinical/me/procedure-centers'), { params })
      .pipe(
        map((wire) => ({
          ...wire,
          procedures: wire.procedures.map((procedure) => ({
            ...procedure,
            requestedAt: new Date(procedure.requestedAt),
          })),
        })),
      );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
