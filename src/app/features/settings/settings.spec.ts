import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { SessionStore } from '../../core/auth/session.store';
import {
  BrowserPermissionsService,
  type EstadoPermiso,
  type PermisoDelNavegador,
} from '../../core/permissions/browser-permissions.service';
import { ThemeService } from '../../core/tokens/theme.service';
import { Settings } from './settings';

/**
 * Lo que estas pruebas fijan.
 *
 * Que Ajustes **junta** lo que estaba repartido —los avisos que ocupaban un
 * renglón del menú, el tema que era un botón suelto del encabezado y los
 * permisos del navegador, que no se podían ni mirar—; que el enlace a la
 * administración de permisos delegados **sólo aparece para quien la administra**
 * (con la regla del comodín, no con una comparación propia); y sobre todo que
 * la pantalla **no inventa una lista de quién ve tus datos**: la API no se la
 * responde a la propia persona, y una lista vacía se leería como «nadie tiene
 * acceso».
 */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;
  let http: HttpTestingController;
  let session: SessionStore;
  let theme: ThemeService;

  /** Doble del servicio de permisos: en jsdom no hay cartel que aceptar. */
  const states = signal<Record<PermisoDelNavegador, EstadoPermiso>>({
    avisos: 'sin-decidir',
    ubicacion: 'concedido',
    camara: 'denegado',
  });
  const requested: PermisoDelNavegador[] = [];
  const fakePermissions = {
    estado: () => states(),
    enCurso: () => false,
    sePuedePedir: (permission: PermisoDelNavegador) => states()[permission] === 'sin-decidir',
    pedir: (permission: PermisoDelNavegador) => {
      requested.push(permission);
      return Promise.resolve();
    },
    refrescar: () => Promise.resolve(),
  };

  const text = (): string => fixture.nativeElement.textContent as string;
  const query = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const iconosPorRenglon = (): number[] =>
    [...fixture.nativeElement.querySelectorAll('.ajustes__fila')].map(
      (fila) => fila.querySelectorAll('app-nav-icon').length,
    );

  /**
   * Cambia de sección haciendo lo que haría una persona: apretar la pestaña.
   *
   * No se manipula `selectedIndex` desde afuera a propósito. El panel inactivo
   * **no existe en el DOM** —lo decide `app-tab`—, así que una prueba que
   * mirara el panel sin abrirlo estaría comprobando algo que nadie ve.
   */
  function goTo(section: string): void {
    const tab = [...fixture.nativeElement.querySelectorAll('[role="tab"]')].find(
      (button) => (button as HTMLElement).textContent?.trim() === section,
    ) as HTMLButtonElement | undefined;
    if (tab === undefined) {
      throw new Error(`Ajustes no ofrece la sección «${section}»`);
    }
    tab.click();
    fixture.detectChanges();
  }

  function mount(roles: readonly string[] = []): void {
    fixture = TestBed.createComponent(Settings);
    session = TestBed.inject(SessionStore);
    theme = TestBed.inject(ThemeService);
    if (roles.length > 0) {
      session.start({ accessToken: jwt({ sub: 'u-1', roles, tenants: ['t-1'] }), refreshToken: 'r' });
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    requested.length = 0;
    states.set({ avisos: 'sin-decidir', ubicacion: 'concedido', camara: 'denegado' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
        { provide: BrowserPermissionsService, useValue: fakePermissions },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // El panel de avisos pide sus preferencias al montarse: se le contesta y se
    // verifica que nadie más haya llamado a la red.
    http
      .match(() => true)
      .forEach((request) => request.flush({ categories: [], quietHours: null }));
    http.verify();
  });

  it('monta el panel de avisos: dejó de ser una pantalla y no dejó de existir', () => {
    mount();
    // El panel pide sus preferencias al montarse; hasta que contestan dice
    // «cargando», que es lo correcto y no lo que esta prueba mira.
    http.expectOne(() => true).flush({ categories: [], quietHours: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-notification-preferences')).not.toBeNull();
    expect(text()).toContain('Qué avisos recibís');
  });

  it('el único h1 es el de Ajustes: el panel de avisos bajó a h2', () => {
    mount();

    const headings = [...fixture.nativeElement.querySelectorAll('h1')] as HTMLElement[];

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain('Ajustes');
  });

  it('ofrece los tres temas, con el elegido marcado', () => {
    mount();
    goTo('Apariencia');
    theme.setTheme('dark');
    fixture.detectChanges();

    expect((query('theme-dark') as HTMLInputElement).checked).toBe(true);
    expect((query('theme-light') as HTMLInputElement).checked).toBe(false);
  });

  it('conserva un icono en cada opción de apariencia', () => {
    mount();
    goTo('Apariencia');

    expect(iconosPorRenglon()).toEqual([1, 1, 1]);
  });

  it('elegir un tema lo aplica de verdad, no sólo marca el control', () => {
    mount();
    goTo('Apariencia');

    (query('theme-light') as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(theme.currentTheme()).toBe('light');
  });

  it('con «el de mi dispositivo» dice cuál rige: elegido y pintado no son lo mismo', () => {
    mount();
    goTo('Apariencia');
    theme.useSystemTheme();
    fixture.detectChanges();

    expect(query('theme-resolved')?.textContent).toContain('modo');
  });

  it('cuenta el estado de cada permiso del navegador en palabras', () => {
    mount();
    goTo('Permisos');

    expect(query('permission-avisos')?.textContent).toContain('Sin decidir');
    expect(query('permission-ubicacion')?.textContent).toContain('Permitido');
    expect(query('permission-camara')?.textContent).toContain('Bloqueado');
  });

  it('muestra exactamente un icono en cada permiso del navegador', () => {
    mount();
    goTo('Permisos');

    expect(iconosPorRenglon()).toEqual([1, 1, 1]);
  });

  it('sólo ofrece «Permitir» donde el cartel todavía puede aparecer', () => {
    mount();
    goTo('Permisos');

    // Concedido y denegado no se vuelven a pedir: el navegador ignora la
    // petición en silencio, así que el botón prometería algo que no pasa.
    expect(query('request-avisos')).not.toBeNull();
    expect(query('request-ubicacion')).toBeNull();
    expect(query('request-camara')).toBeNull();
  });

  it('un permiso bloqueado explica que se recupera desde el navegador', () => {
    mount();
    goTo('Permisos');

    expect(text()).toContain('configuración de este sitio en tu navegador');
  });

  it('pedir un permiso se lo pide al navegador, no lo da por concedido', () => {
    mount();
    goTo('Permisos');

    (query('request-avisos') as HTMLButtonElement).click();

    expect(requested).toEqual(['avisos']);
  });

  it('nombra los roles de la sesión en palabras, no con el código del token', () => {
    mount(['CLINICIAN']);
    goTo('Permisos');

    expect(query('settings-roles')?.textContent).not.toContain('CLINICIAN');
    expect(query('settings-roles')?.textContent?.trim()).not.toBe('');
  });

  it('no promete una lista de quién ve tus datos: la API no se la responde a la persona', () => {
    mount(['PATIENT']);
    goTo('Permisos');

    // Lo que hay es la explicación, no una lista vacía —que se leería como
    // «nadie tiene acceso»— ni un enlace a una pantalla que le daría 403.
    expect(query('settings-access-note')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/administration/delegated-access"]')).toBeNull();
  });

  it('a quien administra la seguridad sí le ofrece dónde hacerlo', () => {
    mount(['SECURITY_ADMIN']);
    goTo('Permisos');

    expect(
      fixture.nativeElement.querySelector('a[href="/administration/delegated-access"]'),
    ).not.toBeNull();
  });

  it('el comodín vale acá lo mismo que en el menú y en el guard', () => {
    mount(['SUPERADMIN']);
    goTo('Permisos');

    expect(
      fixture.nativeElement.querySelector('a[href="/administration/delegated-access"]'),
    ).not.toBeNull();
  });
});
