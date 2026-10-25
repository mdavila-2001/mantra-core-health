import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { HealthcareServicesClient } from '../../../core/data-access/healthcare-services/healthcare-services.client';
import { RoleAssignmentsClient } from '../../../core/data-access/role-assignments/role-assignments.client';
import type { RoleAssignmentRow } from '../../../core/data-access/role-assignments/role-assignments.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import { PractitionerAffiliations } from './practitioner-affiliations';

function row(id: string, statusCode: string, initiatedBy: 'PRACTICE' | 'PRACTITIONER', site = 'site-1'): RoleAssignmentRow {
  return {
    id,
    practitionerProfileId: 'pp-1',
    practitionerName: 'Dra. Rojas',
    practiceId: 'pr-1',
    practiceSiteId: site,
    healthcareServiceId: `hs-${id}`,
    serviceConceptId: `c-${id}`,
    serviceDisplay: `Procedimiento ${id}`,
    statusConceptId: `st-${statusCode}`,
    statusCode,
    initiatedBy,
  };
}

const SITE = { id: 'site-1', practiceId: 'pr-1', code: 'N1', name: 'Sede Norte 1', timeZone: null, addressText: null, latitude: null, longitude: null, status: 'ACTIVE' };

describe('PractitionerAffiliations', () => {
  let fixture: ComponentFixture<PractitionerAffiliations>;
  let rows: RoleAssignmentRow[];
  let listForPractice: ReturnType<typeof vi.fn>;
  let approve: ReturnType<typeof vi.fn>;
  let reject: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    rows = [
      row('a', 'ROLE_ASG_PENDING', 'PRACTITIONER'),
      row('b', 'ROLE_ASG_INVITED', 'PRACTICE'),
      row('c', 'ROLE_ASG_ACTIVE', 'PRACTITIONER'),
      row('d', 'ROLE_ASG_PENDING', 'PRACTITIONER', 'site-2'),
    ];
    listForPractice = vi.fn(() => of(rows));
    approve = vi.fn((id: string) => {
      rows = rows.map((r) => (r.id === id ? { ...r, statusCode: 'ROLE_ASG_ACTIVE' } : r));
      return of(rows.find((r) => r.id === id)!);
    });
    reject = vi.fn((id: string) => {
      rows = rows.map((r) => (r.id === id ? { ...r, statusCode: 'ROLE_ASG_REJECTED' } : r));
      return of(rows.find((r) => r.id === id)!);
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([{ id: 'pr-1', code: 'CMN', name: 'Centro Médico Norte' }]) } },
        { provide: HealthcareServicesClient, useValue: { listSites: () => of([SITE]), listOffers: () => of([]) } },
        { provide: RoleAssignmentsClient, useValue: { listForPractice, approve, reject } },
        { provide: ProfilesClient, useValue: { listPractitioners: () => of({ items: [], nextCursor: null }) } },
      ],
    });
    fixture = TestBed.createComponent(PractitionerAffiliations);
    fixture.detectChanges();
  });

  it('lista la práctica y la sede elegidas, con estado e iniciador, y solo las filas de esa sede', () => {
    expect(listForPractice).toHaveBeenCalledWith('pr-1');
    expect(byId('affiliation-status-a')?.textContent).toContain('Pendiente del centro');
    expect(byId('affiliation-initiator-a')?.textContent).toContain('Pedido por el médico');
    expect(byId('affiliation-status-b')?.textContent).toContain('Pendiente de aceptación del médico');
    expect(byId('affiliation-initiator-b')?.textContent).toContain('Invitado por el centro');
    expect(byId('affiliation-status-c')?.textContent).toContain('Activa');
    expect(byId('affiliation-status-d')).toBeNull();
  });

  it('aprobar y rechazar solo existen sobre lo pendiente del centro', () => {
    expect(byId('affiliation-approve-a')).not.toBeNull();
    expect(byId('affiliation-reject-a')).not.toBeNull();
    // INVITED espera al médico y ACTIVE ya está resuelta: ninguna se puede aprobar desde acá.
    expect(byId('affiliation-approve-b')).toBeNull();
    expect(byId('affiliation-reject-b')).toBeNull();
    expect(byId('affiliation-approve-c')).toBeNull();
  });

  it('aprobar llama a la API, recarga y pinta el estado que devolvió', () => {
    (byId('affiliation-approve-a') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(approve).toHaveBeenCalledWith('a');
    expect(listForPractice).toHaveBeenCalledTimes(2);
    expect(byId('affiliation-status-a')?.textContent).toContain('Activa');
    expect(byId('affiliation-approve-a')).toBeNull();
  });

  it('rechazar pasa la solicitud a «Rechazada»', () => {
    (byId('affiliation-reject-a') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(reject).toHaveBeenCalledWith('a');
    expect(byId('affiliation-status-a')?.textContent).toContain('Rechazada');
  });

  it('«Invitar a un médico» abre el formulario de la sede elegida', () => {
    expect(host().querySelector('app-practitioner-invite-form')).toBeNull();
    (byId('affiliations-invite-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host().querySelector('app-practitioner-invite-form')).not.toBeNull();
  });
});
