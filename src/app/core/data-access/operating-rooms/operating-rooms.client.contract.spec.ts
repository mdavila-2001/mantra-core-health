import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OperatingRoomsClient } from './operating-rooms.client';
import type { OrBlock, OrUtilization, TurnoverCleaning } from './operating-rooms.types';

/*
 * Fixtures de contrato (M7): cada cuerpo es la forma **literal** que devuelve
 * la API en `origin/claude/trusting-hawking-q3p12v`, copiada de sus vistas:
 *
 * - `OperatingRoomsReadUseCases.list` y `.utilization` (`or-read.use-cases.ts`)
 * - `blockView` y `OrBlocksUseCases.list` (`or.use-cases.ts`)
 * - `CleaningOrderDto` e `inspect → {order, nextOrderId}` (F2, `care-space-ops.controller.ts`)
 *
 * Si la API cambia la forma, se actualiza el fixture **y** la pantalla; no se
 * ajusta el fixture para que pase.
 */
const ROOM_LIST = [
  {
    careSpace: { id: 'or-1', code: 'QX-01', name: 'Quirófano 1' },
    resourceId: 'res-1',
    prepMinutes: 20,
    cleanupMinutes: 30,
    cell: { availability: { code: 'AVAILABLE' } },
    todayCases: 2,
    todayBlocks: 1,
  },
];

const BLOCK_VIEW = {
  id: 'b-1',
  seriesId: null,
  operatingRoomId: 'or-1',
  owner: { kind: 'SERVICE', clinicalUnitId: null, specialtyConceptId: 'sp-trauma', surgeonProfileId: null, label: 'Traumatología' },
  startsAt: '2026-11-02T12:00:00.000Z',
  endsAt: '2026-11-02T18:00:00.000Z',
  releaseAt: '2026-10-30T12:00:00.000Z',
  status: 'ORB_ACTIVE',
  releasedAt: null,
  releasedByUserId: null,
  releaseReason: null,
  releasedMinutes: null,
  rowVersion: 3,
};

const UTILIZATION = {
  from: '2026-10-19',
  to: '2026-11-01',
  rooms: [
    { operatingRoomId: 'or-1', code: 'QX-01', sessionMinutes: 600, touchMinutes: 300, roomUtilizationPct: 50, turnoverMinutesP50: 25, blocks: { allocated: 600, released: 120, blockUtilizationPct: 62.5 } },
    { operatingRoomId: 'or-2', code: 'QX-02', sessionMinutes: 0, touchMinutes: 0, roomUtilizationPct: null, turnoverMinutesP50: null, blocks: { allocated: 0, released: 0, blockUtilizationPct: null } },
  ],
};

const CLEANING_ORDER = {
  id: 'co-1',
  careSpaceId: 'or-1',
  careSpaceCode: 'QX-01',
  careSpaceName: 'Quirófano 1',
  clinicalUnitId: null,
  typeCode: 'CLEAN_OR_TURNOVER',
  triggerCode: 'OR_CASE_END',
  priorityCode: 'URGENT',
  statusCode: 'CLN_IN_PROGRESS',
  requestedAt: '2026-11-02T14:00:00.000Z',
  dueAt: null,
  assignedUserId: null,
  startedAt: '2026-11-02T14:05:00.000Z',
  finishedAt: null,
  finishedByUserId: null,
  inspectedAt: null,
  inspectionResult: null,
  rejectionReason: null,
  previousOrderId: null,
  ageMinutes: 5,
  rowVersion: 2,
};

describe('OperatingRoomsClient · contrato con la API', () => {
  let client: OperatingRoomsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(OperatingRoomsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('salas: la forma de la API, sin ruta ni estado de la sala', () => {
    let rooms: unknown = null;
    client.listOperatingRooms('s-1').subscribe((r) => (rooms = r));
    http.expectOne('/sites/s-1/operating-rooms').flush(ROOM_LIST);
    expect(rooms).toEqual(ROOM_LIST);
  });

  it('bloques: dueño con ids y rótulo de la API, casos como ids, filtros que la API acepta', () => {
    let blocks: readonly OrBlock[] = [];
    client.listBlocks('s-1', { from: '2026-11-02T00:00:00.000Z', to: '2026-11-09T00:00:00.000Z', operatingRoomId: 'or-1' }).subscribe((b) => (blocks = b));
    const req = http.expectOne((r) => r.url === '/sites/s-1/or-blocks');
    expect([...req.request.params.keys()].sort()).toEqual(['from', 'operatingRoomId', 'to']);
    req.flush([{ ...BLOCK_VIEW, usedMinutes: 120, cases: ['c-1', 'c-2'] }]);
    expect(blocks[0]!.owner.label).toBe('Traumatología');
    expect(blocks[0]!.owner.specialtyConceptId).toBe('sp-trauma');
    expect(blocks[0]!.cases).toEqual(['c-1', 'c-2']);
  });

  it('alta: manda specialtyConceptId (CreateOrBlocksDto), nunca specialtyCode', () => {
    client
      .createBlock('s-1', { operatingRoomId: 'or-1', ownerKind: 'SERVICE', specialtyConceptId: 'sp-trauma', startsAt: BLOCK_VIEW.startsAt, endsAt: BLOCK_VIEW.endsAt, releaseHours: 72 })
      .subscribe();
    const req = http.expectOne('/sites/s-1/or-blocks');
    expect(req.request.body.specialtyConceptId).toBe('sp-trauma');
    expect('specialtyCode' in req.request.body).toBe(false);
    req.flush({ seriesId: null, blocks: [BLOCK_VIEW] });
  });

  it('liberar: manda la versión leída y recibe blockView (sin uso ni casos)', () => {
    let view: unknown = null;
    client.releaseBlock('b-1', 3, 'Vacaciones').subscribe((v) => (view = v));
    const req = http.expectOne('/or-blocks/b-1/release');
    expect(req.request.headers.get('If-Match')).toBe('"3"');
    expect(req.request.body).toEqual({ reasonText: 'Vacaciones' });
    req.flush({ ...BLOCK_VIEW, status: 'ORB_RELEASED', releasedMinutes: 360 });
    expect(view).toEqual({ ...BLOCK_VIEW, status: 'ORB_RELEASED', releasedMinutes: 360 });
  });

  it('utilización con la API de `3036730d2`: sus totals ganan y el cliente sólo completa recambio y bloques', () => {
    let u: OrUtilization | null = null;
    client.getUtilization('s-1', { from: '2026-10-19', to: '2026-11-01' }).subscribe((x) => (u = x));
    const apiTotals = { sessionMinutes: 600, touchMinutes: 300, roomUtilizationPct: 50, blockUtilizationPct: 62.5 };
    http.expectOne((r) => r.url === '/sites/s-1/or-utilization').flush({ ...UTILIZATION, asOf: '2026-11-01T10:00:00.000Z', totals: apiTotals });
    expect(u!.asOf).toBe('2026-11-01T10:00:00.000Z');
    expect(u!.totals).toEqual({ ...apiTotals, turnoverMinutesP50: 25, blockAllocated: 600, blockReleased: 120 });
  });

  it('utilización sin totals ni asOf (API anterior): el cliente suma con las fórmulas de la API', () => {
    let u: OrUtilization | null = null;
    client.getUtilization('s-1', { from: '2026-10-19', to: '2026-11-01' }).subscribe((x) => (u = x));
    http.expectOne((r) => r.url === '/sites/s-1/or-utilization').flush(UTILIZATION);
    expect(u!.rooms).toEqual(UTILIZATION.rooms);
    expect(u!.totals).toEqual({
      sessionMinutes: 600,
      touchMinutes: 300,
      roomUtilizationPct: 50,
      turnoverMinutesP50: 25,
      blockAllocated: 600,
      blockReleased: 120,
      blockUtilizationPct: 62.5,
    });
    expect(u!.asOf).toBeUndefined();
  });

  it('recambio: start/finish devuelven CleaningOrderDto; inspect lo envuelve; siempre con If-Match', () => {
    const seen: TurnoverCleaning[] = [];
    client.turnoverStep('co-1', 'finish', 2).subscribe((t) => seen.push(t));
    const finish = http.expectOne('/cleaning-orders/co-1/finish');
    expect(finish.request.headers.get('If-Match')).toBe('"2"');
    finish.flush({ ...CLEANING_ORDER, statusCode: 'CLN_DONE', rowVersion: 3 });
    client.turnoverStep('co-1', 'inspect', 3).subscribe((t) => seen.push(t));
    const inspect = http.expectOne('/cleaning-orders/co-1/inspect');
    expect(inspect.request.body).toEqual({ result: 'PASS' });
    inspect.flush({ order: { ...CLEANING_ORDER, statusCode: 'CLN_INSPECTED', rowVersion: 4 }, nextOrderId: null });
    expect(seen).toEqual([
      { id: 'co-1', statusCode: 'CLN_DONE', rowVersion: 3 },
      { id: 'co-1', statusCode: 'CLN_INSPECTED', rowVersion: 4 },
    ]);
  });
});
