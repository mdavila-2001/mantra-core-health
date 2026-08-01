import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { RefreshTokenStorage } from './refresh-token.storage';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

const TOKEN = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const TOKEN_DOS_TENANTS = makeToken({
  sub: 'u-1',
  sid: 's-1',
  roles: ['USER'],
  tenants: ['t-1', 't-2'],
});

const RESPUESTA_TOKENS = {
  accessToken: TOKEN,
  refreshToken: 'r-1',
  expiresAt: '2026-08-01T12:00:00.000Z',
};

/** Almacenamiento en memoria: aísla al servicio de las rarezas de jsdom. */
class AlmacenFalso {
  value: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(token: string): void {
    this.value = token;
  }

  clear(): void {
    this.value = null;
  }
}

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let almacen: AlmacenFalso;

  beforeEach(() => {
    almacen = new AlmacenFalso();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RefreshTokenStorage, useValue: almacen },
      ],
    });

    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('login', () => {
    it('abre la sesión y persiste el refresh token', () => {
      auth.login({ kind: 'email', email: 'admin@mantra.test', password: 'secreto' }).subscribe();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body).toEqual({ email: 'admin@mantra.test', password: 'secreto' });
      req.flush(RESPUESTA_TOKENS);

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.userId()).toBe('u-1');
      expect(auth.roles()).toEqual(['USER']);
      // Solo el refresh token: el de acceso dura minutos y se vuelve a obtener.
      expect(almacen.value).toBe('r-1');
    });

    it('funciona igual con documento en vez de correo', () => {
      auth.login({ kind: 'nationalId', nationalId: '1234567', password: 'secreto' }).subscribe();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body).toEqual({ nationalId: '1234567', password: 'secreto' });
      req.flush(RESPUESTA_TOKENS);

      expect(auth.isAuthenticated()).toBe(true);
    });

    it('con credenciales inválidas la sesión no se abre ni se persiste nada', () => {
      let fallo = false;
      auth
        .login({ kind: 'email', email: 'admin@mantra.test', password: 'mala' })
        .subscribe({ error: () => (fallo = true) });

      http.expectOne('/iam/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(fallo).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
      expect(almacen.value).toBeNull();
    });
  });

  it('logout limpia la sesión y el almacenamiento', () => {
    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush(RESPUESTA_TOKENS);

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(almacen.value).toBeNull();
  });

  it('registerPatient NO abre sesión: el backend devuelve el perfil, no tokens', () => {
    auth
      .registerPatient({ nationalId: '1234567', password: 'secreto12', displayName: 'Ana' })
      .subscribe();

    http.expectOne('/iam/auth/register-patient').flush({
      userId: 'u',
      personId: 'p',
      patientProfileId: 'pp',
      patientCode: 'PAC-1',
      emailVerificationSent: false,
    });

    expect(auth.isAuthenticated()).toBe(false);
  });

  describe('restoreSession', () => {
    it('sin token guardado devuelve false y no pide nada', () => {
      let resultado: boolean | undefined;
      auth.restoreSession().subscribe((value) => (resultado = value));

      // El verify() del afterEach confirma que no hubo petición.
      expect(resultado).toBe(false);
    });

    it('con token guardado canjea y deja la sesión abierta', () => {
      almacen.value = 'r-viejo';

      let resultado: boolean | undefined;
      auth.restoreSession().subscribe((value) => (resultado = value));

      const req = http.expectOne('/iam/auth/token/refresh');
      expect(req.request.body).toEqual({ refreshToken: 'r-viejo' });
      req.flush({ ...RESPUESTA_TOKENS, refreshToken: 'r-nuevo' });

      expect(resultado).toBe(true);
      expect(auth.isAuthenticated()).toBe(true);
      expect(almacen.value).toBe('r-nuevo');
    });

    it('si el token guardado ya no sirve, lo descarta en vez de reintentar siempre', () => {
      almacen.value = 'r-vencido';

      let resultado: boolean | undefined;
      auth.restoreSession().subscribe((value) => (resultado = value));

      http
        .expectOne('/iam/auth/token/refresh')
        .flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(resultado).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
      // Sin esto, cada arranque gastaría un intento contra el límite de la API.
      expect(almacen.value).toBeNull();
    });
  });

  describe('organización activa', () => {
    it('con un solo tenant se resuelve sola', () => {
      auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
      http.expectOne('/iam/auth/login').flush(RESPUESTA_TOKENS);

      expect(auth.activeTenantId()).toBe('t-1');
      expect(auth.needsTenantSelection()).toBe(false);
    });

    it('con varias exige elegir, y respeta la elección', () => {
      auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
      http
        .expectOne('/iam/auth/login')
        .flush({ ...RESPUESTA_TOKENS, accessToken: TOKEN_DOS_TENANTS });

      expect(auth.needsTenantSelection()).toBe(true);

      auth.selectTenant('t-2');

      expect(auth.activeTenantId()).toBe('t-2');
      expect(auth.needsTenantSelection()).toBe(false);
    });
  });
});
