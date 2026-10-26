import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { MedicalOrganizationType } from '../directory/directory.types';
import type { RegisteredOrganization } from './iam.types';

/** Lo que pide el alta de una organización médica. */
export interface MedicalCenterRegistration {
  readonly code: string;
  /** El tipo de institución que eligió quien la registra. */
  readonly tenantType: MedicalOrganizationType;
  readonly legalName: string;
  readonly legalEntityType: string;
  readonly tradeName?: string;
  /** Concept id del país: los cinco tipos son territoriales y la API lo exige. */
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
 * Alta pública de una organización médica (`POST /iam/auth/register-organization`).
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
          tenantType: registration.tenantType,
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
