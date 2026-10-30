import type { MedicalCenterRegistration } from '../../../core/data-access/iam/medical-center-registration.client';
import type { MedicalOrganizationType } from '../../../core/data-access/directory/directory.types';
import { DEFAULT_HEADQUARTERS_NAME } from '../../../core/data-access/iam/medical-facility.rules';
import type { MedicalFacilitySite } from '../../../core/data-access/iam/medical-facility.types';
import type { SucursalDeclarada } from '../shared-registration/branches-editor/branches-editor';
import { executivesFrom, type ExecutivesRaw } from '../shared-registration/executives';
import type { Coordinates } from '../shared-registration/map-location-picker/map-location-picker';
import { completeName, nameParts, type NameValue } from '../shared-registration/name-fields/person-name';
import { medicalCenterCodeFromName } from './medical-center-code';

/** La zona horaria del alta pública: Bolivia. */
export const TIME_ZONE = 'America/La_Paz';

/** Lo que el cuerpo necesita del formulario (`getRawValue()`), tipado a mano para no atarse a su forma exacta. */
export interface MedicalCenterRaw extends ExecutivesRaw {
  readonly legalName: string;
  readonly legalEntityType: string;
  readonly taxId: string;
  readonly healthFacilityRegistrationNumber: string;
  readonly medicalDirectorName: NameValue;
  readonly medicalDirectorLicense: string;
  readonly medicalDirectorEmail: string;
  readonly medicalDirectorPhone: string;
  readonly constitutionFileId: string;
  readonly taxIdentifierFileId: string;
  readonly commerceRegistryFileId: string;
  readonly operatingLicenseFileId: string;
  readonly healthAuthorityCertificateFileId: string;
  readonly powerOfAttorneyFileId: string;
  readonly addressLines: string;
  readonly sucursales: readonly SucursalDeclarada[];
  readonly legalRepName: NameValue;
  readonly legalRepIdNumber: string;
  readonly legalRepEmail: string;
  readonly legalRepPhone: string;
  readonly password: string;
}

/** Un `fileId` opcional: vacío no viaja (no es un uuid). */
const ifPresent = <K extends string>(clave: K, valor: string): Partial<Record<K, string>> =>
  valor === '' ? {} : ({ [clave]: valor } as Partial<Record<K, string>>);

/** Un punto con sus coordenadas, que viajan ambas o ninguna. */
function sitio(nombre: string, direccion: string, gps: Coordinates | null): MedicalFacilitySite {
  return {
    name: nombre,
    addressLines: [direccion],
    ...(gps === null ? {} : { latitude: gps.lat, longitude: gps.lng }),
  };
}

/**
 * El cuerpo del alta de una organización médica, con los ids de catálogo ya
 * resueltos.
 *
 * - **El owner es el representante legal**: su nombre en partes y su correo son
 *   la cuenta, y viajan además como `legalRepresentative`, que es el vínculo
 *   legal. No se piden dos veces.
 * - **Las gerencias son un bloque de a tres**: con menos, la API lo rechaza
 *   entero, así que viajan sólo si están las tres completas (la pantalla frena
 *   antes un bloque a medias, ver `executivesIncomplete`).
 * - **El código** sale de la razón social.
 */
export function medicalCenterBody(
  tipo: MedicalOrganizationType,
  raw: MedicalCenterRaw,
  gpsCentral: Coordinates | null,
  ids: { readonly pais: string; readonly jurisdiccion: string },
): MedicalCenterRegistration {
  const representante = nameParts(raw.legalRepName);
  const director = nameParts(raw.medicalDirectorName);
  const telefonoRepresentante = raw.legalRepPhone.trim();
  const telefonoDirector = raw.medicalDirectorPhone.trim();
  const gerencias = executivesFrom(raw);
  const sucursales = raw.sucursales.map((s) => sitio(s.nombre.trim(), s.direccion.trim(), s.gps));
  const legalRepresentative = {
    fullName: completeName(raw.legalRepName),
    idNumber: raw.legalRepIdNumber.trim(),
    email: raw.legalRepEmail.trim(),
    ...(telefonoRepresentante === '' ? {} : { phone: telefonoRepresentante }),
    ...ifPresent('powerOfAttorneyFileId', raw.powerOfAttorneyFileId),
  };

  return {
    code: medicalCenterCodeFromName(raw.legalName),
    tenantType: tipo,
    legalName: raw.legalName.trim(),
    legalEntityType: raw.legalEntityType,
    timeZone: TIME_ZONE,
    legalDocuments: {
      // Los opcionales que no se subieron no viajan: la API los omite sólo si el
      // tipo societario lo permite, y un '' no es un uuid.
      ...ifPresent('constitutionFileId', raw.constitutionFileId),
      taxIdentifierFileId: raw.taxIdentifierFileId,
      ...ifPresent('commerceRegistryFileId', raw.commerceRegistryFileId),
      operatingLicenseFileId: raw.operatingLicenseFileId,
      healthAuthorityCertificateFileId: raw.healthAuthorityCertificateFileId,
    },
    countryConceptId: ids.pais,
    jurisdictionConceptId: ids.jurisdiccion,
    owner: {
      email: raw.legalRepEmail.trim(),
      password: raw.password,
      ...representante,
    },
    legalRepresentative,
    ...(gerencias === null ? {} : { executives: gerencias }),
    medicalFacility: {
      taxIdentifierNumber: raw.taxId.trim(),
      healthFacilityRegistrationNumber: raw.healthFacilityRegistrationNumber.trim(),
      medicalDirector: {
        ...director,
        professionalLicenseNumber: raw.medicalDirectorLicense.trim(),
        email: raw.medicalDirectorEmail.trim(),
        ...(telefonoDirector === '' ? {} : { phone: telefonoDirector }),
      },
      headquarters: sitio(DEFAULT_HEADQUARTERS_NAME, raw.addressLines.trim(), gpsCentral),
      ...(sucursales.length === 0 ? {} : { branches: sucursales }),
    },
  };
}
