import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  StudyCatalogDetail,
  StudyCatalogPage,
  StudyCatalogQuery,
} from './study-catalog.types';

/**
 * Cliente del catálogo de estudios pedibles (C1 y C2). Lectura sin PHI; la
 * pueden usar quienes piden estudios.
 *
 * `listAll` NO existe a propósito: el catálogo trae cientos de análisis y se
 * pagina por cursor (`nextCursor`) con búsqueda en el servidor.
 */
@Injectable({
  providedIn: 'root',
})
export class StudyCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /clinical/study-catalog` — una página del catálogo, en orden
   * alfabético sin tildes. Los parámetros vacíos no viajan: la API valida con
   * `forbidNonWhitelisted` y rechaza un `q=` o un `limit` vacío.
   */
  list(query: StudyCatalogQuery = {}): Observable<StudyCatalogPage> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params = params.set(clave, String(valor));
    }
    return this.http.get<StudyCatalogPage>(apiUrl(this.baseUrl, '/clinical/study-catalog'), {
      params,
    });
  }

  /**
   * `GET /clinical/study-catalog/:conceptId` — componentes anidados, muestra
   * sugerida, modalidades, regiones, lateralidad y contraste del estudio. 404
   * si el concepto no es un estudio del catálogo.
   */
  detail(conceptId: string): Observable<StudyCatalogDetail> {
    return this.http.get<StudyCatalogDetail>(
      apiUrl(this.baseUrl, `/clinical/study-catalog/${encodeURIComponent(conceptId)}`),
    );
  }
}
