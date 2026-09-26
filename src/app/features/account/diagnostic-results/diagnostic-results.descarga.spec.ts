import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { FileDownloadService } from '../../../shared/utils/file-download/file-download.service';
import { DiagnosticResults } from './diagnostic-results';

const REPORT_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';
const PROFILE_ID = '44444444-4444-4444-8444-444444444444';

const RESULTADO = {
  reportId: REPORT_ID,
  versionId: '55555555-5555-4555-8555-555555555555',
  versionNumber: 1,
  codeConceptId: 'concept-code',
  categoryConceptId: 'concept-cat',
  custodianTenantId: 'tenant-1',
  conclusionText: 'Valores dentro de rango.',
  releasedAt: '2026-08-10T12:00:00.000Z',
  clinicalStatusConceptId: 'concept-final',
  observationIds: [],
  files: [{ id: 'link-1', fileId: FILE_ID, contentRoleConceptId: 'concept-pdf', ordinal: 0 }],
};

/** Con `responseType: 'blob'` el cuerpo del error también llega como Blob. */
function jsonComoBlob(cuerpo: unknown): Blob {
  return new Blob([JSON.stringify(cuerpo)], { type: 'application/json' });
}

const RUTA_DEL_CONTEXTO = `/diagnostic-results/me/${REPORT_ID}/files/${FILE_ID}/content`;

/**
 * CL-40 · «Descargar» baja el PDF **por HttpClient**, con la credencial, desde la
 * ruta del propio resultado. Nunca abre una pestaña sobre una URL.
 */
describe('DiagnosticResults · descarga por blob (CL-40)', () => {
  let fixture: ComponentFixture<DiagnosticResults>;
  let http: HttpTestingController;
  const guardados: { blob: Blob; fileName: string }[] = [];
  const avisos: { tipo: string; texto: string }[] = [];

  beforeEach(() => {
    guardados.length = 0;
    avisos.length = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { patientProfileId: signal(PROFILE_ID) } },
        {
          provide: FileDownloadService,
          useValue: { save: (blob: Blob, fileName: string) => guardados.push({ blob, fileName }) },
        },
        {
          provide: ToastService,
          useValue: {
            info: (texto: string) => avisos.push({ tipo: 'info', texto }),
            error: (texto: string) => avisos.push({ tipo: 'error', texto }),
            success: (texto: string) => avisos.push({ tipo: 'success', texto }),
            warning: (texto: string) => avisos.push({ tipo: 'warning', texto }),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DiagnosticResults);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === '/diagnostic-results/me')
      .flush({ patientProfileId: PROFILE_ID, items: [RESULTADO], limit: 50, truncated: false });
    for (const pedido of http.match((request) => request.url.startsWith('/terminology'))) {
      pedido.flush({ items: [] });
    }
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function pulsarDescargar(): void {
    const boton = fixture.nativeElement.querySelector(
      '[data-testid="resultado-descargar-link-1"]',
    ) as HTMLElement;
    boton.click();
  }

  it('pide los bytes a la ruta del propio resultado y los entrega, sin window.open', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    pulsarDescargar();

    const pedido = http.expectOne(RUTA_DEL_CONTEXTO);
    expect(pedido.request.method).toBe('GET');
    expect(pedido.request.responseType).toBe('blob');
    pedido.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': "attachment; filename*=UTF-8''laboratorio-completo.pdf",
      },
    });

    expect(guardados).toHaveLength(1);
    expect(guardados[0]?.fileName).toBe('laboratorio-completo.pdf');
    expect(guardados[0]?.blob.type).toBe('application/pdf');
    expect(abrir).not.toHaveBeenCalled();
    // Y no se pidió ninguna URL firmada.
    http.expectNone((request) => request.url.includes('/common/files/'));
    abrir.mockRestore();
  });

  it('un 404 (no liberado o ajeno) se explica sin culpar a la persona ni entregar nada', async () => {
    pulsarDescargar();
    http
      .expectOne(RUTA_DEL_CONTEXTO)
      .flush(jsonComoBlob({ code: 'NOT_FOUND', message: 'x' }), {
        status: 404,
        statusText: 'Not Found',
      });
    // El cuerpo del error llega como Blob y se relee de forma asincronica.
    await new Promise((resolver) => setTimeout(resolver, 20));

    expect(guardados).toHaveLength(0);
    expect(avisos[0]?.texto).toContain('todavía no está disponible');
  });

  it('un 422 SCAN_PENDING dice «en análisis», no un error genérico', async () => {
    pulsarDescargar();
    http.expectOne(RUTA_DEL_CONTEXTO).flush(
      jsonComoBlob({ code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'SCAN_PENDING' } }),
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    // El cuerpo del error llega como Blob y se relee de forma asincrónica.
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 20));

    expect(guardados).toHaveLength(0);
    expect(avisos[0]?.texto).toContain('en análisis');
  });

  it('un fallo de red pide reintentar', () => {
    pulsarDescargar();
    http.expectOne(RUTA_DEL_CONTEXTO).error(new ProgressEvent('error'), { status: 0 });

    expect(avisos[0]?.tipo).toBe('error');
    expect(avisos[0]?.texto).toContain('Reintentá');
  });
});
