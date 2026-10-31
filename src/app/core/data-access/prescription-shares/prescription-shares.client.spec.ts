import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PrescriptionSharesClient } from './prescription-shares.client';
import type {
  CreatedPrescriptionShare,
  PrescriptionShareSummary,
  PrescriptionVerification,
  PublicPrescriptionShare,
} from './prescription-shares.types';

/** Un token con la forma del real (base64url de 32 bytes), sintético. */
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE';

/**
 * El contrato con la API (`CONTRATO.md` §1): verbo, ruta y cuerpo de cada
 * método, el token siempre codificado, las fechas convertidas y —en la vista
 * pública— nada más que las claves del contrato aunque la respuesta trajera
 * otras.
 */
describe('PrescriptionSharesClient', () => {
  let client: PrescriptionSharesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PrescriptionSharesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('create manda solo el id elegido y convierte el vencimiento', () => {
    let created: CreatedPrescriptionShare | undefined;
    client.create({ encounterId: 'enc-1' }).subscribe((value) => (created = value));

    const req = http.expectOne('/clinical/prescription-shares');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ encounterId: 'enc-1' });
    req.flush({
      shareId: 'sh-1',
      url: `https://app.example.test/rx/${TOKEN}`,
      token: TOKEN,
      expiresAt: '2026-11-29T12:00:00.000Z',
      itemCount: 2,
    });

    expect(created?.expiresAt).toBeInstanceOf(Date);
    expect(created?.itemCount).toBe(2);
    expect(created?.url).toBe(`https://app.example.test/rx/${TOKEN}`);
  });

  it('create de un fármaco suelto manda medicationRequestId', () => {
    client.create({ medicationRequestId: 'mr-9' }).subscribe();

    const req = http.expectOne('/clinical/prescription-shares');
    expect(req.request.body).toEqual({ medicationRequestId: 'mr-9' });
    req.flush({ shareId: 's', url: 'u', token: 't', expiresAt: '2026-11-01T00:00:00Z', itemCount: 1 });
  });

  it('listForPatient pide por query y mapea fechas, estado y usos', () => {
    let rows: readonly PrescriptionShareSummary[] = [];
    client.listForPatient('pp-1').subscribe((value) => (rows = value));

    const req = http.expectOne((r) => r.url === '/clinical/prescription-shares');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('patientProfileId')).toBe('pp-1');
    req.flush([
      {
        shareId: 'sh-1',
        resourceType: 'PRESCRIPTION_ENCOUNTER',
        resourceId: 'enc-1',
        createdAt: '2026-10-01T10:00:00.000Z',
        expiresAt: '2026-10-31T10:00:00.000Z',
        status: 'VALID',
        uses: 3,
      },
      {
        shareId: 'sh-2',
        resourceType: 'MEDICATION_REQUEST',
        resourceId: 'mr-1',
        createdAt: '2026-09-01T10:00:00.000Z',
        expiresAt: '2026-09-30T10:00:00.000Z',
        status: 'REVOKED',
        uses: 0,
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect(rows[0].status).toBe('VALID');
    expect(rows[0].uses).toBe(3);
    expect(rows[1].status).toBe('REVOKED');
  });

  it('un estado desconocido no se lee como válido', () => {
    let rows: readonly PrescriptionShareSummary[] = [];
    client.listForPatient('pp-1').subscribe((value) => (rows = value));

    http.expectOne((r) => r.url === '/clinical/prescription-shares').flush([
      {
        shareId: 'sh-3',
        resourceType: 'MEDICATION_REQUEST',
        resourceId: 'mr-3',
        createdAt: '2026-10-01T10:00:00.000Z',
        expiresAt: '2026-10-31T10:00:00.000Z',
        status: 'SOMETHING_ELSE',
        uses: 0,
      },
    ]);

    expect(rows[0].status).toBe('EXPIRED');
  });

  it('revoke va por POST al segmento revoke y completa con el 204', () => {
    let done = false;
    client.revoke('sh-1').subscribe({ complete: () => (done = true) });

    const req = http.expectOne('/clinical/prescription-shares/sh-1/revoke');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(done).toBe(true);
  });

  it('resolveOwnership codifica el token en la ruta', () => {
    client.resolveOwnership('a/b+c').subscribe();

    const req = http.expectOne('/clinical/prescription-shares/by-token/a%2Fb%2Bc');
    expect(req.request.method).toBe('GET');
    req.flush({ shareId: 'sh-1', resourceType: 'PRESCRIPTION_ENCOUNTER', resourceId: 'enc-1' });
  });

  it('readPublic copia solo las claves del contrato, aunque lleguen otras', () => {
    let view: PublicPrescriptionShare | undefined;
    client.readPublic(TOKEN).subscribe((value) => (view = value));

    const req = http.expectOne(`/public/prescription-shares/${TOKEN}`);
    expect(req.request.method).toBe('GET');
    req.flush({
      status: 'VALID',
      issuedAt: '2026-10-01T10:00:00.000Z',
      prescriberName: 'Dra. Prueba Sintética',
      prescriberLicense: { number: 'MP-0001', authority: 'Colegio de prueba', state: 'ACTIVE' },
      itemCount: 2,
      // Una clave de más que la API no debería mandar: no pasa.
      patientName: 'NO DEBE LLEGAR',
    });

    expect(view).toEqual({
      status: 'VALID',
      endedReason: null,
      issuedAt: new Date('2026-10-01T10:00:00.000Z'),
      prescriberName: 'Dra. Prueba Sintética',
      prescriberLicense: { number: 'MP-0001', authority: 'Colegio de prueba', state: 'ACTIVE' },
      itemCount: 2,
    });
  });

  it('readPublic de un enlace revocado: la forma de la API, todo nulo', () => {
    let view: PublicPrescriptionShare | undefined;
    client.readPublic(TOKEN).subscribe((value) => (view = value));

    http.expectOne(`/public/prescription-shares/${TOKEN}`).flush({
      status: 'REVOKED',
      issuedAt: null,
      prescriberName: null,
      prescriberLicense: null,
      itemCount: 0,
    });

    expect(view).toEqual({
      status: 'REVOKED',
      endedReason: null,
      issuedAt: null,
      prescriberName: null,
      prescriberLicense: null,
      itemCount: 0,
    });
  });

  it('verifyPrescription pega contra el verify público que ya existe', () => {
    let result: PrescriptionVerification | undefined;
    client.verifyPrescription('mr-1').subscribe((value) => (result = value));

    const req = http.expectOne('/public/prescriptions/mr-1/verify');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'mr-1',
      status: 'ISSUED',
      issuedAt: '2026-10-01T10:00:00.000Z',
      contentHash: 'a'.repeat(64),
      prescriberLicense: { number: 'MP-0001', authority: null, state: 'PENDING' },
    });

    expect(result?.issuedAt).toBeInstanceOf(Date);
    expect(result?.prescriberLicense?.state).toBe('PENDING');
  });
});
