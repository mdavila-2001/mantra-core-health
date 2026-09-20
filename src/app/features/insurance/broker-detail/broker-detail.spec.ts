import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BrokerDetail } from './broker-detail';

const BROKER_ID = '33333333-3333-4333-8333-333333333333';
const PATIENT_ID = '44444444-4444-4444-8444-444444444444';

const PERFIL = {
  id: BROKER_ID,
  brokerCode: 'BRK-1',
  legalName: 'Corredores Andinos',
  licenseNumber: 'MAT-77',
  jurisdiction: null,
  status: { code: 'BROKER_ACTIVE', display: 'Broker activo' },
  verification: { code: 'VERIFICATION_VERIFIED', display: 'Verificado' },
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
};

const CARTERA = {
  items: [
    {
      id: 'bc-1',
      patientProfileId: PATIENT_ID,
      employerGroupId: null,
      clientType: { code: 'CLIENT_TYPE_INDIVIDUAL', display: 'Cliente individual' },
      assignedBrokerUserId: null,
      effectiveFrom: '2026-02-01',
      effectiveTo: null,
      status: { code: 'COVERAGE_ACTIVE', display: 'Cobertura activa' },
    },
  ],
  count: 1,
};

describe('BrokerDetail', () => {
  let fixture: ComponentFixture<BrokerDetail>;
  let component: BrokerDetail;
  let http: HttpTestingController;

  function configure(brokerId: string | null): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(brokerId ? { brokerId } : {})) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  function mount(): void {
    fixture = TestBed.createComponent(BrokerDetail);
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

  function flushBoth(): void {
    http.expectOne(`/insurance-brokers/${BROKER_ID}`).flush(PERFIL);
    http.expectOne(`/insurance-brokers/${BROKER_ID}/clients`).flush(CARTERA);
    fixture.detectChanges();
  }

  it('sin identificador en la ruta va a «no encontrado», sin pedir nada', () => {
    configure(null);
    mount();

    expect(status()).toBe('not-found');
    http.expectNone(() => true);
  });

  it('pide el perfil y la cartera como dos lecturas distintas', () => {
    configure(BROKER_ID);
    mount();
    flushBoth();

    expect(status()).toBe('ready');
  });

  /**
   * El histórico es un requisito: un acuerdo terminado se muestra, pero nunca
   * como si siguiera habilitando a representar a la aseguradora.
   */
  it('muestra las vinculaciones terminadas sin darlas por vigentes', () => {
    configure(BROKER_ID);
    mount();
    flushBoth();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Aseguradora Uno');
    expect(texto).toContain('Aseguradora Dos');
    expect(texto).toContain('Vigente');
    expect(texto).toContain('Terminada');
  });

  /**
   * La regla de la especificación: el corredor gestiona su cartera sin acceso
   * al historial médico. La pantalla no tiene por dónde mostrarlo, y el
   * identificador del paciente tampoco se imprime.
   */
  it('no expone datos clínicos ni el identificador del asegurado', () => {
    configure(BROKER_ID);
    mount();
    flushBoth();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Cliente individual');
    expect(texto).not.toContain(PATIENT_ID);
    expect(texto).toContain('no accede al historial médico');

    // La cartera se pinta con el organismo del sistema, no con una `<table>`
    // a mano (refactor UX): sin colapso a 390 px, sin duplicar el markup.
    expect(fixture.nativeElement.querySelector('app-data-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('table.broker__clients')).toBeNull();
    expect(texto).toContain('Individual');
    expect(texto).toContain('Sin fin');
  });

  /**
   * Si el perfil falla, la cartera deja de importar: `forkJoin` cancela la
   * segunda lectura y la pantalla muestra un error, no medio expediente.
   */
  it('usa el estado de error compartido cuando falla cualquiera de las dos lecturas', () => {
    configure(BROKER_ID);
    mount();
    const cartera = http.expectOne(`/insurance-brokers/${BROKER_ID}/clients`);
    http
      .expectOne(`/insurance-brokers/${BROKER_ID}`)
      .flush(
        { message: 'falló', requestId: 'req-brk' },
        { status: 500, statusText: 'Server Error' },
      );

    expect(status()).toBe('error');
    expect(cartera.cancelled).toBe(true);
  });
});
