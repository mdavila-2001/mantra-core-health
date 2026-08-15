import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { BrokerSummary } from '../../../core/data-access/insurance/insurance.types';
import { BrokerDirectory } from './broker-directory';

const BROKER_ID = '33333333-3333-4333-8333-333333333333';

function brokerWire(overrides: Record<string, unknown> = {}) {
  return {
    id: BROKER_ID,
    brokerCode: 'BRK-1',
    legalName: 'Corredores Andinos',
    licenseNumber: 'MAT-77',
    jurisdiction: null,
    status: { code: 'BROKER_ACTIVE', display: 'Broker activo' },
    verification: { code: 'VERIFICATION_VERIFIED', display: 'Verificado' },
    independent: false,
    currentCarrierCount: 2,
    createdAt: '2026-08-09T12:00:00.000Z',
    ...overrides,
  };
}

describe('BrokerDirectory', () => {
  let fixture: ComponentFixture<BrokerDirectory>;
  let component: BrokerDirectory;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function mount(): void {
    fixture = TestBed.createComponent(BrokerDirectory);
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

  it('empieza cargando', () => {
    mount();
    expect(status()).toBe('loading');
    http.expectOne('/insurance-brokers').flush({ items: [], count: 0 });
  });

  it('usa el estado vacío explícito cuando no hay corredores', () => {
    mount();
    http.expectOne('/insurance-brokers').flush({ items: [], count: 0 });

    expect(status()).toBe('empty');
  });

  /**
   * La vigencia la decide el servidor. La pantalla no la recalcula a partir de
   * las fechas: si lo hiciera, dos relojes distintos podrían discrepar sobre si
   * alguien puede presentarse como representante de una aseguradora.
   */
  it('nombra la situación de vinculación con lo que dijo el servidor', () => {
    mount();
    http.expectOne('/insurance-brokers').flush({ items: [], count: 0 });

    const linkLabel = internal<(broker: BrokerSummary) => string>('linkLabel');
    const base = brokerWire() as unknown as BrokerSummary;

    expect(linkLabel({ ...base, independent: true, currentCarrierCount: 0 })).toBe('Independiente');
    expect(linkLabel({ ...base, independent: false, currentCarrierCount: 1 })).toBe(
      'Representa a 1 aseguradora',
    );
    expect(linkLabel({ ...base, independent: false, currentCarrierCount: 2 })).toBe(
      'Representa a 2 aseguradoras',
    );
  });

  it('enlaza cada corredor a su ficha y no imprime el identificador', () => {
    mount();
    http.expectOne('/insurance-brokers').flush({ items: [brokerWire()], count: 1 });
    fixture.detectChanges();

    const enlace: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(enlace.getAttribute('href')).toBe(`/administration/brokers/${BROKER_ID}`);
    expect(fixture.nativeElement.textContent).toContain('Corredores Andinos');
    expect(fixture.nativeElement.textContent).not.toContain(BROKER_ID);
  });

  it('usa el estado de error compartido cuando falla la lectura', () => {
    mount();
    http
      .expectOne('/insurance-brokers')
      .flush({ message: 'falló', requestId: 'req-brk' }, { status: 500, statusText: 'Server Error' });

    expect(status()).toBe('error');
  });
});
