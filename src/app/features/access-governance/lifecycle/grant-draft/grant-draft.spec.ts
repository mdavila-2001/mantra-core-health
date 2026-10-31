import type {
  SupportCatalog,
  SupportGrant,
} from '../../../../core/data-access/support-access/support-access.types';
import {
  atomsOfGrant,
  dayFromToday,
  draftFromGrant,
  hasPerActionConditions,
  labelOfTarget,
  optionsFromCatalog,
  targetKeyOf,
  toMoveGrant,
  toSimulationGrant,
  validToIso,
  withTargetsOf,
} from './grant-draft';

const CATALOG: SupportCatalog = {
  organizationName: 'Hospital Piloto',
  doctors: [{ id: 'doc-1', name: 'Dr. Pérez', specialty: 'Cardiología', placements: [] }],
  services: [{ id: 'svc-1', name: 'Ecografía' }],
  locations: [
    { id: 'site-1', kind: 'SITE', name: 'Sede Central', parentId: null, path: '/site-1/' },
    { id: 'floor-1', kind: 'LEVEL', name: 'Piso 1', parentId: 'site-1', path: '/site-1/floor-1/' },
  ],
};

const GRANT: SupportGrant = {
  id: 'g-1',
  engagementId: 'e-1',
  targetKind: 'SERVICE',
  healthcareServiceId: 'svc-1',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.view'],
  status: 'ACTIVE',
  atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'],
  validTo: '2026-12-31T23:59:59.000Z',
  condition: {
    schemaVersion: 1,
    time: {
      timeZone: 'America/La_Paz',
      windows: [{ days: [1, 2, 3, 4, 5], from: '07:30', to: '18:30' }],
    },
  },
  actionConditions: {
    'agenda.appointment.cancel': {
      schemaVersion: 1,
      appointment: { leadTime: { minHours: 24, onViolation: 'REQUIRE_APPROVAL' } },
    },
  },
};

describe('grant-draft', () => {
  it('ofrece como objetivos los servicios, las ubicaciones (sede o espacio) y los doctores del catálogo, con su nombre', () => {
    const options = optionsFromCatalog(CATALOG);
    expect(options.map((o) => o.label)).toEqual([
      'Servicio · Ecografía',
      'Ubicación · Sede Central',
      'Ubicación · Piso 1',
      'Doctor · Dr. Pérez',
    ]);
    expect(options[1]!.target).toEqual({ targetKind: 'LOCATION', practiceSiteId: 'site-1' });
    expect(options[2]!.target).toEqual({ targetKind: 'LOCATION', careSpaceId: 'floor-1' });
  });

  it('suma los objetivos de permisos que ya existen sin repetir los conocidos', () => {
    const combined = {
      targetKind: 'SERVICE_LOCATION' as const,
      healthcareServiceId: 'svc-1',
      careSpaceId: 'floor-1',
    };
    const options = withTargetsOf(optionsFromCatalog(CATALOG), [GRANT, combined], CATALOG);
    expect(options).toHaveLength(5);
    expect(options.at(-1)!.label).toBe('Ecografía solo en Piso 1');
  });

  it('nombra un objetivo que el catálogo no conoce con una palabra neutra, nunca con un identificador', () => {
    expect(labelOfTarget({ targetKind: 'SERVICE', healthcareServiceId: 'otro' }, CATALOG)).toBe(
      'Servicio · un servicio',
    );
    expect(labelOfTarget({ targetKind: 'ALL' }, null)).toBe('Toda la organización');
  });

  it('un permiso vigente se vuelve borrador conservando condiciones y vigencia; los alias antiguos se expanden a átomos', () => {
    const draft = draftFromGrant(GRANT);
    expect(draft).toMatchObject({
      targetKey: targetKeyOf(GRANT),
      atoms: ['agenda.appointment.view', 'agenda.appointment.cancel'],
      validTo: '2026-12-31',
      grantId: 'g-1',
    });
    expect(draft.condition).toEqual(GRANT.condition);
    const legacy = atomsOfGrant({ actions: ['schedule.view'] });
    expect(legacy).toContain('agenda.appointment.view');
  });

  it('al armar el cambio de rol conserva la condición del permiso; las condiciones por permiso no viajan (el DTO no las acepta) y se detectan para avisar', () => {
    const option = optionsFromCatalog(CATALOG)[0]!;
    const draft = draftFromGrant(GRANT);
    const same = toMoveGrant(draft, option);
    expect(same).toMatchObject({
      targetKind: 'SERVICE',
      healthcareServiceId: 'svc-1',
      effect: 'ALLOW',
      expansionMode: 'DYNAMIC',
    });
    expect(same.condition).toEqual(GRANT.condition);
    expect(same).not.toHaveProperty('actionConditions');
    expect(toSimulationGrant(draft, option)).not.toHaveProperty('actionConditions');
    expect(hasPerActionConditions([draft])).toBe(true);
    expect(hasPerActionConditions([{ ...draft, actionConditions: undefined }])).toBe(false);
  });

  it('la simulación no lleva el tipo de objetivo (el DTO no lo declara) y respeta la prohibición expresa', () => {
    const option = optionsFromCatalog(CATALOG)[0]!;
    const simulated = toSimulationGrant({ ...draftFromGrant(GRANT), effect: 'DENY' }, option);
    expect(simulated).not.toHaveProperty('targetKind');
    expect(simulated).toMatchObject({ effect: 'DENY', healthcareServiceId: 'svc-1' });
  });

  it('la vigencia sale como instante ISO del fin de ese día, y vacía no se manda', () => {
    expect(validToIso('')).toBeUndefined();
    expect(new Date(validToIso('2026-12-31')!).getTime()).toBe(
      new Date('2026-12-31T23:59:59').getTime(),
    );
    expect(dayFromToday(180, new Date(2026, 0, 1))).toBe('2026-06-30');
  });
});
