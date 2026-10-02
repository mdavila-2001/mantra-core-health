import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import type { CarrierDetail } from '@core/data-access/insurance/insurance.types';

import { InsurerDetail, planesDelMercado } from './insurer-detail';

/**
 * La ficha de una aseguradora en el mercado de seguros del paciente.
 *
 * 1. **Cada plan con sus cláusulas en palabras**: porcentaje, importes con su
 *    moneda, autorización previa, documentos exigidos y exclusiones.
 * 2. **Sin catálogo publicado se dice**, no es un error ni una tabla vacía.
 * 3. **«Hablar con el broker» abre el chat** con `?escribirA=<slug>`; un
 *    broker sin perfil no ofrece el botón.
 * 4. **Buscador y filtros** (ADR-0015, regla 5), leídos de la URL: acotan los
 *    planes y, si el término está sólo en algunas cláusulas, la tabla.
 */

const BOB = { code: 'BOB', display: 'Boliviano' };
const c = (code: string, display: string) => ({ code, display });

const CARRIER = {
  id: 'car-1',
  carrierCode: 'ANDINA',
  legalName: 'Seguros Andina S.A.',
  regulatorIdentifier: null,
  whatsappNumber: null,
  callCenterPhone: null,
  supportEmail: null,
  jurisdiction: null,
  status: c('ACTIVE', 'Activa'),
  verification: c('VERIFIED', 'Verificada'),
  productCount: 1,
  planCount: 1,
  networkCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  canAdminister: false,
  networks: [],
  products: [
    {
      id: 'prod-1',
      productCode: 'ANDINA-SALUD',
      name: 'Seguros Andina · Salud',
      productType: c('HEALTH', 'Salud'),
      marketSegment: c('INDIVIDUAL', 'Individual y familiar'),
      status: c('ACTIVE', 'Activo'),
      plans: [
        {
          id: 'plan-1',
          planCode: 'ANDINA-INT',
          name: 'Plan Integral',
          planType: null,
          currency: BOB,
          monthlyPremiumAmount: '450.00',
          effectiveFrom: null,
          effectiveTo: null,
          status: c('ACTIVE', 'Vigente'),
          policyDocumentFileId: null,
          benefits: [
            {
              id: 'b-1',
              category: c('HOSPITALIZATION', 'Internación'),
              service: null,
              coveragePercent: '90',
              copayAmount: null,
              deductibleAmount: '500.00',
              annualLimitAmount: '150000.00',
              requiresPriorAuthorization: true,
              approvalRules: {
                requiredDocuments: ['ORDEN_MEDICA', 'INFORME_CLINICO'],
                exclusionNotes: 'Cirugía estética',
              },
              effectiveFrom: null,
              effectiveTo: null,
            },
          ],
        },
      ],
    },
  ],
};

const BROKERS = [
  {
    id: 'br-1',
    brokerCode: 'BRK-001',
    legalName: 'Consultores en Seguros Oriente S.R.L.',
    licenseNumber: 'CS-2210',
    verification: c('VERIFIED', 'Verificado'),
    independent: true,
    chatSlug: 'broker-consultores-oriente',
  },
  {
    id: 'br-2',
    brokerCode: 'BRK-009',
    legalName: 'Corredor sin perfil',
    licenseNumber: null,
    verification: c('PENDING', 'Pendiente'),
    independent: false,
    chatSlug: null,
  },
];

const FICHA = {
  id: 'pp-andina',
  kind: 'INSURER',
  slug: 'seguros-andina',
  displayName: 'Seguros Andina',
  headline: 'Seguro de salud familiar',
  biography: null,
  city: 'La Paz',
  address: 'Av. Arce N.º 2500',
  verified: true,
  ratingAverage: null,
  ratingCount: 0,
  posts: [],
  updatedAt: '2026-09-01T00:00:00.000Z',
};

describe('planesDelMercado', () => {
  it('dice cada cláusula en palabras, con la moneda y sin partir los importes', () => {
    const [plan] = planesDelMercado({
      ...CARRIER,
      createdAt: new Date(CARRIER.createdAt),
    } as unknown as CarrierDetail);

    expect(plan).toMatchObject({
      nombre: 'Plan Integral',
      producto: 'Seguros Andina · Salud',
      segmento: 'Individual y familiar',
    });
    expect(plan!.prima).toContain('450,00');
    const [fila] = plan!.clausulas;
    expect(fila).toMatchObject({
      cobertura: 'Internación',
      cubre: '90 %',
      copago: '—',
      autorizacion: 'Sí',
      requisitos: 'Pide: Orden médica, Informe clínico · No cubre: Cirugía estética',
    });
    expect(fila!.deducible).toBe('500,00 Bs');
    expect(fila!.tope).toBe('150.000,00 Bs');
  });

  it('resume el plan y destaca sus coberturas para la tarjeta de comparación', () => {
    const [plan] = planesDelMercado({
      ...CARRIER,
      createdAt: new Date(CARRIER.createdAt),
    } as unknown as CarrierDetail);

    expect(plan).toMatchObject({
      rotulo: 'Salud · Individual y familiar',
      mayorCobertura: false,
      destacadas: [{ id: 'b-1', cobertura: 'Internación', cubre: '90\u00a0%' }],
    });
    expect(plan!.resumen).toBe(
      '1 cobertura · tope anual de hasta 150.000,00\u00a0Bs · 1 pide autorización previa',
    );
  });

  it('sin catálogo no hay planes', () => {
    expect(planesDelMercado(null)).toEqual([]);
  });
});

describe('InsurerDetail', () => {
  let fixture: ComponentFixture<InsurerDetail>;
  let http: HttpTestingController;
  let queryParams: BehaviorSubject<Record<string, string>>;

  beforeEach(() => {
    queryParams = new BehaviorSubject<Record<string, string>>({});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ slug: 'seguros-andina' })),
            queryParams,
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InsurerDetail);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/seguros-andina') && r.url.includes('/public/profiles/'))
      .flush(FICHA);
  });

  afterEach(() => http.verify());

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function responderMercado(body: Record<string, unknown>): void {
    http.expectOne('/insurance-marketplace/insurers/seguros-andina').flush(body);
    fixture.detectChanges();
  }

  it('dibuja una pestaña por plan con la tabla de sus cláusulas', () => {
    responderMercado({ carrier: CARRIER, brokers: BROKERS });

    expect(root().querySelectorAll('[role="tab"]')).toHaveLength(1);
    const tabla = root().querySelector('[data-testid="aseguradora-clausulas"]');
    expect(tabla?.textContent).toContain('Internación');
    expect(tabla?.textContent).toContain('No cubre: Cirugía estética');
    // Una cláusula: ni paginador ni filtros sin nada que elegir.
    expect(root().querySelector('[data-testid="aseguradora-paginacion"]')).toBeNull();
    expect(root().querySelector('[data-testid="aseguradora-filtros"] select')).toBeNull();
  });

  it('«Hablar con el broker» abre el chat con el slug; sin perfil no hay botón', () => {
    responderMercado({ carrier: CARRIER, brokers: BROKERS });

    const principal = root().querySelector<HTMLAnchorElement>(
      '[data-testid="aseguradora-hablar-con-broker"]',
    );
    expect(principal?.getAttribute('href')).toBe('/messaging?escribirA=broker-consultores-oriente');
    // Dos brokers, un solo botón: el que no tiene perfil no ofrece chat.
    expect(root().querySelectorAll('[data-testid="aseguradora-broker"]')).toHaveLength(2);
    expect(root().querySelectorAll('[data-testid="broker-hablar"]')).toHaveLength(1);
  });

  it('con dos planes, la primera pestaña los compara y «Ver cláusulas» abre el del plan', () => {
    const [producto] = CARRIER.products;
    const [integral] = producto!.plans;
    const familiar = {
      ...integral!,
      id: 'plan-2',
      planCode: 'ANDINA-FAM',
      name: 'Plan Familiar',
      planType: c('STANDARD', 'Estándar'),
      monthlyPremiumAmount: null,
    };
    responderMercado({
      carrier: {
        ...CARRIER,
        products: [
          { ...producto!, plans: [{ ...integral!, planType: c('PREMIUM', 'Premium') }, familiar] },
        ],
      },
      brokers: BROKERS,
    });

    const pestanas = [...root().querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
    expect(pestanas).toEqual(['Comparar planes', 'Plan Integral', 'Plan Familiar']);

    const ofertas = [...root().querySelectorAll('[data-testid="aseguradora-oferta"]')];
    expect(ofertas).toHaveLength(2);
    expect(ofertas[0]!.textContent).toContain('Mayor cobertura');
    expect(ofertas[0]!.textContent).toContain('450,00');
    expect(ofertas[0]!.textContent).toContain('Internación');
    expect(ofertas[0]!.textContent).toContain('1 cobertura · tope anual de hasta 150.000,00');
    // Sin prima publicada no se inventa una: se cotiza con el broker.
    expect(ofertas[1]!.textContent).toContain('A cotizar con el broker');
    expect(ofertas[1]!.textContent).not.toContain('Mayor cobertura');
    expect(
      ofertas[0]!.querySelector('[data-testid="oferta-hablar-con-broker"]')?.getAttribute('href'),
    ).toBe('/messaging?escribirA=broker-consultores-oriente');

    ofertas[1]!.querySelector<HTMLButtonElement>('[data-testid="oferta-ver-clausulas"]')!.click();
    fixture.detectChanges();

    expect(root().querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'Plan Familiar',
    );
  });

  /** Dos planes de dos productos: salud con dos coberturas, accidentes con una. */
  function dosProductos(): Record<string, unknown> {
    const [salud] = CARRIER.products;
    const [integral] = salud!.plans;
    const dental = {
      ...integral!.benefits[0]!,
      id: 'b-2',
      category: c('DENTAL', 'Odontología'),
      requiresPriorAuthorization: false,
      approvalRules: { requiredDocuments: [], exclusionNotes: null },
    };
    const accidentes = {
      ...salud!,
      id: 'prod-2',
      name: 'Seguros Andina · Accidentes',
      productType: c('ACCIDENT', 'Accidentes personales'),
      marketSegment: c('CORPORATE', 'Empresas'),
      plans: [{ ...integral!, id: 'plan-3', name: 'Plan Accidentes' }],
    };
    return {
      carrier: {
        ...CARRIER,
        products: [
          { ...salud!, plans: [{ ...integral!, benefits: [...integral!.benefits, dental] }] },
          accidentes,
        ],
      },
      brokers: BROKERS,
    };
  }

  const ofertas = (): string[] =>
    [...root().querySelectorAll('[data-testid="aseguradora-oferta"] h3')].map(
      (h) => h.textContent?.trim() ?? '',
    );

  it('arriba de los planes hay buscador y los filtros que tienen algo que elegir', () => {
    responderMercado(dosProductos());

    const barra = root().querySelector('[data-testid="aseguradora-filtros"]');
    expect(barra).not.toBeNull();
    expect(barra!.querySelector('input[type="search"], input')).not.toBeNull();
    const texto = barra!.textContent ?? '';
    expect(texto).toContain('Todos los tipos');
    expect(texto).toContain('Todos los segmentos');
    expect(texto).toContain('Cualquier cobertura');
    expect(ofertas()).toEqual(['Plan Integral', 'Plan Accidentes']);
  });

  it('un filtro de la URL acota los planes y deja de comparar con uno solo', () => {
    responderMercado(dosProductos());
    queryParams.next({ tipo: 'Accidentes personales' });
    fixture.detectChanges();

    const pestanas = [...root().querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());
    expect(pestanas).toEqual(['Plan Accidentes']);
    expect(root().querySelector('[data-testid="aseguradora-cuantos"]')?.textContent).toContain(
      '1 plan coincide de 2',
    );
  });

  it('buscar una cobertura deja el plan que la tiene y su tabla sólo con ésa', () => {
    responderMercado(dosProductos());
    queryParams.next({ q: 'odontologia' });
    fixture.detectChanges();

    expect(root().querySelectorAll('[role="tab"]')).toHaveLength(1);
    const tabla = root().querySelector('[data-testid="aseguradora-clausulas"]');
    expect(tabla?.textContent).toContain('Odontología');
    expect(tabla?.textContent).not.toContain('Internación');
    expect(root().querySelector('[data-testid="aseguradora-acotadas"]')?.textContent).toContain(
      'Se ven 1 de 2 coberturas',
    );
  });

  it('sin coincidencias lo dice y ofrece volver a ver todos', () => {
    responderMercado(dosProductos());
    queryParams.next({ q: 'veterinaria' });
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="aseguradora-sin-coincidencias"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="aseguradora-planes"]')).toBeNull();
  });

  it('una tabla que no entra en la página menor se pagina abajo; una corta, no', () => {
    const [producto] = CARRIER.products;
    const [integral] = producto!.plans;
    const muchas = Array.from({ length: 12 }, (_, i) => ({
      ...integral!.benefits[0]!,
      id: `b-${i}`,
      category: c(`CAT${i}`, `Cobertura ${String(i + 1).padStart(2, '0')}`),
    }));
    responderMercado({
      carrier: {
        ...CARRIER,
        products: [{ ...producto!, plans: [{ ...integral!, benefits: muchas }] }],
      },
      brokers: BROKERS,
    });

    expect(root().querySelector('[data-testid="aseguradora-paginacion"]')).not.toBeNull();
    const filas = root().querySelectorAll('[data-testid="aseguradora-clausulas"] tbody tr');
    expect(filas.length).toBeLessThanOrEqual(10);
    expect(
      root().querySelector('[data-testid="aseguradora-clausulas"]')?.textContent,
    ).not.toContain('Cobertura 12');
  });

  it('sin catálogo publicado lo dice, y no dibuja una tabla vacía', () => {
    responderMercado({ carrier: null, brokers: [] });

    expect(root().querySelector('[data-testid="aseguradora-sin-productos"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="aseguradora-planes"]')).toBeNull();
    expect(root().querySelector('[data-testid="aseguradora-hablar-con-broker"]')).toBeNull();
  });
});
