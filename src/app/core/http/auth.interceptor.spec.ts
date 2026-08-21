import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { authInterceptor, LOGIN_ROUTE } from './auth.interceptor';

/** JWT de mentira: la firma no se verifica en el cliente, así que da igual. */
function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma-no-verificada`;
}

const UN_TENANT = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const DOS_TENANTS = makeToken({
  sub: 'u-1',
  sid: 's-1',
  roles: ['USER'],
  tenants: ['t-1', 't-2'],
});
const TOKEN_RENOVADO = makeToken({ sub: 'u-1', sid: 's-2', roles: ['USER'], tenants: ['t-1'] });

/** Router mínimo: solo interesa a dónde se navega, no la navegación real. */
class RouterEspia {
  readonly navegaciones: string[] = [];

  navigateByUrl(url: string): Promise<boolean> {
    this.navegaciones.push(url);
    return Promise.resolve(true);
  }
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: SessionStore;
  let router: RouterEspia;

  beforeEach(() => {
    router = new RouterEspia();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    backend.verify();
  });

  describe('credenciales en la petición', () => {
    it('agrega Bearer y X-Tenant-Id cuando hay un solo tenant', () => {
      session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

      http.get('/clinical/encounters').subscribe();

      const req = backend.expectOne('/clinical/encounters');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${UN_TENANT}`);
      expect(req.request.headers.get('X-Tenant-Id')).toBe('t-1');

      req.flush({});
    });

    it('con varios tenants y ninguno elegido NO manda X-Tenant-Id', () => {
      session.start({ accessToken: DOS_TENANTS, refreshToken: 'r-1' });

      http.get('/clinical/encounters').subscribe();

      const req = backend.expectOne('/clinical/encounters');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${DOS_TENANTS}`);
      // Elegir por la persona podría mostrarle datos de otra organización.
      expect(req.request.headers.has('X-Tenant-Id')).toBe(false);

      req.flush({});
    });

    it('respeta el X-Tenant-Id que ya trae la petición', () => {
      session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

      // La ficha de una organización distinta de la activa declara cuál mira.
      // Pisarla con la de la sesión daría 403: la API rechaza la petición
      // privilegiada cuyo tenant de la ruta contradice el de la cabecera.
      http.get('/tenants/t-9', { headers: { 'X-Tenant-Id': 't-9' } }).subscribe();

      const req = backend.expectOne('/tenants/t-9');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${UN_TENANT}`);
      expect(req.request.headers.get('X-Tenant-Id')).toBe('t-9');

      req.flush({});
    });

    it('manda el tenant elegido cuando hay varios', () => {
      session.start({ accessToken: DOS_TENANTS, refreshToken: 'r-1' });
      session.selectTenant('t-2');

      http.get('/clinical/encounters').subscribe();

      const req = backend.expectOne('/clinical/encounters');
      expect(req.request.headers.get('X-Tenant-Id')).toBe('t-2');

      req.flush({});
    });

    it('un 401 SIN sesión previa no expulsa al login: no hay sesión que vencer', () => {
      // El bug que hacía imposible registrarse: la pantalla de alta pedía los
      // departamentos a terminología —sin token, la cuenta todavía no existe—,
      // el endpoint contestaba 401, y este interceptor lo leía como «sesión
      // vencida»: limpiaba nada y mandaba al visitante al login antes de que
      // pudiera escribir su nombre.
      let fallo = false;
      http.get('/terminology/value-sets?code=VS_BO_DEPARTMENT').subscribe({
        error: () => (fallo = true),
      });

      backend
        .expectOne('/terminology/value-sets?code=VS_BO_DEPARTMENT')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      // El error se propaga —la pantalla decide qué hacer con él—, pero nadie
      // navega a ninguna parte.
      expect(fallo).toBe(true);
      expect(router.navegaciones).toEqual([]);
    });

    it('sin sesión no agrega nada', () => {
      http.get('/clinical/encounters').subscribe();

      const req = backend.expectOne('/clinical/encounters');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });
  });

  describe('rutas públicas', () => {
    it('no manda credenciales al login aunque haya sesión', () => {
      session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

      http.post('/iam/auth/login', {}).subscribe();

      const req = backend.expectOne('/iam/auth/login');
      expect(req.request.headers.has('Authorization')).toBe(false);

      req.flush({});
    });

    it('un 401 del login NO dispara refresco: son credenciales inválidas', () => {
      session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

      let fallo = false;
      http.post('/iam/auth/login', {}).subscribe({ error: () => (fallo = true) });

      backend.expectOne('/iam/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(fallo).toBe(true);
      // Si hubiera intentado refrescar, verify() encontraría la petición pendiente.
      expect(session.isAuthenticated()).toBe(true);
    });
  });

  describe('401 en una ruta protegida', () => {
    it('refresca una vez y reintenta con el token nuevo', () => {
      session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

      let respuesta: unknown;
      http.get('/clinical/encounters').subscribe((value) => (respuesta = value));

      backend
        .expectOne('/clinical/encounters')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      const refresco = backend.expectOne('/iam/auth/token/refresh');
      expect(refresco.request.body).toEqual({ refreshToken: 'r-1' });
      refresco.flush({
        accessToken: TOKEN_RENOVADO,
        refreshToken: 'r-2',
        expiresAt: '2026-08-01T12:00:00.000Z',
      });

      const reintento = backend.expectOne('/clinical/encounters');
      expect(reintento.request.headers.get('Authorization')).toBe(`Bearer ${TOKEN_RENOVADO}`);
      reintento.flush({ ok: true });

      expect(respuesta).toEqual({ ok: true });
      expect(router.navegaciones).toEqual([]);
    });

    it('si el reintento vuelve a dar 401, NO refresca de nuevo: se corta el bucle', () => {
      session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

      let fallo = false;
      http.get('/clinical/encounters').subscribe({ error: () => (fallo = true) });

      backend
        .expectOne('/clinical/encounters')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      backend.expectOne('/iam/auth/token/refresh').flush({
        accessToken: TOKEN_RENOVADO,
        refreshToken: 'r-2',
        expiresAt: '2026-08-01T12:00:00.000Z',
      });
      backend
        .expectOne('/clinical/encounters')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      // El verify() del afterEach confirma que no quedó un segundo refresco.
      expect(fallo).toBe(true);
    });

    it('si el refresco falla, limpia la sesión y manda al login', () => {
      session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

      let fallo = false;
      http.get('/clinical/encounters').subscribe({ error: () => (fallo = true) });

      backend
        .expectOne('/clinical/encounters')
        .flush(null, { status: 401, statusText: 'Unauthorized' });
      backend
        .expectOne('/iam/auth/token/refresh')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(fallo).toBe(true);
      expect(session.isAuthenticated()).toBe(false);
      expect(router.navegaciones).toEqual([LOGIN_ROUTE]);
    });

    it('sin refresh token no intenta refrescar: corta y manda al login', () => {
      // Sesión a medias: hay acceso pero no con qué renovarlo.
      session.start({ accessToken: UN_TENANT, refreshToken: '' });
      session.renew({ accessToken: UN_TENANT, refreshToken: '' });

      let fallo = false;
      http.get('/clinical/encounters').subscribe({ error: () => (fallo = true) });

      backend
        .expectOne('/clinical/encounters')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(fallo).toBe(true);
      expect(router.navegaciones).toEqual([LOGIN_ROUTE]);
    });
  });

  it('dos 401 simultáneos disparan UN SOLO refresco', () => {
    session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

    const respuestas: string[] = [];
    http.get('/clinical/encounters').subscribe(() => respuestas.push('encounters'));
    http.get('/clinical/orders').subscribe(() => respuestas.push('orders'));

    backend
      .expectOne('/clinical/encounters')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/clinical/orders').flush(null, { status: 401, statusText: 'Unauthorized' });

    // La clave: `expectOne` falla si hubiera dos. La API admite 20 refrescos
    // por minuto y cada rotación invalida la anterior.
    backend.expectOne('/iam/auth/token/refresh').flush({
      accessToken: TOKEN_RENOVADO,
      refreshToken: 'r-2',
      expiresAt: '2026-08-01T12:00:00.000Z',
    });

    backend.expectOne('/clinical/encounters').flush({});
    backend.expectOne('/clinical/orders').flush({});

    expect(respuestas.sort()).toEqual(['encounters', 'orders']);
  });

  it('un error que no es 401 sube tal cual, sin tocar la sesión', () => {
    session.start({ accessToken: UN_TENANT, refreshToken: 'r-1' });

    let estado = 0;
    http.get('/clinical/encounters').subscribe({ error: (e: { status: number }) => (estado = e.status) });

    backend.expectOne('/clinical/encounters').flush(null, { status: 500, statusText: 'Server Error' });

    expect(estado).toBe(500);
    expect(session.isAuthenticated()).toBe(true);
    expect(router.navegaciones).toEqual([]);
  });
});
