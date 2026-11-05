import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IdleLogout, IDLE_TIMEOUT_MS, IDLE_WARNING_MS, idleTimeoutFor } from './idle-logout';
import { SessionStore } from './session.store';

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

const TOKEN = jwt({ sub: 'u-1', roles: [], tenants: ['t-1'] });

/**
 * En un dispositivo compartido —una recepción, un consultorio, una tablet de
 * planta— la sesión duraba lo que durara el refresh token. Quien se iba sin
 * cerrarla dejaba la siguiente historia clínica al alcance de quien se sentara
 * después.
 */
describe('IdleLogout', () => {
  let idle: IdleLogout;
  let session: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    session = TestBed.inject(SessionStore);
    idle = TestBed.inject(IdleLogout);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function abrirSesion() {
    session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
    TestBed.tick();
  }

  it('sin sesión no arranca ningún reloj', () => {
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2);

    // Si hubiera cerrado sesión habría intentado avisar al servidor.
    http.expectNone(() => true);
    expect(idle.warning()).toBe(false);
  });

  it('avisa antes de cerrar, para no perder lo que se está escribiendo', () => {
    abrirSesion();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS);

    expect(idle.warning()).toBe(true);
    // Todavía no cerró: el aviso llega antes, no en el mismo momento.
    http.expectNone(() => true);
  });

  it('cierra la sesión al vencer el plazo', () => {
    abrirSesion();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS);

    // `logout()` avisa al servidor; que la petición falle o no es indiferente,
    // porque limpia local pase lo que pase.
    http.expectOne((request) => request.url.endsWith('/iam/auth/logout')).flush({});
  });

  it('cualquier actividad reinicia la cuenta', () => {
    abrirSesion();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);
    idle.reiniciar();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1000);

    // Han pasado casi dos plazos, pero ninguno entero desde la última actividad.
    http.expectNone(() => true);
  });

  it('la actividad cancela el aviso', () => {
    abrirSesion();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
    expect(idle.warning()).toBe(true);

    idle.reiniciar();
    expect(idle.warning()).toBe(false);
  });

  it('cerrar sesión a mano detiene el reloj', () => {
    abrirSesion();
    session.clear();
    TestBed.tick();

    vi.advanceTimersByTime(IDLE_TIMEOUT_MS * 2);

    // Sin sesión no hay nada que cerrar: no debe salir ninguna petición.
    http.expectNone(() => true);
  });

  it('el aviso llega antes que el cierre, no a la vez', () => {
    // Un aviso simultáneo al cierre sería inútil: la gracia es poder volver.
    expect(IDLE_WARNING_MS).toBeLessThan(IDLE_TIMEOUT_MS);
    expect(IDLE_WARNING_MS).toBeGreaterThan(0);
  });

  describe('política de sesión de la organización', () => {
    it('sin el claim rige el plazo por omisión', () => {
      expect(idleTimeoutFor(undefined)).toBe(IDLE_TIMEOUT_MS);
    });

    it('con el claim rige el plazo de la organización, nunca menos de tres avisos', () => {
      expect(idleTimeoutFor(10)).toBe(10 * 60 * 1000);
      expect(idleTimeoutFor(5)).toBe(IDLE_WARNING_MS * 3);
    });

    it('cierra la sesión al vencer el plazo que declara el token, no el de siempre', () => {
      const corto = jwt({ sub: 'u-2', roles: [], tenants: ['t-1'], idleTimeoutMinutes: 10 });
      session.start({ accessToken: corto, refreshToken: 'r-2' });
      TestBed.tick();

      vi.advanceTimersByTime(10 * 60 * 1000 - 1000);
      http.expectNone(() => true);

      vi.advanceTimersByTime(1000);
      http.expectOne((request) => request.url.endsWith('/iam/auth/logout')).flush({});
    });
  });
});
