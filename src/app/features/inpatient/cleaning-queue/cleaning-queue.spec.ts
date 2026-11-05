import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { CleaningOrder, CleaningOrderPage } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { accesoDePrueba, MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { InpatientAccessStore } from '../inpatient-access.store';
import { CleaningQueue } from './cleaning-queue';

/** La cola de limpieza (F2.4): M34, sin paciente, H2 y que Esc no rechace una inspección. */
describe('CleaningQueue', () => {
  const confirm = vi.fn();
  const confirmWithReason = vi.fn();

  async function montar(usuario = 'supervisora-limpieza') {
    const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    const acceso = accesoDePrueba();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'inpatient/cleaning', component: CleaningQueue }]),
        { provide: InpatientAccessStore, useValue: acceso },
        { provide: DialogService, useValue: { confirm, confirmWithReason } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    const site = maqueta.acceso().sites[0]!.siteId;
    return { maqueta, acceso, harness, http, site, raiz: () => harness.routeNativeElement as HTMLElement };
  }
  const colas = (http: HttpTestingController): TestRequest[] => http.match((r) => r.url.endsWith('/cleaning-orders') && r.method === 'GET');

  afterEach(() => {
    verificarHttp();
    confirm.mockReset();
    confirmWithReason.mockReset();
  });

  it('S1 y S5', async () => {
    const { harness, http, acceso, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/cleaning');
    expect(raiz().textContent).toContain('Verificando permisos');
    acceso.listo({ userId: 'x', tenantId: 't', sites: [] });
    harness.detectChanges();
    expect(raiz().textContent).toContain('Su rol no incluye la cola de limpieza');
    expect(colas(http)).toHaveLength(0);
  });

  it('listo: órdenes con tipo, prioridad y estado en palabras, sin columna de paciente', async () => {
    const { harness, http, acceso, maqueta, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/cleaning');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    maqueta.responderTodo(http, () => harness.detectChanges());
    const tabla = raiz().querySelector('[data-testid=queue-table]')!;
    expect(tabla.textContent).toMatch(/Pendiente|En curso|Terminada/);
    expect(tabla.textContent).not.toMatch(/Paciente/);
  });

  it('S9 con requestId y S7 cuando el sondeo falla con datos previos de la MISMA consulta', async () => {
    const { harness, http, acceso, maqueta, site, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/cleaning');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    colas(http)[0]!.flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-cola-1' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(raiz().textContent).toContain('req-cola-1');
    const cola = harness.routeDebugElement!.componentInstance as { refresh: () => void };
    cola.refresh();
    const real = maqueta.llamar('GET', `/sites/${site}/cleaning-orders`).body as CleaningOrderPage;
    colas(http)[0]!.flush(real);
    harness.detectChanges();
    expect(raiz().textContent).not.toContain('req-cola-1');
    cola.refresh();
    colas(http)[0]!.flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-cola-2' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(raiz().textContent).toContain('pueden estar atrasados');
  });

  it('H2: cambiar a «Mías» cancela el pedido en vuelo de «Todas»', async () => {
    const { harness, http, acceso, maqueta, site } = await montar();
    await harness.navigateByUrl(`/inpatient/cleaning?site=${site}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    const todas = colas(http)[0]!;
    await TestBed.inject(Router).navigate(['/inpatient/cleaning'], { queryParams: { site, scope: 'mine' } });
    harness.detectChanges();
    expect(todas.cancelled).toBe(true);
    const mias = colas(http).find((r) => !r.cancelled)!;
    expect(mias.request.params.get('assignedTo')).toBe('me');
    mias.flush({ items: [], nextCursor: null, generatedAt: new Date().toISOString() });
    harness.detectChanges();
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('No tiene limpiezas asignadas.');
  });

  it('inspección: aprobar y rechazar son acciones distintas; cerrar el diálogo (Esc) no rechaza', async () => {
    const { harness, http, acceso, maqueta, site } = await montar('supervisora-limpieza');
    await harness.navigateByUrl('/inpatient/cleaning');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    const real = maqueta.llamar('GET', `/sites/${site}/cleaning-orders`).body as CleaningOrderPage;
    const hecha: CleaningOrder = { ...real.items[0]!, statusCode: 'CLN_DONE', allowedTransitions: ['inspect'], inspectionRequired: true };
    colas(http)[0]!.flush({ ...real, items: [hecha] });
    harness.detectChanges();
    const cola = harness.routeDebugElement!.componentInstance as { actionsOf: (o: CleaningOrder) => { code: string }[]; act: (o: CleaningOrder, t: string) => Promise<void> };
    expect(cola.actionsOf(hecha).map((a) => a.code)).toEqual(['inspect-pass', 'inspect-fail']);
    // Esc / cancelar en «Aprobar»: no pasa nada (antes, eso rechazaba).
    confirm.mockResolvedValue(false);
    await cola.act(hecha, 'inspect-pass');
    expect(confirmWithReason).not.toHaveBeenCalled();
    http.expectNone(`/cleaning-orders/${hecha.id}/inspect`);
    // Rechazar pide el motivo y manda FAIL con If-Match.
    confirmWithReason.mockResolvedValue('Quedó polvo en la cabecera');
    await cola.act(hecha, 'inspect-fail');
    const req = http.expectOne(`/cleaning-orders/${hecha.id}/inspect`);
    expect(req.request.body).toEqual({ result: 'FAIL', reasonText: 'Quedó polvo en la cabecera' });
    expect(req.request.headers.get('If-Match')).toBe(String(hecha.rowVersion));
    req.flush({ ...hecha, statusCode: 'CLN_REJECTED' });
    colas(http).forEach((r) => r.flush(real));
  });
});
