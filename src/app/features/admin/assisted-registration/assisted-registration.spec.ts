import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AssistedRegistration } from './assisted-registration';

/**
 * Acá se está creando una cuenta **a nombre de otra persona**, así que las
 * pruebas cubren lo que eso obliga: que no viaje ninguna contraseña, que el
 * motivo sea obligatorio y que el token de activación se muestre y se pueda
 * entregar.
 */
const RESPUESTA = {
  userId: 'u-2',
  activationToken: 'tok-abc-123',
  activationExpiresAt: '2026-08-05T14:30:00Z',
  status: 'PENDING_ACTIVATION',
};

describe('AssistedRegistration', () => {
  let fixture: ComponentFixture<AssistedRegistration>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssistedRegistration],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AssistedRegistration);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function completarFormulario(reason = 'Internada, sin acceso a un dispositivo propio') {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({
      name: 'Ana',
      middleName: '',
      lastName: 'Salas',
      motherLastName: '',
      email: 'ana@mantra.test',
      reason,
    });
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  it('sin motivo no se registra a nadie: es lo que justifica el alta', () => {
    completarFormulario('');
    enviar();

    // `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  it('el cuerpo lleva el motivo y NO lleva contraseña', () => {
    completarFormulario();
    enviar();

    const req = http.expectOne('/iam/users/assisted-registration');
    expect(req.request.body).toEqual({
      name: 'Ana',
      lastName: 'Salas',
      email: 'ana@mantra.test',
      reason: 'Internada, sin acceso a un dispositivo propio',
    });
    // Nadie fija la clave de otro: la elige el titular al activar.
    expect(req.request.body).not.toHaveProperty('password');

    req.flush(RESPUESTA);
  });

  it('un segundo envío en vuelo no crea una segunda cuenta', () => {
    completarFormulario();
    enviar();
    enviar();

    http.expectOne('/iam/users/assisted-registration').flush(RESPUESTA);
  });

  it('muestra el token, su caducidad en formato local y el aviso de un solo uso', () => {
    completarFormulario();
    enviar();
    http.expectOne('/iam/users/assisted-registration').flush(RESPUESTA);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(
      fixture.nativeElement.querySelector('[data-testid="alta-paciente-token"]').textContent,
    ).toContain('tok-abc-123');
    expect(texto).toContain('una sola vez');
    expect(texto).toContain('canal seguro');
    // DD/MM/AAAA y 24 h, como mandan las convenciones de UI.
    expect(texto).toContain('05/08/2026');
  });

  it('el token no se confunde con una contraseña', () => {
    completarFormulario();
    enviar();
    http.expectOne('/iam/users/assisted-registration').flush(RESPUESTA);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent as string).toContain(
      'No es una contraseña ni la reemplaza',
    );
  });

  it('el formulario desaparece cuando el token está en pantalla', () => {
    completarFormulario();
    enviar();
    http.expectOne('/iam/users/assisted-registration').flush(RESPUESTA);
    fixture.detectChanges();

    // Dejarlo visible invitaría a registrar de nuevo a la misma persona.
    expect(fixture.nativeElement.querySelector('[data-testid="alta-paciente-form"]')).toBeNull();
  });

  it('empezar otra alta saca el token de la vista', () => {
    completarFormulario();
    enviar();
    http.expectOne('/iam/users/assisted-registration').flush(RESPUESTA);
    fixture.detectChanges();

    interno<() => void>('altaNueva')();
    fixture.detectChanges();

    // El token es de un solo uso: no se queda en pantalla para la siguiente alta.
    expect(fixture.nativeElement.querySelector('[data-testid="alta-paciente-token"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="alta-paciente-form"]'),
    ).not.toBeNull();
  });

  it('sin permiso lo dice con el mensaje del backend, no con un error genérico', () => {
    completarFormulario();
    enviar();

    http.expectOne('/iam/users/assisted-registration').flush(
      {
        code: 'FORBIDDEN',
        message: 'Necesitás el rol SECURITY_ADMIN para registrar pacientes.',
        timestamp: '2026-08-04T10:00:00Z',
        path: '/iam/users/assisted-registration',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(interno<() => string | null>('errorMessage')()).toContain('SECURITY_ADMIN');
  });
});
