import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  MedicalCenterPage,
  MedicalCenterSearchQuery,
  MedicalCentersForMyOrdersQuery,
} from './medical-centers.types';

/** Los límites de ids por consulta (`CONTRATO.md` §4). */
const MIN_IDS = 1;
const MAX_IDS = 50;

/**
 * Cliente de la búsqueda de centros médicos por procedimiento.
 *
 * Devuelve la respuesta tal cual la escribe la API: no renombra campos ni
 * reordena `items`. El orden es el mismo para todos y lo decide el servidor;
 * quien pinta, pinta el índice recibido.
 */
@Injectable({ providedIn: 'root' })
export class MedicalCentersClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /medical-centers/search` — pública. Los procedimientos viajan juntos y
   * separados por coma, en una sola petición.
   */
  search(query: MedicalCenterSearchQuery): Observable<MedicalCenterPage> {
    const ids = uniqueIds(query.procedureConceptIds);
    if (!idsInRange(ids)) {
      return throwError(() => rangeError('procedureConceptIds'));
    }
    let params = new HttpParams().set('procedureConceptIds', ids.join(','));
    params = withCommon(params, query);
    for (const [key, value] of [
      ['specialty', query.specialty],
      ['city', query.city],
    ] as const) {
      if (value !== undefined && value !== '') {
        params = params.set(key, value);
      }
    }
    return this.http.get<MedicalCenterPage>(this.url('/medical-centers/search'), { params });
  }

  /**
   * `GET /medical-centers/search/for-my-orders` — autenticada. La URL lleva
   * solo los ids de las órdenes: ni conceptos ni textos del procedimiento.
   */
  searchForMyOrders(query: MedicalCentersForMyOrdersQuery): Observable<MedicalCenterPage> {
    const ids = uniqueIds(query.serviceRequestIds);
    if (!idsInRange(ids)) {
      return throwError(() => rangeError('serviceRequestIds'));
    }
    const params = withCommon(new HttpParams().set('serviceRequestIds', ids.join(',')), query);
    return this.http.get<MedicalCenterPage>(this.url('/medical-centers/search/for-my-orders'), {
      params,
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}

function idsInRange(ids: readonly string[]): boolean {
  return ids.length >= MIN_IDS && ids.length <= MAX_IDS;
}

function rangeError(field: string): Error {
  return new Error(`${field} necesita de ${MIN_IDS} a ${MAX_IDS} ids sin repetir.`);
}

/**
 * Parámetro a parámetro y nunca con un objeto: el backend valida con
 * `forbidNonWhitelisted`, y un opcional en `undefined` viaja como clave
 * declarada y vuelve 400. `lat` y `lng` salen juntos o no salen.
 */
function withCommon(
  params: HttpParams,
  query: {
    readonly lat?: number;
    readonly lng?: number;
    readonly includePartial: boolean;
    readonly offset?: number;
    readonly limit?: number;
  },
): HttpParams {
  let next = params.set('includePartial', String(query.includePartial));
  if (query.lat !== undefined && query.lng !== undefined) {
    next = next.set('lat', String(query.lat)).set('lng', String(query.lng));
  }
  if (query.offset !== undefined) {
    next = next.set('offset', String(query.offset));
  }
  if (query.limit !== undefined) {
    next = next.set('limit', String(query.limit));
  }
  return next;
}
