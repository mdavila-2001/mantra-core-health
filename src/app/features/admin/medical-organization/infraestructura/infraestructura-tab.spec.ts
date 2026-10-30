import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { idDeEspacio, SITIOS_INFRA } from '../../../../core/mock/fixtures/infraestructura';
import { MaquetaDeInfraestructura } from '../../../../../testing/maqueta-de-infraestructura';
import { InfraestructuraTab, type SitioElegible } from './infraestructura-tab';

const SAN_LUCAS = SITIOS_INFRA[0]!;
const SITIOS: readonly SitioElegible[] = [SAN_LUCAS, SITIOS_INFRA[1]!];

@Component({
  imports: [InfraestructuraTab],
  template: `<app-infraestructura-tab [sitios]="sitios()" [puedeEscribir]="escribe()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Anfitrion {
  readonly sitios = signal<readonly SitioElegible[]>(SITIOS);
  readonly escribe = signal(true);
}

describe('InfraestructuraTab', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  const maqueta = new MaquetaDeInfraestructura();

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/medical-organization', component: Anfitrion }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  async function abrir(query = ''): Promise<Anfitrion> {
    const anfitrion = await harness.navigateByUrl(`/administration/medical-organization${query}`, Anfitrion);
    harness.detectChanges();
    return anfitrion;
  }

  function texto(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  function filas(): string[] {
    return Array.from((harness.routeNativeElement as HTMLElement).querySelectorAll('[role=treeitem] > .tree__fila .tree__rotulo')).map(
      (e) => e.textContent?.trim() ?? '',
    );
  }

  it('pinta el árbol del establecimiento y cuenta camas, no las lee', async () => {
    await abrir();
    maqueta.responderTodo(http, () => harness.detectChanges());
    // La raíz se abre sola: Edificio A y sus hijos inmediatos, nada más hondo.
    expect(filas()).toEqual(['Edificio A', 'Planta baja', 'Pabellón Norte']);
    expect(texto().replace(/\s+/g, ' ')).toMatch(/\d+ espacios · 6 camas y puestos activos/);
  });

  it('abre el camino hasta el espacio de la URL y lo muestra en el panel', async () => {
    const cama = idDeEspacio(SAN_LUCAS, '301-A');
    await abrir(`?space=${cama}`);
    maqueta.responderTodo(http, () => harness.detectChanges());
    expect(filas()).toContain('Cama 301-A');
    const panel = (harness.routeNativeElement as HTMLElement).querySelector('[data-testid=infra-panel]')!;
    expect(panel.textContent).toContain('Cama 301-A');
    expect(panel.textContent).toContain('Cama de internación');
    expect(panel.querySelector('a[data-testid=infra-abrir-ficha]')?.getAttribute('href')).toContain(`/spaces/${cama}`);
  });

  it('refleja permisos: sin escritura no ofrece altas y lo dice', async () => {
    const anfitrion = await abrir();
    anfitrion.escribe.set(false);
    maqueta.responderTodo(http, () => harness.detectChanges());
    harness.detectChanges();
    const raiz = harness.routeNativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid=infra-nuevo]')).toBeNull();
    expect(raiz.querySelector('[data-testid=infra-solo-lectura]')).not.toBeNull();
  });

  it('con escritura ofrece alta, alta masiva e importación con el establecimiento', async () => {
    await abrir();
    maqueta.responderTodo(http, () => harness.detectChanges());
    const nuevo = (harness.routeNativeElement as HTMLElement).querySelector('[data-testid=infra-nuevo]')!;
    expect(nuevo.getAttribute('href')).toContain(`site=${SAN_LUCAS.id}`);
  });

  it('S6: un establecimiento que la API no devuelve no filtra existencia', async () => {
    await abrir();
    http.expectOne(`/sites/${SAN_LUCAS.id}/structure`).flush({ code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    http.match(() => true).forEach((r) => maqueta.responder(r));
    harness.detectChanges();
    expect(texto()).toContain('No encontramos lo que buscás');
  });

  it('S9: el error inesperado muestra el código de petición', async () => {
    await abrir();
    http
      .expectOne(`/sites/${SAN_LUCAS.id}/structure`)
      .flush({ code: 'INTERNAL', message: 'falló', correlationId: 'req-abc-123' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(texto()).toContain('req-abc-123');
  });

  it('S3: un establecimiento vacío ofrece registrar el primer espacio, con ruta', async () => {
    await abrir();
    http.match((r) => r.url.endsWith('/structure')).forEach((r) =>
      r.flush({ site: { id: SAN_LUCAS.id, name: 'x' }, spaces: [], units: [], assignments: [], asOf: new Date().toISOString() }),
    );
    harness.detectChanges();
    const enlace = Array.from((harness.routeNativeElement as HTMLElement).querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Registrar el primer espacio'),
    );
    expect(enlace?.getAttribute('href')).toContain('/spaces/new');
  });

  it('S7: una estructura vieja se muestra con su antigüedad', async () => {
    await abrir();
    maqueta.responderTodo(http, () => harness.detectChanges(), 1);
    http.match(() => true).forEach((r) => r.flush({}));
    harness.detectChanges();
    // Se fuerza una respuesta con `asOf` de hace una hora.
    await abrir('?site=' + SITIOS[1]!.id);
    const viejo = new Date(Date.now() - 60 * 60_000).toISOString();
    http.match((r) => r.url.endsWith('/structure')).forEach((r) =>
      r.flush({ site: { id: SITIOS[1]!.id, name: 'Norte' }, spaces: [{ id: 'a', parentId: null, code: 'A', name: 'A', form: { code: 'LOC_FORM_ROOM', display: 'Local' }, function: { code: 'SPACE_FN_GENERIC', display: 'G' }, status: { code: 'SPACE_ACTIVE', display: 'Activo' }, operationalStatus: null, clinicalUnitId: null, capacity: null, rowVersion: 1, childCount: 0 }], units: [], assignments: [], asOf: viejo }),
    );
    harness.detectChanges();
    expect(texto()).toContain('pueden estar atrasados');
  });

  it('el árbol organizativo muestra los espacios de la unidad', async () => {
    await abrir('?view=units');
    maqueta.responderTodo(http, () => harness.detectChanges());
    const datos = Array.from((harness.routeNativeElement as HTMLElement).querySelectorAll('[role=treeitem]'));
    expect(datos.some((d) => d.textContent?.includes('Dirección médica'))).toBe(true);
    expect(datos.some((d) => d.textContent?.includes('Bloque quirúrgico'))).toBe(true);
  });
});
