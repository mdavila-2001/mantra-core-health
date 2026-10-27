import {
  isMedicalOrganizationType,
  MEDICAL_ORGANIZATION_TYPES,
  TENANT_TYPE_CODES,
  TENANT_TYPE_LABELS,
  TERRITORIAL_TENANT_TYPES,
} from './directory.types';

/**
 * Las tres listas del alta administrativa de organizaciones y su relación con
 * la del alta pública de organización médica.
 *
 * Las dos altas mandan `tenantType` a la misma API (`@IsIn(TENANT_TYPE_CODES)`
 * en `CreateTenantDto` y en el DTO de registro): si una ofreciera un tipo que la
 * otra no conoce, o en otro orden, la misma institución se elegiría distinto
 * según por dónde se dé de alta.
 */
describe('tipos de organización del alta administrativa', () => {
  it('declara los once códigos de CreateTenantDto, con CLINIC después de HOSPITAL', () => {
    expect(TENANT_TYPE_CODES).toEqual([
      'PROVIDER',
      'PAYER',
      'BROKER',
      'UNIVERSITY',
      'PHARMACY',
      'HOSPITAL',
      'CLINIC',
      'MEDICAL_OFFICE',
      'NURSING',
      'HEALTH_OTHER',
      'HEALTH_BUSINESS',
    ]);
  });

  it('CLINIC es territorial: la API le exige país y jurisdicción', () => {
    expect(TERRITORIAL_TENANT_TYPES).toContain('CLINIC');
  });

  it('PAYER y BROKER son los únicos no territoriales', () => {
    const noTerritoriales = TENANT_TYPE_CODES.filter(
      (codigo) => !TERRITORIAL_TENANT_TYPES.includes(codigo),
    );
    expect(noTerritoriales).toEqual(['PAYER', 'BROKER']);
  });

  it('cada código tiene su rótulo, y CLINIC se llama «Clínica»', () => {
    expect(Object.keys(TENANT_TYPE_LABELS).sort()).toEqual([...TENANT_TYPE_CODES].sort());
    expect(TENANT_TYPE_LABELS.CLINIC).toBe('Clínica');
  });

  it('los tipos del alta pública de organización médica son un subconjunto, en el mismo orden', () => {
    const inAdminList = TENANT_TYPE_CODES.filter((codigo) =>
      (MEDICAL_ORGANIZATION_TYPES as readonly string[]).includes(codigo),
    );
    expect(inAdminList).toEqual([...MEDICAL_ORGANIZATION_TYPES]);
  });

  it('todo tipo de organización médica es territorial en el alta administrativa', () => {
    for (const tipo of MEDICAL_ORGANIZATION_TYPES) {
      expect(TERRITORIAL_TENANT_TYPES).toContain(tipo);
    }
  });

  it('«Otra institución de salud» se llama igual en las dos altas', () => {
    expect(TENANT_TYPE_LABELS.HEALTH_OTHER).toBe('Otra institución de salud');
  });
});

describe('tipos de organización médica', () => {
  it('ofrece exactamente los cinco tipos institucionales de salud, en orden', () => {
    expect(MEDICAL_ORGANIZATION_TYPES).toEqual([
      'HOSPITAL',
      'CLINIC',
      'MEDICAL_OFFICE',
      'NURSING',
      'HEALTH_OTHER',
    ]);
  });

  it('reconoce los cinco tipos y rechaza los que no son una organización médica', () => {
    for (const tipo of MEDICAL_ORGANIZATION_TYPES) {
      expect(isMedicalOrganizationType(tipo)).toBe(true);
    }
    for (const ajeno of ['PAYER', 'PHARMACY', 'DIAGNOSTIC_CENTER', 'PROVIDER', '', 'clinic']) {
      expect(isMedicalOrganizationType(ajeno)).toBe(false);
    }
  });
});
