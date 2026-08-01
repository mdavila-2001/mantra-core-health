import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';

import { RegisterPatient } from './register-patient';
import { RefreshTokenStorage } from '../../../core/auth/refresh-token.storage';

const RESPUESTA = {
  userId: 'u-1',
  personId: 'p-1',
  patientProfileId: 'pp-1',
  patientCode: 'PAC-1',
  emailVerificationSent: false,
};

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

describe('RegisterPatient', () => {
  let fixture: ComponentFixture<RegisterPatient>;
  let component: RegisterPatient;
  let http: HttpTestingController;
  let router: RouterEspia;

  beforeEach(async () => {
    router = new RouterEspia();

    await TestBed.configureTestingModule({
      imports: [RegisterPatient],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RefreshTokenStorage, useClass: AlmacenFalso },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPatient);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  function completar(extra: Partial<Record<'email', string>> = {}): void {
    component.form.setValue({
      nationalId: '1234567',
      displayName: 'Ana Paz',
      password: 'secreto12',
      email: extra.email ?? '',
    });
  }

  it('manda solo los tres campos obligatorios cuando no hay correo', () => {
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.method).toBe('POST');
    // Un correo vacío no es lo mismo que no mandar el campo:
    // `forbidNonWhitelisted` rechaza lo que sobra.
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      displayName: 'Ana Paz',
      password: 'secreto12',
    });

    req.flush(RESPUESTA);
  });

  it('incluye el correo cuando se completó', () => {
    completar({ email: 'ana@mantra.test' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body.email).toBe('ana@mantra.test');

    req.flush({ ...RESPUESTA, emailVerificationSent: true });

    expect(component.verificationSent()).toBe(true);
  });

  it('tras registrar muestra la confirmación y NO inicia sesión sola', () => {
    completar();
    component.submit();
    http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);

    expect(component.registered()).toBe(true);
    // El backend devuelve el perfil, no tokens: entrar solo exigiría un segundo
    // viaje con las credenciales recién escritas.
    expect(router.navegaciones).toEqual([]);
  });

  it('el botón de la confirmación lleva al login', () => {
    completar();
    component.submit();
    http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);

    component.goToLogin();

    expect(router.navegaciones).toEqual(['/auth']);
  });

  describe('validaciones', () => {
    it('no envía con el formulario incompleto', () => {
      component.form.setValue({ nationalId: '', displayName: '', password: '', email: '' });
      component.submit();

      expect(component.form.controls.nationalId.touched).toBe(true);
    });

    it('rechaza un documento con caracteres que el backend no admite', () => {
      component.form.setValue({
        nationalId: 'ABC 123',
        displayName: 'Ana',
        password: 'secreto12',
        email: '',
      });

      // Mismo `@Matches` que el DTO: letras, dígitos, punto y guion.
      expect(component.form.controls.nationalId.invalid).toBe(true);
    });

    it('exige los 8 caracteres de contraseña que pide el backend', () => {
      component.form.setValue({
        nationalId: '1234567',
        displayName: 'Ana',
        password: 'corta',
        email: '',
      });

      expect(component.form.controls.password.invalid).toBe(true);
    });
  });

  describe('errores', () => {
    it('409 dice que el documento ya existe', () => {
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(null, { status: 409, statusText: 'Conflict' });

      expect(component.errorMessage()).toContain('Ya existe una cuenta con ese documento');
      expect(component.registered()).toBe(false);
    });

    it('400 pide revisar los datos', () => {
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(null, { status: 400, statusText: 'Bad Request' });

      expect(component.errorMessage()).toContain('Revisá los datos');
    });

    it('sin conexión lo dice como tal', () => {
      completar();
      component.submit();
      http
        .expectOne('/iam/auth/register-patient')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

      expect(component.errorMessage()).toContain('conexión');
    });
  });
});
