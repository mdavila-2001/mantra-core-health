import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AccessRequestForm } from './access-request-form';

const DELEGACION = '55555555-5555-5555-5555-555555555555';
const PERMISO = '66666666-6666-6666-6666-666666666666';

describe('AccessRequestForm', () => {
  let fixture: ComponentFixture<AccessRequestForm>;
  let component: AccessRequestForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccessRequestForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AccessRequestForm);
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

  function completar(campos: Partial<Record<string, string>> = {}) {
    interno<{ setValue: (v: Record<string, string>) => void }>('form').setValue({
      delegationId: DELEGACION,
      requestedPermissionId: PERMISO,
      patientProfileId: '',
      encounterId: '',
      ...campos,
    });
  }

  it('sin permiso solicitado, no hay solicitud', () => {
    completar({ requestedPermissionId: '' });
    interno<() => void>('submit')();
  });

  it('la delegación va en la ruta y el cuerpo lleva solo lo cargado', () => {
    completar();
    interno<() => void>('submit')();

    const req = http.expectOne(`/practitioner-delegates/${DELEGACION}/access-requests`);
    // Los opcionales vacíos no aparecen: cadena vacía no es un UUID y el
    // backend la rechazaría.
    expect(req.request.body).toEqual({ requestedPermissionId: PERMISO });

    req.flush({ id: 'req-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
    expect(interno<() => { id: string } | null>('created')()?.id).toBe('req-1');
  });

  it('la justificación viaja cuando existe', () => {
    completar();
    interno<{ set: (v: string) => void }>('reasonText').set('cubro la guardia del viernes');

    interno<() => void>('submit')();

    const req = http.expectOne(`/practitioner-delegates/${DELEGACION}/access-requests`);
    expect((req.request.body as Record<string, unknown>)['reasonText']).toBe(
      'cubro la guardia del viernes',
    );

    req.flush({ id: 'req-1', status: 'c-uuid', createdAt: '2026-08-07T12:00:00.000Z' });
  });
});
