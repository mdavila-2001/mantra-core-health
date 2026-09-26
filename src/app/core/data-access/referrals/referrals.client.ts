import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type { MyReferral } from './referrals.types';

/** La fila tal como viaja: instantes y fechas civiles en texto, ausentes en `null`. */
type WireReferral = Omit<MyReferral, 'validUntil' | 'respondedAt' | 'createdAt'> & {
  readonly validUntil: string | null;
  readonly respondedAt: string | null;
  readonly createdAt: string;
};

/**
 * Derivaciones (`clinical_ext`, CV-10).
 *
 * Sólo la lectura del **paciente** vive acá: crear y responder derivaciones es
 * del profesional y no tiene pantalla en este carril.
 */
@Injectable({ providedIn: 'root' })
export class ReferralsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /referrals/me` — «Mis derivaciones».
   *
   * El paciente sale de la cuenta, no de un id que viaje desde acá: por eso no
   * hay parámetros. Sin perfil de paciente la API responde una lista vacía.
   */
  listMine(): Observable<readonly MyReferral[]> {
    return this.http
      .get<readonly ConNulos<WireReferral>[]>(apiUrl(this.baseUrl, '/referrals/me'))
      .pipe(map((filas) => filas.map(aDerivacion)));
  }
}

function aDerivacion(fila: ConNulos<WireReferral>): MyReferral {
  const { validUntil, respondedAt, createdAt, ...resto } = fila;
  const vigencia = maybeDateOnly(validUntil);
  const respuesta = maybeDate(respondedAt);
  return {
    ...sinNulos(resto),
    ...(vigencia === undefined ? {} : { validUntil: vigencia }),
    ...(respuesta === undefined ? {} : { respondedAt: respuesta }),
    createdAt: maybeDate(createdAt) ?? new Date(createdAt as string),
  };
}
