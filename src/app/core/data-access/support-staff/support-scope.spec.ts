import { describe, expect, it } from 'vitest';

import { invitationsFor, pendingOnOthers, scopeOf, uniqueLinks } from './support-scope';
import type { SupportAccess, SupportLink } from './support-staff.types';

function vinculo(cambios: Partial<SupportLink>): SupportLink {
  return {
    id: 'l-1',
    kind: 'PRACTITIONER',
    targetKind: 'PRACTITIONER',
    tenantId: 't-hospital',
    organizationName: 'Hospital San Lucas',
    userId: 'u-rosa',
    personName: 'Rosa Choque',
    status: 'ACTIVE',
    initiatedBy: 'ORGANIZATION',
    awaiting: null,
    practiceSiteId: null,
    clinicalUnitId: null,
    careSpaceId: null,
    practitionerRoleAssignmentId: 'pra-rojas',
    practitionerProfileId: 'hpid-rojas',
    targetName: 'Dra. Valeria Rojas',
    createdAt: '2026-10-01T10:00:00Z',
    ...cambios,
  };
}

const VINCULOS: readonly SupportLink[] = [
  vinculo({ id: 'l-1' }),
  vinculo({ id: 'l-2', kind: 'LOCATION', targetKind: 'SPACE', careSpaceId: 'piso-2', practitionerRoleAssignmentId: null, targetName: 'Piso 2 — Cardiología' }),
  vinculo({ id: 'l-3', targetName: 'Dr. Jorge Paz', status: 'PENDING', awaiting: 'SUPPORT_STAFF' }),
  vinculo({ id: 'l-4', tenantId: 't-clinica', organizationName: 'Clínica Los Olivos', targetName: 'Dr. Ramiro Céspedes', status: 'PENDING', awaiting: 'ORGANIZATION', initiatedBy: 'SUPPORT_STAFF' }),
];

const ACCESO: SupportAccess = {
  tenants: [
    {
      tenantId: 't-hospital',
      organizationName: 'Hospital San Lucas',
      wholeOrganization: false,
      organizationAccess: true,
      practiceSiteIds: [],
      clinicalUnitIds: [],
      careSpaceIds: ['piso-2'],
      practitioners: [{ linkId: 'l-1', practitionerRoleAssignmentId: 'pra-rojas', practitionerProfileId: 'hpid-rojas', name: 'Dra. Valeria Rojas' }],
    },
    {
      tenantId: 't-clinica',
      organizationName: 'Clínica Los Olivos',
      wholeOrganization: false,
      organizationAccess: false,
      practiceSiteIds: [],
      clinicalUnitIds: [],
      careSpaceIds: [],
      practitioners: [{ linkId: 'l-9', practitionerRoleAssignmentId: 'pra-cespedes', practitionerProfileId: 'hpid-c', name: 'Dr. Ramiro Céspedes' }],
    },
  ],
};

describe('scopeOf — lo que ve la secretaria', () => {
  it('sus hospitales con sus doctores y sus pisos, por nombre', () => {
    expect(scopeOf(ACCESO, VINCULOS).workplaces).toEqual([
      {
        tenantId: 't-hospital',
        organizationName: 'Hospital San Lucas',
        doctors: ['Dra. Valeria Rojas'],
        floors: ['Piso 2 — Cardiología'],
        wholeOrganization: false,
      },
    ]);
  });

  it('donde sólo un doctor la aceptó no muestra el hospital: sólo el doctor', () => {
    const alcance = scopeOf(ACCESO, VINCULOS);
    expect(alcance.workplaces.map((w) => w.tenantId)).not.toContain('t-clinica');
    expect(alcance.doctorsOnly).toEqual([
      { linkId: 'l-9', tenantId: 't-clinica', practitionerRoleAssignmentId: 'pra-cespedes', name: 'Dr. Ramiro Céspedes' },
    ]);
  });

  it('sin acceso no ve nada, aunque tenga vínculos pendientes', () => {
    expect(scopeOf({ tenants: [] }, VINCULOS)).toEqual({ workplaces: [], doctorsOnly: [] });
  });
});

describe('pendientes', () => {
  it('separa lo que ella tiene que decidir de lo que espera de otros', () => {
    expect(invitationsFor(VINCULOS).map((l) => l.id)).toEqual(['l-3']);
    expect(pendingOnOthers(VINCULOS).map((l) => l.id)).toEqual(['l-4']);
  });

  it('uniqueLinks no repite un vínculo que llega en las dos listas', () => {
    expect(uniqueLinks([VINCULOS[2]!], [VINCULOS[2]!, VINCULOS[3]!]).map((l) => l.id)).toEqual(['l-3', 'l-4']);
  });
});
