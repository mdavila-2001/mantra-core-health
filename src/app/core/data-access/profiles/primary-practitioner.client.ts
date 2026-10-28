import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** El médico de cabecera vigente del paciente. */
export interface PrimaryPractitioner {
  /** Con este id se abre su ficha en la guía (`/directory/:id`). */
  readonly practitionerProfileId: string;
  readonly displayName?: string | null;
  readonly professionalTitle?: string | null;
  /** ISO 8601: desde cuándo es su médico de cabecera. */
  readonly since: string;
}

/**
 * Respuesta de las rutas del paciente. `current` en `null` es «no eligió a
 * nadie»: un estado real, no un error.
 */
export interface OwnPrimaryPractitioner {
  readonly current: PrimaryPractitioner | null;
}

/** Un paciente que eligió al profesional como médico de cabecera. */
export interface PrimaryPatient {
  readonly patientProfileId: string;
  readonly displayName?: string | null;
  readonly patientCode?: string | null;
  /** ISO 8601: desde cuándo lo tiene como médico de cabecera. */
  readonly since: string;
}

/** Página de pacientes de cabecera del profesional de la sesión. */
export interface PrimaryPatientsPage {
  readonly items: readonly PrimaryPatient[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * El médico de cabecera, de los dos lados (API v4.2.64).
 *
 * Todas las rutas son `me`: la API resuelve al paciente y al profesional de la
 * sesión. Elegir o quitar devuelve la elección **releída**, así la pantalla
 * pinta lo que quedó en la base y no lo que creía haber mandado.
 */
@Injectable({ providedIn: 'root' })
export class PrimaryPractitionerClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getOwn(): Observable<OwnPrimaryPractitioner> {
    return this.http.get<OwnPrimaryPractitioner>(this.url('/profiles/patients/me/primary-practitioner'));
  }

  /** Elige (o cambia) el médico de cabecera. Elegir al vigente no cambia nada. */
  setOwn(practitionerProfileId: string): Observable<OwnPrimaryPractitioner> {
    return this.http.put<OwnPrimaryPractitioner>(
      this.url('/profiles/patients/me/primary-practitioner'),
      { practitionerProfileId },
    );
  }

  removeOwn(): Observable<OwnPrimaryPractitioner> {
    return this.http.delete<OwnPrimaryPractitioner>(
      this.url('/profiles/patients/me/primary-practitioner'),
    );
  }

  listOwnPatients(page: { limit?: number; offset?: number } = {}): Observable<PrimaryPatientsPage> {
    let params = new HttpParams();
    if (page.limit !== undefined) params = params.set('limit', page.limit);
    if (page.offset !== undefined) params = params.set('offset', page.offset);
    return this.http.get<PrimaryPatientsPage>(this.url('/profiles/practitioners/me/primary-patients'), {
      params,
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
