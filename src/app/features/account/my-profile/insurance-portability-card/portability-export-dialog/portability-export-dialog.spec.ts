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

  /**
   * Elige un formato en el desplegable.
   *
   * Era un grupo de radios hasta el 21/09/2026 y pasó a `app-select` con la
   * corrección C-21 (ADR-0013, caso 1). El helper cambia; lo que las pruebas
   * afirman —los tres formatos, el que viene elegido, y que BUNDLE baja los
   * dos archivos— no.
   */
  function seleccionarFormato(texto: string): void {
    const select = query('portability-format')?.querySelector<HTMLSelectElement>('select');
    if (!select) throw new Error('falta el desplegable de formato');
    /* Se elige por el texto que se ve y no por el valor del `<option>`, porque
       `app-select` pone el ÍNDICE en el `value` y el dato real lo resuelve por
       posición. Escribir ahí «BUNDLE» no casa con ninguna opción: el navegador
       deja el `select` como estaba y la prueba pasaría sin haber elegido nada. */
    const opcion = [...select.options].find((o) => (o.textContent ?? '').trim() === texto);
    if (!opcion) throw new Error(`el desplegable no ofrece «${texto}»`);
    select.value = opcion.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
  }

  /** Los formatos que el desplegable ofrece, en orden, sin el marcador de placeholder. */
  function formatosOfrecidos(): readonly string[] {
    const select = query('portability-format')?.querySelector<HTMLSelectElement>('select');
    return [...(select?.options ?? [])]
      .filter((o) => !o.hidden)
      .map((o) => (o.textContent ?? '').trim());
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

  it('renderiza los tres formatos con el paquete completo preseleccionado', () => {
    montar();

    /* CA-01 (portabilidad a 1 clic) exige que confirmar SIN tocar el
       desplegable baje los dos archivos: por eso el default es BUNDLE, no
       PDF. Se afirman las tres cosas que el título promete —los tres
       formatos, en orden, con su texto, y cuál viene elegido—. */
    expect(formatosOfrecidos()).toEqual([
      'PDF con código QR de verificación',
      'Archivo JSON interoperable',
      'Paquete completo (PDF + JSON)',
    ]);

    const select = query('portability-format')?.querySelector<HTMLSelectElement>('select');
    expect(select?.selectedOptions[0]?.textContent?.trim()).toBe(
      'Paquete completo (PDF + JSON)',
    );
  });

  it('presenta la exportación y su verificación sin prometer una certificación legal', () => {
    montar();

    const dialog = query('portability-export-dialog');
    expect(dialog?.getAttribute('heading')).toBe('Solicitar exportación de portabilidad');
    expect(dialog?.getAttribute('description')).toContain('información disponible');
    expect(dialog?.getAttribute('description')).not.toMatch(/firma digital|certificaci[oó]n/i);
    expect(query('btn-generate-portability-download')?.textContent).toContain(
      'Solicitar exportación',
    );
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
    expect(query('portability-export-dialog')?.textContent).toContain('Exportación generada');
    expect(query('portability-export-dialog')?.textContent).not.toContain('Certificado emitido');
    expect(document.querySelector('#portability-hash-label')?.textContent).toBe(
      'Huella SHA-256 del manifiesto',
    );
    expect(query('portability-verification-link')?.textContent).toContain(
      'Consultar los datos de verificación en línea',
    );
  });

  it('confirmar sin tocar el desplegable baja los dos archivos (CA-01: BUNDLE por defecto)', async () => {
    montar();
    const descargado = esperarDescarga(2);

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    const pedido = http.expectOne((r) => r.url === '/insurance/portability/export');
    expect((pedido.request.body as { format: string }).format).toBe('BUNDLE');
    pedido.flush(exportResultWire({ format: 'BUNDLE' }));
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/pdf')
      .flush(new Blob([new Uint8Array([1])]));
    http
      .expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/json')
      .flush(new Blob([new Uint8Array([2])]));

    const llamadas = await descargado;
    expect(llamadas.map((l) => l.fileName).sort()).toEqual([
      'portabilidad-cert-1.json',
      'portabilidad-cert-1.pdf',
    ]);
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
    const aviso = query('portability-hash-copied');
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
    expect(query('portability-hash-copied')?.textContent?.trim()).toBe(
      'Sello copiado al portapapeles',
    );
  });

  it('BUNDLE descarga el PDF y el JSON', async () => {
    montar();
    const descargado = esperarDescarga(2);

    seleccionarFormato('Paquete completo (PDF + JSON)');

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    const pedido = http.expectOne((r) => r.url === '/insurance/portability/export');
    /* Que se bajen dos archivos lo decide la RESPUESTA, así que sin esta línea
       la prueba pasaba igual aunque la selección no hubiera llegado a ninguna
       parte — y de hecho no llegaba, porque el ayudante buscaba «BUNDLE» en un
       `value` que lleva el índice. Acá se comprueba lo que el formulario mandó. */
    expect((pedido.request.body as { format: string }).format).toBe('BUNDLE');
    pedido.flush(exportResultWire({ format: 'BUNDLE' }));
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

  it('Escape o el fondo no cierran el diálogo mientras carga', () => {
    montar();
    const cerrado = vi.fn();
    fixture.componentInstance.closed.subscribe(cerrado);

    query('btn-generate-portability-download')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();

    // El `<dialog>` nativo dispara `cancel` ante Escape: `ContentDialog`
    // sigue emitiendo `dismissAttempt` aunque `dismissible` sea `false`
    // (es el punto de la señal: «quien lo escucha decide»). Antes de este
    // fix, `(dismissAttempt)="close()"` cerraba igual en pleno request.
    const dialogo = document.querySelector('dialog[data-testid="content-dialog"]');
    dialogo?.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();

    expect(cerrado).not.toHaveBeenCalled();
    expect(query('portability-export-dialog')).not.toBeNull();

    http.expectOne((r) => r.url === '/insurance/portability/export').flush(exportResultWire());
    http.expectOne((r) => r.url === '/insurance/portability/certificates/cert-1/pdf').flush(new Blob([]));
  });
});
