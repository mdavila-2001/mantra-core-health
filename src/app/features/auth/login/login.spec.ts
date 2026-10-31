import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { NewDeviceAlert } from '../../../core/auth/new-device-alert';
import { SessionStore } from '../../../core/auth/session.store';
import { Login } from './login';
import { TENANT_SELECTION_ROUTE } from '../../../core/auth/auth.guard';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';
import { setReportingMock } from '../../reporting/reporting-mock-flag.testing';

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
const sessionWithRoles = (roles: string[], tenants: string[] = ['t-1']) =>
  makeToken({ sub: 'u-1', sid: 's-1', roles, tenants });

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

  /** La organización recordada por persona (TX-11): el login la consulta al abrir. */
  readSelectedTenant(): string | null {
    return null;
  }

  writeSelectedTenant(): void {
    /* no-op */
  }
}

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let http: HttpTestingController;
  let navegaciones: string[];
  let realNavigate: Router['navigateByUrl'];

  beforeEach(async () => {
    navegaciones = [];

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        // Se espía `navigateByUrl` en vez de reemplazar el servicio entero.
        // Una ruta comodín: los casos de `returnUrl` navegan de verdad con el
        // router real (antes de espiar `navigateByUrl`) para que el
        // `ActivatedRoute` de la pantalla vea el query.
        provideRouter([{ path: '**', children: [] }]),
        { provide: RefreshTokenStorage, useClass: AlmacenFalso },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    realNavigate = router.navigateByUrl.bind(router);
    router.navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

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

  describe('cuenta de administración local (sólo desarrollo)', () => {
    /** El recuadro se decide tras el primer render, en el navegador. */
    async function mostrarCuentaLocal(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('muestra el correo y la contraseña escritos, para copiarlos', async () => {
      await mostrarCuentaLocal();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('[data-testid="login-local-correo"]')?.textContent).toBe(
        'admin@alovidasalud.com',
      );
      expect(el.querySelector('[data-testid="login-local-clave"]')?.textContent).toBe('12345678');
    });

    it('«Usar estas credenciales» rellena el formulario pero no envía nada', async () => {
      await mostrarCuentaLocal();
      (fixture.nativeElement.querySelector('[data-testid="login-local-usar"]') as HTMLElement).click();

      expect(component.form.getRawValue()).toMatchObject({
        identifier: 'admin@alovidasalud.com',
        password: '12345678',
      });
      // `http.verify()` del afterEach falla si salió alguna petición.
    });

    it('con la cuenta rellenada, entrar manda correo y contraseña por la vía normal', async () => {
      await mostrarCuentaLocal();
      (fixture.nativeElement.querySelector('[data-testid="login-local-usar"]') as HTMLElement).click();
      component.submit();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body).toEqual({ email: 'admin@alovidasalud.com', password: '12345678' });
    });
  });

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

      expect(navegaciones).toEqual(['/']);
    });

    it('con varias organizaciones va al selector', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(tokens(DOS_TENANTS));

      expect(navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
    });

    describe('elegir portal (administración y reportería) · maqueta ENCENDIDA', () => {
      let restaurar: () => void;
      beforeEach(() => {
        restaurar = setReportingMock(true);
      });
      afterEach(() => restaurar());

      function loginWith(token: string): void {
        completar('admin@mantra.test');
        component.submit();
        http.expectOne('/iam/auth/login').flush(tokens(token));
      }

      it('con acceso a administración Y a reportería va al selector de portal', () => {
        loginWith(sessionWithRoles(['SECURITY_ADMIN', 'REPORTING_ADMIN']));

        expect(navegaciones).toEqual(['/portal-selector']);
      });

      it('SUPERADMIN, que pasa por todo, también elige', () => {
        loginWith(sessionWithRoles(['SUPERADMIN']));

        expect(navegaciones).toEqual(['/portal-selector']);
      });

      it('solo administración va al inicio, sin pantalla de paso', () => {
        loginWith(sessionWithRoles(['SECURITY_ADMIN']));

        expect(navegaciones).toEqual(['/']);
      });

      it('solo reportería (sin rol de administración) entra derecho a su portal, sin pantalla de paso', () => {
        loginWith(sessionWithRoles(['REPORT_VIEWER']));

        expect(navegaciones).toEqual(['/reports']);
      });

      it('un paciente va al inicio', () => {
        loginWith(sessionWithRoles(['PATIENT']));

        expect(navegaciones).toEqual(['/']);
      });

      it('un returnUrl interno manda sobre el selector', async () => {
        await realNavigate('/auth?returnUrl=%2Fp%2Fdra-rojas');
        loginWith(sessionWithRoles(['SECURITY_ADMIN', 'REPORTING_ADMIN']));

        expect(navegaciones).toEqual(['/p/dra-rojas']);
      });

      it('un returnUrl externo se ignora y se elige portal', async () => {
        await realNavigate('/auth?returnUrl=%2F%2Fotro-sitio.example');
        loginWith(sessionWithRoles(['SECURITY_ADMIN', 'REPORTING_ADMIN']));

        expect(navegaciones).toEqual(['/portal-selector']);
      });

      it('sin organización el flujo existente queda intacto (no hay selector)', () => {
        loginWith(sessionWithRoles(['SECURITY_ADMIN', 'REPORTING_ADMIN'], []));

        expect(navegaciones).toEqual(['/administration/medical-organization?tab=memberships']);
      });

      it('con varias organizaciones por elegir, primero se elige organización', () => {
        loginWith(sessionWithRoles(['SECURITY_ADMIN', 'REPORTING_ADMIN'], ['t-1', 't-2']));

        expect(navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
      });
    });
  });

  describe('entrada con la maqueta APAGADA (por defecto) y alcance de plataforma (H1/H4)', () => {
    function loginWith(token: string): void {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(tokens(token));
    }

    it.each(['SUPERADMIN', 'PLATFORM_ADMIN', 'DATA_PLATFORM_ADMIN', 'GOVERNANCE_ADMIN'])(
      '%s con 2 organizaciones entra al Centro (/) sin pasar por /auth/organization ni /portal-selector',
      (rol) => {
        loginWith(sessionWithRoles([rol], ['t-1', 't-2']));

        expect(navegaciones).toEqual(['/']);
      },
    );

    it('alcance de plataforma con 3 organizaciones: tampoco elige organización', () => {
      loginWith(sessionWithRoles(['PLATFORM_ADMIN', 'REPORTING_ADMIN'], ['t-1', 't-2', 't-3']));

      expect(navegaciones).toEqual(['/']);
    });

    it('un returnUrl interno manda también para el alcance de plataforma', async () => {
      await realNavigate('/auth?returnUrl=%2Fsuperadmin%2Fobservability');
      loginWith(sessionWithRoles(['PLATFORM_ADMIN'], ['t-1', 't-2']));

      expect(navegaciones).toEqual(['/superadmin/observability']);
    });

    it('un returnUrl externo se ignora: va al Centro', async () => {
      await realNavigate('/auth?returnUrl=%2F%2Fotro-sitio.example');
      loginWith(sessionWithRoles(['PLATFORM_ADMIN'], ['t-1', 't-2']));

      expect(navegaciones).toEqual(['/']);
    });

    it('NEGATIVO: una médica con 3 organizaciones sigue yendo a /auth/organization', () => {
      loginWith(sessionWithRoles(['PRACTITIONER'], ['t-1', 't-2', 't-3']));

      expect(navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
    });

    it('NEGATIVO: SECURITY_ADMIN con 2 organizaciones sigue eligiendo', () => {
      loginWith(sessionWithRoles(['SECURITY_ADMIN'], ['t-1', 't-2']));

      expect(navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
    });

    it('NEGATIVO: PLATFORM_ADMIN con ámbito de organización y 2 organizaciones sigue eligiendo', () => {
      loginWith(
        makeToken({ sub: 'u-1', sid: 's-1', roles: ['PLATFORM_ADMIN'], tenants: ['t-1', 't-2'], scopedRoles: { 't-1': ['PLATFORM_ADMIN'] } }),
      );

      expect(navegaciones).toEqual([TENANT_SELECTION_ROUTE]);
    });

    it('cualquier rol de gestión con una organización va a /, nunca al selector de portales', () => {
      loginWith(sessionWithRoles(['SECURITY_ADMIN', 'REPORTING_ADMIN']));

      expect(navegaciones).toEqual(['/']);
    });

    it('límite: PLATFORM_ADMIN sin ninguna organización entra al Centro (opera sin ella); SECURITY_ADMIN va a «Mis organizaciones»', () => {
      loginWith(sessionWithRoles(['PLATFORM_ADMIN'], []));
      expect(navegaciones).toEqual(['/']);
    });

    it('NEGATIVO: sin alcance de plataforma y sin organizaciones sigue yendo a «Mis organizaciones»', () => {
      loginWith(sessionWithRoles(['SECURITY_ADMIN'], []));
      expect(navegaciones).toEqual(['/administration/medical-organization?tab=memberships']);
    });

    it('marketing puro conserva su portal (Insights)', () => {
      loginWith(sessionWithRoles(['MARKETING_MANAGER']));

      expect(navegaciones).toEqual(['/insights']);
    });
  });

  describe('errores', () => {
    it('UNAUTHENTICATED dice credenciales inválidas, no «sesión vencida»', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(
        { code: 'UNAUTHENTICATED', message: 'Credenciales inválidas', timestamp: 't', path: '/iam/auth/login' },
        { status: 401, statusText: 'Unauthorized' },
      );

      // Es la única excepción propia del login sobre el mapeo compartido: en
      // cualquier otra pantalla un 401 significa que la sesión se venció.
      expect(component.errorMessage()).toBe('Las credenciales no son válidas.');
      expect(navegaciones).toEqual([]);
    });

    it('RATE_LIMITED usa el mensaje del catálogo', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(
        { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes', timestamp: 't', path: '/iam/auth/login' },
        { status: 429, statusText: 'Too Many' },
      );

      expect(component.errorMessage()).toBe('Demasiadas solicitudes');
    });

    it('sin conexión lo dice como tal, no como error del servidor', () => {
      completar('admin@mantra.test');
      component.submit();
      http
        .expectOne('/iam/auth/login')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(component.errorMessage()).toContain('conexión');
    });

    it('5xx muestra el correlationId que trae el cuerpo', () => {
      completar('admin@mantra.test');
      component.submit();
      http.expectOne('/iam/auth/login').flush(
        {
          code: 'INTERNAL',
          message: 'Error interno',
          correlationId: 'req-9',
          timestamp: 't',
          path: '/iam/auth/login',
        },
        { status: 500, statusText: 'Server Error' },
      );

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

  describe('la política de sesión de la organización', () => {
    const rechazar = (reason: string, status = 401): void => {
      completar('ana@alovida.mock');
      component.submit();
      http.expectOne('/iam/auth/login').flush(
        { statusCode: status, code: 'UNAUTHENTICATED', message: 'x', details: { reason }, timestamp: '', path: '/iam/auth/login' },
        { status, statusText: 'x' },
      );
    };

    it('MFA_REQUIRED pide el código y MFA_INVALID dice que no valida', () => {
      rechazar('MFA_REQUIRED');
      expect(component.mfaRequired()).toBe(true);
      expect(component.errorMessage()).toContain('Ingrese el código de verificación');
      rechazar('MFA_INVALID');
      expect(component.errorMessage()).toContain('no es válido');
    });

    it('MFA_ENROLLMENT_REQUIRED ya no es un rechazo: la API deja entrar, así que como motivo no existe', () => {
      rechazar('MFA_ENROLLMENT_REQUIRED');
      expect(component.mfaRequired()).toBe(false);
      expect(component.errorMessage()).toBe('Las credenciales no son válidas.');
    });

    it('con el token de alcance limitado (mfaEnrollment) el login entra y lleva a dar de alta el segundo paso, con el destino para después', () => {
      completar('marcos@alovida.mock');
      component.submit();
      http.expectOne('/iam/auth/login').flush({ ...tokens(makeToken({ sub: 'u-1', sid: 's-1', roles: [], tenants: [], mfaEnrollment: true })), mfaEnrollmentRequired: true });
      expect(component.errorMessage()).toBeNull();
      expect(navegaciones).toEqual([`/my-account/security/mfa?returnUrl=${encodeURIComponent('/')}`]);
      expect(TestBed.inject(SessionStore).mfaEnrollment()).toBe('required');
    });

    it('con un token completo entra normal y la sesión no queda restringida', () => {
      completar('ana@alovida.mock');
      component.submit();
      http.expectOne('/iam/auth/login').flush(tokens(UN_TENANT));
      expect(navegaciones).toEqual(['/']);
      expect(TestBed.inject(SessionStore).mfaEnrollment()).not.toBe('required');
    });

    it('OUTSIDE_ALLOWED_HOURS dice que está fuera del horario laboral', () => {
      rechazar('OUTSIDE_ALLOWED_HOURS');
      expect(component.errorMessage()).toContain('horario laboral');
      expect(component.mfaRequired()).toBe(false);
    });

    it('OUTSIDE_ALLOWED_NETWORK, con el 401 que responde la API, manda a la red de la organización', () => {
      rechazar('OUTSIDE_ALLOWED_NETWORK');
      expect(component.errorMessage()).toContain('propia red');
      expect(component.mfaRequired()).toBe(false);
    });

    it('NETWORK_NOT_ALLOWED, el nombre que el front ya manejaba, dice lo mismo (también con 403)', () => {
      rechazar('NETWORK_NOT_ALLOWED', 403);
      expect(component.errorMessage()).toContain('propia red');
    });

    it('un bloqueo después de haber pedido el código vuelve a esconder el campo del código', () => {
      rechazar('MFA_REQUIRED');
      expect(component.mfaRequired()).toBe(true);
      rechazar('OUTSIDE_ALLOWED_HOURS');
      expect(component.mfaRequired()).toBe(false);
    });

    it('una contraseña equivocada sigue siendo «credenciales no válidas»', () => {
      completar('ana@alovida.mock');
      component.submit();
      http.expectOne('/iam/auth/login').flush({ statusCode: 401, code: 'UNAUTHENTICATED', message: 'x', timestamp: '', path: '' }, { status: 401, statusText: 'x' });
      expect(component.errorMessage()).toBe('Las credenciales no son válidas.');
    });

    it('un login con dispositivo nuevo enciende el aviso del armazón', () => {
      completar('lucia@alovida.mock');
      component.submit();
      http.expectOne('/iam/auth/login').flush({ ...tokens(UN_TENANT), newDevice: { deviceId: 'd-1', label: 'Chrome en Windows', occurredAt: '2026-10-30T13:00:00Z' } });
      expect(TestBed.inject(NewDeviceAlert).notice()).toMatchObject({ deviceId: 'd-1', label: 'Chrome en Windows' });
    });

    it('un login normal no lo enciende', () => {
      completar('ana@alovida.mock');
      component.submit();
      http.expectOne('/iam/auth/login').flush(tokens(UN_TENANT));
      expect(TestBed.inject(NewDeviceAlert).notice()).toBeNull();
    });
  });
});
