import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessChallengeCancelledError, type ChallengeAnswer } from '../../../core/access-challenge/access-challenge';
import { AccessChallengeService } from './access-challenge.service';

const fallo = (status: number, code: string, reason: string, details: Record<string, unknown> = {}): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { statusCode: status, code, message: 'x', reason, details: { ...details, reason }, timestamp: '', path: '/x' } });

describe('AccessChallengeService.run', () => {
  let service: AccessChallengeService;
  let resolve: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = TestBed.inject(AccessChallengeService);
    resolve = vi.spyOn(service, 'resolve');
  });

  it('si la acción sale bien a la primera, no abre nada', async () => {
    const attempt = vi.fn(() => of('ok'));
    expect(await firstValueFrom(service.run(attempt))).toBe('ok');
    expect(resolve).not.toHaveBeenCalled();
    expect(attempt).toHaveBeenCalledWith({});
  });

  it('resuelve el motivo y reintenta con lo aportado', async () => {
    resolve.mockReturnValue(of({ reasonText: 'Aviso de la paciente' } satisfies ChallengeAnswer));
    const attempt = vi.fn((a: ChallengeAnswer) => (a.reasonText === undefined ? throwError(() => fallo(422, 'PRECONDITION_FAILED', 'REASON_REQUIRED', { minLength: 10 })) : of(a.reasonText)));
    expect(await firstValueFrom(service.run(attempt))).toBe('Aviso de la paciente');
    expect(resolve).toHaveBeenCalledWith({ kind: 'REASON', minLength: 10, placeholder: false }, {});
  });

  it('acumula las respuestas de varias rondas: segundo paso y luego aprobación', async () => {
    resolve.mockReturnValueOnce(of({ stepUpVerified: true })).mockReturnValueOnce(of({ approvalId: 'a-9' }));
    const vistas: ChallengeAnswer[] = [];
    const attempt = (a: ChallengeAnswer) => {
      vistas.push(a);
      if (a.stepUpVerified !== true) return throwError(() => fallo(403, 'FORBIDDEN', 'STEP_UP_REQUIRED', { enrolled: true }));
      if (a.approvalId === undefined) return throwError(() => fallo(403, 'FORBIDDEN', 'APPROVAL_REQUIRED', { approverKind: 'SECOND_APPROVER' }));
      return of('hecho');
    };
    expect(await firstValueFrom(service.run(attempt))).toBe('hecho');
    expect(vistas.at(-1)).toEqual({ stepUpVerified: true, approvalId: 'a-9' });
  });

  it('un error que no es un desafío sigue su camino sin abrir nada', async () => {
    const error = fallo(403, 'FORBIDDEN', 'SOMETHING_ELSE');
    await expect(firstValueFrom(service.run(() => throwError(() => error)))).rejects.toBe(error);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('un desafío sin salida se muestra y la acción termina con el error original', async () => {
    resolve.mockReturnValue(of({}));
    const error = fallo(503, 'DEPENDENCY_UNAVAILABLE', 'STEP_UP_UNAVAILABLE');
    await expect(firstValueFrom(service.run(() => throwError(() => error)))).rejects.toBe(error);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('si la persona cancela, la acción termina con la cancelación', async () => {
    resolve.mockReturnValue(throwError(() => new AccessChallengeCancelledError()));
    await expect(firstValueFrom(service.run(() => throwError(() => fallo(403, 'FORBIDDEN', 'STEP_UP_REQUIRED'))))).rejects.toBeInstanceOf(AccessChallengeCancelledError);
  });
});
