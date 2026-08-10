import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OrgAssignmentUpdate } from './org-assignment-update';

const ASIGNACION = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SUPERVISOR = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('OrgAssignmentUpdate', () => {
  let fixture: ComponentFixture<OrgAssignmentUpdate>;
  let component: OrgAssignmentUpdate;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgAssignmentUpdate],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OrgAssignmentUpdate);
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

  function conAsignacion(campos: Partial<Record<string, string | number>> = {}) {
    interno<{ patchValue: (v: Record<string, string | number>) => void }>('form').patchValue({
      assignmentId: ASIGNACION,
      ...campos,
    });
  }

  it('sin ningún cambio elegido, el envío ni se intenta: la regla es al menos uno', () => {
    conAsignacion();
    expect(interno<() => boolean>('sinCambios')()).toBe(true);

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('reasignar supervisor viaja solo con esa clave: un PATCH no manda lo no elegido', () => {
    conAsignacion({ supervisorUserId: SUPERVISOR });

    interno<() => void>('submit')();

    const req = http.expectOne(`/org/user-assignments/${ASIGNACION}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ supervisorUserId: SUPERVISOR });

    req.flush({ ok: true });
    expect(interno<() => string | null>('updated')()).toBe(ASIGNACION);
  });

  it('la suspensión viaja como true y la versión esperada la acompaña', () => {
    conAsignacion({ expectedRowVersion: 7 });
    interno<{ set: (v: boolean) => void }>('suspender').set(true);

    interno<() => void>('submit')();

    const req = http.expectOne(`/org/user-assignments/${ASIGNACION}`);
    // Apagada no viaja como `false`: el caso de uso es suspender, no reactivar.
    expect(req.request.body).toEqual({ suspend: true, expectedRowVersion: 7 });

    req.flush({ ok: true });
  });

  it('un alcance fuera del contrato no entra', () => {
    interno<(v: unknown) => void>('elegirAlcance')('REGION');
    expect(interno<() => string | null>('accessScope')()).toBeNull();
  });
});
