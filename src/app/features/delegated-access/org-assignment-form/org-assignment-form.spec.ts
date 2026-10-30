import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OrgAssignmentForm } from './org-assignment-form';

const MEMBRESIA = '88888888-8888-8888-8888-888888888888';
const SUPERVISOR = '99999999-9999-9999-9999-999999999999';
const PRACTICA = '11111111-1111-1111-1111-111111111111';
const SEDE_A = '22222222-2222-2222-2222-222222222222';
const SEDE_B = '33333333-3333-3333-3333-333333333333';
const AREA_A = '44444444-4444-4444-4444-444444444444';
const AREA_B = '55555555-5555-5555-5555-555555555555';

const PRACTICAS = [{ id: PRACTICA, code: 'OLIVOS', name: 'Clínica Los Olivos', status: 'c' }];

const concepto = { code: 'X', display: 'X' };
const CONSOLA = {
  organization: { id: PRACTICA, code: 'OLIVOS', name: 'Clínica Los Olivos', type: concepto, status: concepto, timeZone: null, currency: null },
  sites: [
    { id: SEDE_A, code: 'A', name: 'Sede Centro', type: concepto, physicalType: null, operationalStatus: null, status: concepto, timeZone: null, branchId: null, clinicalUnitCount: 1, careSpaceCount: 0 },
    { id: SEDE_B, code: 'B', name: 'Sede Norte', type: concepto, physicalType: null, operationalStatus: null, status: concepto, timeZone: null, branchId: null, clinicalUnitCount: 1, careSpaceCount: 0 },
  ],
  clinicalUnits: [
    { id: AREA_A, siteId: SEDE_A, parentUnitId: null, code: 'CA', name: 'Cardiología', type: concepto, specialty: null, serviceMode: null, status: concepto },
    { id: AREA_B, siteId: SEDE_B, parentUnitId: null, code: 'PE', name: 'Pediatría', type: concepto, specialty: null, serviceMode: null, status: concepto },
  ],
  careSpaces: [],
  healthcareServices: [],
  staff: [],
  legalDocuments: [],
  inventory: [],
};

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
    // Al construirse pide las prácticas del tenant: alimentan el primer nodo.
    http.expectOne('/practices').flush(PRACTICAS);
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
  describe('nodos de alcance elegidos, no pegados', () => {
    type Opcion = readonly { value: string; label: string }[];
    interface Opciones {
      practiceId: Opcion;
      practiceSiteId: Opcion;
      clinicalUnitId: Opcion;
      careSpaceId: Opcion;
    }

    it('la práctica se elige de GET /practices y sus sedes y áreas del árbol de la práctica', () => {
      expect(interno<() => Opciones>('opcionesDeNodo')().practiceId).toEqual([
        { value: PRACTICA, label: 'Clínica Los Olivos' },
      ]);

      completarMembresia({ practiceId: PRACTICA });
      http.expectOne(`/practices/${PRACTICA}/organization`).flush(CONSOLA);

      expect(interno<() => Opciones>('opcionesDeNodo')().practiceSiteId.map((o) => o.label)).toEqual([
        'Sede Centro',
        'Sede Norte',
      ]);

      // Con sede elegida, sólo sus áreas.
      completarMembresia({ practiceSiteId: SEDE_B });
      expect(interno<() => Opciones>('opcionesDeNodo')().clinicalUnitId.map((o) => o.label)).toEqual([
        'Pediatría',
      ]);

      completarMembresia({ clinicalUnitId: AREA_B });
      interno<() => void>('submit')();
      const req = http.expectOne(`/org/${MEMBRESIA}/user-assignments`);
      expect(req.request.body).toEqual({
        practiceId: PRACTICA,
        practiceSiteId: SEDE_B,
        clinicalUnitId: AREA_B,
      });
      req.flush({ id: 'a-1', status: 'c', createdAt: '2026-08-07T12:00:00.000Z' });
    });

    it('los cuatro nodos de la estructura son selectores, no campos de uuid', () => {
      const campos = interno<() => readonly { campos: readonly { key: string; control: string }[] }[]>(
        'paginas',
      )().flatMap((p) => p.campos);
      for (const key of ['practiceId', 'practiceSiteId', 'clinicalUnitId', 'careSpaceId']) {
        expect(campos.find((c) => c.key === key)?.control, key).toBe('select');
      }
    });

    it('cambiar de práctica suelta la sede elegida de la anterior', () => {
      completarMembresia({ practiceId: PRACTICA });
      http.expectOne(`/practices/${PRACTICA}/organization`).flush(CONSOLA);
      completarMembresia({ practiceSiteId: SEDE_A });

      completarMembresia({ practiceId: '' });
      const valores = interno<{ getRawValue: () => Record<string, unknown> }>('form').getRawValue();
      expect(valores['practiceSiteId']).toBe('');
    });

    it('si el árbol de la práctica no se puede leer, lo dice', () => {
      completarMembresia({ practiceId: PRACTICA });
      http
        .expectOne(`/practices/${PRACTICA}/organization`)
        .flush(null, { status: 500, statusText: 'Error', headers: { 'x-request-id': 'req-arbol' } });

      expect(interno<() => string | null>('errorDeNodos')()).toContain('req-arbol');
    });
  });
});
