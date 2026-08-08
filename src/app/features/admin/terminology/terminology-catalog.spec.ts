import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { TerminologyCatalog } from './terminology-catalog';

/**
 * El catálogo es la sección que deja de ser un cartel: `GET /terminology/concepts`
 * (UC-03-13) existía desde siempre y el cliente implementaba **sólo la mitad**
 * —resolvía `?ids=` y nunca `?q=`—.
 *
 * Se monta con `RouterTestingHarness` y no con `TestBed.createComponent` porque
 * **el filtro vive en la URL**: sin un router de verdad, `buscar()` navegaría al
 * vacío y el efecto que recarga no se enteraría nunca.
 */
const RUTA = '/administracion/terminologia';

const CONCEPTO = {
  conceptId: '11111111-1111-4111-8111-111111111111',
  code: 'ACTIVE',
  display: 'Activa',
  codeSystemVersionId: 'csv-1',
};

describe('TerminologyCatalog', () => {
  let harness: RouterTestingHarness;
  let componente: TerminologyCatalog;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administracion/terminologia', component: TerminologyCatalog }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, TerminologyCatalog);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** La petición en vuelo, sea la del arranque o la de un cambio de filtro. */
  function peticion() {
    return http.expectOne((r) => r.url.endsWith('/terminology/concepts'));
  }

  function estado() {
    return interno<() => { status: string; message?: string }>('resultados')();
  }

  it('al entrar sin filtro pide el catálogo y NO manda `q` vacío', () => {
    const req = peticion();

    // El backend valida con `forbidNonWhitelisted`: un `q=''` declarado no es lo
    // mismo que ausente, y «sin filtro» no es «buscar la cadena vacía».
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.get('limit')).toBe('50');

    req.flush({ items: [CONCEPTO], count: 1, limit: 50 });
    expect(estado().status).toBe('ready');
  });

  it('buscar publica el texto en la URL y vuelve a pedir con `q`', async () => {
    peticion().flush({ items: [CONCEPTO], count: 1, limit: 50 });

    interno<(texto: string) => void>('buscar')('femenino');
    await harness.fixture.whenStable();

    const req = peticion();
    expect(req.request.params.get('q')).toBe('femenino');
    req.flush({ items: [], count: 0, limit: 50 });
  });

  /**
   * Los dos vacíos se viven distinto y por eso ofrecen salidas distintas:
   * mandar a «ver todo el catálogo» a alguien cuyo catálogo está vacío lo
   * llevaría a otra pantalla igual de vacía.
   */
  it('sin filtro, el vacío dice que el catálogo no tiene conceptos', () => {
    peticion().flush({ items: [], count: 0, limit: 50 });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('todavía no tiene conceptos');
  });

  it('con filtro, el vacío nombra el texto que no encontró', async () => {
    peticion().flush({ items: [CONCEPTO], count: 1, limit: 50 });

    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    peticion().flush({ items: [], count: 0, limit: 50 });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
  });

  /**
   * La API no publica cursor para esta búsqueda, así que cuando devuelve más de
   * los que entran en el tope, callarlo haría creer que el catálogo tiene
   * exactamente cincuenta conceptos.
   */
  it('avisa cuando el resultado vino recortado por el tope', () => {
    peticion().flush({ items: [CONCEPTO], count: 320, limit: 50 });

    expect(interno<() => boolean>('recortado')()).toBe(true);
    expect(interno<() => number | null>('totalDeclarado')()).toBe(320);
  });

  it('no avisa de recorte cuando entraron todos', () => {
    peticion().flush({ items: [CONCEPTO], count: 1, limit: 50 });

    expect(interno<() => boolean>('recortado')()).toBe(false);
  });

  it('un fallo de red se traduce a S8, no a una excepción', () => {
    peticion().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estado().status).toBe('offline');
  });
});
