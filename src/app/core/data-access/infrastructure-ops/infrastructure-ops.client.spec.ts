import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InfrastructureOpsClient } from './infrastructure-ops.client';

describe('InfrastructureOpsClient', () => {
  let client: InfrastructureOpsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(InfrastructureOpsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el tablero con los filtros del contrato', () => {
    client.getBedBoard('s/1', { unitId: 'u1', functionCodes: ['SPACE_FN_BED_ICU'], v2Codes: ['U', 'H'] }).subscribe();
    const req = http.expectOne((r) => r.url === '/sites/s%2F1/bed-board');
    expect(req.request.params.get('unitId')).toBe('u1');
    expect(req.request.params.get('functionCodes')).toBe('SPACE_FN_BED_ICU');
    expect(req.request.params.get('v2Codes')).toBe('U,H');
    req.flush({});
  });

  it('los ejes operativos viajan con If-Match-Ops, no con If-Match', () => {
    client.changeAvailability('c1', 7, { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' }).subscribe();
    const a = http.expectOne('/care-spaces/c1/availability');
    expect(a.request.headers.get('If-Match-Ops')).toBe('7');
    expect(a.request.headers.has('If-Match')).toBe(false);
    a.flush({});

    client.changeHygiene('c1', 8, { action: 'mark-dirty', reasonText: 'x' }).subscribe();
    expect(http.expectOne('/care-spaces/c1/hygiene').request.headers.get('If-Match-Ops')).toBe('8');

    client.changeIsolation('c1', 9, { isolationCode: 'ISO_CONTACT', reasonText: 'x' }).subscribe();
    expect(http.expectOne('/care-spaces/c1/isolation').request.headers.get('If-Match-Ops')).toBe('9');
  });

  it('las transiciones de una orden mandan If-Match con su rowVersion', () => {
    client.inspectCleaningOrder('o1', 3, 'FAIL', 'Quedó polvo').subscribe();
    const req = http.expectOne('/cleaning-orders/o1/inspect');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('If-Match')).toBe('3');
    expect(req.request.body).toEqual({ result: 'FAIL', reasonText: 'Quedó polvo' });
    req.flush({});
  });

  it('la cola filtra por estado, «mías» y prioridad', () => {
    client.listCleaningOrders('s1', { status: ['CLN_PENDING', 'CLN_DONE'], assignedTo: 'me', priority: 'CLN_PRIO_STAT' }).subscribe();
    const req = http.expectOne((r) => r.url === '/sites/s1/cleaning-orders');
    expect(req.request.params.get('status')).toBe('CLN_PENDING,CLN_DONE');
    expect(req.request.params.get('assignedTo')).toBe('me');
    expect(req.request.params.get('priority')).toBe('CLN_PRIO_STAT');
    req.flush({});
  });

  it('el fin de un bloqueo y el historial A20 usan las rutas del contrato', () => {
    client.endBlock('b1', 'listo').subscribe();
    expect(http.expectOne('/care-space-blocks/b1/end').request.body).toEqual({ note: 'listo' });
    client.listStatusEvents('c1', 'AXIS_HYGIENE').subscribe();
    expect(http.expectOne((r) => r.url === '/care-spaces/c1/status-events').request.params.get('axis')).toBe('AXIS_HYGIENE');
    client.getAccess().subscribe();
    http.expectOne('/practice/infrastructure-access/me').flush({});
  });
});
