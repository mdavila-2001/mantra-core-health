import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** Qué es cada dirección: el domicilio, el trabajo, o una que guardó la persona. */
export type PatientAddressKind = 'HOME' | 'WORK' | 'SAVED';

/**
 * Una dirección de la libreta del paciente (`/profiles/patients/me/addresses`).
 *
 * Los campos opcionales llegan **ausentes**, no `null`. La preferida es la que
 * se ofrece primero; si la persona no marcó ninguna, es el domicilio.
 */
export interface PatientAddress {
  readonly id: string;
  readonly kind: PatientAddressKind;
  /** «Casa», «Trabajo», o el nombre que le puso la persona. */
  readonly label: string;
  readonly lines?: string;
  readonly city?: string;
  readonly municipalityConceptId?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly isPreferred: boolean;
}

/** Guardar una dirección nueva. */
export interface NewPatientAddress {
  readonly label: string;
  readonly municipalityConceptId: string;
  readonly lines?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly isPreferred?: boolean;
}

/** Corregir una dirección: lo que no viene, no cambia. */
export type PatientAddressChanges = Partial<Omit<NewPatientAddress, 'isPreferred'>>;

/**
 * La libreta de direcciones del propio paciente: las ubicaciones que guarda
 * para los envíos, «como en una app de pedidos» (pedido del cliente del
 * 26/10/2026).
 *
 * Toda escritura devuelve la libreta **releída y ordenada** (la preferida
 * primero), así la pantalla pinta lo que quedó en la base y no lo que creía
 * haber mandado.
 */
@Injectable({ providedIn: 'root' })
export class PatientAddressBookClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<readonly PatientAddress[]> {
    return this.http.get<readonly PatientAddress[]>(this.url('/profiles/patients/me/addresses'));
  }

  create(address: NewPatientAddress): Observable<readonly PatientAddress[]> {
    return this.http.post<readonly PatientAddress[]>(
      this.url('/profiles/patients/me/addresses'),
      address,
    );
  }

  update(id: string, changes: PatientAddressChanges): Observable<readonly PatientAddress[]> {
    return this.http.patch<readonly PatientAddress[]>(
      this.url(`/profiles/patients/me/addresses/${encodeURIComponent(id)}`),
      changes,
    );
  }

  remove(id: string): Observable<readonly PatientAddress[]> {
    return this.http.delete<readonly PatientAddress[]>(
      this.url(`/profiles/patients/me/addresses/${encodeURIComponent(id)}`),
    );
  }

  prefer(id: string): Observable<readonly PatientAddress[]> {
    return this.http.put<readonly PatientAddress[]>(
      this.url(`/profiles/patients/me/addresses/${encodeURIComponent(id)}/preferred`),
      {},
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
