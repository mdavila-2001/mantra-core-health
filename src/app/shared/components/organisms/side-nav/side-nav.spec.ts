import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SideNav } from './side-nav';
import type { NavSection } from './side-nav.types';

const SIDE_NAV_CSS = 'src/app/shared/components/organisms/side-nav/side-nav.css';

const SECCIONES: readonly NavSection[] = [
  {
    label: 'Atención',
    items: [
      { label: 'Inicio', route: '/', icon: 'home' },
      { label: 'Pacientes', route: '/pacientes', icon: 'patients', badge: 3 },
      { label: 'Agenda', route: '/schedule', icon: 'calendar' },
    ],
  },
  {
    label: 'Administración',
    items: [{ label: 'Facturación', route: '/billing', icon: 'billing', disabled: true }],
  },
];

/** Destino de prueba: `routerLinkActive` necesita rutas reales para activarse. */
@Component({ template: '' })
class RutaVacia {}

@Component({
  imports: [SideNav],
  template: `
    <div class="hermano">contenido de la aplicación</div>
    <app-side-nav
      [sections]="secciones()"
      [collapsed]="colapsado()"
      [drawer]="esCajon()"
      [open]="abierto()"
      (closeRequested)="cierres.push(1)"
    />
  `,
})
class HostComponent {
  readonly secciones = signal<readonly NavSection[]>(SECCIONES);
  readonly colapsado = signal(false);
  readonly esCajon = signal(false);
  readonly abierto = signal(false);
  readonly cierres: number[] = [];
}

describe('SideNav', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function enlaces(): HTMLAnchorElement[] {
    return [...root().querySelectorAll<HTMLAnchorElement>('a.side-nav__link')];
  }

  async function teclear(key: string, desde?: HTMLElement): Promise<KeyboardEvent> {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (desde ?? root().querySelector('app-side-nav') ?? root()).dispatchEvent(evento);
    await fixture.whenStable();
    return evento;
  }

  async function abrirCajon(): Promise<void> {
    host.esCajon.set(true);
    host.abierto.set(true);
    await fixture.whenStable();
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([
          { path: '', component: RutaVacia },
          { path: 'pacientes', component: RutaVacia },
          { path: 'schedule', component: RutaVacia },
          { path: 'billing', component: RutaVacia },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    // la navegación inicial resuelve la ruta activa que `routerLinkActive` lee
    await TestBed.inject(Router).navigate(['/']);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('estructura', () => {
    it('es un nav nombrado con listas de verdad', () => {
      const nav = root().querySelector('nav');

      expect(nav?.getAttribute('aria-label')).toBe('Navegación principal');
      expect(nav?.querySelectorAll('ul').length).toBe(2);
    });

    it('dibuja un enlace por ítem habilitado', () => {
      expect(enlaces()).toHaveLength(3);
      expect(enlaces()[1].getAttribute('href')).toBe('/pacientes');
    });

    it('el badge de pendientes se nombra en palabras', () => {
      const badge = root().querySelector('app-badge');

      expect(badge?.getAttribute('aria-label')).toBe('3 pendientes en Pacientes');
    });
  });

  describe('destino activo', () => {
    it('marca el activo con aria-current="page"', async () => {
      await fixture.whenStable();

      // eslint-disable-next-line no-console
      const activos = enlaces().filter((link) => link.getAttribute('aria-current') === 'page');
      expect(activos).toHaveLength(1);
      expect(activos[0].getAttribute('href')).toBe('/');
    });
  });

  describe('colapsado a íconos', () => {
    beforeEach(async () => {
      host.colapsado.set(true);
      await fixture.whenStable();
    });

    it('conserva el nombre accesible de cada destino', () => {
      for (const link of enlaces()) {
        expect(link.getAttribute('aria-label')).toBeTruthy();
      }
      expect(enlaces()[1].getAttribute('aria-label')).toBe('Pacientes');
    });

    it('el texto sigue en el DOM: se oculta por CSS, no se borra', () => {
      expect(enlaces()[1].querySelector('.side-nav__label')?.textContent?.trim()).toBe(
        'Pacientes',
      );
    });

    it('no colapsa cuando está en modo cajón', async () => {
      host.esCajon.set(true);
      await fixture.whenStable();

      expect(root().querySelector('app-side-nav')?.classList).not.toContain(
        'side-nav--collapsed',
      );
    });
  });

  describe('ítem deshabilitado', () => {
    it('no es ancla, no recibe foco y se anuncia deshabilitado', () => {
      const deshabilitado = root().querySelector('.side-nav__link.is-disabled');

      expect(deshabilitado?.tagName).toBe('SPAN');
      expect(deshabilitado?.getAttribute('aria-disabled')).toBe('true');
      expect(deshabilitado?.hasAttribute('href')).toBe(false);
    });

    it('la navegación por flechas lo saltea porque no es enlace', async () => {
      enlaces()[2].focus();
      await teclear('ArrowDown', enlaces()[2]);

      // del último habilitado vuelve al primero: el deshabilitado no cuenta
      expect(document.activeElement).toBe(enlaces()[0]);
    });
  });

  describe('teclado', () => {
    it('las flechas recorren los destinos con vuelta', async () => {
      enlaces()[0].focus();
      await teclear('ArrowDown', enlaces()[0]);
      expect(document.activeElement).toBe(enlaces()[1]);

      await teclear('ArrowUp', enlaces()[1]);
      expect(document.activeElement).toBe(enlaces()[0]);

      await teclear('ArrowUp', enlaces()[0]);
      expect(document.activeElement).toBe(enlaces()[2]);
    });

    it('Home y End van a los extremos', async () => {
      enlaces()[1].focus();
      await teclear('End', enlaces()[1]);
      expect(document.activeElement).toBe(enlaces()[2]);

      await teclear('Home', enlaces()[2]);
      expect(document.activeElement).toBe(enlaces()[0]);
    });
  });

  describe('modo cajón', () => {
    it('al abrir, el foco entra al primer destino', async () => {
      await abrirCajon();

      expect(document.activeElement).toBe(enlaces()[0]);
    });

    it('inertiza el resto de la aplicación mientras está abierto', async () => {
      await abrirCajon();
      expect(root().querySelector('.hermano')?.hasAttribute('inert')).toBe(true);

      host.abierto.set(false);
      await fixture.whenStable();
      expect(root().querySelector('.hermano')?.hasAttribute('inert')).toBe(false);
    });

    it('Escape pide cerrar', async () => {
      await abrirCajon();
      const evento = await teclear('Escape');

      expect(host.cierres).toHaveLength(1);
      expect(evento.defaultPrevented).toBe(true);
    });

    it('el click en el velo pide cerrar', async () => {
      await abrirCajon();

      root().querySelector<HTMLElement>('.side-nav__overlay')?.click();
      await fixture.whenStable();

      expect(host.cierres).toHaveLength(1);
    });

    it('elegir un destino cierra el cajón: el contenido nuevo está detrás', async () => {
      await abrirCajon();

      enlaces()[1].click();
      await fixture.whenStable();

      expect(host.cierres).toHaveLength(1);
    });

    it('cerrado no hay velo', async () => {
      host.esCajon.set(true);
      await fixture.whenStable();

      expect(root().querySelector('.side-nav__overlay')).toBeNull();
    });
  });

  describe('mobile-first', () => {
    it('el CSS no usa un solo max-width', () => {
      const css = readFileSync(SIDE_NAV_CSS, 'utf8');

      expect(css).not.toContain('max-width:');
      expect(css).toContain('@media (min-width: 780px)');
    });
  });
});
