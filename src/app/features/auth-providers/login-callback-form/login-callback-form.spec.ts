import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LoginCallbackForm } from './login-callback-form';

const ORGANIZACION = '18181818-1818-1818-1818-181818181818';
const USUARIO = '19191919-1919-1919-1919-191919191919';

const PROCESADO = {
  outcomeConceptId: 'desenlace-uuid',
  provisioned: false,
  attemptId: 'a-2',
  linkToken: 'token-de-vinculo',
};

describe('LoginCallbackForm', () => {
  let fixture: ComponentFixture<LoginCallbackForm>;
  let component: LoginCallbackForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginCallbackForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginCallbackForm);
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

  it('el mínimo lleva state, sujeto y claims parseados: los tres que el contrato exige', () => {
    formulario().patchValue({
      providerCode: 'gob-oidc',
      state: 'state-opaco',
      externalSubject: 'sub-123',
      claims: '{"sub": "sub-123"}',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/identity-providers/by-code/gob-oidc/callback');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      state: 'state-opaco',
      externalSubject: 'sub-123',
      claims: { sub: 'sub-123' },
    });

    req.flush(PROCESADO);
    expect(interno<() => { linkToken?: string } | null>('processed')()?.linkToken).toBe(
      'token-de-vinculo',
    );
  });

  it('sin claims no viaja nada: el contrato los exige como objeto, no como texto suelto', () => {
    formulario().patchValue({
      providerCode: 'gob-oidc',
      state: 'state-opaco',
      externalSubject: 'sub-123',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('los claims rotos frenan; corregidos, viajan con la organización y el usuario resuelto', () => {
    formulario().patchValue({
      providerCode: 'gob-oidc',
      state: 'state-opaco',
      externalSubject: 'sub-123',
      claims: '{rota',
      tenantId: ORGANIZACION,
      userId: USUARIO,
      ip: '10.0.0.7',
      userAgent: 'Mozilla/5.0',
    });

    interno<() => void>('submit')();
    http.expectNone('/auth-providers/identity-providers/by-code/gob-oidc/callback');

    formulario().patchValue({ claims: '{"email": "a@clinica.example"}' });
    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/identity-providers/by-code/gob-oidc/callback');
    expect(req.request.body).toEqual({
      state: 'state-opaco',
      externalSubject: 'sub-123',
      claims: { email: 'a@clinica.example' },
      tenantId: ORGANIZACION,
      userId: USUARIO,
      ip: '10.0.0.7',
      userAgent: 'Mozilla/5.0',
    });

    req.flush(PROCESADO);
  });
});
