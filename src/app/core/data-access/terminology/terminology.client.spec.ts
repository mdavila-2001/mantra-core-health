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
});
