import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';

import { Login } from './login';
import { TENANT_SELECTION_ROUTE } from '../../../core/auth/auth.guard';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

const UN_TENANT = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const DOS_TENANTS = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1', 't-2'] });

function tokens(accessToken: string) {
  return { accessToken, refreshToken: 'r-1', expiresAt: '2026-08-01T12:00:00.000Z' };
}

/** Almacenamiento en memoria: jsdom no da `localStorage` con origen opaco. */
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

class RouterEspia {
  readonly navegaciones: string[] = [];

  navigateByUrl(url: string): Promise<boolean> {
    this.navegaciones.push(url);
    return Promise.resolve(true);
  }
}

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let http: HttpTestingController;
  let router: RouterEspia;

  beforeEach(async () => {
    router = new RouterEspia();

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RefreshTokenStorage, useClass: AlmacenFalso },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  function completar(identifier: string, password = 'secreto'): void {
    component.form.setValue({ identifier, password, mfaCode: '' });
  }

  describe('identificador dual', () => {
    it('lo que tiene arroba se manda como correo', () => {
      completar('admin@mantra.test');
      component.submit();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body).toEqual({ email: 'admin@mantra.test', password: 'secreto' });
      req.flush(tokens(UN_TENANT));
    });

    it('lo que no la tiene se manda como documento', () => {
      completar('1234567');
      component.submit();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body).toEqual({ nationalId: '1234567', password: 'secreto' });
      req.flush(tokens(UN_TENANT));
    });

    it('recorta los espacios antes de decidir', () => {
      completar('  admin@mantra.test  ');
      component.submit();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body).toEqual({ email: 'admin@mantra.test', password: 'secreto' });
      req.flush(tokens(UN_TENANT));
    });
  });

  describe('después de entrar', () => {
    it('con una organización va al inicio', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(tokens(UN_TENANT));

      expect(router.navegaciones).toEqual(['/']);
    });

    it('con varias organizaciones va al selector', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(tokens(DOS_TENANTS));

      expect(router.navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
    });
  });

  describe('errores', () => {
    it('401 muestra credenciales inválidas y no navega', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(component.errorMessage()).toBe('Las credenciales no son válidas.');
      expect(router.navegaciones).toEqual([]);
    });

    it('401 que menciona MFA revela el campo del código', () => {
      completar('admin@mantra.test');
      component.submit();
      http
        .expectOne('/iam/auth/login')
        .flush({ message: 'MFA code required' }, { status: 401, statusText: 'Unauthorized' });

      expect(component.needsMfa()).toBe(true);
      expect(component.errorMessage()).toContain('código de verificación');
    });

    it('429 avisa que hay que esperar', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(null, { status: 429, statusText: 'Too Many' });

      expect(component.errorMessage()).toContain('Demasiados intentos');
    });

    it('sin conexión lo dice como tal, no como error del servidor', () => {
      completar('admin@mantra.test');
      component.submit();
      http
        .expectOne('/iam/auth/login')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(component.errorMessage()).toContain('conexión');
    });

    it('5xx muestra el identificador de la petición', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(null, {
        status: 500,
        statusText: 'Server Error',
        headers: { 'x-request-id': 'req-9' },
      });

      expect(component.errorMessage()).toContain('req-9');
    });
  });

  it('no envía si el formulario está incompleto', () => {
    completar('', '');
    component.submit();

    // El verify() del afterEach confirma que no hubo petición.
    expect(component.form.controls.identifier.touched).toBe(true);
  });

  it('el código MFA viaja solo cuando se completó', () => {
    component.form.setValue({
      identifier: 'admin@mantra.test',
      password: 'secreto',
      mfaCode: '123456',
    });
    component.submit();

    const req = http.expectOne('/iam/auth/login');
    expect(req.request.body.mfaCode).toBe('123456');
    req.flush(tokens(UN_TENANT));
  });
});
