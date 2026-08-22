import { Component, PLATFORM_ID, signal, type Provider } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { MAIN_CONTENT_ID, Shell } from './shell';
import { NAV_STORAGE_KEY, ShellService } from './shell-service';
import type { NavSection } from '../side-nav/side-nav.types';

/* Dos vistas para navegar entre ellas. Cada una lleva su propio selector: sin
   eso Angular les genera el mismo id de componente y avisa (NG0912). */
@Component({ selector: 'app-vista-inicio', template: '<p>contenido de la vista</p>' })
class VistaPrueba {}

@Component({ selector: 'app-vista-pacientes', template: '<p>otra vista</p>' })
class OtraVista {}

const SECCIONES: readonly NavSection[] = [
  {
    label: 'Atención',
    items: [
      { label: 'Inicio', route: '/', icon: 'home' },
      { label: 'Pacientes', route: '/pacientes', icon: 'patients' },
    ],
  },
];

@Component({
  imports: [Shell],
  template: `
    <app-shell
      [user]="{ displayName: 'Andrea Peña', roles: ['Médica'] }"
      [sections]="secciones()"
      [drawerMode]="esCajon()"
    />
  `,
})
class HostComponent {
  readonly secciones = signal<readonly NavSection[]>(SECCIONES);
  readonly esCajon = signal(false);
}

/**
 * jsdom corre con origen opaco: `localStorage` no existe como global. Se
 * inyecta uno falso, igual que en el spec del `ThemeService`.
 */
function createFakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('Shell', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let router: Router;
  let storage: Storage;
  let originalStorage: PropertyDescriptor | undefined;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function main(): HTMLElement {
    const element = root().querySelector<HTMLElement>('main');
    if (element === null) {
      throw new Error('el <main> no está en el DOM');
    }
    return element;
  }

  async function configurar(extraProviders: Provider[] = []): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([
          { path: '', component: VistaPrueba, title: 'Inicio · AloVida' },
          { path: 'pacientes', component: OtraVista, title: 'Pacientes · AloVida' },
        ]),
        ...extraProviders,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    router = TestBed.inject(Router);
    await router.navigate(['/']);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    storage = createFakeStorage();
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
    await configurar();
  });

  afterEach(() => {
    fixture?.destroy();
    if (originalStorage) {
      Object.defineProperty(window, 'localStorage', originalStorage);
    } else {
      Reflect.deleteProperty(window, 'localStorage');
    }
  });

  describe('landmarks', () => {
    it('tiene header, nav y main de verdad', () => {
      expect(root().querySelector('header')).not.toBeNull();
      expect(root().querySelector('nav[aria-label="Navegación principal"]')).not.toBeNull();
      expect(main().id).toBe(MAIN_CONTENT_ID);
    });

    it('el router-outlet vive dentro del main', () => {
      expect(main().textContent).toContain('contenido de la vista');
    });
  });

  describe('enlace de salto', () => {
    it('es el primer elemento focusable de la página', () => {
      const focusables = [
        ...root().querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
      ];

      expect(focusables[0].classList.contains('shell__skip-link')).toBe(true);
      expect(focusables[0].textContent?.trim()).toBe('Saltar al contenido');
    });

    it('apunta al contenido principal', () => {
      const salto = root().querySelector<HTMLAnchorElement>('.shell__skip-link');

      expect(salto?.getAttribute('href')).toBe(`#${MAIN_CONTENT_ID}`);
    });

    it('mueve el foco al main, no solo el scroll', () => {
      root().querySelector<HTMLAnchorElement>('.shell__skip-link')?.click();

      expect(document.activeElement).toBe(main());
    });
  });

  describe('navegación', () => {
    it('anuncia el título de la vista nueva', async () => {
      await router.navigate(['/pacientes']);
      await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
      await fixture.whenStable();

      const region = root().querySelector('output[aria-live="polite"]');
      expect(region?.textContent?.trim()).toBe('Pacientes · AloVida');
    });

    it('el foco vuelve al main tras navegar', async () => {
      // el foco arranca en cualquier otro lado
      root().querySelector<HTMLElement>('.shell__skip-link')?.focus();

      await router.navigate(['/pacientes']);
      await fixture.whenStable();

      expect(document.activeElement).toBe(main());
    });

    it('el main es enfocable por script pero no por Tab', () => {
      expect(main().getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('cajón en móvil', () => {
    it('el botón de menú aparece solo en modo cajón', async () => {
      expect(root().querySelector('.app-header__menu-button')).toBeNull();

      host.esCajon.set(true);
      await fixture.whenStable();
      expect(root().querySelector('.app-header__menu-button')).not.toBeNull();
    });

    it('el botón abre y cierra el cajón', async () => {
      host.esCajon.set(true);
      await fixture.whenStable();

      const boton = root().querySelector<HTMLButtonElement>('.app-header__menu-button');
      boton?.click();
      await fixture.whenStable();
      expect(TestBed.inject(ShellService).isDrawerOpen()).toBe(true);

      boton?.click();
      await fixture.whenStable();
      expect(TestBed.inject(ShellService).isDrawerOpen()).toBe(false);
    });

    it('navegar cierra el cajón: la vista de atrás ya cambió', async () => {
      host.esCajon.set(true);
      await fixture.whenStable();
      TestBed.inject(ShellService).openDrawer();
      await fixture.whenStable();

      await router.navigate(['/pacientes']);
      await fixture.whenStable();

      expect(TestBed.inject(ShellService).isDrawerOpen()).toBe(false);
    });
  });

  describe('preferencia del nav (ShellService)', () => {
    it('arranca en el default sin leer storage', () => {
      expect(TestBed.inject(ShellService).isCollapsed()).toBe(false);
    });

    it('alterna y persiste tras el render', async () => {
      const service = TestBed.inject(ShellService);
      service.toggleCollapsed();
      await fixture.whenStable();

      expect(service.isCollapsed()).toBe(true);
      expect(storage.getItem(NAV_STORAGE_KEY)).toBe('true');
    });

    it('en el servidor no toca storage y se queda en el default', async () => {
      TestBed.resetTestingModule();
      storage.setItem(NAV_STORAGE_KEY, 'true');
      await configurar([{ provide: PLATFORM_ID, useValue: 'server' }]);

      const service = TestBed.inject(ShellService);
      expect(service.isCollapsed()).toBe(false);

      service.toggleCollapsed();
      await fixture.whenStable();
      // la escritura tampoco ocurre: el valor guardado sigue siendo el previo
      expect(storage.getItem(NAV_STORAGE_KEY)).toBe('true');
    });
  });
});
