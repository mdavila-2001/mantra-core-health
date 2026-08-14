import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ServicesCatalog } from './services-catalog';

const RUTA = '/administration/services-catalog';

const PRACTICAS = { items: [{ id: 'pr1', code: 'P1', name: 'Práctica 1' }], count: 1 };

const SERVICIO = {
  id: 's1',
  practiceId: 'pr1',
  code: 'CONS-01',
  name: 'Consulta general',
  defaultPrice: '100.00',
  isActive: true,
};

function pagina(items: unknown[], nextCursor: string | null = null) {
  return { items, count: items.length, limit: 25, nextCursor };
}

describe('ServicesCatalog', () => {
  let harness: RouterTestingHarness;
  let componente: ServicesCatalog;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/services-catalog', component: ServicesCatalog }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, ServicesCatalog);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function llenarFormularioDeAlta(): void {
    interno<{ setValue: (v: unknown) => void }>('formAlta').setValue({
      code: 'CONS-01',
      name: 'Consulta general',
      defaultPrice: '100.00',
    });
  }

  /** La práctica siempre se pide primero; sin ella el catálogo no tiene qué pedir. */
  function responderPracticas() {
    http.expectOne((r) => r.url === '/practices').flush(PRACTICAS);
    harness.detectChanges();
  }

  function peticionCatalogo() {
    return http.expectOne((r) => r.url === '/billing/service-catalog');
  }

  function estado() {
    return interno<() => { status: string }>('resultados')();
  }

  it('pide primero las prácticas y recién después el catálogo, con el practiceId elegido', () => {
    responderPracticas();

    const req = peticionCatalogo();
    expect(req.request.params.get('practiceId')).toBe('pr1');
    expect(req.request.params.get('limit')).toBe('25');

    req.flush(pagina([]));
  });

  it('sin práctica elegida, el catálogo queda vacío sin pedir nada', () => {
    http.expectOne((r) => r.url === '/practices').flush({ items: [], count: 0 });
    harness.detectChanges();

    expect(estado().status).toBe('empty');
    http.verify();
  });

  it('con filas, el listado queda en `ready`', () => {
    responderPracticas();
    peticionCatalogo().flush(pagina([SERVICIO]));
    harness.detectChanges();

    expect(estado().status).toBe('ready');
    expect(harness.routeNativeElement?.textContent).toContain('Consulta general');
  });

  it('sin servicios y sin filtro, ofrece dar de alta el primero', () => {
    responderPracticas();
    peticionCatalogo().flush(pagina([]));
    harness.detectChanges();

    const vacio = estado() as { status: string; nextAction: { label: string } };
    expect(vacio.status).toBe('empty');
    expect(vacio.nextAction.label).toBe('Dar de alta un servicio');
  });

  it('buscar publica el texto en la URL y vuelve a pedir la primera página', async () => {
    responderPracticas();
    peticionCatalogo().flush(pagina([]));

    interno<(t: string) => void>('buscar')('consulta');
    await harness.fixture.whenStable();
    harness.detectChanges();

    const req = peticionCatalogo();
    expect(req.request.params.get('q')).toBe('consulta');
    req.flush(pagina([]));
  });

  it('avanzar manda el cursor que devolvió la página anterior', () => {
    responderPracticas();
    peticionCatalogo().flush(pagina([], 'cur-2'));

    interno<(c: string) => void>('mover')('cur-2');

    const req = peticionCatalogo();
    expect(req.request.params.get('cursor')).toBe('cur-2');
    req.flush(pagina([]));
  });

  it('crea un servicio y recarga el listado', () => {
    responderPracticas();
    peticionCatalogo().flush(pagina([]));

    interno<() => void>('abrirAlta')();
    llenarFormularioDeAlta();
    interno<() => void>('enviarAlta')();

    const req = http.expectOne((r) => r.url === '/billing/service-catalog' && r.method === 'POST');
    expect(req.request.body).toEqual({
      practiceId: 'pr1',
      code: 'CONS-01',
      name: 'Consulta general',
      defaultPrice: '100.00',
    });
    req.flush(SERVICIO);
    harness.detectChanges();

    expect(interno<() => boolean>('mostrarAlta')()).toBe(false);

    // Recarga el listado en la práctica y filtro vigentes.
    peticionCatalogo().flush(pagina([SERVICIO]));
  });

  it('un rechazo del backend (no admin) se muestra como error de envío', () => {
    responderPracticas();
    peticionCatalogo().flush(pagina([]));

    interno<() => void>('abrirAlta')();
    llenarFormularioDeAlta();
    interno<() => void>('enviarAlta')();

    http
      .expectOne((r) => r.url === '/billing/service-catalog' && r.method === 'POST')
      .flush(
        { code: 'FORBIDDEN', message: 'No autorizado' },
        { status: 403, statusText: 'Forbidden' },
      );
    harness.detectChanges();

    expect(interno<() => { status: string }>('estadoAlta')().status).toBe('forbidden');
  });
});
