import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AssertionIssueForm } from './assertion-issue-form';

const CASO = '11111111-1111-1111-1111-111111111111';
const AUTORIDAD = '22222222-2222-2222-2222-222222222222';
const CONCEPTO = '33333333-3333-3333-3333-333333333333';

describe('AssertionIssueForm', () => {
  let fixture: ComponentFixture<AssertionIssueForm>;
  let component: AssertionIssueForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssertionIssueForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AssertionIssueForm);
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

  it('emite contra el caso pegado; el mínimo lleva solo la autoridad emisora', () => {
    formulario().patchValue({
      caseId: CASO,
      issuerIdentityAuthorityId: AUTORIDAD,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/assertions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ issuerIdentityAuthorityId: AUTORIDAD });

    req.flush({
      id: 'as-1',
      assertionIdentifier: 'IAL2-2026-000123',
      assuranceLevel: 'ial2-uuid',
      issuedAt: '2026-08-08T12:00:00.000Z',
      caseStatus: 'resuelto-uuid',
    });

    const emitida = interno<() => { id: string; issuedAt?: Date } | null>('issued')();
    expect(emitida?.id).toBe('as-1');
    expect(emitida?.issuedAt).toEqual(new Date('2026-08-08T12:00:00.000Z'));
  });

  it('tipo, nivel y vigencia viajan solo cuando se cargan', () => {
    formulario().patchValue({
      caseId: CASO,
      issuerIdentityAuthorityId: AUTORIDAD,
      assertionTypeConceptId: CONCEPTO,
      assuranceLevelConceptId: CONCEPTO,
      expiresInHours: 4380,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/assertions`);
    expect(req.request.body).toEqual({
      issuerIdentityAuthorityId: AUTORIDAD,
      assertionTypeConceptId: CONCEPTO,
      assuranceLevelConceptId: CONCEPTO,
      expiresInHours: 4380,
    });

    req.flush({ id: 'as-2', assuranceLevel: 'ial2-uuid', caseStatus: 'resuelto-uuid' });
  });

  it('una vigencia de 0 horas frena el envío: empieza en 1', () => {
    formulario().patchValue({
      caseId: CASO,
      issuerIdentityAuthorityId: AUTORIDAD,
      expiresInHours: 0,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
