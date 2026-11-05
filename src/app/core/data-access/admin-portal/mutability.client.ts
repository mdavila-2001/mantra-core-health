import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type {
  MutabilityDetail,
  MutabilityPage,
  MutabilityQuery,
  MutabilitySummary,
} from './mutability.types';

/**
 * Cliente del gobierno de mutabilidad. Sólo lectura: registrar o cambiar una política de
 * escritura es otra superficie. La API es la autoridad: si la sesión no puede leer, responde
 * 403 y la pantalla lo dice; ocultar el menú no es seguridad.
 */
@Injectable({ providedIn: 'root' })
export class MutabilityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(query: MutabilityQuery = {}): Observable<MutabilityPage> {
    return this.http.get<MutabilityPage>(apiUrl(this.baseUrl, '/admin/governance/mutability'), {
      params: queryParams({ ...query }),
    });
  }

  summary(): Observable<MutabilitySummary> {
    return this.http.get<MutabilitySummary>(
      apiUrl(this.baseUrl, '/admin/governance/mutability/summary'),
    );
  }

  detail(schema: string, table: string): Observable<MutabilityDetail> {
    return this.http.get<MutabilityDetail>(
      apiUrl(
        this.baseUrl,
        `/admin/governance/mutability/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`,
      ),
    );
  }
}
