import { HttpErrorResponse, provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ACCESS_CHALLENGE_RESOLVER, AccessChallengeCancelledError, withAccessChallenge, type AccessChallengeResolver } from '../access-challenge/access-challenge';
import { accessChallengeInterceptor } from './access-challenge.interceptor';
import { DEFAULT_TIMEOUT_MS, timeoutInterceptor } from './timeout.interceptor';

const challengeBody = (code: string, reason: string, details: Record<string, unknown> = {}) => ({ statusCode: 403, code, message: 'x', reason, details: { ...details, reason }, timestamp: '', path: '/x' });

describe('accessChallengeInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let resolve: ReturnType<typeof vi.fn>;

  const resolver = (): AccessChallengeResolver => ({ resolve: resolve as unknown as AccessChallengeResolver['resolve'] });

  const setup = (provided: AccessChallengeResolver | null): void => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([accessChallengeInterceptor])), provideHttpClientTesting(), { provide: ACCESS_CHALLENGE_RESOLVER, useValue: provided }],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  };

  beforeEach(() => {
    resolve = vi.fn();
  });

  afterEach(() => backend.verify());

  it('sin la marca, el desafío llega a quien llama como un error más y no se abre nada', () => {
    setup(resolver());
    let fallo: HttpErrorResponse | undefined;
    http.post('/scheduling/bookings/b1/cancel', {}).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/scheduling/bookings/b1/cancel').flush(challengeBody('FORBIDDEN', 'APPROVAL_REQUIRED'), { status: 403, statusText: 'Forbidden' });
    expect(fallo?.status).toBe(403);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('motivo faltante: pide el motivo y reintenta la misma petición con `reasonText` en el cuerpo', () => {
    resolve.mockReturnValue(of({ reasonText: 'La paciente avisó que no viene' }));
    setup(resolver());
    let ok: unknown;
    http.post('/scheduling/bookings/b1/cancel', { x: 1 }, { context: withAccessChallenge() }).subscribe((r) => (ok = r));
    backend.expectOne('/scheduling/bookings/b1/cancel').flush({ ...challengeBody('PRECONDITION_FAILED', 'REASON_REQUIRED', { minLength: 10 }), statusCode: 422 }, { status: 422, statusText: 'Unprocessable' });
    expect(resolve).toHaveBeenCalledWith({ kind: 'REASON', minLength: 10, placeholder: false }, expect.objectContaining({ reasonField: 'reasonText' }));
    const reintento = backend.expectOne('/scheduling/bookings/b1/cancel');
    expect(reintento.request.body).toEqual({ x: 1, reasonText: 'La paciente avisó que no viene' });
    reintento.flush({ ok: true });
    expect(ok).toEqual({ ok: true });
  });

  it('en cadena: segundo paso y luego aprobación; la aprobación viaja en X-Approval-Id', () => {
    resolve.mockReturnValueOnce(of({ stepUpVerified: true })).mockReturnValueOnce(of({ approvalId: 'a-1' }));
    setup(resolver());
    let ok: unknown;
    http.post('/org/support-engagements/e1/move', {}, { context: withAccessChallenge() }).subscribe((r) => (ok = r));
    backend.expectOne('/org/support-engagements/e1/move').flush(challengeBody('FORBIDDEN', 'STEP_UP_REQUIRED', { maxAgeMinutes: 10, enrolled: true }), { status: 403, statusText: 'Forbidden' });
    backend.expectOne('/org/support-engagements/e1/move').flush(challengeBody('FORBIDDEN', 'APPROVAL_REQUIRED', { approverKind: 'DOCTOR' }), { status: 403, statusText: 'Forbidden' });
    const ultimo = backend.expectOne('/org/support-engagements/e1/move');
    expect(ultimo.request.headers.get('X-Approval-Id')).toBe('a-1');
    ultimo.flush({ status: 'EXECUTED' });
    expect(ok).toEqual({ status: 'EXECUTED' });
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('un desafío sin salida (503 STEP_UP_UNAVAILABLE) no se reintenta ni abre el diálogo', () => {
    setup(resolver());
    let fallo: HttpErrorResponse | undefined;
    http.post('/x', {}, { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/x').flush({ ...challengeBody('DEPENDENCY_UNAVAILABLE', 'STEP_UP_UNAVAILABLE'), statusCode: 503 }, { status: 503, statusText: 'Unavailable' });
    expect(fallo?.status).toBe(503);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('si la persona cancela el diálogo, el error es la cancelación y no se reintenta', () => {
    resolve.mockReturnValue(throwError(() => new AccessChallengeCancelledError()));
    setup(resolver());
    let fallo: unknown;
    http.post('/x', {}, { context: withAccessChallenge() }).subscribe({ error: (e: unknown) => (fallo = e) });
    backend.expectOne('/x').flush(challengeBody('FORBIDDEN', 'STEP_UP_REQUIRED'), { status: 403, statusText: 'Forbidden' });
    expect(fallo).toBeInstanceOf(AccessChallengeCancelledError);
    backend.expectNone('/x');
  });

  it('corta tras tres rondas: la API sigue pidiendo y el error sigue su camino', () => {
    resolve.mockReturnValue(of({ stepUpVerified: true }));
    setup(resolver());
    let fallo: HttpErrorResponse | undefined;
    http.post('/x', {}, { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    for (let i = 0; i < 4; i++) backend.expectOne('/x').flush(challengeBody('FORBIDDEN', 'STEP_UP_REQUIRED'), { status: 403, statusText: 'Forbidden' });
    expect(resolve).toHaveBeenCalledTimes(3);
    expect(fallo?.status).toBe(403);
  });

  it('sin resolvedor registrado, la petición marcada se comporta como una normal', () => {
    setup(null);
    let fallo: HttpErrorResponse | undefined;
    http.post('/x', {}, { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/x').flush(challengeBody('FORBIDDEN', 'APPROVAL_REQUIRED'), { status: 403, statusText: 'Forbidden' });
    expect(fallo?.status).toBe(403);
  });
});

/**
 * F5 (revisión de seguridad del front): el interceptor no reenvía una petición **distinta** de la original. Solo reintenta
 * 403/409/422 con un `reason` de desafío conocido, y el motivo solo se escribe en un cuerpo objeto (o ausente), nunca
 * reemplazando un array o un FormData ni dándole cuerpo a un GET.
 */
describe('accessChallengeInterceptor: qué reintenta y qué no (F5)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let resolve: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resolve = vi.fn().mockReturnValue(of({ reasonText: 'motivo escrito' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accessChallengeInterceptor])),
        provideHttpClientTesting(),
        { provide: ACCESS_CHALLENGE_RESOLVER, useValue: { resolve: resolve as unknown as AccessChallengeResolver['resolve'] } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  const reasonRequired = (statusCode = 422) => ({ ...challengeBody('PRECONDITION_FAILED', 'REASON_REQUIRED', { minLength: 5 }), statusCode });

  it('un cuerpo array no se reemplaza por {reasonText}: no se abre el diálogo y el error sigue su camino', () => {
    let fallo: HttpErrorResponse | undefined;
    http.post('/bulk', [1, 2, 3], { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/bulk').flush(reasonRequired(), { status: 422, statusText: 'Unprocessable' });
    expect(fallo?.status).toBe(422);
    expect(resolve).not.toHaveBeenCalled();
    backend.expectNone('/bulk');
  });

  it('un FormData con archivo tampoco se reemplaza', () => {
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.txt');
    let fallo: HttpErrorResponse | undefined;
    http.post('/upload', form, { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/upload').flush(reasonRequired(), { status: 422, statusText: 'Unprocessable' });
    expect(fallo?.status).toBe(422);
    expect(resolve).not.toHaveBeenCalled();
    backend.expectNone('/upload');
  });

  it('un GET no gana cuerpo: no se reintenta con el motivo', () => {
    let fallo: HttpErrorResponse | undefined;
    http.get('/x', { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/x').flush(reasonRequired(), { status: 422, statusText: 'Unprocessable' });
    expect(fallo?.status).toBe(422);
    expect(resolve).not.toHaveBeenCalled();
    backend.expectNone('/x');
  });

  it('una petición sin cuerpo (POST con null) sí recibe el motivo en un cuerpo nuevo', () => {
    let ok: unknown;
    http.post('/x', null, { context: withAccessChallenge() }).subscribe((r) => (ok = r));
    backend.expectOne('/x').flush(reasonRequired(), { status: 422, statusText: 'Unprocessable' });
    const reintento = backend.expectOne('/x');
    expect(reintento.request.body).toEqual({ reasonText: 'motivo escrito' });
    reintento.flush({ ok: true });
    expect(ok).toEqual({ ok: true });
  });

  it('con un cuerpo array, una aprobación sí se puede reintentar: viaja en la cabecera y el cuerpo queda intacto', () => {
    resolve.mockReturnValue(of({ approvalId: 'a-9' }));
    http.post('/bulk', [1, 2, 3], { context: withAccessChallenge() }).subscribe();
    backend.expectOne('/bulk').flush(challengeBody('FORBIDDEN', 'APPROVAL_REQUIRED', { approverKind: 'DOCTOR' }), { status: 403, statusText: 'Forbidden' });
    const reintento = backend.expectOne('/bulk');
    expect(reintento.request.body).toEqual([1, 2, 3]);
    expect(reintento.request.headers.get('X-Approval-Id')).toBe('a-9');
    reintento.flush({});
  });

  it.each([
    [500, 'STEP_UP_REQUIRED'],
    [404, 'REASON_REQUIRED'],
    [400, 'REASON_REQUIRED'],
    [502, 'APPROVAL_REQUIRED'],
  ])('un %i con reason=%s no es un desafío: no se reintenta (no se repite una acción que pudo ejecutarse)', (status, reason) => {
    let fallo: HttpErrorResponse | undefined;
    http.delete('/x', { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/x').flush({ ...challengeBody('X', reason), statusCode: status }, { status, statusText: 'x' });
    expect(fallo?.status).toBe(status);
    expect(resolve).not.toHaveBeenCalled();
    backend.expectNone('/x');
  });

  it('409 con una aprobación vencida o de otra acción sí se reintenta', () => {
    resolve.mockReturnValue(of({ approvalId: 'a-2' }));
    http.post('/x', {}, { context: withAccessChallenge() }).subscribe();
    backend.expectOne('/x').flush({ ...challengeBody('CONFLICT', 'FOUR_EYES_PAYLOAD_CHANGED'), statusCode: 409 }, { status: 409, statusText: 'Conflict' });
    backend.expectOne('/x').flush({});
  });
});

/**
 * F1 (revisión de seguridad del front): el límite de 30 s es de cada ida a la red, no de la espera humana del diálogo
 * (motivo, código de la app autenticadora o aprobación de otra persona, que puede tardar minutos).
 */
describe('timeoutInterceptor + accessChallengeInterceptor: la espera humana no vence (F1)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let dialog: Subject<{ reasonText: string }>;
  let dialogTornDown: boolean;

  beforeEach(() => {
    vi.useFakeTimers();
    dialog = new Subject();
    dialogTornDown = false;
    const resolver: AccessChallengeResolver = {
      resolve: () =>
        new Observable((subscriber) => {
          const inner = dialog.subscribe(subscriber);
          return () => {
            inner.unsubscribe();
            dialogTornDown = true;
          };
        }),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([timeoutInterceptor, accessChallengeInterceptor])),
        provideHttpClientTesting(),
        { provide: ACCESS_CHALLENGE_RESOLVER, useValue: resolver },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const reasonRequired = { ...challengeBody('PRECONDITION_FAILED', 'REASON_REQUIRED', { minLength: 5 }), statusCode: 422 };

  it('una persona que tarda 35 s en el diálogo no pierde la acción: el diálogo sigue vivo y el reintento se ejecuta', () => {
    let ok: unknown;
    let fallo: unknown;
    http.post('/me/support-bookings/1/cancel', {}, { context: withAccessChallenge() }).subscribe({ next: (r) => (ok = r), error: (e: unknown) => (fallo = e) });
    backend.expectOne('/me/support-bookings/1/cancel').flush(reasonRequired, { status: 422, statusText: 'Unprocessable' });

    vi.advanceTimersByTime(35_000);
    expect(fallo).toBeUndefined();
    expect(dialogTornDown).toBe(false);

    dialog.next({ reasonText: 'La paciente llamó para cancelar' });
    const reintento = backend.expectOne('/me/support-bookings/1/cancel');
    expect(reintento.request.body).toEqual({ reasonText: 'La paciente llamó para cancelar' });
    reintento.flush({ ok: true });
    expect(ok).toEqual({ ok: true });
  });

  it('aun así, cada ida a la red sigue limitada: si la API no contesta al reintento, vence a los 30 s de ese reintento', () => {
    let fallo: HttpErrorResponse | undefined;
    http.post('/x', {}, { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/x').flush(reasonRequired, { status: 422, statusText: 'Unprocessable' });
    vi.advanceTimersByTime(120_000);
    dialog.next({ reasonText: 'motivo escrito' });
    backend.expectOne('/x');
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS - 1);
    expect(fallo).toBeUndefined();
    vi.advanceTimersByTime(2);
    expect(fallo?.status).toBe(0);
    expect(fallo?.statusText).toBe('Timeout');
  });

  it('la primera ida a la red también vence si la API no contesta (la petición marcada no queda sin límite)', () => {
    let fallo: HttpErrorResponse | undefined;
    http.post('/x', {}, { context: withAccessChallenge() }).subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/x');
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS + 1);
    expect(fallo?.status).toBe(0);
  });

  it('una petición sin la marca sigue con el límite de siempre', () => {
    let fallo: HttpErrorResponse | undefined;
    http.get('/y').subscribe({ error: (e: HttpErrorResponse) => (fallo = e) });
    backend.expectOne('/y');
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS + 1);
    expect(fallo?.status).toBe(0);
  });
});
