import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { seccionRolesGuard, SECCION_DENEGADA_ROUTE } from './section-roles.guard';

function token(roles: readonly string[]): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: 'u-1',
    sid: 's-1',
    roles,
    tenants: ['t-1'],
  })}.firma`;
}

const RUTA = {} as ActivatedRouteSnapshot;

/**
 * El guard sólo mira `state.url`: es lo que le permite resolver la sección por
 * prefijo, igual que hace el breadcrumb.
 */
const estadoDe = (url: string): RouterStateSnapshot => ({ url }) as RouterStateSnapshot;

/**
 * Carril 02 — que el menú esconda una sección no la protege.
 *
 * Todo lo que se fija acá es la mitad que faltaba de la corrección #2: la Guía
 * de profesionales no debe **aparecer** ni ser **accesible** para quien no es
 * paciente, y sin guard sólo se cumplía lo primero.
 */
describe('seccionRolesGuard', () => {
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  function ejecutar(url: string, roles: readonly string[]): boolean | UrlTree {
    session.start({ accessToken: token(roles), refreshToken: 'r-1' });
    return TestBed.runInInjectionContext(
      () => seccionRolesGuard(RUTA, estadoDe(url)),
    ) as boolean | UrlTree;
  }

  function destino(resultado: boolean | UrlTree): string {
    return resultado instanceof UrlTree ? router.serializeUrl(resultado) : 'pasó';
  }

  /* -- la Guía de profesionales -------------------------------------------- */

  it('el paciente entra a la Guía', () => {
    expect(ejecutar('/directory', ['USER', 'PATIENT'])).toBe(true);
  });

  it('la doctora escribiendo la dirección a mano no entra', () => {
    // Es el caso que el filtrado del menú no cubría: el enlace guardado, el
    // correo con la dirección, el historial del navegador.
    expect(destino(ejecutar('/directory', ['USER', 'PRACTITIONER', 'CLINICIAN']))).toBe(
      SECCION_DENEGADA_ROUTE,
    );
  });

  it('la ficha de un profesional tampoco: es parte de la Guía', () => {
    expect(destino(ejecutar('/directory/abc-123', ['PRACTITIONER']))).toBe(
      SECCION_DENEGADA_ROUTE,
    );
  });

  it('rebota al panel y no al login: la sesión es válida, el rol no alcanza', () => {
    // Mandarla al login diría «volvé a entrar» sobre una cuenta que ya está
    // dentro; quien lo intente vuelve a chocar contra lo mismo.
    expect(destino(ejecutar('/directory', ['SECURITY_ADMIN']))).toBe('/dashboard');
  });

  /* -- el resto del registro ----------------------------------------------- */

  it('una sección sin roles la abre cualquier sesión', () => {
    expect(ejecutar('/glossary', [])).toBe(true);
    expect(ejecutar('/my-account', ['PATIENT'])).toBe(true);
  });

  it('la agenda pide rol de agenda', () => {
    expect(ejecutar('/schedule', ['PRACTITIONER'])).toBe(true);
    expect(destino(ejecutar('/schedule', ['PATIENT']))).toBe(SECCION_DENEGADA_ROUTE);
  });

  it('el archivo clínico no lo abre un paciente', () => {
    expect(destino(ejecutar('/medical-records', ['PATIENT']))).toBe(SECCION_DENEGADA_ROUTE);
    expect(ejecutar('/medical-records', ['CLINICIAN'])).toBe(true);
  });

  it('SUPERADMIN pasa: es el comodín del backend, no una excepción de acá', () => {
    // `RolesGuard` de la API corta con `if (roles.includes('SUPERADMIN'))` antes
    // de mirar los `@Roles(...)`. Si el guard no lo respetara, el menú ofrecería
    // secciones que rebotan — que es peor que no ofrecerlas.
    expect(ejecutar('/schedule', ['SUPERADMIN'])).toBe(true);
    expect(ejecutar('/medical-records', ['SUPERADMIN'])).toBe(true);
  });

  it('salvo en la Guía, que declara sus roles excluyentes', () => {
    // El guard no tiene un caso especial para esto: pregunta por `isVisibleTo`,
    // igual que el menú, y la excepción vive en el registro. Es lo que impide
    // que los dos lados se desacuerden.
    expect(destino(ejecutar('/directory', ['SUPERADMIN']))).toBe(SECCION_DENEGADA_ROUTE);
  });

  /* -- las pantallas de operación, hijas de una sección con roles ---------- */

  it('una pantalla de operación hereda el rol de su sección', () => {
    // El defecto que cierra el carril C-E: la sección rebotaba al paciente y su
    // formulario lo dejaba pasar. Colgado de la hija, el guard resuelve la
    // misma sección por prefijo y aplica los mismos roles.
    expect(destino(ejecutar('/administration/geolocation/trips/new', ['PATIENT']))).toBe(
      SECCION_DENEGADA_ROUTE,
    );
    expect(destino(ejecutar('/administration/patients/new', ['PATIENT', 'USER']))).toBe(
      SECCION_DENEGADA_ROUTE,
    );
  });

  it('y la abre quien tiene el rol de la sección', () => {
    expect(ejecutar('/administration/geolocation/trips/new', ['SECURITY_ADMIN'])).toBe(true);
    expect(ejecutar('/administration/patients/new', ['SECURITY_ADMIN'])).toBe(true);
    expect(ejecutar('/schedule/new', ['PRACTITIONER'])).toBe(true);
  });

  /* -- resolución de la sección -------------------------------------------- */

  it('resuelve por la coincidencia más larga, no por la primera', () => {
    // `/my-account/appointments` es «Mis turnos», no «Mi perfil» — aunque
    // `my-account` también sea prefijo suyo. Si ganara el prefijo corto, una
    // sección con roles propios heredaría los del padre en silencio.
    expect(ejecutar('/my-account/appointments', ['PATIENT'])).toBe(true);
  });

  it('una URL que no pertenece a ninguna sección pasa de largo', () => {
    // El guard no es una lista de permitidos del router: lo que no está en el
    // registro no es asunto suyo.
    expect(ejecutar('/design-system', [])).toBe(true);
    expect(ejecutar('/no-existe', [])).toBe(true);
  });

  it('los parámetros de consulta no confunden la resolución', () => {
    expect(destino(ejecutar('/directory?especialidad=cardiologia', ['PRACTITIONER']))).toBe(
      SECCION_DENEGADA_ROUTE,
    );
  });
});
