import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

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

describe('RegisterPatient', () => {
  let fixture: ComponentFixture<RegisterPatient>;
  let component: RegisterPatient;
  let http: HttpTestingController;
  let navegaciones: string[];

  beforeEach(async () => {
    navegaciones = [];

    await TestBed.configureTestingModule({
      imports: [RegisterPatient],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Router real: la plantilla tiene `routerLink` y necesita su contexto.
        provideRouter([]),
        { provide: RefreshTokenStorage, useClass: AlmacenFalso },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    router.navigateByUrl = ((url: string) => {
      navegaciones.push(String(url));
      return Promise.resolve(true);
    }) as Router['navigateByUrl'];

    fixture = TestBed.createComponent(RegisterPatient);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  function completar(extra: Partial<Record<'email', string>> = {}): void {
    component.formPaciente.setValue({
      nationalId: '1234567',
      displayName: 'Ana Paz',
      password: 'secreto12',
      email: extra.email ?? '',
    });
  }

  function completarProfesional(extra: Partial<Record<'professionalTitle' | 'phone', string>> = {}): void {
    component.cambiarTipo('profesional');
    component.formProfesional.setValue({
      displayName: 'Dra. Ana Paz',
      email: 'ana@hospital.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      credentialNumber: 'TIT-6789',
      professionalTitle: extra.professionalTitle ?? '',
      phone: extra.phone ?? '',
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
    expect(navegaciones).toEqual([]);
  });

  it('el botón de la confirmación lleva al login', () => {
    completar();
    component.submit();
    http.expectOne('/iam/auth/register-patient').flush(RESPUESTA);

    component.goToLogin();

    expect(navegaciones).toEqual(['/auth']);
  });

  describe('alta de profesional', () => {
    it('va a otro endpoint y manda los cinco campos obligatorios', () => {
      completarProfesional();
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.method).toBe('POST');
      // El identificador de acceso es el correo, no el documento.
      expect(req.request.body).toEqual({
        displayName: 'Dra. Ana Paz',
        email: 'ana@hospital.test',
        password: 'secreto12',
        licenseNumber: 'MP-12345',
        credentialNumber: 'TIT-6789',
      });

      req.flush({ userId: 'u', personId: 'p', practitionerProfileId: 'pp', practitionerCode: 'PRO-1' });
    });

    it('agrega título y teléfono solo si se completaron', () => {
      completarProfesional({ professionalTitle: 'Cardiología', phone: '+591 70012345' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.professionalTitle).toBe('Cardiología');
      expect(req.request.body.phone).toBe('+591 70012345');

      req.flush({ userId: 'u', personId: 'p', practitionerProfileId: 'pp', practitionerCode: 'PRO-1' });
    });

    it('exige matrícula y credencial: sin habilitación no hay alta', () => {
      component.cambiarTipo('profesional');
      component.formProfesional.setValue({
        displayName: 'Ana',
        email: 'ana@hospital.test',
        password: 'secreto12',
        licenseNumber: '',
        credentialNumber: '',
        professionalTitle: '',
        phone: '',
      });
      component.submit();

      expect(component.formProfesional.controls.licenseNumber.touched).toBe(true);
      // El verify() confirma que no se gastó un viaje.
    });

    it('la confirmación dice que se entra con el correo, no con el documento', () => {
      completarProfesional();
      component.submit();
      http
        .expectOne('/iam/auth/register-practitioner')
        .flush({ userId: 'u', personId: 'p', practitionerProfileId: 'pp', practitionerCode: 'PRO-1' });

      expect(component.registered()).toBe(true);
      expect(component.accessHint()).toBe('tu correo');
    });
  });

  describe('validaciones', () => {
    it('no envía con el formulario incompleto', () => {
      component.formPaciente.setValue({
        nationalId: '',
        displayName: '',
        password: '',
        email: '',
      });
      component.submit();

      expect(component.formPaciente.controls.nationalId.touched).toBe(true);
    });

    it('rechaza un documento con caracteres que el backend no admite', () => {
      component.formPaciente.setValue({
        nationalId: 'ABC 123',
        displayName: 'Ana',
        password: 'secreto12',
        email: '',
      });

      // Mismo `@Matches` que el DTO: letras, dígitos, punto y guion.
      expect(component.formPaciente.controls.nationalId.invalid).toBe(true);
    });

    it('exige los 8 caracteres de contraseña que pide el backend', () => {
      component.formPaciente.setValue({
        nationalId: '1234567',
        displayName: 'Ana',
        password: 'corta',
        email: '',
      });

      expect(component.formPaciente.controls.password.invalid).toBe(true);
    });

    it('cambiar de tipo limpia el error del formulario anterior', () => {
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(null, { status: 409, statusText: 'Conflict' });
      expect(component.errorMessage()).not.toBeNull();

      component.cambiarTipo('profesional');

      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('errores', () => {
    it('CONFLICT muestra el mensaje que manda la API', () => {
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(
        {
          code: 'CONFLICT',
          message: 'Ya existe una cuenta con ese documento',
          timestamp: 't',
          path: '/iam/auth/register-patient',
        },
        { status: 409, statusText: 'Conflict' },
      );

      // El texto sale del catálogo, no de una redacción nuestra: el backend
      // declara `message` como el mensaje de negocio.
      expect(component.errorMessage()).toBe('Ya existe una cuenta con ese documento');
      expect(component.registered()).toBe(false);
    });

    it('VALIDATION_FAILED expone el primer problema de la lista', () => {
      completar();
      component.submit();
      http.expectOne('/iam/auth/register-patient').flush(
        {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: { messages: ['password is too short'] },
          timestamp: 't',
          path: '/iam/auth/register-patient',
        },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(component.errorMessage()).toBe('password is too short');
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
