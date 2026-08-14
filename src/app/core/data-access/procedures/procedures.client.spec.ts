import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProceduresClient } from './procedures.client';
import type { DentalProcedure, SurgicalCaseDetail } from './procedures.types';

const PACIENTE = 'p-1';

describe('ProceduresClient', () => {
  let client: ProceduresClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(ProceduresClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('listCases', () => {
    /**
     * Siempre acotado al paciente: el backend admite listar la agenda entera del
     * quirófano, y pedir sin filtro desde una ficha clínica sería traerse la
     * actividad quirúrgica de toda la organización para mostrar la de uno.
     */
    it('acota siempre al paciente', () => {
      client.listCases({ patientProfileId: PACIENTE }).subscribe();

      const req = http.expectOne((r) => r.url === '/procedure-cases');
      expect(req.request.params.get('patientProfileId')).toBe(PACIENTE);
      req.flush({ items: [], total: 0 });
    });

    /**
     * El backend valida con `forbidNonWhitelisted`: una clave declarada en
     * `undefined` viaja igual y la petición vuelve con 400.
     */
    it('no manda `limit` si no se pidió', () => {
      client.listCases({ patientProfileId: PACIENTE }).subscribe();

      const req = http.expectOne((r) => r.url === '/procedure-cases');
      expect(req.request.params.has('limit')).toBe(false);
      req.flush({ items: [], total: 0 });
    });

    it('manda `limit` cuando se pide', () => {
      client.listCases({ patientProfileId: PACIENTE, limit: 5 }).subscribe();

      const req = http.expectOne((r) => r.url === '/procedure-cases');
      expect(req.request.params.get('limit')).toBe('5');
      req.flush({ items: [], total: 0 });
    });

    /**
     * El servidor manda `null` en los opcionales vacíos, no los omite. Sin
     * normalizarlo, `if (caso.primarySurgeonProfileId)` sería falso por el
     * motivo equivocado y una fecha nula se pintaría como 1970.
     */
    it('un opcional en `null` queda ausente, no en `null`', () => {
      let casos: readonly unknown[] = [];
      client.listCases({ patientProfileId: PACIENTE }).subscribe((p) => (casos = p.items));

      http.expectOne((r) => r.url === '/procedure-cases').flush({
        items: [
          {
            id: 'c-1',
            caseNumber: 'CQ-000001',
            patientProfileId: PACIENTE,
            primarySurgeonProfileId: null,
            operatingRoomId: null,
            statusConceptId: 'st-1',
            scheduledStartAt: null,
            scheduledEndAt: null,
          },
        ],
        total: 1,
      });

      const caso = casos[0] as Record<string, unknown>;
      expect('primarySurgeonProfileId' in caso).toBe(false);
      expect('scheduledStartAt' in caso).toBe(false);
    });

    it('convierte las horas programadas a `Date`', () => {
      let casos: readonly { readonly scheduledStartAt?: Date }[] = [];
      client.listCases({ patientProfileId: PACIENTE }).subscribe((p) => (casos = p.items));

      http.expectOne((r) => r.url === '/procedure-cases').flush({
        items: [
          {
            id: 'c-1',
            caseNumber: 'CQ-000001',
            patientProfileId: PACIENTE,
            statusConceptId: 'st-1',
            scheduledStartAt: '2026-08-10T13:00:00.000Z',
          },
        ],
        total: 1,
      });

      expect(casos[0].scheduledStartAt).toBeInstanceOf(Date);
    });
  });

  describe('getCase', () => {
    /**
     * Pasos, hallazgos e implantes eran escrituras sin lectura hasta este
     * carril. Que vuelvan del detalle es lo que hace posible el histórico del
     * punto 7; si el contrato se los volviera a llevar, esta prueba lo dice.
     */
    it('trae pasos, hallazgos e implantes del caso', () => {
      let detalle: SurgicalCaseDetail | null = null;
      client.getCase('c-1').subscribe((d) => (detalle = d));

      http.expectOne((r) => r.url === '/procedure-cases/c-1').flush({
        case: {
          id: 'c-1',
          caseNumber: 'CQ-000001',
          patientProfileId: PACIENTE,
          statusConceptId: 'st-1',
        },
        team: [],
        operativeSteps: [
          {
            id: 's-1',
            stepNumber: 1,
            stepCodeConceptId: 'code-1',
            description: 'Abordaje',
            statusConceptId: 'st-2',
            startedAt: '2026-08-10T13:10:00.000Z',
          },
        ],
        findings: [
          {
            id: 'f-1',
            findingCodeConceptId: 'code-2',
            findingText: 'Adherencias',
            recordedAt: '2026-08-10T13:30:00.000Z',
          },
        ],
        implants: [],
        operativeReports: [],
      });

      expect(detalle!.operativeSteps[0].description).toBe('Abordaje');
      expect(detalle!.operativeSteps[0].startedAt).toBeInstanceOf(Date);
      expect(detalle!.findings[0].recordedAt).toBeInstanceOf(Date);
    });

    /** El lote es lo que hace trazable a un implante. */
    it('conserva los identificadores anidados en su implante', () => {
      let detalle: SurgicalCaseDetail | null = null;
      client.getCase('c-1').subscribe((d) => (detalle = d));

      http.expectOne((r) => r.url === '/procedure-cases/c-1').flush({
        case: {
          id: 'c-1',
          caseNumber: 'CQ-000001',
          patientProfileId: PACIENTE,
          statusConceptId: 'st-1',
        },
        team: [],
        operativeSteps: [],
        findings: [],
        implants: [
          {
            id: 'i-1',
            procedureId: 'proc-1',
            implantDeviceId: 'dev-1',
            implantRoleConceptId: 'role-1',
            implantedAt: '2026-08-10T14:00:00.000Z',
            explantedAt: null,
            identifiers: [
              {
                id: 'id-1',
                identifierTypeConceptId: 'udi',
                identifierValue: '0123456789',
                lotNumber: 'L-42',
                serialNumber: null,
                expirationDate: '2028-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
        operativeReports: [],
      });

      const implante = detalle!.implants[0];
      expect(implante.implantedAt).toBeInstanceOf(Date);
      expect('explantedAt' in implante).toBe(false);
      expect(implante.identifiers[0].lotNumber).toBe('L-42');
      expect('serialNumber' in implante.identifiers[0]).toBe(false);
      expect(implante.identifiers[0].expirationDate).toBeInstanceOf(Date);
    });

    /**
     * Un caso sin registro intraoperatorio es lo corriente —uno programado y
     * todavía no operado—. La pantalla no debería tener que defenderse de
     * `undefined` para dibujar una lista vacía.
     */
    it('un detalle sin listas devuelve arreglos vacíos', () => {
      let detalle: SurgicalCaseDetail | null = null;
      client.getCase('c-1').subscribe((d) => (detalle = d));

      http.expectOne((r) => r.url === '/procedure-cases/c-1').flush({
        case: {
          id: 'c-1',
          caseNumber: 'CQ-000001',
          patientProfileId: PACIENTE,
          statusConceptId: 'st-1',
        },
      });

      expect(detalle!.operativeSteps).toEqual([]);
      expect(detalle!.findings).toEqual([]);
      expect(detalle!.implants).toEqual([]);
      expect(detalle!.team).toEqual([]);
    });
  });

  describe('el histórico odontológico', () => {
    it('acota al paciente', () => {
      client.listDentalProcedures({ patientProfileId: PACIENTE }).subscribe();

      const req = http.expectOne((r) => r.url === '/dental-procedures');
      expect(req.request.params.get('patientProfileId')).toBe(PACIENTE);
      req.flush({ items: [], total: 0 });
    });

    it('convierte fechas y cuelga los sitios de su procedimiento', () => {
      let items: readonly DentalProcedure[] = [];
      client
        .listDentalProcedures({ patientProfileId: PACIENTE })
        .subscribe((p) => (items = p.items));

      http.expectOne((r) => r.url === '/dental-procedures').flush({
        items: [
          {
            id: 'd-1',
            patientProfileId: PACIENTE,
            procedureCodeConceptId: 'code-1',
            statusConceptId: 'st-1',
            performerProfileId: null,
            noteText: 'Restauración con composite.',
            performedAt: '2026-08-10T14:00:00.000Z',
            createdAt: '2026-08-11T09:00:00.000Z',
            sites: [
              { id: 's-1', bodySiteConceptId: 'tooth-36', description: 'Cara oclusal' },
            ],
          },
        ],
        total: 1,
      });

      expect(items[0].performedAt).toBeInstanceOf(Date);
      expect(items[0].createdAt).toBeInstanceOf(Date);
      expect('performerProfileId' in items[0]).toBe(false);
      expect(items[0].sites[0].description).toBe('Cara oclusal');
    });

    it('un tratamiento sin pieza trae `sites` vacío', () => {
      let items: readonly DentalProcedure[] = [];
      client
        .listDentalProcedures({ patientProfileId: PACIENTE })
        .subscribe((p) => (items = p.items));

      http.expectOne((r) => r.url === '/dental-procedures').flush({
        items: [
          {
            id: 'd-1',
            patientProfileId: PACIENTE,
            procedureCodeConceptId: 'code-1',
            statusConceptId: 'st-1',
            createdAt: '2026-08-11T09:00:00.000Z',
            sites: null,
          },
        ],
        total: 1,
      });

      expect(items[0].sites).toEqual([]);
    });

    it('el catálogo se lee tal cual', () => {
      client.readDentalCatalog().subscribe();

      const req = http.expectOne((r) => r.url === '/dental-procedures/catalog');
      expect(req.request.method).toBe('GET');
      req.flush({ procedureCodes: [], teeth: [], quadrants: [] });
    });

    it('el alta manda el cuerpo y devuelve la fecha como `Date`', () => {
      let alta: { readonly createdAt: Date } | null = null;
      client
        .recordDentalProcedure({
          patientProfileId: PACIENTE,
          procedureCodeConceptId: 'code-1',
          toothSiteConceptId: 'tooth-36',
        })
        .subscribe((r) => (alta = r));

      const req = http.expectOne((r) => r.url === '/dental-procedures');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.toothSiteConceptId).toBe('tooth-36');
      req.flush({
        id: 'd-1',
        patientProfileId: PACIENTE,
        statusConceptId: 'st-1',
        createdAt: '2026-08-11T09:00:00.000Z',
      });

      expect(alta!.createdAt).toBeInstanceOf(Date);
    });
  });
});
