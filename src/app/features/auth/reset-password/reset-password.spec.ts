import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { ResetPassword, RESET_TOKEN_PARAM } from './reset-password';

describe('ResetPassword', () => {
  let fixture: ComponentFixture<ResetPassword>;
  let backend: HttpTestingController;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function crear(queryParams: Record<string, string>): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResetPassword);
    await fixture.whenStable();
  }

  async function escribirYEnviar(clave: string): Promise<void> {
    const input = root().querySelector<HTMLInputElement>('app-input input');
    if (input === null) {
      throw new Error('no se encontró el campo de la contraseña');
    }
    input.value = clave;
    input.dispatchEvent(new Event('input'));
    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  afterEach(() => {
    backend.verify();
  });

  describe('sin token en la URL', () => {
    it('no muestra el formulario: no habría con qué enviarlo', async () => {
      await crear({});

      expect(root().querySelector('form')).toBeNull();
      expect(root().textContent).toContain('El enlace está incompleto');
    });

    it('ofrece pedir un enlace nuevo', async () => {
      await crear({});

      expect(root().textContent).toContain('Pedir un enlace nuevo');
    });
  });

  describe('con token', () => {
    beforeEach(async () => {
      await crear({ [RESET_TOKEN_PARAM]: 'tok-del-correo' });
    });

    it('el token no se muestra en pantalla: es una credencial de un solo uso', () => {
      expect(root().textContent).not.toContain('tok-del-correo');
      expect(root().querySelector('input[value="tok-del-correo"]')).toBeNull();
    });

    it('una contraseña corta no sale a la API', async () => {
      // El backend exige 8; validarlo acá evita un 400 que se puede prevenir.
      await escribirYEnviar('corta');

      expect(root().textContent).toContain('al menos 8 caracteres');
      // `backend.verify()` del afterEach falla si hubiera salido alguna petición.
    });

    it('manda el token de la URL junto con la contraseña nueva', async () => {
      await escribirYEnviar('Una-clave-larga-1');

      const peticion = backend.expectOne('/iam/auth/reset-password');
      expect(peticion.request.body).toEqual({
        token: 'tok-del-correo',
        newPassword: 'Una-clave-larga-1',
      });

      peticion.flush({ userId: 'u-1', revokedSessions: 0 });
    });

    it('avisa que se cerraron las sesiones abiertas', async () => {
      await escribirYEnviar('Una-clave-larga-1');
      backend.expectOne('/iam/auth/reset-password').flush({ userId: 'u-1', revokedSessions: 3 });
      await fixture.whenStable();

      // Quien recupera su cuenta suele hacerlo porque perdió el control de la anterior: enterarse
      // de que las demás sesiones se cerraron es parte de la respuesta.
      expect(root().textContent).toContain('3');
      expect(root().textContent).toContain('se cerraron las sesiones');
    });

    it('sin sesiones que cerrar no inventa un número', async () => {
      await escribirYEnviar('Una-clave-larga-1');
      backend.expectOne('/iam/auth/reset-password').flush({ userId: 'u-1', revokedSessions: 0 });
      await fixture.whenStable();

      expect(root().textContent).toContain('Ya podés ingresar con la contraseña nueva');
      expect(root().textContent).not.toContain('se cerraron las sesiones');
    });

    it('un token vencido se explica y ofrece pedir otro', async () => {
      await escribirYEnviar('Una-clave-larga-1');

      backend
        .expectOne('/iam/auth/reset-password')
        .flush(
          { code: 'VALIDATION_FAILED', message: 'El enlace expiró o ya fue usado.' },
          { status: 400, statusText: 'Bad Request' },
        );
      await fixture.whenStable();

      expect(root().textContent).toContain('El enlace expiró o ya fue usado.');
      expect(root().textContent).toContain('Pedir un enlace nuevo');
    });
  });
});
