import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { InpatientStay } from '../../../core/data-access/adt/adt.types';
import type { BedBoard as Board } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { BedActions } from './bed-actions';
import { DischargeForm } from './discharge-form';
import { MoveDialog } from './move-dialog';

const confirm = vi.fn();
const confirmWithReason = vi.fn();

function base(usuario: string) {
  const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: DialogService, useValue: { confirm, confirmWithReason } }],
  });
  const http = TestBed.inject(HttpTestingController);
  const site = maqueta.acceso().sites[0]!.siteId;
  const celdas = () => (maqueta.llamar('GET', `/sites/${site}/bed-board`).body as Board).units.flatMap((u) => u.cells);
  return { maqueta, http, site, celdas };
}

afterEach(() => {
  verificarHttp();
  confirm.mockReset();
  confirmWithReason.mockReset();
});

describe('BedActions', () => {
  function montar(usuario: string, pick: (c: ReturnType<ReturnType<typeof base>['celdas']>[number]) => boolean) {
    const b = base(usuario);
    const fixture: ComponentFixture<BedActions> = TestBed.createComponent(BedActions);
    const cell = b.celdas().find(pick)!;
    fixture.componentRef.setInput('cell', cell);
    fixture.componentRef.setInput('siteId', b.site);
    fixture.detectChanges();
    return { ...b, fixture, cell, raiz: fixture.nativeElement as HTMLElement };
  }

  it('cama asignable con `f3.adt.place`: ofrece ingresar o reservar (con el modo en la URL)', () => {
    const { raiz } = montar('admision', (c) => c.assignable);
    expect(raiz.querySelector('[data-testid=bed-admit]')?.getAttribute('href')).toContain('bed=');
    expect(raiz.textContent).toContain('Reservar');
    expect(raiz.querySelector('[data-testid=bed-transfer]')).toBeNull();
  });

  it('cama ocupada: trasladar, intercambiar, dar de alta y ver la internación', () => {
    const { raiz } = montar('enfermeria', (c) => c.occupancy.code === 'OCC_OCCUPIED');
    expect(raiz.querySelector('[data-testid=bed-transfer]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid=bed-swap]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid=bed-discharge]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid=bed-stay-link]')).not.toBeNull();
  });

  it('Limpieza y Mantenimiento: ninguna acción de internación', () => {
    for (const u of ['limpieza', 'mantenimiento']) {
      TestBed.resetTestingModule();
      const { raiz } = montar(u, (c) => c.occupancy.code === 'OCC_OCCUPIED');
      expect(raiz.querySelector('[data-testid=bed-actions]'), u).toBeNull();
    }
  });

  it('«Confirmar ocupación»: relee la versión y asigna en una sola cadena; un fallo queda a la vista', async () => {
    const b = base('admision');
    // Una reserva real en la maqueta: la primera combinación cama libre × paciente sin violaciones.
    const { uuid } = await import('../../../core/mock/mock-store');
    let libre: ReturnType<typeof b.celdas>[number] | undefined;
    let paciente = '';
    for (const c of b.celdas().filter((x) => x.assignable)) {
      for (const p of ['p-guzman', 'p-torrez', 'p-quispe', 'p-rocha', 'p-flores', 'p-mamani'].map((k) => uuid(`pid-${k}`))) {
        const v = b.maqueta.llamar('POST', '/clinical/bed-compatibility', { careSpaceId: c.id, patientProfileId: p, levelOfCareCode: 'LOC_CARE_GENERAL' });
        if (v.status === 200 && (v.body as { violations: unknown[] }).violations.length === 0) {
          libre = c;
          paciente = p;
          break;
        }
      }
      if (libre) break;
    }
    expect(libre, 'hay una cama libre compatible').toBeDefined();
    const alta = b.maqueta.llamar('POST', '/clinical/admissions', {
      patientProfileId: paciente, practiceSiteId: b.site, levelOfCareCode: 'LOC_CARE_GENERAL',
      admissionSourceCode: 'ADM_SRC_EMERGENCY', reasonText: 'Reserva de prueba', bed: { careSpaceId: libre!.id, mode: 'RESERVE' },
    });
    expect(alta.status, JSON.stringify(alta.body)).toBe(201);
    const reservada = b.celdas().find((c) => c.id === libre!.id)!;
    expect(reservada.occupancy.code).toBe('OCC_RESERVED');
    const fixture = TestBed.createComponent(BedActions);
    fixture.componentRef.setInput('cell', reservada);
    fixture.componentRef.setInput('siteId', b.site);
    fixture.detectChanges();
    confirm.mockResolvedValue(true);
    (fixture.nativeElement.querySelector('[data-testid=bed-confirm-reservation]') as HTMLButtonElement).click();
    await fixture.whenStable();
    const enc = reservada.occupancy.encounterId!;
    const stay = b.maqueta.llamar('GET', `/clinical/encounters/${enc}/stay`).body as InpatientStay;
    http_(b).expectOne(`/clinical/encounters/${enc}/stay`).flush(stay);
    const asignar = http_(b).expectOne(`/clinical/encounters/${enc}/bed-assignment`);
    expect(asignar.request.headers.get('If-Match')).toBe(String(stay.encounter.rowVersion));
    expect(asignar.request.body).toEqual({ careSpaceId: libre!.id, mode: 'ASSIGN' });
    asignar.flush({ code: 'CONFLICT', reason: 'BED_NOT_ASSIGNABLE', message: 'Ya no', correlationId: 'req-conf-1' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid=bed-actions-failure]')).not.toBeNull();
  });
});

const http_ = (b: { http: HttpTestingController }) => b.http;

describe('MoveDialog', () => {
  it('M9: pide los destinos aparte y sólo ofrece camas asignables; compatibilidad con espera y cancelación (switchMap)', async () => {
    vi.useFakeTimers();
    try {
      const b = base('enfermeria');
      const ocupada = b.celdas().find((c) => c.occupancy.code === 'OCC_OCCUPIED')!;
      const fixture = TestBed.createComponent(MoveDialog);
      fixture.componentRef.setInput('mode', 'transfer');
      fixture.componentRef.setInput('cell', ocupada);
      fixture.componentRef.setInput('siteId', b.site);
      fixture.componentRef.setInput('encounterId', ocupada.occupancy.encounterId!);
      fixture.componentRef.setInput('rowVersion', 1);
      fixture.detectChanges();
      const tablero = b.http.expectOne((r) => r.url === `/sites/${b.site}/bed-board`);
      const real = b.maqueta.llamar('GET', `/sites/${b.site}/bed-board`).body as Board;
      tablero.flush(real);
      fixture.detectChanges();
      const asignables = real.units.flatMap((u) => u.cells).filter((c) => c.assignable && c.id !== ocupada.id);
      const comp = fixture.componentInstance as unknown as { options: () => { value: string }[]; pick: (id: string | null) => void };
      expect(comp.options().map((o) => o.value).sort()).toEqual(asignables.map((c) => c.id).sort());
      comp.pick(asignables[0]!.id);
      fixture.detectChanges();
      vi.advanceTimersByTime(100);
      comp.pick(asignables[1]?.id ?? asignables[0]!.id);
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      const pedidos = b.http.match((r) => r.url.endsWith('/bed-compatibility'));
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0]!.request.body.careSpaceId).toBe(asignables[1]?.id ?? asignables[0]!.id);
      pedidos[0]!.flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-compat-7' }, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('req-compat-7');
      const estado = fixture.componentInstance as unknown as { checking: () => boolean; target: () => string | null };
      expect(estado.target(), 'la cama elegida').not.toBeNull();
      // Con la compatibilidad en error (S9), no se manda el traslado.
      expect(estado.checking()).toBe(true);
      // El botón de la casa deshabilita con `aria-disabled` (no con el atributo nativo).
      expect(fixture.nativeElement.querySelector('[data-testid=move-submit]')!.getAttribute('aria-disabled')).toBe('true');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('DischargeForm (M7: el único egreso)', () => {
  it('valida la disposición, manda If-Match y deja el error de la API a la vista', () => {
    const b = base('enfermeria');
    const fixture = TestBed.createComponent(DischargeForm);
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.componentRef.setInput('rowVersion', 7);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    (raiz.querySelector('[data-testid=discharge-submit]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(raiz.textContent).toContain('Elija el tipo de egreso.');
    b.http.expectNone('/clinical/encounters/enc-1/discharge');
    (fixture.componentInstance as unknown as { disposition: { set: (v: string) => void } }).disposition.set('DISP_HOME');
    (raiz.querySelector('[data-testid=discharge-submit]') as HTMLButtonElement).click();
    const req = b.http.expectOne('/clinical/encounters/enc-1/discharge');
    expect(req.request.headers.get('If-Match')).toBe('7');
    expect(req.request.body.dischargeDispositionCode).toBe('DISP_HOME');
    req.flush({ code: 'CONFLICT', reason: 'ENCOUNTER_NOT_IN_PROGRESS', message: 'La internación ya terminó.', correlationId: 'req-egreso-3' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(raiz.querySelector('[data-testid=discharge-failure]')?.textContent).toContain('req-egreso-3');
  });
});
