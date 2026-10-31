import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { DoctorTeamMember } from '../../../core/data-access/support-access/support-access.types';
import { MyTeam } from './my-team';

const PENDIENTE: DoctorTeamMember = {
  delegateId: 'dl-ana',
  userId: 'u-ana',
  engagementId: 'eng-ana',
  practitionerRoleAssignmentId: 'pra-1',
  tenantId: 't-hospital',
  personName: 'Ana Gutiérrez',
  roleTemplate: 'SECRETARY',
  organizationName: 'Hospital Piloto',
  status: 'PENDING_ACCEPTANCE',
  delegateStatus: 'ACTIVE',
  accepted: false,
  actions: ['schedule.view', 'schedule.create'],
  mayReplyOnBehalf: false,
  replyDisclosure: 'SHOW',
  coverageSummary: 'Cubre toda su agenda: todos sus lugares y servicios.',
  pendingClinicalRequests: [],
};
const ACTIVA: DoctorTeamMember = {
  ...PENDIENTE,
  delegateId: 'dl-lucia',
  personName: 'Lucía Paz',
  roleTemplate: 'FRONT_DESK',
  status: 'ACTIVE',
  accepted: true,
  acceptedAt: '2026-09-20T10:00:00.000Z',
  mayReplyOnBehalf: true,
  pendingClinicalRequests: [
    {
      requestId: 'ar-1',
      patientLabel: 'Paciente M. R.',
      reasonText: 'Informe para el seguro',
      requestedAt: '2026-10-29T10:00:00.000Z',
      requestedHours: 24,
    },
  ],
};

const SUSPENDIDA: DoctorTeamMember = {
  ...PENDIENTE,
  delegateId: 'dl-silvia',
  personName: 'Silvia Soria',
  status: 'REVOKED',
  delegateStatus: 'SUSPENDED',
  accepted: true,
  mayReplyOnBehalf: false,
};
const RETIRADA: DoctorTeamMember = {
  ...SUSPENDIDA,
  delegateId: 'dl-pedro',
  personName: 'Pedro Camacho',
  delegateStatus: 'REVOKED',
};
const VENCIDA: DoctorTeamMember = {
  ...SUSPENDIDA,
  delegateId: 'dl-gabriel',
  personName: 'Gabriel Rojas',
  delegateStatus: 'EXPIRED',
};

describe('MyTeam', () => {
  let fixture: ComponentFixture<MyTeam>;
  let acceptDelegate: ReturnType<typeof vi.fn>;
  let setReplySettings: ReturnType<typeof vi.fn>;
  let resolveAccessRequest: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const clic = (el: Element | null): void => {
    (el as HTMLElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    acceptDelegate = vi.fn(() => of({ ok: true }));
    setReplySettings = vi.fn(() => of({ ok: true }));
    resolveAccessRequest = vi.fn(() => of({ requestId: 'ar-1', decision: 'APPROVED' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // «Para su atención» pide por HTTP (panel del doctor y aprobaciones): se deja sin respuesta.
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SupportAccessClient,
          useValue: {
            getMyTeam: () => of({ items: [PENDIENTE, ACTIVA, SUSPENDIDA, RETIRADA, VENCIDA] }),
            getMyTeamActivity: () => of({ items: [] }),
            acceptDelegate,
            setReplySettings,
          },
        },
        {
          provide: DelegatedAccessClient,
          useValue: { resolveAccessRequest, revokeDelegation: vi.fn(() => of({ ok: true })) },
        },
      ],
    });
    fixture = TestBed.createComponent(MyTeam);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('una persona sin aceptar muestra «Aceptar» y ninguno de los interruptores del equipo activo', () => {
    expect(byId('miembro-estado-dl-ana')!.textContent).toContain('Espera su aceptación');
    expect(byId('aceptar-dl-ana')).not.toBeNull();
    expect(byId('responder-dl-ana')).toBeNull();
  });

  it('aceptar manda la decisión de «responder en mi nombre» que el doctor tomó, y recarga', () => {
    clic(byId('aceptar-responder-dl-ana')!.querySelector('input'));
    clic(byId('aceptar-dl-ana'));

    expect(acceptDelegate).toHaveBeenCalledWith('dl-ana', { mayReplyOnBehalf: true });
  });

  it('el interruptor de responder pide el cambio a la API', () => {
    clic(byId('responder-dl-lucia')!.querySelector('input'));
    expect(setReplySettings).toHaveBeenCalledWith('dl-lucia', { mayReplyOnBehalf: false });
  });

  it('«respondido por su equipo» solo se decide si la persona puede responder', () => {
    expect(byId('aviso-dl-lucia')!.querySelector('input')!.disabled).toBe(false);
    clic(byId('aviso-dl-lucia')!.querySelector('input'));
    expect(setReplySettings).toHaveBeenCalledWith('dl-lucia', { replyDisclosure: 'HIDE' });
  });

  it('el acceso clínico temporal lo decide el doctor, por paciente, con la vigencia pedida', () => {
    expect(byId('acceso-ar-1')!.textContent).toContain('24 horas');
    clic(byId('acceso-aprobar-ar-1'));

    expect(resolveAccessRequest).toHaveBeenCalledTimes(1);
    const [id, resolucion] = resolveAccessRequest.mock.calls[0]! as [
      string,
      { decision: string; validTo: string },
    ];
    expect(id).toBe('ar-1');
    expect(resolucion.decision).toBe('APPROVED');
    expect(new Date(resolucion.validTo).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
  });

  it('negar no manda vigencia', () => {
    clic(byId('acceso-negar-ar-1'));
    expect(resolveAccessRequest).toHaveBeenCalledWith('ar-1', { decision: 'DENIED' });
  });

  it('lo que la persona puede hacer sobre su agenda se dice en palabras, con la aceptación', () => {
    expect(byId('miembro-acciones-dl-lucia')).not.toBeNull();
    expect(byId('miembro-acciones-dl-ana')!.textContent).toContain('Ver la agenda · Crear citas');
    expect(byId('miembro-dl-lucia')!.textContent).toContain('La aceptó el');
  });

  it('una persona que ya no está activa dice por qué: suspendida por su organización, retirada o vencida', () => {
    expect(byId('miembro-estado-dl-silvia')!.textContent).toContain('Suspendida');
    expect(byId('miembro-baja-dl-silvia')!.textContent).toContain('lo renueve');
    expect(byId('miembro-baja-dl-silvia')!.textContent).toContain('usted no tiene que hacer nada');
    expect(byId('miembro-estado-dl-pedro')!.textContent).toContain('Retirada');
    expect(byId('miembro-baja-dl-pedro')!.textContent).toContain('ya no forma parte de su equipo');
    expect(byId('miembro-estado-dl-gabriel')!.textContent).toContain('Vencida');
    // Ninguna de las tres ofrece aceptar, ajustar ni retirar.
    for (const id of ['dl-silvia', 'dl-pedro', 'dl-gabriel']) {
      expect(byId(`aceptar-${id}`)).toBeNull();
      expect(byId(`responder-${id}`)).toBeNull();
      expect(byId(`retirar-${id}`)).toBeNull();
    }
  });

  it('lleva a la actividad completa de su equipo, con filtros y exportación', () => {
    const enlace = byId('mi-equipo-ver-actividad') as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toBe('/my-team/activity');
    expect(byId('mi-equipo-actividad')!.textContent).toContain('exportación a CSV');
  });
});
