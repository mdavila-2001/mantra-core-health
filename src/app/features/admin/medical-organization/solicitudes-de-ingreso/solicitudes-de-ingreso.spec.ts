import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SolicitudesDeIngreso } from './solicitudes-de-ingreso';

function fila(id: string, practiceName: string, statusCode: string, extra: object = {}) {
  return {
    id,
    practiceId: `p-${id}`,
    practiceName,
    roleConceptId: 'role-attending',
    status: `uuid-${statusCode}`,
    statusCode,
    isPrimary: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    avatarUrl: null,
    healthcareServiceId: `svc-${id}`,
    serviceDisplay: 'Colonoscopia',
    ...extra,
  };
}

describe('SolicitudesDeIngreso', () => {
  let fixture: ComponentFixture<SolicitudesDeIngreso>;
  let http: HttpTestingController;
  let pendientes: number[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SolicitudesDeIngreso);
    pendientes = [];
    fixture.componentInstance.pendientes.subscribe((n) => pendientes.push(n));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const porTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  function cargar(filas: object[]): void {
    http.expectOne('/practitioners/me/role-assignments').flush(filas);
    fixture.detectChanges();
  }

  it('muestra pendientes, aceptadas y rechazadas, y deja fuera lo finalizado', () => {
    cargar([
      fila('a', 'Clínica Norte', 'ROLE_ASG_PENDING', { initiatedBy: 'PRACTITIONER' }),
      fila('b', 'Hospital Sur', 'ROLE_ASG_ACTIVE', { initiatedBy: 'PRACTITIONER' }),
      fila('c', 'Centro Este', 'ROLE_ASG_REJECTED', { initiatedBy: 'PRACTITIONER' }),
      fila('d', 'Centro Viejo', 'ROLE_ASG_ENDED', { initiatedBy: 'PRACTITIONER' }),
      fila('e', 'Consultorio de siempre', 'ROLE_ASG_ACTIVE'),
    ]);

    expect(texto()).toContain('Clínica Norte');
    expect(texto()).toContain('Pendiente');
    expect(texto()).toContain('Aceptada');
    expect(texto()).toContain('Rechazada');
    expect(texto()).not.toContain('Centro Viejo');
    expect(texto()).not.toContain('Consultorio de siempre');
  });

  it('cuenta las invitaciones que esperan respuesta', () => {
    cargar([fila('a', 'Clínica Norte', 'ROLE_ASG_INVITED', { initiatedBy: 'PRACTICE' })]);

    expect(pendientes).toEqual([1]);
    expect(texto()).toContain('Invitado por el centro');
  });

  it('aceptar una invitación llama a la API y vuelve a leer la lista', () => {
    cargar([fila('a', 'Clínica Norte', 'ROLE_ASG_INVITED', { initiatedBy: 'PRACTICE' })]);

    (porTestId('buzon-aceptar-a')!.querySelector('button') ?? porTestId('buzon-aceptar-a')!).click();
    http.expectOne('/practitioners/me/role-assignments/a/accept').flush({ id: 'a' });
    cargar([fila('a', 'Clínica Norte', 'ROLE_ASG_ACTIVE', { initiatedBy: 'PRACTICE' })]);

    expect(texto()).toContain('Aceptada');
    expect(porTestId('buzon-aceptar-a')).toBeNull();
  });

  it('sin nada que mostrar lo dice, sin fingir un error', () => {
    cargar([]);

    expect(texto()).toContain('No tiene solicitudes ni invitaciones de ingreso');
  });
});
