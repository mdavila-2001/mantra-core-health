import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type { MyCoverage } from './patient-coverage.types';

/** La fila tal como viaja. `status` es el concepto de estado (la API lo llama así). */
type WireCoverage = Omit<
  MyCoverage,
  'effectiveFrom' | 'effectiveTo' | 'createdAt' | 'statusConceptId'
> & {
  readonly status: string;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly createdAt: string;
};

/**
 * Cobertura del paciente (`insurance`, CV-11).
 *
 * Sólo lectura, sólo la propia. Registrar una cobertura sigue siendo de
 * `BILLING`/`FINANCE` (decisión D-BR29-2 de H6): no se abre al titular.
 */
@Injectable({ providedIn: 'root' })
export class PatientCoverageClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /patient-coverages/me` — sin parámetros: la persona sale de la cuenta. */
  listMine(): Observable<readonly MyCoverage[]> {
    return this.http
      .get<readonly ConNulos<WireCoverage>[]>(apiUrl(this.baseUrl, '/patient-coverages/me'))
      .pipe(map((filas) => filas.map(aCobertura)));
  }
}

function aCobertura(fila: ConNulos<WireCoverage>): MyCoverage {
  const { status, effectiveFrom, effectiveTo, createdAt, ...resto } = fila;
  const desde = maybeDateOnly(effectiveFrom);
  const hasta = maybeDateOnly(effectiveTo);
  return {
    ...sinNulos(resto),
    statusConceptId: status as string,
    ...(desde === undefined ? {} : { effectiveFrom: desde }),
    ...(hasta === undefined ? {} : { effectiveTo: hasta }),
    createdAt: maybeDate(createdAt) ?? new Date(createdAt as string),
  } as MyCoverage;
}
