import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PatientSpendingClient } from './patient-spending.client';
import type { PatientSpendingResponseDto } from './patient-spending.dto';

describe('PatientSpendingClient', () => {
  let client: PatientSpendingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PatientSpendingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide GET /patient-spending/me con el rango y nada de la persona', () => {
    let count = -1;
    client.listMine('2025-01-01', '2026-09-27').subscribe((page) => (count = page.items.length));

    const req = http.expectOne((r) => r.url === '/patient-spending/me');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['from', 'to']);
    expect(req.request.params.get('from')).toBe('2025-01-01');
    expect(req.request.params.get('to')).toBe('2026-09-27');
    req.flush({
      currency: 'BOB',
      from: '2025-01-01',
      to: '2026-09-27',
      items: [],
    } satisfies PatientSpendingResponseDto);

    expect(count).toBe(0);
  });

  it('propaga el error real en vez de inventar un vacío', () => {
    let status = 0;
    client
      .listMine('2025-01-01', '2026-09-27')
      .subscribe({ error: (error: { status: number }) => (status = error.status) });

    http
      .expectOne((r) => r.url === '/patient-spending/me')
      .flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });
});
