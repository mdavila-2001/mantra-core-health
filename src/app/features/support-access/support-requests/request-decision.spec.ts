import type { SupportEngagementRequest } from '../../../core/data-access/support-access/support-access.types';
import { approveAll, buildDecision, initialDrafts, type RequestDrafts } from './request-decision';

const SOLICITUD: SupportEngagementRequest = {
  id: 'r-1',
  tenantId: 't-1',
  organizationName: 'Hospital Piloto Mantra',
  requesterUserId: 'u-ana',
  requesterName: 'Ana Gutiérrez',
  direction: 'REQUEST',
  roleTemplate: 'SECRETARY',
  status: 'PENDING',
  expiresAt: '2026-11-15T00:00:00.000Z',
  createdAt: '2026-10-28T00:00:00.000Z',
  items: [
    { id: 'i-1', targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'd-1', proposedActions: ['schedule.view', 'schedule.create', 'schedule.cancel'], decision: 'PENDING' },
    { id: 'i-2', targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: 'd-2', proposedActions: ['schedule.view'], decision: 'PENDING' },
  ],
};

const nombre = (id: string): string => (id === 'i-1' ? 'Dr. Suárez' : 'Dr. Vaca');

describe('buildDecision', () => {
  it('sin ninguna decisión dice qué falta, ítem por ítem, y no manda nada', () => {
    const resultado = buildDecision(SOLICITUD, initialDrafts(SOLICITUD), nombre, '');

    expect(resultado.decision).toBeNull();
    expect(resultado.problems).toEqual(['Falta decidir: Dr. Suárez.', 'Falta decidir: Dr. Vaca.']);
  });

  it('la aprobación parcial: aprueba uno con ajustes y rechaza el otro con motivo', () => {
    const borradores: RequestDrafts = {
      'i-1': { decision: 'ADJUSTED', actions: ['schedule.view', 'schedule.create'], comment: '' },
      'i-2': { decision: 'REJECTED', actions: [], comment: 'No cubre a ese doctor.' },
    };

    const resultado = buildDecision(SOLICITUD, borradores, nombre, '  ');

    expect(resultado.problems).toEqual([]);
    expect(resultado.decision).toEqual({
      items: [
        { itemId: 'i-1', decision: 'ADJUSTED', actions: ['schedule.view', 'schedule.create'] },
        { itemId: 'i-2', decision: 'REJECTED', comment: 'No cubre a ese doctor.' },
      ],
    });
  });

  it('un ajuste sin acciones no se manda: dejaría a la persona sin nada', () => {
    const borradores: RequestDrafts = {
      'i-1': { decision: 'ADJUSTED', actions: [], comment: '' },
      'i-2': { decision: 'APPROVED', actions: [], comment: '' },
    };

    expect(buildDecision(SOLICITUD, borradores, nombre, '').problems).toEqual([
      'Elija al menos una acción para ajustar: Dr. Suárez.',
    ]);
  });

  it('rechazar exige el motivo', () => {
    const borradores: RequestDrafts = {
      'i-1': { decision: 'REJECTED', actions: [], comment: '   ' },
      'i-2': { decision: 'APPROVED', actions: [], comment: '' },
    };

    expect(buildDecision(SOLICITUD, borradores, nombre, '').problems).toEqual([
      'Escriba el motivo del rechazo: Dr. Suárez.',
    ]);
  });

  it('el motivo general viaja recortado, y solo si se escribió', () => {
    const todo = approveAll(SOLICITUD, initialDrafts(SOLICITUD));

    expect(buildDecision(SOLICITUD, todo, nombre, ' Aprobado por jefatura ').decision?.reasonText).toBe('Aprobado por jefatura');
    expect(buildDecision(SOLICITUD, todo, nombre, '').decision).not.toHaveProperty('reasonText');
  });
});

describe('approveAll', () => {
  it('aprueba cada ítem tal como se pidió, sin ajustes', () => {
    const resultado = buildDecision(SOLICITUD, approveAll(SOLICITUD, initialDrafts(SOLICITUD)), nombre, '');

    expect(resultado.decision?.items.map((v) => v.decision)).toEqual(['APPROVED', 'APPROVED']);
    expect(resultado.decision?.items.every((v) => v.actions === undefined)).toBe(true);
  });
});
