import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InsuranceCatalog } from './insurance-catalog';

const CARRIER_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVO = { code: 'CARRIER_ACTIVE', display: 'Aseguradora activa' };

const RESUMEN = {
  id: CARRIER_ID,
  carrierCode: 'ASEG-001',
  legalName: 'Aseguradora del Sur S.A.',
  regulatorIdentifier: 'REG-99',
  jurisdiction: null,
  status: ACTIVO,
  verification: { code: 'VERIFICATION_PENDING', display: 'Verificación pendiente' },
  productCount: 1,
  planCount: 1,
  networkCount: 1,
  createdAt: '2026-08-09T12:00:00.000Z',
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

  it('usa el estado de error compartido cuando falla la lectura', () => {
    mount();
    http
      .expectOne('/insurance-carriers')
      .flush({ message: 'falló', requestId: 'req-ins' }, { status: 500, statusText: 'Server Error' });

    expect(status()).toBe('error');
  });
});
