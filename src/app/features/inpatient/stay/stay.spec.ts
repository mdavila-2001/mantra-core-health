import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { BedBoard } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { accesoDePrueba, MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { InpatientAccessStore } from '../inpatient-access.store';
import { isCancellable, Stay } from './stay';

/** La ficha de internación (F3.4): espera el S1, arma la vista con la forma de la API y revisa con REVIEWED (H4). */
describe('Stay', () => {
  const confirmWithReason = vi.fn();

  async function montar(usuario = 'supervision') {
    const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    const acceso = accesoDePrueba();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'inpatient/stays/:encounterId', component: Stay }]),
        { provide: InpatientAccessStore, useValue: acceso },
        { provide: DialogService, useValue: { confirmWithReason, confirm: vi.fn() } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const site = maqueta.acceso().sites[0]!.siteId;
    const ocupada = (maqueta.llamar('GET', `/sites/${site}/bed-board`).body as BedBoard).units.flatMap((u) => u.cells).find((c) => c.occupancy.encounterId)!;
    return { maqueta, acceso, harness, http: TestBed.inject(HttpTestingController), enc: ocupada.occupancy.encounterId!, cama: ocupada, raiz: () => harness.routeNativeElement as HTMLElement };
  }

  afterEach(() => {
    verificarHttp();
    confirmWithReason.mockReset();
  });

  it('S1: no pide la estancia hasta saber qué puede la persona', async () => {
    const { harness, http, enc, raiz } = await montar();
    await harness.navigateByUrl(`/inpatient/stays/${enc}`);
    expect(raiz().textContent).toContain('Verificando permisos');
    expect(http.match((r) => r.url.endsWith('/stay'))).toHaveLength(0);
  });

  it('S2 → listo: la cama actual por su código (estructura de F1), el estado y el nivel en palabras', async () => {
    const { harness, http, acceso, maqueta, enc, cama, raiz } = await montar();
    await harness.navigateByUrl(`/inpatient/stays/${enc}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    expect(raiz().querySelector('.view-state-host__loading')).not.toBeNull();
    // La estancia, el paciente y cada cama: lo que no es de F2/F3 se responde a mano con la forma de F1/perfiles.
    const stay = http.expectOne(`/clinical/encounters/${enc}/stay`);
    stay.flush(maqueta.llamar('GET', `/clinical/encounters/${enc}/stay`).body as object);
    for (const r of http.match((x) => x.url.startsWith('/profiles/patients/'))) r.flush({ profileId: 'p', patientCode: 'PAC-1', displayName: 'Rosa Mamani', relatedPersons: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
    for (const r of http.match((x) => x.url.startsWith('/care-spaces/'))) r.flush({ id: cama.id, code: cama.code, name: cama.name, siteId: maqueta.acceso().sites[0]!.siteId, path: [] });
    harness.detectChanges();
    expect(raiz().querySelector('[data-testid=stay]')).not.toBeNull();
    expect(raiz().textContent).toContain(`Cama ${cama.code}`);
    expect(raiz().querySelector('[data-testid=stay-status]')?.textContent).toContain('En curso');
    expect(raiz().textContent).toContain('Rosa Mamani');
  });

  it('S6: otra organización → no encontrado con vuelta al tablero', async () => {
    const { harness, http, acceso, maqueta, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/stays/no-existe');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    http.expectOne('/clinical/encounters/no-existe/stay').flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(raiz().textContent).toContain('No encontramos lo que busca');
  });

  it('S9: un fallo de la estancia muestra el requestId', async () => {
    const { harness, http, acceso, maqueta, enc, raiz } = await montar();
    await harness.navigateByUrl(`/inpatient/stays/${enc}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    http.expectOne(`/clinical/encounters/${enc}/stay`).flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-stay-5' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(raiz().textContent).toContain('req-stay-5');
  });

  it('H4: revisar un incidente manda status REVIEWED', async () => {
    const { harness, http, acceso, maqueta, enc } = await montar();
    await harness.navigateByUrl(`/inpatient/stays/${enc}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    http.expectOne(`/clinical/encounters/${enc}/stay`).flush(maqueta.llamar('GET', `/clinical/encounters/${enc}/stay`).body as object);
    http.match(() => true).forEach((r) => r.flush({}));
    harness.detectChanges();
    confirmWithReason.mockResolvedValue('Revisado con la familia');
    const ficha = harness.routeDebugElement!.componentInstance as { review: (i: object) => Promise<void> };
    await ficha.review({ id: 'inc-1', encounterLocationId: null, careSpaceId: 'c', violations: [{ rule: 'SEX', severity: 'OVERRIDABLE', detail: 'x' }], status: 'PLC_INC_OPEN', reviewedAt: null, bedCode: '301-A' });
    const req = http.expectOne('/clinical/placement-incidents/inc-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'REVIEWED', reviewNote: 'Revisado con la familia' });
    req.flush({ id: 'inc-1', status: 'REVIEWED' });
    http.match(() => true).forEach((r) => r.flush({}));
  });

  it('cancelable: reserva vigente o traslado de menos de 120 min con cama anterior', () => {
    const ahora = Date.parse('2026-10-31T12:00:00Z');
    const base = { id: 'l', encounterId: 'e', careSpaceId: 'c', endReason: null, periodEnd: null, placementIncidentId: null };
    expect(isCancellable({ ...base, status: 'LOCATION_RESERVED', movement: 'ADT_RESERVE', periodStart: '2026-10-31T11:00:00Z', previousEncounterLocationId: null }, ahora)).toBe(true);
    expect(isCancellable({ ...base, status: 'LOCATION_ACTIVE', movement: 'ADT_TRANSFER', periodStart: '2026-10-31T11:00:00Z', previousEncounterLocationId: 'p' }, ahora)).toBe(true);
    expect(isCancellable({ ...base, status: 'LOCATION_ACTIVE', movement: 'ADT_TRANSFER', periodStart: '2026-10-31T08:00:00Z', previousEncounterLocationId: 'p' }, ahora)).toBe(false);
    expect(isCancellable({ ...base, status: 'LOCATION_ACTIVE', movement: 'ADT_ADMIT', periodStart: '2026-10-31T11:00:00Z', previousEncounterLocationId: null }, ahora)).toBe(false);
  });
});
