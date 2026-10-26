import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { RegisteredOrganization } from './iam.types';

/**
 * Los tipos de **organización médica** que el alta pública deja elegir.
 *
 * Son los cinco tipos institucionales de salud de `register-organization`, en
 * el orden en que la pantalla los ofrece. No son un catálogo propio del front:
 * la API los declara (`@IsIn(TENANT_TYPE_CODES)`) y resuelve cada código a su
 * concepto. La pantalla igual lee el catálogo `tenant-type` y ofrece sólo los
 * que la API publica (ver `medicalOrganizationTypeOptions`); esta lista fija el
 * orden, el subconjunto y el tipo que el compilador controla.
 *
 * `CLINIC` llega con la API que lo agrega al DTO y al catálogo; mientras una
 * API no lo publique, la pantalla no lo ofrece.
 */
export const MEDICAL_ORGANIZATION_TYPES = [
  'HOSPITAL',
  'CLINIC',
  'MEDICAL_OFFICE',
  'NURSING',
  'HEALTH_OTHER',
] as const;

/** Un tipo de organización médica: lo que viaja en `tenantType`. */
export type MedicalOrganizationType = (typeof MEDICAL_ORGANIZATION_TYPES)[number];

/** Si un código es uno de los tipos de organización médica. */
export function isMedicalOrganizationType(code: string): code is MedicalOrganizationType {
  return (MEDICAL_ORGANIZATION_TYPES as readonly string[]).includes(code);
}

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
