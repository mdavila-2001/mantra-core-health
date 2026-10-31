import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import type { ExplainAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import {
  CATALOGO,
  EXPLICACION_ANA_FUERA_DE_HORARIO,
  VINCULO_ANA,
  VINCULO_MARCOS,
  elegir,
  falloDeApi,
  pulsar,
} from '../../../access-governance/simulator/simulator.fixtures';
import { MyExplain } from './my-explain';

const SIN_INGRESO: ExplainAccessResponse = {
  decision: {
    effect: 'DENY',
    allowed: false,
    reason: 'ONBOARDING_INCOMPLETE',
    atom: 'agenda.appointment.check_in',
  },
  summary: 'Falta completar su ingreso: el compromiso de confidencialidad.',
  decidedBy: { layer: 'ENGAGEMENT', step: 1 },
  reasons: [
    {
      order: 1,
      layer: 'ENGAGEMENT',
      passed: false,
      code: 'ONBOARDING_INCOMPLETE',
      message: 'Falta completar el ingreso: compromiso de confidencialidad.',
    },
  ],
  missing: [{ kind: 'STEP_UP', message: 'Confirme con su aplicación.', fix: { type: 'STEP_UP' } }],
  askAdmin: 'Pida a su administrador que complete su ingreso.',
  obligations: { reason: null, stepUp: null, approval: null },
  visibleFields: {},
  evaluatedAt: '2026-11-03T10:30:00-04:00',
};

describe('MyExplain', () => {
  let fixture: ComponentFixture<MyExplain>;
  let explainMine: ReturnType<typeof vi.fn>;
  let acknowledgeConfidentiality: ReturnType<typeof vi.fn>;
  let getMyCatalog: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 4; i += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  async function abrir(engagements = [VINCULO_MARCOS], prefill: unknown = null): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AccessExplainClient, useValue: { explainMine } },
        { provide: AccessLifecycleClient, useValue: { acknowledgeConfidentiality } },
        { provide: SupportAccessClient, useValue: { getMyCatalog } },
        { provide: ToastService, useValue: { success: toastSuccess, error: toastError } },
      ],
    });
    fixture = TestBed.createComponent(MyExplain);
    fixture.componentRef.setInput('engagements', engagements);
    if (prefill !== null) fixture.componentRef.setInput('prefill', prefill);
    await settle();
  }

  beforeEach(() => {
    explainMine = vi.fn(() => of(EXPLICACION_ANA_FUERA_DE_HORARIO));
    acknowledgeConfidentiality = vi.fn(() =>
      of({ ok: true, tenantId: 't-hospital', acknowledgedAt: 'x' }),
    );
    getMyCatalog = vi.fn(() => of(CATALOGO));
    toastSuccess = vi.fn();
    toastError = vi.fn();
  });

  it('con una sola organización no pregunta cuál y la manda en el cuerpo, junto con lo que eligió', async () => {
    await abrir();
    expect(byId('porque-organizacion')).toBeNull();
    expect(getMyCatalog).toHaveBeenCalledWith('t-hospital');
    await elegir(host(), 'porque-accion', 'Crear citas', settle);
    await elegir(host(), 'porque-doctor', 'Pérez', settle);
    await pulsar(host(), 'porque-enviar', settle);
    expect(explainMine.mock.calls[0]![0]).toEqual({
      tenantId: 't-hospital',
      action: 'agenda.appointment.create',
      practitionerRoleAssignmentId: 'doc-perez',
    });
    expect(byId('veredicto')!.textContent).toContain('No puede');
  });

  it('con varias organizaciones pide cuál y recarga los doctores de la elegida', async () => {
    await abrir([
      VINCULO_MARCOS,
      { ...VINCULO_ANA, id: 'eng-otra', tenantId: 't-otra', organizationName: 'Clínica Otra' },
    ]);
    expect(byId('porque-organizacion')).not.toBeNull();
    await elegir(host(), 'porque-organizacion', 'Clínica Otra', settle);
    expect(getMyCatalog).toHaveBeenLastCalledWith('t-otra');
    await elegir(host(), 'porque-accion', 'Crear citas', settle);
    await pulsar(host(), 'porque-enviar', settle);
    expect(explainMine.mock.calls[0]![0].tenantId).toBe('t-otra');
  });

  it('no ofrece preguntar sobre un vínculo terminado', async () => {
    await abrir([{ ...VINCULO_MARCOS, status: 'ENDED' }]);
    expect(byId('porque-organizacion')).toBeNull();
    expect(explainMine).not.toHaveBeenCalled();
  });

  it('cuando falta el ingreso ofrece aceptar el compromiso, lo manda a la API y vuelve a preguntar', async () => {
    explainMine.mockReturnValueOnce(of(SIN_INGRESO)).mockReturnValueOnce(
      of({
        ...EXPLICACION_ANA_FUERA_DE_HORARIO,
        decision: { effect: 'PERMIT', allowed: true, reason: 'ALLOWED' },
        summary: 'Ya puede.',
      }),
    );
    await abrir();
    await elegir(host(), 'porque-accion', 'Registrar la llegada', settle);
    await pulsar(host(), 'porque-enviar', settle);
    expect(byId('porque-segundo-paso')!.getAttribute('href')).toBe('/my-account/security/mfa');
    await pulsar(host(), 'porque-compromiso', settle);
    expect(acknowledgeConfidentiality).toHaveBeenCalledWith('eng-marcos');
    expect(toastSuccess).toHaveBeenCalled();
    expect(explainMine).toHaveBeenCalledTimes(2);
    expect(byId('veredicto')!.getAttribute('data-efecto')).toBe('PERMIT');
    expect(byId('porque-compromiso')).toBeNull();
  });

  it('si el compromiso no se pudo registrar lo dice y deja reintentar', async () => {
    explainMine.mockReturnValue(of(SIN_INGRESO));
    acknowledgeConfidentiality.mockReturnValue(
      throwError(() =>
        falloDeApi(
          422,
          'PRECONDITION_FAILED',
          'SUPPORT_ENGAGEMENT_NOT_ACTIVE',
          'El vínculo no está activo',
        ),
      ),
    );
    await abrir();
    await elegir(host(), 'porque-accion', 'Registrar la llegada', settle);
    await pulsar(host(), 'porque-enviar', settle);
    await pulsar(host(), 'porque-compromiso', settle);
    expect(toastError).toHaveBeenCalled();
    expect(byId('porque-compromiso')).not.toBeNull();
  });

  it('una pregunta que llega lista (desde un bloque «Reservado») se precarga y espera un clic: no se envía sola (F7)', async () => {
    await abrir([VINCULO_MARCOS], {
      tenantId: 't-hospital',
      question: { action: 'agenda.appointment.view.reason', patientProfileId: '3f1c6c1e-5d1f-4c53-9a9e-0a1b2c3d4e5f' },
    });
    expect(explainMine).not.toHaveBeenCalled();
    expect(byId('veredicto')).toBeNull();
    expect(byId('porque-lista')?.textContent).toContain('Pulse «Explicar»');

    await pulsar(host(), 'porque-enviar', settle);
    expect(explainMine).toHaveBeenCalledTimes(1);
    expect(explainMine.mock.calls[0]![0]).toMatchObject({
      tenantId: 't-hospital',
      action: 'agenda.appointment.view.reason',
      patientProfileId: '3f1c6c1e-5d1f-4c53-9a9e-0a1b2c3d4e5f',
    });
    expect(byId('veredicto')).not.toBeNull();
  });

  it('un 403 es un muro y un 404 no dice si existe o no', async () => {
    explainMine.mockReturnValueOnce(throwError(() => falloDeApi(403, 'FORBIDDEN')));
    await abrir();
    await elegir(host(), 'porque-accion', 'Crear citas', settle);
    await pulsar(host(), 'porque-enviar', settle);
    expect(byId('veredicto')).toBeNull();
    explainMine.mockReturnValueOnce(
      throwError(() =>
        falloDeApi(404, 'NOT_FOUND', 'SUPPORT_ENGAGEMENT_NOT_FOUND', 'No hay vínculo eng-zzz'),
      ),
    );
    await pulsar(host(), 'porque-enviar', settle);
    expect(host().textContent).not.toContain('eng-zzz');
    expect(byId('veredicto')).toBeNull();
  });
});
