import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProviderForm } from './provider-form';

describe('ProviderForm', () => {
  let fixture: ComponentFixture<ProviderForm>;
  let component: ProviderForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProviderForm);
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

  it('sin protocolo y categoría elegidos no viaja nada: son obligatorios por contrato', () => {
    formulario().patchValue({ code: 'anses', name: 'ANSES' });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });

  it('el cuerpo mínimo lleva las cuatro claves del contrato más el interruptor explícito', () => {
    formulario().patchValue({ code: '  anses  ', name: 'ANSES' });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ protocol: 'OIDC' });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ category: 'GOVERNMENT' });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/identity-providers');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      code: 'anses',
      name: 'ANSES',
      protocol: 'OIDC',
      category: 'GOVERNMENT',
      // Apagado también viaja: es una decisión explícita, no una omisión.
      isGlobal: false,
    });

    req.flush({ id: 'p-1', code: 'anses', stateConceptId: 'estado-uuid', isGlobal: false });
    expect(interno<() => { id: string } | null>('created')()?.id).toBe('p-1');
  });

  it('un valor fuera del set no entra: el radio solo acepta los protocolos del contrato', () => {
    // El motor sólo ofrece los del contrato; la comprobación sigue al armar el
    // cuerpo, que es lo que llega al backend venga de donde venga el valor.
    formulario().patchValue({
      code: 'okta-clinica',
      name: 'Okta de la clínica',
      issuer: 'https://clinica.okta.com',
      protocol: 'LDAP',
      category: 'ENTERPRISE',
    });
    interno<() => void>('submit')();
    // Nada viajó: `http.verify()` lo comprueba.
  });

  it('organización dueña y emisor viajan solo cuando se cargan', () => {
    formulario().patchValue({
      code: 'okta-clinica',
      name: 'Okta de la clínica',
      issuer: 'https://clinica.okta.com',
      tenantId: '11111111-1111-1111-1111-111111111111',
      isGlobal: true,
    });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ protocol: 'SAML' });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ category: 'ENTERPRISE' });

    interno<() => void>('submit')();

    const req = http.expectOne('/auth-providers/identity-providers');
    expect(req.request.body).toEqual({
      tenantId: '11111111-1111-1111-1111-111111111111',
      code: 'okta-clinica',
      name: 'Okta de la clínica',
      protocol: 'SAML',
      category: 'ENTERPRISE',
      issuer: 'https://clinica.okta.com',
      isGlobal: true,
    });

    req.flush({ id: 'p-2', code: 'okta-clinica', stateConceptId: 'estado-uuid', isGlobal: true });
  });
});
