import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthorityForm } from './authority-form';

const ORGANIZACION = '11111111-1111-1111-1111-111111111111';
const CONCEPTO = '22222222-2222-2222-2222-222222222222';

describe('AuthorityForm', () => {
  let fixture: ComponentFixture<AuthorityForm>;
  let component: AuthorityForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthorityForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorityForm);
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

  it('el cuerpo mínimo lleva las cuatro claves del contrato, recortadas', () => {
    formulario().patchValue({
      authorityCode: '  RENAPER  ',
      name: 'Registro Nacional de las Personas',
      tenantId: ORGANIZACION,
      authorityTypeConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/identity/authorities');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: ORGANIZACION,
      authorityCode: 'RENAPER',
      name: 'Registro Nacional de las Personas',
      authorityTypeConceptId: CONCEPTO,
    });

    req.flush({
      id: 'a-1',
      authorityCode: 'RENAPER',
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
    expect(interno<() => { id: string } | null>('registered')()?.id).toBe('a-1');
  });

  it('jurisdicción y marco de aseguramiento viajan solo cuando se cargan', () => {
    formulario().patchValue({
      authorityCode: 'CMPC',
      name: 'Colegio Médico',
      tenantId: ORGANIZACION,
      authorityTypeConceptId: CONCEPTO,
      jurisdictionConceptId: CONCEPTO,
      assuranceFrameworkConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/identity/authorities');
    expect(req.request.body).toEqual({
      tenantId: ORGANIZACION,
      authorityCode: 'CMPC',
      name: 'Colegio Médico',
      authorityTypeConceptId: CONCEPTO,
      jurisdictionConceptId: CONCEPTO,
      assuranceFrameworkConceptId: CONCEPTO,
    });

    req.flush({
      id: 'a-2',
      authorityCode: 'CMPC',
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('sin organización no viaja nada: el contrato la exige', () => {
    formulario().patchValue({
      authorityCode: 'RENAPER',
      name: 'Registro Nacional de las Personas',
      authorityTypeConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
