import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import {
  EXPLICACION_ANA_FUERA_DE_HORARIO,
  elegir,
  falloDeApi,
  pulsar,
} from '../../../access-governance/simulator/simulator.fixtures';
import { TeamExplain } from './team-explain';

const ANA: DoctorTeamMember = {
  delegateId: 'dl-ana',
  userId: 'u-ana',
  engagementId: 'eng-ana',
  practitionerRoleAssignmentId: 'pra-1',
  tenantId: 't-hospital',
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

describe('TeamExplain', () => {
  let fixture: ComponentFixture<TeamExplain>;
  let explainTeam: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  async function abrir(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AccessExplainClient, useValue: { explainTeam } }],
    });
    fixture = TestBed.createComponent(TeamExplain);
    fixture.componentRef.setInput('member', ANA);
    await settle();
  }

  async function preguntar(): Promise<void> {
    await elegir(host(), 'explicar-equipo-accion', 'Crear citas', settle);
    await pulsar(host(), 'explicar-equipo-enviar', settle);
  }

  beforeEach(() => {
    explainTeam = vi.fn(() => of(EXPLICACION_ANA_FUERA_DE_HORARIO));
  });

  /**
   * `SupportTeamMemberDto.practitionerRoleAssignmentId` (ronda 2 de la API): la vinculación ya viene con el miembro. No se lee
   * `GET /practitioners/me/role-assignments`, no se pregunta «¿en cuál de sus vinculaciones?» ni se adivina por organización.
   */
  it('pregunta con la vinculación que trae el miembro, sin leer ni preguntar nada más', async () => {
    await abrir();
    expect(byId('equipo-vinculacion')).toBeNull();
    expect(byId('equipo-vinculacion-aviso')).toBeNull();
    await preguntar();
    expect(explainTeam).toHaveBeenCalledTimes(1);
    expect(explainTeam.mock.calls[0]![0]).toEqual({
      engagementId: 'eng-ana',
      practitionerRoleAssignmentId: 'pra-1',
      action: 'agenda.appointment.create',
    });
    expect(byId('veredicto')!.textContent).toContain('No puede');
    expect(byId('veredicto')!.textContent).toContain('Ana Gutiérrez');
  });

  it('una persona ajena a su agenda se ve como «no encontrado», sin pistas', async () => {
    explainTeam.mockReturnValue(
      throwError(() =>
        falloDeApi(404, 'NOT_FOUND', 'SUPPORT_ENGAGEMENT_NOT_FOUND', 'No hay vínculo eng-ana'),
      ),
    );
    await abrir();
    await preguntar();
    expect(byId('veredicto')).toBeNull();
    expect(host().textContent).not.toContain('eng-ana');
  });

  it('cerrar el diálogo avisa a quien lo abrió', async () => {
    await abrir();
    let cerrado = 0;
    fixture.componentInstance.closed.subscribe(() => (cerrado += 1));
    byId('content-dialog-close')!.click();
    await vi.waitFor(() => expect(cerrado).toBe(1));
  });
});
