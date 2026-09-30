import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ChartDocumentsClient } from '../chart-documents/chart-documents.client';
import { DiagnosticsClient } from '../diagnostics/diagnostics.client';
import { isScanPending } from './scan-status';

/**
 * BR-05 · las rutas de contexto que bajan un archivo: por `HttpClient`, con la
 * credencial, y con el nombre que declaró la API.
 */
describe('descarga de archivos por contexto (BR-05)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('DiagnosticsClient.downloadOwnResultFile: GET blob a la ruta del resultado propio', () => {
    let recibido: { blob: Blob; fileName?: string } | undefined;
    TestBed.inject(DiagnosticsClient)
      .downloadOwnResultFile('r-1', 'f-1')
      .subscribe((valor) => (recibido = valor));

    const pedido = http.expectOne('/diagnostic-results/me/r-1/files/f-1/content');
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.responseType).toBe('blob');
    pedido.flush(new Blob(['x'], { type: 'application/pdf' }), {
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''informe%20final.pdf" },
    });

    expect(recibido?.fileName).toBe('informe final.pdf');
    expect(recibido?.blob.size).toBe(1);
  });

  it('sin Content-Disposition no inventa un nombre', () => {
    let recibido: { blob: Blob; fileName?: string } | undefined;
    TestBed.inject(DiagnosticsClient)
      .downloadOwnResultFile('r-1', 'f-1')
      .subscribe((valor) => (recibido = valor));
    http.expectOne('/diagnostic-results/me/r-1/files/f-1/content').flush(new Blob(['x']));

    expect(recibido).toBeDefined();
    expect(recibido).not.toHaveProperty('fileName');
  });

  it('ChartDocumentsClient.downloadFile: GET blob a la ruta del documento del expediente', () => {
    let recibido: { blob: Blob; fileName?: string } | undefined;
    TestBed.inject(ChartDocumentsClient)
      .downloadFile('d-1', 'f-9')
      .subscribe((valor) => (recibido = valor));

    const pedido = http.expectOne('/charts/documents/d-1/files/f-9/content');
    expect(pedido.request.responseType).toBe('blob');
    pedido.flush(new Blob(['%PDF']), {
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''radiografia.pdf" },
    });

    expect(recibido?.fileName).toBe('radiografia.pdf');
  });

  it('isScanPending reconoce el 422 con details.reason SCAN_PENDING y nada más', () => {
    const pendiente = new HttpErrorResponse({
      status: 422,
      error: { code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'SCAN_PENDING' } },
    });
    const infectado = new HttpErrorResponse({
      status: 422,
      error: { code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'SCAN_INFECTED' } },
    });
    const otroStatus = new HttpErrorResponse({
      status: 403,
      error: { code: 'FORBIDDEN', message: 'x', details: { reason: 'SCAN_PENDING' } },
    });

    expect(isScanPending(pendiente)).toBe(true);
    expect(isScanPending(infectado)).toBe(false);
    expect(isScanPending(otroStatus)).toBe(false);
    expect(isScanPending(new Error('x'))).toBe(false);
  });
});
