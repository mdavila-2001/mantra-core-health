import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

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

  it('sin catálogo no hay planes', () => {
    expect(planesDelMercado(null)).toEqual([]);
  });
});

describe('InsurerDetail', () => {
  let fixture: ComponentFixture<InsurerDetail>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ slug: 'seguros-andina' })) },
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

  it('sin catálogo publicado lo dice, y no dibuja una tabla vacía', () => {
    responderMercado({ carrier: null, brokers: [] });

    expect(root().querySelector('[data-testid="aseguradora-sin-productos"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="aseguradora-planes"]')).toBeNull();
    expect(root().querySelector('[data-testid="aseguradora-hablar-con-broker"]')).toBeNull();
  });
});
