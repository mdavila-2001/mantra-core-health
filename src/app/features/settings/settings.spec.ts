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
  /** Lo que tiene el cartel del navegador abierto ahora mismo. */
  const inFlight = signal<PermisoDelNavegador[]>([]);
  const fakePermissions = {
    estado: () => states(),
    enCurso: (permission: PermisoDelNavegador) => inFlight().includes(permission),
    sePuedePedir: (permission: PermisoDelNavegador) => states()[permission] === 'sin-decidir',
    pedir: (permission: PermisoDelNavegador) => {
      requested.push(permission);
      inFlight.update((lista) => [...lista, permission]);
      return Promise.resolve();
    },
    refrescar: () => Promise.resolve(),
  };

  const text = (): string => fixture.nativeElement.textContent as string;
  const query = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const iconsPerRow = (): number[] =>
    [...fixture.nativeElement.querySelectorAll('.ajustes__fila')].map(
      (row) => row.querySelectorAll('app-nav-icon').length,
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
    inFlight.set([]);
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
    // Dos paneles piden datos al montarse: el de avisos sus preferencias, y el
    // de chats el perfil público —del que cuelga la respuesta automática—. Se
    // contesta lo que pida cada uno; lo que esta prueba mira es que el panel de
    // avisos esté, no cuántas lecturas hace la pantalla.
    http
      .match(() => true)
      .forEach((pedido) =>
        pedido.flush(
          pedido.request.url.includes('preferences')
            ? { categories: [], quietHours: null }
            : null,
        ),
      );
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

  it('ofrece el tema como un interruptor que refleja lo que se ve', () => {
    mount();
    goTo('Apariencia');
    theme.setTheme('dark');
    fixture.detectChanges();

    const toggle = query('theme-switch');
    expect(toggle?.getAttribute('role')).toBe('switch');
    expect(toggle?.getAttribute('aria-checked')).toBe('true');

    theme.setTheme('light');
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-checked')).toBe('false');
  });

  it('apretar el interruptor aplica el tema de verdad, no sólo mueve la perilla', () => {
    mount();
    goTo('Apariencia');
    theme.setTheme('light');
    fixture.detectChanges();

    query('theme-switch')?.click();
    fixture.detectChanges();

    expect(theme.currentTheme()).toBe('dark');
  });

  it('siguiendo al dispositivo dice cuál rige y no ofrece volver a él', () => {
    mount();
    goTo('Apariencia');
    theme.useSystemTheme();
    fixture.detectChanges();

    expect(text()).toContain('Sigue a tu dispositivo');
    expect(query('theme-use-system')).toBeNull();
  });

  it('elegido a mano, se puede volver a seguir al dispositivo', () => {
    mount();
    goTo('Apariencia');
    theme.setTheme('dark');
    fixture.detectChanges();

    query('theme-use-system')?.click();
    fixture.detectChanges();

    expect(theme.currentTheme()).toBe('system');
  });

  /** El interruptor nativo que hay dentro del `app-switch` de ese permiso. */
  const toggle = (permission: PermisoDelNavegador): HTMLInputElement => {
    const control = query(`permission-${permission}`)?.querySelector('input[role="switch"]');
    if (control === null || control === undefined) {
      throw new Error(`«${permission}» no ofrece interruptor`);
    }
    return control as HTMLInputElement;
  };

  it('cada permiso del navegador es un interruptor, encendido sólo si está concedido', () => {
    mount();
    goTo('Permisos');

    expect(toggle('avisos').checked).toBe(false);
    expect(toggle('ubicacion').checked).toBe(true);
    expect(toggle('camara').checked).toBe(false);
  });

  it('muestra exactamente un icono en cada permiso del navegador', () => {
    mount();
    goTo('Permisos');

    expect(iconsPerRow()).toEqual([1, 1, 1]);
  });

  it('sólo se puede accionar el interruptor donde el cartel todavía puede aparecer', () => {
    mount();
    goTo('Permisos');

    // Concedido y denegado no se vuelven a pedir: el navegador ignora la
    // petición en silencio, así que un interruptor vivo ahí prometería algo
    // que no pasa. Y ninguna página puede quitarse un permiso a sí misma.
    expect(toggle('avisos').disabled).toBe(false);
    expect(toggle('ubicacion').disabled).toBe(true);
    expect(toggle('camara').disabled).toBe(true);
  });

  it('dice, una sola vez, que los permisos se quitan desde el navegador', () => {
    mount();
    goTo('Permisos');

    expect(text()).toContain('configuración de este sitio en tu navegador');
  });

  it('encender un permiso se lo pide al navegador, no lo da por concedido', () => {
    mount();
    goTo('Permisos');

    toggle('avisos').click();

    expect(requested).toEqual(['avisos']);
  });

  it('si la persona dice que no al cartel, el interruptor vuelve a apagarse', () => {
    mount();
    goTo('Permisos');

    toggle('avisos').click();
    fixture.detectChanges();
    // Con el cartel en pantalla el interruptor se ve encendido...
    expect(toggle('avisos').checked).toBe(true);

    // ...y al cerrarse sin conceder nada, el estado manda: apagado.
    inFlight.set([]);
    fixture.detectChanges();

    expect(toggle('avisos').checked).toBe(false);
  });

  it('el interruptor nombra su permiso: sin rótulo visible propio, queda mudo', () => {
    mount();
    goTo('Permisos');

    expect(toggle('ubicacion').getAttribute('aria-label')).toBe('Ubicación');
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
