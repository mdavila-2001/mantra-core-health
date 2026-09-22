import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InsurancePortabilityClient } from './insurance-portability.client';
import type { PortabilityExportResult, PortabilityVerification } from './insurance-portability.types';

/** SHA-256 del texto vacío: 64 hex de verdad, no una cadena con forma de hash. */
const HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function exportResultWire(overrides: Record<string, unknown> = {}) {
  return {
    certificateId: 'cert-1',
    manifestHash: HASH,
    generatedAt: '2026-09-18T18:00:00.000Z',
    format: 'BUNDLE',
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

describe('InsurancePortabilityClient', () => {
  let client: InsurancePortabilityClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(InsurancePortabilityClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('exportPortability pega en POST /insurance/portability/export y convierte generatedAt', async () => {
    let recibido: PortabilityExportResult | undefined;
    client
      .exportPortability({ patientProfileId: 'patient-1', format: 'BUNDLE' })
      .subscribe((r) => (recibido = r));

    const req = http.expectOne((r) => r.url === '/insurance/portability/export');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ patientProfileId: 'patient-1', format: 'BUNDLE' });
    req.flush(exportResultWire());

    expect(recibido?.generatedAt).toBeInstanceOf(Date);
    expect(recibido?.manifestHash).toBe(HASH);
    expect(recibido?.summary.allTime.coveredAmount).toBe('10230.00');
  });

  it('downloadCertificatePdf pide bytes y lee el nombre de Content-Disposition', async () => {
    const recibido = new Promise<{ blob: Blob; fileName?: string }>((resolve) => {
      client.downloadCertificatePdf('cert-1').subscribe(resolve);
    });

    const req = http.expectOne(
      (r) => r.url === '/insurance/portability/certificates/cert-1/pdf',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');

    req.flush(
      new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }),
      { headers: { 'Content-Disposition': "attachment; filename*=UTF-8''portabilidad-cert-1.pdf" } },
    );

    await expect(recibido).resolves.toMatchObject({ fileName: 'portabilidad-cert-1.pdf' });
  });

  it('downloadCertificateJson pide bytes y escapa el id del certificado', () => {
    client.downloadCertificateJson('cert/1').subscribe();

    const req = http.expectOne((r) => r.url === '/insurance/portability/certificates/cert%2F1/json');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob([]));
  });

  it('verifyCertificate pega en /public/portability/verify/:manifestHash sin cuerpo', async () => {
    let recibido: PortabilityVerification | undefined;
    client.verifyCertificate(HASH).subscribe((r) => (recibido = r));

    const req = http.expectOne((r) => r.url === `/public/portability/verify/${HASH}`);
    expect(req.request.method).toBe('GET');
    req.flush({
      status: 'VALID',
      certificateId: 'cert-1',
      manifestHash: HASH,
      generatedAt: '2026-09-18T18:00:00.000Z',
      recordCount: 14,
      algorithm: 'SHA-256',
      issuer: 'AloVida',
    });

    expect(recibido?.generatedAt).toBeInstanceOf(Date);
    expect(recibido?.status).toBe('VALID');
  });
});
