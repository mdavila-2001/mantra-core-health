import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AccountLinkCompleteForm } from './account-link-complete-form';

const COMPLETADA = {
  requestId: 's-1',
  federatedIdentityId: 'fi-1',
  userId: 'u-1',
  statusConceptId: 'completada-uuid',
};

describe('AccountLinkCompleteForm', () => {
  let fixture: ComponentFixture<AccountLinkCompleteForm>;
  let component: AccountLinkCompleteForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountLinkCompleteForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountLinkCompleteForm);
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

  it('el mínimo lleva solo el token: lo demás es opcional y no viaja vacío', () => {
    formulario().patchValue({ linkToken: 'token-una-sola-vez' });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/account-link-requests/complete');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ linkToken: 'token-una-sola-vez' });

    req.flush(COMPLETADA);
    expect(interno<() => { federatedIdentityId: string } | null>('completed')()?.federatedIdentityId).toBe(
      'fi-1',
    );
  });

  it('con todo cargado viajan el correo, el nombre y los claims parseados', () => {
    formulario().patchValue({
      linkToken: 'token-una-sola-vez',
      externalEmail: 'a@clinica.example',
      displayName: 'Ana Pérez',
      claims: '{"sub": "sub-123"}',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/account-link-requests/complete');
    expect(req.request.body).toEqual({
      linkToken: 'token-una-sola-vez',
      externalEmail: 'a@clinica.example',
      displayName: 'Ana Pérez',
      claims: { sub: 'sub-123' },
    });

    req.flush(COMPLETADA);
  });

  it('sin token no viaja nada: sin él no hay vínculo que cerrar', () => {
    formulario().patchValue({ displayName: 'Ana Pérez' });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
