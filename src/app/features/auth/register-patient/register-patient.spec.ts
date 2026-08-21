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

    // El alta de profesional pide el catálogo de departamentos bolivianos al
    // arrancar (`VS_ADMINISTRATIVE_AREA`, el departamento que expidió el CI).
    // Se drena acá: no es lo que ninguna de estas pruebas mira, y sin drenarlo
    // el `http.verify()` del `afterEach` tumba el archivo entero.
    for (const pedido of http.match(
      (r) => r.url === '/terminology/value-sets' && r.params.get('code') === 'VS_ADMINISTRATIVE_AREA',
    )) {
      pedido.flush({ items: [] });
    }
  });

  afterEach(() => {
    http.verify();
  });

  /**
   * El nombre va en sus cuatro partes, como el documento de identidad. Las dos
   * opcionales se completan acá para que el caso normal las ejerza; el que
   * comprueba que se omiten cuando están vacías es su propia prueba.
   */
  function completar(
    extra: Partial<Record<'email' | 'middleName' | 'motherLastName', string>> = {},
  ): void {
    component.formPaciente.setValue({
      nationalId: '1234567',
      name: 'Ana',
      middleName: extra.middleName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      password: 'secreto12',
      email: extra.email ?? '',
    });
  }

  function completarProfesional(
    extra: Partial<
      Record<
        | 'professionalTitle'
        | 'phone'
        | 'middleName'
        | 'motherLastName'
        | 'nationalId'
        | 'regulatoryAuthority',
        string
      >
    > = {},
  ): void {
    component.cambiarTipo('profesional');
    component.formProfesional.setValue({
      name: 'Ana',
      middleName: extra.middleName ?? '',
      lastName: 'Paz',
      motherLastName: extra.motherLastName ?? '',
      nationalId: extra.nationalId ?? '',
      email: 'ana@hospital.test',
      password: 'secreto12',
      licenseNumber: 'MP-12345',
      credentialNumber: 'TIT-6789',
      regulatoryAuthority: extra.regulatoryAuthority ?? '',
      professionalTitle: extra.professionalTitle ?? '',
      phone: extra.phone ?? '',
    });
  }

  it('manda solo los campos obligatorios cuando no hay correo ni nombres opcionales', () => {
    completar();
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.method).toBe('POST');
    // Un correo vacío no es lo mismo que no mandar el campo:
    // `forbidNonWhitelisted` rechaza lo que sobra. Mismo criterio para el
    // segundo nombre y el apellido materno, que mucha gente no tiene.
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      lastName: 'Paz',
      password: 'secreto12',
    });

    req.flush(RESPUESTA);
  });

  /**
   * El backend compone el nombre visible con las cuatro partes: si el frontend
   * mandara una cadena ya armada, la base guardaría una versión y el contrato
   * otra.
   */
  it('manda el segundo nombre y el apellido materno cuando se completaron', () => {
    completar({ middleName: 'María', motherLastName: 'Quiroga' });
    component.submit();

    const req = http.expectOne('/iam/auth/register-patient');
    expect(req.request.body).toEqual({
      nationalId: '1234567',
      name: 'Ana',
      middleName: 'María',
      lastName: 'Paz',
      motherLastName: 'Quiroga',
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
      // El identificador de acceso es el correo, no el documento. El nombre va
      // en partes, igual que en el alta de paciente.
      expect(req.request.body).toEqual({
        name: 'Ana',
        lastName: 'Paz',
        email: 'ana@hospital.test',
        password: 'secreto12',
        licenseNumber: 'MP-12345',
        credentialNumber: 'TIT-6789',
      });

      req.flush({ userId: 'u', personId: 'p', practitionerProfileId: 'pp', practitionerCode: 'PRO-1' });
    });

    it('agrega segundo nombre y apellido materno solo si se completaron', () => {
      completarProfesional({ middleName: 'Lucía', motherLastName: 'Rojas' });
      component.submit();

      const req = http.expectOne('/iam/auth/register-practitioner');
      expect(req.request.body.middleName).toBe('Lucía');
      expect(req.request.body.motherLastName).toBe('Rojas');

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
        name: 'Ana',
        middleName: '',
        lastName: 'Paz',
        motherLastName: '',
        nationalId: '',
        email: 'ana@hospital.test',
        password: 'secreto12',
        licenseNumber: '',
        credentialNumber: '',
        regulatoryAuthority: '',
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
        name: '',
        middleName: '',
        lastName: '',
        motherLastName: '',
        password: '',
        email: '',
      });
      component.submit();

      expect(component.formPaciente.controls.nationalId.touched).toBe(true);
    });

    it('rechaza un documento con caracteres que el backend no admite', () => {
      component.formPaciente.setValue({
        nationalId: 'ABC 123',
        name: 'Ana',
        middleName: '',
        lastName: 'Paz',
        motherLastName: '',
        password: 'secreto12',
        email: '',
      });

      // Mismo `@Matches` que el DTO: letras, dígitos, punto y guion.
      expect(component.formPaciente.controls.nationalId.invalid).toBe(true);
    });

    it('exige los 8 caracteres de contraseña que pide el backend', () => {
      component.formPaciente.setValue({
        nationalId: '1234567',
        name: 'Ana',
        middleName: '',
        lastName: 'Paz',
        motherLastName: '',
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
