import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleAssignmentsClient } from '../../../core/data-access/role-assignments/role-assignments.client';
import type { RoleAssignmentRow } from '../../../core/data-access/role-assignments/role-assignments.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import { DoctorAccess } from './doctor-access';

function row(id: string, statusCode: string): RoleAssignmentRow {
  return {
    id,
    practitionerProfileId: `pp-${id}`,
    practitionerName: `Dra. ${id}`,
    practiceId: 'pr-1',
    practiceSiteId: 'site-1',
    healthcareServiceId: `hs-${id}`,
    serviceConceptId: `c-${id}`,
    serviceDisplay: `Procedimiento ${id}`,
    statusConceptId: `st-${statusCode}`,
    statusCode,
    initiatedBy: 'PRACTICE',
  };
}

describe('DoctorAccess', () => {
  let fixture: ComponentFixture<DoctorAccess>;
  let rows: RoleAssignmentRow[];
  let listForPractice: ReturnType<typeof vi.fn>;
  let suspend: ReturnType<typeof vi.fn>;
  let end: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLButtonElement | null => host().querySelector(`[data-testid="${id}"]`);
  const set = (id: string, statusCode: string) => {
    rows = rows.map((r) => (r.id === id ? { ...r, statusCode } : r));
    return of(rows.find((r) => r.id === id)!);
  };

  beforeEach(() => {
    rows = [row('a', 'ROLE_ASG_ACTIVE'), row('b', 'ROLE_ASG_SUSPENDED'), row('c', 'ROLE_ASG_PENDING'), row('d', 'ROLE_ASG_ENDED')];
    listForPractice = vi.fn(() => of(rows));
    suspend = vi.fn((id: string) => set(id, 'ROLE_ASG_SUSPENDED'));
    end = vi.fn((id: string) => set(id, 'ROLE_ASG_ENDED'));
    TestBed.configureTestingModule({
      providers: [
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([{ id: 'pr-1', code: 'CMN', name: 'Centro Médico Norte' }]) } },
        { provide: RoleAssignmentsClient, useValue: { listForPractice, suspend, end } },
      ],
    });
    fixture = TestBed.createComponent(DoctorAccess);
    fixture.detectChanges();
  });

  it('lists only the doctors who work there: active and suspended, not requests or ended ones', () => {
    expect(listForPractice).toHaveBeenCalledWith('pr-1');
    expect(byId('access-status-a')?.textContent).toContain('Activa');
    expect(byId('access-status-b')?.textContent).toContain('Suspendida');
    expect(byId('access-status-c')).toBeNull();
    expect(byId('access-status-d')).toBeNull();
  });

  it('offers «Suspender» only on an active access; «Terminar acceso» on both', () => {
    expect(byId('access-suspend-a')).not.toBeNull();
    expect(byId('access-suspend-b')).toBeNull();
    expect(byId('access-end-a')).not.toBeNull();
    expect(byId('access-end-b')).not.toBeNull();
  });

  it('suspending calls the API, reloads and paints the state that came back', () => {
    byId('access-suspend-a')!.click();
    fixture.detectChanges();

    expect(suspend).toHaveBeenCalledWith('a');
    expect(listForPractice).toHaveBeenCalledTimes(2);
    expect(byId('access-status-a')?.textContent).toContain('Suspendida');
    expect(byId('access-suspend-a')).toBeNull();
  });

  it('ending asks for a confirmation first and sends nothing until it is given', () => {
    byId('access-end-a')!.click();
    fixture.detectChanges();
    expect(end).not.toHaveBeenCalled();
    expect(host().textContent).toContain('No se puede deshacer');

    byId('access-end-cancel-a')!.click();
    fixture.detectChanges();
    expect(end).not.toHaveBeenCalled();
    expect(byId('access-end-a')).not.toBeNull();

    byId('access-end-a')!.click();
    fixture.detectChanges();
    byId('access-end-confirm-a')!.click();
    fixture.detectChanges();

    expect(end).toHaveBeenCalledWith('a');
    expect(byId('access-status-a')).toBeNull();
  });
});
