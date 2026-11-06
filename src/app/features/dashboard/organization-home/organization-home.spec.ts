import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { OrganizationLogoClient } from '../../../core/data-access/directory/organization-logo.client';
import type { MyOrganization } from '../../../core/data-access/directory/directory.types';
import { OrganizationHome } from './organization-home';

const ORG = {
  id: 't-1',
  legalName: 'Consultorio Los Pinos',
  isVerified: false,
  canAdminister: true,
  taxIdentifier: '123',
  legalRepresentative: { role: 'LEGAL_REPRESENTATIVE', fullName: 'Wendy Dávila' },
  legalDocuments: [{ role: 'A', verificationStatus: 'PENDIENTE' }],
} as unknown as MyOrganization;

describe('OrganizationHome', () => {
  let fixture: ComponentFixture<OrganizationHome>;
  const directory = {
    listMyOrganizations: vi.fn(),
    listMemberships: vi.fn(),
    getTenantAgenda: vi.fn(),
    listPractitionerRequests: vi.fn(),
  };
  const logo = { getUrl: vi.fn() };
  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const byId = (id: string): HTMLElement | null => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  function mount(tenantType = 'MEDICAL_OFFICE'): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DirectoryClient, useValue: directory },
        { provide: OrganizationLogoClient, useValue: logo },
        { provide: AuthService, useValue: { activeTenantId: () => 't-1', activeTenantType: () => tenantType } },
      ],
    });
    fixture = TestBed.createComponent(OrganizationHome);
    fixture.detectChanges();
  }

  beforeEach(() => {
    Object.values(directory).forEach((fn) => fn.mockReset());
    directory.listMyOrganizations.mockReturnValue(of([ORG]));
    directory.listMemberships.mockReturnValue(
      of({ items: [{ tenantRoleCode: 'OWNER' }, { tenantRoleCode: 'STAFF' }, { tenantRoleCode: 'STAFF' }], nextCursor: null }),
    );
    directory.getTenantAgenda.mockReturnValue(of({ items: [{}, {}], truncated: false }));
    directory.listPractitionerRequests.mockReturnValue(of([{}]));
    logo.getUrl.mockReturnValue(of(null));
  });

  it('shows the status of the organization, its team and today for a medical organization', () => {
    mount();

    expect(text()).toContain('Pendiente de verificación');
    expect(byId('inicio-estado-representative')?.textContent).toContain('Wendy Dávila');
    expect(byId('inicio-estado-documents')?.textContent).toContain('1 en revisión de 1.');
    expect(byId('inicio-estado-logo')?.textContent).toContain('Todavía no lo cargó.');
    expect(byId('inicio-equipo-total')?.textContent).toContain('3');
    expect(byId('inicio-citas-hoy')?.textContent).toContain('2');
    expect(byId('inicio-solicitudes')?.textContent).toContain('1');
  });

  it('does not ask for the agenda of an organization that does not attend patients', () => {
    mount('PHARMACY');

    expect(directory.getTenantAgenda).not.toHaveBeenCalled();
    expect(byId('inicio-citas-hoy')).toBeNull();
    expect(byId('inicio-equipo-total')).not.toBeNull();
  });

  it('a failing block does not take the others down', () => {
    directory.listMemberships.mockReturnValue(throwError(() => new Error('boom')));
    mount();

    expect(byId('inicio-estado-lista')).not.toBeNull();
    expect(byId('inicio-citas-hoy')).not.toBeNull();
    expect(byId('inicio-equipo-total')).toBeNull();
  });
});
