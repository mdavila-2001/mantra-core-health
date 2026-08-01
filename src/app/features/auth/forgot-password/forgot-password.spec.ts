import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  let fixture: ComponentFixture<ForgotPassword>;
  let component: ForgotPassword;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPassword);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  it('manda el identificador tal como lo pide el contrato', () => {
    component.form.setValue({ identifier: 'admin@mantra.test' });
    component.submit();

    const req = http.expectOne('/iam/auth/forgot-password');
    expect(req.request.method).toBe('POST');
    // Un solo campo: el backend acepta correo o documento indistintamente.
    expect(req.request.body).toEqual({ identifier: 'admin@mantra.test' });

    req.flush({ message: 'Si la cuenta existe, enviamos un enlace' });
  });

  it('acepta un documento igual que un correo', () => {
    component.form.setValue({ identifier: '1234567' });
    component.submit();

    const req = http.expectOne('/iam/auth/forgot-password');
    expect(req.request.body).toEqual({ identifier: '1234567' });

    req.flush({ message: 'ok' });
  });

  it('recorta los espacios', () => {
    component.form.setValue({ identifier: '  1234567  ' });
    component.submit();

    const req = http.expectOne('/iam/auth/forgot-password');
    expect(req.request.body).toEqual({ identifier: '1234567' });

    req.flush({ message: 'ok' });
  });

  it('tras enviar muestra el acuse', () => {
    component.form.setValue({ identifier: 'admin@mantra.test' });
    component.submit();
    http.expectOne('/iam/auth/forgot-password').flush({ message: 'ok' });

    expect(component.requested()).toBe(true);
  });

  it('el acuse NO revela si la cuenta existe', () => {
    component.form.setValue({ identifier: 'no-existe@mantra.test' });
    component.submit();
    http.expectOne('/iam/auth/forgot-password').flush({ message: 'ok' });

    // Mismo estado exista o no: lo contrario permitiria averiguar quien tiene
    // cuenta probando direcciones.
    expect(component.requested()).toBe(true);
    expect(component.errorMessage()).toBeNull();
  });

  it('no envía con el campo vacío', () => {
    component.form.setValue({ identifier: '' });
    component.submit();

    expect(component.form.controls.identifier.touched).toBe(true);
  });

  it('sin conexión lo dice como tal', () => {
    component.form.setValue({ identifier: 'admin@mantra.test' });
    component.submit();
    http
      .expectOne('/iam/auth/forgot-password')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(component.errorMessage()).toContain('conexión');
    expect(component.requested()).toBe(false);
  });

  it('429 usa el mensaje del catálogo de errores', () => {
    component.form.setValue({ identifier: 'admin@mantra.test' });
    component.submit();
    http.expectOne('/iam/auth/forgot-password').flush(
      { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes', timestamp: 't', path: '/x' },
      { status: 429, statusText: 'Too Many' },
    );

    expect(component.errorMessage()).toBe('Demasiadas solicitudes');
  });
});
