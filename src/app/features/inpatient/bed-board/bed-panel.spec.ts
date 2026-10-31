import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { BedBoard, OperationalState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { MaquetaDeInternacion } from '../../../../testing/maqueta-de-internacion';
import { BedPanel } from './bed-panel';

const opsCode = (s: OperationalState): string => s.path.at(-1)?.name ?? s.name;

/** El panel de cama (F2.4): una cama a la vez (H1), acciones según `actions` + estado, M34. */
describe('BedPanel', () => {
  let fixture: ComponentFixture<BedPanel>;
  let http: HttpTestingController;
  let maqueta: MaquetaDeInternacion;
  const confirmWithReason = vi.fn();

  function montar(usuario = 'enfermeria') {
    maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    TestBed.configureTestingModule({
      imports: [BedPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogService, useValue: { confirmWithReason, confirm: vi.fn() } }],
    });
    fixture = TestBed.createComponent(BedPanel);
    http = TestBed.inject(HttpTestingController);
  }

  const celdas = () => (maqueta.llamar('GET', `/sites/${maqueta.acceso().sites[0]!.siteId}/bed-board`).body as BedBoard).units.flatMap((u) => u.cells);
  const raiz = () => fixture.nativeElement as HTMLElement;
  const estado = (id: string) => http.match((r) => r.url === `/care-spaces/${id}/operational-state`);
  const historial = (id: string) => http.match((r) => r.url === `/care-spaces/${id}/status-events`);

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    confirmWithReason.mockReset();
  });

  it('S2 mientras carga; listo con los ejes en palabras y el historial A20', () => {
    montar();
    const cama = celdas().find((c) => c.code === '301-A')!;
    fixture.componentRef.setInput('cellId', cama.id);
    fixture.detectChanges();
    expect(raiz().querySelector('.view-state-host__loading')).not.toBeNull();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    expect(raiz().querySelector('[data-testid=bed-panel]')).not.toBeNull();
    expect(raiz().textContent).toContain('Ocupada');
    expect(raiz().textContent).toMatch(/masculino|femenino|sin dato/);
  });

  it('H1: al cambiar de cama cancela el pedido anterior y no habilita acciones con el estado de otra', () => {
    montar();
    const [a, b] = celdas().filter((c) => c.availability.code === 'SPACE_OP_AVAILABLE');
    fixture.componentRef.setInput('cellId', a!.id);
    fixture.detectChanges();
    const pedidoA = estado(a!.id)[0]!;
    fixture.componentRef.setInput('cellId', b!.id);
    fixture.detectChanges();
    expect(pedidoA.cancelled).toBe(true);
    // Llega tarde la respuesta de A (o un pedido de A que no se canceló): no se pinta.
    expect(raiz().querySelector('[data-testid=bed-panel]')).toBeNull();
    const ok = maqueta.llamar('GET', `/care-spaces/${b!.id}/operational-state`).body as OperationalState;
    estado(b!.id)[0]!.flush(ok);
    historial(b!.id)[0]!.flush({ items: [], nextCursor: null });
    historial(a!.id).forEach((r) => r.cancelled || r.flush({ items: [], nextCursor: null }));
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid=bed-panel]')?.textContent).toContain('Estado por eje');
    expect(raiz().textContent).toContain(b!.code === ok.code ? opsCode(ok) : '');
    // `aria-disabled` es como deshabilita el botón de la casa.
    expect(raiz().querySelector('[data-testid=bed-block-clinical]')!.getAttribute('aria-disabled')).toBe('false');
  });

  it('H1: si la respuesta trae otra cama, no hay acciones', () => {
    montar();
    const [a, b] = celdas().filter((c) => c.availability.code === 'SPACE_OP_AVAILABLE');
    fixture.componentRef.setInput('cellId', a!.id);
    fixture.detectChanges();
    estado(a!.id)[0]!.flush(maqueta.llamar('GET', `/care-spaces/${b!.id}/operational-state`).body as object);
    historial(a!.id)[0]!.flush({ items: [], nextCursor: null });
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid=bed-block-clinical]')).toBeNull();
    expect(raiz().querySelector('[data-testid=bed-panel]')).toBeNull();
  });

  it('marcar sucia manda If-Match-Ops con la versión vigente y relee; el error queda a la vista con su requestId (S9)', async () => {
    montar();
    const libre = celdas().find((c) => c.hygiene.code === 'HYG_INSPECTED' && c.openCleaningOrderId === null)!;
    fixture.componentRef.setInput('cellId', libre.id);
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    confirmWithReason.mockResolvedValue('Derrame de suero');
    (raiz().querySelector('[data-testid=bed-mark-dirty]') as HTMLButtonElement).click();
    await fixture.whenStable();
    const req = http.expectOne(`/care-spaces/${libre.id}/hygiene`);
    expect(req.request.headers.get('If-Match-Ops')).toBe(String(libre.opsVersion));
    expect(req.request.body).toEqual({ action: 'mark-dirty', reasonText: 'Derrame de suero' });
    req.flush({ code: 'INTERNAL', message: 'Falló', correlationId: 'req-sucia-1' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid=bed-panel-failure]')?.textContent).toContain('req-sucia-1');
  });

  it('el fin de mantenimiento termina el bloqueo de MANTENIMIENTO, no el primero de la lista', async () => {
    montar('mantenimiento');
    const cama = celdas().find((c) => c.availability.code === 'SPACE_OP_MAINTENANCE')!;
    fixture.componentRef.setInput('cellId', cama.id);
    fixture.detectChanges();
    const real = maqueta.llamar('GET', `/care-spaces/${cama.id}/operational-state`).body as OperationalState;
    const mant = real.openBlocks.find((b) => b.kindCode === 'BLOCK_MAINTENANCE')!;
    const otro = { ...mant, id: 'blk-otro', kindCode: 'BLOCK_ADMIN' };
    estado(cama.id)[0]!.flush({ ...real, openBlocks: [otro, mant] });
    historial(cama.id)[0]!.flush({ items: [], nextCursor: null });
    fixture.detectChanges();
    confirmWithReason.mockResolvedValue('Listo el cambio de cabecera');
    (raiz().querySelector('[data-testid=bed-end-maintenance]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(http.match('/care-space-blocks/blk-otro/end')).toHaveLength(0);
    http.expectOne(`/care-space-blocks/${mant.id}/end`).flush({ ...mant, endedAt: new Date().toISOString() });
    maqueta.responderTodo(http, () => fixture.detectChanges());
  });

  it('Limpieza ve el estado sin paciente y sin acciones clínicas', () => {
    montar('limpieza');
    const ocupada = celdas().find((c) => c.occupancy.code === 'OCC_OCCUPIED')!;
    fixture.componentRef.setInput('cellId', ocupada.id);
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    expect(raiz().querySelector('[data-testid=bed-block-clinical]')).toBeNull();
    expect(raiz().querySelector('[data-testid=bed-isolation]')).toBeNull();
    expect(raiz().textContent).not.toMatch(/masculino|femenino/);
  });

  it('S6: un espacio de otro tenant es «no encontrado»', () => {
    montar();
    fixture.componentRef.setInput('cellId', 'no-existe');
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    expect(raiz().querySelector('[data-testid=bed-panel]')).toBeNull();
    expect(raiz().textContent).toContain('No encontramos lo que busca');
  });
});
