import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  BoOccupationsCatalog,
  CODIGO_CATALOGO_OCUPACIONES,
  CODIGO_OCUPACION_OTRA,
} from './bo-occupations.service';
import type { ValueSetOption } from './terminology.types';

/** El catálogo de ocupaciones que consumen registro, perfil y alta desde citas. */
describe('BoOccupationsCatalog', () => {
  let http: HttpTestingController;
  let catalogo: BoOccupationsCatalog;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    catalogo = TestBed.inject(BoOccupationsCatalog);
  });

  afterEach(() => http.verify());

  /**
   * Si esta normalización desaparece, escribir «otro» vuelve a producir el
   * falso vacío de la captura porque la API histórica dice «Otra ocupación».
   */
  it('presenta la salida del catálogo como «Otro» en todos sus consumidores', () => {
    let recibidas: readonly ValueSetOption[] = [];
    catalogo.listar().subscribe((opciones) => (recibidas = opciones));

    http
      .expectOne(
        (r) =>
          r.url === '/terminology/value-sets' &&
          r.params.get('code') === CODIGO_CATALOGO_OCUPACIONES,
      )
      .flush({
        items: [
          {
            id: 'vs-ocupaciones',
            internalCode: CODIGO_CATALOGO_OCUPACIONES,
            name: 'Ocupaciones',
          },
        ],
        count: 1,
        limit: 50,
        nextCursor: null,
      });
    http.expectOne('/terminology/value-sets/vs-ocupaciones/$expand?limit=200').flush({
      valueSetId: 'vs-ocupaciones',
      items: [
        {
          conceptId: 'oc-otra',
          code: CODIGO_OCUPACION_OTRA,
          display: 'Otra ocupación',
          codeSystemVersionId: 'csv-1',
        },
      ],
      count: 1,
      limit: 200,
      nextCursor: null,
    });

    expect(recibidas).toEqual([
      {
        conceptId: 'oc-otra',
        code: CODIGO_OCUPACION_OTRA,
        display: 'Otro',
        codeSystemVersionId: 'csv-1',
      },
    ]);
  });
});
