import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { CensusDayView } from '../../../core/data-access/adt/adt.types';
import { shiftDate, siteDate } from '../../../core/mock/fixtures/inpatient';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { accesoDePrueba, MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { InpatientAccessStore } from '../inpatient-access.store';
import { Census } from './census';

/** El censo (F3.4): arreglo de `CensusDayView`, cierre con `unitIds` (M4), original → ajustado. */
describe('Census', () => {
  const confirm = vi.fn();

  async function montar(usuario = 'supervision') {
    const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    const acceso = accesoDePrueba();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'inpatient/census', component: Census }]),
        { provide: InpatientAccessStore, useValue: acceso },
        { provide: DialogService, useValue: { confirm, confirmWithReason: vi.fn() } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    return { maqueta, acceso, harness, http: TestBed.inject(HttpTestingController), raiz: () => harness.routeNativeElement as HTMLElement };
  }

  const ayer = () => shiftDate(siteDate(Date.now()), -1);
  afterEach(() => {
    verificarHttp();
    confirm.mockReset();
  });

  it('S1, S5 (Limpieza) y S3 sin camas censables', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar('limpieza');
    await harness.navigateByUrl('/inpatient/census');
    expect(raiz().textContent).toContain('Verificando permisos');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    expect(raiz().textContent).toContain('Su rol no incluye el censo');
    TestBed.resetTestingModule();
    const s = await montar();
    await s.harness.navigateByUrl(`/inpatient/census?date=${ayer()}`);
    s.acceso.listo(s.maqueta.acceso());
    s.harness.detectChanges();
    s.http.expectOne((r) => r.url.endsWith('/census')).flush([]);
    s.http.match((r) => r.url.endsWith('/clinical-units')).forEach((r) => r.flush([]));
    s.harness.detectChanges();
    expect(s.raiz().textContent).toContain('Este establecimiento no tiene camas censables.');
    expect(http).toBeDefined();
  });

  it('día abierto: vista previa; «Cerrar censo» manda las unidades abiertas (M4); S9 con requestId', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar();
    await harness.navigateByUrl(`/inpatient/census?date=${ayer()}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    maqueta.responderTodo(http, () => harness.detectChanges());
    const site = maqueta.acceso().sites[0]!.siteId;
    const dias = maqueta.llamar('GET', `/sites/${site}/census`, null, `date=${ayer()}`).body as CensusDayView[];
    expect(raiz().textContent).toContain('Abierto · vista previa');
    confirm.mockResolvedValue(true);
    (raiz().querySelector('[data-testid=census-close]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    const cierre = http.expectOne(`/sites/${site}/census/${ayer()}/close`);
    expect(cierre.request.body).toEqual({ unitIds: dias.filter((d) => d.status === 'OPEN').map((d) => d.unitId) });
    cierre.flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-censo-3' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(raiz().querySelector('[data-testid=census-failure]')?.textContent).toContain('req-censo-3');
  });

  it('día cerrado con ajuste: el original no se reescribe, se muestra «original → ajustado»', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar();
    const site = maqueta.acceso().sites[0]!.siteId;
    const dia = shiftDate(siteDate(Date.now()), -2);
    const fila = (maqueta.llamar('GET', `/sites/${site}/census`, null, `date=${dia}`).body as CensusDayView[])[0]!;
    if (fila.status === 'OPEN') maqueta.llamar('POST', `/sites/${site}/census/${dia}/close`, { unitIds: [fila.unitId] });
    const cerrado = (maqueta.llamar('GET', `/sites/${site}/census`, null, `date=${dia}`).body as CensusDayView[])[0]!;
    maqueta.llamar('POST', `/census-days/${cerrado.id}/adjustments`, { fieldCode: 'admissions', newValue: cerrado.adjustedTotals.admissions + 1, reasonText: 'Ingreso sin registrar' });
    await harness.navigateByUrl(`/inpatient/census?date=${dia}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    maqueta.responderTodo(http, () => harness.detectChanges());
    expect(raiz().textContent).toContain(`${cerrado.counts.admissions} → ${cerrado.adjustedTotals.admissions + 1}`);
    expect(raiz().querySelector('[data-testid=census-adjustments]')?.textContent).toContain('Ingresos');
  });
});
