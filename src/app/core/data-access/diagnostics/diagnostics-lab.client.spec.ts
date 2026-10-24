import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DiagnosticsLabClient } from './diagnostics-lab.client';
import type { AccessionDetail, LabInboxPage, SpecimenDetail } from './diagnostics-lab.types';

const ACCESSION_DETAIL_WIRE = {
  id: 'acc-1',
  custodianTenantId: 't-1',
  patientProfileId: 'p-1',
  accessionNumber: 'ACC-1',
  receivedAt: '2026-08-14T10:00:00.000Z',
  priorityConceptId: 'prio-1',
  statusConceptId: 'st-received',
  specimens: [
    {
      accessionSpecimenId: 'as-1',
      sequenceNumber: 1,
      statusConceptId: 'st-item-received',
      specimen: {
        id: 's-1',
        patientProfileId: 'p-1',
        specimenTypeConceptId: 'type-1',
        statusConceptId: 'st-received',
        collectedAt: '2026-08-14T09:00:00.000Z',
        receivedAt: '2026-08-14T10:00:00.000Z',
        containers: [
          { id: 'c-1', containerIdentifier: 'CT-1', containerTypeConceptId: 'ct-1', statusConceptId: 'st-active' },
        ],
        custodyEvents: [
          {
            id: 'cust-1',
            custodyEventTypeConceptId: 'evt-reception',
            occurredAt: '2026-08-14T10:00:00.000Z',
          },
        ],
      },
    },
  ],
};

describe('DiagnosticsLabClient', () => {
  let client: DiagnosticsLabClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(DiagnosticsLabClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('listInbox (recepción de muestras)', () => {
    it('aceptado: pide por POST con el filtro en el cuerpo y convierte las fechas', () => {
      let pagina: LabInboxPage | undefined;
      client.listInbox({ patientQuery: 'Pérez', limit: 10 }).subscribe((p) => (pagina = p));

      const req = http.expectOne((r) => r.url === '/diagnostics/service-requests/inbox');
      expect(req.request.method).toBe('POST');
      // El nombre del paciente no viaja en la URL.
      expect(req.request.urlWithParams).not.toContain('P%C3%A9rez');
      expect(req.request.body).toEqual({ patientQuery: 'Pérez', limit: 10 });

      req.flush({
        items: [
          {
            serviceRequestId: 'sr-1',
            patientProfileId: 'p-1',
            patientDisplayName: 'Ana Pérez',
            patientCode: 'HC-1',
            codeConceptId: 'study-1',
            codeDisplay: 'Hemograma',
            categoryConceptId: 'cat-lab',
            priorityConceptId: null,
            statusConceptId: 'sr-active',
            requesterProfileId: null,
            requestingTenantId: 't-clinic',
            requestingTenantName: 'Clínica',
            requestedAt: '2026-09-20T08:00:00.000Z',
            specimens: [ACCESSION_DETAIL_WIRE.specimens[0]!.specimen],
          },
        ],
        count: 1,
        limit: 10,
        nextCursor: 'c-2',
      });

      expect(pagina?.nextCursor).toBe('c-2');
      expect(pagina?.items[0]?.requestedAt).toEqual(new Date('2026-09-20T08:00:00.000Z'));
      expect(pagina?.items[0]?.specimens[0]?.receivedAt).toEqual(
        new Date('2026-08-14T10:00:00.000Z'),
      );
      expect(pagina?.items[0]?.specimens[0]?.custodyEvents[0]?.occurredAt).toBeInstanceOf(Date);
    });

    it('límite: sin argumentos manda el cuerpo vacío (tope por defecto del servidor)', () => {
      client.listInbox().subscribe();

      const req = http.expectOne((r) => r.url === '/diagnostics/service-requests/inbox');
      expect(req.request.body).toEqual({});
      req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
    });
  });

  describe('accession (UC-20-01)', () => {
    it('aceptado: omite claves ausentes y devuelve los ids creados', () => {
      let creada: unknown;
      client
        .accession({ patientProfileId: 'p-1', specimenIds: ['s-1', 's-2'] })
        .subscribe((res) => (creada = res));

      const req = http.expectOne((r) => r.url === '/diagnostics/accessions');
      expect('custodianTenantId' in req.request.body).toBe(false);
      expect(req.request.body.specimenIds).toEqual(['s-1', 's-2']);

      req.flush({ id: 'acc-1', status: 'st-received', accessionSpecimenIds: ['as-1', 'as-2'] });
      expect(creada).toEqual({
        id: 'acc-1',
        status: 'st-received',
        accessionSpecimenIds: ['as-1', 'as-2'],
      });
    });
  });

  describe('getAccession (CL-47)', () => {
    it('aceptado: convierte las fechas de la acesión y de cada espécimen', () => {
      let detalle: AccessionDetail | undefined;
      client.getAccession('acc-1').subscribe((d) => (detalle = d));

      http.expectOne((r) => r.url === '/diagnostics/accessions/acc-1').flush(ACCESSION_DETAIL_WIRE);

      expect(detalle?.receivedAt).toBeInstanceOf(Date);
      expect(detalle?.specimens[0]?.specimen.collectedAt).toBeInstanceOf(Date);
      expect(detalle?.specimens[0]?.specimen.custodyEvents[0]?.occurredAt).toBeInstanceOf(Date);
      expect(detalle?.specimens[0]?.specimen.containers[0]?.containerIdentifier).toBe('CT-1');
    });

    it('límite: una acesión sin especímenes todavía convierte igual', () => {
      let detalle: AccessionDetail | undefined;
      client.getAccession('acc-1').subscribe((d) => (detalle = d));

      http
        .expectOne((r) => r.url === '/diagnostics/accessions/acc-1')
        .flush({ ...ACCESSION_DETAIL_WIRE, specimens: [] });

      expect(detalle?.specimens).toEqual([]);
    });
  });

  describe('getSpecimen (CL-47)', () => {
    it('aceptado: un espécimen sin fecha de recepción no la inventa', () => {
      let detalle: SpecimenDetail | undefined;
      client.getSpecimen('s-1').subscribe((d) => (detalle = d));

      http.expectOne((r) => r.url === '/diagnostics/specimens/s-1').flush({
        id: 's-1',
        patientProfileId: 'p-1',
        specimenTypeConceptId: 'type-1',
        statusConceptId: 'st-collected',
        containers: [],
        custodyEvents: [],
      });

      expect(detalle?.receivedAt).toBeUndefined();
      expect('receivedAt' in (detalle ?? {})).toBe(false);
    });
  });

  describe('createReportVersion y releaseReportVersion (D-E)', () => {
    it('aceptado: crea la versión con el reportId en la URL', () => {
      client.createReportVersion('report-1', { conclusionText: 'Sin hallazgos' }).subscribe();

      const req = http.expectOne((r) => r.url === '/diagnostics/reports/report-1/versions');
      expect(req.request.body).toEqual({ conclusionText: 'Sin hallazgos' });
      req.flush({ id: 'version-1', status: 'st-preliminary' });
    });

    it('aceptado: libera con la visibilidad pedida', () => {
      client
        .releaseReportVersion('report-1', 'version-1', { patientVisibility: 'HIDDEN' })
        .subscribe();

      const req = http.expectOne(
        (r) => r.url === '/diagnostics/reports/report-1/versions/version-1/release',
      );
      expect(req.request.body).toEqual({ patientVisibility: 'HIDDEN' });
      req.flush({ id: 'version-1', status: 'st-final' });
    });

    it('límite: sin argumentos, libera con el cuerpo vacío (visibilidad por defecto del backend)', () => {
      client.releaseReportVersion('report-1', 'version-1').subscribe();

      const req = http.expectOne(
        (r) => r.url === '/diagnostics/reports/report-1/versions/version-1/release',
      );
      expect(req.request.body).toEqual({});
      req.flush({ id: 'version-1', status: 'st-final' });
    });
  });
});
