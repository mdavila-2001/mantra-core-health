import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { HealthcareServicesClient } from '../../../../core/data-access/healthcare-services/healthcare-services.client';
import { RoleAssignmentsClient } from '../../../../core/data-access/role-assignments/role-assignments.client';
import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import { AffiliationInvitations, isProcedureAffiliation } from './affiliation-invitations';

function mine(id: string, statusCode: string, extra: Partial<MyRoleAssignment> = {}): MyRoleAssignment {
  return {
    id,
    practiceId: 'pr-1',
    practiceName: 'Centro Médico Norte',
    practiceSiteId: 'site-1',
    roleConceptId: 'role',
    healthcareServiceId: `hs-${id}`,
    serviceConceptId: `c-${id}`,
    serviceDisplay: `Procedimiento ${id}`,
    status: `st-${statusCode}`,
    statusConceptId: `st-${statusCode}`,
    statusCode,
    initiatedBy: statusCode === 'ROLE_ASG_PENDING' ? 'PRACTITIONER' : 'PRACTICE',
    isPrimary: false,
    createdAt: new Date('2026-10-01'),
    avatarUrl: null,
    tenantId: null,
    ...extra,
  };
}

describe('AffiliationInvitations', () => {
  let fixture: ComponentFixture<AffiliationInvitations>;
  let list: MyRoleAssignment[];
  let accept: ReturnType<typeof vi.fn>;
  let decline: ReturnType<typeof vi.fn>;
  let listMyRoleAssignments: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  function build(): void {
    listMyRoleAssignments = vi.fn(() => of(list));
    accept = vi.fn((id: string) => {
      list = list.map((r) => (r.id === id ? { ...r, statusCode: 'ROLE_ASG_ACTIVE' } : r));
      return of({});
    });
    decline = vi.fn((id: string) => {
      list = list.map((r) => (r.id === id ? { ...r, statusCode: 'ROLE_ASG_REJECTED' } : r));
      return of({});
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: PracticeSitesClient, useValue: { listMyRoleAssignments, selfRequestAffiliation: vi.fn() } },
        { provide: RoleAssignmentsClient, useValue: { accept, decline } },
        { provide: HealthcareServicesClient, useValue: { listSites: () => of([]), listOffers: () => of([]) } },
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(AffiliationInvitations);
    fixture.detectChanges();
  }

  beforeEach(() => {
    list = [
      mine('a', 'ROLE_ASG_INVITED'),
      mine('b', 'ROLE_ASG_INVITED'),
      mine('c', 'ROLE_ASG_PENDING'),
      mine('d', 'ROLE_ASG_ACTIVE'),
      // una vinculación de siempre, sin procedimiento: no es de este carril
      mine('legacy', 'ROLE_ASG_ACTIVE', { healthcareServiceId: undefined, statusCode: undefined }),
    ];
  });

  it('solo cuenta como afiliación por procedimiento la que trae procedimiento y código de estado', () => {
    expect(isProcedureAffiliation(mine('x', 'ROLE_ASG_ACTIVE'))).toBe(true);
    expect(isProcedureAffiliation(mine('x', 'ROLE_ASG_ACTIVE', { healthcareServiceId: undefined }))).toBe(false);
    expect(isProcedureAffiliation(mine('x', 'ROLE_ASG_ACTIVE', { statusCode: undefined }))).toBe(false);
  });

  it('aceptar y rechazar existen solo sobre lo invitado por el centro', () => {
    build();
    expect(byId('invitation-accept-a')).not.toBeNull();
    expect(byId('invitation-decline-a')).not.toBeNull();
    // Una solicitud propia (PENDING) se espera; una activa ya está resuelta.
    expect(byId('invitation-accept-c')).toBeNull();
    expect(byId('invitation-accept-d')).toBeNull();
    expect(byId('request-c')?.textContent).toContain('Pendiente del centro');
  });

  it('aceptar llama a la API, recarga y la invitación deja de ofrecerse', () => {
    build();
    (byId('invitation-accept-a') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(accept).toHaveBeenCalledWith('a');
    expect(listMyRoleAssignments).toHaveBeenCalledTimes(2);
    expect(byId('invitation-a')).toBeNull();
    expect(byId('invitation-accept-b')).not.toBeNull();
  });

  it('rechazar llama a decline', () => {
    build();
    (byId('invitation-decline-b') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(decline).toHaveBeenCalledWith('b');
    expect(byId('invitation-b')).toBeNull();
  });

  it('«Aceptar todas» hace una llamada por procedimiento, sin aprobación en grupo', () => {
    build();
    (byId('invitations-accept-all') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(accept).toHaveBeenCalledTimes(2);
    expect(accept.mock.calls.map((call) => call[0])).toEqual(['a', 'b']);
    expect(byId('invitations-none')).not.toBeNull();
  });

  it('sin ninguna afiliación dice qué hacer en lugar de mostrar una lista vacía', () => {
    list = [];
    build();
    expect(host().textContent).toContain('No tiene invitaciones ni solicitudes');
  });

  it('«Pedir afiliarme a un centro» abre el formulario de solicitud', () => {
    build();
    (byId('invitations-request-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host().querySelector('app-affiliation-request-form')).not.toBeNull();
  });
});
