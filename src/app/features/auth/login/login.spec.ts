import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';

import { Login } from './login';
import { HOME_PATH, RETURN_URL_PARAM, TENANT_SELECTION_PATH } from '../../../core/auth/auth.guard';
import { SessionStorage } from '../../../core/auth/session.storage';

function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma-no-verificada`;
}

const UN_TENANT = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1'] });
const DOS_TENANTS = makeToken({ sub: 'u-1', sid: 's-1', roles: ['USER'], tenants: ['t-1', 't-2'] });

const SESION_OK = {
  accessToken: UN_TENANT,
  refreshToken: 'r-1',
  expiresAt: '2026-08-31T06:40:40.060Z',
};

/** No toca `localStorage` real: dejaría estado entre pruebas. */
const almacenamientoNulo = {
  readRefreshToken: () => null,
  writeRefreshToken: () => undefined,
  readTenantId: () => null,
  writeTenantId: () => undefined,
  clear: () => undefined,
};

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let backend: HttpTestingController;
  let navegaciones: string[];

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * Los `<input>` de los `app-input`, en orden: identificador y contraseña.
   *
   * Se busca dentro de `app-input` y no por `<label for>` a propósito: los radios de «Ingresá con»
   * también llevan un label que dice «Correo electrónico», así que buscar por texto devolvería el
   * radio en vez del campo.
   */
  function campos(): readonly HTMLInputElement[] {
    return Array.from(root().querySelectorAll<HTMLInputElement>('app-input input'));
  }

  function campoIdentificador(): HTMLInputElement {
    const input = campos()[0];
    if (input === undefined) {
      throw new Error('no se encontró el campo del identificador');
    }
    return input;
  }

  function campoContrasena(): HTMLInputElement {
    const input = campos()[1];
    if (input === undefined) {
      throw new Error('no se encontró el campo de la contraseña');
    }
    return input;
  }

  /** El label del `app-form-field` que envuelve al identificador. */
  function etiquetaIdentificador(): string {
    const id = campoIdentificador().id;
    return root().querySelector(`label[for="${id}"]`)?.textContent?.trim() ?? '';
  }

  function escribir(input: HTMLInputElement, valor: string): void {
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  async function crear(queryParams: Record<string, string> = {}): Promise<void> {
    navegaciones = [];

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStorage, useValue: almacenamientoNulo },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    router.navigateByUrl = (url: string): Promise<boolean> => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    };

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
  });

  describe('elección del identificador', () => {
    it('arranca en correo y el campo lo dice', async () => {
      await crear();

      expect(etiquetaIdentificador()).toContain('Correo electrónico');
      expect(campoIdentificador().type).toBe('email');
    });

    it('al elegir documento cambia la etiqueta y el tipo del campo', async () => {
      await crear();

      const radios = Array.from(root().querySelectorAll<HTMLInputElement>('input[type="radio"]'));
      radios[1]?.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(etiquetaIdentificador()).toContain('Documento de identidad');
      // `type="text"` y no `email`: el navegador rechazaría un documento sin arroba.
      expect(campoIdentificador().type).toBe('text');
    });
  });

  describe('envío', () => {
    it('el formulario vacío no llega a la API', async () => {
      await crear();

      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      // `backend.verify()` del afterEach falla si hubiera salido alguna petición.
      expect(root().textContent).toContain('Ingresar');
    });

    it('manda solo el identificador elegido, nunca los dos', async () => {
      await crear();

      escribir(campoIdentificador(), '  admin@redesa.test  ');
      escribir(campoContrasena(), 'S3cret-passw0rd');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      const peticion = backend.expectOne('/iam/auth/login');
      // Los espacios de más se recortan: pegar un correo desde otra pantalla los arrastra.
      expect(peticion.request.body).toEqual({
        email: 'admin@redesa.test',
        password: 'S3cret-passw0rd',
      });
      expect(peticion.request.body).not.toHaveProperty('nationalId');

      peticion.flush(SESION_OK);
    });

    it('con una sola organización entra directo al panel', async () => {
      await crear();

      escribir(campoIdentificador(), 'admin@redesa.test');
      escribir(campoContrasena(), 'x');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectOne('/iam/auth/login').flush(SESION_OK);
      await fixture.whenStable();

      expect(navegaciones).toEqual([HOME_PATH]);
    });

    it('con varias organizaciones pasa por la elección antes del panel', async () => {
      await crear();

      escribir(campoIdentificador(), 'admin@redesa.test');
      escribir(campoContrasena(), 'x');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectOne('/iam/auth/login').flush({ ...SESION_OK, accessToken: DOS_TENANTS });
      await fixture.whenStable();

      expect(navegaciones).toEqual([TENANT_SELECTION_PATH]);
    });
  });

  describe('errores', () => {
    it('muestra lo que dijo la API, sin redactar un texto propio', async () => {
      await crear();

      escribir(campoIdentificador(), 'admin@redesa.test');
      escribir(campoContrasena(), 'mala');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      // Respuesta real de la API, capturada el 2026-08-01.
      backend.expectOne('/iam/auth/login').flush(
        {
          code: 'UNAUTHENTICATED',
          message: 'Credenciales inválidas',
          correlationId: 9451,
        },
        { status: 401, statusText: 'Unauthorized' },
      );
      await fixture.whenStable();

      expect(root().textContent).toContain('Credenciales inválidas');
      expect(navegaciones).toEqual([]);
    });

    it('lista una línea por violación cuando la API manda varias', async () => {
      await crear();

      escribir(campoIdentificador(), 'no-es-un-correo');
      escribir(campoContrasena(), 'x');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectOne('/iam/auth/login').flush(
        {
          code: 'VALIDATION_FAILED',
          message: 'Error de validación',
          details: { violations: ['email must be an email', 'password is too short'] },
        },
        { status: 400, statusText: 'Bad Request' },
      );
      await fixture.whenStable();

      expect(root().querySelectorAll('.login__issues li')).toHaveLength(2);
    });

    it('un servidor inalcanzable se explica, no se queda mudo', async () => {
      await crear();

      escribir(campoIdentificador(), 'admin@redesa.test');
      escribir(campoContrasena(), 'x');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectOne('/iam/auth/login').error(new ProgressEvent('error'), { status: 0 });
      await fixture.whenStable();

      expect(root().textContent).toContain('No se pudo contactar al servidor');
    });
  });

  describe('ruta de retorno', () => {
    it('vuelve a la pantalla que la persona había pedido', async () => {
      await crear({ [RETURN_URL_PARAM]: '/panel/pacientes/42' });

      escribir(campoIdentificador(), 'admin@redesa.test');
      escribir(campoContrasena(), 'x');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectOne('/iam/auth/login').flush(SESION_OK);
      await fixture.whenStable();

      expect(navegaciones).toEqual(['/panel/pacientes/42']);
    });

    it('ignora una ruta externa: no es un redirector abierto', async () => {
      await crear({ [RETURN_URL_PARAM]: 'https://sitio-ajeno.example/login' });

      escribir(campoIdentificador(), 'admin@redesa.test');
      escribir(campoContrasena(), 'x');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectOne('/iam/auth/login').flush(SESION_OK);
      await fixture.whenStable();

      expect(navegaciones).toEqual([HOME_PATH]);
    });

    it('ignora también la forma sin protocolo, que el navegador sí resuelve', async () => {
      await crear({ [RETURN_URL_PARAM]: '//sitio-ajeno.example/login' });

      escribir(campoIdentificador(), 'admin@redesa.test');
      escribir(campoContrasena(), 'x');
      root().querySelector('form')?.dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      backend.expectOne('/iam/auth/login').flush(SESION_OK);
      await fixture.whenStable();

      expect(navegaciones).toEqual([HOME_PATH]);
    });
  });
});
