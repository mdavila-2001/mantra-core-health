import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';
import type { GrupoDeDirectorio } from '@shared/components/organisms/directory-page/directory-page.types';

import { PharmaciesDirectory } from './pharmacies-directory';

/* ============================================================================
    El chip de categoría de los directorios públicos.

    Se ejercita sobre el de farmacias porque es el que el cliente señaló —65
    resultados de corrido, sin más corte que la ciudad—, pero lo que se prueba
    vive en `PublicDirectoryListing` y lo hereda igual el de clínicas.
    ========================================================================== */

const BUSQUEDA = '/public/search/pharmacies';

const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: 'geo:bo:department:SC',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [{ conceptId: 'm-sc-1', nombre: 'Santa Cruz de la Sierra', ine: '070101' }],
  },
];

const CADENA = { code: 'cadena-farmacorp', label: 'Farmacorp' };
const INDEPENDIENTE = { code: 'farmacia-independiente', label: 'Farmacia independiente' };

function ficha(
  nombre: string,
  category: { readonly code: string; readonly label: string } | null,
): PublicSearchResult {
  return {
    kind: 'PHARMACY',
    slug: nombre.toLowerCase().replace(/\s+/gu, '-'),
    displayName: nombre,
    headline: null,
    city: 'Santa Cruz de la Sierra',
    avatarUrl: null,
    verified: false,
    ratingAverage: null,
    ratingCount: 0,
    coverUrl: null,
    address: null,
    location: null,
    hasPublishedAgenda: false,
    nextAvailableDate: null,
    category,
  };
}

interface Opcion {
  readonly value: string;
  readonly label: string;
}

interface Filtro {
  readonly key: string;
  readonly label: string;
  readonly options: readonly Opcion[];
}

function montar(fichas: readonly PublicSearchResult[]): {
  readonly fixture: ComponentFixture<PharmaciesDirectory>;
  readonly parametros: BehaviorSubject<Record<string, string>>;
  readonly http: HttpTestingController;
} {
  const parametros = new BehaviorSubject<Record<string, string>>({});
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParams: parametros } },
      {
        provide: BoMunicipalitiesCatalog,
        useValue: { listar: () => of(RAMAS), olvidar: () => undefined },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(PharmaciesDirectory);
  fixture.detectChanges();
  http.expectOne((peticion) => peticion.url.endsWith(BUSQUEDA)).flush({
    items: fichas,
    nextCursor: null,
    totalHint: fichas.length,
    generatedAt: new Date().toISOString(),
  });
  fixture.detectChanges();
  return { fixture, parametros, http };
}

/** Lo que la pantalla le pasa a la barra de filtros. */
function filtros(fixture: ComponentFixture<PharmaciesDirectory>): readonly Filtro[] {
  const interno = fixture.componentInstance as unknown as Record<string, unknown>;
  return (interno['filtros'] as () => readonly Filtro[])();
}

/** Los nombres que el directorio está mostrando, en el orden en que los pinta. */
function nombres(fixture: ComponentFixture<PharmaciesDirectory>): readonly string[] {
  const interno = fixture.componentInstance as unknown as Record<string, unknown>;
  const tramos = (interno['tramos'] as () => readonly GrupoDeDirectorio[])();
  return tramos.flatMap((tramo) => tramo.resultados.map((tarjeta) => tarjeta.title));
}

describe('PublicDirectoryListing · el chip de categoría', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ofrece las categorías que hay, la que más fichas tiene primero', () => {
    const { fixture } = montar([
      ficha('Farmacia de la esquina', INDEPENDIENTE),
      ficha('Farmacorp Norte', CADENA),
      ficha('Farmacorp Sur', CADENA),
      ficha('Farmacorp Centro', CADENA),
    ]);

    const categoria = filtros(fixture).find((filtro) => filtro.key === 'categoria');

    expect(categoria).toBeDefined();
    expect(categoria?.label).toBe('Categoría');
    // Tres Farmacorp contra una independiente: la de más fichas va primera,
    // igual que los chips de ciudad.
    expect(categoria?.options.map((opcion) => opcion.value)).toEqual([
      CADENA.code,
      INDEPENDIENTE.code,
    ]);
    expect(categoria?.options.map((opcion) => opcion.label)).toEqual([
      CADENA.label,
      INDEPENDIENTE.label,
    ]);
  });

  it('va antes que la verificación: la categoría es el corte más grueso', () => {
    const { fixture } = montar([
      ficha('Farmacorp Norte', CADENA),
      ficha('Farmacia de la esquina', INDEPENDIENTE),
    ]);

    expect(filtros(fixture).map((filtro) => filtro.key)).toEqual(['categoria', 'verificado']);
  });

  it('elegir una categoría acota la lista a esa categoría', () => {
    const { fixture, parametros } = montar([
      ficha('Farmacorp Norte', CADENA),
      ficha('Farmacorp Sur', CADENA),
      ficha('Farmacia de la esquina', INDEPENDIENTE),
    ]);

    parametros.next({ categoria: CADENA.code });
    fixture.detectChanges();

    expect(nombres(fixture)).toEqual(['Farmacorp Norte', 'Farmacorp Sur']);
  });

  it('las opciones no se achican al elegir una: se puede pasar a la otra', () => {
    const { fixture, parametros } = montar([
      ficha('Farmacorp Norte', CADENA),
      ficha('Farmacia de la esquina', INDEPENDIENTE),
    ]);

    parametros.next({ categoria: CADENA.code });
    fixture.detectChanges();

    const categoria = filtros(fixture).find((filtro) => filtro.key === 'categoria');

    expect(categoria?.options.length).toBe(2);
  });

  it('con una sola categoría no dibuja el chip: no acotaría nada', () => {
    const { fixture } = montar([ficha('Farmacorp Norte', CADENA), ficha('Farmacorp Sur', CADENA)]);

    expect(filtros(fixture).some((filtro) => filtro.key === 'categoria')).toBe(false);
  });

  it('sin categorías en los resultados tampoco lo dibuja, que es lo que pasa contra la API viva', () => {
    // El contrato público todavía no sirve `category`, así que todas las filas
    // vuelven en `null`. La pantalla no inventa una categoría «Otras» ni deja
    // un chip que no acota: simplemente no hay fila de chips.
    const { fixture } = montar([ficha('Farmacia Vida', null), ficha('Farmacia Central', null)]);

    expect(filtros(fixture).some((filtro) => filtro.key === 'categoria')).toBe(false);
    expect(nombres(fixture).length).toBe(2);
  });
});
