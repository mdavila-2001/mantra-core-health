import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import type { RoleAssignment } from '../../../../../core/data-access/authz-admin/authz-admin.types';
import {
  assignmentFailure,
  byRelevance,
  failureNeedsReload,
  globalRoleTiedToTenant,
  roleCodesOf,
  scopeSummary,
} from './access.model';

const rejected = (reason: string | null, message = 'Texto del servidor') =>
  new HttpErrorResponse({
    status: 422,
    error: { code: 'PRECONDITION_FAILED', message, ...(reason ? { reason } : {}), timestamp: '', path: '' },
  });

const assignment = (over: Partial<RoleAssignment>): RoleAssignment => ({
  id: 'a1',
  roleId: 'r1',
  roleCode: 'DPO',
  roleName: 'DPO',
  roleScope: 'GLOBAL',
  tenantId: null,
  branchId: null,
  practiceId: null,
  status: 'ACTIVE',
  isEffective: true,
  appliesGlobally: true,
  assignedByUserId: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
});

describe('access.model', () => {
  it('explica el rol global con organización por su motivo, no por el texto del servidor', () => {
    const text = assignmentFailure(rejected('ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE', 'otro texto'), 'fallback');
    expect(text).toContain('ámbito global');
    expect(text).toContain('Toda la plataforma');
    expect(text).not.toContain('otro texto');
  });

  it('un motivo desconocido cae en la descripción genérica del error', () => {
    const text = assignmentFailure(rejected('SOMETHING_NEW'), 'No se pudo asignar el rol.');
    expect(text).not.toContain('ámbito global');
    expect(text.length).toBeGreaterThan(0);
  });

  it('una asignación ya inactiva o inexistente pide volver a leer la lista', () => {
    expect(failureNeedsReload(rejected('ROLE_ASSIGNMENT_NOT_ACTIVE'))).toBe(true);
    expect(failureNeedsReload(rejected('ROLE_ASSIGNMENT_NOT_FOUND'))).toBe(true);
    expect(failureNeedsReload(rejected('ROLE_ASSIGNMENT_ALREADY_ACTIVE'))).toBe(false);
  });

  it('el alcance se dice en palabras, nunca con un identificador', () => {
    expect(scopeSummary(assignment({}))).toBe('En toda la plataforma');
    expect(scopeSummary(assignment({ tenantId: 't1', appliesGlobally: false }))).toBe('En una organización');
    expect(scopeSummary(assignment({ tenantId: 't1', branchId: 'b1', appliesGlobally: false }))).toBe('En una sede');
    expect(scopeSummary(assignment({ roleScope: 'TENANT', appliesGlobally: false }))).toBe('Sin organización');
  });

  it('avisa del rol global activo que quedó atado a una organización', () => {
    expect(globalRoleTiedToTenant(assignment({ tenantId: 't1', appliesGlobally: false }))).toBe(true);
    expect(globalRoleTiedToTenant(assignment({}))).toBe(false);
    expect(globalRoleTiedToTenant(assignment({ tenantId: 't1', appliesGlobally: false, status: 'REVOKED' }))).toBe(false);
  });

  it('ordena las activas primero y, dentro, la más nueva arriba', () => {
    const old = assignment({ id: 'old', createdAt: new Date('2026-01-01') });
    const recent = assignment({ id: 'recent', createdAt: new Date('2026-09-01') });
    const revoked = assignment({ id: 'revoked', status: 'REVOKED', createdAt: new Date('2026-10-20') });
    expect([revoked, old, recent].sort(byRelevance).map((a) => a.id)).toEqual(['recent', 'old', 'revoked']);
  });

  it('junta los roles globales y los asignados sin repetir', () => {
    expect(
      roleCodesOf({
        id: 'u',
        displayName: 'Ana',
        statusConceptId: 'c',
        globalRoles: ['SECURITY_ADMIN'],
        assignments: [
          { assignmentId: 'a', roleCode: 'DPO', roleName: 'DPO', tenantId: null },
          { assignmentId: 'b', roleCode: 'SECURITY_ADMIN', roleName: 'x', tenantId: null },
        ],
      }),
    ).toEqual(['SECURITY_ADMIN', 'DPO']);
  });
});
