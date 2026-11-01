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
import { AdmissionNew, bedModeOf } from './admission-new';
import { BedPicker } from './bed-picker';

const confirmWithReason = vi.fn();

describe('AdmissionNew', () => {
  it('?mode inválido no se cuela: sólo ASSIGN, RESERVE o NONE (LOW)', () => {
    expect(bedModeOf('RESERVE')).toBe('RESERVE');
    expect(bedModeOf('NONE')).toBe('NONE');
    expect(bedModeOf('ASSIGN')).toBe('ASSIGN');
    expect(bedModeOf('<script>')).toBe('ASSIGN');
    expect(bedModeOf(null)).toBe('ASSIGN');
  });

  async function montar(usuario = 'admision') {
    const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    const acceso = accesoDePrueba();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'inpatient/admissions/new', component: AdmissionNew }]),
        { provide: InpatientAccessStore, useValue: acceso },
        { provide: DialogService, useValue: { confirmWithReason, confirm: vi.fn() } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    return { maqueta, acceso, harness, http: TestBed.inject(HttpTestingController), raiz: () => harness.routeNativeElement as HTMLElement };
  }

  afterEach(() => verificarHttp());

  it('S1 y S5: Limpieza no ingresa pacientes', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar('limpieza');
    await harness.navigateByUrl('/inpatient/admissions/new');
    expect(raiz().textContent).toContain('Verificando permisos');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    expect(raiz().textContent).toContain('Ingresar pacientes es tarea de enfermería o admisión');
    expect(http.match((r) => r.url.includes('attending-practitioners'))).toHaveLength(0);
  });

  it('con `f3.adt.place` pide los profesionales de la sede y muestra el formulario por pasos', async () => {
    const { harness, acceso, maqueta, raiz, http } = await montar();
    await harness.navigateByUrl('/inpatient/admissions/new?mode=NONE');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    maqueta.responderTodo(http, () => harness.detectChanges());
    expect(raiz().querySelector('[data-testid=admission-new]')).not.toBeNull();
    expect(harness.routeDebugElement!.componentInstance.bedMode()).toBe('NONE');
  });
});

describe('BedPicker (H3)', () => {
  function montar() {
    const maqueta = new MaquetaDeInternacion(buscarUsuario('supervision')!);
    TestBed.configureTestingModule({
      imports: [BedPicker],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogService, useValue: { confirmWithReason } }],
    });
    const http = TestBed.inject(HttpTestingController);
    const site = maqueta.acceso().sites[0]!.siteId;
    const fixture = TestBed.createComponent(BedPicker);
    fixture.componentRef.setInput('siteId', site);
    fixture.componentRef.setInput('canOverride', true);
    fixture.detectChanges();
    const tablero = maqueta.llamar('GET', `/sites/${site}/bed-board`).body as BedBoard;
    http.expectOne((r) => r.url === `/sites/${site}/bed-board`).flush(tablero);
    fixture.detectChanges();
    const libres = tablero.units.flatMap((u) => u.cells).filter((c) => c.assignable);
    return { maqueta, http, fixture, libres, raiz: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    verificarHttp();
    confirmWithReason.mockReset();
  });

  it('espera (debounce), cancela la consulta anterior (switchMap) y muestra el error como S9 con requestId', () => {
    vi.useFakeTimers();
    try {
      const { http, fixture, libres, raiz } = montar();
      fixture.componentRef.setInput('patientProfileId', 'p-1');
      fixture.componentInstance.bedId.set(libres[0]!.id);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);
      fixture.componentRef.setInput('levelOfCareCode', 'LOC_CARE_ICU');
      fixture.detectChanges();
      vi.advanceTimersByTime(350);
      const primera = http.match('/clinical/bed-compatibility');
      expect(primera).toHaveLength(1);
      expect(primera[0]!.request.body).toMatchObject({ careSpaceId: libres[0]!.id, patientProfileId: 'p-1', levelOfCareCode: 'LOC_CARE_ICU' });
      // Mientras vuela, cambia la cama: la consulta vieja se cancela.
      fixture.componentInstance.bedId.set(libres[1]?.id ?? libres[0]!.id);
      fixture.componentRef.setInput('organism', 'KPC');
      fixture.detectChanges();
      vi.advanceTimersByTime(350);
      expect(primera[0]!.cancelled).toBe(true);
      http.expectOne('/clinical/bed-compatibility').flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-compat-9' }, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(raiz.querySelector('[data-testid=bed-compat-state]')?.textContent).toContain('req-compat-9');
    } finally {
      vi.useRealTimers();
    }
  });

  it('el forzado se descarta si cambia cualquier entrada (cama, paciente, nivel, aislamiento u organismo)', async () => {
    vi.useFakeTimers();
    try {
      const { http, fixture, libres } = montar();
      fixture.componentRef.setInput('patientProfileId', 'p-1');
      fixture.componentInstance.bedId.set(libres[0]!.id);
      fixture.detectChanges();
      vi.advanceTimersByTime(350);
      http.expectOne('/clinical/bed-compatibility').flush({ assignable: false, rules: [], violations: [{ rule: 'SEX', severity: 'OVERRIDABLE', detail: 'Otro sexo' }] });
      fixture.detectChanges();
      confirmWithReason.mockResolvedValue('Única cama libre, con acompañante autorizado');
      await (fixture.componentInstance as unknown as { force: () => Promise<void> }).force();
      expect(fixture.componentInstance.override()).not.toBeNull();
      fixture.componentRef.setInput('isolationCode', 'ISO_CONTACT');
      fixture.detectChanges();
      expect(fixture.componentInstance.override()).toBeNull();
      vi.advanceTimersByTime(350);
      http.match('/clinical/bed-compatibility').forEach((r) => r.flush({ assignable: true, rules: [], violations: [] }));
    } finally {
      vi.useRealTimers();
    }
  });
});
