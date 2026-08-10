import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PractitionerDelegateForm } from './practitioner-delegate-form';

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';

describe('PractitionerDelegateForm', () => {
  let fixture: ComponentFixture<PractitionerDelegateForm>;
  let component: PractitionerDelegateForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PractitionerDelegateForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PractitionerDelegateForm);
    component = fixture.componentInstance;
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

  function completarReferencias() {
    interno<{
      setValue: (v: {
        practitionerRoleAssignmentId: string;
        delegateUserAssignmentId: string;
        delegatedPermissionSetId: string;
      }) => void;
    }>('form').setValue({
      practitionerRoleAssignmentId: UUID_A,
      delegateUserAssignmentId: UUID_B,
      delegatedPermissionSetId: UUID_C,
    });
  }

  it('sin las tres referencias, no sale ninguna petición', () => {
    interno<() => void>('submit')();
    // `http.verify()` del afterEach comprueba que nada viajó.
  });

  it('una referencia que no tiene forma de UUID tampoco pasa', () => {
    completarReferencias();
    interno<{ patchValue: (v: { delegatedPermissionSetId: string }) => void }>('form').patchValue({
      delegatedPermissionSetId: 'esto-no-es-un-uuid',
    });

    interno<() => void>('submit')();
  });

  it('lo mínimo viaja con las tres referencias y los dos switches; nada inventado', () => {
    completarReferencias();
    interno<() => void>('submit')();

    const req = http.expectOne('/practitioner-delegates');
    // Los opcionales no elegidos NO aparecen: el backend rechaza claves de más
    // y completa los defaults por su cuenta.
    expect(req.request.body).toEqual({
      practitionerRoleAssignmentId: UUID_A,
      delegateUserAssignmentId: UUID_B,
      delegatedPermissionSetId: UUID_C,
      mayViewClinicalContent: false,
      mayEditDrafts: false,
    });

    req.flush({ id: 'd-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
    expect(interno<() => { id: string } | null>('created')()?.id).toBe('d-1');
  });

  it('el alcance elegido viaja, y las fechas van como ISO', () => {
    completarReferencias();
    interno<(v: unknown) => void>('elegirRol')('NURSE');
    interno<(v: unknown) => void>('elegirPacientes')('ASSIGNED');
    interno<{ set: (v: Date | null) => void }>('validTo').set(
      new Date('2026-12-31T15:30:00.000Z'),
    );

    interno<() => void>('submit')();

    const req = http.expectOne('/practitioner-delegates');
    const body = req.request.body as Record<string, unknown>;
    expect(body['delegateRole']).toBe('NURSE');
    expect(body['patientScope']).toBe('ASSIGNED');
    expect(body['validTo']).toBe('2026-12-31T15:30:00.000Z');

    req.flush({ id: 'd-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
  });

  it('un rol fuera del set del contrato no entra: BILLING no es rol de delegado', () => {
    // `CreatePractitionerDelegateDto` acepta ASSISTANT/SECRETARY/NURSE; BILLING
    // existe en OTROS sets del módulo y mandarlo acá sería un 400.
    interno<(v: unknown) => void>('elegirRol')('BILLING');

    expect(interno<() => string | null>('delegateRole')()).toBeNull();
  });
});
