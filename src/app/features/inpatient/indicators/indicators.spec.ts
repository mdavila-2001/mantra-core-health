import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { InpatientIndicators } from '../../../core/data-access/adt/adt.types';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { accesoDePrueba, MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { InpatientAccessStore } from '../inpatient-access.store';
import { coverageAsOf, Indicators } from './indicators';

/** Indicadores (F3.4): tal como vienen, S3 sin días cerrados, S7 con la antigüedad real del dato. */
describe('Indicators', () => {
  const base: InpatientIndicators = {
    period: { from: '2026-10-24', to: '2026-10-30' }, days: 7, bedDaysAvailable: 27, patientDays: 21, admissions: 4, discharges: 4, dischargeStayDays: 21,
    avgBeds: 27 / 7, occupancyPct: (21 / 27) * 100, alos: 5.25, bedTurnover: 4 / (27 / 7), turnoverInterval: 1.5,
    crossCheck: { occupancyFromAlos: (21 / 27) * 100, deltaPct: 0 },
    bedTurnaroundMinutes: { p50: 90, p90: 120, waitToStart: 20, cleaning: 45, inspection: 20 },
    coverage: { daysClosed: 7, daysMissing: [] },
  };

  it('asOf de S7 = corte del último día CERRADO, en la zona de la sede', () => {
    const conHueco = { ...base, coverage: { daysClosed: 5, daysMissing: ['2026-10-29', '2026-10-30'] } };
    expect(coverageAsOf(conHueco, 'America/La_Paz')!.toISOString()).toBe('2026-10-29T04:00:00.000Z');
    expect(coverageAsOf({ ...base, coverage: { daysClosed: 0, daysMissing: ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'] } }, 'America/La_Paz')).toBeNull();
  });

  async function montar(usuario = 'supervision') {
    const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    const acceso = accesoDePrueba();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([{ path: 'inpatient/indicators', component: Indicators }]), { provide: InpatientAccessStore, useValue: acceso }],
    });
    const harness = await RouterTestingHarness.create();
    return { maqueta, acceso, harness, http: TestBed.inject(HttpTestingController), raiz: () => harness.routeNativeElement as HTMLElement };
  }

  afterEach(() => verificarHttp());

  it('S1 → S2 → listo: KPI formateados con coma, sin redondear en el dato', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar();
    await harness.navigateByUrl('/inpatient/indicators?from=2026-10-24&to=2026-10-30');
    expect(raiz().textContent).toContain('Verificando permisos');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    http.expectOne((r) => r.url.endsWith('/inpatient-indicators') && !r.params.has('unitId')).flush(base);
    http.expectOne((r) => r.url.endsWith('/clinical-units')).flush([]);
    harness.detectChanges();
    expect(raiz().querySelector('[data-testid=kpi-occupancy]')?.textContent).toContain('77,78');
    expect(raiz().textContent).not.toContain('pueden estar atrasados');
  });

  it('S3 sin días cerrados (con próxima acción) y S7 con días faltantes', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar();
    await harness.navigateByUrl('/inpatient/indicators?from=2026-10-24&to=2026-10-30');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    http.expectOne((r) => r.url.endsWith('/inpatient-indicators')).flush({ ...base, coverage: { daysClosed: 0, daysMissing: ['2026-10-30'] } });
    http.expectOne((r) => r.url.endsWith('/clinical-units')).flush([]);
    harness.detectChanges();
    expect(raiz().textContent).toContain('Cerrar el censo del 30/10/2026');
    (harness.routeDebugElement!.componentInstance as { reload: () => void }).reload();
    harness.detectChanges();
    http.expectOne((r) => r.url.endsWith('/inpatient-indicators')).flush({ ...base, coverage: { daysClosed: 6, daysMissing: ['2026-10-30'] } });
    http.expectOne((r) => r.url.endsWith('/clinical-units')).flush([]);
    harness.detectChanges();
    expect(raiz().querySelector('[data-testid=indicators-missing]')?.textContent).toContain('30/10/2026');
  });

  it('S9 con requestId y S5 para Limpieza', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar();
    await harness.navigateByUrl('/inpatient/indicators');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    http.expectOne((r) => r.url.endsWith('/inpatient-indicators')).flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-ind-4' }, { status: 500, statusText: 'Error' });
    http.match((r) => r.url.endsWith('/clinical-units')).forEach((r) => r.cancelled || r.flush([]));
    harness.detectChanges();
    expect(raiz().textContent).toContain('req-ind-4');
    acceso.listo(new MaquetaDeInternacion(buscarUsuario('limpieza')!).acceso());
    harness.detectChanges();
    expect(raiz().textContent).toContain('Su rol no incluye los indicadores');
  });
});
