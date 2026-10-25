import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { HealthcareServicesClient } from '../../../../core/data-access/healthcare-services/healthcare-services.client';
import type { HealthcareServiceOffer } from '../../../../core/data-access/healthcare-services/healthcare-services.types';
import { RoleAssignmentsClient } from '../../../../core/data-access/role-assignments/role-assignments.client';
import type { RoleAssignmentRow } from '../../../../core/data-access/role-assignments/role-assignments.types';
import { PractitionerInviteForm } from './practitioner-invite-form';

const PROCEDURES: readonly HealthcareServiceOffer[] = [
  { id: 'hs-1', practiceSiteId: 'site-1', serviceConceptId: 'c-1', serviceDisplay: 'Endoscopia digestiva alta', serviceCatalogId: null, price: null, currencyConceptId: null, referencePrice: null, referenceUnit: null, overMargin: null, visibleInSearch: true, active: true },
  { id: 'hs-2', practiceSiteId: 'site-1', serviceConceptId: 'c-2', serviceDisplay: 'Colonoscopia', serviceCatalogId: null, price: null, currencyConceptId: null, referencePrice: null, referenceUnit: null, overMargin: null, visibleInSearch: true, active: true },
  { id: 'hs-3', practiceSiteId: 'site-1', serviceConceptId: 'c-3', serviceDisplay: 'Procedimiento retirado', serviceCatalogId: null, price: null, currencyConceptId: null, referencePrice: null, referenceUnit: null, overMargin: null, visibleInSearch: true, active: false },
];

const ROW: RoleAssignmentRow = {
  id: 'ra-1',
  practitionerProfileId: 'pp-1',
  practitionerName: 'Dra. Rojas',
  practiceId: 'pr-1',
  practiceSiteId: 'site-1',
  healthcareServiceId: 'hs-1',
  serviceConceptId: 'c-1',
  serviceDisplay: 'Endoscopia digestiva alta',
  statusConceptId: 'st',
  statusCode: 'ROLE_ASG_INVITED',
  initiatedBy: 'PRACTICE',
};

interface Internal {
  practitionerId: { set: (id: string | null) => void };
  toggle: (id: string, on: boolean) => void;
  canSubmit: () => boolean;
  submit: () => void;
  error: () => string | null;
}

describe('PractitionerInviteForm', () => {
  let fixture: ComponentFixture<PractitionerInviteForm>;
  let invite: ReturnType<typeof vi.fn>;
  let listOffers: ReturnType<typeof vi.fn>;
  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    invite = vi.fn(() => of([ROW]));
    listOffers = vi.fn(() => of(PROCEDURES));
    TestBed.configureTestingModule({
      providers: [
        { provide: RoleAssignmentsClient, useValue: { invite } },
        { provide: HealthcareServicesClient, useValue: { listOffers } },
        {
          provide: ProfilesClient,
          useValue: { listPractitioners: vi.fn(() => of({ items: [{ profileId: 'pp-1', practitionerCode: 'MED-1', displayName: 'Dra. Rojas' }], nextCursor: null })) },
        },
      ],
    });
    fixture = TestBed.createComponent(PractitionerInviteForm);
    fixture.componentRef.setInput('practiceId', 'pr-1');
    fixture.componentRef.setInput('practiceSiteId', 'site-1');
    fixture.detectChanges();
  });

  it('las casillas son los procedimientos que publica la sede, y de ninguna otra fuente', () => {
    expect(listOffers).toHaveBeenCalledWith('pr-1', 'site-1');
    expect(host().querySelector('[data-testid="invite-procedure-hs-1"]')).not.toBeNull();
    expect(host().querySelector('[data-testid="invite-procedure-hs-2"]')).not.toBeNull();
    expect(host().textContent).toContain('Colonoscopia');
    // Lo que la sede retiró (`active: false`) no se ofrece.
    expect(host().querySelector('[data-testid="invite-procedure-hs-3"]')).toBeNull();
  });

  it('no deja enviar sin médico ni sin procedimientos', () => {
    expect(internal().canSubmit()).toBe(false);
    internal().practitionerId.set('pp-1');
    expect(internal().canSubmit()).toBe(false);
    internal().toggle('hs-1', true);
    expect(internal().canSubmit()).toBe(true);
    internal().toggle('hs-1', false);
    expect(internal().canSubmit()).toBe(false);
  });

  it('envía el cuerpo exacto del contrato y avisa con las filas creadas', () => {
    const invited: (readonly RoleAssignmentRow[])[] = [];
    fixture.componentInstance.invited.subscribe((rows) => invited.push(rows));

    internal().practitionerId.set('pp-1');
    internal().toggle('hs-1', true);
    internal().toggle('hs-2', true);
    internal().submit();

    expect(invite).toHaveBeenCalledWith('pr-1', { practitionerProfileId: 'pp-1', practiceSiteId: 'site-1', healthcareServiceIds: ['hs-1', 'hs-2'] });
    expect(invited).toEqual([[ROW]]);
  });

  it('si la API rechaza, muestra el motivo y no avisa de éxito', () => {
    invite.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Ya tiene una afiliación vigente' } })));
    const invited: unknown[] = [];
    fixture.componentInstance.invited.subscribe((rows) => invited.push(rows));

    internal().practitionerId.set('pp-1');
    internal().toggle('hs-1', true);
    internal().submit();
    fixture.detectChanges();

    expect(invited).toEqual([]);
    expect(internal().error()).not.toBeNull();
    expect(host().querySelector('[data-testid="invite-error"]')).not.toBeNull();
  });

  it('una sede sin procedimientos publicados lo dice y no ofrece casillas', () => {
    listOffers.mockReturnValue(of([]));
    fixture.componentRef.setInput('practiceSiteId', 'site-2');
    fixture.detectChanges();

    expect(host().querySelector('[data-testid="invite-no-procedures"]')).not.toBeNull();
    expect(host().querySelectorAll('app-checkbox').length).toBe(0);
  });
});
