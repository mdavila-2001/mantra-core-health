import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { PortabilityVerify } from './portability-verify';

const HASH_VALIDO = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function query(testId: string): HTMLElement | null {
  return document.querySelector(`[data-testid="${testId}"]`);
}

async function montar(manifestHash: string): Promise<ComponentFixture<PortabilityVerify>> {
  await TestBed.configureTestingModule({
    imports: [PortabilityVerify],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ manifestHash }) } },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(PortabilityVerify);
  fixture.detectChanges();
  return fixture;
}

describe('PortabilityVerify', () => {
  let http: HttpTestingController;

  afterEach(() => {
    http?.verify();
  });

  it('un sello con forma inválida no llama a la API y avisa', async () => {
    await montar('no-es-un-sha256');
    http = TestBed.inject(HttpTestingController);

    expect(query('portability-verify-invalid')).not.toBeNull();
    http.expectNone(() => true);
  });

  it('certificado válido muestra los datos sin PHI', async () => {
    const fixture = await montar(HASH_VALIDO);
    http = TestBed.inject(HttpTestingController);

    http
      .expectOne((r) => r.url === `/public/portability/verify/${HASH_VALIDO}`)
      .flush({
        status: 'VALID',
        certificateId: 'cert-1',
        manifestHash: HASH_VALIDO,
        generatedAt: '2026-09-18T18:00:00.000Z',
        recordCount: 14,
        algorithm: 'SHA-256',
        issuer: 'AloVida',
      });
    fixture.detectChanges();

    expect(query('portability-verify-valid')).not.toBeNull();
    expect(query('portability-verify-hash')?.textContent).toBe(HASH_VALIDO);
  });

  it('sello inexistente responde 404 y muestra "no encontrado"', async () => {
    const fixture = await montar(HASH_VALIDO);
    http = TestBed.inject(HttpTestingController);

    http
      .expectOne((r) => r.url === `/public/portability/verify/${HASH_VALIDO}`)
      .flush(
        { code: 'NOT_FOUND', message: 'no existe', timestamp: '', path: '' },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();

    expect(query('portability-verify-not-found')).not.toBeNull();
  });

  it('un error inesperado del servidor muestra el estado de error', async () => {
    const fixture = await montar(HASH_VALIDO);
    http = TestBed.inject(HttpTestingController);

    http
      .expectOne((r) => r.url === `/public/portability/verify/${HASH_VALIDO}`)
      .flush(
        { code: 'INTERNAL', message: 'error', timestamp: '', path: '' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    fixture.detectChanges();

    expect(query('portability-verify-error')).not.toBeNull();
  });

  it('mientras responde la API, muestra el esqueleto de carga', async () => {
    const fixture = await montar(HASH_VALIDO);
    http = TestBed.inject(HttpTestingController);

    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();

    http.expectOne((r) => r.url === `/public/portability/verify/${HASH_VALIDO}`).flush({
      status: 'VALID',
      certificateId: 'cert-1',
      manifestHash: HASH_VALIDO,
      generatedAt: '2026-09-18T18:00:00.000Z',
      recordCount: 1,
      algorithm: 'SHA-256',
      issuer: 'AloVida',
    });
  });
});
