import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { HealthcareServicesClient } from '../../../../core/data-access/healthcare-services/healthcare-services.client';
import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import { MyProcedures } from './my-procedures';

function mine(id: string, statusCode: string, practiceId: string, siteId: string, practiceName: string, extra: Partial<MyRoleAssignment> = {}): MyRoleAssignment {
  return {
    id,
    practiceId,
    practiceName,
    practiceSiteId: siteId,
    roleConceptId: 'role',
    healthcareServiceId: `hs-${id}`,
    serviceConceptId: `c-${id}`,
    serviceDisplay: `Procedimiento ${id}`,
    status: statusCode,
    statusConceptId: statusCode,
    statusCode,
    initiatedBy: 'PRACTITIONER',
    isPrimary: false,
    createdAt: new Date('2026-10-01'),
    avatarUrl: null,
    tenantId: null,
    ...extra,
  };
}

const site = (id: string, practiceId: string, name: string) => ({ id, practiceId, code: id, name, timeZone: null, addressText: null, latitude: null, longitude: null, status: 'ACTIVE' });

describe('MyProcedures', () => {
  let fixture: ComponentFixture<MyProcedures>;
  let list: MyRoleAssignment[];
  let listSites: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  function build(): void {
    listSites = vi.fn((practiceId: string) =>
      of(practiceId === 'pr-n' ? [site('site-n1', 'pr-n', 'Sede Norte 1')] : [site('site-s1', 'pr-s', 'Sede Sur 1')]),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: PracticeSitesClient, useValue: { listMyRoleAssignments: () => of(list), selfRequestAffiliation: vi.fn() } },
        { provide: HealthcareServicesClient, useValue: { listSites, listOffers: () => of([]) } },
        { provide: ServicesCatalogClient, useValue: { listPractices: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(MyProcedures);
    fixture.detectChanges();
  }

  beforeEach(() => {
    list = [
      mine('a', 'ROLE_ASG_ACTIVE', 'pr-s', 'site-s1', 'Centro Médico Sur'),
      mine('b', 'ROLE_ASG_PENDING', 'pr-s', 'site-s1', 'Centro Médico Sur'),
      mine('c', 'ROLE_ASG_INVITED', 'pr-n', 'site-n1', 'Centro Médico Norte', { initiatedBy: 'PRACTICE' }),
      mine('legacy', 'ROLE_ASG_ACTIVE', 'pr-x', 'site-x', 'Clínica de siempre', { healthcareServiceId: undefined, statusCode: undefined }),
    ];
  });

  it('agrupa por centro y por sede, con el estado de cada procedimiento', () => {
    build();

    expect(byId('procedures-center-pr-s')?.textContent).toContain('Centro Médico Sur');
    expect(byId('procedures-site-site-s1')?.textContent).toContain('Sede Sur 1');
    expect(byId('procedure-status-a')?.textContent).toContain('Activa');
    expect(byId('procedure-status-b')?.textContent).toContain('Pendiente del centro');
    expect(byId('procedures-site-site-n1')?.textContent).toContain('Sede Norte 1');
    expect(byId('procedure-status-c')?.textContent).toContain('Pendiente de aceptación del médico');
    expect(byId('procedure-b')?.textContent).toContain('Pedido por el médico');
    expect(byId('procedure-c')?.textContent).toContain('Invitado por el centro');
  });

  it('no mezcla las vinculaciones de siempre, que no son de un procedimiento', () => {
    build();
    expect(byId('procedures-center-pr-x')).toBeNull();
  });

  it('si no se puede nombrar una sede, la lista sigue y dice «Sede»', () => {
    build();
    listSites.mockReturnValue(throwError(() => new Error('sin red')));
    fixture.componentInstance['reload']();
    fixture.detectChanges();

    expect(byId('procedure-status-a')?.textContent).toContain('Activa');
    expect(byId('procedures-site-site-s1')?.textContent).toContain('Sede');
  });

  it('sin procedimientos dice qué hacer', () => {
    list = [];
    build();
    expect(host().textContent).toContain('Todavía no hace procedimientos en ningún centro');
  });

  it('«Agregar un procedimiento» abre la solicitud, que queda pendiente del centro', () => {
    build();
    (byId('procedures-add-open') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(host().querySelector('app-affiliation-request-form')).not.toBeNull();
  });
});
