import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InfrastructureOpsClient } from './infrastructure-ops.client';
import { opsErrorToViewState, readOpsError } from './infrastructure-ops.errors';

describe('InfrastructureOpsClient', () => {
  let client: InfrastructureOpsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(InfrastructureOpsClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('el tablero manda los filtros como parámetros', () => {
    client.getBedBoard('s1', { unitId: 'u1', parentSpaceId: 'p1', functionCodes: ['A', 'B'], v2Codes: ['H', 'K'], cursor: 'c' }).subscribe();
    const r = http.expectOne((x) => x.url === '/sites/s1/bed-board');
    expect(r.request.params.get('functionCodes')).toBe('A,B');
    expect(r.request.params.get('v2Codes')).toBe('H,K');
    expect(r.request.params.get('unitId')).toBe('u1');
    expect(r.request.params.get('cursor')).toBe('c');
    r.flush({});
  });

  it('las mutaciones operativas llevan If-Match-Ops; las de una orden, If-Match', () => {
    client.changeAvailability('c1', 7, { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' }).subscribe();
    const a = http.expectOne('/care-spaces/c1/availability');
    expect(a.request.method).toBe('POST');
    expect(a.request.headers.get('If-Match-Ops')).toBe('7');
    expect(a.request.headers.has('If-Match')).toBe(false);
    a.flush({});

    client.changeHygiene('c1', 8, { action: 'mark-dirty', reasonText: 'x' }).subscribe();
    expect(http.expectOne('/care-spaces/c1/hygiene').request.headers.get('If-Match-Ops')).toBe('8');

    client.changeIsolation('c1', 9, { isolationCode: 'ISO_NONE', reasonText: 'x' }).subscribe();
    expect(http.expectOne('/care-spaces/c1/isolation').request.headers.get('If-Match-Ops')).toBe('9');

    client.start('o1', 3).subscribe();
    const s = http.expectOne('/cleaning-orders/o1/start');
    expect(s.request.headers.get('If-Match')).toBe('3');
    expect(s.request.headers.has('If-Match-Ops')).toBe(false);

    client.inspect('o1', 4, { result: 'FAIL', reasonText: 'polvo' }).subscribe();
    const i = http.expectOne('/cleaning-orders/o1/inspect');
    expect(i.request.body).toEqual({ result: 'FAIL', reasonText: 'polvo' });
  });

  it('la cola filtra por estado, prioridad y «mías»; el historial por eje', () => {
    client.listCleaningOrders('s1', { status: 'CLN_DONE', priority: 'CLN_PRIO_STAT', assignedTo: 'me' }).subscribe();
    const q = http.expectOne((x) => x.url === '/sites/s1/cleaning-orders');
    expect(q.request.params.get('assignedTo')).toBe('me');
    expect(q.request.params.get('status')).toBe('CLN_DONE');
    q.flush({});
    client.listStatusEvents('c1', { axis: 'AXIS_HYGIENE' }).subscribe();
    expect(http.expectOne((x) => x.url === '/care-spaces/c1/status-events').request.params.get('axis')).toBe('AXIS_HYGIENE');
  });

  it('end y cancel de un bloqueo van a su ruta', () => {
    client.endBlock('b1', 'listo').subscribe();
    expect(http.expectOne('/care-space-blocks/b1/end').request.body).toEqual({ note: 'listo' });
    client.cancelBlock('b1', 'error de carga').subscribe();
    expect(http.expectOne('/care-space-blocks/b1/cancel').request.body).toEqual({ reason: 'error de carga' });
  });

  describe('errores', () => {
    const fail = (status: number, code: string, details: Record<string, unknown>): HttpErrorResponse =>
      new HttpErrorResponse({ status, error: { statusCode: status, code, message: 'x', details, correlationId: 'req-9', timestamp: '', path: '' } });

    it('lee el reason, los compromisos y lo que le falta al local', () => {
      const conflicts = [{ kind: 'PROCEDURE_CASE', id: 'p1', startsAt: '2026-11-01T12:00:00Z', nextAction: 'Reprogramar' }];
      expect(readOpsError(fail(409, 'CONFLICT', { reason: 'FUTURE_COMMITMENTS_CONFLICT', conflicts }))?.conflicts).toEqual(conflicts);
      expect(readOpsError(fail(422, 'PRECONDITION_FAILED', { reason: 'ISOLATION_ROOM_NOT_CAPABLE', missing: ['AIIR', 'HVAC_VALIDATION'] }))?.missing).toEqual(['AIIR', 'HVAC_VALIDATION']);
      expect(readOpsError(new HttpErrorResponse({ status: 0 }))).toBeNull();
    });

    it('un reason de negocio sale como S4 anclado a su campo y con el código de petición', () => {
      const s = opsErrorToViewState(fail(422, 'PRECONDITION_FAILED', { reason: 'BLOCK_EXPECTED_END_REQUIRED' }));
      expect(s).toMatchObject({ status: 'validation', requestId: 'req-9' });
      expect((s as unknown as { issues: { code: string; field: string }[] }).issues[0]).toMatchObject({ code: 'expectedEndAt', field: 'Fecha estimada' });
    });

    it('403 es S5 con los roles que sí podrían; 404 es S6 sin datos; 0 es S8', () => {
      const s5 = opsErrorToViewState(fail(403, 'FORBIDDEN', { reason: 'INFRA_ACTION_NOT_ALLOWED', requiredRoles: ['NURSING'] }));
      expect(s5).toMatchObject({ status: 'forbidden', requestId: 'req-9' });
      expect((s5 as { message: string }).message).toContain('NURSING');
      expect(opsErrorToViewState(fail(404, 'NOT_FOUND', {})).status).toBe('not-found');
      expect(opsErrorToViewState(new HttpErrorResponse({ status: 0 })).status).toBe('offline');
    });

    it('un 412 se lee como conflicto de concurrencia (S4), no como error inesperado', () => {
      const s = opsErrorToViewState(fail(412, 'CONCURRENCY_CONFLICT', { reason: 'OPS_VERSION_MISMATCH' }));
      expect(s.status).toBe('validation');
    });

    it('la transición inválida cita de dónde a dónde', () => {
      const s = opsErrorToViewState(fail(409, 'CONFLICT', { reason: 'CLEANING_ORDER_INVALID_TRANSITION', from: 'CLN_DONE', to: 'CLN_IN_PROGRESS' }));
      expect((s as unknown as { issues: { message: string }[] }).issues[0]!.message).toContain('CLN_DONE');
    });
  });
});
