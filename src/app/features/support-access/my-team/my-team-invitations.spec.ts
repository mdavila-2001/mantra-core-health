import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import { PracticeSitesClient } from '../../../core/data-access/practice-sites/practice-sites.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { DoctorTeamMember } from '../../../core/data-access/support-access/support-access.types';
import { MyTeam } from './my-team';

const ACTIVA: DoctorTeamMember = {
  delegateId: 'dl-ana',
  practitionerRoleAssignmentId: 'ra-1',
  personName: 'Ana Gutiérrez',
  roleTemplate: 'SECRETARY',
  organizationName: 'Hospital Piloto',
  status: 'ACTIVE',
  delegateStatus: 'ACTIVE',
  accepted: true,
  actions: ['schedule.view'],
  mayReplyOnBehalf: false,
  replyDisclosure: 'SHOW',
  coverageSummary: 'Cubre toda su agenda.',
  pendingClinicalRequests: [],
};

/** Lo que la API cuenta de una invitación del doctor: pendiente, iniciada por él, esperando a la secretaria. */
const INVITACION = {
  ...ACTIVA,
  delegateId: 'inv-lucia',
  personName: 'Lucía Paz',
  status: 'PENDING_ACCEPTANCE',
  accepted: false,
  actions: [],
  coverageSummary: 'La invitó a asistirlo.',
  initiatedBy: 'PRACTITIONER',
  awaiting: 'SUPPORT_STAFF',
  createdAt: '2026-10-31T10:00:00.000Z',
} as unknown as DoctorTeamMember;

/** Con la forma real de la API (`SupportLinkViewDto`): `id`, sin `delegateId`, `status: 'PENDING'`. */
const INVITACION_DE_LA_API = {
  id: 'link-api-1',
  kind: 'PRACTITIONER',
  status: 'PENDING',
  personName: 'Marcos Ribera',
  organizationName: 'Hospital Piloto',
  initiatedBy: 'PRACTITIONER',
  awaiting: 'SUPPORT_STAFF',
  createdAt: '2026-10-31T11:00:00.000Z',
} as unknown as DoctorTeamMember;

/** Un integrante sin iniciador (`initiatedBy: null`): nadie lo decide, así que no es una invitación del doctor. */
const SIN_INICIADOR = {
  ...ACTIVA,
  delegateId: 'sin-iniciador',
  personName: 'Rosa Quiroga',
  initiatedBy: null,
  awaiting: null,
} as unknown as DoctorTeamMember;

describe('MyTeam · invitar a una secretaria', () => {
  let fixture: ComponentFixture<MyTeam>;
  let getMyTeam: ReturnType<typeof vi.fn>;
  let inviteSupportStaff: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  async function montar(equipo: () => readonly DoctorTeamMember[]): Promise<void> {
    getMyTeam = vi.fn(() => of({ items: equipo() }));
    inviteSupportStaff = vi.fn(() =>
      of({ id: 'link-1', tenantId: 't-1', items: [{ personName: 'Lucía Paz' }] }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SupportAccessClient, useValue: { getMyTeam, getMyTeamActivity: () => of({ items: [] }), inviteSupportStaff } },
        { provide: DelegatedAccessClient, useValue: {} },
        {
          provide: PracticeSitesClient,
          useValue: {
            listMyRoleAssignments: () =>
              of([
                {
                  id: 'ra-1',
                  practiceId: 'p-1',
                  practiceName: 'Hospital Piloto',
                  roleConceptId: 'r',
                  status: 's',
                  statusCode: 'ROLE_ASG_ACTIVE',
                  isPrimary: false,
                  createdAt: new Date(),
                  avatarUrl: null,
                  tenantId: 't-1',
                },
              ]),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MyTeam);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('la invitación que espera a la secretaria no es una persona del equipo: no ofrece aceptarla ni retirarla', async () => {
    await montar(() => [ACTIVA, INVITACION]);

    expect(byId('miembro-dl-ana')).not.toBeNull();
    expect(byId('miembro-inv-lucia')).toBeNull();
    expect(byId('aceptar-inv-lucia')).toBeNull();
    expect(byId('retirar-inv-lucia')).toBeNull();
    expect(byId('invitacion-estado-inv-lucia')!.textContent).toContain('Espera su respuesta');
    expect(byId('invitacion-enviada-inv-lucia')!.textContent).toContain('Lucía Paz');
  });

  it('una invitación con la forma real de la API se muestra con su id, sin claves repetidas ni «undefined»', async () => {
    await montar(() => [INVITACION_DE_LA_API, { ...INVITACION_DE_LA_API, id: 'link-api-3', personName: 'Lucía Paz' } as unknown as DoctorTeamMember]);

    expect(byId('invitacion-enviada-link-api-1')!.textContent).toContain('Marcos Ribera');
    expect(byId('invitacion-enviada-link-api-3')!.textContent).toContain('Lucía Paz');
    expect(host().innerHTML).not.toContain('undefined');
  });

  it('un vínculo con initiatedBy null no se cuenta como invitación enviada', async () => {
    await montar(() => [INVITACION_DE_LA_API, SIN_INICIADOR]);

    expect(byId('invitacion-enviada-link-api-1')).not.toBeNull();
    expect(byId('invitacion-enviada-sin-iniciador')).toBeNull();
    // Sigue donde estaba: en el equipo.
    expect(byId('miembro-sin-iniciador')).not.toBeNull();
  });

  it('con solo invitaciones el equipo sigue vacío: una invitación no cuenta como equipo', async () => {
    await montar(() => [INVITACION]);

    expect(host().textContent).toContain('Todavía no tiene equipo de apoyo.');
    expect(byId('invitacion-enviada-inv-lucia')).not.toBeNull();
  });

  it('al quedar guardada una invitación, «Mi equipo» vuelve a leer y muestra lo que devolvió la API', async () => {
    let equipo: readonly DoctorTeamMember[] = [ACTIVA];
    await montar(() => equipo);
    expect(getMyTeam).toHaveBeenCalledTimes(1);
    expect(byId('invitacion-enviada-inv-lucia')).toBeNull();

    byId('invitar-abrir')!.click();
    fixture.detectChanges();
    const documento = host().querySelector('input[data-testid="invitar-documento"]') as HTMLInputElement;
    documento.value = '7005002';
    documento.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // La API, al guardar, deja la invitación en la lista del equipo.
    equipo = [ACTIVA, INVITACION];
    byId('invitar-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(inviteSupportStaff).toHaveBeenCalledWith({ nationalId: '7005002', practitionerRoleAssignmentId: 'ra-1' });
    expect(getMyTeam).toHaveBeenCalledTimes(2);
    expect(byId('invitacion-enviada-inv-lucia')!.textContent).toContain('Espera su respuesta');
    expect(byId('invitar-exito')).not.toBeNull();
  });
});
