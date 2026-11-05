import type { TeamCapabilities } from '../../../core/data-access/access-governance/access-governance.types';
import type { SupportCatalog } from '../../../core/data-access/support-access/support-access.types';
import {
  atomBlockReason,
  canDo,
  ceilingFor,
  ceilingOf,
  describeAllowed,
  describeCeiling,
  inviteTemplates,
  maxValidDayFor,
  OUTSIDE_CEILING_TEXT,
  parseCapabilities,
  scopeSentence,
} from './team-ceiling';

const CATALOG: SupportCatalog = {
  organizationName: 'Hospital',
  doctors: [],
  services: [{ id: 'svc-eco', name: 'Ecografía' }],
  locations: [
    {
      id: 'floor-1',
      kind: 'LEVEL',
      name: 'Edificio A · Piso 1',
      parentId: null,
      path: '/a/floor-1/',
    },
  ],
};

const CEILING = {
  allowAtoms: ['agenda.*', 'patients.search.exact', 'messages.*'],
  forbidAtoms: ['agenda.hours.edit'],
  templates: ['SECRETARY', 'NURSING'],
  maxValidDays: 180,
};

const DELEGATED: TeamCapabilities = {
  mode: 'DELEGATED',
  atoms: ['team.members.view', 'team.grants.assign'],
  assignScopes: [
    { target: { targetKind: 'SERVICE', healthcareServiceId: 'svc-eco' }, ceiling: CEILING },
  ],
};

describe('team-ceiling', () => {
  const abilities = parseCapabilities(DELEGATED, CATALOG);

  it('lee el alcance y el techo del jefe de servicio y los nombra con el catálogo', () => {
    expect(abilities.mode).toBe('DELEGATED');
    expect(abilities.scopes[0]!.option.label).toBe('Servicio · Ecografía');
    expect(scopeSentence(abilities)).toBe('Usted administra: Ecografía.');
    expect(canDo(abilities, 'team.grants.assign')).toBe(true);
    expect(canDo(abilities, 'team.engagement.end')).toBe(false);
  });

  it('el administrador de seguridad administra toda la organización y puede todo lo que se delega', () => {
    const full = parseCapabilities({ mode: 'FULL', atoms: [], assignScopes: [] }, CATALOG);
    expect(scopeSentence(full)).toContain('toda la organización');
    expect(canDo(full, 'team.engagement.end')).toBe(true);
    expect(atomBlockReason('billing.payment.collect', null, 'FULL')).toBeNull();
  });

  it('explica con una sola frase lo que queda fuera del techo: no permitido, prohibido expresamente o de equipo', () => {
    const ceiling = ceilingOf(CEILING);
    expect(atomBlockReason('agenda.appointment.cancel', ceiling, 'DELEGATED')).toBeNull();
    expect(atomBlockReason('messages.inbox.view', ceiling, 'DELEGATED')).toBeNull();
    expect(atomBlockReason('billing.payment.collect', ceiling, 'DELEGATED')).toBe(
      OUTSIDE_CEILING_TEXT,
    );
    expect(atomBlockReason('agenda.hours.edit', ceiling, 'DELEGATED')).toBe(OUTSIDE_CEILING_TEXT);
    expect(atomBlockReason('team.grants.assign', ceiling, 'DELEGATED')).toBe(OUTSIDE_CEILING_TEXT);
    expect(atomBlockReason('agenda.appointment.cancel', null, 'DELEGATED')).toBe(
      OUTSIDE_CEILING_TEXT,
    );
  });

  it('un permiso que no se delega nunca lo dice distinto, también al administrador de seguridad', () => {
    expect(atomBlockReason('team.guardrails.manage', ceilingOf(CEILING), 'FULL')).toBe(
      'Este permiso no se puede dar al personal de apoyo.',
    );
  });

  it('cuenta el techo en palabras: qué puede dar, a quién y por cuánto tiempo', () => {
    const lines = describeCeiling(ceilingOf(CEILING));
    expect(lines[0]).toContain('todo lo de agenda');
    expect(lines[0]).toContain('todo lo de mensajería');
    expect(lines[1]).toBe('Solo a personas con el rol: secretaria, enfermería.');
    expect(lines[2]).toBe('Cada permiso vale hasta 180 días.');
    expect(describeAllowed('patients.search.exact')).not.toContain('patients.');
    expect(describeCeiling(ceilingOf({}))[0]).toContain('No puede dar permisos');
  });

  it('ofrece al invitar solo los roles del techo y fija el último día de vigencia', () => {
    expect(inviteTemplates(abilities)).toEqual(['SECRETARY', 'NURSING']);
    expect(maxValidDayFor(ceilingFor(abilities, 'otra-clave'), new Date(2026, 0, 1))).toBe(
      '2026-06-30',
    );
    expect(maxValidDayFor(null)).toBe('');
  });
});
