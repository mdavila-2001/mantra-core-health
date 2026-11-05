import type { NameValue } from '../shared-registration/name-fields/person-name';
import { medicalCenterBody, type MedicalCenterRaw } from './medical-center-body';

const NOMBRE: NameValue = {
  name: 'Ana',
  middleName: '',
  thirdName: '',
  extraNames: [],
  lastName: 'Rojas',
  motherLastName: '',
};

const SIN_GERENTE = { generalManagerName: NOMBRE, generalManagerPhone: '', generalManagerEmail: '' };

function raw(tradeName: string): MedicalCenterRaw {
  return {
    legalName: 'Centro Médico Norte S.R.L.',
    legalEntityType: 'SRL',
    tradeName,
    taxId: '1023456789',
    healthFacilityRegistrationNumber: 'SEDES-SC-2020-0412',
    medicalDirectorName: NOMBRE,
    medicalDirectorLicense: 'MAT-12345',
    medicalDirectorEmail: 'director@centro.test',
    medicalDirectorPhone: '',
    constitutionFileId: '',
    taxIdentifierFileId: 'f-1',
    commerceRegistryFileId: '',
    operatingLicenseFileId: 'f-2',
    healthAuthorityCertificateFileId: 'f-3',
    powerOfAttorneyFileId: '',
    addressLines: 'Av. San Martín 456',
    sucursales: [],
    legalRepName: NOMBRE,
    legalRepIdNumber: '1234567',
    legalRepEmail: 'rep@centro.test',
    legalRepPhone: '',
    password: 'secreto12',
    ...SIN_GERENTE,
    salesManagerName: NOMBRE,
    salesManagerPhone: '',
    salesManagerEmail: '',
    marketingManagerName: NOMBRE,
    marketingManagerPhone: '',
    marketingManagerEmail: '',
  };
}

describe('medicalCenterBody · nombre comercial', () => {
  const ids = { pais: 'pais-1', jurisdiccion: 'jur-1' };

  it('viaja recortado cuando se escribió', () => {
    const cuerpo = medicalCenterBody('CLINIC', raw('  Clínica Norte  '), null, ids);

    expect(cuerpo.tradeName).toBe('Clínica Norte');
    expect(cuerpo.legalName).toBe('Centro Médico Norte S.R.L.');
  });

  it('no viaja cuando está vacío o son sólo espacios', () => {
    expect(medicalCenterBody('CLINIC', raw('   '), null, ids)).not.toHaveProperty('tradeName');
  });
});
