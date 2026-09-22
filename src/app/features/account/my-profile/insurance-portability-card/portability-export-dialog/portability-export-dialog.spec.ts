import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FileDownloader } from '../../../../../core/data-access/files/file-downloader';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { PortabilityExportDialog } from './portability-export-dialog';

/** SHA-256 del texto vacío: 64 hex de verdad, no una cadena con forma de hash. */
const HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const PATIENT_PROFILE_ID = 'patient-1';

function exportResultWire(overrides: Record<string, unknown> = {}) {
  return {
    certificateId: 'cert-1',
    manifestHash: HASH,
    generatedAt: '2026-09-18T18:00:00.000Z',
    format: 'PDF',
    recordCount: 14,
    policiesCount: 3,
    pdfDownloadUrl: '/insurance/portability/certificates/cert-1/pdf',
    jsonDownloadUrl: '/insurance/portability/certificates/cert-1/json',
    verificationUrl: `https://app.alovida.com/verify/portability/${HASH}`,
    summary: {
      currencyCode: 'BOB',
      allTime: {
        claimsCount: 14,
        approvedCount: 10,
        deniedCount: 1,
        pendingCount: 3,
        billedAmount: '12450.00',
        coveredAmount: '10230.00',
        patientCopayAmount: '1200.00',
        deniedAmount: '0.00',
        coveredMonths: '11.87',
      },
      last36Months: {
        claimsCount: 14,
        approvedCount: 10,
        deniedCount: 1,
        pendingCount: 3,
        billedAmount: '12450.00',
        coveredAmount: '10230.00',
        patientCopayAmount: '1200.00',
        deniedAmount: '0.00',
        coveredMonths: '11.87',
      },
      byYear: [],
      claimsOver2000Count: 0,
      estimatedLossRatioPercent: null,
    },
    ...overrides,
  };
}

describe('PortabilityExportDialog', () => {
  let fixture: ComponentFixture<PortabilityExportDialog>;
  let http: HttpTestingController;
  let downloader: { trigger: (dataUrl: string, fileName: string) => void };
  let toasts: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function query(testId: string): HTMLElement | null {
    return document.querySelector(`[data-testid="${testId}"]`);
  }

  /** Selecciona un radio clickeando su `<input>` real (el host visualmente lo oculta). */
  function seleccionarFormato(testId: string): void {
    const input = query(testId)?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!input) throw new Error(`falta el radio ${testId}`);
    input.click();
    fixture.detectChanges();
  }

  function montar(): void {
    fixture = TestBed.createComponent(PortabilityExportDialog);
    fixture.componentRef.setInput('patientProfileId', PATIENT_PROFILE_ID);
    fixture.detectChanges();
  }

  /**
   * Se resuelve cuando `FileDownloader.trigger` se llama de verdad. Hace
   * falta porque el contenido pasa por `FileReader` (`blobToDataUrl`), que no
   * es una tarea de la zona de Angular: `detectChanges()` vuelve antes de que
   * termine. Mismo patrón que `medical-record.spec.ts` (B.3).
   */
  function esperarDescarga(
    vecesEsperadas: number,
  ): Promise<{ dataUrl: string; fileName: string }[]> {
    const llamadas: { dataUrl: string; fileName: string }[] = [];
    return new Promise((resolve) => {
      downloader.trigger = (dataUrl: string, fileName: string) => {
        llamadas.push({ dataUrl, fileName });
        if (llamadas.length === vecesEsperadas) resolve(llamadas);
      };
    });
  }

  beforeEach(async () => {
    downloader = { trigger: vi.fn() };
    toasts = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PortabilityExportDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FileDownloader, useValue: downloader },
        { provide: ToastService, useValue: toasts },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    fixture?.destroy();
    http.verify();
  });

  it('renderiza los tres formatos con PDF preseleccionado', () => {
    montar();

    expect(query('radio-format-pdf')).not.toBeNull();
    expect(query('radio-format-json')).not.toBeNull();
    expect(query('radio-format-both')).not.toBeNull();
  });

  it('descarga el PDF elegido y muestra el hash al terminar', async () => {
    montar();
    const descargado = esperarDescarga(1);

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    http
      .expectOne((r) => r.url === '/insurance/portability/export')
      .flush(exportResultWire({ format: 'PDF' }));
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/pdf')
      .flush(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }));

    expect(query('portability-manifest-hash')?.textContent).toBe(HASH);

    const [llamada] = await descargado;
    expect(llamada.fileName).toBe('portabilidad-cert-1.pdf');
  });

  it('el aviso de «copiado» es una región viva: un lector de pantalla lo anuncia', async () => {
    montar();
    const descargado = esperarDescarga(1);

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    http
      .expectOne((r) => r.url === '/insurance/portability/export')
      .flush(exportResultWire({ format: 'PDF' }));
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/pdf')
      .flush(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }));
    await descargado;

    // La región existe DESDE EL PRINCIPIO y vacía: `aria-live` sólo anuncia
    // los cambios de un nodo que ya estaba en el árbol. Si apareciera recién
    // al copiar, buena parte de los lectores no diría nada (WCAG 2.2 AA,
    // SC 4.1.3 Mensajes de estado).
    const aviso = query('portability-hash-copiado');
    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('role')).toBe('status');
    expect(aviso?.getAttribute('aria-live')).toBe('polite');
    expect(aviso?.textContent?.trim()).toBe('');

    const escrito: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (texto: string) => {
          escrito.push(texto);
          return Promise.resolve();
        },
      },
    });

    query('btn-copy-portability-hash')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    fixture.detectChanges();

    expect(escrito).toEqual([HASH]);
    expect(query('portability-hash-copiado')?.textContent?.trim()).toBe(
      'Sello copiado al portapapeles',
    );
  });

  it('BUNDLE descarga el PDF y el JSON', async () => {
    montar();
    const descargado = esperarDescarga(2);

    seleccionarFormato('radio-format-both');

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    http
      .expectOne((r) => r.url === '/insurance/portability/export')
      .flush(exportResultWire({ format: 'BUNDLE' }));
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/pdf')
      .flush(new Blob([new Uint8Array([1])]));
    http
      .expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/json')
      .flush(new Blob([new Uint8Array([2])]));

    const llamadas = await descargado;
    expect(llamadas).toHaveLength(2);
    expect(llamadas.map((l) => l.fileName).sort()).toEqual([
      'portabilidad-cert-1.json',
      'portabilidad-cert-1.pdf',
    ]);
  });

  it('un error al exportar deja el estado en error, sin trabar el botón', () => {
    montar();

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    http
      .expectOne((r) => r.url === '/insurance/portability/export')
      .flush(
        { code: 'FORBIDDEN', message: 'No podés exportar el historial de otra persona.', timestamp: '', path: '' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(query('portability-export-error')?.textContent).toContain(
      'No podés exportar el historial de otra persona.',
    );
    const boton = query('btn-generate-portability-download');
    expect(boton?.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('mientras carga, no se puede cerrar', () => {
    montar();

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();

    const cerrar = query('btn-cancel-portability-dialog');
    expect(cerrar?.getAttribute('aria-disabled')).toBe('true');

    http.expectOne((r) => r.url === '/insurance/portability/export').flush(exportResultWire());
    http.expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/pdf').flush(new Blob([]));
  });
});
