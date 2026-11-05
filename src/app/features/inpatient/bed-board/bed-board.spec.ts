import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { BedBoard as BoardData } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { forbidden } from '../../../core/view-state/view-state';
import { buscarUsuario } from '../../../core/mock/mock-session';
import { accesoDePrueba, MaquetaDeInternacion, verificarHttp } from '../../../../testing/maqueta-de-internacion';
import { InpatientAccessStore } from '../inpatient-access.store';
import { BedBoard } from './bed-board';

/**
 * El tablero (F2.4) contra el simulador de F2/F3: estados M34, la carrera de
 * filtros (H2: cancelación y `lastGood` atado a la consulta), el aviso de S7
 * sólo al entrar o salir (M1) y que Limpieza no vea pacientes.
 */
describe('BedBoard', () => {
  async function montar(usuario = 'enfermeria') {
    const maqueta = new MaquetaDeInternacion(buscarUsuario(usuario)!);
    const acceso = accesoDePrueba();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'inpatient/bed-board', component: BedBoard }]),
        { provide: InpatientAccessStore, useValue: acceso },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const http = TestBed.inject(HttpTestingController);
    const site = maqueta.acceso().sites[0];
    return { maqueta, acceso, harness, http, site, raiz: () => harness.routeNativeElement as HTMLElement };
  }

  const tableros = (http: HttpTestingController): TestRequest[] => http.match((r) => r.url.endsWith('/bed-board'));
  const estructura = (http: HttpTestingController) => http.match((r) => r.url.endsWith('/structure')).forEach((r) => r.flush({ spaces: [] }));

  afterEach(() => verificarHttp());

  it('S1: sin saber qué puede la persona, «Verificando permisos» y ningún pedido del tablero', async () => {
    const { harness, http, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/bed-board');
    expect(raiz().textContent).toContain('Verificando permisos');
    expect(tableros(http)).toHaveLength(0);
  });

  it('S5: sin rol operativo en ninguna sede, lo dice y no pide nada', async () => {
    const { harness, http, acceso, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/bed-board');
    acceso.listo({ userId: 'x', tenantId: 't', sites: [] });
    harness.detectChanges();
    expect(raiz().textContent).toContain('no tiene un rol operativo');
    expect(tableros(http)).toHaveLength(0);
    acceso.state.set(forbidden({ message: 'Sin acceso' }));
    harness.detectChanges();
    expect(raiz().textContent).toContain('Sin acceso');
  });

  it('S2 → listo: grilla con la letra v2 escrita y los recuentos de la API', async () => {
    const { harness, http, acceso, maqueta, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/bed-board');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    expect(raiz().querySelector('.view-state-host__loading')).not.toBeNull();
    estructura(http);
    maqueta.responderTodo(http, () => harness.detectChanges());
    expect(raiz().querySelector('[data-testid=bed-board]')).not.toBeNull();
    expect(raiz().querySelectorAll('[data-testid=board-grid] li').length).toBeGreaterThan(3);
    expect(raiz().querySelector('[data-testid=board-counts]')?.textContent).toContain('Asignables');
    expect(raiz().textContent).toMatch(/Ocupada|Libre|No disponible/);
  });

  it('S9: un error del tablero muestra el código de petición', async () => {
    const { harness, http, acceso, maqueta, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/bed-board');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    estructura(http);
    tableros(http)[0]!.flush({ code: 'INTERNAL', message: 'Se cayó', correlationId: 'req-tablero-9' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(raiz().textContent).toContain('Código de soporte');
    expect(raiz().textContent).toContain('req-tablero-9');
  });

  it('S3 con próxima acción cuando ningún filtro coincide', async () => {
    const { harness, http, acceso, maqueta, site, raiz } = await montar();
    await harness.navigateByUrl(`/inpatient/bed-board?site=${site!.siteId}&v2=K`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    estructura(http);
    const real = maqueta.llamar('GET', `/sites/${site!.siteId}/bed-board`).body as BoardData;
    tableros(http)[0]!.flush({ ...real, units: [] });
    harness.detectChanges();
    expect(raiz().textContent).toContain('Ninguna cama coincide con los filtros.');
    expect(raiz().textContent).toContain('Quitar los filtros');
  });

  it('S7: con el dato de hace más de 120 s avisa, y el lector de pantalla se entera una sola vez (M1)', async () => {
    const { harness, http, acceso, maqueta, site, raiz } = await montar();
    await harness.navigateByUrl('/inpatient/bed-board');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    estructura(http);
    const real = maqueta.llamar('GET', `/sites/${site!.siteId}/bed-board`).body as BoardData;
    const anuncio = () => raiz().querySelector('[data-testid=board-stale-announcement]')!.textContent!.trim();
    expect(anuncio()).toBe('');
    tableros(http)[0]!.flush({ ...real, generatedAt: new Date(Date.now() - 5 * 60_000).toISOString() });
    harness.detectChanges();
    expect(raiz().textContent).toContain('pueden estar atrasados');
    expect(anuncio()).toBe('El tablero muestra datos atrasados.');
    // «Actualizado hace…» no es una región viva: no se anuncia en cada tic.
    expect(raiz().querySelector('[data-testid=board-freshness]')!.getAttribute('aria-live')).toBeNull();
    (raiz().querySelector('[data-testid=board-refresh]') as HTMLButtonElement).click();
    tableros(http)[0]!.flush(real);
    harness.detectChanges();
    expect(anuncio()).toBe('El tablero volvió a estar al día.');
  });

  it('H2: cambiar el filtro cancela el pedido en vuelo y el dato bueno de otra consulta no se muestra como atrasado', async () => {
    const { harness, http, acceso, maqueta, site, raiz } = await montar();
    await harness.navigateByUrl(`/inpatient/bed-board?site=${site!.siteId}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    estructura(http);
    const real = maqueta.llamar('GET', `/sites/${site!.siteId}/bed-board`).body as BoardData;
    tableros(http)[0]!.flush(real);
    harness.detectChanges();
    expect(raiz().querySelector('[data-testid=board-grid]')).not.toBeNull();

    // Filtro nuevo: el pedido sale; antes de que llegue, otro filtro.
    await TestBed.inject(Router).navigate(['/inpatient/bed-board'], { queryParams: { site: site!.siteId, v2: 'U' } });
    harness.detectChanges();
    const primero = tableros(http)[0]!;
    expect(primero.request.params.get('v2Codes')).toBe('U');
    await TestBed.inject(Router).navigate(['/inpatient/bed-board'], { queryParams: { site: site!.siteId, v2: 'O' } });
    harness.detectChanges();
    expect(primero.cancelled).toBe(true);
    const segundo = tableros(http).find((r) => !r.cancelled)!;
    expect(segundo.request.params.get('v2Codes')).toBe('O');
    // Falla la consulta nueva: NO se muestra el tablero sin filtro como «atrasado».
    segundo.flush({ code: 'INTERNAL', message: 'x', correlationId: 'req-otra-consulta' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(raiz().textContent).not.toContain('pueden estar atrasados');
    expect(raiz().textContent).toContain('req-otra-consulta');
    expect(raiz().querySelector('[data-testid=board-grid]')).toBeNull();
  });

  it('M8: cambiar de vista o de pestaña no vuelve a pedir el tablero', async () => {
    const { harness, http, acceso, maqueta, site } = await montar();
    await harness.navigateByUrl(`/inpatient/bed-board?site=${site!.siteId}`);
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    estructura(http);
    maqueta.responderTodo(http, () => harness.detectChanges());
    await TestBed.inject(Router).navigate(['/inpatient/bed-board'], { queryParams: { site: site!.siteId, view: 'list', unit: 'x' } });
    harness.detectChanges();
    expect(tableros(http)).toHaveLength(0);
  });

  it('Limpieza ve el tablero sin un solo dato de paciente, ni en pantalla ni en la respuesta', async () => {
    const { harness, http, acceso, maqueta, site, raiz } = await montar('limpieza');
    await harness.navigateByUrl('/inpatient/bed-board?view=list');
    acceso.listo(maqueta.acceso());
    harness.detectChanges();
    estructura(http);
    const req = tableros(http)[0]!;
    const cuerpo = maqueta.llamar('GET', `/sites/${site!.siteId}/bed-board`).body as BoardData;
    for (const c of cuerpo.units.flatMap((u) => u.cells)) {
      expect(c.occupancy.patient).toBeUndefined();
      expect(c.occupancy.encounterId ?? null).toBeNull();
      expect('encounterLocationId' in c.occupancy).toBe(false);
    }
    req.flush(cuerpo);
    harness.detectChanges();
    const enfermeria = new MaquetaDeInternacion(buscarUsuario('enfermeria')!);
    const iniciales = (enfermeria.llamar('GET', `/sites/${site!.siteId}/bed-board`).body as BoardData).units
      .flatMap((u) => u.cells)
      .map((c) => c.occupancy.patient?.initials)
      .filter((x): x is string => !!x);
    expect(iniciales.length).toBeGreaterThan(0);
    for (const i of iniciales) expect(raiz().textContent).not.toContain(`${i} ·`);
  });
});
