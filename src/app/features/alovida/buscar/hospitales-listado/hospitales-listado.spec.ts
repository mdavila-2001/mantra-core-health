import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, map, of } from 'rxjs';
import { vi } from 'vitest';

import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';

import { BuscarHospitalesListado } from './hospitales-listado';

/** La búsqueda que hace este directorio. */
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
      { conceptId: 'm-cb-3', nombre: 'Tiquipaya', ine: '030402' },
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

function ficha(nombre: string, city: string | null): PublicSearchResult {
  return {
    kind: 'ORGANIZATION',
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

/**
 * El directorio de la prueba.
 *
 * La Paz va con **más** fichas que Cochabamba porque el defecto que esto fija
 * era ése: los chips eran ocho ciudades fijas del país, así que después de
 * elegir un departamento seguían dibujadas las de los otros —y al tocarlas
 * vaciaban la lista— y faltaban las ciudades chicas del que se tenía delante.
 */
const FICHAS: readonly PublicSearchResult[] = [
  ficha('Clínica del Sur', 'La Paz'),
  ficha('Hospital Obrero', 'La Paz'),
  ficha('Hospital Municipal El Alto Norte', 'El Alto'),
  ficha('Clínica Belga', 'Cochabamba'),
  ficha('Hospital Viedma', 'Cochabamba'),
  ficha('Centro Quillacollo', 'Quillacollo'),
  ficha('Posta de Tiquipaya', 'Tiquipaya'),
  ficha('Hospital Santa Bárbara', 'Sucre'),
  ficha('Centro sin domicilio', null),
];

/**
 * Lo que estas pruebas fijan: que en el directorio público de hospitales el
 * lugar se elija en **dos pasos** —primero el departamento en el mapa, y recién
 * ahí las ciudades—, que es la corrección que pidió el cliente el 08/09/2026 y
 * que ya estaba en clínicas y farmacias.
 */
describe('BuscarHospitalesListado · los chips de ciudad cuelgan del departamento', () => {
  let fixture: ComponentFixture<BuscarHospitalesListado>;
  let component: BuscarHospitalesListado;
  let http: HttpTestingController;
  let parametros: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    parametros = new BehaviorSubject<Record<string, string>>({});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: parametros,
            queryParamMap: parametros.pipe(map((p) => convertToParamMap(p))),
          },
        },
        {
          provide: BoMunicipalitiesCatalog,
          useValue: { listar: () => of(RAMAS), olvidar: () => undefined },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.match(() => true).forEach((peticion) => peticion.flush({ items: [], nextCursor: null, totalHint: 0 }));
    http.verify();
  });

  /** Monta la pantalla y le entrega el directorio entero en una sola página. */
  function montar(url: Record<string, string> = {}): void {
    parametros.next(url);
    fixture = TestBed.createComponent(BuscarHospitalesListado);
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

  /** Los chips **dibujados**, que son los que la persona ve. */
  function chipsEnPantalla(): readonly string[] {
    const renglon = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="hospitales-chips-ciudad"]',
    );
    return renglon === null
      ? []
      : [...renglon.querySelectorAll<HTMLElement>('[data-testid="hospitales-chip-ciudad"]')].map(
          (chip) => chip.textContent?.trim() ?? '',
        );
  }

  function nombresEnLaGrilla(): readonly string[] {
    return interno<() => readonly { readonly name: string }[]>('centros')().map((c) => c.name);
  }

  it('sin departamento elegido no ofrece ningún chip de ciudad', () => {
    montar();

    // El mapa es el corte de arriba. Antes acá había ocho ciudades fijas del
    // país, y tres de ellas no tenían un solo centro publicado.
    expect(chipsEnPantalla()).toEqual([]);
    // Y la lista es el país entero.
    expect(nombresEnLaGrilla().length).toBe(FICHAS.length);
  });

  it('al elegir un departamento aparecen TODAS sus ciudades y sólo las suyas', () => {
    montar({ departamento: CB });

    // Las tres de Cochabamba que tienen algo publicado, la más cargada
    // primero. Tiquipaya está aunque tenga una sola ficha: es del departamento
    // que la persona eligió.
    expect(chipsEnPantalla()).toEqual(['Cochabamba', 'Quillacollo', 'Tiquipaya']);
    expect(chipsEnPantalla()).not.toContain('La Paz');
    expect(chipsEnPantalla()).not.toContain('Sucre');
  });

  it('el departamento acota la lista, no sólo dibuja los chips', () => {
    montar({ departamento: CB });

    expect(nombresEnLaGrilla()).toEqual([
      'Clínica Belga',
      'Hospital Viedma',
      'Centro Quillacollo',
      'Posta de Tiquipaya',
    ]);
    expect(interno<() => string>('recuento')()).toBe('4 centros en Cochabamba');
  });

  it('elegir una ciudad acota dentro del departamento y deja los otros chips', () => {
    montar({ departamento: CB, ciudad: 'Quillacollo' });

    expect(nombresEnLaGrilla()).toEqual(['Centro Quillacollo']);
    // Los chips siguen siendo los tres: calculados sobre lo ya filtrado
    // quedaría uno solo y no habría cómo pasar a otra ciudad.
    expect(chipsEnPantalla()).toEqual(['Cochabamba', 'Quillacollo', 'Tiquipaya']);
  });

  it('un departamento con una sola ciudad publicada no dibuja el renglón', () => {
    montar({ departamento: CH });

    // Un chip único no acota nada: sería un botón que no hace nada con la misma
    // pinta que los que sí.
    expect(chipsEnPantalla()).toEqual([]);
    expect(nombresEnLaGrilla()).toEqual(['Hospital Santa Bárbara']);
  });

  it('cambiar de departamento suelta la ciudad del anterior', () => {
    montar({ departamento: CB, ciudad: 'Quillacollo' });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    interno<(conceptId: string | null) => void>('elegirDepartamento')(LP);

    // Sin esto, «Quillacollo» seguiría acotando dentro de La Paz: un filtro
    // invisible que deja la lista en cero sin nada que lo explique.
    expect(navegar).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { departamento: LP, ciudad: null } }),
    );
  });

  it('el mapa cuenta los centros de cada departamento, no sólo los del elegido', () => {
    montar({ departamento: CH });

    // La cuenta que sirve es «cuánto hay ahí si voy»: con el mapa aplicado, los
    // otros ocho departamentos darían cero.
    const cuenta = interno<() => ReadonlyMap<string, number>>('cuentaPorDepartamento')();
    expect(cuenta.get(LP)).toBe(3);
    expect(cuenta.get(CB)).toBe(4);
    expect(interno<() => string | null>('resumenDelMapa')()).toContain('1 centro en Chuquisaca');
  });

  it('una ficha sin ciudad no se pierde: aparece cuando no hay departamento', () => {
    montar();

    // Un centro que no cargó su ciudad existe igual y tiene que poder
    // encontrarse; lo que no puede es colgar de un departamento que no declaró.
    expect(nombresEnLaGrilla()).toContain('Centro sin domicilio');
  });
});
