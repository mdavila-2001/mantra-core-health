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

  /**
   * El formulario entero, en un solo grupo.
   *
   * El rol, los alcances, los switches y las fechas vivían en señales sueltas
   * mientras la plantilla los dibujaba a mano; con el motor todo escribe en el
   * mismo `FormGroup`.
   */
  function completar(valores: Record<string, unknown> = {}) {
    interno<{ patchValue: (v: Record<string, unknown>) => void }>('form').patchValue({
      practitionerRoleAssignmentId: UUID_A,
      delegateUserAssignmentId: UUID_B,
      delegatedPermissionSetId: UUID_C,
      ...valores,
    });
  }

  it('sin las tres referencias, no sale ninguna petición', () => {
    interno<() => void>('submit')();
    // `http.verify()` del afterEach comprueba que nada viajó.
  });

  it('una referencia que no tiene forma de UUID tampoco pasa', () => {
    completar({ delegatedPermissionSetId: 'esto-no-es-un-uuid' });

    interno<() => void>('submit')();
  });

  it('lo mínimo viaja con las tres referencias y los dos switches; nada inventado', () => {
    completar();
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
    completar({
      delegateRole: 'NURSE',
      patientScope: 'ASSIGNED',
      validTo: new Date('2026-12-31T15:30:00.000Z'),
    });

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
    // existe en OTROS sets del módulo y mandarlo acá sería un 400. El motor sólo
    // ofrece los tres del contrato; la comprobación sigue al armar el cuerpo.
    completar({ delegateRole: 'BILLING' });
    interno<() => void>('submit')();

    const req = http.expectOne('/practitioner-delegates');
    expect(req.request.body).not.toHaveProperty('delegateRole');
    req.flush({ id: 'd-1', status: 'c', createdAt: '2026-08-07T12:00:00.000Z' });
  });
});
