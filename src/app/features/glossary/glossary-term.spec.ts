import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { GlossaryTerm } from './glossary-term';

/**
 * La ficha de un término.
 *
 * Se monta con el router porque el término viene en la ruta: sin él, el
 * `paramMap` no emite y la pantalla no sabría qué leer.
 */
const FICHA = {
  conceptId: '11111111-1111-4111-8111-111111111111',
  code: 'I10',
  display: 'Hipertensión esencial',
  definition: 'Presión arterial persistentemente alta sin una causa identificable detrás.',
  translated: true,
  codeSystemVersionId: 'csv-1',
  valueSets: [{ id: 'vs-1', internalCode: 'condition-code', name: 'Diagnóstico' }],
  synonyms: [{ value: 'Hypertensive disorder', language: 'EN', preferred: true }],
};

describe('GlossaryTerm', () => {
  let harness: RouterTestingHarness;
  let componente: GlossaryTerm;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'glossary/:conceptId', component: GlossaryTerm }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(`/glossary/${FICHA.conceptId}`, GlossaryTerm);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function peticion() {
    return http.expectOne((r) => r.url.includes('/terminology/concepts/'));
  }

  it('lee el término de la ruta, en castellano y de una sola llamada', () => {
    const req = peticion();

    expect(req.request.url).toContain(FICHA.conceptId);
    expect(req.request.params.get('lang')).toBe('ES');
    req.flush(FICHA);

    // Una sola: `$lookup` habría exigido resolver antes la versión y el sistema
    // de codificación, que el cliente no tiene.
    http.verify();
    expect(interno<() => { display: string } | null>('ficha')()?.display).toBe(
      'Hipertensión esencial',
    );
  });

  it('el encabezado dice el término, nunca su identificador', () => {
    expect(interno<() => string>('titulo')()).toBe('Término');

    peticion().flush(FICHA);

    expect(interno<() => string>('titulo')()).toBe('Hipertensión esencial');
  });

  it('trae las etiquetas del término y sus otras denominaciones', () => {
    peticion().flush(FICHA);

    const ficha =
      interno<
        () => {
          valueSets: readonly { name: string }[];
          synonyms: readonly { value: string }[];
        } | null
      >('ficha')();
    expect(ficha?.valueSets.map((e) => e.name)).toEqual(['Diagnóstico']);
    // El nombre original sirve para buscar el término en la literatura, así que
    // se muestra en vez de esconderse por estar en inglés.
    expect(ficha?.synonyms.map((s) => s.value)).toEqual(['Hypertensive disorder']);
  });

  it('un término sin traducción se muestra igual, y se nota que falta', () => {
    peticion().flush({ ...FICHA, display: 'Mild', translated: false, definition: undefined });

    const ficha = interno<() => { display: string; translated?: boolean } | null>('ficha')();
    expect(ficha?.display).toBe('Mild');
    expect(ficha?.translated).toBe(false);
  });

  it('un término inexistente se traduce a S6, no a una excepción', () => {
    peticion().flush(
      { code: 'NOT_FOUND', message: 'Concepto no encontrado' },
      { status: 404, statusText: 'Not Found' },
    );

    expect(interno<() => { status: string }>('termino')().status).toBe('not-found');
  });

  it('un fallo de red se traduce a S8', () => {
    peticion().error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(interno<() => { status: string }>('termino')().status).toBe('offline');
  });
});
