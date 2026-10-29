import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../api';
import { calendarFiscalYear, FiscalYearOpeningClient } from './fiscal-year-opening.client';

describe('FiscalYearOpeningClient', () => {
  let http: HttpTestingController;
  let client: FiscalYearOpeningClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(FiscalYearOpeningClient);
  });

  afterEach(() => http.verify());

  it('POST /accounting/fiscal-years con el cuerpo exacto', () => {
    const body = calendarFiscalYear('p-1', 2026);
    let opened: unknown;
    client.openFiscalYear(body).subscribe((res) => (opened = res));

    const req = http.expectOne('/accounting/fiscal-years');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'fy-1', code: 'FY2026', status: 'open', periodIds: ['a'] });
    expect(opened).toEqual({ id: 'fy-1', code: 'FY2026', status: 'open', periodIds: ['a'] });
  });
});

describe('calendarFiscalYear', () => {
  it('arma el año con doce meses, sin pasar por Date', () => {
    const fy = calendarFiscalYear('p-1', 2026);
    expect(fy).toMatchObject({ practiceId: 'p-1', code: 'FY2026', startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(fy.periods).toHaveLength(12);
    expect(fy.periods[0]).toEqual({ code: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(fy.periods[1]?.endDate).toBe('2026-02-28');
    expect(fy.periods[3]?.endDate).toBe('2026-04-30');
    expect(fy.periods[11]).toEqual({ code: '2026-12', startDate: '2026-12-01', endDate: '2026-12-31' });
  });

  it('febrero de un año bisiesto tiene 29 días', () => {
    expect(calendarFiscalYear('p-1', 2028).periods[1]?.endDate).toBe('2028-02-29');
    expect(calendarFiscalYear('p-1', 2100).periods[1]?.endDate).toBe('2100-02-28');
  });
});
