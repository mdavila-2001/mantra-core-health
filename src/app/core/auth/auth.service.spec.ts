import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { SessionStorage } from './session.storage';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma-no-verificada`;
}

const UN_TENANT = makeToken({
  sub: 'dc0c455f-a611-4550-bb92-e5575dde1d03',
  sid: 's-1',
  roles: ['SECURITY_ADMIN'],
  tenants: ['1befcfea-44c0-563a-81cd-337ec6acc840'],
});

const DOS_TENANTS = makeToken({
  sub: 'u-1',
  sid: 's-1',
  roles: ['USER'],
  tenants: ['t-1', 't-2'],
});

/** Almacenamiento en memoria: `localStorage` real deja estado entre pruebas. */
class AlmacenamientoFalso {
  refreshToken: string | null = null;
  tenantId: string | null = null;

  readRefreshToken(): string | null {
    return this.refreshToken;
  }
  writeRefreshToken(token: string | null): void {
    this.refreshToken = token;
  }
  readTenantId(): string | null {
    return this.tenantId;
  }
  writeTenantId(tenantId: string | null): void {
    this.tenantId = tenantId;
  }
  clear(): void {
    this.refreshToken = null;
    this.tenantId = null;
  }
}

describe('AuthService', () => {
  let auth: AuthService;
  let backend: HttpTestingController;
  let almacenamiento: AlmacenamientoFalso;

  beforeEach(() => {
    almacenamiento = new AlmacenamientoFalso();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStorage, useValue: almacenamiento },
      ],
    });

    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  describe('login', () => {
    it('manda un solo identificador: el que la unión discriminada eligió', () => {
      auth.login({ kind: 'email', email: 'admin@redesa.test', password: 'x' }).subscribe();

      const peticion = backend.expectOne('/iam/auth/login');
      expect(peticion.request.body).toEqual({ email: 'admin@redesa.test', password: 'x' });
      // Un campo de más devuelve 400: el backend valida con `forbidNonWhitelisted`.
      expect(peticion.request.body).not.toHaveProperty('nationalId');

      peticion.flush({
        accessToken: UN_TENANT,
        refreshToken: 'r-1',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });
    });

    it('guarda el refresh token para que la recarga no pida la contraseña otra vez', () => {
      auth.login({ kind: 'nationalId', nationalId: '1234567', password: 'x' }).subscribe();

      backend.expectOne('/iam/auth/login').flush({
        accessToken: UN_TENANT,
        refreshToken: 'r-1',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });

      expect(almacenamiento.refreshToken).toBe('r-1');
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.roles()).toEqual(['SECURITY_ADMIN']);
    });

    it('con un solo tenant no hay nada que elegir', () => {
      auth.login({ kind: 'email', email: 'a@b.test', password: 'x' }).subscribe();
      backend.expectOne('/iam/auth/login').flush({
        accessToken: UN_TENANT,
        refreshToken: 'r-1',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });

      expect(auth.needsTenantSelection()).toBe(false);
      expect(auth.activeTenantId()).toBe('1befcfea-44c0-563a-81cd-337ec6acc840');
    });

    it('con varios tenants no se adivina ninguno', () => {
      auth.login({ kind: 'email', email: 'a@b.test', password: 'x' }).subscribe();
      backend.expectOne('/iam/auth/login').flush({
        accessToken: DOS_TENANTS,
        refreshToken: 'r-1',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });

      expect(auth.needsTenantSelection()).toBe(true);
      // Elegir por la persona podría mostrarle datos de la organización equivocada.
      expect(auth.activeTenantId()).toBeNull();
    });

    it('el error sube tal cual para que la pantalla lo traduzca', () => {
      let recibido: unknown = null;
      auth
        .login({ kind: 'email', email: 'a@b.test', password: 'mala' })
        .subscribe({ error: (error: unknown) => (recibido = error) });

      backend
        .expectOne('/iam/auth/login')
        .flush({ code: 'UNAUTHENTICATED', message: 'Credenciales inválidas' }, { status: 401, statusText: 'Unauthorized' });

      expect(recibido).not.toBeNull();
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('selectTenant', () => {
    beforeEach(() => {
      auth.login({ kind: 'email', email: 'a@b.test', password: 'x' }).subscribe();
      backend.expectOne('/iam/auth/login').flush({
        accessToken: DOS_TENANTS,
        refreshToken: 'r-1',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });
    });

    it('recuerda la organización elegida', () => {
      auth.selectTenant('t-2');

      expect(auth.activeTenantId()).toBe('t-2');
      expect(almacenamiento.tenantId).toBe('t-2');
    });

    it('no persiste una organización que el token no declara', () => {
      auth.selectTenant('t-de-otra-empresa');

      expect(auth.activeTenantId()).toBeNull();
      // Persistirla dejaría la próxima recarga entrando a una organización ajena.
      expect(almacenamiento.tenantId).toBeNull();
    });
  });

  describe('ensureRestored', () => {
    it('sin token guardado se resuelve sin pedir nada', async () => {
      await auth.ensureRestored();

      expect(auth.isRestored()).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('cambia el token guardado por una sesión viva', async () => {
      almacenamiento.refreshToken = 'r-guardado';
      almacenamiento.tenantId = 't-2';

      const restaurada = auth.ensureRestored();

      backend.expectOne('/iam/auth/token/refresh').flush({
        accessToken: DOS_TENANTS,
        refreshToken: 'r-rotado',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });
      await restaurada;

      expect(auth.isAuthenticated()).toBe(true);
      // La rotación invalida el anterior: dejarlo guardado rompería la próxima recarga.
      expect(almacenamiento.refreshToken).toBe('r-rotado');
      // Y la organización elegida vuelve, para no preguntar lo mismo en cada F5.
      expect(auth.activeTenantId()).toBe('t-2');
    });

    it('dispara una sola petición aunque la pidan tres veces a la vez', async () => {
      almacenamiento.refreshToken = 'r-guardado';

      const todas = Promise.all([
        auth.ensureRestored(),
        auth.ensureRestored(),
        auth.ensureRestored(),
      ]);

      // `expectOne` falla si hubo más de una: es la aserción.
      backend.expectOne('/iam/auth/token/refresh').flush({
        accessToken: UN_TENANT,
        refreshToken: 'r-rotado',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });
      await todas;

      expect(auth.isAuthenticated()).toBe(true);
    });

    it('un token guardado que ya no sirve deja la aplicación arrancada, sin sesión', async () => {
      almacenamiento.refreshToken = 'r-vencido';

      const restaurada = auth.ensureRestored();
      backend
        .expectOne('/iam/auth/token/refresh')
        .flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });

      // Que no lance es el punto: propagarlo dejaría la aplicación sin arrancar.
      await expect(restaurada).resolves.toBeUndefined();
      expect(auth.isAuthenticated()).toBe(false);
      expect(almacenamiento.refreshToken).toBeNull();
    });

    it('una organización guardada que ya no está en el token nuevo se descarta', async () => {
      almacenamiento.refreshToken = 'r-guardado';
      // Los permisos pueden haber cambiado entre una sesión y la siguiente.
      almacenamiento.tenantId = 't-que-ya-no-tiene';

      const restaurada = auth.ensureRestored();
      backend.expectOne('/iam/auth/token/refresh').flush({
        accessToken: DOS_TENANTS,
        refreshToken: 'r-rotado',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });
      await restaurada;

      expect(auth.activeTenantId()).toBeNull();
      expect(auth.needsTenantSelection()).toBe(true);
    });
  });

  describe('logout', () => {
    it('borra la sesión de la memoria y del almacenamiento', () => {
      auth.login({ kind: 'email', email: 'a@b.test', password: 'x' }).subscribe();
      backend.expectOne('/iam/auth/login').flush({
        accessToken: UN_TENANT,
        refreshToken: 'r-1',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });

      auth.logout();

      expect(auth.isAuthenticated()).toBe(false);
      expect(almacenamiento.refreshToken).toBeNull();
      expect(almacenamiento.tenantId).toBeNull();
    });

    it('no llama a la API: no hay ruta de cierre de sesión', () => {
      auth.logout();
      // `backend.verify()` del afterEach falla si se hubiera hecho alguna petición.
    });
  });

  describe('hasAnyRole', () => {
    beforeEach(() => {
      auth.login({ kind: 'email', email: 'a@b.test', password: 'x' }).subscribe();
      backend.expectOne('/iam/auth/login').flush({
        accessToken: UN_TENANT,
        refreshToken: 'r-1',
        expiresAt: '2026-08-31T06:40:40.060Z',
      });
    });

    it('alcanza con tener alguno de los pedidos', () => {
      expect(auth.hasAnyRole(['SECURITY_ADMIN'])).toBe(true);
      expect(auth.hasAnyRole(['OTRO', 'SECURITY_ADMIN'])).toBe(true);
      expect(auth.hasAnyRole(['OTRO'])).toBe(false);
    });

    it('sin roles pedidos alcanza con estar autenticado', () => {
      expect(auth.hasAnyRole([])).toBe(true);
    });
  });
});
