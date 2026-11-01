import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { BreadcrumbItem } from '../../molecules/breadcrumb/breadcrumb.types';
import {
  PAGE_HEADER_MIGAS_EN_EL_MARCO,
  PAGE_HEADER_PREDETERMINADOS,
  PageHeader,
  type PageHeaderAction,
} from './page-header';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

const PAGE_HEADER_CSS = 'src/app/shared/components/organisms/page-header/page-header.css';

@Component({
  imports: [PageHeader],
  template: `
    <app-page-header
      [title]="title()"
      [subtitle]="subtitle()"
      [breadcrumbs]="breadcrumbs()"
      [icon]="icono()"
      [eyebrow]="eyebrow()"
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
  readonly icono = signal<NavIconName | null>(null);
  readonly eyebrow = signal('');
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

  describe('icono y eyebrow', () => {
    it('sin icono ni eyebrow ni marco que los proponga, la cabecera queda como siempre', () => {
      expect(root().querySelector('.page-header__icono')).toBeNull();
      expect(root().querySelector('.page-header__eyebrow')).toBeNull();
    });

    it('con icono dibuja la loseta (decorativa) y con eyebrow la línea sobre el título', async () => {
      host.icono.set('shield');
      host.eyebrow.set('Gobierno y acceso');
      await fixture.whenStable();

      const loseta = root().querySelector('.page-header__icono');
      expect(loseta?.getAttribute('aria-hidden')).toBe('true');
      expect(loseta?.querySelector('app-nav-icon')).not.toBeNull();
      expect(root().querySelector('.page-header__eyebrow')?.textContent?.trim()).toBe('Gobierno y acceso');
      // el eyebrow va ANTES del h1, y sigue habiendo un solo h1
      const textos = root().querySelector('.page-header__textos');
      expect(textos?.firstElementChild?.classList).toContain('page-header__eyebrow');
      expect(root().querySelectorAll('h1')).toHaveLength(1);
    });

    it('dentro de un marco que los propone, los toma sin que la pantalla diga nada', async () => {
      const iconoMarco = signal<NavIconName | null>('key');
      const eyebrowMarco = signal('Gobierno y acceso');
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [
          provideRouter([]),
          { provide: PAGE_HEADER_PREDETERMINADOS, useValue: { icon: iconoMarco, eyebrow: eyebrowMarco } },
        ],
      }).compileComponents();
      fixture = TestBed.createComponent(HostComponent);
      host = fixture.componentInstance;
      await fixture.whenStable();

      expect(root().querySelector('.page-header__icono app-nav-icon')).not.toBeNull();
      expect(root().querySelector('.page-header__eyebrow')?.textContent?.trim()).toBe('Gobierno y acceso');

      // al navegar el marco cambia sus señales y la cabecera las sigue
      eyebrowMarco.set('Calidad de datos clínicos');
      await fixture.whenStable();
      expect(root().querySelector('.page-header__eyebrow')?.textContent?.trim()).toBe(
        'Calidad de datos clínicos',
      );

      // lo que la pantalla dice manda sobre lo que el marco propone
      host.eyebrow.set('Propio');
      await fixture.whenStable();
      expect(root().querySelector('.page-header__eyebrow')?.textContent?.trim()).toBe('Propio');
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

    it('dentro de un marco que ya pinta las migas, no repite las suyas', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [provideRouter([]), { provide: PAGE_HEADER_MIGAS_EN_EL_MARCO, useValue: true }],
      }).compileComponents();
      fixture = TestBed.createComponent(HostComponent);
      host = fixture.componentInstance;
      host.breadcrumbs.set([{ label: 'Panel', routerLink: '/' }, { label: 'Portal' }]);
      await fixture.whenStable();

      expect(root().querySelector('app-breadcrumb')).toBeNull();
      // El título no se pierde: sólo las migas.
      expect(root().querySelectorAll('h1')).toHaveLength(1);
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

    /**
     * Notificaciones, 2026-10-29: con un subtítulo largo las acciones se
     * apilaban una sobre otra y medían 40 y 32 px. Contrato: 44 px táctiles
     * para todo botón del membrete (por el gancho del átomo), y desde tablet
     * una fila que no encoge, centrada en alto con el título y pegada a la
     * derecha.
     */
    it('el CSS da 44 px a los botones y, desde tablet, una fila a la derecha', () => {
      const css = readFileSync(PAGE_HEADER_CSS, 'utf8');
      const base = css.slice(0, css.indexOf('@media'));
      const tablet = css.slice(css.indexOf('@media (min-width: 780px)'));

      expect(base).toMatch(/\.page-header__actions\s*\{[^}]*--btn-min-block:\s*44px/);
      expect(base).toMatch(/\.page-header__actions:empty\s*\{\s*display:\s*none/);
      expect(tablet).toMatch(/\.page-header__row\s*\{[^}]*align-items:\s*center/);
      expect(tablet).toMatch(/\.page-header__actions\s*\{[^}]*justify-content:\s*flex-end/);
      expect(tablet).toMatch(/\.page-header__actions\s*\{[^}]*--btn-flex:\s*0 0 auto/);
    });
  });
});
