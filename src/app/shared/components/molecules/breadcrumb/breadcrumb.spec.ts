import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Breadcrumb } from './breadcrumb';
import type { BreadcrumbItem } from './breadcrumb.types';

const RUTA_CORTA: readonly BreadcrumbItem[] = [
  { label: 'Red SALUD', routerLink: '/' },
  { label: 'Hospital Central', routerLink: '/sedes/1' },
  { label: 'Juan Pérez' },
];

const RUTA_LARGA: readonly BreadcrumbItem[] = [
  { label: 'Red SALUD', routerLink: '/' },
  { label: 'La Paz', routerLink: '/regiones/1' },
  { label: 'Hospital Central', routerLink: '/sedes/1' },
  { label: 'Cardiología', routerLink: '/servicios/9' },
  { label: 'Juan Pérez', routerLink: '/pacientes/123' },
  { label: 'Episodio 2026-07-31' },
];

describe('Breadcrumb', () => {
  let fixture: ComponentFixture<Breadcrumb>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function escalones(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('.breadcrumb__item')];
  }

  function textos(): string[] {
    return escalones().map((item) => (item.textContent ?? '').trim());
  }

  async function conItems(items: readonly BreadcrumbItem[]): Promise<void> {
    fixture.componentRef.setInput('items', items);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Breadcrumb],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Breadcrumb);
    fixture.componentRef.setInput('items', RUTA_CORTA);
    await fixture.whenStable();
  });

  describe('estructura', () => {
    it('es una lista ordenada dentro de una navegación nombrada', () => {
      const nav = root().querySelector('nav');

      expect(nav?.getAttribute('aria-label')).toBe('Ruta de navegación');
      expect(nav?.querySelector('ol')).not.toBeNull();
    });

    it('dibuja un escalón por ítem', () => {
      expect(textos()).toEqual(['Red SALUD', 'Hospital Central', 'Juan Pérez']);
    });

    it('los separadores no se anuncian', () => {
      const separadores = root().querySelectorAll('.breadcrumb__separator');

      expect(separadores.length).toBeGreaterThan(0);
      for (const separador of separadores) {
        expect(separador.getAttribute('aria-hidden')).toBe('true');
      }
    });
  });

  describe('escalón actual', () => {
    it('el último no es enlace y se marca con aria-current', () => {
      const ultimo = escalones().at(-1);

      expect(ultimo?.querySelector('a')).toBeNull();
      expect(ultimo?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(
        'Juan Pérez',
      );
    });

    it('ningún otro escalón lleva aria-current', () => {
      expect(root().querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    });

    it('el último es texto aunque traiga routerLink', async () => {
      await conItems([
        { label: 'Red SALUD', routerLink: '/' },
        { label: 'Juan Pérez', routerLink: '/pacientes/123' },
      ]);

      expect(escalones().at(-1)?.querySelector('a')).toBeNull();
    });
  });

  describe('enlaces', () => {
    it('los intermedios son anclas con href real', () => {
      const enlace = escalones()[1].querySelector('a');

      expect(enlace?.getAttribute('href')).toBe('/sedes/1');
    });

    it('un ítem sin routerLink se dibuja como texto', async () => {
      await conItems([
        { label: 'Red SALUD' },
        { label: 'Sección sin ruta' },
        { label: 'Actual' },
      ]);

      expect(root().querySelectorAll('a')).toHaveLength(0);
    });
  });

  describe('colapso', () => {
    it('con cuatro o menos no colapsa', async () => {
      await conItems(RUTA_LARGA.slice(0, 4));

      expect(fixture.componentInstance.isCollapsed()).toBe(false);
      expect(root().querySelector('.breadcrumb__more')).toBeNull();
    });

    it('con más de cuatro deja raíz + salto + los dos últimos', async () => {
      await conItems(RUTA_LARGA);

      expect(fixture.componentInstance.isCollapsed()).toBe(true);
      expect(textos()).toEqual(['Red SALUD', '…', 'Juan Pérez', 'Episodio 2026-07-31']);
    });

    it('los ocultos son los del medio', async () => {
      await conItems(RUTA_LARGA);

      expect(fixture.componentInstance.collapsedItems().map((item) => item.label)).toEqual([
        'La Paz',
        'Hospital Central',
        'Cardiología',
      ]);
    });

    it('el salto es un botón con nombre accesible, no tres puntos mudos', async () => {
      await conItems(RUTA_LARGA);

      const boton = root().querySelector('.breadcrumb__more');
      expect(boton?.tagName).toBe('BUTTON');
      expect(boton?.getAttribute('aria-label')).toBe(
        'Mostrar los escalones ocultos de la ruta',
      );
      expect(boton?.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('el salto abre un menú con los escalones ocultos', async () => {
      await conItems(RUTA_LARGA);

      root().querySelector<HTMLButtonElement>('.breadcrumb__more')?.click();
      await fixture.whenStable();

      const items = [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
        (item.textContent ?? '').trim(),
      );
      expect(items).toEqual(['La Paz', 'Hospital Central', 'Cardiología']);
    });

    it('el escalón actual sigue siendo el último, ya colapsada la ruta', async () => {
      await conItems(RUTA_LARGA);

      expect(root().querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(
        'Episodio 2026-07-31',
      );
    });
  });
});
