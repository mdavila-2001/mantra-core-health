import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
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
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirm = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm } },
      ],
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

  it('no repite la ficha de la aseguradora: vive en el perfil de la organización', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Correo de siniestros');
    expect(texto).not.toContain('Registro ante el regulador');
    expect(fixture.nativeElement.querySelector('app-status-seal')).toBeNull();
  });

  it('no imprime identificadores técnicos', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Salud Integral');
    expect(texto).not.toContain(CARRIER_ID);
  });

  it('mantiene la vista de staff en solo lectura y oculta todas las acciones', () => {
    mount();
    http.expectOne('/insurance-carriers').flush({ items: [RESUMEN], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush(FICHA);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Vista de solo lectura');
    expect(element.querySelector('[aria-label^="Añadir un producto seguro"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Añadir cláusula"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Editar datos del producto seguro"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Eliminar producto seguro"]')).toBeNull();
    expect(element.querySelector('[aria-label^="Editar cláusula"]')).toBeNull();
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
      '[aria-label="Añadir un producto seguro en Salud Integral"]',
    );
    expect(button).toBeTruthy();
    button.click();

    const selected = internal<() => { product: { id: string }; plan: unknown } | null>(
      'planEditor',
    )();
    expect(selected?.product.id).toBe('p-1');
    expect(selected?.plan).toBeNull();
  });

  it('pone las tres acciones del producto seguro en la línea de su título', () => {
    mountAsAdmin();

    const heading: HTMLElement = fixture.nativeElement.querySelector('#plan-pl-1')!.parentElement;
    const labels = [...heading.querySelectorAll('button')].map((b) => b.textContent!.trim());
    expect(labels).toEqual([
      'Añadir cláusula',
      'Editar datos del producto seguro',
      'Eliminar producto seguro',
    ]);

    (
      heading.querySelector(
        '[aria-label="Editar datos del producto seguro Plan Oro"]',
      ) as HTMLButtonElement
    ).click();
    const editor = internal<() => { product: { id: string }; plan: { id: string } } | null>(
      'planEditor',
    )();
    expect(editor?.product.id).toBe('p-1');
    expect(editor?.plan.id).toBe('pl-1');

    (heading.querySelector('[aria-label="Añadir cláusula a Plan Oro"]') as HTMLButtonElement).click();
    const clause = internal<() => { plan: { id: string }; benefit: unknown } | null>(
      'benefitEditor',
    )();
    expect(clause?.plan.id).toBe('pl-1');
    expect(clause?.benefit).toBeNull();
  });

  it('elimina el producto seguro sólo después de confirmar, y recarga la ficha', async () => {
    mountAsAdmin();
    confirm.mockResolvedValue(true);
    const plan = internal<() => CarrierDetail | null>('carrier')()!.products[0]!.plans[0]!;

    await internal<(plan: unknown) => Promise<void>>('deletePlan')(plan);

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }));
    const request = http.expectOne('/insurance-plans/pl-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush({ ...FICHA, canAdminister: true });
  });

  it('no elimina nada si se cancela la confirmación', async () => {
    mountAsAdmin();
    confirm.mockResolvedValue(false);
    const plan = internal<() => CarrierDetail | null>('carrier')()!.products[0]!.plans[0]!;

    await internal<(plan: unknown) => Promise<void>>('deletePlan')(plan);

    http.expectNone('/insurance-plans/pl-1');
  });

  function mountAsAdmin(): void {
    mount();
    http
      .expectOne('/insurance-carriers')
      .flush({ items: [{ ...RESUMEN, canAdminister: true }], count: 1 });
    http.expectOne(`/insurance-carriers/${CARRIER_ID}`).flush({ ...FICHA, canAdminister: true });
    fixture.detectChanges();
  }

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
