import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthorityEndpointForm } from './authority-endpoint-form';

const AUTORIDAD = '11111111-1111-1111-1111-111111111111';
const ENDPOINT = '22222222-2222-2222-2222-222222222222';
const CONCEPTO = '33333333-3333-3333-3333-333333333333';

describe('AuthorityEndpointForm', () => {
  let fixture: ComponentFixture<AuthorityEndpointForm>;
  let component: AuthorityEndpointForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthorityEndpointForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorityEndpointForm);
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

  it('publica contra la ruta anidada de la autoridad pegada, con el cuerpo mínimo', () => {
    formulario().patchValue({
      authorityId: AUTORIDAD,
      integrationEndpointId: ENDPOINT,
      capabilityConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/authorities/${AUTORIDAD}/endpoints`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      integrationEndpointId: ENDPOINT,
      capabilityConceptId: CONCEPTO,
    });

    req.flush({
      id: 'e-1',
      identityAuthorityId: AUTORIDAD,
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
    expect(interno<() => { id: string } | null>('published')()?.id).toBe('e-1');
  });

  it('el nivel y las versiones del contrato viajan solo cuando se cargan', () => {
    formulario().patchValue({
      authorityId: AUTORIDAD,
      integrationEndpointId: ENDPOINT,
      capabilityConceptId: CONCEPTO,
      assuranceLevelConceptId: CONCEPTO,
      requestContractVersion: 'v2',
      responseContractVersion: 'v2.1',
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/authorities/${AUTORIDAD}/endpoints`);
    expect(req.request.body).toEqual({
      integrationEndpointId: ENDPOINT,
      capabilityConceptId: CONCEPTO,
      assuranceLevelConceptId: CONCEPTO,
      requestContractVersion: 'v2',
      responseContractVersion: 'v2.1',
    });

    req.flush({
      id: 'e-2',
      identityAuthorityId: AUTORIDAD,
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('sin autoridad no viaja nada: el endpoint se publica sobre una', () => {
    formulario().patchValue({
      integrationEndpointId: ENDPOINT,
      capabilityConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
