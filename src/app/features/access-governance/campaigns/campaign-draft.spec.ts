import {
  buildDraft,
  buildFilters,
  buildScope,
  dueDateToIso,
  emptyDraft,
  kindAllowsRevoke,
  scopeSummaryText,
  stepProblems,
  type DraftForm,
} from './campaign-draft';

const AHORA = new Date('2026-11-03T12:00:00-04:00');
const con = (extra: Partial<DraftForm>): DraftForm => ({
  ...emptyDraft(AHORA),
  name: 'Certificación 2026',
  ...extra,
});
const CATALOGO = {
  doctors: [
    { id: 'd1', name: 'Dra. Rojas' },
    { id: 'd2', name: 'Dr. Pérez' },
  ],
  services: [{ id: 's1', name: 'Ecografía' }],
  locations: [{ id: 'l1', name: 'Piso 1' }],
};

describe('campaign-draft', () => {
  it('arranca con lo que el contrato recomienda: 30 días de plazo, gracia de 7, avisos 7-3-1, escalar a los 3 y retirar lo no certificado', () => {
    const d = emptyDraft(AHORA);
    expect(d).toMatchObject({
      kind: 'PERIODIC',
      scopeKind: 'ORGANIZATION',
      graceDays: 7,
      reminderDays: [7, 3, 1],
      escalateAfterDays: 3,
      uncertifiedAction: 'UNCERTIFIED_REVOKE',
    });
    expect(d.dueDate).toBe('2026-12-03');
  });

  it('arma el alcance según lo elegido y no manda lo que no corresponde', () => {
    expect(buildScope(con({}))).toEqual({ kind: 'ORGANIZATION' });
    expect(
      buildScope(con({ scopeKind: 'PRACTITIONER', doctorIds: ['d1'], serviceIds: ['s1'] })),
    ).toEqual({ kind: 'PRACTITIONER', practitionerRoleAssignmentIds: ['d1'] });
    expect(buildScope(con({ scopeKind: 'SERVICE', serviceIds: ['s1'] }))).toEqual({
      kind: 'SERVICE',
      healthcareServiceIds: ['s1'],
    });
    expect(buildScope(con({ scopeKind: 'LOCATION', locationIds: ['l1'] }))).toEqual({
      kind: 'LOCATION',
      careSpaceIds: ['l1'],
      practiceSiteIds: [],
    });
    expect(buildScope(con({ scopeKind: 'TEMPLATE', templateCodes: ['BILLING_CASHIER'] }))).toEqual({
      kind: 'TEMPLATE',
      templateCodes: ['BILLING_CASHIER'],
    });
  });

  it('arma los filtros solo con lo que se activó', () => {
    expect(buildFilters(con({}))).toBeUndefined();
    expect(
      buildFilters(con({ minSensitivity: 'HIGH', unusedDays: 60, onlySodFindings: true })),
    ).toEqual({ minSensitivity: 'HIGH', unusedDays: 60, onlySodFindings: true });
    expect(buildFilters(con({ includeSuspended: true, onlyAboveCeiling: true }))).toEqual({
      onlyAboveCeiling: true,
      includeSuspended: true,
    });
  });

  it('manda el borrador completo con el vencimiento al final del día elegido', () => {
    const d = buildDraft(
      con({
        scopeKind: 'SERVICE',
        serviceIds: ['s1'],
        minSensitivity: 'MEDIUM',
        dueDate: '2026-12-15',
        reminderDays: [3, 1],
        graceDays: 5,
        escalateAfterDays: 2,
        uncertifiedAction: 'UNCERTIFIED_ESCALATE',
      }),
    );
    expect(d).toMatchObject({
      name: 'Certificación 2026',
      kind: 'PERIODIC',
      scope: { kind: 'SERVICE', healthcareServiceIds: ['s1'] },
      filters: { minSensitivity: 'MEDIUM' },
      graceDays: 5,
      reminderDaysBefore: [3, 1],
      escalateAfterDays: 2,
      uncertifiedAction: 'UNCERTIFIED_ESCALATE',
    });
    expect(d.dueAt).toBe(dueDateToIso('2026-12-15'));
    expect(new Date(d.dueAt).getTime()).toBeGreaterThan(new Date('2026-12-15T00:00:00').getTime());
    expect(Number.isNaN(new Date(dueDateToIso('xx')).getTime())).toBe(true);
  });

  it('una campaña de cambio de rol solo escala: no se ofrece quitar sin revisar', () => {
    expect(kindAllowsRevoke('PERIODIC')).toBe(true);
    expect(kindAllowsRevoke('MOVER')).toBe(false);
  });

  it('paso 1: pide nombre de 3 a 120 caracteres y al menos un objetivo cuando el alcance no es toda la organización', () => {
    expect(stepProblems(1, con({}), AHORA)).toEqual([]);
    expect(stepProblems(1, con({ name: 'ab' }), AHORA)).toEqual([
      { field: 'name', message: 'Escriba un nombre de al menos 3 caracteres.' },
    ]);
    expect(stepProblems(1, con({ name: 'x'.repeat(121) }), AHORA)[0]?.field).toBe('name');
    expect(stepProblems(1, con({ scopeKind: 'PRACTITIONER' }), AHORA)).toEqual([
      { field: 'scope', message: 'Elija al menos un doctor.' },
    ]);
    expect(stepProblems(1, con({ scopeKind: 'SERVICE' }), AHORA)[0]?.message).toBe(
      'Elija al menos un servicio.',
    );
    expect(stepProblems(1, con({ scopeKind: 'LOCATION' }), AHORA)[0]?.message).toBe(
      'Elija al menos una ubicación.',
    );
    expect(stepProblems(1, con({ scopeKind: 'TEMPLATE' }), AHORA)[0]?.message).toBe(
      'Elija al menos un rol.',
    );
  });

  it('paso 2: los días sin uso, si se piden, son un entero entre 1 y 365', () => {
    expect(stepProblems(2, con({ unusedDays: 60 }), AHORA)).toEqual([]);
    expect(stepProblems(2, con({ unusedDays: 0 }), AHORA)[0]?.field).toBe('unusedDays');
    expect(stepProblems(2, con({ unusedDays: 400 }), AHORA)[0]?.field).toBe('unusedDays');
  });

  it('paso 3: fecha futura, gracia de 0 a 30, escalamiento de 1 a 30', () => {
    expect(stepProblems(3, con({}), AHORA)).toEqual([]);
    expect(stepProblems(3, con({ dueDate: '' }), AHORA)[0]).toEqual({
      field: 'dueDate',
      message: 'Elija la fecha límite.',
    });
    expect(stepProblems(3, con({ dueDate: '2026-11-01' }), AHORA)[0]).toEqual({
      field: 'dueDate',
      message: 'La fecha límite debe ser de hoy en adelante.',
    });
    expect(stepProblems(3, con({ graceDays: 31 }), AHORA)[0]?.field).toBe('graceDays');
    expect(stepProblems(3, con({ escalateAfterDays: 0 }), AHORA)[0]?.field).toBe(
      'escalateAfterDays',
    );
  });

  it('resume el alcance con nombres, no con códigos', () => {
    expect(scopeSummaryText(con({}), CATALOGO)).toBe('Toda la organización');
    expect(
      scopeSummaryText(con({ scopeKind: 'PRACTITIONER', doctorIds: ['d1', 'd2'] }), CATALOGO),
    ).toBe('Doctores: Dra. Rojas, Dr. Pérez');
    expect(scopeSummaryText(con({ scopeKind: 'SERVICE', serviceIds: ['s1'] }), CATALOGO)).toBe(
      'Servicios: Ecografía',
    );
    expect(scopeSummaryText(con({ scopeKind: 'LOCATION', locationIds: ['l1'] }), CATALOGO)).toBe(
      'Ubicaciones: Piso 1',
    );
    expect(
      scopeSummaryText(
        con({ scopeKind: 'TEMPLATE', templateCodes: ['BILLING_CASHIER'] }),
        CATALOGO,
      ),
    ).toBe('Roles: Caja y facturación');
  });
});
