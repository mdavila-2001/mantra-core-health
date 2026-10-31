import { SUPPORT_TEMPLATE_DEFAULT_ACTIONS, type SupportCatalog } from './support-access.types';
import {
  catalogFromGrants,
  CLINICAL_RULE_SENTENCE,
  describeActions,
  describeGrant,
  describeTarget,
  joinNatural,
  summarizeGrants,
  type SummarizableGrant,
} from './support-summary';

const CATALOGO: SupportCatalog = {
  organizationName: 'Hospital Piloto',
  doctors: [{ id: 'perez', name: 'Dr. Andrés Pérez', specialty: 'Cardiología', placements: [] }],
  services: [{ id: 'eco', name: 'Ecografía' }],
  locations: [
    { id: 'norte', kind: 'SITE', name: 'Sede Norte', parentId: null, path: '/norte/' },
    { id: 'a', kind: 'BUILDING', name: 'Edificio A', parentId: null, path: '/a/' },
    { id: 'a-p1', kind: 'LEVEL', name: 'Piso 1', parentId: 'a', path: '/a/a-p1/' },
    { id: 'a-105', kind: 'CONSULTING_ROOM', name: 'Consultorio 105', parentId: 'a-p1', path: '/a/a-p1/a-105/' },
  ],
};

describe('joinNatural', () => {
  it('une con comas y una «y» final', () => {
    expect(joinNatural([])).toBe('');
    expect(joinNatural(['a'])).toBe('a');
    expect(joinNatural(['a', 'b'])).toBe('a y b');
    expect(joinNatural(['a', 'b', 'c'])).toBe('a, b y c');
  });
});

describe('describeActions', () => {
  it('nombra las acciones como verbos, en el orden canónico y no en el que se marcaron', () => {
    expect(describeActions(['schedule.check_in', 'schedule.view', 'schedule.create'])).toBe(
      'ver la agenda, crear citas y registrar la llegada del paciente',
    );
  });

  it('no deja un código a la vista', () => {
    expect(describeActions(SUPPORT_TEMPLATE_DEFAULT_ACTIONS.SECRETARY)).not.toMatch(/schedule\.|billing\.|patient\./);
  });
});

describe('describeTarget: cada tipo de objetivo en palabras', () => {
  it.each([
    [{ targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'perez' }, 'de Dr. Andrés Pérez, en todos los lugares donde atiende'],
    [{ targetKind: 'SERVICE', healthcareServiceId: 'eco' }, 'del servicio Ecografía, en toda la organización'],
    [{ targetKind: 'LOCATION', careSpaceId: 'a-p1' }, 'en Piso 1'],
    [{ targetKind: 'LOCATION', practiceSiteId: 'norte' }, 'en Sede Norte'],
    [{ targetKind: 'PRACTITIONER_SERVICE', practitionerRoleAssignmentId: 'perez', healthcareServiceId: 'eco' }, 'de Dr. Andrés Pérez, solo para Ecografía'],
    [{ targetKind: 'PRACTITIONER_LOCATION', practitionerRoleAssignmentId: 'perez', practiceSiteId: 'norte' }, 'de Dr. Andrés Pérez, solo en Sede Norte'],
    [{ targetKind: 'SERVICE_LOCATION', healthcareServiceId: 'eco', careSpaceId: 'a' }, 'del servicio Ecografía, solo en Edificio A'],
    [{ targetKind: 'ALL_PRACTITIONERS' }, 'de todos los doctores'],
    [{ targetKind: 'ALL_SERVICES' }, 'de todos los servicios'],
    [{ targetKind: 'ALL_LOCATIONS' }, 'en todas las ubicaciones'],
    [{ targetKind: 'ALL' }, 'de toda la organización'],
  ] as const)('%j', (objetivo, esperado) => {
    expect(describeTarget(objetivo, CATALOGO)).toBe(esperado);
  });
});

describe('describeGrant', () => {
  const ver = ['schedule.view', 'schedule.create'] as const;

  it('arma la frase completa de un permiso', () => {
    const g: SummarizableGrant = { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'perez', actions: ver, expansionMode: 'FIXED' };
    expect(describeGrant(g, CATALOGO)).toBe('Puede ver la agenda y crear citas de Dr. Andrés Pérez, en todos los lugares donde atiende.');
  });

  it('con lo nuevo automático, un piso que tiene lugares adentro lo dice', () => {
    const g: SummarizableGrant = { targetKind: 'LOCATION', careSpaceId: 'a-p1', actions: ver, expansionMode: 'DYNAMIC' };
    expect(describeGrant(g, CATALOGO)).toContain('Incluye automáticamente lo que se agregue después.');
  });

  it('un consultorio (sin nada adentro) no promete lo nuevo', () => {
    const g: SummarizableGrant = { targetKind: 'LOCATION', careSpaceId: 'a-105', actions: ver, expansionMode: 'DYNAMIC' };
    expect(describeGrant(g, CATALOGO)).not.toContain('automáticamente');
  });

  it('en modo fijo nunca promete lo nuevo', () => {
    const g: SummarizableGrant = { targetKind: 'LOCATION', careSpaceId: 'a-p1', actions: ver, expansionMode: 'FIXED' };
    expect(describeGrant(g, CATALOGO)).not.toContain('automáticamente');
  });

  it('«todos» con lo nuevo automático lo dice', () => {
    const g: SummarizableGrant = { targetKind: 'ALL_PRACTITIONERS', actions: ver, expansionMode: 'DYNAMIC' };
    expect(describeGrant(g, CATALOGO)).toContain('Incluye automáticamente');
  });

  it('un permiso sin acciones lo dice en vez de inventar una frase vacía', () => {
    const g: SummarizableGrant = { targetKind: 'ALL', actions: [], expansionMode: 'DYNAMIC' };
    expect(describeGrant(g, CATALOGO)).toBe('Sin acciones elegidas de toda la organización.');
  });
});

describe('summarizeGrants', () => {
  it('sin permisos dice que no ve ninguna agenda', () => {
    expect(summarizeGrants([], CATALOGO)).toEqual(['Todavía no tiene ningún permiso: no puede ver ninguna agenda.']);
  });

  it('una línea por permiso, lo que NO puede y la regla de la historia clínica', () => {
    const lineas = summarizeGrants(
      [
        { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'perez', actions: SUPPORT_TEMPLATE_DEFAULT_ACTIONS.SECRETARY, expansionMode: 'DYNAMIC' },
        { targetKind: 'SERVICE', healthcareServiceId: 'eco', actions: SUPPORT_TEMPLATE_DEFAULT_ACTIONS.CALL_CENTER, expansionMode: 'DYNAMIC' },
      ],
      CATALOGO,
    );

    expect(lineas).toHaveLength(4);
    expect(lineas[0]).toContain('de Dr. Andrés Pérez');
    expect(lineas[1]).toContain('del servicio Ecografía');
    // La secretaria responde mensajes y cancela; ninguno de los dos permisos bloquea horarios, cambia el horario ni cobra.
    expect(lineas[2]).toBe('No puede bloquear horarios, cambiar el horario de atención y cobrar.');
    expect(lineas[3]).toBe(CLINICAL_RULE_SENTENCE);
  });

  it('lo que concede un permiso se cuenta aunque otro no lo conceda (se suman)', () => {
    const lineas = summarizeGrants(
      [
        { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'perez', actions: ['schedule.view'], expansionMode: 'DYNAMIC' },
        { targetKind: 'ALL_SERVICES', actions: ['billing.collect'], expansionMode: 'DYNAMIC' },
      ],
      CATALOGO,
    );
    expect(lineas.at(-2)).not.toContain('cobrar');
  });

  it('la regla clínica está siempre, hasta con todos los permisos', () => {
    const todo = summarizeGrants(
      [{ targetKind: 'ALL', actions: ['schedule.view', 'schedule.create', 'schedule.cancel', 'schedule.block_time', 'schedule.edit_hours', 'billing.collect', 'messages.reply_on_behalf'], expansionMode: 'DYNAMIC' }],
      CATALOGO,
    );
    expect(todo.at(-1)).toBe(CLINICAL_RULE_SENTENCE);
    expect(todo.some((l) => l.startsWith('No puede'))).toBe(false);
  });
});

describe('catalogFromGrants', () => {
  it('arma un catálogo con los nombres que ya traen los permisos, sin otra consulta', () => {
    const catalogo = catalogFromGrants('Hospital', [
      { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'perez', practitionerName: 'Dr. Pérez' },
      { targetKind: 'LOCATION', careSpaceId: 'a-p1', locationName: 'Piso 1' },
    ]);

    expect(catalogo.doctors).toEqual([{ id: 'perez', name: 'Dr. Pérez', specialty: '', placements: [] }]);
    expect(describeTarget({ targetKind: 'LOCATION', careSpaceId: 'a-p1' }, catalogo)).toBe('en Piso 1');
  });
});
