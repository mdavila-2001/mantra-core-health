import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BulkImportsClient } from './bulk-imports.client';
import type {
  BulkImportBatch,
  BulkImportCatalog,
  BulkImportDownload,
  BulkImportReport,
} from './bulk-imports.types';

/* Todo lo que se manda y se recibe acá es sintético. */

const LOTE: BulkImportBatch = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'usuario-paciente',
  kindVersion: '1',
  group: 'USERS',
  status: 'VALIDADO',
  createdAt: '2026-10-30T12:00:00.000Z',
  updatedAt: '2026-10-30T12:00:00.000Z',
  declaration: { reason: 'prueba' },
  source: { format: 'csv', byteSize: 100 },
  counts: { total: 2, valid: 2, rejected: 0 },
  fileIssues: [],
  issues: { total: 0, truncated: false, items: [] },
  progress: { processed: 0, total: 2 },
};

describe('BulkImportsClient', () => {
  let http: HttpTestingController;
  let client: BulkImportsClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(BulkImportsClient);
  });

  afterEach(() => http.verify());

  it('lee el catálogo de GET /admin/bulk-imports/templates tal cual', () => {
    const cuerpo: BulkImportCatalog = {
      templates: [],
      limits: { maxBytes: 20971520, maxRows: 5000, maxPreviewIssues: 200, maxIdempotencyKeyLength: 128 },
      formats: ['csv', 'json'],
      engine: {
        persistence: { durable: false, adapter: 'InMemoryBatchRepository' },
        executors: {
          users: { connected: false, adapter: 'NotConnectedUserProvisioner' },
          clinical: { connected: false, adapter: 'NotConnectedClinicalWriter' },
        },
        resolvers: {
          patients: { connected: false, adapter: 'NotConnectedPatientResolver' },
          codes: { connected: false, adapter: 'NotConnectedCodeResolver' },
        },
      },
    };
    let recibido: BulkImportCatalog | undefined;
    client.catalog().subscribe((r) => (recibido = r));
    const req = http.expectOne('/admin/bulk-imports/templates');
    expect(req.request.method).toBe('GET');
    req.flush(cuerpo);
    expect(recibido).toEqual(cuerpo);
  });

  it('baja la plantilla como archivo, con el nombre del servidor y el formato pedido', () => {
    let csv: BulkImportDownload | undefined;
    client.downloadTemplate('usuario-paciente', 'csv').subscribe((r) => (csv = r));
    const req = http.expectOne((r) => r.url === '/admin/bulk-imports/templates/usuario-paciente');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('format')).toBe('csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['name,lastName\n']), {
      headers: { 'Content-Disposition': 'attachment; filename="plantilla-usuario-paciente-v1.csv"' },
    });
    expect(csv?.fileName).toBe('plantilla-usuario-paciente-v1.csv');
    expect(csv?.blob.size).toBeGreaterThan(0);
  });

  it('si la respuesta no trae nombre, usa el mismo nombre del servidor como reserva (JSON)', () => {
    let json: BulkImportDownload | undefined;
    client.downloadTemplate('hc-nota', 'json').subscribe((r) => (json = r));
    const req = http.expectOne((r) => r.url === '/admin/bulk-imports/templates/hc-nota');
    expect(req.request.params.get('format')).toBe('json');
    req.flush(new Blob(['{}']));
    expect(json?.fileName).toBe('plantilla-hc-nota-v1.json');
  });

  it('un tipo con caracteres raros viaja codificado en la ruta', () => {
    client.downloadTemplate('a/b', 'csv').subscribe();
    http.expectOne((r) => r.url === '/admin/bulk-imports/templates/a%2Fb').flush(new Blob([]));
  });

  it('lista los lotes con el límite como parámetro', () => {
    let recibido: readonly BulkImportBatch[] | undefined;
    client.list(10).subscribe((r) => (recibido = r));
    const req = http.expectOne((r) => r.url === '/admin/bulk-imports');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush([LOTE]);
    expect(recibido).toEqual([LOTE]);
  });

  it('crea el lote por multipart con el archivo, el tipo y sólo los campos de declaración que hay', () => {
    const archivo = new File(['name,lastName\nPersona,Sintetico\n'], 'altas.csv', { type: 'text/csv' });
    let creado: BulkImportBatch | undefined;
    client
      .create({
        kind: 'usuario-paciente',
        declaration: { reason: 'Alta de prueba', sourceOrganization: '', legalBasis: undefined },
        file: archivo,
      })
      .subscribe((r) => (creado = r));
    const req = http.expectOne('/admin/bulk-imports');
    expect(req.request.method).toBe('POST');
    const form = req.request.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('altas.csv');
    expect(form.get('kind')).toBe('usuario-paciente');
    expect(form.get('reason')).toBe('Alta de prueba');
    expect(form.has('sourceOrganization')).toBe(false);
    expect(form.has('legalBasis')).toBe(false);
    expect(form.has('loadedAt')).toBe(false);
    req.flush(LOTE, { status: 201, statusText: 'Created' });
    expect(creado).toEqual(LOTE);
  });

  it('la declaración clínica viaja completa', () => {
    client
      .create({
        kind: 'hc-nota',
        declaration: { sourceOrganization: 'Origen', legalBasis: 'Base legal', loadedAt: '2026-10-01' },
        file: new File(['x'], 'n.json'),
      })
      .subscribe();
    const req = http.expectOne('/admin/bulk-imports');
    const form = req.request.body as FormData;
    expect([form.get('sourceOrganization'), form.get('legalBasis'), form.get('loadedAt')]).toEqual([
      'Origen',
      'Base legal',
      '2026-10-01',
    ]);
    expect(form.has('reason')).toBe(false);
    req.flush(LOTE, { status: 201, statusText: 'Created' });
  });

  describe('confirmar con Idempotency-Key', () => {
    const confirmar = (id = LOTE.id) => {
      client.confirm(id).subscribe({ error: () => undefined });
      return http.expectOne(`/admin/bulk-imports/${id}/confirm`);
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
      expect(a.request.headers.get('Idempotency-Key')).not.toBe(b.request.headers.get('Idempotency-Key'));
      a.flush(LOTE, { status: 202, statusText: 'Accepted' });
      b.flush(LOTE, { status: 202, statusText: 'Accepted' });
    });

    it('un 409 de la API llega al que llama con su motivo', () => {
      let error: HttpErrorResponse | undefined;
      client.confirm(LOTE.id).subscribe({ error: (e: HttpErrorResponse) => (error = e) });
      http
        .expectOne(`/admin/bulk-imports/${LOTE.id}/confirm`)
        .flush({ code: 'CONFLICT', reason: 'BATCH_ALREADY_CONFIRMED' }, { status: 409, statusText: 'Conflict' });
      expect(error?.status).toBe(409);
      expect((error?.error as { reason: string }).reason).toBe('BATCH_ALREADY_CONFIRMED');
    });
  });

  it('lee el estado de un lote', () => {
    let recibido: BulkImportBatch | undefined;
    client.get(LOTE.id).subscribe((r) => (recibido = r));
    const req = http.expectOne(`/admin/bulk-imports/${LOTE.id}`);
    expect(req.request.method).toBe('GET');
    req.flush(LOTE);
    expect(recibido).toEqual(LOTE);
  });

  it('lee el informe en JSON y lo baja como archivo en CSV o JSON', () => {
    const informe: BulkImportReport = {
      batchId: LOTE.id,
      kind: LOTE.kind,
      status: 'COMPLETADO',
      generatedAt: '2026-10-30T12:05:00.000Z',
      totals: { total: 1, CREADA: 0, RECHAZADA: 1 },
      fileIssues: [],
      rows: [{ row: 1, outcome: 'RECHAZADA', reason: 'EXECUTOR_NOT_CONNECTED', message: 'No conectado' }],
    };
    let leido: BulkImportReport | undefined;
    client.report(LOTE.id).subscribe((r) => (leido = r));
    const lectura = http.expectOne((r) => r.url === `/admin/bulk-imports/${LOTE.id}/report`);
    expect(lectura.request.params.get('format')).toBe('json');
    expect(lectura.request.responseType).toBe('json');
    lectura.flush(informe);
    expect(leido).toEqual(informe);

    let csv: BulkImportDownload | undefined;
    client.downloadReport(LOTE.id, 'csv').subscribe((r) => (csv = r));
    const descarga = http.expectOne((r) => r.url === `/admin/bulk-imports/${LOTE.id}/report`);
    expect(descarga.request.params.get('format')).toBe('csv');
    expect(descarga.request.responseType).toBe('blob');
    descarga.flush(new Blob(['row,outcome\n']), {
      headers: { 'Content-Disposition': `attachment; filename="informe-${LOTE.id}.csv"` },
    });
    expect(csv?.fileName).toBe(`informe-${LOTE.id}.csv`);

    let json: BulkImportDownload | undefined;
    client.downloadReport(LOTE.id, 'json').subscribe((r) => (json = r));
    http.expectOne((r) => r.url === `/admin/bulk-imports/${LOTE.id}/report`).flush(new Blob(['{}']));
    expect(json?.fileName).toBe(`informe-${LOTE.id}.json`);
  });
});
