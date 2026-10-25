import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { RegisteredOrganization } from './iam.types';

/**
 * El tipo de organización con el que se registra un centro médico.
 *
 * No hay un tipo nuevo en IAM: un centro médico entra como `HOSPITAL`, uno de
 * los cuatro tipos de salud institucionales que la API ya acepta. Está acá, en
 * un solo lugar, para que cambiarlo (si el propietario pide otro) no obligue a
 * tocar la pantalla.
 */
export const MEDICAL_CENTER_TENANT_TYPE = 'HOSPITAL';

/** Lo que pide el alta de un centro médico. */
export interface MedicalCenterRegistration {
  readonly code: string;
  readonly legalName: string;
  readonly legalEntityType: string;
  readonly tradeName?: string;
  /** Concept id del país: `HOSPITAL` es un tipo territorial y la API lo exige. */
  readonly countryConceptId: string;
  /** Concept id de la jurisdicción: ver `countryConceptId`. */
  readonly jurisdictionConceptId: string;
  readonly owner: {
    readonly email: string;
    readonly password: string;
    readonly displayName: string;
  };
}

/**
 * Alta pública de un centro médico (`POST /iam/auth/register-organization`).
 *
 * Es un cliente aparte y no un método más de `IamClient` porque ese archivo ya
 * está por encima del tope de líneas del repo y no puede crecer. El cuerpo se
 * arma campo por campo: la API rechaza con 400 toda clave que su DTO no declare.
 *
 * La organización nace **pendiente de verificación**. Hasta que la plataforma
 * la verifique no puede abrir su práctica (`PracticeOnboardingClient`).
 */
@Injectable({
  providedIn: 'root',
})
export class MedicalCenterRegistrationClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  register(registration: MedicalCenterRegistration): Observable<RegisteredOrganization> {
    return this.http.post<RegisteredOrganization>(
      apiUrl(this.baseUrl, '/iam/auth/register-organization'),
      {
        organization: {
          code: registration.code,
          legalName: registration.legalName,
          legalEntityType: registration.legalEntityType,
          ...(registration.tradeName === undefined ? {} : { tradeName: registration.tradeName }),
          tenantType: MEDICAL_CENTER_TENANT_TYPE,
          countryConceptId: registration.countryConceptId,
          jurisdictionConceptId: registration.jurisdictionConceptId,
        },
        owner: {
          email: registration.owner.email,
          password: registration.owner.password,
          displayName: registration.owner.displayName,
        },
      },
    );
  }
}
