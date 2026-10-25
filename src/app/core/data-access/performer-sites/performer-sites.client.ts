import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** Una vinculación del médico, con los campos que el selector de ejecutor necesita. */
export interface PerformerAssignment {
  readonly practiceSiteId: string | null;
  readonly serviceConceptId: string | null;
  /** Código del concepto de estado (`ROLE_ASG_ACTIVE`, con o sin prefijo). */
  readonly statusCode: string;
}

/** Una sede que publica el procedimiento con precio, tal como la devuelve la búsqueda. */
export interface PerformerCenterSite {
  readonly practiceSiteId: string;
  readonly name: string;
  readonly addressText: string | null;
}

interface WireAssignment {
  readonly practiceSiteId?: string | null;
  readonly serviceConceptId?: string | null;
  readonly statusCode?: string | null;
}

interface WireCenter {
  readonly practiceSiteId: string;
  readonly name: string;
  readonly addressText?: string | null;
}

/**
 * Las dos lecturas de sedes del selector de ejecutor de la orden.
 *
 * Es un cliente **mínimo y provisional**: lee sólo lo que el selector usa de
 * `GET /practitioners/me/role-assignments` (las vinculaciones del médico, con su
 * procedimiento y su estado) y de `GET /medical-centers/search` (las sedes que
 * publican el procedimiento con precio). Cuando existan los clientes completos
 * de afiliaciones (`practice-sites`) y de búsqueda de centros, el selector pasa
 * a usarlos y este archivo se borra.
 */
@Injectable({ providedIn: 'root' })
export class PerformerSitesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /practitioners/me/role-assignments`: las vinculaciones del médico, en cualquier estado. */
  readOwnAssignments(): Observable<readonly PerformerAssignment[]> {
    return this.http
      .get<readonly WireAssignment[] | { readonly items: readonly WireAssignment[] }>(
        apiUrl(this.baseUrl, '/practitioners/me/role-assignments'),
      )
      .pipe(
        map((body) => (Array.isArray(body) ? body : (body as { items: readonly WireAssignment[] }).items)),
        map((rows) =>
          rows.map((row) => ({
            practiceSiteId: row.practiceSiteId ?? null,
            serviceConceptId: row.serviceConceptId ?? null,
            statusCode: row.statusCode ?? '',
          })),
        ),
      );
  }

  /**
   * `GET /medical-centers/search?procedureConceptIds=<concepto>`: las sedes que
   * publican el procedimiento con precio, **en el orden que decide la API**.
   */
  searchSites(procedureConceptId: string): Observable<readonly PerformerCenterSite[]> {
    return this.http
      .get<{ readonly items: readonly WireCenter[] }>(apiUrl(this.baseUrl, '/medical-centers/search'), {
        params: new HttpParams().set('procedureConceptIds', procedureConceptId),
      })
      .pipe(
        map((page) =>
          page.items.map((item) => ({
            practiceSiteId: item.practiceSiteId,
            name: item.name,
            addressText: item.addressText ?? null,
          })),
        ),
      );
  }
}
