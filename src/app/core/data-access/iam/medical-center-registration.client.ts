import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { MedicalOrganizationType } from '../directory/directory.types';
import type {
  OrganizationExecutives,
  OrganizationLegalRepresentative,
  RegisteredOrganization,
} from './iam.types';
import type {
  MedicalFacility,
  MedicalFacilityHeadquarters,
  MedicalFacilitySite,
} from './medical-facility.types';

/** Lo que pide el alta de una organización médica. */
export interface MedicalCenterRegistration {
  readonly code: string;
  /** El tipo de institución que eligió quien la registra. */
  readonly tenantType: MedicalOrganizationType;
  readonly legalName: string;
  readonly legalEntityType: string;
  readonly tradeName?: string;
  /**
   * Los papeles de la empresa, por el `fileId` de su pre-carga. La escritura y
   * la matrícula faltan sólo si el tipo societario las permite omitir.
   */
  readonly legalDocuments: {
    readonly constitutionFileId?: string;
    readonly taxIdentifierFileId: string;
    readonly commerceRegistryFileId?: string;
    readonly operatingLicenseFileId: string;
    readonly healthAuthorityCertificateFileId: string;
  };
  /** Concept id del país: los cinco tipos son territoriales y la API lo exige. */
  readonly countryConceptId: string;
  /** Concept id de la jurisdicción: ver `countryConceptId`. */
  readonly jurisdictionConceptId: string;
  /** La zona horaria de la organización (`America/La_Paz` en el alta pública). */
  readonly timeZone?: string;
  /**
   * La cuenta dueña, con el nombre en partes (la misma forma del alta de
   * aseguradora): `name` y `lastName` son obligatorios; el segundo nombre y el
   * apellido materno, sólo si la persona los tiene.
   */
  readonly owner: {
    readonly email: string;
    readonly password: string;
    readonly name: string;
    readonly middleName?: string;
    readonly lastName: string;
    readonly motherLastName?: string;
  };
  /**
   * El representante legal y su poder. El poder lo exige la API salvo a una
   * empresa unipersonal, así que acá es opcional.
   */
  readonly legalRepresentative?: Omit<OrganizationLegalRepresentative, 'powerOfAttorneyFileId'> & {
    readonly powerOfAttorneyFileId?: string;
  };
  /** Las tres gerencias: un bloque de a tres, o ninguna. */
  readonly executives?: OrganizationExecutives;
  /**
   * El bloque propio de un establecimiento de salud: NIT, número de registro
   * ante la autoridad sanitaria, director médico y direcciones. Aditivo en el
   * contrato; lo obligatorio lo impone el formulario.
   */
  readonly medicalFacility?: MedicalFacility;
}

/**
 * El bloque `medicalFacility`, campo por campo: la API rechaza con 400 toda
 * clave que su DTO no declare, y las coordenadas viajan ambas o ninguna.
 */
function cuerpoDeEstablecimiento(facility: MedicalFacility): unknown {
  const sitio = (s: MedicalFacilitySite | MedicalFacilityHeadquarters) => ({
    ...(s.name === undefined ? {} : { name: s.name }),
    addressLines: [...s.addressLines],
    ...(s.latitude === undefined || s.longitude === undefined
      ? {}
      : { latitude: s.latitude, longitude: s.longitude }),
  });
  const { medicalDirector: d } = facility;
  return {
    taxIdentifierNumber: facility.taxIdentifierNumber,
    healthFacilityRegistrationNumber: facility.healthFacilityRegistrationNumber,
    medicalDirector: {
      name: d.name,
      ...(d.middleName === undefined ? {} : { middleName: d.middleName }),
      lastName: d.lastName,
      ...(d.motherLastName === undefined ? {} : { motherLastName: d.motherLastName }),
      professionalLicenseNumber: d.professionalLicenseNumber,
      email: d.email,
      ...(d.phone === undefined ? {} : { phone: d.phone }),
    },
    // Opcional en el contrato (la API pone «Casa central»): sin ella no viaja la clave.
    ...(facility.headquarters === undefined ? {} : { headquarters: sitio(facility.headquarters) }),
    // Sin sucursales no viaja la clave: es opcional, y `[]` no dice nada que
    // su ausencia no diga.
    ...(facility.branches === undefined || facility.branches.length === 0
      ? {}
      : { branches: facility.branches.map(sitio) }),
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
          legalDocuments: {
            ...(registration.legalDocuments.constitutionFileId === undefined
              ? {}
              : { constitutionFileId: registration.legalDocuments.constitutionFileId }),
            taxIdentifierFileId: registration.legalDocuments.taxIdentifierFileId,
            ...(registration.legalDocuments.commerceRegistryFileId === undefined
              ? {}
              : { commerceRegistryFileId: registration.legalDocuments.commerceRegistryFileId }),
            operatingLicenseFileId: registration.legalDocuments.operatingLicenseFileId,
            healthAuthorityCertificateFileId: registration.legalDocuments.healthAuthorityCertificateFileId,
          },
          countryConceptId: registration.countryConceptId,
          jurisdictionConceptId: registration.jurisdictionConceptId,
          ...(registration.timeZone === undefined ? {} : { timeZone: registration.timeZone }),
          ...(registration.legalRepresentative === undefined
            ? {}
            : { legalRepresentative: registration.legalRepresentative }),
          ...(registration.executives === undefined ? {} : { executives: registration.executives }),
          ...(registration.medicalFacility === undefined
            ? {}
            : { medicalFacility: cuerpoDeEstablecimiento(registration.medicalFacility) }),
        },
        owner: {
          email: registration.owner.email,
          password: registration.owner.password,
          name: registration.owner.name,
          ...(registration.owner.middleName === undefined
            ? {}
            : { middleName: registration.owner.middleName }),
          lastName: registration.owner.lastName,
          ...(registration.owner.motherLastName === undefined
            ? {}
            : { motherLastName: registration.owner.motherLastName }),
        },
      },
    );
  }
}
