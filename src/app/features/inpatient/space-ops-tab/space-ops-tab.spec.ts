import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { BedBoard } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { SpaceOpsTab } from './space-ops-tab';

/** La pestaña «Operación» de la ficha de F1: bloqueos con el motivo en palabras, cambio de espacio cancelado, S3 y S9. */
describe('SpaceOpsTab', () => {
  function montar() {
    const maqueta = new MaquetaDeInternacion(buscarUsuario('enfermeria')!);
    TestBed.configureTestingModule({ imports: [SpaceOpsTab], providers: [provideHttpClient(), provideHttpClientTesting(), { provide: DialogService, useValue: {} }] });
    const fixture = TestBed.createComponent(SpaceOpsTab);
    const site = maqueta.acceso().sites[0]!.siteId;
    const celdas = (maqueta.llamar('GET', `/sites/${site}/bed-board`).body as BedBoard).units.flatMap((u) => u.cells);
    return { maqueta, fixture, celdas, http: TestBed.inject(HttpTestingController), raiz: fixture.nativeElement as HTMLElement };
  }
  const bloqueos = (http: HttpTestingController) => http.match((r) => r.url.endsWith('/blocks'));

  afterEach(() => verificarHttp());

  it('lista los bloqueos con tipo y motivo en palabras', () => {
    const { maqueta, fixture, celdas, http, raiz } = montar();
    const mant = celdas.find((c) => c.availability.code === 'SPACE_OP_MAINTENANCE')!;
    fixture.componentRef.setInput('careSpaceId', mant.id);
    fixture.detectChanges();
    maqueta.responderTodo(http, () => fixture.detectChanges());
    expect(raiz.querySelector('[data-testid=space-ops-blocks]')?.textContent).toContain('Mantenimiento');
  });

  it('cambiar de espacio cancela el pedido anterior; S3 sin bloqueos; S9 con requestId', () => {
    const { fixture, celdas, http, raiz } = montar();
    fixture.componentRef.setInput('careSpaceId', celdas[0]!.id);
    fixture.detectChanges();
    const primero = bloqueos(http)[0]!;
    fixture.componentRef.setInput('careSpaceId', celdas[1]!.id);
    fixture.detectChanges();
    expect(primero.cancelled).toBe(true);
    bloqueos(http).find((r) => !r.cancelled)!.flush([]);
    http.match(() => true).forEach((r) => r.cancelled || r.flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-panel' }, { status: 500, statusText: 'Error' }));
    fixture.detectChanges();
    expect(raiz.querySelector('[data-testid=space-ops-blocks]')?.textContent).toContain('Este espacio nunca estuvo bloqueado.');
    (fixture.componentInstance as unknown as { loadBlocks: () => void }).loadBlocks();
    fixture.detectChanges();
    bloqueos(http)[0]!.flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-bloqueos-2' }, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(raiz.textContent).toContain('req-bloqueos-2');
  });
});
