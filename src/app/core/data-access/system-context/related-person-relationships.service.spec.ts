import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  CAMPO_PARENTESCO_PERSONA_RELACIONADA,
  RelatedPersonRelationshipsCatalog,
} from './related-person-relationships.service';
import type { DynamicEnumOption } from './system-context.types';

/**
 * El catálogo del parentesco del contacto de emergencia.
 *
 * Lo que estas pruebas fijan, y que un refactor rompería en silencio:
 *
 * 1. **Se pide por campo destino**, no por código de conjunto de valores. Es la
 *    diferencia con los `bo-*`, y confundirla devuelve un 404.
 * 2. **Bajo SSR no se pide nada.** El alta es una ruta pública y prerenderizada:
 *    una petición ahí queda colgada hasta tumbar el build entero.
 * 3. **Las etiquetas se traducen por código**, que es la identidad estable del
 *    concepto; el `display` del catálogo es metadato de presentación.
 */

const RUTA = `/system-context/dynamic-enums?target=${CAMPO_PARENTESCO_PERSONA_RELACIONADA}`;

const RESPUESTA = {
  code: 'related-person-relationship',
  name: 'Parentesco de la persona relacionada',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    {
      conceptId: 'c-madre',
      code: 'RELATIONSHIP_MOTHER',
      display: 'Mother relationship',
      ordinal: 1,
      isDefault: false,
    },
    {
      conceptId: 'c-amistad',
      code: 'RELATIONSHIP_FRIEND',
      display: 'Friend relationship',
      ordinal: 7,
      isDefault: false,
    },
  ],
};

describe('RelatedPersonRelationshipsCatalog', () => {
  /**
   * Monta el catálogo con la plataforma que se le indique.
   *
   * @param plataforma - `browser` o `server`, para ejercer la guarda de SSR.
   */
  function montar(plataforma: 'browser' | 'server' = 'browser'): {
    catalogo: RelatedPersonRelationshipsCatalog;
    http: HttpTestingController;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: plataforma },
      ],
    });

    return {
      catalogo: TestBed.inject(RelatedPersonRelationshipsCatalog),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('pide el catálogo por campo destino, no por código de conjunto', () => {
    const { catalogo, http } = montar();
    let opciones: readonly DynamicEnumOption[] = [];
    catalogo.listar().subscribe((o) => (opciones = o));

    http.expectOne(RUTA).flush(RESPUESTA);

    expect(opciones.map((o) => o.code)).toEqual([
      'RELATIONSHIP_MOTHER',
      'RELATIONSHIP_FRIEND',
    ]);
    http.verify();
  });

  /**
   * El alta es una ruta pública y prerenderizada: durante el prerender no hay
   * API a la que preguntar, y la petición quedaría colgada. La lista vacía es
   * correcta además de conveniente — el campo es opcional.
   */
  it('bajo SSR devuelve la lista vacía sin tocar la red', () => {
    const { catalogo, http } = montar('server');
    let opciones: readonly DynamicEnumOption[] | undefined;
    catalogo.listar().subscribe((o) => (opciones = o));

    expect(opciones).toEqual([]);
    http.verify();
  });

  it('no cachea el vacío del servidor: en el navegador se pide de verdad', () => {
    const { catalogo, http } = montar();
    catalogo.listar().subscribe();
    catalogo.listar().subscribe();

    // Una sola petición para dos lecturas: es la memoización del cliente.
    http.expectOne(RUTA).flush(RESPUESTA);
    http.verify();
  });

  it('traduce por código y cae al rótulo del catálogo si no hay palabra propia', () => {
    const { catalogo, http } = montar();
    catalogo.listar().subscribe();
    http.expectOne(RUTA).flush(RESPUESTA);

    expect(
      catalogo.etiquetaDe({
        conceptId: 'c-madre',
        code: 'RELATIONSHIP_MOTHER',
        display: 'Mother relationship',
        ordinal: 1,
        isDefault: false,
      }),
    ).toBe('Madre');

    // Un código que este front no conoce todavía: se muestra el rótulo del
    // catálogo, que está en inglés pero dice algo — nunca un uuid ni un blanco.
    expect(
      catalogo.etiquetaDe({
        conceptId: 'c-nuevo',
        code: 'RELATIONSHIP_NEW_ONE',
        display: 'Brand new relationship',
        ordinal: 9,
        isDefault: false,
      }),
    ).toBe('Brand new relationship');

    http.verify();
  });

  /**
   * Sin `olvidar()`, el `shareReplay` del cliente replicaría el error guardado
   * sin llegar a tocar la red, y «Reintentar» no reintentaría nada.
   */
  it('olvidar deja que el siguiente intento vuelva a pedir', () => {
    const { catalogo, http } = montar();
    catalogo.listar().subscribe({ error: () => undefined });
    http.expectOne(RUTA).flush(null, { status: 500, statusText: 'Server Error' });

    catalogo.olvidar();
    catalogo.listar().subscribe();

    http.expectOne(RUTA).flush(RESPUESTA);
    http.verify();
  });
});
