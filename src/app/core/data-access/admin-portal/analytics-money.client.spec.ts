import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalyticsMoneyClient } from './analytics-money.client';
import type { MoneyReport } from './analytics-money.types';

describe('AnalyticsMoneyClient', () => {
  let http: HttpTestingController;
  let client: AnalyticsMoneyClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(AnalyticsMoneyClient);
  });

  afterEach(() => http.verify());

  it('manda from y to como parámetros de GET /admin/analytics/money', () => {
    client.money({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z' }).subscribe();
    const req = http.expectOne((r) => r.url === '/admin/analytics/money');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(req.request.params.get('to')).toBe('2026-10-08T00:00:00.000Z');
    req.flush({ window: {}, items: [], notMeasured: [] });
  });

  it('sin consulta no manda ninguna clave (la API rechaza las no declaradas)', () => {
    client.money().subscribe();
    const req = http.expectOne((r) => r.url === '/admin/analytics/money');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ window: {}, items: [], notMeasured: [] });
  });

  it('entrega el importe como cadena, sin convertirlo a número', () => {
    let recibido: MoneyReport | undefined;
    client.money().subscribe((r) => (recibido = r));
    http.expectOne((r) => r.url === '/admin/analytics/money').flush({
      window: { from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' },
      items: [
        { module: 'billing', moduleLabel: 'Facturación', kind: 'FACTURADO', currency: 'BOB', operations: 3, amount: '9007199254740993.10' },
      ],
      notMeasured: [],
    });
    expect(recibido!.items[0]!.amount).toBe('9007199254740993.10');
    expect(typeof recibido!.items[0]!.amount).toBe('string');
  });
});
