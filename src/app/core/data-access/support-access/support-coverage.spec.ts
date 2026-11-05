import type { LocationNode, SupportCatalog } from './support-access.types';
import {
  actionsFor,
  evaluateAction,
  indexLocations,
  isWithin,
  previewCoverage,
  targetCovers,
  type AppointmentContext,
  type CoverageGrant,
} from './support-coverage';

const SEDE: LocationNode = { id: 'central', kind: 'SITE', name: 'Sede Central', parentId: null, path: '/central/' };
const EDIF_A: LocationNode = { id: 'a', kind: 'BUILDING', name: 'Edificio A', parentId: 'central', path: '/central/a/' };
const EDIF_B: LocationNode = { id: 'b', kind: 'BUILDING', name: 'Edificio B', parentId: 'central', path: '/central/b/' };
const A_P1: LocationNode = { id: 'a-p1', kind: 'LEVEL', name: 'Piso 1', parentId: 'a', path: '/central/a/a-p1/' };
const A_P4: LocationNode = { id: 'a-p4', kind: 'LEVEL', name: 'Piso 4', parentId: 'a', path: '/central/a/a-p4/' };
const A_105: LocationNode = { id: 'a-105', kind: 'CONSULTING_ROOM', name: 'Consultorio 105', parentId: 'a-p1', path: '/central/a/a-p1/a-105/' };
const A_401: LocationNode = { id: 'a-401', kind: 'BED', name: 'Cama 401', parentId: 'a-p4', path: '/central/a/a-p4/a-401/' };
const B_102: LocationNode = { id: 'b-102', kind: 'CONSULTING_ROOM', name: 'Consultorio B102', parentId: 'b', path: '/central/b/b-102/' };
const NORTE: LocationNode = { id: 'norte', kind: 'SITE', name: 'Sede Norte', parentId: null, path: '/norte/' };
const N_102: LocationNode = { id: 'n-102', kind: 'CONSULTING_ROOM', name: 'Consultorio N102', parentId: 'norte', path: '/norte/n-102/' };
const NODOS = [SEDE, EDIF_A, EDIF_B, A_P1, A_P4, A_105, A_401, B_102, NORTE, N_102];
const LOC = indexLocations(NODOS);

const CATALOGO: SupportCatalog = {
  organizationName: 'Hospital',
  locations: NODOS,
  services: [
    { id: 'eco', name: 'Ecografía' },
    { id: 'eco-obs', name: 'Ecografía obstétrica' },
    { id: 'ped', name: 'Pediatría' },
    { id: 'int', name: 'Medicina interna' },
  ],
  doctors: [
    { id: 'mendez', name: 'Dra. Méndez', specialty: 'Medicina interna', placements: [{ careSpaceId: 'a-105', healthcareServiceId: 'int' }, { careSpaceId: 'a-401', healthcareServiceId: 'int' }] },
    { id: 'suarez', name: 'Dr. Suárez', specialty: 'Pediatría', placements: [{ careSpaceId: 'b-102', healthcareServiceId: 'ped' }, { careSpaceId: 'n-102', healthcareServiceId: 'ped' }] },
    { id: 'antelo', name: 'Dra. Antelo', specialty: 'Radiología', placements: [{ careSpaceId: 'a-105', healthcareServiceId: 'eco' }] },
  ],
};

const ctx = (doctor: string, space: string, service: string): AppointmentContext => ({
  practitionerRoleAssignmentId: doctor,
  careSpaceId: space,
  healthcareServiceId: service,
});
const VER_Y_LLEGADA = ['schedule.view', 'schedule.check_in'] as const;
const grant = (g: Omit<CoverageGrant, 'actions'> & { actions?: CoverageGrant['actions'] }): CoverageGrant => ({ actions: VER_Y_LLEGADA, ...g });

describe('isWithin', () => {
  it('un espacio está dentro de su piso, su edificio y su sede; no de otro edificio', () => {
    expect(isWithin(A_105, A_P1)).toBe(true);
    expect(isWithin(A_105, EDIF_A)).toBe(true);
    expect(isWithin(A_105, SEDE)).toBe(true);
    expect(isWithin(A_105, EDIF_B)).toBe(false);
    expect(isWithin(A_105, A_105)).toBe(true);
  });
  it('un nodo desconocido no está dentro de nada', () => {
    expect(isWithin(undefined, SEDE)).toBe(false);
  });
});

describe('targetCovers: una fila con un objetivo', () => {
  it('por doctor cubre todos sus lugares', () => {
    const g = grant({ targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'mendez' });
    expect(targetCovers(g, ctx('mendez', 'a-105', 'int'), LOC)).toBe(true);
    expect(targetCovers(g, ctx('mendez', 'a-401', 'int'), LOC)).toBe(true);
    expect(targetCovers(g, ctx('suarez', 'b-102', 'ped'), LOC)).toBe(false);
  });

  it('por servicio cubre ese servicio sin importar doctor ni lugar', () => {
    const g = grant({ targetKind: 'SERVICE', healthcareServiceId: 'eco' });
    expect(targetCovers(g, ctx('antelo', 'a-105', 'eco'), LOC)).toBe(true);
    expect(targetCovers(g, ctx('antelo', 'a-105', 'eco-obs'), LOC)).toBe(false);
  });

  it('por ubicación cubre una cita solo si el ESPACIO de la cita está dentro', () => {
    const g = grant({ targetKind: 'LOCATION', careSpaceId: 'a-p1' });
    expect(targetCovers(g, ctx('mendez', 'a-105', 'int'), LOC)).toBe(true);
    expect(targetCovers(g, ctx('mendez', 'a-401', 'int'), LOC)).toBe(false);
  });

  it('una sede se otorga por `practiceSiteId` y cubre todos sus espacios', () => {
    const g = grant({ targetKind: 'LOCATION', practiceSiteId: 'norte' });
    expect(targetCovers(g, ctx('suarez', 'n-102', 'ped'), LOC)).toBe(true);
    expect(targetCovers(g, ctx('suarez', 'b-102', 'ped'), LOC)).toBe(false);
  });

  it('«todos» cubre todo', () => {
    for (const targetKind of ['ALL', 'ALL_PRACTITIONERS', 'ALL_SERVICES', 'ALL_LOCATIONS'] as const) {
      expect(targetCovers(grant({ targetKind }), ctx('suarez', 'b-102', 'ped'), LOC)).toBe(true);
    }
  });
});

describe('targetCovers: una fila con dos objetivos se CRUZA', () => {
  it('doctor × ubicación: Suárez solo en la Sede Norte (caso 08)', () => {
    const g = grant({ targetKind: 'PRACTITIONER_LOCATION', practitionerRoleAssignmentId: 'suarez', practiceSiteId: 'norte' });
    expect(targetCovers(g, ctx('suarez', 'n-102', 'ped'), LOC)).toBe(true);
    expect(targetCovers(g, ctx('suarez', 'b-102', 'ped'), LOC)).toBe(false);
  });

  it('doctor × servicio y servicio × ubicación exigen las dos condiciones', () => {
    const ds = grant({ targetKind: 'PRACTITIONER_SERVICE', practitionerRoleAssignmentId: 'antelo', healthcareServiceId: 'eco' });
    expect(targetCovers(ds, ctx('antelo', 'a-105', 'eco'), LOC)).toBe(true);
    expect(targetCovers(ds, ctx('antelo', 'a-105', 'eco-obs'), LOC)).toBe(false);

    const sl = grant({ targetKind: 'SERVICE_LOCATION', healthcareServiceId: 'eco', careSpaceId: 'b' });
    expect(targetCovers(sl, ctx('antelo', 'a-105', 'eco'), LOC)).toBe(false);
  });
});

describe('varias filas SE SUMAN', () => {
  it('suma las acciones de todas las filas que cubren el mismo horario', () => {
    const grants = [
      grant({ targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'mendez', actions: ['schedule.view'] }),
      grant({ targetKind: 'LOCATION', careSpaceId: 'a-p1', actions: ['schedule.check_in'] }),
    ];
    expect(actionsFor(grants, ctx('mendez', 'a-105', 'int'), LOC)).toEqual(['schedule.view', 'schedule.check_in']);
  });
});

describe('evaluateAction: los casos de la maqueta del contrato', () => {
  // Lucía: FRONT_DESK en el Piso 1 del Edificio A.
  const lucia = [grant({ targetKind: 'LOCATION', careSpaceId: 'a-p1', actions: ['schedule.view', 'schedule.check_in', 'schedule.walk_in', 'patient.register'] })];

  it('caso 03: Lucía registra la llegada de un paciente de Méndez en el 105', () => {
    expect(evaluateAction(lucia, ctx('mendez', 'a-105', 'int'), 'schedule.check_in', LOC, 'Registrar la llegada').allowed).toBe(true);
  });

  it('caso 04: Lucía no registra la llegada en el piso 4', () => {
    const v = evaluateAction(lucia, ctx('mendez', 'a-401', 'int'), 'schedule.check_in', LOC, 'Registrar la llegada');
    expect(v.allowed).toBe(false);
    expect(v.reason).toBe('No tiene permiso sobre esta agenda.');
  });

  it('caso 05: Lucía no crea citas ni en su propio piso, y el motivo dice por qué', () => {
    const v = evaluateAction(lucia, ctx('mendez', 'a-105', 'int'), 'schedule.create', LOC, 'Crear citas');
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain('su permiso no incluye «crear citas»');
  });
});

describe('previewCoverage', () => {
  it('sin permisos no cubre a nadie', () => {
    expect(previewCoverage([], CATALOGO)).toEqual({ doctors: [], services: [] });
  });

  it('un permiso por doctor cubre «toda su agenda» y los servicios que presta', () => {
    const vista = previewCoverage([grant({ targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'suarez' })], CATALOGO);

    expect(vista.doctors.map((c) => [c.doctor.name, c.extent])).toEqual([['Dr. Suárez', 'all']]);
    expect(vista.services.map((s) => [s.service.name, s.extent])).toEqual([['Pediatría', 'all']]);
  });

  it('un permiso por piso cubre solo una parte de los doctores que pasan por él', () => {
    const vista = previewCoverage([grant({ targetKind: 'LOCATION', careSpaceId: 'a-p1' })], CATALOGO);

    const mendez = vista.doctors.find((c) => c.doctor.id === 'mendez')!;
    expect(mendez.extent).toBe('partial');
    expect(mendez.coveredSpaceNames).toEqual(['Consultorio 105']);
    expect(vista.doctors.map((c) => c.doctor.id)).toEqual(['mendez', 'antelo']);
  });

  it('la combinación restringe: Suárez × Sede Norte cubre solo ese consultorio', () => {
    const vista = previewCoverage(
      [grant({ targetKind: 'PRACTITIONER_LOCATION', practitionerRoleAssignmentId: 'suarez', practiceSiteId: 'norte' })],
      CATALOGO,
    );

    expect(vista.doctors).toHaveLength(1);
    expect(vista.doctors[0]!.extent).toBe('partial');
    expect(vista.doctors[0]!.coveredSpaceNames).toEqual(['Consultorio N102']);
  });

  it('el servicio de ecografía alcanza a quien lo presta, aunque el permiso no nombre al doctor', () => {
    const vista = previewCoverage([grant({ targetKind: 'SERVICE', healthcareServiceId: 'eco' })], CATALOGO);

    expect(vista.doctors.map((c) => c.doctor.name)).toEqual(['Dra. Antelo']);
    expect(vista.services.map((s) => s.service.name)).toEqual(['Ecografía']);
  });

  it('«todo» cubre a todos con «toda su agenda»', () => {
    const vista = previewCoverage([grant({ targetKind: 'ALL' })], CATALOGO);
    expect(vista.doctors.every((c) => c.extent === 'all')).toBe(true);
    expect(vista.doctors).toHaveLength(3);
  });
});
