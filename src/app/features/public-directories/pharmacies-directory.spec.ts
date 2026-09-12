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

/** La búsqueda que hace este directorio. La otra —clínicas— es de su hermano. */
const BUSQUEDA = '/public/search/pharmacies';

const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: 'geo:bo:department:SC',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [{ conceptId: 'm-sc-1', nombre: 'Santa Cruz de la Sierra', ine: '070101' }],
  },
];

function ficha(nombre: string, city: string | null): PublicSearchResult {
  return {
    kind: 'PHARMACY',
    slug: nombre.toLowerCase().replace(/\s+/gu, '-'),
    displayName: nombre,
    headline: null,
    city,
    avatarUrl: null,
    verified: false,
    ratingAverage: null,
    ratingCount: 0,
    coverUrl: null,
    address: null,
    location: null,
    hasPublishedAgenda: false,
    nextAvailableDate: null,
  };
}

const FICHAS = [
  ficha('Farmacia Vida', 'Santa Cruz de la Sierra'),
  ficha('Farmacia Chávez', 'Santa Cruz de la Sierra'),
  ficha('Farmacia sin domicilio', null),
];

describe('PharmaciesDirectory · la ficha vive dentro del panel', () => {
  let fixture: ComponentFixture<PharmaciesDirectory>;
  let component: PharmaciesDirectory;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParams: new BehaviorSubject<Record<string, string>>({}) },
        },
        {
          provide: BoMunicipalitiesCatalog,
          useValue: { listar: () => of(RAMAS), olvidar: () => undefined },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PharmaciesDirectory);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((peticion) => peticion.url.endsWith(BUSQUEDA)).flush({
      items: FICHAS,
      nextCursor: null,
      totalHint: FICHAS.length,
      generatedAt: new Date().toISOString(),
    });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function tramos(): readonly GrupoDeDirectorio[] {
    const valor = (component as unknown as Record<string, unknown>)['tramos'];
    return (valor as () => readonly GrupoDeDirectorio[])();
  }

  it('ninguna tarjeta lleva a la red social', () => {
    const destinos = tramos().flatMap((tramo) => tramo.resultados.map((tarjeta) => tarjeta.link));

    expect(destinos.length).toBe(FICHAS.length);
    // `/f/:slug` es la ficha anónima bajo el marco del buscador público, y era
    // a donde llevaba cada tarjeta de este directorio.
    expect(destinos.some((destino) => destino.startsWith('/f/'))).toBe(false);
    for (const destino of destinos) {
      expect(destino.startsWith('/pharmacies-directory/')).toBe(true);
    }
  });

  it('los enlaces dibujados apuntan al mismo lugar que el modelo', () => {
    const pantalla = fixture.nativeElement as HTMLElement;
    const enlaces = [...pantalla.querySelectorAll<HTMLAnchorElement>('[app-result-card] a')];

    expect(enlaces.length).toBe(FICHAS.length);
    for (const enlace of enlaces) {
      // El atributo y no la propiedad: `href` resuelto traería el origen.
      expect(enlace.getAttribute('href')).toMatch(/^\/pharmacies-directory\//u);
    }
  });
});
