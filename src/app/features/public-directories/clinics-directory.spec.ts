import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';

import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';
import type { GrupoDeDirectorio } from '@shared/components/organisms/directory-page/directory-page.types';
import type { FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';

import { ClinicsDirectory } from './clinics-directory';

/** La búsqueda que hace este directorio. La otra —farmacias— es de su hermano. */
const BUSQUEDA = '/public/search/organizations';

const CB = 'geo:bo:department:CB';
const LP = 'geo:bo:department:LP';
const CH = 'geo:bo:department:CH';

/**
 * Tres departamentos con sus municipios, como los sirve el catálogo.
 *
 * Cochabamba lleva varios a propósito: es el que prueba que al elegirlo salen
 * **todos** los suyos y ninguno de los otros dos.
 */
const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: CB,
    sigla: 'CB',
    nombre: 'Cochabamba',
    municipios: [
      { conceptId: 'm-cb-1', nombre: 'Cochabamba', ine: '030101' },
      { conceptId: 'm-cb-2', nombre: 'Quillacollo', ine: '030401' },
      { conceptId: 'm-cb-3', nombre: 'Sacaba', ine: '030301' },
      { conceptId: 'm-cb-4', nombre: 'Tiquipaya', ine: '030402' },
    ],
  },
  {
    conceptId: LP,
    sigla: 'LP',
    nombre: 'La Paz',
    municipios: [
      { conceptId: 'm-lp-1', nombre: 'La Paz', ine: '020101' },
      { conceptId: 'm-lp-2', nombre: 'El Alto', ine: '020102' },
    ],
  },
  {
    conceptId: CH,
    sigla: 'CH',
    nombre: 'Chuquisaca',
    municipios: [{ conceptId: 'm-ch-1', nombre: 'Sucre', ine: '010101' }],
  },
];

function ficha(nombre: string, city: string | null, verified = false): PublicSearchResult {
  return {
    kind: 'ORGANIZATION',
    slug: nombre.toLowerCase().replace(/\s+/gu, '-'),
    displayName: nombre,
    headline: null,
    city,
    avatarUrl: null,
    verified,
    ratingAverage: null,
    ratingCount: 0,
    coverUrl: null,
    address: null,
    location: null,
    hasPublishedAgenda: false,
    nextAvailableDate: null,
  };
}

/**
 * El directorio entero de la prueba: dos departamentos con varias ciudades y
 * uno con una sola, más una ficha sin ciudad declarada.
 *
 * La Paz va con **más** fichas que Cochabamba porque el defecto que esto fija
 * era justamente ese: los chips se ordenaban por cantidad en todo el país, y
 * las ciudades chicas del departamento que uno tenía delante no llegaban.
 */
const FICHAS: readonly PublicSearchResult[] = [
  ficha('Clínica Los Olivos', 'La Paz', true),
  ficha('Hospital Obrero', 'La Paz'),
  ficha('Clínica del Norte', 'El Alto'),
  ficha('Clínica Belga', 'Cochabamba'),
  ficha('Centro Quillacollo', 'Quillacollo'),
  ficha('Posta de Tiquipaya', 'Tiquipaya'),
  ficha('Clínica Sucre', 'Sucre'),
  ficha('Consultorio sin domicilio', null),
];

describe('ClinicsDirectory · los chips de ciudad cuelgan del departamento', () => {
  let fixture: ComponentFixture<ClinicsDirectory>;
  let component: ClinicsDirectory;
  let http: HttpTestingController;
  /** Los parámetros de la URL, que son la fuente de los tres cortes. */
  let parametros: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    parametros = new BehaviorSubject<Record<string, string>>({});
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
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Monta la pantalla y le entrega el directorio entero en una sola página. */
  function montar(url: Record<string, string> = {}): void {
    parametros.next(url);
    fixture = TestBed.createComponent(ClinicsDirectory);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne((peticion) => peticion.url.endsWith(BUSQUEDA)).flush({
      items: FICHAS,
      nextCursor: null,
      totalHint: FICHAS.length,
      generatedAt: new Date().toISOString(),
    });
    fixture.detectChanges();
  }

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(component) : valor) as T;
  }

  function filtros(): readonly FilterDef[] {
    return interno<() => readonly FilterDef[]>('filtros')();
  }

  function chipsDeCiudad(): readonly string[] {
    const ciudad = filtros().find((filtro) => filtro.key === 'ciudad');
    return (ciudad?.options ?? []).map((opcion) => opcion.label);
  }

  function tramos(): readonly GrupoDeDirectorio[] {
    return interno<() => readonly GrupoDeDirectorio[]>('tramos')();
  }

  /**
   * Los chips de ciudad **dibujados**, no los declarados.
   *
   * El renglón de la barra es el que la persona ve; comprobar sólo el modelo
   * dejaría pasar que el organismo los pinte igual.
   */
  function chipsEnPantalla(): readonly string[] {
    const pantalla = fixture.nativeElement as HTMLElement;
    const renglon = pantalla.querySelector<HTMLElement>('[role="group"][aria-label="Ciudad"]');
    return renglon === null
      ? []
      : [...renglon.querySelectorAll<HTMLElement>('app-chip')].map(
          (chip) => chip.textContent?.trim() ?? '',
        );
  }

  it('sin departamento elegido no ofrece ningún chip de ciudad', () => {
    montar();

    // El mapa es el corte de arriba: ofrecer las dos escalas a la vez es
    // ofrecer dos preguntas para una sola decisión.
    expect(chipsDeCiudad()).toEqual([]);
    expect(filtros().map((filtro) => filtro.key)).toEqual(['verificado']);
    expect(chipsEnPantalla()).toEqual([]);
  });

  it('al elegir un departamento aparecen TODAS sus ciudades y sólo las suyas', () => {
    montar({ departamento: CB });

    // Las tres de Cochabamba que tienen algo publicado, la más cargada
    // primero. Tiquipaya está aunque tenga una sola ficha: es del
    // departamento que la persona eligió.
    expect(chipsDeCiudad()).toEqual(['Cochabamba', 'Quillacollo', 'Tiquipaya']);
    // Y ninguna de otro departamento, que es la corrección del cliente: antes
    // La Paz y El Alto seguían dibujadas después de elegir Cochabamba.
    expect(chipsDeCiudad()).not.toContain('La Paz');
    expect(chipsDeCiudad()).not.toContain('Sucre');
    expect(chipsEnPantalla()).toEqual(['Cochabamba', 'Quillacollo', 'Tiquipaya']);
  });

  it('elegir una ciudad no borra los chips de las otras del departamento', () => {
    montar({ departamento: CB, ciudad: 'Quillacollo' });

    expect(chipsDeCiudad()).toEqual(['Cochabamba', 'Quillacollo', 'Tiquipaya']);
    // Y acota de verdad: el chip de la URL filtra la lista, no sólo se dibuja
    // puesto. Antes esto sólo pasaba si la barra emitía; por enlace directo la
    // pantalla mostraba el chip activo y el directorio entero.
    expect(tramos().map((tramo) => tramo.nombre)).toEqual(['Quillacollo']);
  });

  it('un departamento con una sola ciudad publicada no dibuja el renglón', () => {
    montar({ departamento: CH });

    // Un chip único no acota nada: sería un botón que no hace nada con la
    // misma pinta que los que sí.
    expect(filtros().map((filtro) => filtro.key)).toEqual(['verificado']);
  });

  it('cambiar de departamento suelta la ciudad del anterior', () => {
    montar({ departamento: CB, ciudad: 'Quillacollo' });
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    interno<(conceptId: string | null) => void>('elegirDepartamento')(LP);

    // `ciudad: null` **quita** el parámetro. Conservarlo dejaría un filtro
    // invisible acotando La Paz por una ciudad de Cochabamba: cero resultados
    // sin nada en pantalla que lo explique.
    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { departamento: LP, ciudad: null },
        queryParamsHandling: 'merge',
      }),
    );
  });

  it('ninguna tarjeta lleva a la red social: la ficha vive dentro del panel', () => {
    montar();

    const destinos = tramos().flatMap((tramo) => tramo.resultados.map((tarjeta) => tarjeta.link));
    expect(destinos.length).toBeGreaterThan(0);
    // El pedido del cliente, literal: «no debería bajo ningún concepto» abrir
    // la red social. `/o/:slug` es la ficha anónima bajo el marco del buscador
    // público, y era a donde llevaba cada tarjeta de este directorio.
    expect(destinos.some((destino) => destino.startsWith('/o/'))).toBe(false);
    for (const destino of destinos) {
      expect(destino.startsWith('/clinics-directory/')).toBe(true);
    }
  });

  it('los enlaces dibujados apuntan al mismo lugar que el modelo', () => {
    montar();

    const pantalla = fixture.nativeElement as HTMLElement;
    const enlaces = [...pantalla.querySelectorAll<HTMLAnchorElement>('[app-result-card] a')];
    expect(enlaces.length).toBeGreaterThan(0);
    for (const enlace of enlaces) {
      // El atributo y no la propiedad: `href` resuelto traería el origen.
      expect(enlace.getAttribute('href')).toMatch(/^\/clinics-directory\//u);
    }
  });

  it('el mapa sigue contando lo que hay en cada departamento, esté o no elegido', () => {
    montar({ departamento: CB, ciudad: 'Quillacollo' });

    const cuenta = interno<() => ReadonlyMap<string, number>>('cuentaPorDepartamento')();
    // Contar con los cortes del mapa aplicados dejaría a La Paz en cero, o sea
    // el mapa diciendo que sólo hay clínicas donde uno acaba de pulsar.
    expect(cuenta.get(LP)).toBe(3);
    expect(cuenta.get(CB)).toBe(3);
  });
});
