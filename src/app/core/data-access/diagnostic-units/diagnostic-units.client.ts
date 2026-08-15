import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly } from '../wire';
import type {
  DiagnosticUnitDetail,
  DiagnosticUnitDirectory,
  DiagnosticUnitSearchPage,
  DiagnosticUnitSearchQuery,
} from './diagnostic-units.types';

type WireDetail = Omit<DiagnosticUnitDetail, 'equipment' | 'accreditations'> & {
  readonly equipment: readonly (Omit<
    DiagnosticUnitDetail['equipment'][number],
    'lastCalibrationAt' | 'nextCalibrationDueAt'
  > & {
    readonly lastCalibrationAt: string | null;
    readonly nextCalibrationDueAt: string | null;
  })[];
  readonly accreditations: readonly (Omit<
    DiagnosticUnitDetail['accreditations'][number],
    'validFrom' | 'validTo'
  > & {
    readonly validFrom: string | null;
    readonly validTo: string | null;
  })[];
};

/** Cliente exclusivo del directorio de unidades diagnósticas (módulo 23). */
@Injectable({ providedIn: 'root' })
export class DiagnosticUnitsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /diagnostic-units` — unidades visibles del tenant activo. */
  list(): Observable<DiagnosticUnitDirectory> {
    return this.http.get<DiagnosticUnitDirectory>(this.url('/diagnostic-units'));
  }

  /**
   * `GET /diagnostic-units/search` — el buscador del paciente.
   *
   * A diferencia de {@link list}, **no** se acota a la organización de la
   * sesión: quien busca dónde hacerse un estudio busca en la ciudad, no en su
   * institución. El filtro por organización sigue existiendo (`tenantId`) para
   * quien sí quiere acotarlo.
   *
   * @param query - Los filtros cargados. Sin ninguno, lista todo lo publicado.
   * @returns La página de centros, con su total para paginar.
   */
  search(query: DiagnosticUnitSearchQuery = {}): Observable<DiagnosticUnitSearchPage> {
    // Parámetro a parámetro y nunca con un objeto: el backend valida con
    // `forbidNonWhitelisted` y un opcional en `undefined` viaja como clave
    // declarada y vuelve 400.
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === '') {
        continue;
      }
      params = params.set(clave, String(valor));
    }
    return this.http.get<DiagnosticUnitSearchPage>(this.url('/diagnostic-units/search'), {
      params,
    });
  }

  /** `GET /diagnostic-units/:id` — perfil, también acotado por el servidor. */
  getById(id: string): Observable<DiagnosticUnitDetail> {
    return this.http
      .get<WireDetail>(this.url(`/diagnostic-units/${encodeURIComponent(id)}`))
      .pipe(map(toDetail));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function toDetail(body: WireDetail): DiagnosticUnitDetail {
  return {
    ...body,
    equipment: body.equipment.map((item) => ({
      ...item,
      lastCalibrationAt: maybeDate(item.lastCalibrationAt) ?? null,
      nextCalibrationDueAt: maybeDate(item.nextCalibrationDueAt) ?? null,
    })),
    accreditations: body.accreditations.map((item) => ({
      ...item,
      validFrom: maybeDateOnly(item.validFrom) ?? null,
      validTo: maybeDateOnly(item.validTo) ?? null,
    })),
  };
}
