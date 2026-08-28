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
  const estados = signal<Record<PermisoDelNavegador, EstadoPermiso>>({
    avisos: 'sin-decidir',
    ubicacion: 'concedido',
    camara: 'denegado',
  });
  const pedidos: PermisoDelNavegador[] = [];
  const permisosFalsos = {
    estado: () => estados(),
    enCurso: () => false,
    sePuedePedir: (permiso: PermisoDelNavegador) => estados()[permiso] === 'sin-decidir',
    pedir: (permiso: PermisoDelNavegador) => {
      pedidos.push(permiso);
      return Promise.resolve();
    },
    refrescar: () => Promise.resolve(),
  };

  const texto = (): string => fixture.nativeElement.textContent as string;
  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  /**
   * Cambia de sección haciendo lo que haría una persona: apretar la pestaña.
   *
   * No se manipula `selectedIndex` desde afuera a propósito. El panel inactivo
   * **no existe en el DOM** —lo decide `app-tab`—, así que una prueba que
   * mirara el panel sin abrirlo estaría comprobando algo que nadie ve.
   */
  function irA(seccion: string): void {
    const pestana = [...fixture.nativeElement.querySelectorAll('[role="tab"]')].find(
      (boton) => (boton as HTMLElement).textContent?.trim() === seccion,
    ) as HTMLButtonElement | undefined;
    if (pestana === undefined) {
      throw new Error(`Ajustes no ofrece la sección «${seccion}»`);
    }
    pestana.click();
    fixture.detectChanges();
  }

  function montar(roles: readonly string[] = []): void {
    fixture = TestBed.createComponent(Settings);
    session = TestBed.inject(SessionStore);
    theme = TestBed.inject(ThemeService);
    if (roles.length > 0) {
      session.start({ accessToken: jwt({ sub: 'u-1', roles, tenants: ['t-1'] }), refreshToken: 'r' });
    }
    fixture.detectChanges();
  }

  beforeEach(() => {
    pedidos.length = 0;
    estados.set({ avisos: 'sin-decidir', ubicacion: 'concedido', camara: 'denegado' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
        { provide: BrowserPermissionsService, useValue: permisosFalsos },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // El panel de avisos pide sus preferencias al montarse: se le contesta y se
    // verifica que nadie más haya llamado a la red.
    http
      .match(() => true)
      .forEach((pedido) => pedido.flush({ categories: [], quietHours: null }));
    http.verify();
  });

  it('monta el panel de avisos: dejó de ser una pantalla y no dejó de existir', () => {
    montar();
    // El panel pide sus preferencias al montarse; hasta que contestan dice
    // «cargando», que es lo correcto y no lo que esta prueba mira.
    http.expectOne(() => true).flush({ categories: [], quietHours: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-notification-preferences')).not.toBeNull();
    expect(texto()).toContain('Qué avisos recibís');
  });

  it('el único h1 es el de Ajustes: el panel de avisos bajó a h2', () => {
    montar();

    const encabezados = [...fixture.nativeElement.querySelectorAll('h1')] as HTMLElement[];

    expect(encabezados).toHaveLength(1);
    expect(encabezados[0].textContent).toContain('Ajustes');
  });

  it('ofrece los tres temas, con el elegido marcado', () => {
    montar();
    irA('Apariencia');
    theme.setTheme('dark');
    fixture.detectChanges();

    expect((consultar('tema-dark') as HTMLInputElement).checked).toBe(true);
    expect((consultar('tema-light') as HTMLInputElement).checked).toBe(false);
  });

  it('elegir un tema lo aplica de verdad, no sólo marca el control', () => {
    montar();
    irA('Apariencia');

    (consultar('tema-light') as HTMLInputElement).dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(theme.currentTheme()).toBe('light');
  });

  it('con «el de mi dispositivo» dice cuál rige: elegido y pintado no son lo mismo', () => {
    montar();
    irA('Apariencia');
    theme.useSystemTheme();
    fixture.detectChanges();

    expect(consultar('tema-resuelto')?.textContent).toContain('modo');
  });

  it('cuenta el estado de cada permiso del navegador en palabras', () => {
    montar();
    irA('Permisos');

    expect(consultar('permiso-avisos')?.textContent).toContain('Sin decidir');
    expect(consultar('permiso-ubicacion')?.textContent).toContain('Permitido');
    expect(consultar('permiso-camara')?.textContent).toContain('Bloqueado');
  });

  it('sólo ofrece «Permitir» donde el cartel todavía puede aparecer', () => {
    montar();
    irA('Permisos');

    // Concedido y denegado no se vuelven a pedir: el navegador ignora la
    // petición en silencio, así que el botón prometería algo que no pasa.
    expect(consultar('pedir-avisos')).not.toBeNull();
    expect(consultar('pedir-ubicacion')).toBeNull();
    expect(consultar('pedir-camara')).toBeNull();
  });

  it('un permiso bloqueado explica que se recupera desde el navegador', () => {
    montar();
    irA('Permisos');

    expect(texto()).toContain('configuración de este sitio en tu navegador');
  });

  it('pedir un permiso se lo pide al navegador, no lo da por concedido', () => {
    montar();
    irA('Permisos');

    (consultar('pedir-avisos') as HTMLButtonElement).click();

    expect(pedidos).toEqual(['avisos']);
  });

  it('nombra los roles de la sesión en palabras, no con el código del token', () => {
    montar(['CLINICIAN']);
    irA('Permisos');

    expect(consultar('ajustes-roles')?.textContent).not.toContain('CLINICIAN');
    expect(consultar('ajustes-roles')?.textContent?.trim()).not.toBe('');
  });

  it('no promete una lista de quién ve tus datos: la API no se la responde a la persona', () => {
    montar(['PATIENT']);
    irA('Permisos');

    // Lo que hay es la explicación, no una lista vacía —que se leería como
    // «nadie tiene acceso»— ni un enlace a una pantalla que le daría 403.
    expect(consultar('ajustes-accesos-nota')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/administration/delegated-access"]')).toBeNull();
  });

  it('a quien administra la seguridad sí le ofrece dónde hacerlo', () => {
    montar(['SECURITY_ADMIN']);
    irA('Permisos');

    expect(
      fixture.nativeElement.querySelector('a[href="/administration/delegated-access"]'),
    ).not.toBeNull();
  });

  it('el comodín vale acá lo mismo que en el menú y en el guard', () => {
    montar(['SUPERADMIN']);
    irA('Permisos');

    expect(
      fixture.nativeElement.querySelector('a[href="/administration/delegated-access"]'),
    ).not.toBeNull();
  });
});
