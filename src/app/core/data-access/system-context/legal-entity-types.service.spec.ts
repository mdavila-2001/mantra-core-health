import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CAMPO_TIPO_SOCIETARIO, LegalEntityTypesCatalog } from './legal-entity-types.service';
import type { DynamicEnumOption } from './system-context.types';

/**
 * El catálogo de tipos societarios (subtarea 1.1).
 *
 * Lo que estas pruebas fijan:
 *
 * 1. Se pide por **campo destino**, igual que el parentesco.
 * 2. Bajo SSR no toca la red (ruta pública y prerenderizada).
 * 3. Filtra por país y traduce por **código**, no por `display`.
 * 4. Un país sin figuras en el diccionario cae a Bolivia en vez de un
 *    desplegable vacío.
 */

const RUTA = `/system-context/dynamic-enums?target=${CAMPO_TIPO_SOCIETARIO}`;

const RESPUESTA = {
  code: 'legal-entity-type',
  name: 'Forma societaria',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    { conceptId: 'c-unipersonal', code: 'UNIPERSONAL', display: 'Sole proprietorship', ordinal: 0, isDefault: false },
    { conceptId: 'c-srl', code: 'SRL', display: 'Limited liability company (S.R.L.)', ordinal: 1, isDefault: false },
    { conceptId: 'c-br-ltda', code: 'BR_LTDA', display: 'Sociedade Limitada (Brazil)', ordinal: 8, isDefault: false },
    { conceptId: 'c-us-llc', code: 'US_LLC', display: 'Limited Liability Company (US)', ordinal: 14, isDefault: false },
    { conceptId: 'c-desconocido', code: 'CODIGO_QUE_NO_EXISTE', display: 'Something new', ordinal: 20, isDefault: false },
  ],
};

describe('LegalEntityTypesCatalog', () => {
  function montar(plataforma: 'browser' | 'server' = 'browser'): {
    catalogo: LegalEntityTypesCatalog;
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
      catalogo: TestBed.inject(LegalEntityTypesCatalog),
      http: TestBed.inject(HttpTestingController),
    };
  }

  it('pide el catálogo por campo destino', () => {
    const { catalogo, http } = montar();
    let opciones: readonly DynamicEnumOption[] = [];
    catalogo.listar().subscribe((o) => (opciones = o));

    http.expectOne(RUTA).flush(RESPUESTA);

    expect(opciones).toHaveLength(5);
    http.verify();
  });

  it('bajo SSR devuelve la lista vacía sin tocar la red', () => {
    const { catalogo, http } = montar('server');
    let opciones: readonly DynamicEnumOption[] | undefined;
    catalogo.listar().subscribe((o) => (opciones = o));

    expect(opciones).toEqual([]);
    http.verify();
  });

  it('filtra las opciones de Bolivia y las traduce por código', () => {
    const { catalogo, http } = montar();
    let opciones: readonly DynamicEnumOption[] = [];
    catalogo.listar().subscribe((o) => (opciones = o));
    http.expectOne(RUTA).flush(RESPUESTA);

    const filtradas = catalogo.opcionesPorPais(opciones, 'BO', 'es');

    expect(filtradas.map((o) => o.value)).toEqual(['UNIPERSONAL', 'SRL']);
    expect(filtradas.find((o) => o.value === 'SRL')?.label).toBe(
      'S.R.L. · Sociedad de Responsabilidad Limitada',
    );
  });

  it('filtra las opciones de Brasil por separado', () => {
    const { catalogo, http } = montar();
    let opciones: readonly DynamicEnumOption[] = [];
    catalogo.listar().subscribe((o) => (opciones = o));
    http.expectOne(RUTA).flush(RESPUESTA);

    const filtradas = catalogo.opcionesPorPais(opciones, 'BR', 'es');

    expect(filtradas.map((o) => o.value)).toEqual(['BR_LTDA']);
  });

  it('traduce en inglés y en portugués cuando se pide ese idioma', () => {
    const { catalogo, http } = montar();
    let opciones: readonly DynamicEnumOption[] = [];
    catalogo.listar().subscribe((o) => (opciones = o));
    http.expectOne(RUTA).flush(RESPUESTA);

    const enIngles = catalogo.opcionesPorPais(opciones, 'US', 'en');
    expect(enIngles.find((o) => o.value === 'US_LLC')?.label).toBe(
      'LLC · Limited Liability Company',
    );

    const enPortugues = catalogo.opcionesPorPais(opciones, 'BR', 'pt');
    expect(enPortugues.find((o) => o.value === 'BR_LTDA')?.label).toBe(
      'LTDA · Sociedade Limitada',
    );
  });

  it('un país sin figuras en el diccionario cae a Bolivia', () => {
    const { catalogo, http } = montar();
    let opciones: readonly DynamicEnumOption[] = [];
    catalogo.listar().subscribe((o) => (opciones = o));
    http.expectOne(RUTA).flush(RESPUESTA);

    const filtradas = catalogo.opcionesPorPais(opciones, 'ZZ', 'es');

    expect(filtradas.map((o) => o.value)).toEqual(['UNIPERSONAL', 'SRL']);
  });

  it('un código que la API sembró pero el diccionario no conoce se omite del filtro', () => {
    const { catalogo, http } = montar();
    let opciones: readonly DynamicEnumOption[] = [];
    catalogo.listar().subscribe((o) => (opciones = o));
    http.expectOne(RUTA).flush(RESPUESTA);

    const todas = [
      ...catalogo.opcionesPorPais(opciones, 'BO', 'es'),
      ...catalogo.opcionesPorPais(opciones, 'BR', 'es'),
      ...catalogo.opcionesPorPais(opciones, 'US', 'es'),
    ];

    expect(todas.some((o) => o.value === 'CODIGO_QUE_NO_EXISTE')).toBe(false);
  });

  it('paises() ofrece Bolivia primero', () => {
    const { catalogo } = montar();

    const paises = catalogo.paises('es');

    expect(paises[0]).toEqual({ value: 'BO', label: 'Bolivia' });
    expect(paises.map((p) => p.value)).toContain('BR');
    expect(paises.map((p) => p.value)).toContain('US');
  });

  it('olvidar() limpia la caché y permite reintentar', () => {
    const { catalogo, http } = montar();
    catalogo.listar().subscribe();
    http.expectOne(RUTA).flush(RESPUESTA);

    catalogo.olvidar();
    catalogo.listar().subscribe();

    http.expectOne(RUTA).flush(RESPUESTA);
    http.verify();
  });
});
