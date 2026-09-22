import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';

import { BuscarAseguradorasListado } from './aseguradoras-listado';

const CB = 'geo:bo:department:CB';
const LP = 'geo:bo:department:LP';
const SC = 'geo:bo:department:SC';
const PD = 'geo:bo:department:PD';

/** El catálogo de la prueba. «San Pedro» está en Santa Cruz y en Pando, como en el INE. */
const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: CB,
    sigla: 'CB',
    nombre: 'Cochabamba',
    municipios: [
      { conceptId: 'm-cb-1', nombre: 'Cochabamba', ine: '030101' },
      { conceptId: 'm-cb-2', nombre: 'Quillacollo', ine: '030401' },
    ],
  },
  {
    conceptId: LP,
    sigla: 'LP',
    nombre: 'La Paz',
    municipios: [
      { conceptId: 'm-lp-1', nombre: 'La Paz', ine: '020101' },
      { conceptId: 'm-lp-2', nombre: 'El Alto', ine: '020105' },
    ],
  },
  {
    conceptId: SC,
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [
      { conceptId: 'm-sc-1', nombre: 'Santa Cruz de la Sierra', ine: '070101' },
      { conceptId: 'm-sc-2', nombre: 'San Pedro', ine: '071005' },
    ],
  },
  {
    conceptId: PD,
    sigla: 'PD',
    nombre: 'Pando',
    municipios: [
      { conceptId: 'm-pd-1', nombre: 'Cobija', ine: '090101' },
      { conceptId: 'm-pd-2', nombre: 'San Pedro', ine: '090202' },
    ],
  },
];

function aseguradora(nombre: string, city: string | null): PublicSearchResult {
  return {
    kind: 'INSURER',
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

function pagina(
  items: readonly PublicSearchResult[],
  nextCursor: string | null,
): PublicPage<PublicSearchResult> {
  return { items, nextCursor, totalHint: null, generatedAt: new Date('2026-09-12T00:00:00Z') };
}

/**
 * El directorio llega en **dos páginas**, y Cochabamba tiene una aseguradora en
 * cada una: es lo que prueba que el corte ve el directorio entero y no la
 * página en pantalla.
 */
const PRIMERA = [
  aseguradora('Seguros Illimani', 'La Paz'),
  aseguradora('Nacional Vida', 'El Alto'),
  aseguradora('Aseguradora del Valle', 'Cochabamba'),
];
const SEGUNDA = [
  aseguradora('Seguros Quillacollo', 'quillacollo'),
  aseguradora('Previsora San Pedro', 'San Pedro'),
  aseguradora('Aseguradora sin domicilio', null),
];

const RUTA = 'search/insurers';

function direccion(parametros: Record<string, string>): string {
  const consulta = new URLSearchParams(parametros).toString();
  return consulta === '' ? `/${RUTA}` : `/${RUTA}?${consulta}`;
}

/**
 * El lugar en dos pasos sobre la pantalla montada (subtarea 2.3): mapa, chips,
 * URL y lo que llega al servidor. El corte en sí se prueba en
 * `shared/geo/filtro-territorial.spec.ts`, y el recorrido del cursor en
 * `public-search.store.spec.ts`.
 */
describe('BuscarAseguradorasListado · el lugar en dos pasos (subtarea 2.3)', () => {
  let pedidos: PublicSearchQuery[];

  async function refrescar(harness: RouterTestingHarness): Promise<void> {
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
  }

  async function montar(parametros: Record<string, string> = {}): Promise<RouterTestingHarness> {
    pedidos = [];
    const directorio = {
      searchInsurers: (filtros: PublicSearchQuery) => {
        pedidos.push(filtros);
        return of(
          filtros.cursor === undefined ? pagina(PRIMERA, 'cursor-2') : pagina(SEGUNDA, null),
        );
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: RUTA, component: BuscarAseguradorasListado }]),
        { provide: PublicDirectoryClient, useValue: directorio },
        {
          provide: BoMunicipalitiesCatalog,
          useValue: { listar: () => of(RAMAS), olvidar: (): void => undefined },
        },
      ],
    });

    const harness = await RouterTestingHarness.create(direccion(parametros));
    await refrescar(harness);
    return harness;
  }

  function pantalla(harness: RouterTestingHarness): HTMLElement {
    return harness.routeDebugElement!.nativeElement as HTMLElement;
  }

  /** Lo que la grilla está dibujando, por nombre. */
  function nombres(harness: RouterTestingHarness): readonly string[] {
    const pantallaMontada = harness.routeDebugElement!.componentInstance as unknown as {
      tarjetas: () => readonly { readonly name: string }[];
    };
    return pantallaMontada.tarjetas().map((tarjeta) => tarjeta.name);
  }

  /** Los chips de municipio **dibujados**, que son los que la persona ve. */
  function chips(harness: RouterTestingHarness): readonly string[] {
    return [
      ...pantalla(harness).querySelectorAll<HTMLElement>('[data-testid="aseguradoras-chip-ciudad"]'),
    ].map((chip) => chip.textContent?.trim() ?? '');
  }

  it('dibuja el mapa, no ofrece municipios sin departamento y lista el directorio entero', async () => {
    const harness = await montar();

    expect(pantalla(harness).querySelector('[data-testid="aseguradoras-mapa-CB"]')).not.toBeNull();
    expect(chips(harness)).toEqual([]);
    expect(nombres(harness)).toHaveLength(6);
    // Se recorrió el cursor: la segunda página se pidió con el que devolvió la primera.
    expect(pedidos.map((pedido) => pedido.cursor)).toEqual([undefined, 'cursor-2']);
  });

  it('con departamento, acota a través de las dos páginas y ofrece sólo sus municipios (AC-2.3-02)', async () => {
    const harness = await montar({ departamento: CB });

    expect(nombres(harness)).toEqual(['Aseguradora del Valle', 'Seguros Quillacollo']);
    expect(chips(harness)).toEqual(['Cochabamba', 'Quillacollo']);
    expect(
      pantalla(harness).querySelector('[data-testid="aseguradoras-mapa-resumen"]')?.textContent,
    ).toContain('2 resultados en Cochabamba');
  });

  it('tocar un municipio lo escribe en la URL con el nombre del catálogo y acota', async () => {
    const harness = await montar({ departamento: CB });

    const chip = [
      ...pantalla(harness).querySelectorAll<HTMLButtonElement>(
        '[data-testid="aseguradoras-chip-ciudad"]',
      ),
    ].find((boton) => boton.textContent?.trim() === 'Quillacollo')!;
    chip.click();
    await refrescar(harness);

    expect(TestBed.inject(Router).url).toContain('ciudad=Quillacollo');
    expect(nombres(harness)).toEqual(['Seguros Quillacollo']);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('elegir otro departamento en el mapa suelta el municipio del anterior (AC-2.3-03)', async () => {
    const harness = await montar({ departamento: CB, ciudad: 'Quillacollo' });
    expect(nombres(harness)).toEqual(['Seguros Quillacollo']);

    pantalla(harness)
      .querySelector('[data-testid="aseguradoras-mapa-LP"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await refrescar(harness);

    const url = TestBed.inject(Router).url;
    expect(url).toContain(`departamento=${LP}`);
    expect(url).not.toContain('ciudad=');
    expect(nombres(harness)).toEqual(['Seguros Illimani', 'Nacional Vida']);
  });

  it('un enlace con un municipio de otro departamento no deja una combinación incoherente (AC-2.3-06)', async () => {
    const harness = await montar({ departamento: CB, ciudad: 'La Paz' });

    expect(nombres(harness)).toEqual(['Aseguradora del Valle', 'Seguros Quillacollo']);
    const todoElDepartamento = pantalla(harness).querySelector(
      '[data-testid="aseguradoras-chips-ciudad"] button',
    );
    expect(todoElDepartamento?.textContent?.trim()).toBe('Todo el departamento');
    expect(todoElDepartamento?.getAttribute('aria-pressed')).toBe('true');
  });

  it('un departamento que no existe en el catálogo no filtra: se ve todo el país (AC-2.3-07)', async () => {
    const harness = await montar({ departamento: 'geo:bo:department:XX' });

    expect(nombres(harness)).toHaveLength(6);
    expect(chips(harness)).toEqual([]);
  });

  it('un nombre que el catálogo repite no se ubica en ningún departamento (AC-2.3-05)', async () => {
    const harness = await montar({ departamento: SC });

    // «Previsora San Pedro» no aparece en Santa Cruz: podría ser de Pando.
    expect(nombres(harness)).toEqual([]);
    expect(
      pantalla(harness).querySelector('[data-testid="aseguradoras-mapa-resumen"]')?.textContent,
    ).toContain('Todavía no hay nada publicado en Santa Cruz');
  });

  it('con departamento elegido, dice cuántos resultados no se pueden ubicar', async () => {
    const harness = await montar({ departamento: LP });

    expect(nombres(harness)).toEqual(['Seguros Illimani', 'Nacional Vida']);
    // «San Pedro», ambiguo, y la aseguradora sin domicilio.
    expect(
      pantalla(harness).querySelector('[data-testid="aseguradoras-aviso-lugar"]')?.textContent,
    ).toContain('2 resultados no declaran');
  });

  it('el texto sigue viajando al servidor en cada página del recorrido; el lugar, no', async () => {
    await montar({ q: 'vida', departamento: CB });

    expect(pedidos).toHaveLength(2);
    for (const pedido of pedidos) {
      expect(pedido.q).toBe('vida');
      expect(Object.keys(pedido)).not.toContain('departamento');
    }
  });
});
