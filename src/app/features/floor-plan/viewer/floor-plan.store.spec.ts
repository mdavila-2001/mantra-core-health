import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FloorPlanClient } from '../../../core/data-access/floor-plan/floor-plan.client';
import type { FloorPlanMeta, FloorPlanSummary, LayoutResponse, PlanStateResponse, ViewerCaps } from '../../../core/data-access/floor-plan/floor-plan.types';
import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import { FloorPlanStore } from './floor-plan.store';

const VIEWER: ViewerCaps = { canEditPlan: false, canSeeState: true, canSeePatient: false, canOpenSpaceFile: true, scope: 'ALL' };
const META = { id: 'p1', code: 'P1', name: 'Piso 1', anchor: null, widthM: 64, heightM: 26, elevationM: 3.6, layoutVersion: 3, validFrom: '2026-01-01', validTo: null, counts: { placed: 1, unplaced: 0, elements: 0 }, siteId: 's', northBearingDeg: 0, gridSizeM: 0.5, snapToGrid: true, contactToleranceM: 0.01, rowVersion: 1 } as FloorPlanMeta;
const SUMMARY: FloorPlanSummary = { ...META };

function layout(total = 1, viewer: ViewerCaps = VIEWER): LayoutResponse {
  return {
    floorPlan: META, layoutVersion: 3, asOf: '2026-10-29T12:00:00Z', page: { nextCursor: null, total }, viewer, elements: [],
    spaces: total === 0 ? [] : [{ placementId: 'pl', spaceId: 'sp', rowVersion: 1, zOrder: 10, locked: false, inScope: true, bbox: [0, 0, 4, 4], areaCalcM2: 16, geometry: { kind: 'RECT', centerXM: 2, centerYM: 2, widthM: 4, depthM: 4, rotationDeg: 0 }, code: 'A', name: 'A', form: { code: 'ROOM' }, function: { code: 'X' }, parentId: null }],
  };
}
const state = (over: Partial<PlanStateResponse> = {}): PlanStateResponse => ({ asOf: new Date().toISOString(), lastEventAt: null, layoutVersion: 3, spaces: {}, rollups: {}, counts: { total: 0, assignable: 0, occupied: 0 }, viewer: VIEWER, ...over });
const http = (status: number, error: unknown = null): HttpErrorResponse => new HttpErrorResponse({ status, error });

describe('FloorPlanStore: los nueve estados M34', () => {
  let store: FloorPlanStore;
  let client: { listPlans: ReturnType<typeof vi.fn>; getLayout: ReturnType<typeof vi.fn>; getState: ReturnType<typeof vi.fn>; getFocus: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    client = { listPlans: vi.fn(() => of([SUMMARY])), getLayout: vi.fn(() => of(layout())), getState: vi.fn(() => of(state())), getFocus: vi.fn(() => of([])) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), FloorPlanStore,
        { provide: FloorPlanClient, useValue: client },
        { provide: MedicalOrganizationClient, useValue: { listPractices: () => of([]), getConsole: () => of({ sites: [] }) } },
      ],
    });
    store = TestBed.inject(FloorPlanStore);
    store.siteId.set('s');
  });
  afterEach(() => store.stop());

  const status = (): string => store.screenState().status;

  it('S1: la pantalla arranca esperando la autorización de la ruta, sin haber pedido nada', () => {
    expect(status()).toBe('route-auth-pending');
    expect(client.listPlans).not.toHaveBeenCalled();
  });

  it('S2 y camino feliz: carga y queda lista con la silueta antes que la ficha', async () => {
    const pending = store.bootstrap();
    expect(status()).toBe('loading');
    await pending;
    expect(status()).toBe('ready');
    expect(client.getLayout.mock.calls[0]![1]).toMatchObject({ detail: 'lite' });
    expect(client.getLayout.mock.calls.at(-1)![1]).toMatchObject({ detail: 'full' });
  });

  it('S3: una sede sin lienzos ofrece pedirlo (la acción es obligatoria)', async () => {
    client.listPlans.mockReturnValue(of([]));
    await store.bootstrap();
    const s = store.screenState();
    expect(s.status).toBe('empty');
    if (s.status === 'empty') expect(s.nextAction.label).toMatch(/administrador/);
  });

  it('S3: un lienzo sin espacios ofrece «Ubicar espacios» a quien puede editar y pedirlo a quien no', async () => {
    store.planId.set('p1');
    client.getLayout.mockReturnValue(of(layout(0, { ...VIEWER, canEditPlan: true })));
    await store.load();
    let s = store.screenState();
    expect(s.status === 'empty' && s.nextAction.label).toBe('Ubicar espacios');
    client.getLayout.mockReturnValue(of(layout(0)));
    await store.load();
    s = store.screenState();
    expect(s.status === 'empty' && s.nextAction.label).toMatch(/administrador/);
  });

  it('S3: un foco sin nada dibujado ofrece quitar el foco', async () => {
    store.planId.set('p1');
    store.unitId.set('u');
    client.getLayout.mockReturnValue(of(layout(0)));
    await store.load();
    const s = store.screenState();
    expect(s.status === 'empty' && s.nextAction.label).toBe('Quitar el foco');
  });

  it('S5: un 403 es «prohibido» y trae el requestId si la API lo mandó', async () => {
    store.planId.set('p1');
    client.getLayout.mockReturnValue(throwError(() => http(403, { code: 'FORBIDDEN', reason: 'INFRA_ACTION_NOT_ALLOWED', requestId: 'req-403' })));
    await store.load();
    const s = store.screenState();
    expect(s.status).toBe('forbidden');
    if (s.status === 'forbidden') expect(s.requestId).toBe('req-403');
  });

  it('S6: un 404 es «no encontrado» y no filtra ni mensaje ni identificador', async () => {
    store.planId.set('ajeno');
    client.getLayout.mockReturnValue(throwError(() => http(404, { code: 'NOT_FOUND', message: 'ajeno no existe en su tenant' })));
    await store.load();
    const s = store.screenState();
    expect(s.status).toBe('not-found');
    expect(JSON.stringify(s)).not.toContain('ajeno');
  });

  it('S8: sin red al cargar es «offline»', async () => {
    store.planId.set('p1');
    client.getLayout.mockReturnValue(throwError(() => http(0)));
    await store.load();
    expect(status()).toBe('offline');
  });

  it('S9: un error inesperado exige el requestId; sin él se marca «sin-id», nunca un spinner infinito', async () => {
    store.planId.set('p1');
    client.getLayout.mockReturnValue(throwError(() => http(500, { code: 'INTERNAL', requestId: 'req-500' })));
    await store.load();
    const s = store.screenState();
    expect(s.status === 'error' && s.requestId).toBe('req-500');
  });

  it('S7: con el sondeo caído y datos previos queda «stale» con la hora del último dato', async () => {
    store.planId.set('p1');
    await store.load();
    expect(status()).toBe('ready');
    client.getState.mockReturnValue(throwError(() => http(0)));
    await store.pollState();
    const s = store.screenState();
    expect(s.status).toBe('stale');
    if (s.status === 'stale') expect(s.asOf).toBeInstanceOf(Date);
    expect(store.pollFailure()).toBe('offline');
  });

  it('S7: un dato de más de 120 s también es «stale»', async () => {
    store.planId.set('p1');
    client.getState.mockReturnValue(of(state({ asOf: new Date(Date.now() - 130_000).toISOString() })));
    await store.load();
    store.nowMs.set(Date.now());
    expect(status()).toBe('stale');
  });

  it('reintentar el sondeo vuelve a «ready» cuando llega un dato fresco', async () => {
    store.planId.set('p1');
    await store.load();
    client.getState.mockReturnValue(throwError(() => http(500, { code: 'INTERNAL', requestId: 'r' })));
    await store.pollState();
    expect(status()).toBe('stale');
    client.getState.mockReturnValue(of(state()));
    await store.retryState();
    expect(status()).toBe('ready');
  });

  it('si el layoutVersion del estado difiere del cargado avisa que otra persona modificó el plano', async () => {
    store.planId.set('p1');
    client.getState.mockReturnValue(of(state({ layoutVersion: 4 })));
    await store.load();
    expect(store.layoutChanged()).toBe(true);
  });

  it('un rol sin estado (Facturación) no sondea el estado', async () => {
    store.planId.set('p1');
    client.getLayout.mockReturnValue(of(layout(1, { ...VIEWER, canSeeState: false })));
    await store.load();
    expect(client.getState).not.toHaveBeenCalled();
    expect(store.canSeeState()).toBe(false);
  });

  it('el nombre del paciente solo se pide con canSeePatient y tras 350 ms; se cancela si el puntero se va', async () => {
    vi.useFakeTimers();
    try {
      const getPlanCard = vi.fn(() => of({ asOf: 'x', openBlocks: [], patient: { displayName: 'Carmen', initials: 'C', sexCode: 'F', ageYears: 1, encounterId: 'e', admittedAt: 'x', losDays: 1 } }));
      (client as unknown as { getPlanCard: unknown }).getPlanCard = getPlanCard;
      store.layout.set(layout(1, { ...VIEWER, canSeePatient: true }));
      store.state.set(state({ spaces: { sp: { lifecycle: { code: 'x' }, availability: { code: 'x', since: 'x' }, occupancy: { code: 'OCC_OCCUPIED', since: 'x', patient: { initials: 'C', sexCode: 'F', ageYears: 1 } }, hygiene: { code: 'x', since: 'x', terminalRequired: false }, isolation: { code: 'x', since: 'x' }, v2Code: 'O', assignable: false, lastEventAt: 'x', opsVersion: 1 } } }));
      store.scheduleDetailFor('sp');
      vi.advanceTimersByTime(340);
      store.scheduleDetailFor(null); // el puntero se fue antes
      vi.advanceTimersByTime(1000);
      expect(getPlanCard).not.toHaveBeenCalled();
      store.scheduleDetailFor('sp');
      vi.advanceTimersByTime(351);
      expect(getPlanCard).toHaveBeenCalledTimes(1);
      expect(store.patientNameOf('sp')).toBe('Carmen');
      store.scheduleDetailFor('sp'); // cache de 30 s: no vuelve a pedir
      vi.advanceTimersByTime(1000);
      expect(getPlanCard).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin canSeePatient jamás pide el nombre', () => {
    vi.useFakeTimers();
    try {
      const getPlanCard = vi.fn();
      (client as unknown as { getPlanCard: unknown }).getPlanCard = getPlanCard;
      store.layout.set(layout(1, VIEWER));
      store.scheduleDetailFor('sp');
      vi.advanceTimersByTime(5000);
      expect(getPlanCard).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
