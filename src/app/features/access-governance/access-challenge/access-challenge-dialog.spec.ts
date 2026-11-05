import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import type { AccessChallenge, ChallengeAnswer } from '../../../core/access-challenge/access-challenge';
import { SessionStore } from '../../../core/auth/session.store';
import { AccessApprovalsClient } from '../../../core/data-access/access-governance/access-approvals.client';
import type { SupportApproval } from '../../../core/data-access/access-governance/access-reviews.types';
import { StepUpClient } from '../../../core/data-access/access-governance/step-up.client';
import { AccessChallengeDialog } from './access-challenge-dialog';

const aprobacion = (status: string, extra: Partial<SupportApproval> = {}): SupportApproval => ({
  id: 'ap-1',
  tenantId: 't-1',
  kind: 'ACTION',
  status,
  approverKind: 'DOCTOR',
  atom: 'agenda.appointment.cancel',
  createdAt: '2026-11-03T10:30:00-04:00',
  expiresAt: '2026-11-03T11:30:00-04:00',
  summary: 'Cancelar la cita de mañana a las 09:00.',
  ...extra,
});

const apiError = (status: number, code: string, reason: string): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { statusCode: status, code, message: 'x', reason, details: { reason }, timestamp: '', path: '/x' } });

describe('AccessChallengeDialog', () => {
  let fixture: ComponentFixture<AccessChallengeDialog>;
  let respuestas: ChallengeAnswer[];
  let cancelaciones: number;
  const verify = vi.fn();
  const createApproval = vi.fn();
  const listMyApprovals = vi.fn();
  const byId = (id: string): HTMLElement | null => document.body.querySelector(`[data-testid="${id}"]`);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const el = byId(id) as HTMLElement;
    const campo = (el.matches('input,textarea') ? el : el.querySelector('input,textarea')) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await refrescar();
  };
  const clic = async (id: string): Promise<void> => {
    (byId(id) as HTMLElement).click();
    await refrescar();
  };

  const abrir = async (challenge: AccessChallenge, options = {}): Promise<void> => {
    fixture = TestBed.createComponent(AccessChallengeDialog);
    fixture.componentRef.setInput('challenge', challenge);
    fixture.componentRef.setInput('options', options);
    fixture.componentInstance.answered.subscribe((a) => respuestas.push(a));
    fixture.componentInstance.cancelled.subscribe(() => cancelaciones++);
    await refrescar();
  };

  beforeEach(() => {
    respuestas = [];
    cancelaciones = 0;
    verify.mockReset();
    createApproval.mockReset();
    listMyApprovals.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StepUpClient, useValue: { verify } },
        { provide: AccessApprovalsClient, useValue: { createApproval, listMyApprovals } },
        { provide: SessionStore, useValue: { activeTenantId: () => 't-1' } },
      ],
    });
  });

  afterEach(() => fixture?.destroy());

  describe('motivo', () => {
    it('no deja continuar con un motivo corto y dice cuántos caracteres piden', async () => {
      await abrir({ kind: 'REASON', minLength: 10, placeholder: false });
      await escribir('desafio-motivo', 'corto');
      await clic('desafio-continuar');
      expect(respuestas).toEqual([]);
      expect(document.body.textContent).toContain('Escriba al menos 10 caracteres.');
      expect(byId('desafio-ejemplos')).not.toBeNull();
    });

    it('devuelve el motivo recortado', async () => {
      await abrir({ kind: 'REASON', minLength: 10, placeholder: false });
      await escribir('desafio-motivo', '  La paciente avisó que no viene  ');
      await clic('desafio-continuar');
      expect(respuestas).toEqual([{ reasonText: 'La paciente avisó que no viene' }]);
    });

    it('avisa cuando el motivo anterior era de relleno', async () => {
      await abrir({ kind: 'REASON', minLength: 5, placeholder: true });
      expect(byId('desafio-relleno')).not.toBeNull();
    });
  });

  describe('segundo paso', () => {
    it('verifica el código y devuelve el sello', async () => {
      verify.mockReturnValue(of({ verifiedAt: 'x', validForMinutes: 10 }));
      await abrir({ kind: 'STEP_UP', maxAgeMinutes: 10, enrolled: true });
      await escribir('desafio-codigo', '123 456');
      await clic('desafio-verificar');
      expect(verify).toHaveBeenCalledWith('123456');
      expect(respuestas).toEqual([{ stepUpVerified: true }]);
    });

    it('un código incorrecto se explica y deja reintentar', async () => {
      verify.mockReturnValue(throwError(() => apiError(422, 'PRECONDITION_FAILED', 'MFA_CODE_INVALID')));
      await abrir({ kind: 'STEP_UP', maxAgeMinutes: null, enrolled: true });
      await escribir('desafio-codigo', '000000');
      await clic('desafio-verificar');
      expect(respuestas).toEqual([]);
      expect(document.body.textContent).toContain('El código no es correcto');
      expect(byId('desafio-sin-salida')).toBeNull();
    });

    it('demasiados intentos (429) no deja reintentar', async () => {
      verify.mockReturnValue(throwError(() => apiError(429, 'RATE_LIMITED', 'STEP_UP_ATTEMPTS_EXCEEDED')));
      await abrir({ kind: 'STEP_UP', maxAgeMinutes: null, enrolled: true });
      await escribir('desafio-codigo', '123456');
      await clic('desafio-verificar');
      expect(byId('desafio-sin-salida')?.textContent).toContain('Demasiados intentos');
    });

    it('sin el factor activado lleva a activarlo, no a escribir un código', async () => {
      await abrir({ kind: 'STEP_UP', maxAgeMinutes: null, enrolled: false });
      expect(byId('desafio-activar-mfa')?.getAttribute('href')).toBe('/my-account/security/mfa');
      expect(byId('desafio-codigo')).toBeNull();
    });
  });

  describe('aprobación', () => {
    const challenge: AccessChallenge = { kind: 'APPROVAL', approverKind: 'DOCTOR', atom: 'agenda.appointment.cancel', ttlMinutes: 60, stale: false };

    it('pide la aprobación de esta acción con el motivo y deja el estado «Pendiente»', async () => {
      createApproval.mockReturnValue(of(aprobacion('PENDING')));
      await abrir(challenge, { approval: { careSpaceId: 'cs-1', appointmentStartAt: '2026-11-04T09:00:00-04:00' } });
      await escribir('desafio-motivo', 'Cita con menos de 24 horas');
      await clic('desafio-pedir');
      expect(createApproval).toHaveBeenCalledWith({ tenantId: 't-1', atom: 'agenda.appointment.cancel', reasonText: 'Cita con menos de 24 horas', careSpaceId: 'cs-1', appointmentStartAt: '2026-11-04T09:00:00-04:00' });
      expect(byId('desafio-estado')?.getAttribute('data-status')).toBe('PENDING');
      expect(byId('desafio-estado')?.textContent).toContain('Pendiente');
      expect(respuestas).toEqual([]);
    });

    it('al aprobarse devuelve el id para reintentar con X-Approval-Id', async () => {
      createApproval.mockReturnValue(of(aprobacion('PENDING')));
      listMyApprovals.mockReturnValue(of({ items: [aprobacion('APPROVED', { approvedUntil: '2026-11-03T11:30:00-04:00' })], count: 1 }));
      await abrir(challenge);
      await escribir('desafio-motivo', 'Cita con menos de 24 horas');
      await clic('desafio-pedir');
      await clic('desafio-comprobar');
      expect(respuestas).toEqual([{ approvalId: 'ap-1' }]);
    });

    it('una aprobación rechazada muestra el motivo del rechazo y no reintenta', async () => {
      createApproval.mockReturnValue(of(aprobacion('PENDING')));
      listMyApprovals.mockReturnValue(of({ items: [aprobacion('REJECTED', { decisionComment: 'La cita sigue en pie' })], count: 1 }));
      await abrir(challenge);
      await escribir('desafio-motivo', 'Cita con menos de 24 horas');
      await clic('desafio-pedir');
      await clic('desafio-comprobar');
      expect(byId('desafio-estado')?.textContent).toContain('Rechazada: La cita sigue en pie');
      expect(respuestas).toEqual([]);
    });

    it('si la aprobación anterior ya no sirve lo dice antes de pedir otra', async () => {
      await abrir({ ...challenge, stale: true });
      expect(byId('desafio-aprobacion-vieja')).not.toBeNull();
    });
  });

  it('un desafío sin salida explica el motivo y solo ofrece «Entendido»', async () => {
    await abrir({ kind: 'BLOCKED', reason: 'DECISION_LOG_UNAVAILABLE' });
    expect(byId('desafio-sin-salida')?.textContent).toContain('No pudimos registrar esta decisión');
    await clic('desafio-entendido');
    expect(cancelaciones).toBe(1);
  });
});
