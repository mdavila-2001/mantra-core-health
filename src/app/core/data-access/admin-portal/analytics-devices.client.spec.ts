import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AnalyticsDevicesClient } from './analytics-devices.client';

describe('AnalyticsDevicesClient', () => {
  let http: HttpTestingController;
  let client: AnalyticsDevicesClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(AnalyticsDevicesClient);
  });

  afterEach(() => http.verify());

  it('manda from, to y portal como parámetros y descarta los vacíos', () => {
    client
      .devices({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-08T00:00:00.000Z',
        portal: 'MOBILE',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/admin/analytics/devices');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(req.request.params.get('to')).toBe('2026-10-08T00:00:00.000Z');
    expect(req.request.params.get('portal')).toBe('MOBILE');
    req.flush({});
  });

  it('sin consulta no manda ninguna clave (la API rechaza las no declaradas)', () => {
    client.devices().subscribe();
    const req = http.expectOne((r) => r.url === '/admin/analytics/devices');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({});
  });
});
