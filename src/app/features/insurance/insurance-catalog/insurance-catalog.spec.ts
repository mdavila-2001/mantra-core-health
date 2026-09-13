import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type {
  CarrierDetail,
  UpdatePlanBenefitInput,
  UpdatePlanBenefitRulesInput,
} from '../../../core/data-access/insurance/insurance.types';
import { InsuranceCatalog } from './insurance-catalog';

const CARRIER_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVO = { code: 'CARRIER_ACTIVE', display: 'Aseguradora activa' };

const RESUMEN = {
  id: CARRIER_ID,
  carrierCode: 'ASEG-001',
  legalName: 'Aseguradora del Sur S.A.',
  regulatorIdentifier: 'REG-99',
  whatsappNumber: '+59171548278',
  callCenterPhone: '800-10-6060',
  supportEmail: 'siniestros@aseguradoradelsur.com.bo',
  jurisdiction: null,
  status: ACTIVO,
  verification: { code: 'VERIFICATION_PENDING', display: 'Verificación pendiente' },
  productCount: 1,
  planCount: 1,
  networkCount: 1,
  createdAt: '2026-08-09T12:00:00.000Z',
  canAdminister: false,
};

const FICHA = {
  ...RESUMEN,
  products: [
    {
      id: 'p-1',
      productCode: 'PROD-1',
      name: 'Salud Integral',
      productType: { code: 'PRODUCT_TYPE_HEALTH', display: 'Producto de salud' },
      marketSegment: null,
      status: ACTIVO,
      plans: [
        {
          id: 'pl-1',
          planCode: 'PLAN-1',
          name: 'Plan Oro',
          planType: null,
          currency: null,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          status: ACTIVO,
          policyDocumentFileId: null,
          benefits: [
            {
              id: 'b-1',
              category: { code: 'BENEFIT_CATEGORY_GENERAL', display: 'Consulta médica' },
              service: null,
              coveragePercent: '80.50',
              copayAmount: '25.00',
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
  networks: [
    {
      id: 'n-1',
      networkCode: 'RED-1',
      name: 'Red preferente',
      networkType: null,
      status: ACTIVO,
      effectiveFrom: null,
      effectiveTo: null,
      memberCount: 4,
    },
  ],
};

describe('InsuranceCatalog', () => {
  let fixture: ComponentFixture<InsuranceCatalog>;
  let component: InsuranceCatalog;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(): void {
    fixture = TestBed.createComponent(InsuranceCatalog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  function member<T>(name: string): T {
    return (component as unknown as Record<string, unknown>)[name] as T;
  }

  function status(): string {
    return internal<() => { status: string }>('state')().status;
  }

  it('empieza cargando: la autoridad de qué aseguradora es está en el servidor', () => {
    mount();
    expect(status()).toBe('loading');
    http.expectOne('/insurance-carriers').flush({ items: [], count: 0 });
  });

  /**
   * El listado dice **cuál** es la aseguradora de esta organización; sólo la
   * ficha trae el catálogo. Pedir la ficha primero exigiría adivinar un id.
   */
  it('pide la ficha con el identificador que devolvió el listado', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });

    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    expect(status()).toBe('ready');
  });

  it('explica el vacío en vez de pintar un catálogo sin filas', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [], count: 0 });

    expect(status()).toBe('empty');
  });

  it('muestra los importes tal como llegan, sin redondearlos', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('80.50%');
    expect(texto).toContain('25.00');
  });

  it('muestra los canales de contacto de la aseguradora (subtarea 2.3)', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('+59171548278');
    expect(texto).toContain('800-10-6060');
    expect(texto).toContain('siniestros@aseguradoradelsur.com.bo');

    const enlaces: NodeListOf<HTMLAnchorElement> =
      fixture.nativeElement.querySelectorAll('a[href^="tel:"]');
    expect(Array.from(enlaces).some((a) => a.getAttribute('href') === 'tel:800106060')).toBe(
      true,
    );
  });

  it('no imprime identificadores técnicos', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Aseguradora del Sur S.A.');
    expect(texto).not.toContain(CARRIER_ID);
  });

  /**
   * Que una aseguradora declare un registro no es que la plataforma lo haya
   * contrastado. El sello traduce el código, no el texto del catálogo.
   */
  it('distingue lo declarado de lo verificado', () => {
    mount();
    const verificationVariant = internal<(code: string) => string>('verificationVariant');

    expect(verificationVariant('VERIFICATION_VERIFIED')).toBe('approved');
    expect(verificationVariant('VERIFICATION_PENDING')).toBe('pending');
    expect(verificationVariant('UN_CODIGO_QUE_NO_CONOCEMOS')).toBe('unknown');

    http.expectOne('/insurance-carriers').flush({ items: [], count: 0 });
  });

  it('mantiene la vista de staff en solo lectura y oculta todas las acciones', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Vista de solo lectura');
    expect(element.querySelector('[aria-label^="Crear un plan"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Crear una cobertura"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Editar cobertura"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Editar reglas"]')).toBeNull();
  });

  it('muestra las acciones al administrador y abre el diálogo del producto correcto', () => {
    mount();
    http
      .expectOne('/insurance-carriers')
      .flush({ items: [{ ...RESUMEN, canAdminister: true }], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush({ ...FICHA, canAdminister: true });
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Crear un plan en Salud Integral"]',
    );
    expect(button).toBeTruthy();
    button.click();

    const selected = internal<() => { id: string } | null>('productForNewPlan')();
    expect(selected?.id).toBe('p-1');
  });

  it('actualiza importes y reglas en memoria sin recargar la ficha', () => {
    mount();
    http
      .expectOne('/insurance-carriers')
      .flush({ items: [{ ...RESUMEN, canAdminister: true }], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush({ ...FICHA, canAdminister: true });

    const carrier = internal<() => CarrierDetail | null>('carrier')()!;
    const plan = carrier.products[0].plans[0];
    const benefit = plan.benefits[0];
    member<{ set(value: unknown): void }>('benefitEditor').set({ plan, benefit });
    internal<(update: UpdatePlanBenefitInput) => void>('benefitSaved')({
      coveragePercent: '72.25',
      copayAmount: null,
      deductibleAmount: '100.00',
      annualLimitAmount: null,
    });
    member<{ set(value: unknown): void }>('rulesEditor').set({ plan, benefit });
    internal<(update: UpdatePlanBenefitRulesInput) => void>('rulesSaved')({
      requiresPriorAuthorization: false,
      requiredDocuments: ['INFORME_CLINICO'],
      exclusionNotes: 'Exclusión conservada',
    });

    const updated =
      internal<() => CarrierDetail | null>('carrier')()!.products[0]!.plans[0]!.benefits[0]!;
    expect(updated.coveragePercent).toBe('72.25');
    expect(updated.copayAmount).toBeNull();
    expect(updated.approvalRules.requiredDocuments).toEqual(['INFORME_CLINICO']);
    expect(updated.approvalRules.exclusionNotes).toBe('Exclusión conservada');
  });

  it('usa el estado de error compartido cuando falla la lectura', () => {
    mount();
    http
      .expectOne('/insurance-carriers')
      .flush(
        { message: 'falló', requestId: 'req-ins' },
        { status: 500, statusText: 'Server Error' },
      );

    expect(status()).toBe('error');
  });
});
