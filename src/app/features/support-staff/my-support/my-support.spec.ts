import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SupportStaffClient } from '../../../core/data-access/support-staff/support-staff.client';
import type { SupportLink } from '../../../core/data-access/support-staff/support-staff.types';
import { MySupport } from './my-support';

function vinculo(cambios: Partial<SupportLink>): SupportLink {
  return {
    id: 'l-1',
    kind: 'PRACTITIONER',
    targetKind: 'PRACTITIONER',
    tenantId: 't-hospital',
    organizationName: 'Hospital San Lucas',
    userId: 'u-rosa',
    personName: 'Rosa Choque',
    status: 'ACTIVE',
    initiatedBy: 'ORGANIZATION',
    awaiting: null,
    practiceSiteId: null,
    clinicalUnitId: null,
    careSpaceId: null,
    practitionerRoleAssignmentId: 'pra-rojas',
    practitionerProfileId: 'hpid-rojas',
    targetName: 'Dra. Valeria Rojas',
    createdAt: '2026-10-01T10:00:00Z',
    ...cambios,
  };
}

const INVITACION = vinculo({
  id: 'l-3',
  tenantId: 't-clinica',
  organizationName: 'Clínica Los Olivos',
  targetName: 'Dr. Ramiro Céspedes',
  status: 'PENDING',
  awaiting: 'SUPPORT_STAFF',
});

const VINCULOS = [
  vinculo({ id: 'l-1' }),
  vinculo({ id: 'l-2', kind: 'LOCATION', targetKind: 'SPACE', careSpaceId: 'piso-2', practitionerRoleAssignmentId: null, targetName: 'Piso 2 — Cardiología' }),
  vinculo({ id: 'l-5', targetName: 'Dr. Jorge Paz', status: 'ENDED' }),
  INVITACION,
];

describe('MySupport — lo que ve la secretaria', () => {
  let fixture: ComponentFixture<MySupport>;
  const aceptados: string[] = [];
  let renovaciones = 0;

  beforeEach(async () => {
    aceptados.length = 0;
    renovaciones = 0;
    await TestBed.configureTestingModule({
      imports: [MySupport],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            restoreSession: () => {
              renovaciones += 1;
              return of(true);
            },
          },
        },
        {
          provide: SupportStaffClient,
          useValue: {
            listMine: () => of({ items: VINCULOS, count: VINCULOS.length, requests: [INVITACION] }),
            getMyAccess: () =>
              of({
                tenants: [
                  {
                    tenantId: 't-hospital',
                    organizationName: 'Hospital San Lucas',
                    wholeOrganization: false,
                    organizationAccess: true,
                    practiceSiteIds: [],
                    clinicalUnitIds: [],
                    careSpaceIds: ['piso-2'],
                    practitioners: [{ linkId: 'l-1', practitionerRoleAssignmentId: 'pra-rojas', practitionerProfileId: 'h', name: 'Dra. Valeria Rojas' }],
                  },
                  {
                    // Sólo un doctor la aceptó: ni el hospital ni sus pisos se muestran.
                    tenantId: 't-japones',
                    organizationName: 'Hospital Japonés',
                    wholeOrganization: false,
                    organizationAccess: false,
                    practiceSiteIds: [],
                    clinicalUnitIds: [],
                    careSpaceIds: [],
                    practitioners: [{ linkId: 'l-7', practitionerRoleAssignmentId: 'pra-sato', practitionerProfileId: 'h2', name: 'Dr. Kenji Sato' }],
                  },
                ],
              }),
            getCatalogFor: () => of({ tenantId: 't-hospital', organizationName: 'Hospital San Lucas', sites: [], services: [], floors: [], practitioners: [] }),
            confirm: (id: string) => {
              aceptados.push(id);
              return of({ ...INVITACION, status: 'ACTIVE', awaiting: null });
            },
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MySupport);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function texto(testId: string): string {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`)?.textContent ?? '';
  }

  it('muestra sólo su hospital, su doctora y su piso: nada pendiente ni terminado', () => {
    expect(texto('mi-apoyo-hospitales')).toContain('Hospital San Lucas');
    expect(texto('mi-apoyo-hospitales')).not.toContain('Clínica Los Olivos');
    expect(texto('mi-apoyo-doctores')).toContain('Dra. Valeria Rojas');
    expect(texto('mi-apoyo-doctores')).not.toContain('Dr. Jorge Paz');
    expect(texto('mi-apoyo-pisos')).toContain('Piso 2 — Cardiología');
  });

  it('el doctor que la aceptó por su cuenta aparece sin su hospital', () => {
    expect(texto('mi-apoyo-doctores-directos')).toContain('Dr. Kenji Sato');
    expect(texto('mi-apoyo')).not.toContain('Hospital Japonés');
  });

  it('aceptar una invitación la confirma y renueva la sesión', () => {
    const componente = fixture.componentInstance as unknown as { accept: (l: SupportLink) => void };
    componente.accept(INVITACION);
    fixture.detectChanges();
    expect(aceptados).toEqual(['l-3']);
    expect(renovaciones).toBe(1);
    expect(texto('mi-apoyo-ok')).toContain('Dr. Ramiro Céspedes');
  });
});
