import {
  fromWireActivityEntry,
  fromWireActivityPage,
  fromWireCatalog,
  fromWireConfirmed,
  fromWireDecision,
  fromWireEngagement,
  fromWireEngagementStatus,
  fromWireInvitation,
  fromWireMyEngagements,
  fromWireRedeem,
  fromWireRequest,
  fromWireTeam,
  toWireEngagementRequest,
  toWireInvitation,
  toWireRequestStatus,
} from './support-access.wire';
import type { SupportEngagement, SupportEngagementRequest } from './support-access.types';

describe('de la pantalla a la API: los nombres de los DTO', () => {
  it('una solicitud sale con roleTemplateCode, parentAssignmentId y actions', () => {
    expect(
      toWireEngagementRequest({
        tenantId: 't-1',
        roleTemplate: 'SECRETARY',
        parentEngagementId: 'e-1',
        message: 'Hola',
        items: [
          {
            targetKind: 'PRACTITIONER',
            practitionerRoleAssignmentId: 'd-1',
            proposedActions: ['schedule.view'],
          },
        ],
      }),
    ).toEqual({
      tenantId: 't-1',
      roleTemplateCode: 'SECRETARY',
      parentAssignmentId: 'e-1',
      message: 'Hola',
      items: [
        {
          targetKind: 'PRACTITIONER',
          practitionerRoleAssignmentId: 'd-1',
          actions: ['schedule.view'],
        },
      ],
    });
  });

  it('no manda ningún nombre de la pantalla: la API rechaza lo que no conoce', () => {
    const cuerpo = JSON.stringify(
      toWireEngagementRequest({
        tenantId: 't',
        roleTemplate: 'NURSING',
        items: [{ targetKind: 'ALL', proposedActions: ['schedule.view'] }],
      }),
    );
    expect(cuerpo).not.toMatch(/proposedActions|parentEngagementId|"roleTemplate"/);
  });

  it('una invitación sale con roleTemplateCode y sin la etiqueta del destinatario', () => {
    const cuerpo = toWireInvitation({
      kind: 'SUPPORT_STAFF',
      maxUses: 3,
      expiresInDays: 7,
      roleTemplate: 'FRONT_DESK',
      targetPersonLabel: 'Alguien',
    });
    expect(cuerpo).toEqual({
      kind: 'SUPPORT_STAFF',
      maxUses: 3,
      expiresInDays: 7,
      roleTemplateCode: 'FRONT_DESK',
    });
  });
});

describe('de la API a la pantalla', () => {
  const vinculo = {
    id: 'e',
    roleTemplateCode: 'SECRETARY',
    grants: [],
  } as unknown as SupportEngagement;

  it('un vínculo con roleTemplateCode se lee como roleTemplate, y el nombre de la API no se queda colgando', () => {
    const v = fromWireEngagement(vinculo);
    expect(v.roleTemplate).toBe('SECRETARY');
    expect('roleTemplateCode' in v).toBe(false);
  });

  it('si ya trae roleTemplate, lo respeta', () => {
    expect(
      fromWireEngagement({ ...vinculo, roleTemplate: 'NURSING' } as SupportEngagement).roleTemplate,
    ).toBe('NURSING');
  });

  it('una solicitud trae parentAssignmentId y se lee como parentEngagementId', () => {
    const r = fromWireRequest({
      id: 'r',
      roleTemplateCode: 'NURSING',
      parentAssignmentId: 'e-9',
      items: [],
    } as unknown as SupportEngagementRequest);
    expect(r.roleTemplate).toBe('NURSING');
    expect(r.parentEngagementId).toBe('e-9');
  });

  it('«mis vínculos» llega como items y requests, y se lee como engagements y requests', () => {
    const r = fromWireMyEngagements({ items: [vinculo], requests: [], count: 1 } as never);
    expect(r.engagements.map((e) => e.roleTemplate)).toEqual(['SECRETARY']);
    expect(r.requests).toEqual([]);
  });

  it('la invitación agotada de la API es «usada» para la pantalla', () => {
    expect(
      fromWireInvitation({ id: 'i', status: 'EXHAUSTED', roleTemplateCode: 'FRONT_DESK' } as never)
        .status,
    ).toBe('USED');
    expect(fromWireInvitation({ id: 'i', status: 'ACTIVE' } as never).status).toBe('ACTIVE');
  });

  it('el canje trae kind y no el nombre de la organización: se traduce sin inventar uno', () => {
    expect(
      fromWireRedeem({
        kind: 'SUPPORT_STAFF',
        tenantId: 't',
        membershipId: 'm',
        engagementId: 'e',
      } as never),
    ).toEqual({
      outcome: 'SUPPORT_JOINED',
      organizationName: '',
      tenantId: 't',
      membershipId: 'm',
      engagementId: 'e',
    });
    expect(
      fromWireRedeem({ kind: 'PRACTITIONER', tenantId: 't', membershipId: 'm' } as never).outcome,
    ).toBe('PRACTITIONER_AFFILIATED');
  });

  it('un QR multiuso queda pendiente: doctor con roleAssignmentId (sin requestId ni membershipId) y apoyo con requestId', () => {
    const doctor = fromWireRedeem({
      kind: 'PRACTITIONER',
      tenantId: 't',
      roleAssignmentId: 'ra-1',
      pendingApproval: true,
    } as never);
    expect(doctor).toEqual({
      outcome: 'PRACTITIONER_PENDING_APPROVAL',
      organizationName: '',
      tenantId: 't',
      roleAssignmentId: 'ra-1',
      pendingApproval: true,
    });
    expect(doctor.requestId).toBeUndefined();
    expect(doctor.membershipId).toBeUndefined();
    expect(
      fromWireRedeem({
        kind: 'SUPPORT_STAFF',
        tenantId: 't',
        requestId: 'r-1',
        pendingApproval: true,
      } as never),
    ).toMatchObject({
      outcome: 'SUPPORT_REQUEST_CREATED',
      requestId: 'r-1',
      pendingApproval: true,
    });
  });
});

describe('el estado del vínculo: la API no tiene ENDED', () => {
  it('REVOKED y EXPIRED son «terminado» para las pantallas; ACTIVE y SUSPENDED pasan tal cual', () => {
    expect(fromWireEngagementStatus('REVOKED')).toBe('ENDED');
    expect(fromWireEngagementStatus('EXPIRED')).toBe('ENDED');
    expect(fromWireEngagementStatus('SUSPENDED')).toBe('SUSPENDED');
    expect(fromWireEngagementStatus('ACTIVE')).toBe('ACTIVE');
  });

  it('un vínculo leído de la API traduce el estado, deja `recertificationDue` afuera y conserva lo que trae', () => {
    const v = fromWireEngagement({
      id: 'e',
      roleTemplateCode: 'SECRETARY',
      status: 'REVOKED',
      recertificationDue: true,
      personName: 'Ana',
      organizationName: 'Hospital',
      ownerKind: 'ORGANIZATION',
      recertifyEveryMonths: 12,
      lastActivityAt: '2026-10-01T00:00:00Z',
      suspendedAt: '2026-10-02T00:00:00Z',
      lastConfirmedAt: '2026-01-01T00:00:00Z',
      lastConfirmedBy: 'PERSON',
      grants: [],
    } as never);
    expect(v.status).toBe('ENDED');
    expect(v.roleTemplate).toBe('SECRETARY');
    expect('recertificationDue' in v).toBe(false);
    expect(v).toMatchObject({
      personName: 'Ana',
      organizationName: 'Hospital',
      lastConfirmedBy: 'PERSON',
      suspendedAt: '2026-10-02T00:00:00Z',
    });
  });

  it('«mis vínculos» traduce el estado de cada uno', () => {
    const r = fromWireMyEngagements({
      items: [{ id: 'a', status: 'EXPIRED', roleTemplateCode: 'NURSING', grants: [] }],
      requests: [],
      count: 1,
    } as never);
    expect(r.engagements[0]!.status).toBe('ENDED');
  });

  it('la confirmación de la persona trae `reactivated` y el vínculo; sin él, es `false`', () => {
    const r = fromWireConfirmed({
      id: 'e',
      status: 'ACTIVE',
      roleTemplateCode: 'SECRETARY',
      grants: [],
      reactivated: true,
    } as never);
    expect(r.reactivated).toBe(true);
    expect(r.roleTemplate).toBe('SECRETARY');
    expect(
      fromWireConfirmed({
        id: 'e',
        status: 'SUSPENDED',
        roleTemplateCode: 'SECRETARY',
        grants: [],
      } as never),
    ).toMatchObject({ reactivated: false, status: 'SUSPENDED' });
  });
});

describe('las solicitudes', () => {
  it('PARTIAL y CANCELLED pasan tal cual; roleTemplateId se descarta y roleTemplateCode es el rol', () => {
    const parcial = fromWireRequest({
      id: 'r',
      status: 'PARTIAL',
      roleTemplateId: 'uuid-1',
      roleTemplateCode: 'FRONT_DESK',
      items: [],
    } as never);
    expect(parcial.status).toBe('PARTIAL');
    expect(parcial.roleTemplate).toBe('FRONT_DESK');
    expect('roleTemplateId' in parcial).toBe(false);
    expect(
      fromWireRequest({
        id: 'r',
        status: 'CANCELLED',
        roleTemplateCode: 'NURSING',
        items: [],
      } as never).status,
    ).toBe('CANCELLED');
  });

  it('el filtro de estado no manda PARTIAL (la API lo rechaza con 400): ese se recorta en pantalla', () => {
    expect(toWireRequestStatus('PARTIAL')).toBeUndefined();
    expect(toWireRequestStatus(undefined)).toBeUndefined();
    for (const estado of ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'] as const)
      expect(toWireRequestStatus(estado)).toBe(estado);
  });

  it('la decisión responde cómo quedó, no la solicitud', () => {
    expect(
      fromWireDecision({ requestId: 'r', status: 'PARTIAL', engagementId: 'e', grantIds: ['g'] }),
    ).toEqual({ requestId: 'r', status: 'PARTIAL', engagementId: 'e', grantIds: ['g'] });
    expect(fromWireDecision({ requestId: 'r', status: 'REJECTED', grantIds: [] } as never)).toEqual(
      { requestId: 'r', status: 'REJECTED', grantIds: [] },
    );
  });

  it('una decisión parcial por alcance conserva los ítems que siguen pendientes (`pendingItemIds`) y no los inventa', () => {
    expect(
      fromWireDecision({ requestId: 'r', status: 'PENDING', grantIds: [], pendingItemIds: ['i2'] }),
    ).toEqual({ requestId: 'r', status: 'PENDING', grantIds: [], pendingItemIds: ['i2'] });
    expect(
      fromWireDecision({ requestId: 'r', status: 'APPROVED', grantIds: ['g'], pendingItemIds: [] }),
    ).toEqual({ requestId: 'r', status: 'APPROVED', grantIds: ['g'] });
    expect(
      fromWireDecision({
        requestId: 'r',
        status: 'APPROVED',
        grantIds: ['g'],
        pendingItemIds: null,
      } as never),
    ).toEqual({ requestId: 'r', status: 'APPROVED', grantIds: ['g'] });
  });
});

describe('la actividad', () => {
  const asiento = {
    id: 'a',
    tenantId: 't',
    userId: 'u',
    personName: 'Ana Gutiérrez',
    actorName: 'Ana Gutiérrez',
    action: 'schedule.confirm',
    auditAction: 'BOOKING_CONFIRMED',
    permission: 'schedule.confirm',
    entity: 'booking',
    entityId: 'b',
    bookingId: 'b',
    practitionerProfileId: 'p',
    practitionerRoleAssignmentId: 'r',
    practitionerName: 'Dr. Pérez',
    summary: 'confirmó una cita',
    success: true,
    result: 'SUCCESS',
    createdAt: '2026-10-30T12:00:00Z',
    occurredAt: '2026-10-30T12:00:00Z',
    recordedAt: '2026-10-30T12:00:00Z',
  };

  it('toma una persona y un instante de cada par repetido y conserva el resto', () => {
    const e = fromWireActivityEntry(asiento as never);
    expect(e).toMatchObject({
      personName: 'Ana Gutiérrez',
      createdAt: '2026-10-30T12:00:00Z',
      auditAction: 'BOOKING_CONFIRMED',
      permission: 'schedule.confirm',
      bookingId: 'b',
      practitionerName: 'Dr. Pérez',
      result: 'SUCCESS',
      success: true,
    });
    expect('actorName' in e).toBe(false);
    expect('occurredAt' in e).toBe(false);
    expect('recordedAt' in e).toBe(false);
  });

  it('un asiento sin `createdAt` usa `occurredAt`, y `result` manda sobre `success`', () => {
    const { createdAt: _c, ...sinCreated } = asiento;
    expect(fromWireActivityEntry(sinCreated as never).createdAt).toBe('2026-10-30T12:00:00Z');
    const fallido = fromWireActivityEntry({
      ...asiento,
      success: true,
      result: 'FAILURE',
    } as never);
    expect(fallido).toMatchObject({ result: 'FAILURE', success: false });
  });

  it('la página trae el cursor, o `null` en la última', () => {
    expect(
      fromWireActivityPage({ items: [asiento], count: 1, nextCursor: 'abc' } as never),
    ).toMatchObject({ count: 1, nextCursor: 'abc' });
    expect(
      fromWireActivityPage({ items: [], count: 0, nextCursor: null } as never).nextCursor,
    ).toBeNull();
    expect(fromWireActivityPage({ items: [asiento] } as never)).toMatchObject({
      count: 1,
      nextCursor: null,
    });
  });
});

describe('el equipo del doctor', () => {
  const integrante = {
    delegateId: 'd',
    userId: 'u',
    personName: 'Ana',
    engagementId: 'e',
    tenantId: 't',
    organizationName: 'Hospital',
    roleTemplateCode: 'SECRETARY',
    roleTemplate: 'SECRETARY',
    status: 'REVOKED',
    delegateStatus: 'SUSPENDED',
    accepted: true,
    acceptedAt: '2026-09-01T00:00:00Z',
    mayReplyOnBehalf: false,
    replyDisclosure: 'SHOW',
    actions: ['schedule.view'],
    coverageSummary: 'Cubre toda su agenda',
    lastActivityAt: '2026-10-29T00:00:00Z',
    pendingClinicalRequests: [],
  };

  it('trae el estado para el doctor y la delegación tal cual, sin dejar `roleTemplateCode` colgando', () => {
    const { items } = fromWireTeam({ items: [integrante] } as never);
    expect(items[0]).toMatchObject({
      status: 'REVOKED',
      delegateStatus: 'SUSPENDED',
      roleTemplate: 'SECRETARY',
      actions: ['schedule.view'],
      accepted: true,
      engagementId: 'e',
      tenantId: 't',
    });
    expect('roleTemplateCode' in items[0]!).toBe(false);
  });

  it('con solo `roleTemplateCode` lo lee como `roleTemplate`; sin `delegateStatus`, lo deduce del estado', () => {
    const { roleTemplate: _r, delegateStatus: _d, ...parcial } = integrante;
    const [m] = fromWireTeam({ items: [parcial] } as never).items;
    expect(m!.roleTemplate).toBe('SECRETARY');
    expect(m!.delegateStatus).toBe('REVOKED');
  });
});

describe('el catálogo de la API real (B7c)', () => {
  const sede = 'ff4d09cd-e920-57c2-815f-d262dfd9f221';
  const edificio = '6b1b7b48-0ed5-5f2e-9165-c1aa25e4aa2c';
  const sala = 'a5b6c244-a0ce-56e2-9d76-cdb2f3f184c1';
  const cama = 'c1b6c244-a0ce-56e2-9d76-cdb2f3f184c2';

  it('los lugares sin ruta ni tipos finos reciben su ruta materializada y un tipo deducido', () => {
    const catalogo = fromWireCatalog({
      tenantId: 't1',
      doctors: [
        {
          practitionerRoleAssignmentId: 'ra-1',
          displayName: 'Andrés Pérez',
          placements: [{ careSpaceId: sala, healthcareServiceId: 's1' }],
        },
      ],
      services: [{ id: 's1', name: 'Cardiología' }],
      locations: [
        { id: sede, kind: 'SITE', name: 'Sede Central', practiceSiteId: sede },
        { id: edificio, kind: 'SPACE', name: 'Edificio A', parentId: sede, practiceSiteId: sede },
        {
          id: sala,
          kind: 'SPACE',
          name: 'Consultorio 101',
          parentId: edificio,
          practiceSiteId: sede,
        },
        { id: cama, kind: 'SPACE', name: 'Cama 401', parentId: edificio, practiceSiteId: sede },
      ],
    });
    expect(catalogo.doctors).toEqual([
      {
        id: 'ra-1',
        name: 'Andrés Pérez',
        specialty: '',
        placements: [{ careSpaceId: sala, healthcareServiceId: 's1' }],
      },
    ]);
    expect(catalogo.locations.map((l) => [l.kind, l.path])).toEqual([
      ['SITE', `/${sede}/`],
      ['BUILDING', `/${sede}/${edificio}/`],
      ['CONSULTING_ROOM', `/${sede}/${edificio}/${sala}/`],
      ['BED', `/${sede}/${edificio}/${cama}/`],
    ]);
    // La pantalla pregunta «¿quién contiene a quién?» por la ruta: la sala está dentro de la sede y del edificio.
    expect(catalogo.locations[2]!.path.startsWith(catalogo.locations[1]!.path)).toBe(true);
    expect(catalogo.organizationName).toBe('');
  });

  it('la forma de la pantalla (la del simulador) pasa tal cual', () => {
    const doctor = { id: 'd1', name: 'Dr. X', specialty: 'Cardiología', placements: [] };
    const lugar = {
      id: 'l1',
      kind: 'BUILDING' as const,
      name: 'Edificio',
      parentId: null,
      path: '/l1/',
    };
    expect(
      fromWireCatalog({
        organizationName: 'Hospital',
        doctors: [doctor],
        services: [],
        locations: [lugar],
      }),
    ).toEqual({
      organizationName: 'Hospital',
      doctors: [doctor],
      services: [],
      locations: [lugar],
    });
  });
});

describe('los permisos de la API real llegan sin `null` (B7c)', () => {
  it('quita los campos nulos de cada permiso: un null en el borrador de simulate rompe la huella', () => {
    const vinculo = fromWireEngagement({
      id: 'e1',
      status: 'ACTIVE',
      grants: [
        {
          id: 'g1',
          targetKind: 'PRACTITIONER',
          practitionerRoleAssignmentId: 'ra',
          healthcareServiceId: null,
          careSpaceId: null,
          practiceSiteId: null,
          actions: [],
          expansionMode: 'DYNAMIC',
          status: 'ACTIVE',
          validFrom: '2026-10-01T00:00:00Z',
          validTo: null,
        },
      ],
    } as unknown as SupportEngagement);
    const permiso = vinculo.grants[0]!;
    expect(Object.keys(permiso)).not.toContain('healthcareServiceId');
    expect(Object.keys(permiso)).not.toContain('validTo');
    expect(permiso.practitionerRoleAssignmentId).toBe('ra');
    expect(permiso.validFrom).toBe('2026-10-01T00:00:00Z');
  });
});
