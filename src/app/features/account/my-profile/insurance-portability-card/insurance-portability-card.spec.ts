import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import { FileDownloader } from '../../../../core/data-access/files/file-downloader';
import type {
  CoverageValidity,
  OwnCoverage,
} from '../../../../core/data-access/profiles/profiles.types';
import { PatientContextService } from '../../../../core/patient-context/patient-context.service';
import { InsurancePortabilityCard } from './insurance-portability-card';

const HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

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

/** Una cobertura con lo mínimo que la tarjeta mira: su vigencia. */
function cobertura(validityStatus: CoverageValidity): OwnCoverage {
  return {
    id: `cov-${validityStatus}-${Math.random()}`,
    carrierName: 'Alianza Vida',
    isPublic: false,
    verified: true,
    validityStatus,
    benefits: [],
  };
}

function query(testId: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testId}"]`);
}

let http: HttpTestingController;
let downloader: { trigger: ReturnType<typeof vi.fn> };

function montar(
  opciones: {
    patientProfileId?: string | null;
    isActingForDependent?: boolean;
    coverages?: readonly OwnCoverage[];
  } = {},
): ComponentFixture<InsurancePortabilityCard> {
  // `?? 'patient-1'` no serviría: un `patientProfileId: null` explícito es
  // justo el caso que se quiere probar, y `??` lo confundiría con "omitido".
  const patientProfileId: string | null =
    opciones.patientProfileId === undefined ? 'patient-1' : opciones.patientProfileId;
  downloader = { trigger: vi.fn() };
  TestBed.configureTestingModule({
    imports: [InsurancePortabilityCard],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthService,
        useValue: { patientProfileId: () => patientProfileId },
      },
      {
        provide: PatientContextService,
        useValue: { isActingForDependent: () => opciones.isActingForDependent ?? false },
      },
      { provide: FileDownloader, useValue: downloader },
    ],
  });
  http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(InsurancePortabilityCard);
  fixture.componentRef.setInput('coverages', opciones.coverages ?? []);
  fixture.detectChanges();
  return fixture;
}

describe('InsurancePortabilityCard', () => {
  afterEach(() => http?.verify());

  it('muestra el botón para exportar el historial', () => {
    montar();

    expect(query('insurance-portability-card')).not.toBeNull();
    expect(query('btn-download-portability-pdf')).not.toBeNull();
  });

  it('ofrece un único botón llamado «Descargar», sin diálogo ni selector de formato', () => {
    montar();

    const tarjeta = query('insurance-portability-card');
    expect(tarjeta?.querySelectorAll('button')).toHaveLength(1);
    expect(query('btn-download-portability-pdf')?.textContent?.trim()).toBe('Descargar');
    expect(document.querySelector('app-portability-export-dialog')).toBeNull();
    expect(tarjeta?.querySelector('select')).toBeNull();
  });

  it('describe la información disponible sin afirmar que tenga firma digital', () => {
    montar();

    const texto = query('insurance-portability-card')?.textContent ?? '';
    expect(texto).toContain('información de pólizas y siniestros disponible');
    expect(texto).not.toContain('firma digital');
  });

  describe('estado de las coberturas', () => {
    it('sin coberturas declaradas lo dice, y ofrece exportar igual', () => {
      montar({ coverages: [] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        'No tenés coberturas declaradas.',
      );
      // El derecho de portabilidad no depende de tener una cobertura.
      expect(query('btn-download-portability-pdf')).not.toBeNull();
    });

    it('con todas vigentes las cuenta sin más', () => {
      montar({ coverages: [cobertura('CURRENT'), cobertura('CURRENT')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '2 coberturas vigentes.',
      );
    });

    it('una sola vigente va en singular', () => {
      montar({ coverages: [cobertura('CURRENT')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '1 cobertura vigente.',
      );
    });

    it('con algunas vencidas dice cuántas de cuántas siguen vigentes', () => {
      montar({
        coverages: [cobertura('CURRENT'), cobertura('EXPIRED'), cobertura('UPCOMING')],
      });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '1 de 3 coberturas vigentes.',
      );
    });

    it('sin ninguna vigente no dice «0 de N», que se lee como un error', () => {
      montar({ coverages: [cobertura('EXPIRED'), cobertura('INACTIVE')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '2 coberturas declaradas, ninguna vigente.',
      );
    });

    it('una vigencia desconocida no cuenta como vigente', () => {
      // `UNKNOWN` es «no sabemos», no «sí»: contarla como vigente sería
      // afirmarle al titular algo que la API no confirmó.
      montar({ coverages: [cobertura('UNKNOWN')] });

      expect(query('portability-coverage-summary')?.textContent?.trim()).toBe(
        '1 cobertura declarada, ninguna vigente.',
      );
    });
  });

  it('descarga directamente el PDF con QR del titular', async () => {
    const fixture = montar();
    let descarga: { dataUrl: string; fileName: string } | undefined;
    const descargado = new Promise<void>((resolve) => {
      downloader.trigger.mockImplementation((dataUrl: string, fileName: string) => {
        descarga = { dataUrl, fileName };
        resolve();
      });
    });

    query('btn-download-portability-pdf')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();

    const exportacion = http.expectOne('/insurance/portability/export');
    expect(exportacion.request.method).toBe('POST');
    expect(exportacion.request.body).toEqual({
      patientProfileId: 'patient-1',
      format: 'PDF',
    });
    exportacion.flush(exportResultWire());

    const pdf = http.expectOne('/insurance/portability/certificates/cert-1/pdf');
    expect(pdf.request.method).toBe('GET');
    pdf.flush(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }), {
      headers: { 'Content-Disposition': 'attachment; filename="portabilidad-cert-1.pdf"' },
    });

    await descargado;
    expect(descarga?.fileName).toBe('portabilidad-cert-1.pdf');
    expect(descarga?.dataUrl).toMatch(/^data:application\/pdf;base64,/);
    expect(document.querySelector('app-portability-export-dialog')).toBeNull();
  });

  it('avisa cuando la sesión está actuando por un dependiente', () => {
    montar({ isActingForDependent: true });

    expect(query('insurance-portability-card')?.textContent).toContain('trámite personal');
  });

  it('actuando por un dependiente, exporta el perfil del TITULAR, nunca el del dependiente', () => {
    const fixture = montar({ isActingForDependent: true, patientProfileId: 'own-profile' });

    query('btn-download-portability-pdf')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();

    const exportacion = http.expectOne('/insurance/portability/export');
    expect(exportacion.request.body).toEqual({
      patientProfileId: 'own-profile',
      format: 'PDF',
    });
    exportacion.flush(
      { code: 'FORBIDDEN', message: 'No disponible.', timestamp: '', path: '' },
      { status: 403, statusText: 'Forbidden' },
    );
  });

  it('muestra el error en la tarjeta y permite reintentar', () => {
    const fixture = montar();

    query('btn-download-portability-pdf')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    fixture.detectChanges();
    http.expectOne('/insurance/portability/export').flush(
      {
        code: 'FORBIDDEN',
        message: 'No podés exportar este historial.',
        timestamp: '',
        path: '',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(query('portability-export-error')?.textContent).toContain(
      'No podés exportar este historial.',
    );
    expect(query('btn-download-portability-pdf')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('sin perfil de paciente propio, no ofrece exportar', () => {
    montar({ patientProfileId: null });

    expect(query('btn-download-portability-pdf')).toBeNull();
  });
});
