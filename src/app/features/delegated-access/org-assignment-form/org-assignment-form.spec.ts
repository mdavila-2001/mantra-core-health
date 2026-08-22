import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OrgAssignmentForm } from './org-assignment-form';

const MEMBRESIA = '88888888-8888-8888-8888-888888888888';
const SUPERVISOR = '99999999-9999-9999-9999-999999999999';

describe('OrgAssignmentForm', () => {
  let fixture: ComponentFixture<OrgAssignmentForm>;
  let component: OrgAssignmentForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgAssignmentForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAssignmentForm);
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

  function completarMembresia(campos: Partial<Record<string, string>> = {}) {
    interno<{ patchValue: (v: Record<string, string>) => void }>('form').patchValue({
      tenantMembershipId: MEMBRESIA,
      ...campos,
    });
  }

  it('sin la membresía, no sale ninguna petición', () => {
    interno<() => void>('submit')();
    // `http.verify()` del afterEach comprueba que nada viajó.
  });

  it('sin elecciones el cuerpo va vacío: el backend completa sus defaults', () => {
    completarMembresia();
    interno<() => void>('submit')();

    const req = http.expectOne(`/org/${MEMBRESIA}/user-assignments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ id: 'a-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
    expect(interno<() => { id: string } | null>('created')()?.id).toBe('a-1');
  });

  it('lo elegido viaja con sus claves exactas y las fechas en ISO', () => {
    completarMembresia({ pharmacyId: SUPERVISOR, supervisorUserId: SUPERVISOR });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      role: 'NURSE',
      accessScope: 'UNIT',
      validTo: new Date('2026-12-31T23:59:00.000Z'),
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/org/${MEMBRESIA}/user-assignments`);
    expect(req.request.body).toEqual({
      role: 'NURSE',
      accessScope: 'UNIT',
      pharmacyId: SUPERVISOR,
      supervisorUserId: SUPERVISOR,
      validTo: '2026-12-31T23:59:00.000Z',
    });

    req.flush({ id: 'a-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
  });

  it('un alcance fuera del contrato no entra', () => {
    // El motor sólo ofrece los cuatro del contrato; la comprobación sigue al
    // armar el cuerpo, que es lo que llega al backend venga de donde venga.
    completarMembresia();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ accessScope: 'GLOBAL' });
    interno<() => void>('submit')();

    const req = http.expectOne(`/org/${MEMBRESIA}/user-assignments`);
    expect(req.request.body).not.toHaveProperty('accessScope');
    req.flush({ id: 'a-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
  });

  it('un nodo de alcance que no es UUID frena el envío', () => {
    completarMembresia({ clinicalUnitId: 'no-es-uuid' });
    interno<() => void>('submit')();
  });
});
