import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InsuranceClient } from './insurance.client';
import type { BrokerProfile, CarrierDetail, CarrierSummary } from './insurance.types';

const CONCEPTO = { code: 'CARRIER_ACTIVE', display: 'Aseguradora activa' };
const VERIFICADO = { code: 'VERIFICATION_VERIFIED', display: 'Verificado' };

function carrierWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    carrierCode: 'ASEG-001',
    legalName: 'Aseguradora del Sur S.A.',
    regulatorIdentifier: 'REG-99',
    jurisdiction: null,
    status: CONCEPTO,
    verification: VERIFICADO,
    productCount: 2,
    planCount: 3,
    networkCount: 1,
    createdAt: '2026-08-09T12:00:00.000Z',
    ...overrides,
  };
}

describe('InsuranceClient', () => {
  let client: InsuranceClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(InsuranceClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listCarriers pega en /insurance-carriers y convierte el alta a Date', () => {
    let filas: readonly CarrierSummary[] = [];
    client.listCarriers().subscribe((directorio) => (filas = directorio.items));

    http
      .expectOne((r) => r.url === '/insurance-carriers')
      .flush({ items: [carrierWire()], count: 1 });

    expect(filas[0]?.createdAt).toEqual(new Date('2026-08-09T12:00:00.000Z'));
    expect(filas[0]?.planCount).toBe(3);
  });

  /**
   * El defecto que `maybeDateOnly` existe para evitar: una vigencia
   * `YYYY-MM-DD` pasada por `new Date()` se ancla a medianoche UTC y retrocede
   * un día al pintarse en cualquier huso al oeste de Greenwich.
   */
  it('getCarrier lee las vigencias como fecha local, no como instante UTC', () => {
    let ficha: CarrierDetail | undefined;
    client.getCarrier('c-1').subscribe((detalle) => (ficha = detalle));

    http.expectOne((r) => r.url === '/insurance-carriers/c-1').flush({
      ...carrierWire(),
      products: [
        {
          id: 'p-1',
          productCode: 'PROD-1',
          name: 'Salud Integral',
          productType: { code: 'PRODUCT_TYPE_HEALTH', display: 'Producto de salud' },
          marketSegment: null,
          status: CONCEPTO,
          plans: [
            {
              id: 'pl-1',
              planCode: 'PLAN-1',
              name: 'Plan Oro',
              planType: null,
              currency: null,
              effectiveFrom: '2026-03-14',
              effectiveTo: null,
              status: CONCEPTO,
              policyDocumentFileId: null,
              benefits: [
                {
                  id: 'b-1',
                  category: { code: 'BENEFIT_CATEGORY_GENERAL', display: 'Beneficio general' },
                  service: null,
                  coveragePercent: '80.00',
                  copayAmount: null,
                  deductibleAmount: null,
                  annualLimitAmount: null,
                  requiresPriorAuthorization: true,
                  effectiveFrom: '2026-01-01',
                  effectiveTo: null,
                },
              ],
            },
          ],
        },
      ],
      networks: [],
    });

    const plan = ficha?.products[0]?.plans[0];
    expect(plan?.effectiveFrom?.getFullYear()).toBe(2026);
    expect(plan?.effectiveFrom?.getMonth()).toBe(2);
    expect(plan?.effectiveFrom?.getDate()).toBe(14);
    expect(plan?.effectiveTo).toBeNull();
  });

  /**
   * El porcentaje y los importes son `numeric` en la base. Se conservan como
   * texto: convertirlos perdería los decimales que definen la cobertura.
   */
  it('getCarrier no convierte los importes del beneficio a número', () => {
    let ficha: CarrierDetail | undefined;
    client.getCarrier('c-1').subscribe((detalle) => (ficha = detalle));

    http.expectOne((r) => r.url === '/insurance-carriers/c-1').flush({
      ...carrierWire(),
      products: [
        {
          id: 'p-1',
          productCode: 'PROD-1',
          name: 'Salud Integral',
          productType: { code: 'PRODUCT_TYPE_HEALTH', display: 'Producto de salud' },
          marketSegment: null,
          status: CONCEPTO,
          plans: [
            {
              id: 'pl-1',
              planCode: 'PLAN-1',
              name: 'Plan Oro',
              planType: null,
              currency: null,
              effectiveFrom: null,
              effectiveTo: null,
              status: CONCEPTO,
              policyDocumentFileId: null,
              benefits: [
                {
                  id: 'b-1',
                  category: { code: 'BENEFIT_CATEGORY_GENERAL', display: 'Beneficio general' },
                  service: null,
                  coveragePercent: '80.50',
                  copayAmount: '25.00',
                  deductibleAmount: null,
                  annualLimitAmount: null,
                  requiresPriorAuthorization: null,
                  effectiveFrom: null,
                  effectiveTo: null,
                },
              ],
            },
          ],
        },
      ],
      networks: [],
    });

    expect(ficha?.products[0]?.plans[0]?.benefits[0]?.coveragePercent).toBe('80.50');
    expect(ficha?.products[0]?.plans[0]?.benefits[0]?.copayAmount).toBe('25.00');
  });

  it('getBroker conserva el histórico con la marca de vigencia del servidor', () => {
    let perfil: BrokerProfile | undefined;
    client.getBroker('b-1').subscribe((p) => (perfil = p));

    http.expectOne((r) => r.url === '/insurance-brokers/b-1').flush({
      id: 'b-1',
      brokerCode: 'BRK-1',
      legalName: 'Corredores Andinos',
      licenseNumber: 'MAT-77',
      jurisdiction: null,
      status: { code: 'BROKER_ACTIVE', display: 'Broker activo' },
      verification: VERIFICADO,
      independent: false,
      currentCarrierCount: 1,
      createdAt: '2026-08-09T12:00:00.000Z',
      publicProfileId: null,
      agreements: [
        {
          id: 'a-1',
          insuranceCarrierId: 'c-1',
          carrierLegalName: 'Aseguradora Uno',
          agreementCode: 'AC-1',
          commissionModel: null,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          status: { code: 'AGREEMENT_ACTIVE', display: 'Acuerdo activo' },
          current: true,
          contractFileId: null,
        },
        {
          id: 'a-2',
          insuranceCarrierId: 'c-2',
          carrierLegalName: 'Aseguradora Dos',
          agreementCode: 'AC-2',
          commissionModel: null,
          effectiveFrom: '2020-01-01',
          effectiveTo: '2021-01-01',
          status: { code: 'AGREEMENT_ACTIVE', display: 'Acuerdo activo' },
          current: false,
          contractFileId: null,
        },
      ],
    });

    expect(perfil?.agreements).toHaveLength(2);
    expect(perfil?.agreements[0]?.current).toBe(true);
    expect(perfil?.agreements[1]?.current).toBe(false);
    expect(perfil?.agreements[1]?.effectiveTo?.getFullYear()).toBe(2021);
  });

  it('la cartera es una llamada aparte del perfil', () => {
    client.listBrokerClients('b-1').subscribe();

    http
      .expectOne((r) => r.url === '/insurance-brokers/b-1/clients')
      .flush({ items: [], count: 0 });
  });

  it('escapa el identificador en la ruta', () => {
    client.getCarrier('c/1').subscribe();

    http.expectOne((r) => r.url === '/insurance-carriers/c%2F1').flush({
      ...carrierWire(),
      products: [],
      networks: [],
    });
  });
});
