import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  CODIGO_CATALOGO_DOMINIO_IDIOMA,
  CODIGO_CATALOGO_IDIOMAS,
  LanguagesCatalog,
} from './languages.service';
import type { ValueSetOption } from './terminology.types';

/**
 * Los catálogos de idiomas y de nivel de dominio.
 *
 * Lo que estas pruebas fijan, igual que en el de especialidades:
 *
 * 1. **Cada conjunto se resuelve por código, no por uuid.**
 * 2. **Un catálogo ausente falla, no devuelve una lista vacía.**
 * 3. **Cada conjunto se pide una vez**, y «olvidar» permite reintentar.
 */
describe('LanguagesCatalog', () => {
  let http: HttpTestingController;
  let catalogo: LanguagesCatalog;

  const IDIOMAS: ValueSetOption[] = [
    { conceptId: 'lang-es', code: 'LANG-ES', display: 'Español', codeSystemVersionId: 'csv-1' },
    { conceptId: 'lang-qu', code: 'LANG-QU', display: 'Quechua', codeSystemVersionId: 'csv-1' },
  ];

  const NIVELES: ValueSetOption[] = [
    { conceptId: 'prof-nativo', code: 'PROF-NATIVO', display: 'Nativo', codeSystemVersionId: 'csv-1' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    catalogo = TestBed.inject(LanguagesCatalog);
  });

  afterEach(() => http.verify());

  /** Responde el listado de conjuntos pedido por ese código. */
  function responderConjunto(codigo: string, items: readonly object[]): void {
    const pedido = http.expectOne(
      (r) => r.url === '/terminology/value-sets' && r.params.get('code') === codigo,
    );
    pedido.flush({ items, count: items.length, limit: 50, nextCursor: null });
  }

  function responderExpansion(id: string, opciones: readonly object[]): void {
    http
      .expectOne((r) => r.url.includes(`/terminology/value-sets/${id}/$expand`))
      .flush({ valueSetId: id, items: opciones, count: opciones.length, limit: 200, nextCursor: null });
  }

  const CONJUNTO_IDIOMAS = {
    id: 'vs-lang',
    internalCode: CODIGO_CATALOGO_IDIOMAS,
    name: 'Idiomas',
    defaultVersionId: 'v1',
  };

  const CONJUNTO_NIVELES = {
    id: 'vs-prof',
    internalCode: CODIGO_CATALOGO_DOMINIO_IDIOMA,
    name: 'Dominio del idioma',
    defaultVersionId: 'v1',
  };

  it('resuelve los idiomas por su código interno y devuelve sus opciones', () => {
    let recibidas: readonly ValueSetOption[] = [];
    catalogo.idiomas().subscribe((opciones) => (recibidas = opciones));

    responderConjunto(CODIGO_CATALOGO_IDIOMAS, [CONJUNTO_IDIOMAS]);
    responderExpansion('vs-lang', IDIOMAS);

    expect(recibidas.map((o) => o.display)).toEqual(['Español', 'Quechua']);
  });

  it('los niveles son otro conjunto, con su propio código', () => {
    let recibidas: readonly ValueSetOption[] = [];
    catalogo.niveles().subscribe((opciones) => (recibidas = opciones));

    responderConjunto(CODIGO_CATALOGO_DOMINIO_IDIOMA, [CONJUNTO_NIVELES]);
    responderExpansion('vs-prof', NIVELES);

    expect(recibidas.map((o) => o.display)).toEqual(['Nativo']);
  });

  it('si el catálogo no está sembrado falla, no devuelve una lista vacía', () => {
    let fallo: unknown = null;
    catalogo.idiomas().subscribe({ error: (e: unknown) => (fallo = e) });

    responderConjunto(CODIGO_CATALOGO_IDIOMAS, []);

    expect(fallo).toBeInstanceOf(Error);
    http.expectNone((r) => r.url.includes('$expand'));
  });

  it('descarta los conceptos que no son elegibles', () => {
    let recibidas: readonly ValueSetOption[] = [];
    catalogo.idiomas().subscribe((opciones) => (recibidas = opciones));

    responderConjunto(CODIGO_CATALOGO_IDIOMAS, [CONJUNTO_IDIOMAS]);
    responderExpansion('vs-lang', [...IDIOMAS, { ...IDIOMAS[0], conceptId: 'grupo', selectable: false }]);

    expect(recibidas).toHaveLength(2);
  });

  it('cada conjunto se pide una sola vez', () => {
    catalogo.idiomas().subscribe();
    catalogo.idiomas().subscribe();

    responderConjunto(CODIGO_CATALOGO_IDIOMAS, [CONJUNTO_IDIOMAS]);
    responderExpansion('vs-lang', IDIOMAS);

    // El `verify()` del cierre falla si quedó una segunda petición colgada.
    http.expectNone((r) => r.url === '/terminology/value-sets');
  });

  it('olvidar permite reintentar después de un fallo', () => {
    let fallo: unknown = null;
    catalogo.niveles().subscribe({ error: (e: unknown) => (fallo = e) });
    responderConjunto(CODIGO_CATALOGO_DOMINIO_IDIOMA, []);
    expect(fallo).toBeInstanceOf(Error);

    catalogo.olvidar();

    let recibidas: readonly ValueSetOption[] = [];
    catalogo.niveles().subscribe((opciones) => (recibidas = opciones));
    responderConjunto(CODIGO_CATALOGO_DOMINIO_IDIOMA, [CONJUNTO_NIVELES]);
    responderExpansion('vs-prof', NIVELES);

    expect(recibidas).toHaveLength(1);
  });
});
