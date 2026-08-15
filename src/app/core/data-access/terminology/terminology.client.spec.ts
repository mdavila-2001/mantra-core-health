import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TerminologyClient } from './terminology.client';
import type { ValueSetExpansionPage, ValueSetOption } from './terminology.types';

/**
 * Ruta del `$expand` de lectura. El `$` va literal: Express enruta sobre el path
 * sin decodificar, así que `%24expand` vuelve 404 contra la API real.
 */
const EXPAND_URL = '/terminology/value-sets/vs-1/$expand';

/** Una opción cualquiera, con lo mínimo que el tipo exige. */
function option(code: string): ValueSetOption {
  return {
    conceptId: `c-${code}`,
    code,
    display: code.toLowerCase(),
    codeSystemVersionId: 'csv-1',
  };
}

/** Una página con los códigos dados y el cursor indicado. */
function page(codes: string[], nextCursor: string | null): ValueSetExpansionPage {
  return {
    valueSetId: 'vs-1',
    valueSetVersionId: 'vsv-1',
    version: '1.0.0',
    items: codes.map(option),
    count: codes.length,
    limit: 200,
    nextCursor,
  };
}

describe('TerminologyClient', () => {
  let client: TerminologyClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(TerminologyClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('sin parámetros no manda ninguna clave: el backend rechaza las de más', () => {
    client.readExpansion('vs-1').subscribe();

    const req = http.expectOne((r) => r.url === EXPAND_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush(page([], null));
  });

  it('propaga versión, cursor y tope como parámetros de consulta', () => {
    client
      .readExpansion('vs-1', { valueSetVersionId: 'vsv-2', cursor: 'abc', limit: 10 })
      .subscribe();

    const req = http.expectOne((r) => r.url === EXPAND_URL);
    expect(req.request.params.get('valueSetVersionId')).toBe('vsv-2');
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('limit')).toBe('10');

    req.flush(page([], null));
  });

  it('devuelve la página tal como llega, sin reinterpretar el cursor', () => {
    let recibida: ValueSetExpansionPage | undefined;
    client.readExpansion('vs-1').subscribe((p) => (recibida = p));

    const cuerpo = page(['A', 'B'], 'cursor-opaco');
    http.expectOne((r) => r.url === EXPAND_URL).flush(cuerpo);

    expect(recibida).toEqual(cuerpo);
    expect(recibida?.nextCursor).toBe('cursor-opaco');
  });

  it('readAllOptions encadena las páginas siguiendo el cursor', () => {
    let todas: readonly ValueSetOption[] | undefined;
    client.readAllOptions('vs-1').subscribe((o) => (todas = o));

    const primera = http.expectOne((r) => r.url === EXPAND_URL);
    expect(primera.request.params.get('cursor')).toBeNull();
    primera.flush(page(['A', 'B'], 'c1'));

    const segunda = http.expectOne((r) => r.url === EXPAND_URL);
    expect(segunda.request.params.get('cursor')).toBe('c1');
    segunda.flush(page(['C'], null));

    expect(todas?.map((o) => o.code)).toEqual(['A', 'B', 'C']);
  });

  it('readAllOptions con una sola página no pide una segunda', () => {
    let todas: readonly ValueSetOption[] | undefined;
    client.readAllOptions('vs-1').subscribe((o) => (todas = o));

    http.expectOne((r) => r.url === EXPAND_URL).flush(page(['A'], null));

    // `http.verify()` en el afterEach falla si quedó alguna petición pendiente.
    expect(todas?.map((o) => o.code)).toEqual(['A']);
  });

  it('readAllOptions arrastra la versión pedida a todas las páginas', () => {
    client.readAllOptions('vs-1', 'vsv-9').subscribe();

    const primera = http.expectOne((r) => r.url === EXPAND_URL);
    expect(primera.request.params.get('valueSetVersionId')).toBe('vsv-9');
    primera.flush(page(['A'], 'c1'));

    const segunda = http.expectOne((r) => r.url === EXPAND_URL);
    expect(segunda.request.params.get('valueSetVersionId')).toBe('vsv-9');
    segunda.flush(page(['B'], null));
  });

  it('una expansión vacía es una lista vacía, no un error', () => {
    let todas: readonly ValueSetOption[] | undefined;
    client.readAllOptions('vs-1').subscribe((o) => (todas = o));

    http.expectOne((r) => r.url === EXPAND_URL).flush(page([], null));

    expect(todas).toEqual([]);
  });

  it('codifica el id en la ruta: no se cuela en el path', () => {
    client.readExpansion('vs/../otro').subscribe();

    const req = http.expectOne((r) => r.url.includes('vs%2F..%2Fotro'));
    req.flush(page([], null));
  });

  it('el $ de la operación va literal, no como %24', () => {
    client.readExpansion('vs-1').subscribe();

    // `%24expand` no casa con la ruta `:id/$expand` de Express y da 404.
    const req = http.expectOne((r) => r.url.endsWith('/$expand'));
    expect(req.request.url).not.toContain('%24');
    req.flush(page([], null));
  });

  /* ---- resolución de ids a etiqueta -------------------------------------- */

  it('readConceptLabels sin ids no llama a la API', () => {
    let resuelto = false;
    client.readConceptLabels([]).subscribe((mapa) => {
      resuelto = mapa.size === 0;
    });

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(resuelto).toBe(true);
  });

  it('readConceptLabels manda los ids separados por coma y sin repetir', () => {
    client.readConceptLabels(['c-A', 'c-B', 'c-A']).subscribe();

    const req = http.expectOne((r) => r.url === '/terminology/concepts');
    expect(req.request.params.get('ids')).toBe('c-A,c-B');

    req.flush({ items: [], count: 0, limit: 50 });
  });

  it('readConceptLabels devuelve un mapa indexado por conceptId', () => {
    let etiquetas: ReadonlyMap<string, ValueSetOption> = new Map();
    client.readConceptLabels(['c-A']).subscribe((mapa) => (etiquetas = mapa));

    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [option('A')],
        count: 1,
        limit: 50,
      });

    expect(etiquetas.get('c-A')?.display).toBe('a');
  });

  it('readConceptLabels omite los ids que el catálogo no conoce', () => {
    let etiquetas: ReadonlyMap<string, ValueSetOption> = new Map();
    client.readConceptLabels(['c-A', 'c-INEXISTENTE']).subscribe((mapa) => (etiquetas = mapa));

    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [option('A')],
        count: 1,
        limit: 50,
      });

    // La ausencia la resuelve quien muestra, que es el único que sabe qué
    // poner en su lugar. Acá simplemente no está.
    expect(etiquetas.has('c-INEXISTENTE')).toBe(false);
    expect(etiquetas.size).toBe(1);
  });
  /* --- El glosario: etiquetas, términos en castellano y la ficha ---------
     Los cuatro métodos de arriba no se tocaron; estas pruebas cubren las tres
     lecturas nuevas y, sobre todo, que las de siempre sigan yendo como iban. */

  it('listValueSets pide las etiquetas y acepta el tope', () => {
    client.listValueSets({ limit: 200 }).subscribe();

    const req = http.expectOne((r) => r.url === '/terminology/value-sets');
    expect(req.request.params.get('limit')).toBe('200');

    req.flush({ items: [], count: 0, limit: 200, nextCursor: null });
  });

  it('listValueSets no manda los opcionales que nadie pidió', () => {
    client.listValueSets().subscribe();

    // El backend valida con `forbidNonWhitelisted`: una clave declarada en
    // `undefined` volvería 400.
    const req = http.expectOne((r) => r.url === '/terminology/value-sets');
    expect(req.request.params.keys()).toEqual([]);

    req.flush({ items: [], count: 0, limit: 50, nextCursor: null });
  });

  it('searchGlossary pide siempre castellano y etiquetas', () => {
    client.searchGlossary().subscribe();

    const req = http.expectOne((r) => r.url === '/terminology/concepts');
    expect(req.request.params.get('lang')).toBe('ES');
    expect(req.request.params.get('includeValueSets')).toBe('true');
    expect(req.request.params.has('q')).toBe(false);

    req.flush({ items: [], count: 0, limit: 50 });
  });

  it('searchGlossary combina el texto con la categoría', () => {
    client.searchGlossary({ query: 'hiper', valueSetId: 'vs-1', limit: 200 }).subscribe();

    const req = http.expectOne((r) => r.url === '/terminology/concepts');
    expect(req.request.params.get('q')).toBe('hiper');
    expect(req.request.params.get('valueSetId')).toBe('vs-1');

    req.flush({ items: [], count: 0, limit: 200 });
  });

  it('searchConcepts sigue sin pedir idioma ni etiquetas', () => {
    // La garantía de retrocompatibilidad, del lado del cliente: el catálogo de
    // administración y `readConceptLabels` comparten esta URL, y ninguno debe
    // empezar a recibir textos traducidos porque el glosario los necesite.
    client.searchConcepts({ query: 'gender' }).subscribe();

    const req = http.expectOne((r) => r.url === '/terminology/concepts');
    expect(req.request.params.has('lang')).toBe(false);
    expect(req.request.params.has('includeValueSets')).toBe(false);

    req.flush({ items: [], count: 0, limit: 50 });
  });

  it('readGlossaryTerm pide la ficha por su id, en castellano', () => {
    client.readGlossaryTerm('c-A').subscribe();

    const req = http.expectOne((r) => r.url === '/terminology/concepts/c-A');
    expect(req.request.params.get('lang')).toBe('ES');

    req.flush({
      conceptId: 'c-A',
      code: 'I10',
      display: 'Hipertension esencial',
      codeSystemVersionId: 'csv-1',
      valueSets: [],
      synonyms: [],
    });
  });
});
