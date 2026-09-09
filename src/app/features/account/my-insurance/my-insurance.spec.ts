import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { MyInsurance } from './my-insurance';

const ANDINA = '11111111-1111-4111-8111-111111111111';
const VITALICIA = '22222222-2222-4222-8222-222222222222';
const ACTIVO = { code: 'ACTIVE', display: 'Activo' };

const CATALOGO = {
  carriers: [
    {
      id: ANDINA,
      code: 'ANDINA',
      name: 'Seguros Andina',
      legalName: 'Seguros Andina S.A.',
      isPublic: false,
      plans: [
        { id: 'plan-int', code: 'ANDINA-INT', name: 'Plan Integral' },
        { id: 'plan-fam', code: 'ANDINA-FAM', name: 'Plan Familiar' },
      ],
    },
    {
      id: VITALICIA,
      code: 'VITALICIA',
      name: 'La Vitalicia',
      legalName: 'La Vitalicia S.A.',
      isPublic: false,
      plans: [{ id: 'plan-vit', code: 'VIT-SALUD', name: 'Salud Total' }],
    },
  ],
};

/** La ficha pública de Seguros Andina, con un paquete y dos planes. */
const FICHA = {
  id: ANDINA,
  carrierCode: 'ANDINA',
  legalName: 'Seguros Andina S.A.',
  regulatorIdentifier: 'APS-0042',
  jurisdiction: null,
  status: ACTIVO,
  verification: { code: 'VERIFICATION_VERIFIED', display: 'Verificada' },
  productCount: 1,
  planCount: 2,
  networkCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  products: [
    {
      id: 'prod-1',
      productCode: 'ANDINA-SALUD',
      name: 'Seguros Andina · Salud',
      productType: { code: 'HEALTH', display: 'Salud' },
      marketSegment: null,
      status: ACTIVO,
      plans: [
        {
          id: 'pl-int',
          planCode: 'ANDINA-INT',
          name: 'Plan Integral',
          planType: null,
          currency: null,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          status: ACTIVO,
          policyDocumentFileId: null,
          benefits: [
            {
              id: 'b-1',
              category: { code: 'CONSULTATION', display: 'Consulta médica' },
              service: null,
              coveragePercent: '80.50',
              copayAmount: '25.00',
              deductibleAmount: null,
              annualLimitAmount: null,
              requiresPriorAuthorization: false,
              effectiveFrom: '2026-01-01',
              effectiveTo: null,
            },
          ],
        },
        {
          id: 'pl-fam',
          planCode: 'ANDINA-FAM',
          name: 'Plan Familiar',
          planType: null,
          currency: null,
          effectiveFrom: null,
          effectiveTo: null,
          status: ACTIVO,
          policyDocumentFileId: null,
          benefits: [],
        },
      ],
    },
  ],
  networks: [
    {
      id: 'red-1',
      networkCode: 'ANDINA-RED',
      name: 'Red de prestadores Andina',
      networkType: null,
      status: ACTIVO,
      effectiveFrom: null,
      effectiveTo: null,
      memberCount: 120,
    },
  ],
};

function perfil(coverages: readonly unknown[]) {
  return {
    personId: 'per-1',
    patientProfileId: 'pid-1',
    identityVerified: true,
    coverages,
    guardians: [],
  };
}

const COBERTURA_ANDINA = {
  carrierId: ANDINA,
  carrierName: 'Seguros Andina',
  planName: 'Plan Integral',
  isPublic: false,
  memberIdentifier: 'AF-20000',
  verified: true,
};

describe('MyInsurance', () => {
  let fixture: ComponentFixture<MyInsurance>;
  let component: MyInsurance;
  let http: HttpTestingController;

  /** Monta la pantalla con la aseguradora que trae la URL, o sin ninguna. */
  function montar(carrierId = ''): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap(carrierId === '' ? {} : { carrierId }),
            ),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyInsurance);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  function internal<T>(name: string): T {
    const value = (component as unknown as Record<string, unknown>)[name];
    return (typeof value === 'function' ? value.bind(component) : value) as T;
  }

  function estado(): string {
    return internal<() => { status: string }>('state')().status;
  }

  /** Responde el perfil y el catálogo, que se piden juntos. */
  function responderBase(coverages: readonly unknown[]): void {
    http.expectOne('/profiles/patients/me').flush(perfil(coverages));
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
  }

  it('con seguro declarado abre el catálogo de ESA aseguradora, sin elegirla', () => {
    montar();
    responderBase([COBERTURA_ANDINA]);

    // El identificador sale de la cobertura, no de un clic: es lo que hace que
    // la pantalla del paciente muestre su seguro y no una lista.
    http.expectOne(`/insurance-carrier-catalog/${ANDINA}`).flush(FICHA);
    fixture.detectChanges();

    expect(estado()).toBe('ready');
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Seguros Andina S.A.');
    expect(texto).toContain('Plan Integral');
    expect(texto).toContain('AF-20000');
    // Los importes se pintan tal como llegan: son `numeric` en la base.
    expect(texto).toContain('80.50%');
    expect(texto).toContain('25.00');
  });

  it('marca cuál de los planes del catálogo es el contratado', () => {
    montar();
    responderBase([COBERTURA_ANDINA]);
    http.expectOne(`/insurance-carrier-catalog/${ANDINA}`).flush(FICHA);
    fixture.detectChanges();

    const contratados = fixture.nativeElement.querySelectorAll('[data-contratado="si"]');
    expect(contratados.length).toBe(1);
    expect(contratados[0].textContent).toContain('Plan Integral');
  });

  it('sin seguro declarado muestra la rejilla de aseguradoras y no pide ninguna ficha', () => {
    montar();
    responderBase([]);
    fixture.detectChanges();

    expect(estado()).toBe('ready');
    expect(fixture.nativeElement.querySelector('[data-testid="mi-seguro-sin-seguro"]')).not.toBeNull();
    const tarjetas = fixture.nativeElement.querySelectorAll(
      '[data-testid="mi-seguro-aseguradora-tarjeta"]',
    );
    // Las dos del catálogo: sin seguro no hay ninguna que descontar.
    expect(tarjetas.length).toBe(2);
  });

  it('con la aseguradora en la URL abre su catálogo aunque no sea la contratada', () => {
    montar(VITALICIA);
    responderBase([COBERTURA_ANDINA]);

    http.expectOne(`/insurance-carrier-catalog/${VITALICIA}`).flush({ ...FICHA, id: VITALICIA });
    fixture.detectChanges();

    // Lo dice en vez de presentar el catálogo ajeno como si fuera su cobertura.
    expect(
      fixture.nativeElement.querySelector('[data-testid="mi-seguro-sin-contrato"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="mi-seguro-volver"]')).not.toBeNull();
  });

  /**
   * La API real todavía no manda `carrierId` en las coberturas. Sin la caída al
   * nombre, todo paciente vería la rejilla en vez de su seguro.
   */
  it('sin `carrierId` encuentra la aseguradora por su nombre', () => {
    montar();
    const { carrierId: _omitido, ...sinId } = COBERTURA_ANDINA;
    responderBase([sinId]);

    http.expectOne(`/insurance-carrier-catalog/${ANDINA}`).flush(FICHA);
    expect(estado()).toBe('ready');
  });

  /**
   * Quien entra sin perfil de paciente —un profesional, por ejemplo— recibe un
   * 404 del perfil propio. No es un error de esta pantalla: es «no hay
   * coberturas», y el catálogo sigue sirviendo.
   */
  it('un 404 del perfil propio no rompe la pantalla: quedan las aseguradoras', () => {
    montar();
    http
      .expectOne('/profiles/patients/me')
      .flush(null, { status: 404, statusText: 'Not Found' });
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    fixture.detectChanges();

    expect(estado()).toBe('ready');
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="mi-seguro-aseguradora-tarjeta"]').length,
    ).toBe(2);
  });

  it('un fallo del catálogo sí se muestra, y «Reintentar» vuelve a pedirlo', () => {
    montar();
    http.expectOne('/profiles/patients/me').flush(perfil([]));
    http
      .expectOne('/insurance-carrier-catalog')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });

    expect(estado()).toBe('error');

    internal<() => void>('recargar')();
    http.expectOne('/profiles/patients/me').flush(perfil([]));
    http.expectOne('/insurance-carrier-catalog').flush(CATALOGO);
    expect(estado()).toBe('ready');
  });
});
