import {
  medicalFacilityIssues,
  NIT_PATTERN,
  HEALTH_FACILITY_REGISTRATION_PATTERN,
} from './medical-facility.rules';

const VALIDO = {
  taxIdentifierNumber: '1023456789',
  healthFacilityRegistrationNumber: 'SEDES-SC-2020-0412',
  medicalDirector: {
    name: 'Ana',
    lastName: 'Rojas',
    professionalLicenseNumber: 'MAT-12345',
    email: 'dir@clinica.bo',
  },
  headquarters: { name: 'Casa central', addressLines: ['Av. San Martín 123'] },
};

describe('reglas de medicalFacility', () => {
  it('un bloque válido no tiene motivos de rechazo', () => {
    expect(medicalFacilityIssues(VALIDO)).toEqual([]);
  });

  it('lo que no es un objeto se rechaza', () => {
    expect(medicalFacilityIssues(null)).toEqual(['organization.medicalFacility must be an object']);
    expect(medicalFacilityIssues('x')).toHaveLength(1);
  });

  it('el patrón del NIT es el del contrato', () => {
    expect(NIT_PATTERN.test('1023456789')).toBe(true);
    expect(NIT_PATTERN.test('1023-456')).toBe(true);
    expect(NIT_PATTERN.test('123')).toBe(false);
    expect(NIT_PATTERN.test('a1234')).toBe(false);
  });

  it('el patrón del registro admite letras, números, punto, barra y guion', () => {
    expect(HEALTH_FACILITY_REGISTRATION_PATTERN.test('SEDES-SC/2020.04')).toBe(true);
    expect(HEALTH_FACILITY_REGISTRATION_PATTERN.test('SEDES SC')).toBe(false);
  });

  it('acumula todos los motivos, con su ruta', () => {
    const issues = medicalFacilityIssues({
      ...VALIDO,
      taxIdentifierNumber: 'x',
      healthFacilityRegistrationNumber: 'a',
      medicalDirector: { ...VALIDO.medicalDirector, professionalLicenseNumber: 'a' },
    });

    expect(issues).toHaveLength(3);
    expect(issues.join()).toContain('taxIdentifierNumber');
    expect(issues.join()).toContain('healthFacilityRegistrationNumber');
    expect(issues.join()).toContain('professionalLicenseNumber');
  });

  it('las sucursales llevan su índice en el motivo', () => {
    const issues = medicalFacilityIssues({
      ...VALIDO,
      branches: [VALIDO.headquarters, { name: '', addressLines: ['x'] }],
    });

    expect(issues).toEqual(['organization.medicalFacility.branches.1.name should not be empty']);
  });
});
