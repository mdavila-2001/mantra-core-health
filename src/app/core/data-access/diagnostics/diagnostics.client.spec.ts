import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DiagnosticsClient } from './diagnostics.client';
import type {
  DiagnosticOrderCreated,
  LabWorkOrder,
  PatientDiagnostics,
} from './diagnostics.types';

/** El circuito vacío con todos los bloques presentes, que es como llega. */
const CIRCUITO_VACIO = {
  patientProfileId: 'p-1',
  orders: [],
  reports: [],
  limit: 50,
  truncated: [],
};

const ORDEN = {
  id: 'sr-1',
  patientProfileId: 'p-1',
  encounterId: 'e-1',
  codeConceptId: 'code-1',
  categoryConceptId: 'cat-lab',
  statusConceptId: 'st-activa',
  createdAt: '2026-08-14T10:00:00.000Z',
};

const INFORME = {
  id: 'dr-1',
  patientProfileId: 'p-1',
  serviceRequestId: 'sr-1',
  codeConceptId: 'code-1',
  lifecycleStatusConceptId: 'st-final',
  createdAt: '2026-08-14T11:00:00.000Z',
};

/** Una orden recién creada, tal como responde `POST /clinical/service-requests`. */
const ORDEN_CREADA = {
  id: 'sr-1',
  patientProfileId: 'p-1',
  status: 'st-activa',
  intent: 'st-orden',
  createdAt: '2026-08-14T10:00:00.000Z',
};

describe('DiagnosticsClient', () => {
  let client: DiagnosticsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(DiagnosticsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getPatientDiagnostics', () => {
    it('sin tope no manda `limit`: la API tiene el suyo', () => {
      client.getPatientDiagnostics('p-1').subscribe();

      const req = http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders');
      expect(req.request.params.has('limit')).toBe(false);

      req.flush(CIRCUITO_VACIO);
    });

    it('con tope lo manda', () => {
      client.getPatientDiagnostics('p-1', 10).subscribe();

      const req = http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders');
      expect(req.request.params.get('limit')).toBe('10');

      req.flush(CIRCUITO_VACIO);
    });

    it('convierte las fechas de los dos bloques', () => {
      let circuito: PatientDiagnostics | undefined;
      client.getPatientDiagnostics('p-1').subscribe((c) => (circuito = c));

      http
        .expectOne((r) => r.url === '/diagnostics/patients/p-1/orders')
        .flush({ ...CIRCUITO_VACIO, orders: [ORDEN], reports: [INFORME] });

      expect(circuito?.orders[0].createdAt).toBeInstanceOf(Date);
      expect(circuito?.reports[0].createdAt).toBeInstanceOf(Date);
    });

    it('reenvía `truncated` tal cual: un circuito recortado sin avisar miente', () => {
      let circuito: PatientDiagnostics | undefined;
      client.getPatientDiagnostics('p-1', 1).subscribe((c) => (circuito = c));

      http
        .expectOne((r) => r.url === '/diagnostics/patients/p-1/orders')
        .flush({ ...CIRCUITO_VACIO, limit: 1, orders: [ORDEN], truncated: ['orders'] });

      expect(circuito?.truncated).toEqual(['orders']);
    });

    it('escapa el identificador en la ruta', () => {
      client.getPatientDiagnostics('p/1').subscribe();

      http.expectOne((r) => r.url === '/diagnostics/patients/p%2F1/orders').flush(CIRCUITO_VACIO);
    });
  });

  describe('listImagingStudies', () => {
    it('pega contra la lectura de estudios, que es otra tabla que la orden', () => {
      client.listImagingStudies('p-1').subscribe();

      const req = http.expectOne(
        (r) => r.url === '/diagnostics/patients/p-1/imaging-studies',
      );
      expect(req.request.params.has('limit')).toBe(false);
      expect(req.request.params.has('offset')).toBe(false);

      req.flush([]);
    });

    it('manda tope y desplazamiento cuando se piden', () => {
      client.listImagingStudies('p-1', 20, 40).subscribe();

      const req = http.expectOne(
        (r) => r.url === '/diagnostics/patients/p-1/imaging-studies',
      );
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.get('offset')).toBe('40');

      req.flush([]);
    });
  });

  describe('listWorkOrders', () => {
    it('sin filtros no manda ninguno: es la cola entera', () => {
      client.listWorkOrders().subscribe();

      const req = http.expectOne((r) => r.url === '/diagnostics/work-orders');
      expect(req.request.params.keys()).toEqual([]);

      req.flush([]);
    });

    it('manda sólo los filtros cargados', () => {
      client.listWorkOrders({ statusConceptId: 'st-1', limit: 25 }).subscribe();

      const req = http.expectOne((r) => r.url === '/diagnostics/work-orders');
      expect(req.request.params.get('statusConceptId')).toBe('st-1');
      expect(req.request.params.get('limit')).toBe('25');
      expect(req.request.params.has('assignedProfileId')).toBe(false);

      req.flush([]);
    });

    it('convierte las fechas de la cola', () => {
      let cola: readonly LabWorkOrder[] | undefined;
      client.listWorkOrders().subscribe((c) => (cola = c));

      http.expectOne((r) => r.url === '/diagnostics/work-orders').flush([
        {
          id: 'wo-1',
          workOrderNumber: 'WO-0001',
          laboratoryAccessionId: 'acc-1',
          statusConceptId: 'st-1',
          priorityConceptId: 'prio-1',
          scheduledAt: '2026-08-14T09:00:00.000Z',
        },
      ]);

      expect(cola?.[0].scheduledAt).toBeInstanceOf(Date);
    });

    /**
     * Una fecha ausente tiene que quedar **ausente**, no `undefined` declarado:
     * con la clave presente, `'completedAt' in orden` diría que la orden se
     * completó cuando sigue pendiente.
     */
    it('una fecha que no vino no deja la clave declarada', () => {
      let cola: readonly LabWorkOrder[] | undefined;
      client.listWorkOrders().subscribe((c) => (cola = c));

      http.expectOne((r) => r.url === '/diagnostics/work-orders').flush([
        {
          id: 'wo-1',
          workOrderNumber: 'WO-0001',
          laboratoryAccessionId: 'acc-1',
          statusConceptId: 'st-1',
          priorityConceptId: 'prio-1',
        },
      ]);

      expect('completedAt' in (cola?.[0] ?? {})).toBe(false);
      expect('scheduledAt' in (cola?.[0] ?? {})).toBe(false);
    });
  });

  describe('requestStudy', () => {
    /**
     * El alta es de `clinical`, no de `diagnostics`. Es el punto entero del
     * cliente: una orden diagnóstica es una orden de servicio con categoría.
     */
    it('pega contra `clinical`, que es donde viven las invariantes de la orden', () => {
      client
        .requestStudy({
          custodianTenantId: 't-1',
          patientProfileId: 'p-1',
          codeConceptId: 'code-1',
        })
        .subscribe();

      const req = http.expectOne((r) => r.url === '/clinical/service-requests');
      expect(req.request.method).toBe('POST');

      req.flush(ORDEN_CREADA);
    });

    it('omite las claves ausentes: el backend valida con `forbidNonWhitelisted`', () => {
      client
        .requestStudy({
          custodianTenantId: 't-1',
          patientProfileId: 'p-1',
          codeConceptId: 'code-1',
          encounterId: undefined,
          categoryConceptId: 'cat-lab',
        })
        .subscribe();

      const req = http.expectOne((r) => r.url === '/clinical/service-requests');
      expect('encounterId' in req.request.body).toBe(false);
      expect(req.request.body.categoryConceptId).toBe('cat-lab');

      req.flush(ORDEN_CREADA);
    });

    it('convierte la fecha de la orden creada', () => {
      let creada: DiagnosticOrderCreated | undefined;
      client
        .requestStudy({
          custodianTenantId: 't-1',
          patientProfileId: 'p-1',
          codeConceptId: 'code-1',
        })
        .subscribe((c) => (creada = c));

      http.expectOne((r) => r.url === '/clinical/service-requests').flush(ORDEN_CREADA);

      expect(creada?.createdAt).toBeInstanceOf(Date);
      expect(creada?.id).toBe('sr-1');
    });
  });
});
