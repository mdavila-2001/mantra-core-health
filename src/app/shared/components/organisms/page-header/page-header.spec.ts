import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { BreadcrumbItem } from '../../molecules/breadcrumb/breadcrumb.types';
import { PageHeader, type PageHeaderAction } from './page-header';

const PAGE_HEADER_CSS = 'src/app/shared/components/organisms/page-header/page-header.css';

@Component({
  imports: [PageHeader],
  template: `
    <app-page-header
      [title]="title()"
      [subtitle]="subtitle()"
      [breadcrumbs]="breadcrumbs()"
      [secondaryActions]="secundarias()"
      (actionSelected)="elegidas.push($event)"
    >
      <button page-actions type="button" class="primaria">Registrar evolución</button>
      <span page-meta>Última atención: 12/07/2026</span>
    </app-page-header>
  `,
})
class HostComponent {
  readonly title = signal('Juan Pérez');
  readonly subtitle = signal('HC 00123 · 54 años');
  readonly breadcrumbs = signal<readonly BreadcrumbItem[]>([]);
  readonly secundarias = signal<readonly PageHeaderAction[]>([]);
  readonly elegidas: string[] = [];
}

const TRES_ACCIONES: readonly PageHeaderAction[] = [
  { code: 'print', label: 'Imprimir', icon: 'print' },
  { code: 'export', label: 'Exportar', icon: 'download' },
  { code: 'audit', label: 'Ver auditoría', icon: 'history' },
];

describe('PageHeader', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('encabezado', () => {
    it('renderiza exactamente un h1', () => {
      const encabezados = root().querySelectorAll('h1');

      expect(encabezados).toHaveLength(1);
      expect(encabezados[0].textContent?.trim()).toBe('Juan Pérez');
    });

    it('subtítulo y meta acompañan al título', () => {
      expect(root().querySelector('.page-header__subtitle')?.textContent?.trim()).toBe(
        'HC 00123 · 54 años',
      );
      expect(root().querySelector('.page-header__meta')?.textContent).toContain(
        'Última atención',
      );
    });
  });

  describe('ruta de navegación', () => {
    it('sin items no hay breadcrumb', () => {
      expect(root().querySelector('app-breadcrumb')).toBeNull();
    });

    it('con items aparece arriba del título', async () => {
      host.breadcrumbs.set([
        { label: 'Red SALUD', routerLink: '/' },
        { label: 'Juan Pérez' },
      ]);
      await fixture.whenStable();

      expect(root().querySelector('app-breadcrumb')).not.toBeNull();
    });
  });

  describe('acciones', () => {
    it('la primaria proyectada está siempre presente', () => {
      expect(root().querySelector('.primaria')).not.toBeNull();
    });

    it('con dos secundarias o menos no existe el menú de desborde', async () => {
      host.secundarias.set(TRES_ACCIONES.slice(0, 2));
      await fixture.whenStable();

      expect(root().querySelector('.page-header__overflow')).toBeNull();
      expect(root().querySelectorAll('.page-header__secondary button')).toHaveLength(2);
    });

    it('con más de dos aparece el menú y los botones quedan marcados como colapsables', async () => {
      host.secundarias.set(TRES_ACCIONES);
      await fixture.whenStable();

      expect(root().querySelector('.page-header__overflow')).not.toBeNull();
      expect(
        root().querySelector('.page-header__secondary--collapsible'),
      ).not.toBeNull();
    });

    it('la primaria NUNCA entra al menú de desborde', async () => {
      host.secundarias.set(TRES_ACCIONES);
      await fixture.whenStable();

      root()
        .querySelector<HTMLButtonElement>('.page-header__overflow button[aria-haspopup="menu"]')
        ?.click();
      await fixture.whenStable();

      const itemsDelMenu = [...document.querySelectorAll('[role="menuitem"]')].map((item) =>
        (item.textContent ?? '').trim(),
      );
      expect(itemsDelMenu).toEqual(['Imprimir', 'Exportar', 'Ver auditoría']);
      expect(itemsDelMenu).not.toContain('Registrar evolución');
    });

    it('el botón y el ítem de menú emiten el MISMO código', async () => {
      host.secundarias.set(TRES_ACCIONES);
      await fixture.whenStable();

      const botonImprimir = [...root().querySelectorAll('.page-header__secondary button')].find(
        (boton) => boton.textContent?.includes('Imprimir'),
      );
      (botonImprimir as HTMLButtonElement | undefined)?.click();
      await fixture.whenStable();

      expect(host.elegidas).toEqual(['print']);
    });

    /**
     * jsdom no evalúa media queries: el contrato responsive se verifica sobre
     * el CSS. Colapsable = oculto en la base móvil y visible desde tablet, con
     * el menú haciendo el camino inverso — y todo en `min-width` (§0.1).
     */
    it('el CSS colapsa en móvil y expande desde tablet, solo con min-width', () => {
      const css = readFileSync(PAGE_HEADER_CSS, 'utf8');

      expect(css).not.toContain('max-width:');
      expect(css).toContain('@media (min-width: 780px)');

      const baseColapsable = css.slice(0, css.indexOf('@media'));
      expect(baseColapsable).toMatch(/__secondary--collapsible\s*\{\s*display:\s*none/);
      expect(baseColapsable).toMatch(/__overflow\s*\{\s*display:\s*block/);
    });
  });
});
