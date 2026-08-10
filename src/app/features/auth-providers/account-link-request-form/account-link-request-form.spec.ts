import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AccountLinkRequestForm } from './account-link-request-form';

const PROVEEDOR = '20202020-2020-2020-2020-202020202020';

const SOLICITADA = {
  id: 's-1',
  linkToken: 'token-una-sola-vez',
  expiresAt: '2026-08-08T12:30:00.000Z',
  statusConceptId: 'pendiente-uuid',
};

describe('AccountLinkRequestForm', () => {
  let fixture: ComponentFixture<AccountLinkRequestForm>;
  let component: AccountLinkRequestForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountLinkRequestForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountLinkRequestForm);
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

  it('el mínimo lleva proveedor y sujeto; el vencimiento llega convertido a fecha', () => {
    formulario().patchValue({ providerId: PROVEEDOR, externalSubject: 'sub-123' });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/account-link-requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ providerId: PROVEEDOR, externalSubject: 'sub-123' });

    req.flush(SOLICITADA);

    const solicitud = interno<() => { expiresAt: Date } | null>('requested')();
    expect(solicitud?.expiresAt).toEqual(new Date('2026-08-08T12:30:00.000Z'));
  });

  it('la validez elegida viaja en minutos', () => {
    formulario().patchValue({
      providerId: PROVEEDOR,
      externalSubject: 'sub-123',
      expiresInMinutes: 120,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/account-link-requests');
    expect(req.request.body).toEqual({
      providerId: PROVEEDOR,
      externalSubject: 'sub-123',
      expiresInMinutes: 120,
    });

    req.flush(SOLICITADA);
  });

  it('una validez de cero minutos frena sin gastar la petición', () => {
    formulario().patchValue({
      providerId: PROVEEDOR,
      externalSubject: 'sub-123',
      expiresInMinutes: 0,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
