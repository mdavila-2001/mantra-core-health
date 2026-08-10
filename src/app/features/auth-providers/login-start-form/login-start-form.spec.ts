import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LoginStartForm } from './login-start-form';

const ORGANIZACION = '17171717-1717-1717-1717-171717171717';

const INICIADO = {
  attemptId: 'a-1',
  state: 'state-opaco',
  nonce: 'nonce-opaco',
  authorizeUrl: 'https://idp.example/authorize?state=state-opaco',
  pkceRequired: true,
};

describe('LoginStartForm', () => {
  let fixture: ComponentFixture<LoginStartForm>;
  let component: LoginStartForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginStartForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginStartForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  function formulario(): { patchValue: (v: object) => void } {
    return interno<{ patchValue: (v: object) => void }>('form');
  }

  it('el mínimo viaja con el entorno por defecto: la radio es una decisión que siempre está tomada', () => {
    formulario().patchValue({ providerCode: 'gob-oidc' });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/identity-providers/by-code/gob-oidc/authorize');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ environment: 'PRODUCTION' });

    req.flush(INICIADO);
    expect(interno<() => { state: string } | null>('started')()?.state).toBe('state-opaco');
  });

  it('con todo cargado viajan la organización, el entorno elegido y el rastro', () => {
    formulario().patchValue({
      providerCode: 'gob-oidc',
      tenantId: ORGANIZACION,
      ip: '10.0.0.7',
      userAgent: 'Mozilla/5.0',
    });
    interno<(v: unknown) => void>('elegirEntorno')('STAGING');

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/identity-providers/by-code/gob-oidc/authorize');
    expect(req.request.body).toEqual({
      tenantId: ORGANIZACION,
      environment: 'STAGING',
      ip: '10.0.0.7',
      userAgent: 'Mozilla/5.0',
    });

    req.flush(INICIADO);
  });

  it('sin código de proveedor no viaja nada: el intento no tiene contra quién salir', () => {
    formulario().patchValue({ tenantId: ORGANIZACION });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
