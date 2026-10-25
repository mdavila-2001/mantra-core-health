import { HttpClient } from '@angular/common/http';
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

interface WireAssignment {
  readonly practiceSiteId?: string | null;
  readonly serviceConceptId?: string | null;
  readonly statusCode?: string | null;
}

/**
 * Las vinculaciones del médico, para el selector de ejecutor de la orden.
 *
 * Es un cliente **mínimo y provisional**: lee sólo lo que el selector usa de
 * `GET /practitioners/me/role-assignments` (el procedimiento y el estado de cada
 * vinculación, con su sede). Cuando exista el cliente completo de afiliaciones
 * (`practice-sites`), el selector pasa a usarlo y este archivo se borra. La
 * búsqueda de centros sale de `MedicalCentersClient`.
 */
@Injectable({ providedIn: 'root' })
export class PerformerAssignmentsClient {
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
}
