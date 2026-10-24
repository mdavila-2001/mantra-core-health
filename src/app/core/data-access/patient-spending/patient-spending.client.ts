import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { PatientSpendingResponseDto } from './patient-spending.dto';

/**
 * Los gastos de salud del paciente (P43 — sólo en el backend simulado).
 *
 * Una sola lectura: `GET /patient-spending/me?from=&to=`. El titular sale del
 * token; lo único que viaja en la URL es el rango de fechas.
 */
@Injectable({ providedIn: 'root' })
export class PatientSpendingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Los movimientos entre `from` y `to` (`YYYY-MM-DD`, ambos inclusive). */
  listMine(from: string, to: string): Observable<PatientSpendingResponseDto> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<PatientSpendingResponseDto>(
      apiUrl(this.baseUrl, '/patient-spending/me'),
      { params },
    );
  }
}
