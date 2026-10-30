import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReportingClient } from '@core/data-access/reporting/reporting.client';
import type { ReporteCatalogo } from '@core/data-access/reporting/reporting.types';
import { filterReports, matchesQuery, normalizeText, sortReports } from './report-grid.logic';
import { ReportGrid } from './report-grid';
import { ReportPrefsStore } from './report-prefs.store';

function report(id: string, overrides: Partial<ReporteCatalogo> = {}): ReporteCatalogo {
  return {
    id,
    nombre: `Reporte ${id}`,
    vertical: 'resumen',
    descripcion: `Descripción de ${id}`,
    responsable: 'Finanzas',
    certificado: true,
    frescuraMin: 12,
    ruta: `/reporting/comercial/${id}`,
    ...overrides,
  };
}

const CATALOG: readonly ReporteCatalogo[] = [
  report('cobros', { nombre: 'Cobros y caja', vertical: 'cobros', descripcion: 'Éxito de pago y reembolsos.' }),
  report('suscripciones', { nombre: 'Suscripciones de doctores', vertical: 'suscripciones' }),
  report('publicidad', { nombre: 'Publicidad push', vertical: 'publicidad', certificado: false, enDiseno: true }),
  report('seguros', {
    nombre: 'Analítica de seguros',
    vertical: 'comisiones',
    ruta: '/administration/insurance-analytics',
    descripcion: 'Reclamos y corredores.',
  }),
  report('comisiones', { nombre: 'Comisiones y actores', vertical: 'comisiones' }),
];

type Fixture = ReturnType<typeof TestBed.createComponent<ReportGrid>>;

async function mount(catalog: unknown = of(CATALOG)): Promise<{ fixture: Fixture; root: HTMLElement }> {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([{ path: '**', children: [] }]),
      { provide: ReportingClient, useValue: { catalogo: () => catalog } },
    ],
  });
  const fixture = TestBed.createComponent(ReportGrid);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

const cards = (root: HTMLElement, container = 'grid-all') =>
  Array.from(root.querySelectorAll(`[data-testid="${container}"] app-report-card h3`)).map((h) => h.textContent?.trim());

describe('ReportGrid', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('muestra un esqueleto mientras carga y no el contenido', async () => {
    const pending = new Subject<readonly ReporteCatalogo[]>();
    const { fixture, root } = await mount(pending);
    expect(root.querySelector('[data-testid="report-grid-loading"]')).not.toBeNull();
    expect(root.querySelector('app-report-card')).toBeNull();

    pending.next(CATALOG);
    await fixture.whenStable();
    expect(root.querySelector('[data-testid="report-grid-loading"]')).toBeNull();
    expect(root.querySelectorAll('app-report-card').length).toBeGreaterThan(0);
  });

  it('lista todos los reportes ordenados por vertical y luego por nombre', async () => {
    const { root } = await mount();
    expect(cards(root)).toEqual([
      'Suscripciones de doctores',
      'Publicidad push',
      'Analítica de seguros',
      'Comisiones y actores',
      'Cobros y caja',
    ]);
    expect(root.querySelector('[data-testid="grid-total"]')?.textContent).toContain('5');
  });

  it('un catálogo vacío orienta en vez de quedar en blanco', async () => {
    const { root } = await mount(of([]));
    const empty = root.querySelector('[data-testid="report-grid-empty"]');
    expect(empty?.textContent).toContain('Aún no hay reportes');
    expect(empty?.textContent).toContain('administra su organización');
  });

  it('un error explica y permite reintentar; reintentar vuelve a pedir el catálogo', async () => {
    let attempts = 0;
    const catalog = { subscribe: undefined };
    void catalog;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: ReportingClient,
          useValue: {
            catalogo: () => {
              attempts += 1;
              return attempts === 1
                ? throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'INTERNAL', message: 'x', correlationId: 'req-1' } }))
                : of(CATALOG);
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ReportGrid);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Código de soporte');
    expect(root.textContent).toContain('req-1');

    const retry = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Reintentar'));
    expect(retry).toBeDefined();
    retry?.click();
    await fixture.whenStable();
    expect(attempts).toBe(2);
    expect(root.querySelectorAll('app-report-card').length).toBe(5);
  });

  describe('filtros', () => {
    it('los chips de vertical traen su contador y filtran', async () => {
      const { fixture, root } = await mount();
      const chip = root.querySelector('[data-testid="vertical-comisiones"]') as HTMLButtonElement;
      expect(chip.textContent?.replace(/\s+/g, ' ').trim()).toContain('2');
      // Solo salen las verticales que el catálogo trae.
      expect(root.querySelector('[data-testid="vertical-calidad"]')).toBeNull();

      chip.click();
      await fixture.whenStable();
      expect(cards(root)).toEqual(['Analítica de seguros', 'Comisiones y actores']);
      expect(chip.getAttribute('aria-pressed')).toBe('true');

      (root.querySelector('[data-testid="vertical-all"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(cards(root)).toHaveLength(5);
    });

    it('el buscador no distingue tildes ni mayúsculas', async () => {
      const { fixture, root } = await mount();
      const input = root.querySelector('app-search-field input') as HTMLInputElement;
      input.value = 'ANALITICA';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(cards(root)).toEqual(['Analítica de seguros']);
    });

    it('sin coincidencias lo dice y ofrece limpiar los filtros', async () => {
      const { fixture, root } = await mount();
      const input = root.querySelector('app-search-field input') as HTMLInputElement;
      input.value = 'zzzz';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(root.querySelector('[data-testid="grid-no-results"]')).not.toBeNull();

      (root.querySelector('[data-testid="grid-no-results"] button') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(cards(root)).toHaveLength(5);
    });
  });

  describe('tarjetas', () => {
    it('marca como «Pantalla existente» lo que no vive en /reporting', async () => {
      const { root } = await mount();
      const withBadge = Array.from(root.querySelectorAll('[data-testid="grid-all"] app-report-card')).filter((c) =>
        c.textContent?.includes('Pantalla existente'),
      );
      expect(withBadge).toHaveLength(1);
      expect(withBadge[0]?.textContent).toContain('Analítica de seguros');
    });

    it('dice en texto si está certificado o en diseño', async () => {
      const { root } = await mount();
      const publicidad = root.querySelector('[data-testid="report-card-publicidad"]') as HTMLElement;
      expect(publicidad.textContent).toContain('Sin certificar');
      expect(publicidad.textContent).toContain('En diseño');
      expect((root.querySelector('[data-testid="report-card-cobros"]') as HTMLElement).textContent).toContain('Certificado');
    });

    it('escribe la frescura legible', async () => {
      const { root } = await mount();
      expect(root.querySelector('[data-testid="report-card-cobros"] [data-testid="report-freshness"]')?.textContent?.trim()).toBe(
        'Actualizado hace 12 min',
      );
    });
  });

  describe('favoritos y recientes', () => {
    it('la estrella agrega a «Favoritos», lo recuerda y se puede quitar', async () => {
      const { fixture, root } = await mount();
      expect(root.querySelector('[data-testid="grid-favorites"]')).toBeNull();

      const star = root.querySelector('[data-testid="report-card-cobros"] [data-testid="report-favorite"]') as HTMLButtonElement;
      expect(star.getAttribute('aria-pressed')).toBe('false');
      star.click();
      await fixture.whenStable();

      expect(cards(root, 'grid-favorites')).toEqual(['Cobros y caja']);
      expect(star.getAttribute('aria-pressed')).toBe('true');
      expect(JSON.parse(localStorage.getItem('mantra.reporting.prefs.v1.anonymous') ?? '{}').favorites).toEqual(['cobros']);

      star.click();
      await fixture.whenStable();
      expect(root.querySelector('[data-testid="grid-favorites"]')).toBeNull();
    });

    it('el nombre accesible de la estrella incluye el del reporte', async () => {
      const { root } = await mount();
      const star = root.querySelector('[data-testid="report-card-cobros"] [data-testid="report-favorite"]') as HTMLElement;
      expect(star.textContent).toContain('Favorito');
      expect(star.textContent).toContain('Cobros y caja');
    });

    it('abrir un reporte lo agrega a «Recientes», el más nuevo primero', async () => {
      const { fixture, root } = await mount();
      (root.querySelector('[data-testid="report-card-cobros"] [data-testid="report-open"]') as HTMLAnchorElement).click();
      (root.querySelector('[data-testid="report-card-suscripciones"] [data-testid="report-open"]') as HTMLAnchorElement).click();
      await fixture.whenStable();
      const recents = Array.from(root.querySelectorAll('[data-testid="grid-recents"] a')).map((a) => a.textContent?.trim());
      expect(recents).toEqual(['Suscripciones de doctores', 'Cobros y caja']);
    });

    it('recuerda lo guardado de la visita anterior', async () => {
      localStorage.setItem('mantra.reporting.prefs.v1.anonymous', JSON.stringify({ favorites: ['publicidad'], recents: ['cobros'] }));
      const { root } = await mount();
      expect(cards(root, 'grid-favorites')).toEqual(['Publicidad push']);
      expect(root.querySelectorAll('[data-testid="grid-recents"] a')).toHaveLength(1);
    });

    it('si el almacenamiento falla, la pantalla funciona igual', async () => {
      vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('cuota');
      });
      const { fixture, root } = await mount();
      expect(cards(root)).toHaveLength(5);
      (root.querySelector('[data-testid="report-card-cobros"] [data-testid="report-favorite"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      // Se pierde la memoria entre visitas, no la función.
      expect(cards(root, 'grid-favorites')).toEqual(['Cobros y caja']);
    });

    it('un valor corrupto no rompe la carga', async () => {
      localStorage.setItem('mantra.reporting.prefs.v1.anonymous', '{no es json');
      const { root } = await mount();
      expect(cards(root)).toHaveLength(5);
      expect(TestBed.inject(ReportPrefsStore).favorites()).toEqual([]);
    });
  });
});

describe('lógica del grid', () => {
  it('normalizeText quita tildes y mayúsculas', () => {
    expect(normalizeText('  Analítica Ñandú ')).toBe('analitica nandu');
  });

  it('la búsqueda exige todas las palabras, en cualquier orden', () => {
    const r = report('x', { nombre: 'Analítica de seguros', descripcion: 'Reclamos y corredores.' });
    expect(matchesQuery(r, 'seguros analitica')).toBe(true);
    expect(matchesQuery(r, 'seguros pagos')).toBe(false);
    expect(matchesQuery(r, '')).toBe(true);
  });

  it('filterReports combina vertical y texto', () => {
    expect(filterReports(CATALOG, 'comisiones', 'seguros').map((r) => r.id)).toEqual(['seguros']);
    expect(filterReports(CATALOG, 'all', '')).toHaveLength(5);
  });

  it('sortReports no muta la entrada', () => {
    const copy = [...CATALOG];
    sortReports(CATALOG);
    expect(CATALOG).toEqual(copy);
  });
});
