import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { MyProfile } from './my-profile';

/** base64url **sobre UTF-8**, como el token real. */
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

/**
 * **Mi cuenta** (`/my-account`) — la cáscara de dos pestañas.
 *
 * Este componente ya no pide nada: las lecturas del perfil se fueron a
 * `app-profile-settings` y las de los artículos siempre estuvieron en
 * `app-medical-articles`. Lo que queda por fijar acá es lo que el componente sí
 * decide:
 *
 * 1. **Las dos pestañas**, con esos nombres y en ese orden.
 * 2. **Que sólo se monte la pestaña activa** — el panel inactivo no existe en el
 *    DOM, y de eso depende que entrar a la cuenta no dispare las consultas de
 *    las dos a la vez.
 * 3. **La franja «Tu acceso»**: a quién se le muestra y cómo nombra los roles.
 *
 * La vitrina (`/community/profiles/me`) se responde en cada prueba porque la
 * pestaña que arranca abierta es la de artículos y ésa sí lee.
 */
describe('MyProfile', () => {
  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => http.verify());

  /**
   * Monta la pantalla con la sesión ya abierta.
   *
   * El orden importa: `esProfesional()` y los roles salen de señales del token,
   * y la franja de acceso se dibuja en el primer `detectChanges`.
   */
  function montar(payload: Record<string, unknown>): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', tenants: ['t-1'], ...payload }),
      refreshToken: 'r-1',
    });

    fixture = TestBed.createComponent(MyProfile);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // La pestaña abierta es «Mis Artículos»: sin vitrina no pide nada más.
    http.expectOne('/community/profiles/me').flush(null as never);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function pestanas(): string[] {
    return [...raiz().querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim() ?? '');
  }

  it('la cuenta es una sola página con dos pestañas', () => {
    montar({ roles: ['USER', 'PRACTITIONER'], hpid: 'hp-1' });

    expect(pestanas()).toEqual(['Mis Artículos', 'Configurar mi Perfil']);
  });

  /**
   * El panel inactivo **no se renderiza** (`app-tab` lo resuelve con un `@if`).
   * Sin eso, abrir la cuenta dispararía a la vez las consultas de los artículos
   * y las del perfil, y la mitad se tiraría a la basura.
   */
  it('sólo monta la pestaña abierta: la otra no pide nada', () => {
    montar({ roles: ['USER', 'PRACTITIONER'], hpid: 'hp-1' });

    expect(raiz().querySelector('app-medical-articles')).not.toBeNull();
    expect(raiz().querySelector('app-profile-settings')).toBeNull();
    // El perfil no se pidió: es de la otra pestaña.
    http.expectNone('/profiles/practitioners/me/summary');
  });

  /**
   * Los artículos van embebidos: la cabecera es la de la página, y repetirla
   * dentro de la pestaña dibujaría dos títulos y dos migas de pan seguidos.
   */
  it('la pestaña de artículos no repite la cabecera de la página', () => {
    montar({ roles: ['USER', 'PRACTITIONER'], hpid: 'hp-1' });

    expect(raiz().querySelectorAll('app-page-header').length).toBe(1);
  });

  it('«Tu acceso» nombra el rol en palabras, con el código sólo en data-role', () => {
    // Con un rol de trabajo, porque desde F-22 la franja no se le muestra a un
    // paciente.
    montar({ roles: ['USER', 'PRACTITIONER'] });

    const insignias = [...raiz().querySelectorAll('.cuenta__acceso-roles app-badge')];
    expect(insignias.map((i) => i.textContent?.trim())).toEqual(['Profesional sanitario']);
    expect(insignias.map((i) => i.getAttribute('data-role'))).toEqual(['PRACTITIONER']);
  });

  /**
   * F-22. «Organización: Care Default Tenant» y «Roles: Paciente» responden a
   * «¿por qué no veo tal cosa?», una pregunta de quien trabaja acá. Un paciente
   * no tiene secciones que le falten: tiene lo suyo.
   */
  it('a un paciente no se le muestra «Tu acceso» ni su organización', () => {
    montar({ roles: ['USER', 'PATIENT'], tenantNames: { 't-1': 'Care Default Tenant' } });

    expect(raiz().querySelector('[data-testid="mi-perfil-acceso"]')).toBeNull();
    expect(raiz().textContent).not.toContain('Tu acceso');
    expect(raiz().textContent).not.toContain('Care Default Tenant');
    expect(raiz().textContent).not.toContain('Organización');
  });

  /** Quien atiende y además es paciente entra a trabajar: la franja le sirve. */
  it('a quien atiende sí se le muestra, aunque además sea paciente', () => {
    montar({ roles: ['PATIENT', 'PRACTITIONER'] });

    expect(raiz().querySelector('[data-testid="mi-perfil-acceso"]')).not.toBeNull();
  });

  /**
   * El perfil profesional completo vive dentro de la segunda pestaña, no como
   * un bloque suelto de la página: era el reclamo del cliente —tarjetas sueltas
   * en una página que se sentía vacía— y es lo que este carril vino a corregir.
   */
  it('el perfil profesional aparece recién al abrir «Configurar mi Perfil»', () => {
    montar({ roles: ['USER', 'PRACTITIONER'], hpid: 'hp-1' });
    expect(raiz().querySelector('app-practitioner-profile')).toBeNull();

    (fixture.componentInstance as unknown as { pestana: { set: (i: number) => void } }).pestana.set(
      1,
    );
    fixture.detectChanges();

    expect(raiz().querySelector('app-profile-settings')).not.toBeNull();
    expect(raiz().querySelector('app-practitioner-profile')).not.toBeNull();

    // Las lecturas de la pestaña recién abierta. Se responden para que el
    // `verify()` del cierre no las cuente como pendientes.
    //
    // Van con `match` y no con `expectOne` porque el resumen profesional lo
    // piden DOS componentes de esta pestaña —`app-profile-settings`, para el
    // formulario, y `app-practitioner-profile`, para la trayectoria— y esta
    // prueba no es sobre eso: es sobre qué se monta y cuándo.
    http.match('/identity/me/verification-cases').forEach((r) => r.flush([]));
    http
      .match('/profiles/practitioners/me/summary')
      .forEach((r) => r.error(new ProgressEvent('error'), { status: 500 }));
    // La tabla del historial laboral del SLOT también lee al montarse.
    http.match('/profiles/practitioners/me/affiliations').forEach((r) =>
      r.flush({ items: [], count: 0 }),
    );
    http
      .match((r) => r.url === '/terminology/concepts')
      .forEach((r) => r.flush({ items: [], count: 0, limit: 50 }));
  });
});
