import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { SessionStore } from '../../auth/session.store';
import { PracticeSitesClient } from '../practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '../practice-sites/role-assignment-concepts';
import { AccountingClient } from './accounting.client';
import { AccountingPractices } from './accounting-practices';

/**
 * La contabilidad sólo ofrece las prácticas que la API va a aceptar
 * (`assertPracticeAccess`). Origen: auditoría contra la API real del
 * 2026-10-23 — un médico nuevo veía cuatro pantallas en 422.
 */
describe('AccountingPractices', () => {
  const own = { id: 'practice-own', name: 'Mi consultorio' };
  const foreign = { id: 'practice-foreign', name: 'Práctica de otra persona' };
  const pending = { id: 'practice-pending', name: 'Clínica en trámite' };

  function setup(roles: string[], assignments: { practiceId: string; status: string }[]) {
    const listMyRoleAssignments = vi.fn(() => of(assignments));
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionStore, useValue: { roles: signal(roles) } },
        { provide: AccountingClient, useValue: { listPractices: () => of([own, foreign, pending]) } },
        { provide: PracticeSitesClient, useValue: { listMyRoleAssignments } },
      ],
    });
    return { service: TestBed.inject(AccountingPractices), listMyRoleAssignments };
  }

  it('un médico ve sólo las prácticas con vinculación activa', async () => {
    const { service } = setup(
      ['PRACTITIONER'],
      [
        { practiceId: own.id, status: ROLE_ASSIGNMENT_STATUS.ACTIVE },
        { practiceId: pending.id, status: ROLE_ASSIGNMENT_STATUS.PENDING },
      ],
    );
    expect(await firstValueFrom(service.list())).toEqual([own]);
  });

  it('un médico sin vinculaciones no recibe ninguna práctica ajena', async () => {
    const { service } = setup(['PRACTITIONER'], []);
    expect(await firstValueFrom(service.list())).toEqual([]);
  });

  it.each([
    [['PRACTITIONER', 'SECURITY_ADMIN']],
    [['PRACTITIONER', 'ACCOUNTING_APPROVER']],
    [['SECURITY_ADMIN']],
    [['PATIENT']],
  ])('%j ve todas las prácticas, como en la API', async (roles) => {
    const { service, listMyRoleAssignments } = setup(roles, []);
    expect(await firstValueFrom(service.list())).toEqual([own, foreign, pending]);
    expect(listMyRoleAssignments).not.toHaveBeenCalled();
  });
});
