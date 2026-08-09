import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../auth/session.store';
import { TokenRefreshService } from './token-refresh.service';

/**
 * La garantía de este servicio es **una sola petición de refresco en vuelo**, y
 * es exactamente la clase de propiedad que un refactor rompe sin que nada
 * avise: el código sigue compilando y las pantallas siguen funcionando, hasta
 * que tres 401 simultáneos gastan tres de los 20 intentos por minuto que admite
 * la API y rotan el token unos sobre otros.
 */
function jwt(payload: Record<string, unknown>): string {
  /**
   * base64url **sobre UTF-8**, como el token real.
   *
   * `btoa(JSON.stringify(...))` a secas no sirve: es Latin-1, así que un nombre
   * con acentos sale como un byte que no es UTF-8 válido y `decodeAccessToken`
   * —que decodifica con `TextDecoder`, precisamente para que los acentos no se
   * rompan— devuelve un carácter de reemplazo. El defecto sería del doble de
   * prueba, no del código.
   */
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    const binario = String.fromCharCode(...bytes);
    return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const TOKEN = jwt({ sub: 'u-1', roles: [], tenants: ['t-1'] });

describe('TokenRefreshService', () => {
  let refresher: TokenRefreshService;
  let session: SessionStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    refresher = TestBed.inject(TokenRefreshService);
    session = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);

    session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
  });

  afterEach(() => {
    http.verify();
  });

  function responderRefresco(refreshToken = 'r-2') {
    http.expectOne((request) => request.url.endsWith('/iam/auth/token/refresh')).flush({
      accessToken: TOKEN,
      refreshToken,
      expiresAt: '2026-08-01T12:00:00.000Z',
    });
  }

  it('tres llamadas concurrentes producen UNA sola petición', () => {
    refresher.refresh().subscribe();
    refresher.refresh().subscribe();
    refresher.refresh().subscribe();

    // `expectOne` falla si hubiera más de una: es la aserción.
    responderRefresco();
  });

  it('las tres reciben la misma sesión', () => {
    const recibidos: string[] = [];
    refresher.refresh().subscribe((s) => recibidos.push(s.refreshToken));
    refresher.refresh().subscribe((s) => recibidos.push(s.refreshToken));
    refresher.refresh().subscribe((s) => recibidos.push(s.refreshToken));

    responderRefresco('r-nuevo');

    expect(recibidos).toEqual(['r-nuevo', 'r-nuevo', 'r-nuevo']);
  });

  it('renueva los tokens del store', () => {
    refresher.refresh().subscribe();
    responderRefresco('r-nuevo');

    expect(session.refreshToken()).toBe('r-nuevo');
  });

  it('libera el hueco tras completar: un refresco posterior vuelve a pedir', () => {
    refresher.refresh().subscribe();
    responderRefresco();

    refresher.refresh().subscribe();
    responderRefresco('r-3');
  });

  /**
   * El caso que motiva el `finalize`: si el hueco quedara ocupado tras un
   * fallo, **ningún intento posterior podría refrescar en toda la sesión**.
   */
  it('libera el hueco tras un fallo', () => {
    refresher.refresh().subscribe({ error: () => undefined });
    http
      .expectOne((request) => request.url.endsWith('/iam/auth/token/refresh'))
      .flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });

    // Si el hueco no se hubiera liberado, esto no dispararía ninguna petición
    // y `expectOne` fallaría.
    refresher.refresh().subscribe({ error: () => undefined });
    responderRefresco();
  });

  it('sin refresh token falla sin gastar una petición', () => {
    session.clear();

    let error: unknown = null;
    refresher.refresh().subscribe({ error: (e: unknown) => (error = e) });

    expect(error).toBeInstanceOf(Error);
    // `http.verify()` en `afterEach` comprueba que no salió ninguna petición.
  });
});
