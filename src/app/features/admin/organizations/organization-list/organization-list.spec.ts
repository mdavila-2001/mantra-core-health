import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { OrganizationList } from './organization-list';

/**
 * V04-01·L contra `GET /admin/tenants`. Estas pruebas fijan lo propio de la
 * pantalla: el filtro en la URL, el cursor con memoria, y que las etiquetas de
 * terminología degradan sin tumbar la tabla.
 *
 * Se monta con `RouterTestingHarness` porque el filtro vive en la URL: sin un
 * router de verdad, `buscar()` navegaría al vacío.
 */
const RUTA = '/administration/organizations';

const FILA = {
  id: 't-1',
  code: 'FARMACIA-SUR',
  legalName: 'Farmacia del Sur S.R.L.',
  tradeName: 'Farmacia del Sur',
  tenantTypeConceptId: 'c-tipo',
  statusConceptId: 'c-estado',
  verificationStatusConceptId: 'c-verificacion',
  parentTenantId: null,
  createdAt: '2026-08-09T12:00:00.000Z',
};

const ETIQUETAS = {
  items: [
    {
      conceptId: 'c-tipo',
      code: 'PHARMACY',
      display: 'Farmacia',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'c-estado',
      code: 'DIR_TENANT_PENDING',
      display: 'Pendiente de verificación',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'c-verificacion',
      code: 'DIR_TENANT_UNVERIFIED',
      display: 'Sin verificar',
      codeSystemVersionId: 'csv-1',
    },
  ],
  count: 3,
  limit: 50,
};

function pagina(items: unknown[], nextCursor: string | null) {
  return { items, count: items.length, limit: 25, nextCursor };
}

describe('OrganizationList', () => {
  let harness: RouterTestingHarness;
  let componente: OrganizationList;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/organizations', component: OrganizationList }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, OrganizationList);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function peticion() {
    return http.expectOne((r) => r.url === '/admin/tenants');
  }

  /** Con filas, la pantalla resuelve las etiquetas en una segunda lectura. */
  function responder(items: unknown[], nextCursor: string | null = null) {
    peticion().flush(pagina(items, nextCursor));
    if (items.length > 0) {
      http.expectOne((r) => r.url === '/terminology/concepts').flush(ETIQUETAS);
    }
    harness.detectChanges();
  }

  function estado() {
    return interno<() => { status: string }>('listado')();
  }

  it('pide la primera página al entrar, con el tope de la pantalla', () => {
    const req = peticion();

    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush(pagina([], null));
  });

  it('con filas queda en `ready` y resuelve las etiquetas en una sola lectura', () => {
    peticion().flush(pagina([FILA], null));

    const lectura = http.expectOne((r) => r.url === '/terminology/concepts');
    // Los tres conceptos de la fila, juntos: una lectura por página, no por fila.
    expect(lectura.request.params.get('ids')).toBe('c-tipo,c-estado,c-verificacion');
    lectura.flush(ETIQUETAS);
    harness.detectChanges();

    expect(estado().status).toBe('ready');
    expect(harness.routeNativeElement?.textContent).toContain('Farmacia del Sur S.R.L.');
    expect(harness.routeNativeElement?.textContent).toContain('Pendiente de verificación');
  });

  /**
   * El catálogo caído degrada tres columnas a «—»; no puede tumbar la tabla
   * que muestra las organizaciones reales.
   */
  it('un fallo del catálogo de etiquetas no tumba la tabla', () => {
    peticion().flush(pagina([FILA], null));
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 0 });
    harness.detectChanges();

    expect(estado().status).toBe('ready');
    expect(harness.routeNativeElement?.textContent).toContain('Farmacia del Sur S.R.L.');
  });

  it('sin organizaciones y sin filtro, el vacío ofrece registrar la primera', () => {
    responder([]);

    const vacio = estado() as { status: string; nextAction: { route?: string } };
    expect(vacio.status).toBe('empty');
    expect(vacio.nextAction.route).toBe('/administration/organizations/new');
  });

  it('sin resultados pero con filtro, el vacío ofrece volver a la lista completa', async () => {
    responder([]);

    await harness.navigateByUrl(`${RUTA}?q=andina`);
    responder([]);

    const vacio = estado() as { status: string; nextAction: { route?: string }; message?: string };
    expect(vacio.status).toBe('empty');
    expect(vacio.nextAction.route).toBe('/administration/organizations');
    expect(vacio.message).toContain('andina');
  });

  it('buscar publica el texto en la URL y vuelve a pedir la primera página', async () => {
    responder([]);

    interno<(t: string) => void>('buscar')('farmacia');
    await harness.fixture.whenStable();
    harness.detectChanges();

    const req = peticion();
    expect(req.request.params.get('q')).toBe('farmacia');
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush(pagina([], null));
  });

  it('avanzar manda el cursor que devolvió la página anterior', () => {
    responder([], 'cur-2');

    interno<(c: string) => void>('mover')('cur-2');

    const req = peticion();
    expect(req.request.params.get('cursor')).toBe('cur-2');

    req.flush(pagina([], null));
  });

  it('volver reusa el cursor visitado, no uno inventado', () => {
    responder([], 'cur-2');
    interno<(c: string) => void>('mover')('cur-2');
    responder([], 'cur-3');

    expect(interno<() => { prevCursor: string | null }>('cursor')().prevCursor).toBe('anterior');

    interno<(c: string) => void>('mover')('anterior');

    const req = peticion();
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush(pagina([], 'cur-2'));
  });

  it('un fallo de red se traduce a S8, no a una tabla vacía', () => {
    peticion().error(new ProgressEvent('error'), { status: 0 });
    harness.detectChanges();

    expect(estado().status).toBe('offline');
  });
});
