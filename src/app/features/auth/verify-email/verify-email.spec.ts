import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { VerifyEmail } from './verify-email';

class RouterEspia {
  readonly navegaciones: string[] = [];
  navigateByUrl(url: string): Promise<boolean> {
    this.navegaciones.push(url);
    return Promise.resolve(true);
  }
}

/** Monta el componente con el token que traería el enlace del correo. */
async function montar(
  token: string | null,
): Promise<{ fixture: ComponentFixture<VerifyEmail>; http: HttpTestingController; router: RouterEspia }> {
  const router = new RouterEspia();

  await TestBed.configureTestingModule({
    imports: [VerifyEmail],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(token === null ? {} : { token }),
          },
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(VerifyEmail);
  const http = TestBed.inject(HttpTestingController);
  await fixture.whenStable();

  return { fixture, http, router };
}

describe('VerifyEmail', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('canjea el token del enlace y confirma', async () => {
    const { fixture, http } = await montar('tok-123');

    const req = http.expectOne('/iam/auth/verify-email');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok-123' });
    req.flush({ userId: 'u-1', emailVerified: true });

    expect(fixture.componentInstance.estado()).toBe('verificado');
    http.verify();
  });

  it('sin token no pide nada y lo dice', async () => {
    const { fixture, http } = await montar(null);

    expect(fixture.componentInstance.estado()).toBe('sin-token');
    // verify() confirma que no salió ninguna petición.
    http.verify();
  });

  it('un token vencido o ya usado no se presenta como una alarma', async () => {
    const { fixture, http } = await montar('tok-vencido');

    http.expectOne('/iam/auth/verify-email').flush(null, { status: 400, statusText: 'Bad Request' });

    // La cuenta ya está activa desde el registro: verificar es opcional, así que
    // el fallo no significa haber perdido acceso a nada.
    expect(fixture.componentInstance.estado()).toBe('invalido');
    http.verify();
  });

  /*
   * Un corte de red o un 500 no dicen nada del enlace. Antes los dos caían en
   * «Ese enlace ya no sirve», y quien leía eso descartaba un enlace bueno de un
   * solo uso (hallazgo del 2026-10-08).
   */
  it.each([
    ['sin conexión', 0],
    ['el servidor falló', 503],
    ['demasiados intentos', 429],
  ])('%s: no lo declara inválido y ofrece intentar de nuevo', async (_caso, status) => {
    const { fixture, http } = await montar('tok-bueno');

    http
      .expectOne('/iam/auth/verify-email')
      .flush(
        status === 0 ? null : { code: 'INTERNAL', message: 'boom', correlationId: 'corr-ver' },
        { status, statusText: 'Error' },
      );
    fixture.detectChanges();

    expect(fixture.componentInstance.estado()).toBe('no-se-pudo');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="verificar-invalido"]')).toBeNull();
    expect(el.querySelector('[data-testid="verificar-reintentar"]')).not.toBeNull();
    http.verify();
  });

  it('el fallo del servidor lleva el código de soporte', async () => {
    const { fixture, http } = await montar('tok-bueno');

    http
      .expectOne('/iam/auth/verify-email')
      .flush(
        { code: 'INTERNAL', message: 'boom', correlationId: 'corr-ver' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="verificar-motivo"]')
        ?.textContent,
    ).toContain('(Código de soporte: corr-ver)');
    http.verify();
  });

  it('reintentar vuelve a canjear el mismo token y, si sirve, confirma', async () => {
    const { fixture, http } = await montar('tok-bueno');
    http.expectOne('/iam/auth/verify-email').flush(null, { status: 0, statusText: 'Unknown Error' });

    fixture.componentInstance.reintentar();
    const otra = http.expectOne('/iam/auth/verify-email');
    expect(otra.request.body).toEqual({ token: 'tok-bueno' });
    otra.flush({ userId: 'u-1', emailVerified: true });

    expect(fixture.componentInstance.estado()).toBe('verificado');
    http.verify();
  });

  it('si la API responde emailVerified false tampoco lo da por bueno', async () => {
    const { fixture, http } = await montar('tok-raro');

    http.expectOne('/iam/auth/verify-email').flush({ userId: 'u-1', emailVerified: false });

    expect(fixture.componentInstance.estado()).toBe('invalido');
    http.verify();
  });

  it('desde cualquier desenlace se puede ir al login', async () => {
    const { fixture, http, router } = await montar('tok-123');

    http.expectOne('/iam/auth/verify-email').flush({ userId: 'u-1', emailVerified: true });
    fixture.componentInstance.goToLogin();

    expect(router.navegaciones).toEqual(['/auth']);
    http.verify();
  });
});
