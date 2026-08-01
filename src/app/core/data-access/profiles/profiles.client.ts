import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccountLink,
  NewPatientProfile,
  NewPractitionerProfile,
  PatientProfile,
  PractitionerProfile,
} from './profiles.types';

/** Las mismas respuestas, con las fechas como viajan: texto. */
type Wire<T> = { readonly [K in keyof T]: T[K] extends Date ? string : T[K] };

/**
 * Cliente de `profiles`: personas, pacientes y profesionales.
 *
 * El alta es atómica del lado del servidor (regla CTI del modelo: `persons →
 * person_profiles → *_profiles` en una sola transacción), así que acá alcanza
 * con una petición: nunca hay que crear la persona por separado.
 */
@Injectable({
  providedIn: 'root',
})
export class ProfilesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /profiles/patients`. */
  createPatient(profile: NewPatientProfile): Observable<PatientProfile> {
    return this.http
      .post<Wire<PatientProfile>>(this.url('/profiles/patients'), stripUndefined(profile))
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  /** `POST /profiles/practitioners`. */
  createPractitioner(profile: NewPractitionerProfile): Observable<PractitionerProfile> {
    return this.http
      .post<Wire<PractitionerProfile>>(this.url('/profiles/practitioners'), stripUndefined(profile))
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  /**
   * `POST /profiles/persons/:personId/account-links`. Ata una cuenta de acceso
   * a una persona ya registrada.
   */
  linkAccount(personId: string, userId: string, linkTypeConceptId?: string): Observable<AccountLink> {
    return this.http
      .post<Wire<AccountLink>>(this.url(`/profiles/persons/${personId}/account-links`), {
        userId,
        ...(linkTypeConceptId === undefined ? {} : { linkTypeConceptId }),
      })
      .pipe(map((body) => ({ ...body, validFrom: new Date(body.validFrom) })));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * Quita las claves sin valor antes de enviar. El backend valida con
 * `forbidNonWhitelisted`, y un opcional presente en `undefined` viaja como
 * clave declarada: mejor no mandarla.
 */
function stripUndefined<T extends object>(source: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined),
  );
}
