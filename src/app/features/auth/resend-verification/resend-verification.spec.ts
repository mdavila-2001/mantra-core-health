import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ResendVerification } from './resend-verification';

/**
 * V01-14. Lo que estas pruebas cuidan es de seguridad, no de maquetado: este
 * formulario **no puede volverse un modo de averiguar qué correos tienen
 * cuenta**, ni de mandar el token de una cuenta ajena a una bandeja propia.
 */
const RESPUESTA = { message: 'Si la cuenta existe, se envió el enlace.' };

describe('ResendVerification', () => {
  let fixture: ComponentFixture<ResendVerification>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResendVerification],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ResendVerification);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function completar(identifier = 'ana@mantra.test') {
    interno<{ setValue: (v: unknown) => void }>('form').setValue({ identifier });
  }

  function enviar() {
    interno<() => void>('submit')();
  }

  it('sin identificador no envía nada', () => {
    completar('');
    enviar();

    // `http.verify()` del afterEach falla si algo salió a la red.
    expect(interno<() => { status: string }>('state')().status).toBe('ready');
  });

  /**
   * Se manda el identificador con el que se inicia sesión, **no un correo de
   * destino**. Dejar elegir a dónde va el enlace convertiría el formulario en
   * un modo de enviar el token de una cuenta ajena a una bandeja propia.
   */
  it('manda el identificador y nada más: el destino lo decide el servidor', () => {
    completar('  ana@mantra.test  ');
    enviar();

    const req = http.expectOne('/iam/auth/resend-verification');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ identifier: 'ana@mantra.test' });

    req.flush(RESPUESTA);
  });

  it('acepta también el documento, no sólo el correo', () => {
    completar('4821133');
    enviar();

    http.expectOne('/iam/auth/resend-verification').flush(RESPUESTA);

    expect(interno<() => boolean>('done')()).toBe(true);
  });

  /**
   * El backend responde lo mismo exista o no la cuenta, y la pantalla lo
   * respeta: un mensaje distinto permitiría averiguar quién tiene cuenta
   * probando direcciones.
   */
  it('el éxito no afirma que la cuenta exista', () => {
    completar('nadie@mantra.test');
    enviar();
    http.expectOne('/iam/auth/resend-verification').flush(RESPUESTA);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(interno<() => boolean>('done')()).toBe(true);
    expect(texto).toContain('Si hay una cuenta');
    // Nada que confirme el envío como hecho: eso delataría la existencia.
    expect(texto).not.toContain('Te lo mandamos');
  });

  /**
   * El endpoint admite 5 intentos por minuto. Decirle «error» a quien
   * simplemente fue rápido lo invita a insistir, que es lo contrario de lo que
   * el límite busca.
   */
  it('el límite de intentos se muestra como espera, no como error', () => {
    completar();
    enviar();

    http.expectOne('/iam/auth/resend-verification').flush(
      { code: 'RATE_LIMITED', message: 'Demasiados intentos' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '45' } },
    );
    fixture.detectChanges();

    expect(interno<() => number | null>('esperaEnSegundos')()).toBe(45);
    // No se pinta además el error general: sería decir dos cosas del mismo fallo.
    expect(interno<() => string | null>('errorMessage')()).toBeNull();
  });

  it('un fallo de red sí se muestra como error', () => {
    completar();
    enviar();
    http
      .expectOne('/iam/auth/resend-verification')
      .error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    expect(interno<() => string | null>('errorMessage')()).toContain('conectarnos');
  });

  it('«probar con otro dato» limpia el formulario y vuelve al principio', () => {
    completar();
    enviar();
    http.expectOne('/iam/auth/resend-verification').flush(RESPUESTA);

    interno<() => void>('otroIntento')();

    expect(interno<() => boolean>('done')()).toBe(false);
  });

  it('no se envía dos veces mientras la primera está en vuelo', () => {
    completar();
    enviar();
    enviar();

    http.expectOne('/iam/auth/resend-verification').flush(RESPUESTA);
  });
});
