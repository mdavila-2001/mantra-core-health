import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  ContextoReporte,
  PestanaReporte,
  ReporteCatalogo,
  VerticalReporte,
} from './reporting.types';

/**
 * Cliente del portal de reportería.
 *
 * **MAQUETA:** estas dos rutas las sirve `reporting.handlers.ts` con datos de
 * EJEMPLO. La API real (plan `docs/trabajo/2026-10-30-reporteria-comercial-alovida`,
 * H0–H2) expondrá `GET /reporting/catalog` y la consulta declarativa
 * `POST /reporting/query`; cuando exista, se cambia aquí y los tipos son el
 * contrato a cumplir. Las pantallas no cambian.
 */
@Injectable({ providedIn: 'root' })
export class ReportingClient {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  catalogo(): Observable<readonly ReporteCatalogo[]> {
    return this.http.get<readonly ReporteCatalogo[]>(apiUrl(this.base, '/reporting/catalog'));
  }

  pestana(pestana: VerticalReporte, contexto: ContextoReporte): Observable<PestanaReporte> {
    return this.http.post<PestanaReporte>(
      apiUrl(this.base, `/reporting/commercial/${pestana}`),
      contexto,
    );
  }
}
