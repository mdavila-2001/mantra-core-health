import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Glossary } from './glossary';

/**
 * El glosario reusa `GET /terminology/concepts` (UC-03-13), igual que el
 * catálogo de administración, pero es una pantalla propia y separada — no
 * expone `conceptId`, y `navigation.map.ts` la deja sin roles.
 *
 * Se monta con `RouterTestingHarness` y no con `TestBed.createComponent`
 * porque el filtro vive en la URL: sin un router de verdad, `buscar()`
 * navegaría al vacío y el efecto que recarga no se enteraría nunca.
 */
const RUTA = '/glossary';

const TERMINO = {
  conceptId: '11111111-1111-4111-8111-111111111111',
  code: 'HYPERTENSION',
  display: 'Hipertensión',
  definition: 'Presión arterial persistentemente alta.',
  codeSystemVersionId: 'csv-1',
};

describe('Glossary', () => {
  let harness: RouterTestingHarness;
  let componente: Glossary;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'glossary', component: Glossary }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, Glossary);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function peticion() {
    return http.expectOne((r) => r.url.endsWith('/terminology/concepts'));
  }

  function estado() {
    return interno<() => { status: string; message?: string }>('resultados')();
  }

  it('al entrar sin filtro pide el catálogo y NO manda `q` vacío', () => {
    const req = peticion();

    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.get('limit')).toBe('50');

    req.flush({ items: [TERMINO], count: 1, limit: 50 });
    expect(estado().status).toBe('ready');
  });

  it('buscar publica el texto en la URL y vuelve a pedir con `q`', async () => {
    peticion().flush({ items: [TERMINO], count: 1, limit: 50 });

    interno<(texto: string) => void>('buscar')('hipertensión');
    await harness.fixture.whenStable();

    const req = peticion();
    expect(req.request.params.get('q')).toBe('hipertensión');
    req.flush({ items: [], count: 0, limit: 50 });
  });

  it('sin filtro, el vacío dice que el glosario no tiene términos', () => {
    peticion().flush({ items: [], count: 0, limit: 50 });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('todavía no tiene términos');
  });

  it('con filtro, el vacío nombra el texto que no encontró', async () => {
    peticion().flush({ items: [TERMINO], count: 1, limit: 50 });

    interno<(texto: string) => void>('buscar')('inexistente');
    await harness.fixture.whenStable();
    peticion().flush({ items: [], count: 0, limit: 50 });

    const actual = estado() as { status: string; message?: string };
    expect(actual.status).toBe('empty');
    expect(actual.message).toContain('inexistente');
  });

  it('avisa cuando el resultado vino recortado por el tope', () => {
    peticion().flush({ items: [TERMINO], count: 320, limit: 50 });

    expect(interno<() => boolean>('recortado')()).toBe(true);
    expect(interno<() => number | null>('totalDeclarado')()).toBe(320);
  });

  it('no avisa de recorte cuando entraron todos', () => {
    peticion().flush({ items: [TERMINO], count: 1, limit: 50 });

    expect(interno<() => boolean>('recortado')()).toBe(false);
  });

  it('un fallo de red se traduce a S8, no a una excepción', () => {
    peticion().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estado().status).toBe('offline');
  });

  it('no muestra el conceptId crudo: es lenguaje llano, no configuración', () => {
    peticion().flush({ items: [TERMINO], count: 1, limit: 50 });

    const columnas = interno<() => readonly { key: string }[]>('columnas')();
    expect(columnas.some((c) => c.key === 'conceptId')).toBe(false);
  });
});
