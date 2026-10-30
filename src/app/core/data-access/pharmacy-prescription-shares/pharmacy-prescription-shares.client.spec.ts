import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PharmacyPrescriptionSharesClient } from './pharmacy-prescription-shares.client';
import type {
  PharmacyPrescriptionShare,
  SiteProductAvailability,
} from './pharmacy-prescription-shares.types';

/** Un token con la forma del real (base64url de 32 bytes), sintético. */
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE';

const PHARMACY_ID = '00000000-0000-4000-8000-0000000000a1';
const SITE_ID = '00000000-0000-4000-8000-0000000000b1';
const PRODUCT_ID = '00000000-0000-4000-8000-0000000000c1';

/** La respuesta de §2 con los dos agregados de la API (`pharmacyId`, `outOfStockDeclared`). */
function wireShare(): Record<string, unknown> {
  return {
    shareId: 'sh-1',
    issuedAt: '2026-10-20T14:00:00.000Z',
    validTo: '2026-11-19T14:00:00.000Z',
    prescriber: {
      name: 'Dra. Prueba Sintética',
      license: { number: 'MP-0001', authority: 'Colegio de prueba', state: 'ACTIVE' },
    },
    patient: { maskedName: 'L. P. Q.', documentLast3: '123' },
    items: [
      {
        medicationRequestId: 'mr-1',
        medicationConceptId: 'mc-1',
        display: 'Jarabe de prueba 100 ml',
        dosageText: '5 ml cada 8 horas',
        prescribedQuantity: 2,
        unitCode: 'UNIT_{bottle}',
        dispensedQuantity: 1,
        remainingQuantity: 1,
        matches: [
          {
            pharmacyId: PHARMACY_ID,
            pharmacyProductId: PRODUCT_ID,
            name: 'Marca de prueba',
            price: '35.50',
            currencyCode: 'pharmacy:CURRENCY_BOB',
            requiresPrescription: true,
            outOfStockDeclared: false,
            sites: [
              {
                siteId: SITE_ID,
                siteName: 'Sede Centro',
                available: true,
                quantity: null,
                stockUpdatedAt: '2026-10-29T10:00:00.000Z',
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * El contrato con la API (`CONTRATO.md` §2 y §4): verbo, ruta y cuerpo, el
 * token y los ids codificados, las fechas convertidas y —del paciente— nada
 * más que las dos claves enmascaradas aunque la respuesta trajera otras.
 */
describe('PharmacyPrescriptionSharesClient', () => {
  let client: PharmacyPrescriptionSharesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacyPrescriptionSharesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('open pide la receta por token con GET y convierte las fechas', () => {
    let share: PharmacyPrescriptionShare | undefined;
    client.open(TOKEN).subscribe((value) => (share = value));

    const req = http.expectOne(`/pharmacy/prescription-shares/${TOKEN}`);
    expect(req.request.method).toBe('GET');
    req.flush(wireShare());

    expect(share?.issuedAt).toBeInstanceOf(Date);
    expect(share?.validTo).toBeInstanceOf(Date);
    expect(share?.prescriber.license).toEqual({
      number: 'MP-0001',
      authority: 'Colegio de prueba',
      state: 'ACTIVE',
    });
    const site = share?.items[0].matches[0].sites[0];
    expect(site?.stockUpdatedAt).toBeInstanceOf(Date);
    expect(site?.quantity).toBeNull();
    expect(share?.items[0].matches[0].pharmacyId).toBe(PHARMACY_ID);
    expect(share?.items[0].matches[0].outOfStockDeclared).toBe(false);
    expect(share?.items[0].unitCode).toBe('UNIT_{bottle}');
  });

  it('open codifica el token en la ruta', () => {
    client.open('a/b?c').subscribe();

    const req = http.expectOne('/pharmacy/prescription-shares/a%2Fb%3Fc');
    req.flush(wireShare());
  });

  it('del paciente copia solo maskedName y documentLast3', () => {
    let share: PharmacyPrescriptionShare | undefined;
    client.open(TOKEN).subscribe((value) => (share = value));

    const body = wireShare();
    body['patient'] = {
      maskedName: 'L. P. Q.',
      documentLast3: '123',
      fullName: 'Nombre que no debería pasar',
      documentNumber: '0000000',
    };
    http.expectOne(`/pharmacy/prescription-shares/${TOKEN}`).flush(body);

    expect(Object.keys(share?.patient ?? {}).sort()).toEqual(['documentLast3', 'maskedName']);
  });

  it('sin control de cantidad conserva los null y un producto sin la marca no queda marcado', () => {
    let share: PharmacyPrescriptionShare | undefined;
    client.open(TOKEN).subscribe((value) => (share = value));

    const body = wireShare();
    const [item] = body['items'] as Record<string, unknown>[];
    item['unitCode'] = 'UNIT_{tablet}';
    item['dispensedQuantity'] = null;
    item['remainingQuantity'] = null;
    const [match] = item['matches'] as Record<string, unknown>[];
    delete match['outOfStockDeclared'];
    http.expectOne(`/pharmacy/prescription-shares/${TOKEN}`).flush(body);

    expect(share?.items[0].remainingQuantity).toBeNull();
    expect(share?.items[0].dispensedQuantity).toBeNull();
    expect(share?.items[0].matches[0].outOfStockDeclared).toBe(false);
  });

  it('la matrícula siempre sale con estado: lo que no es ACTIVE se lee PENDING', () => {
    let share: PharmacyPrescriptionShare | undefined;
    client.open(TOKEN).subscribe((value) => (share = value));

    const body = wireShare();
    body['prescriber'] = { name: 'Dra. Prueba Sintética', license: { number: 'MP-0002' } };
    http.expectOne(`/pharmacy/prescription-shares/${TOKEN}`).flush(body);

    expect(share?.prescriber.license).toEqual({ number: 'MP-0002', authority: null, state: 'PENDING' });
  });

  it('setSiteAvailability manda PUT a la ruta de §4 con el cuerpo { available } exacto', () => {
    let result: SiteProductAvailability | undefined;
    client
      .setSiteAvailability({ pharmacyId: PHARMACY_ID, siteId: SITE_ID, productId: PRODUCT_ID }, false)
      .subscribe((value) => (result = value));

    const req = http.expectOne(
      `/pharmacies/${PHARMACY_ID}/sites/${SITE_ID}/products/${PRODUCT_ID}/availability`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ available: false });
    req.flush({
      siteId: SITE_ID,
      productId: PRODUCT_ID,
      available: false,
      quantity: 0,
      stockUpdatedAt: '2026-10-30T09:00:00.000Z',
    });

    expect(result?.available).toBe(false);
    expect(result?.quantity).toBe(0);
    expect(result?.stockUpdatedAt).toBeInstanceOf(Date);
  });
});
