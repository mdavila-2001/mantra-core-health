import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { REFRESH_COOKIE_MODE } from '../data-access/api';
import { AuthService } from './auth.service';
import { RefreshTokenStorage } from './refresh-token.storage';
import { SESSION_CLEANERS } from './session-cleanup';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

const TOKEN = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const TOKEN_DOS = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1', 't-2'] });

/** Con la cookie, el cuerpo trae `refreshToken: ""`: la API no lo entrega. */
const RESPUESTA_COOKIE = {
  accessToken: TOKEN,
  refreshToken: '',
  expiresAt: '2026-08-01T12:00:00.000Z',
};

const RESPUESTA_CUERPO = { ...RESPUESTA_COOKIE, refreshToken: 'r-1' };

/** Almacenamiento en memoria con lo que usa `AuthService`, incluida la marca de modo cookie. */
class AlmacenFalso {
  token: string | null = null;
  hint = false;
  tenant: string | null = null;
  tenantOwner: string | null = null;
  limpiezas = 0;

  read(): string | null {
    return this.token;
  }
  write(token: string): void {
    this.token = token;
  }
  clear(): void {
    this.token = null;
    this.hint = false;
    this.limpiezas += 1;
  }
  writeSessionHint(): void {
    this.hint = true;
    this.token = null;
  }
  hasSessionHint(): boolean {
    return this.hint;
  }
  readSelectedTenant(userId?: string | null): string | null {
    return this.tenantOwner === null || this.tenantOwner === userId ? this.tenant : null;
  }
  writeSelectedTenant(tenantId: string, userId?: string | null): void {
    this.tenant = tenantId;
    this.tenantOwner = userId ?? null;
  }
  onClearedInAnotherTab(): () => void {
    return () => undefined;
  }
}

function montar(cookie: boolean, almacen: AlmacenFalso, limpiadores: (() => void)[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RefreshTokenStorage, useValue: almacen },
      { provide: REFRESH_COOKIE_MODE, useValue: cookie },
      ...limpiadores.map((limpiador) => ({
        provide: SESSION_CLEANERS,
        multi: true,
        useValue: limpiador,
      })),
    ],
  });
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('AuthService · modo cookie (TX-10)', () => {
  it('el login no guarda el refresh token: sólo la marca de sesión', () => {
    const almacen = new AlmacenFalso();
    const { auth, http } = montar(true, almacen);

    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush(RESPUESTA_COOKIE);

    expect(auth.isAuthenticated()).toBe(true);
    expect(almacen.token).toBeNull();
    expect(almacen.hint).toBe(true);
    http.verify();
  });

  it('la sesión sobrevive a F5: pide el refresco SIN cuerpo y abre la sesión', () => {
    const almacen = new AlmacenFalso();
    almacen.hint = true;
    const { auth, http } = montar(true, almacen);

    let restaurada: boolean | undefined;
    auth.restoreSession().subscribe((value) => (restaurada = value));

    const req = http.expectOne('/iam/auth/token/refresh');
    expect(req.request.body).toEqual({});
    req.flush(RESPUESTA_COOKIE);

    expect(restaurada).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    // Sigue sin haber refresh token al alcance de scripts.
    expect(almacen.token).toBeNull();
    http.verify();
  });

  it('un visitante anónimo no gasta un refresco al abrir la aplicación', () => {
    const almacen = new AlmacenFalso();
    const { auth, http } = montar(true, almacen);

    let restaurada: boolean | undefined;
    auth.restoreSession().subscribe((value) => (restaurada = value));

    expect(restaurada).toBe(false);
    http.verify();
  });

  it('con la cookie rechazada (401) descarta la marca', () => {
    const almacen = new AlmacenFalso();
    almacen.hint = true;
    const { auth, http } = montar(true, almacen);

    let restaurada: boolean | undefined;
    auth.restoreSession().subscribe((value) => (restaurada = value));
    http.expectOne('/iam/auth/token/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(restaurada).toBe(false);
    expect(almacen.hint).toBe(false);
    http.verify();
  });
});

describe('AuthService · restoreSession selectivo (TX-30)', () => {
  /** Estados que no dicen nada de la sesión: no se borra nada. */
  const TRANSITORIOS: readonly { readonly nombre: string; readonly status: number }[] = [
    { nombre: 'sin red (0)', status: 0 },
    { nombre: 'límite de tasa (429)', status: 429 },
    { nombre: 'servidor caído (503)', status: 503 },
  ];

  for (const caso of TRANSITORIOS) {
    it(`${caso.nombre}: conserva el token guardado y no abre sesión`, async () => {
      vi.useFakeTimers();
      const almacen = new AlmacenFalso();
      almacen.token = 'r-guardado';
      const { auth, http } = montar(false, almacen);

      let restaurada: boolean | undefined;
      auth.restoreSession().subscribe((value) => (restaurada = value));

      const fallar = (): void => {
        const req = http.expectOne('/iam/auth/token/refresh');
        if (caso.status === 0) {
          req.error(new ProgressEvent('error'), { status: 0 });
        } else {
          req.flush(null, { status: caso.status, statusText: 'x' });
        }
      };
      fallar();
      // Un reintento tras la espera; vuelve a fallar.
      await vi.advanceTimersByTimeAsync(1000);
      fallar();

      expect(restaurada).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
      expect(almacen.token).toBe('r-guardado');
      expect(almacen.limpiezas).toBe(0);
      vi.useRealTimers();
      http.verify();
    });
  }

  it('si el reintento encuentra la red, restaura la sesión', async () => {
    vi.useFakeTimers();
    const almacen = new AlmacenFalso();
    almacen.token = 'r-guardado';
    const { auth, http } = montar(false, almacen);

    let restaurada: boolean | undefined;
    auth.restoreSession().subscribe((value) => (restaurada = value));
    http.expectOne('/iam/auth/token/refresh').error(new ProgressEvent('error'), { status: 0 });
    await vi.advanceTimersByTimeAsync(1000);
    http.expectOne('/iam/auth/token/refresh').flush({ ...RESPUESTA_CUERPO, refreshToken: 'r-nuevo' });

    expect(restaurada).toBe(true);
    expect(almacen.token).toBe('r-nuevo');
    vi.useRealTimers();
    http.verify();
  });

  for (const status of [400, 401]) {
    it(`${status}: el servidor rechazó el token, se descarta`, () => {
      const almacen = new AlmacenFalso();
      almacen.token = 'r-vencido';
      const { auth, http } = montar(false, almacen);

      let restaurada: boolean | undefined;
      auth.restoreSession().subscribe((value) => (restaurada = value));
      http.expectOne('/iam/auth/token/refresh').flush(null, { status, statusText: 'x' });

      expect(restaurada).toBe(false);
      expect(almacen.token).toBeNull();
      http.verify();
    });
  }
});

describe('AuthService · organización recordada por persona (TX-11)', () => {
  it('el segundo inicio de sesión entra en la última organización elegida, sin selector', () => {
    const almacen = new AlmacenFalso();
    const { auth, http } = montar(false, almacen);

    // Primera vez: dos organizaciones, hay que elegir.
    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush({ ...RESPUESTA_CUERPO, accessToken: TOKEN_DOS });
    expect(auth.needsTenantSelection()).toBe(true);
    auth.selectTenant('t-2');
    auth.logout();
    http.expectOne('/iam/auth/logout').flush({});

    // Segunda vez, mismo dispositivo y misma persona.
    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush({ ...RESPUESTA_CUERPO, accessToken: TOKEN_DOS });

    expect(auth.needsTenantSelection()).toBe(false);
    expect(auth.activeTenantId()).toBe('t-2');
    http.verify();
  });

  it('otra persona en el mismo dispositivo no hereda la organización', () => {
    const almacen = new AlmacenFalso();
    almacen.tenant = 't-2';
    almacen.tenantOwner = 'u-otro';
    const { auth, http } = montar(false, almacen);

    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush({ ...RESPUESTA_CUERPO, accessToken: TOKEN_DOS });

    expect(auth.needsTenantSelection()).toBe(true);
    http.verify();
  });

  it('una organización recordada que ya no está en el token se descarta', () => {
    const almacen = new AlmacenFalso();
    almacen.tenant = 't-ajena';
    almacen.tenantOwner = 'u-1';
    const { auth, http } = montar(false, almacen);

    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush({ ...RESPUESTA_CUERPO, accessToken: TOKEN_DOS });

    expect(auth.needsTenantSelection()).toBe(true);
    http.verify();
  });
});

describe('AuthService · cerrar sesión (TX-10, TX-31, ID-24)', () => {
  it('corre los limpiadores y uno roto no frena a los demás', () => {
    const almacen = new AlmacenFalso();
    let corrio = 0;
    const { auth, http } = montar(false, almacen, [
      () => {
        throw new Error('roto');
      },
      () => {
        corrio += 1;
      },
    ]);
    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush(RESPUESTA_CUERPO);

    auth.logout();
    http.expectOne('/iam/auth/logout').flush({});

    expect(corrio).toBe(1);
    expect(almacen.token).toBeNull();
    http.verify();
  });

  it('descartar la sesión local limpia el store, lo guardado y lo sensible', () => {
    const almacen = new AlmacenFalso();
    let corrio = 0;
    const { auth, http } = montar(false, almacen, [
      () => {
        corrio += 1;
      },
    ]);
    auth.login({ kind: 'email', email: 'a@b.test', password: 'p' }).subscribe();
    http.expectOne('/iam/auth/login').flush(RESPUESTA_CUERPO);

    auth.discardLocalSession();

    expect(auth.isAuthenticated()).toBe(false);
    expect(almacen.token).toBeNull();
    expect(corrio).toBe(1);
    // Sin llamada al servidor: eso lo hace `AccountSecurityClient.logoutAll`.
    http.verify();
  });
});
