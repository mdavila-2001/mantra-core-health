import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
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

/**
 * LOS SELECTORES REALES.
 *
 * El defecto: la pantalla pedía seis identificadores escritos a mano (la
 * membresía, la práctica, la sede, el área, el espacio, el supervisor). Nadie
 * los sabe de memoria, y uno equivocado pasaba la validación de formato y
 * fallaba recién en el servidor.
 */
describe('OrgAssignmentForm · selectores', () => {
  const TENANT = '11111111-1111-1111-1111-111111111111';
  const PRACTICA = '22222222-2222-2222-2222-222222222222';
  const SEDE_A = '33333333-3333-3333-3333-33333333333a';
  const SEDE_B = '33333333-3333-3333-3333-33333333333b';
  const AREA_A = '44444444-4444-4444-4444-44444444444a';
  const AREA_B = '44444444-4444-4444-4444-44444444444b';
  const ESPACIO_A = '55555555-5555-5555-5555-55555555555a';
  const USUARIO = '66666666-6666-6666-6666-666666666666';

  let fixture: ComponentFixture<OrgAssignmentForm>;
  let component: OrgAssignmentForm;
  let http: HttpTestingController;

  const crudo = <T>(nombre: string): T =>
    (component as unknown as Record<string, unknown>)[nombre] as T;
  const llamar = (nombre: string, ...args: unknown[]): unknown =>
    (crudo<(...a: unknown[]) => unknown>(nombre)).apply(component, args);

  async function montar(tenant: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [OrgAssignmentForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { activeTenantId: signal<string | null>(tenant) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OrgAssignmentForm);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  }

  function responderOpciones(): void {
    http
      .expectOne((r) => r.url === `/tenants/${TENANT}/memberships`)
      .flush({
        items: [
          { id: MEMBRESIA, userId: USUARIO, tenantRoleConceptId: 'r', statusConceptId: 's', createdAt: '2026-01-01T00:00:00Z' },
        ],
        count: 1,
        limit: 200,
        nextCursor: null,
      });
    http.expectOne('/practices').flush([{ id: PRACTICA, code: 'OLI', name: 'Clínica Olivos', status: 'ACTIVE' }]);
    http.expectOne(`/iam/users/${USUARIO}`).flush({ id: USUARIO, displayName: 'Ana Pérez' });
  }

  function estructura(): object {
    const concepto = { code: 'X', display: 'X' };
    return {
      organization: { id: PRACTICA, code: 'OLI', name: 'Clínica Olivos', type: concepto, status: concepto, timeZone: null, currency: null },
      sites: [
        { id: SEDE_A, code: 'A', name: 'Sede A', type: concepto, physicalType: null, operationalStatus: null, status: concepto, timeZone: null, branchId: null, clinicalUnitCount: 1, careSpaceCount: 1 },
        { id: SEDE_B, code: 'B', name: 'Sede B', type: concepto, physicalType: null, operationalStatus: null, status: concepto, timeZone: null, branchId: null, clinicalUnitCount: 1, careSpaceCount: 0 },
      ],
      clinicalUnits: [
        { id: AREA_A, siteId: SEDE_A, parentUnitId: null, code: 'UA', name: 'Cardiología', type: concepto, specialty: null, serviceMode: null, status: concepto },
        { id: AREA_B, siteId: SEDE_B, parentUnitId: null, code: 'UB', name: 'Pediatría', type: concepto, specialty: null, serviceMode: null, status: concepto },
      ],
      careSpaces: [
        { id: ESPACIO_A, siteId: SEDE_A, clinicalUnitId: AREA_A, parentSpaceId: null, code: 'C1', name: 'Consultorio 1', type: concepto, capacity: 1, operationalStatus: null, status: concepto },
      ],
      healthcareServices: [], staff: [], legalDocuments: [], inventory: [],
    };
  }

  const opciones = (nombre: string): { value: string; label: string }[] =>
    crudo<() => { value: string; label: string }[]>(nombre)();

  afterEach(() => http.verify());

  it('sin organización activa no pide nada y lo dice', async () => {
    await montar(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="asignacion-sin-organizacion"]')).not.toBeNull();
  });

  it('la membresía y el supervisor se eligen por nombre, no por uuid', async () => {
    await montar(TENANT);
    fixture.detectChanges();
    responderOpciones();

    expect(opciones('opcionesDePersona')).toMatchObject([{ value: MEMBRESIA, label: 'Ana Pérez' }]);
    // El supervisor se guarda por cuenta, no por membresía.
    expect(opciones('opcionesDeSupervisor')).toMatchObject([{ value: USUARIO, label: 'Ana Pérez' }]);
  });

  it('sin permiso para leer el nombre, la opción dice «Cuenta ab12cd34» y no inventa nada', async () => {
    await montar(TENANT);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === `/tenants/${TENANT}/memberships`)
      .flush({
        items: [{ id: MEMBRESIA, userId: USUARIO, tenantRoleConceptId: 'r', statusConceptId: 's', createdAt: '2026-01-01T00:00:00Z' }],
        count: 1, limit: 200, nextCursor: null,
      });
    http.expectOne('/practices').flush([]);
    http.expectOne(`/iam/users/${USUARIO}`).flush({ message: 'x' }, { status: 403, statusText: 'Forbidden' });

    expect(opciones('opcionesDePersona')[0]?.label).toBe('Cuenta 66666666');
  });

  it('práctica → sede → área → espacio: cada nivel se elige dentro del anterior y limpia los de abajo', async () => {
    await montar(TENANT);
    fixture.detectChanges();
    responderOpciones();

    const form = crudo<{ controls: Record<string, { setValue: (v: unknown) => void; value: unknown }> }>('form');
    form.controls['practiceId']!.setValue(PRACTICA);
    http.expectOne(`/practices/${PRACTICA}/organization`).flush(estructura());

    expect(opciones('opcionesDeSede').map((o) => o.label)).toEqual(['Sede A', 'Sede B']);

    form.controls['practiceSiteId']!.setValue(SEDE_A);
    expect(opciones('opcionesDeUnidad').map((o) => o.label)).toEqual(['Cardiología']);

    form.controls['clinicalUnitId']!.setValue(AREA_A);
    expect(opciones('opcionesDeEspacio').map((o) => o.label)).toEqual(['Consultorio 1']);
    form.controls['careSpaceId']!.setValue(ESPACIO_A);

    // Cambiar la sede suelta lo que colgaba de la anterior.
    form.controls['practiceSiteId']!.setValue(SEDE_B);
    expect(form.controls['clinicalUnitId']!.value).toBeNull();
    expect(form.controls['careSpaceId']!.value).toBeNull();
    expect(opciones('opcionesDeUnidad').map((o) => o.label)).toEqual(['Pediatría']);
  });

  it('lo elegido viaja con sus claves exactas', async () => {
    await montar(TENANT);
    fixture.detectChanges();
    responderOpciones();

    const form = crudo<{ patchValue: (v: object) => void }>('form');
    form.patchValue({ tenantMembershipId: MEMBRESIA, supervisorUserId: USUARIO, practiceSiteId: SEDE_A });
    llamar('submit');

    const req = http.expectOne(`/org/${MEMBRESIA}/user-assignments`);
    expect(req.request.body).toEqual({ practiceSiteId: SEDE_A, supervisorUserId: USUARIO });
    req.flush({ id: 'a-1', status: 'c', createdAt: '2026-08-07T12:00:00.000Z' });
  });

  it('un fallo al leer las personas NO se presenta como «no hay personas»: se dice y se reintenta', async () => {
    await montar(TENANT);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === `/tenants/${TENANT}/memberships`)
      .flush({ message: 'caído' }, { status: 500, statusText: 'Server Error' });
    http.expectOne('/practices').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="asignacion-error-opciones"]')).not.toBeNull();

    llamar('recargarOpciones');
    responderOpcionesSinNombres();
  });

  function responderOpcionesSinNombres(): void {
    http
      .expectOne((r) => r.url === `/tenants/${TENANT}/memberships`)
      .flush({ items: [], count: 0, limit: 200, nextCursor: null });
    http.expectOne('/practices').flush([]);
  }
});
