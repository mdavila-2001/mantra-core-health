import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DiagnosticUnitsAdminClient } from './diagnostic-units-admin.client';
import type {
  DiagnosticUnitAdminDetail,
  DiagnosticUnitAdminList,
} from './diagnostic-units-admin.types';

const CONCEPTO = { code: 'DU_TYPE_LAB', display: 'Laboratorio clínico' };

const RESUMEN = {
  id: '22222222-2222-4222-8222-222222222222',
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central',
  type: CONCEPTO,
  status: { code: 'DU_UNIT_ACTIVE', display: 'Activa' },
  verificationStatus: { code: 'DU_VERIF_PENDING', display: 'Pendiente' },
  publiclyListed: false,
  siteCount: 1,
  studyCount: 2,
  equipmentCount: 1,
  acceptsExternalOrders: true,
  walkInAvailable: true,
  homeCollectionAvailable: false,
};

describe('DiagnosticUnitsAdminClient', () => {
  let client: DiagnosticUnitsAdminClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(DiagnosticUnitsAdminClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la consola por su ruta propia, no por la del directorio', () => {
    let lista: DiagnosticUnitAdminList | undefined;
    client.list().subscribe((result) => (lista = result));

    // `/diagnostic-units` a secas es el directorio público, que filtra a
    // publicadas: la consola tiene que pedir la suya o perdería los borradores.
    const req = http.expectOne('/diagnostic-units/administration');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [RESUMEN], count: 1 });

    expect(lista?.items[0].publiclyListed).toBe(false);
  });

  it('trae la ficha administrativa con el sufijo de administración', () => {
    let ficha: DiagnosticUnitAdminDetail | undefined;
    client
      .getById('22222222-2222-4222-8222-222222222222')
      .subscribe((result) => (ficha = result));

    const req = http.expectOne(
      '/diagnostic-units/22222222-2222-4222-8222-222222222222/administration',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      ...RESUMEN,
      sites: [],
      equipment: [],
      studies: [],
      accreditations: [],
      staff: [],
    });

    expect(ficha?.code).toBe('LAB-CENTRAL');
  });

  it('escapa el identificador antes de pegarlo a la ruta', () => {
    client.getById('unit/one').subscribe();

    http
      .expectOne('/diagnostic-units/unit%2Fone/administration')
      .flush({
        ...RESUMEN,
        sites: [],
        equipment: [],
        studies: [],
        accreditations: [],
        staff: [],
      });
  });
});
