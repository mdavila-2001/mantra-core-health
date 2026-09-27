import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InsuranceClient } from './insurance.client';
import type { BrokerProfile, CampaignPage, CarrierDetail, CarrierSummary } from './insurance.types';

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
    canAdminister: true,
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

    http
      .expectOne((r) => r.url === '/insurance-carriers/c-1')
      .flush({
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
                    approvalRules: { requiredDocuments: [], exclusionNotes: null },
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

    http
      .expectOne((r) => r.url === '/insurance-carriers/c-1')
      .flush({
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
                    approvalRules: { requiredDocuments: [], exclusionNotes: null },
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

    http
      .expectOne((r) => r.url === '/insurance-brokers/b-1')
      .flush({
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

    http
      .expectOne((r) => r.url === '/insurance-carriers/c%2F1')
      .flush({
        ...carrierWire(),
        products: [],
        networks: [],
      });
  });

  it('crea un plan conservando fechas, moneda y la ruta escapada', () => {
    const body = {
      planCode: 'ORO-2',
      name: 'Plan Oro 2',
      effectiveFrom: '2026-10-01',
      currencyConceptId: 'currency/id',
    };
    let id: string | undefined;
    client.createPlan('product/id', body).subscribe((response) => (id = response.id));

    const request = http.expectOne('/insurance-products/product%2Fid/plans');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({ id: 'plan-created' });
    expect(id).toBe('plan-created');
  });

  it('crea una cobertura sin convertir sus decimales', () => {
    const body = {
      benefitCategoryConceptId: 'category/id',
      coveragePercent: '80.50',
      copayAmount: '25.00',
    };
    client.createBenefit('plan/id', body).subscribe();

    const request = http.expectOne('/insurance-plans/plan%2Fid/benefits');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({ id: 'benefit-created' });
  });

  it('reemplaza importes y permite borrar valores con null', () => {
    const body = {
      coveragePercent: '72.25',
      copayAmount: null,
      deductibleAmount: '100.00',
      annualLimitAmount: null,
    };
    client.updateBenefit('plan/id', 'benefit/id', body).subscribe();

    const request = http.expectOne('/insurance-plans/plan%2Fid/benefits/benefit%2Fid');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ ok: true });
  });

  it('reemplaza las reglas documentales por la ruta específica', () => {
    const body = {
      requiresPriorAuthorization: true,
      requiredDocuments: ['ORDEN_MEDICA'] as const,
      exclusionNotes: 'No cubre tratamientos experimentales.',
    };
    client.updateBenefitRules('plan/id', 'benefit/id', body).subscribe();

    const request = http.expectOne('/insurance-plans/plan%2Fid/benefits/benefit%2Fid/rules');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ ok: true });
  });

  /** Tarea 3 · H8: el desglose de liquidación (`settlement`/`eob`) del detalle. */
  it('getClaim conserva el desglose de liquidación sin convertir sus importes a número', () => {
    let detalle: import('./insurance.types').ClaimDetail | undefined;
    client.getClaim('claim-1').subscribe((d) => (detalle = d));

    http.expectOne('/insurance-claims/claim-1').flush({
      header: {
        id: 'claim-1',
        claimIdentifier: 'CLM-1',
        patient: { id: 'p-1', displayName: 'Paciente', patientCode: null, memberIdentifier: null },
        carrierName: 'Aseguradora X',
        insuranceCarrierId: 'c-1',
        carrierWhatsappNumber: null,
        carrierCallCenterPhone: null,
        carrierSupportEmail: null,
        policyIdentifier: null,
        policyBrokerName: null,
        billedTotal: { amount: '300.00', currency: null },
        approvedTotal: { amount: '150.00', currency: null },
        submittedAt: null,
        status: null,
        hasOpenDispute: false,
      },
      lines: [],
      lineBilledTotal: { amount: '300.00', currency: null },
      lineApprovedTotal: { amount: '150.00', currency: null },
      adjudication: null,
      adjudicationHistory: [],
      disputes: [],
      settlement: {
        availability: 'AVAILABLE',
        totalBilledAmount: '300.00',
        totalApprovedAmount: '150.00',
        totalPatientAmount: '30.00',
        totalDeniedAmount: '120.00',
        reconciled: true,
        exclusions: [
          {
            claimLineId: 'l-1',
            itemName: 'ECG',
            amount: '120.00',
            policyClauseReference: 'Cláusula 12.3',
            denialRationale: null,
          },
        ],
      },
      eob: { id: 'eob-1', publishedAt: '2026-09-20T12:00:00.000Z' },
    });

    expect(detalle?.settlement.totalApprovedAmount).toBe('150.00');
    expect(detalle?.settlement.exclusions[0]?.amount).toBe('120.00');
    expect(detalle?.eob).toEqual({
      id: 'eob-1',
      publishedAt: new Date('2026-09-20T12:00:00.000Z'),
    });
  });

  /**
   * Campañas preventivas de la aseguradora (Tarea 4 · M-06).
   */
  describe('campañas preventivas', () => {
    function campaignWire(overrides: Record<string, unknown> = {}) {
      return {
        id: 'camp-1',
        code: 'CMP-CARDIO-2026',
        title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
        description: null,
        campaignType: 'LABORATORY',
        status: 'ACTIVE',
        targetCondition: { code: 'I10', display: 'Hipertensión esencial' },
        copayBonusPercentage: 100,
        validFrom: '2026-10-01',
        validTo: '2026-11-30',
        activatedAt: '2026-09-25T14:00:00.123456Z',
        partners: [
          {
            id: 'p-1',
            role: 'PROVIDER',
            type: 'LABORATORY',
            name: 'Laboratorio Central AloVida',
            networkProviderMembershipId: null,
          },
        ],
        createdAt: '2026-09-25T14:00:00.123456Z',
        updatedAt: '2026-09-25T14:00:00.123456Z',
        ...overrides,
      };
    }

    it('listCampaigns pega en /insurance-campaigns, descarta filtros vacíos y convierte fechas', () => {
      let page: CampaignPage = { items: [], nextCursor: null };
      client
        .listCampaigns({ type: 'LABORATORY', status: undefined, cursor: '', limit: 25 })
        .subscribe((result) => (page = result));

      const request = http.expectOne((r) => r.url === '/insurance-campaigns');
      expect(request.request.method).toBe('GET');
      expect(request.request.params.get('type')).toBe('LABORATORY');
      expect(request.request.params.get('limit')).toBe('25');
      // Un filtro vacío llegaría como cadena vacía y reventaría el `@IsIn()` de la API.
      expect(request.request.params.has('status')).toBe(false);
      expect(request.request.params.has('cursor')).toBe(false);
      request.flush({ items: [campaignWire()], nextCursor: 'abc' });

      expect(page.nextCursor).toBe('abc');
      expect(page.items[0]?.activatedAt).toBeInstanceOf(Date);
    });

    /**
     * El defecto que `maybeDateOnly` existe para evitar: la vigencia llega como
     * `AAAA-MM-DD` y pasarla por `new Date()` la ancla a medianoche UTC, con lo
     * que retrocede un día al pintarse al oeste de Greenwich (Bolivia es UTC−4).
     */
    it('la vigencia se convierte a día civil local, sin correrse un día', () => {
      let from: Date | undefined;
      let to: Date | undefined;
      client.listCampaigns().subscribe((result) => {
        from = result.items[0]?.validFrom;
        to = result.items[0]?.validTo;
      });

      http
        .expectOne((r) => r.url === '/insurance-campaigns')
        .flush({ items: [campaignWire()], nextCursor: null });

      expect([from?.getFullYear(), from?.getMonth(), from?.getDate()]).toEqual([2026, 9, 1]);
      expect([to?.getFullYear(), to?.getMonth(), to?.getDate()]).toEqual([2026, 10, 30]);
    });

    it('createCampaign hace POST con el cuerpo tal cual y devuelve la campaña convertida', () => {
      const input = {
        code: 'CMP-CARDIO-2026',
        title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
        campaignType: 'LABORATORY',
        targetConditionCode: 'I10',
        copayBonusPercentage: 100,
        validFrom: '2026-10-01',
        validTo: '2026-11-30',
        partners: [{ role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' }],
        activate: true,
      } as const;
      let created: { code: string; validTo: Date } | undefined;
      client.createCampaign(input).subscribe((result) => (created = result));

      const request = http.expectOne('/insurance-campaigns');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual(input);
      request.flush(campaignWire());

      expect(created?.code).toBe('CMP-CARDIO-2026');
      expect(created?.validTo).toBeInstanceOf(Date);
    });

    it('updateCampaignStatus hace PATCH a /:id/status y codifica el id', () => {
      let status: string | undefined;
      client.updateCampaignStatus('id con/barra', 'PAUSED').subscribe((c) => (status = c.status));

      const request = http.expectOne('/insurance-campaigns/id%20con%2Fbarra/status');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ status: 'PAUSED' });
      request.flush(campaignWire({ status: 'PAUSED' }));

      expect(status).toBe('PAUSED');
    });

    it('getActivePatientCampaigns pide con el perfil en la URL y convierte la vigencia', () => {
      let campaigns: readonly { carrierName: string; validTo: Date }[] = [];
      client
        .getActivePatientCampaigns('11111111-1111-4111-8111-111111111111')
        .subscribe((result) => (campaigns = result));

      const request = http.expectOne(
        '/insurance-campaigns/patient/11111111-1111-4111-8111-111111111111',
      );
      expect(request.request.method).toBe('GET');
      request.flush([
        {
          id: 'camp-1',
          code: 'CMP-CARDIO-2026',
          title: 'Chequeo',
          description: null,
          campaignType: 'LABORATORY',
          targetCondition: null,
          copayBonusPercentage: 100,
          validFrom: '2026-10-01',
          validTo: '2026-11-30',
          carrierName: 'Seguros Andina',
          partners: [{ role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' }],
        },
      ]);

      expect(campaigns[0]?.carrierName).toBe('Seguros Andina');
      expect(campaigns[0]?.validTo.getDate()).toBe(30);
    });
  });
});
