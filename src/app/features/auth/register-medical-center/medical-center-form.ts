import { FormControl, FormGroup, Validators, type ValidatorFn } from '@angular/forms';

import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import {
  MAX_MEDICAL_FACILITY_BRANCHES,
  PROFESSIONAL_LICENSE_MAX,
  PROFESSIONAL_LICENSE_MIN,
} from '../../../core/data-access/iam/medical-facility.rules';
import { executivesControls } from '../shared-registration/executives';
import type { Coordinates } from '../shared-registration/map-location-picker/map-location-picker';
import { nameGroup } from '../shared-registration/name-fields/person-name';
import { passwordValidators } from '../shared-registration/password-policy';
import {
  sucursalesCompletas,
  type SucursalDeclarada,
} from '../shared-registration/branches-editor/branches-editor';
import { nitValido, registroDeEstablecimientoValido } from './medical-center-rules';

export const MAX_LEGAL_NAME = 300;
export const MAX_EMAIL = 320;
export const MAX_ADDRESS = 300;
const MAX_ID_NUMBER = 50;
const MIN_ID_NUMBER = 4;

/** Las claves de los controles de papeles (su valor es el `fileId` de la pre-carga). */
export const CLAVES_DE_PAPELES = [
  'constitutionFileId',
  'taxIdentifierFileId',
  'commerceRegistryFileId',
  'operatingLicenseFileId',
  'healthAuthorityCertificateFileId',
  'powerOfAttorneyFileId',
] as const;

/**
 * El formulario del alta de una organización médica, en el orden de sus páginas.
 *
 * @param tipoOfrecido - Valida que el tipo de institución siga entre las
 *   opciones vigentes (ver `entreLasOpciones`).
 */
export function createMedicalCenterForm(tipoOfrecido: ValidatorFn) {
  const papel = () => new FormControl('', { nonNullable: true, validators: [Validators.required] });
  return new FormGroup({
    // --- la organización -----------------------------------------------------
    tenantType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, tipoOfrecido],
    }),
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_LEGAL_NAME)],
    }),
    legalEntityType: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    taxId: new FormControl('', { nonNullable: true, validators: [Validators.required, nitValido] }),
    // --- el establecimiento y su director médico -----------------------------
    healthFacilityRegistrationNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, registroDeEstablecimientoValido],
    }),
    medicalDirectorName: nameGroup(true),
    medicalDirectorLicense: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(PROFESSIONAL_LICENSE_MIN),
        Validators.maxLength(PROFESSIONAL_LICENSE_MAX),
      ],
    }),
    medicalDirectorEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL)],
    }),
    medicalDirectorPhone: new FormControl('', { nonNullable: true, validators: [telefonoCompleto] }),
    // --- los papeles: guardan el `fileId` de la pre-carga, no el archivo -----
    // Los cinco de la empresa son obligatorios; la escritura y la matrícula
    // dejan de serlo según el tipo societario (ver `exigirDocumentos`). El
    // poder, igual: sólo una unipersonal lo omite.
    constitutionFileId: papel(),
    taxIdentifierFileId: papel(),
    commerceRegistryFileId: papel(),
    operatingLicenseFileId: papel(),
    healthAuthorityCertificateFileId: papel(),
    powerOfAttorneyFileId: papel(),
    // --- la casa central -----------------------------------------------------
    // La dirección no se escribe: la deduce el punto. Sigue obligatoria porque
    // la API la exige, y nunca queda vacía con un punto puesto.
    addressLines: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_ADDRESS)],
    }),
    // El punto es obligatorio. Vive en el formulario porque el motor valida de a
    // una página y sólo frena lo que está en el `FormGroup`.
    gpsCentral: new FormControl<Coordinates | null>(null, { validators: [Validators.required] }),
    // --- las sucursales (opcionales; las que se agregan, completas) ----------
    sucursales: new FormControl<readonly SucursalDeclarada[]>([], {
      nonNullable: true,
      validators: [sucursalesCompletas(MAX_MEDICAL_FACILITY_BRANCHES)],
    }),
    // --- el representante legal (también es el dueño de la cuenta) -----------
    legalRepName: nameGroup(true),
    legalRepIdNumber: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_ID_NUMBER),
        Validators.maxLength(MAX_ID_NUMBER),
      ],
    }),
    legalRepEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(MAX_EMAIL)],
    }),
    legalRepPhone: new FormControl('', { nonNullable: true, validators: [telefonoCompleto] }),
    // --- las tres gerencias, todas opcionales ---------------------------------
    ...executivesControls(),
    // --- la cuenta -----------------------------------------------------------
    password: new FormControl('', { nonNullable: true, validators: [...passwordValidators] }),
  });
}

export type MedicalCenterForm = ReturnType<typeof createMedicalCenterForm>;
