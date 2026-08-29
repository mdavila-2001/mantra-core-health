import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DiagnosticUnitsAdminClient } from './diagnostic-units-admin.client';
import type {
  AdminOperationResult,
  DiagnosticUnitAdminDetail,
  DiagnosticUnitAdminList,
  DiagnosticUnitVerificationResult,
  StudyOfferingCreated,
  StudyPriceCreated,
} from './diagnostic-units-admin.types';

const CONCEPTO = { code: 'DU_TYPE_LAB', display: 'Laboratorio clínico' };

const UNIDAD = '22222222-2222-4222-8222-222222222222';
const TARIFARIO = '33333333-3333-4333-8333-333333333333';
const ESTUDIO = '44444444-4444-4444-8444-444444444444';

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

  it('publica la unidad por su ruta, y sin cuerpo', () => {
    let resultado: DiagnosticUnitVerificationResult | undefined;
    client.verifyAndPublish(UNIDAD).subscribe((valor) => (resultado = valor));

    const req = http.expectOne(`/diagnostic-units/${UNIDAD}/verify-and-publish`);
    expect(req.request.method).toBe('POST');
    // La API no declara `@Body()` en esta ruta: mandarle uno sería inventar un
    // contrato que el servidor no lee.
    expect(req.request.body).toBeNull();
    req.flush({
      id: UNIDAD,
      code: 'LAB-CENTRAL',
      name: 'Laboratorio Central',
      verificationStatus: 'concepto-verificada',
      status: 'concepto-activa',
      siteCount: 1,
      accreditationCount: 0,
    });

    expect(resultado?.verificationStatus).toBe('concepto-verificada');
  });

  it('crea la oferta de estudio bajo la unidad, con el cuerpo tal cual', () => {
    const cuerpo = {
      studyCode: 'HEM',
      studyConceptId: ESTUDIO,
      displayName: 'Hemograma completo',
      requiresMedicalOrder: true,
    };
    let creada: StudyOfferingCreated | undefined;
    client.createStudyOffering(UNIDAD, cuerpo).subscribe((valor) => (creada = valor));

    const req = http.expectOne(`/diagnostic-units/${UNIDAD}/study-offerings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({ id: 'of-1', studyCode: 'HEM', status: 'concepto-activa', componentCount: 0 });

    expect(creada?.id).toBe('of-1');
  });

  it('crea el tarifario bajo la unidad', () => {
    const cuerpo = { code: 'PUBLICO', publicVisibility: true };
    client.createPriceSchedule(UNIDAD, cuerpo).subscribe();

    const req = http.expectOne(`/diagnostic-units/${UNIDAD}/price-schedules`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({ id: 'sch-1', code: 'PUBLICO', status: 'concepto-activo' });
  });

  // El precio NO cuelga de la unidad: cuelga del tarifario. Recolgarlo para que
  // se vea parejo con los otros daría una ruta que el servidor no atiende.
  it('crea el precio bajo el tarifario, con los importes como cadena', () => {
    const cuerpo = { diagnosticStudyOfferingId: 'of-1', baseAmount: '120.00' };
    let creado: StudyPriceCreated | undefined;
    client.createStudyPrice(TARIFARIO, cuerpo).subscribe((valor) => (creado = valor));

    const req = http.expectOne(`/price-schedules/${TARIFARIO}/study-prices`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    expect(typeof (req.request.body as { baseAmount: unknown }).baseAmount).toBe('string');
    req.flush({
      id: 'pr-1',
      versionNumber: 1,
      status: 'concepto-vigente',
      effectiveFrom: '2026-08-29T00:00:00.000Z',
    });

    expect(creado?.versionNumber).toBe(1);
  });

  it('cierra una versión de precio por su ruta propia y sin cuerpo', () => {
    let resultado: AdminOperationResult | undefined;
    client.closeStudyPrice('pr-1').subscribe((valor) => (resultado = valor));

    const req = http.expectOne('/study-prices/pr-1/close');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush({ ok: true });

    expect(resultado?.ok).toBe(true);
  });

  it('retira la oferta con DELETE sobre el catálogo de ofertas', () => {
    client.deleteStudyOffering('of-1').subscribe();

    const req = http.expectOne('/diagnostic-study-offerings/of-1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
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

  it('escapa el identificador también al escribir', () => {
    client.deleteStudyOffering('of/one').subscribe();

    http.expectOne('/diagnostic-study-offerings/of%2Fone').flush({ ok: true });
  });
});
