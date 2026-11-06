import { organizationRoleLabel } from './organization-role-label';

describe('organizationRoleLabel', () => {
  it('names the three roles in words', () => {
    expect(organizationRoleLabel('OWNER')).toBe('Dueño');
    expect(organizationRoleLabel('ADMIN')).toBe('Administración');
    expect(organizationRoleLabel('STAFF')).toBe('Equipo');
  });

  it('never shows an unknown or missing role as a code', () => {
    expect(organizationRoleLabel('DIR_ROLE_SUPPORT')).toBe('Otro rol');
    expect(organizationRoleLabel(undefined)).toBe('Otro rol');
  });
});
