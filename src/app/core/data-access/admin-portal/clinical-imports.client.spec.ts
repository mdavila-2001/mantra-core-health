import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClinicalImportsClient } from './clinical-imports.client';
import type {
  ClinicalImportBatch,
  ClinicalImportCatalog,
  ClinicalImportDownload,
  ClinicalImportLoaded,
  ClinicalImportReport,
} from './clinical-imports.types';

/* Todo lo que se manda y se recibe acá es sintético (`SINT-…`, `.invalid`). */

const LOTE: ClinicalImportBatch = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'hc-alergia',
  kindVersion: '1',
  group: 'CLINICAL',
  status: 'VALIDADO',
  createdAt: '2026-10-30T12:00:00.000Z',
  updatedAt: '2026-10-30T12:00:00.000Z',
  declaration: {
    sourceOrganization: 'Origen sintético',
    legalBasis: 'Convenio de ejemplo',
    loadedAt: '2026-10-30',
  },
  source: { format: 'csv', byteSize: 100 },
  counts: { total: 2, valid: 2, rejected: 0 },
  fileIssues: [],
  issues: { total: 0, truncated: false, items: [] },
  progress: { processed: 0, total: 2 },
};

describe('ClinicalImportsClient', () => {
  let http: HttpTestingController;
  let client: ClinicalImportsClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(ClinicalImportsClient);
  });

  afterEach(() => http.verify());

  it('lee el catálogo de GET /admin/clinical-imports/catalog tal cual', () => {
    const cuerpo: ClinicalImportCatalog = {
      kinds: [],
      limits: {
        maxBytes: 20971520,
        maxRows: 5000,
        maxPreviewIssues: 200,
        maxIdempotencyKeyLength: 128,
      },
      formats: ['csv', 'json'],
      engine: {
        persistence: { connected: true, adapter: 'InMemoryBatchRepository' },
        writer: { connected: false, adapter: 'NotConnectedClinicalWriter' },
        audit: { connected: false, adapter: 'NotConnectedImportAudit' },
        resolvers: {
          patients: { connected: false, adapter: 'NotConnectedPatientResolver' },
          codes: { connected: false, adapter: 'NotConnectedConceptResolver' },
          practitioners: { connected: false, adapter: 'NotConnectedPractitionerResolver' },
        },
      },
    };
    let recibido: ClinicalImportCatalog | undefined;
    client.catalog().subscribe((r) => (recibido = r));
    const req = http.expectOne('/admin/clinical-imports/catalog');
    expect(req.request.method).toBe('GET');
    req.flush(cuerpo);
    expect(recibido).toEqual(cuerpo);
  });

  it('baja la plantilla (regla T1) con tipo y formato en la consulta, y el nombre del servidor', () => {
    let csv: ClinicalImportDownload | undefined;
    client.downloadTemplate('hc-alergia', 'csv').subscribe((r) => (csv = r));
    const req = http.expectOne((r) => r.url === '/admin/clinical-imports/import-template');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('kind')).toBe('hc-alergia');
    expect(req.request.params.get('format')).toBe('csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['documentNumber,birthDate\n']), {
      headers: { 'Content-Disposition': 'attachment; filename="plantilla-hc-alergia-v1.csv"' },
    });
    expect(csv?.fileName).toBe('plantilla-hc-alergia-v1.csv');
    expect(csv?.blob.size).toBeGreaterThan(0);
  });

  it('si la respuesta no trae nombre, usa el mismo nombre del servidor como reserva (JSON)', () => {
    let json: ClinicalImportDownload | undefined;
    client.downloadTemplate('hc-nota', 'json').subscribe((r) => (json = r));
    const req = http.expectOne((r) => r.url === '/admin/clinical-imports/import-template');
    expect(req.request.params.get('format')).toBe('json');
    req.flush(new Blob(['{}']));
    expect(json?.fileName).toBe('plantilla-hc-nota-v1.json');
  });

  it('lista los lotes con el límite como parámetro', () => {
    let recibido: readonly ClinicalImportBatch[] | undefined;
    client.list(10).subscribe((r) => (recibido = r));
    const req = http.expectOne((r) => r.url === '/admin/clinical-imports');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush([LOTE]);
    expect(recibido).toEqual([LOTE]);
  });

  it('crea el lote por multipart con archivo, tipo y la declaración COMPLETA; nada del archivo va en la URL', () => {
    const archivo = new File(['documentNumber,birthDate\nSINT-0001,1990-01-15\n'], 'alergias.csv', {
      type: 'text/csv',
    });
    let creado: ClinicalImportBatch | undefined;
    client
      .create({
        kind: 'hc-alergia',
        declaration: {
          sourceOrganization: 'Origen',
          legalBasis: 'Base legal',
          loadedAt: '2026-10-01',
        },
        file: archivo,
      })
      .subscribe((r) => (creado = r));
    const req = http.expectOne('/admin/clinical-imports');
    expect(req.request.method).toBe('POST');
    expect(req.request.url).not.toMatch(/SINT|1990/);
    const form = req.request.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('alergias.csv');
    expect([
      form.get('kind'),
      form.get('sourceOrganization'),
      form.get('legalBasis'),
      form.get('loadedAt'),
    ]).toEqual(['hc-alergia', 'Origen', 'Base legal', '2026-10-01']);
    expect(form.has('reason')).toBe(false);
    req.flush(LOTE, { status: 201, statusText: 'Created' });
    expect(creado).toEqual(LOTE);
  });

  it('una declaración incompleta rechazada por la API llega con su campo', () => {
    let error: HttpErrorResponse | undefined;
    client
      .create({
        kind: 'hc-alergia',
        declaration: { sourceOrganization: '', legalBasis: 'Base legal', loadedAt: '2026-10-01' },
        file: new File(['x'], 'a.csv'),
      })
      .subscribe({ error: (e: HttpErrorResponse) => (error = e) });
    http
      .expectOne('/admin/clinical-imports')
      .flush(
        {
          code: 'VALIDATION_FAILED',
          reason: 'DECLARATION_INVALID',
          details: { field: 'sourceOrganization' },
        },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(error?.status).toBe(400);
    expect((error?.error as { details: { field: string } }).details.field).toBe(
      'sourceOrganization',
    );
  });

  describe('confirmar con Idempotency-Key', () => {
    const confirmar = (id = LOTE.id) => {
      client.confirm(id).subscribe({ error: () => undefined });
      return http.expectOne(`/admin/clinical-imports/${id}/confirm`);
    };

    it('manda POST sin cuerpo y con una clave', () => {
      const req = confirmar();
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeNull();
      expect(req.request.headers.get('Idempotency-Key')).toMatch(/^[A-Za-z0-9._:-]+$/);
      req.flush({ ...LOTE, status: 'EN_COLA' }, { status: 202, statusText: 'Accepted' });
    });

    it('un reintento tras un fallo lleva la MISMA clave y tras un éxito una NUEVA', () => {
      const primera = confirmar();
      const clave = primera.request.headers.get('Idempotency-Key');
      primera.flush({ message: 'x' }, { status: 502, statusText: 'Bad Gateway' });

      const reintento = confirmar();
      expect(reintento.request.headers.get('Idempotency-Key')).toBe(clave);
      reintento.flush({ ...LOTE, status: 'EN_COLA' }, { status: 202, statusText: 'Accepted' });

      const otraVez = confirmar();
      expect(otraVez.request.headers.get('Idempotency-Key')).not.toBe(clave);
      otraVez.flush({ ...LOTE, status: 'EN_COLA' }, { status: 202, statusText: 'Accepted' });
    });

    it('dos lotes distintos no comparten clave', () => {
      const a = confirmar(LOTE.id);
      const b = confirmar('22222222-2222-4222-8222-222222222222');
      expect(a.request.headers.get('Idempotency-Key')).not.toBe(
        b.request.headers.get('Idempotency-Key'),
      );
      a.flush(LOTE, { status: 202, statusText: 'Accepted' });
      b.flush(LOTE, { status: 202, statusText: 'Accepted' });
    });

    it('un 404 (lote de otra organización o inexistente) llega con su motivo', () => {
      let error: HttpErrorResponse | undefined;
      client.confirm(LOTE.id).subscribe({ error: (e: HttpErrorResponse) => (error = e) });
      http
        .expectOne(`/admin/clinical-imports/${LOTE.id}/confirm`)
        .flush(
          { code: 'NOT_FOUND', reason: 'BATCH_NOT_AVAILABLE' },
          { status: 404, statusText: 'Not Found' },
        );
      expect(error?.status).toBe(404);
      expect((error?.error as { reason: string }).reason).toBe('BATCH_NOT_AVAILABLE');
    });
  });

  it('lee el estado de un lote', () => {
    let recibido: ClinicalImportBatch | undefined;
    client.get(LOTE.id).subscribe((r) => (recibido = r));
    const req = http.expectOne(`/admin/clinical-imports/${LOTE.id}`);
    expect(req.request.method).toBe('GET');
    req.flush(LOTE);
    expect(recibido).toEqual(LOTE);
  });

  it('lee el informe en JSON y lo baja como archivo en CSV o JSON', () => {
    const informe: ClinicalImportReport = {
      batchId: LOTE.id,
      kind: LOTE.kind,
      status: 'COMPLETADO',
      generatedAt: '2026-10-30T12:05:00.000Z',
      totals: { total: 2, CREADA: 1, OMITIDA: 1 },
      fileIssues: [],
      rows: [
        { row: 1, outcome: 'CREADA' },
        { row: 2, outcome: 'OMITIDA', reason: 'ALREADY_LOADED', message: 'Ya existía' },
      ],
    };
    let leido: ClinicalImportReport | undefined;
    client.report(LOTE.id).subscribe((r) => (leido = r));
    const lectura = http.expectOne((r) => r.url === `/admin/clinical-imports/${LOTE.id}/report`);
    expect(lectura.request.params.get('format')).toBe('json');
    expect(lectura.request.responseType).toBe('json');
    lectura.flush(informe);
    expect(leido).toEqual(informe);

    let csv: ClinicalImportDownload | undefined;
    client.downloadReport(LOTE.id, 'csv').subscribe((r) => (csv = r));
    const descarga = http.expectOne((r) => r.url === `/admin/clinical-imports/${LOTE.id}/report`);
    expect(descarga.request.params.get('format')).toBe('csv');
    expect(descarga.request.responseType).toBe('blob');
    descarga.flush(new Blob(['row,outcome\n']), {
      headers: { 'Content-Disposition': `attachment; filename="informe-${LOTE.id}.csv"` },
    });
    expect(csv?.fileName).toBe(`informe-${LOTE.id}.csv`);

    let json: ClinicalImportDownload | undefined;
    client.downloadReport(LOTE.id, 'json').subscribe((r) => (json = r));
    http
      .expectOne((r) => r.url === `/admin/clinical-imports/${LOTE.id}/report`)
      .flush(new Blob(['{}']));
    expect(json?.fileName).toBe(`informe-${LOTE.id}.json`);
  });

  it('lee lo cargado: sólo identificadores', () => {
    const cuerpo: ClinicalImportLoaded = {
      batchId: LOTE.id,
      records: [
        {
          row: 1,
          kind: 'hc-alergia',
          entity: 'clinical.allergy_intolerances',
          targetId: '33333333-3333-4333-8333-333333333333',
        },
      ],
    };
    let recibido: ClinicalImportLoaded | undefined;
    client.loaded(LOTE.id).subscribe((r) => (recibido = r));
    const req = http.expectOne(`/admin/clinical-imports/${LOTE.id}/loaded`);
    expect(req.request.method).toBe('GET');
    req.flush(cuerpo);
    expect(recibido).toEqual(cuerpo);
  });
});
