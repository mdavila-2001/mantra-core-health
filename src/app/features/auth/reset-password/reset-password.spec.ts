import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { ResetPassword } from './reset-password';

class RouterEspia {
  readonly navegaciones: string[] = [];
  navigateByUrl(url: string): Promise<boolean> {
    this.navegaciones.push(url);
    return Promise.resolve(true);
  }
}

/** Monta la pantalla con el token que traería el enlace del correo. */
async function montar(token: string | null): Promise<{
  fixture: ComponentFixture<ResetPassword>;
  http: HttpTestingController;
  router: RouterEspia;
}> {
  const router = new RouterEspia();

  await TestBed.configureTestingModule({
    imports: [ResetPassword],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(token === null ? {} : { token }) },
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(ResetPassword);
  const http = TestBed.inject(HttpTestingController);
  await fixture.whenStable();

  return { fixture, http, router };
}

describe('ResetPassword', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sin token no ofrece el formulario', async () => {
    const { fixture, http } = await montar(null);

    expect(fixture.componentInstance.hasToken).toBe(false);
    http.verify();
  });

  it('manda el token del enlace junto con la contraseña nueva', async () => {
    const { fixture, http } = await montar('tok-123');
    fixture.componentInstance.form.setValue({ newPassword: 'nueva-clave-1' });
    fixture.componentInstance.submit();

    const req = http.expectOne('/iam/auth/reset-password');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok-123', newPassword: 'nueva-clave-1' });

    req.flush({ userId: 'u-1', revokedSessions: 0 });
    http.verify();
  });

  it('informa cuántas sesiones se cerraron', async () => {
    const { fixture, http } = await montar('tok-123');
    fixture.componentInstance.form.setValue({ newPassword: 'nueva-clave-1' });
    fixture.componentInstance.submit();

    http.expectOne('/iam/auth/reset-password').flush({ userId: 'u-1', revokedSessions: 3 });

    // Es informacion de seguridad: quien cambio la clave por sospecha quiere
    // saber que las otras sesiones se cerraron.
    expect(fixture.componentInstance.done()).toBe(true);
    expect(fixture.componentInstance.revokedSessions()).toBe(3);
    http.verify();
  });

  it('exige los 8 caracteres que pide el backend', async () => {
    const { fixture, http } = await montar('tok-123');
    fixture.componentInstance.form.setValue({ newPassword: 'corta' });
    fixture.componentInstance.submit();

    expect(fixture.componentInstance.form.invalid).toBe(true);
    // El verify() confirma que no se gasto un viaje.
    http.verify();
  });

  it('un token vencido muestra el error y no da por hecho el cambio', async () => {
    const { fixture, http } = await montar('tok-vencido');
    fixture.componentInstance.form.setValue({ newPassword: 'nueva-clave-1' });
    fixture.componentInstance.submit();

    http.expectOne('/iam/auth/reset-password').flush(
      { code: 'VALIDATION_FAILED', message: 'El enlace venció', timestamp: 't', path: '/x' },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(fixture.componentInstance.done()).toBe(false);
    expect(fixture.componentInstance.errorMessage()).toBe('El enlace venció');
    http.verify();
  });

  it('desde el final se puede ir al login', async () => {
    const { fixture, http, router } = await montar('tok-123');
    fixture.componentInstance.form.setValue({ newPassword: 'nueva-clave-1' });
    fixture.componentInstance.submit();
    http.expectOne('/iam/auth/reset-password').flush({ userId: 'u-1', revokedSessions: 0 });

    fixture.componentInstance.goToLogin();

    expect(router.navegaciones).toEqual(['/auth']);
    http.verify();
  });
});
