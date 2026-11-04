import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CenterScheduleClient } from './center-schedule.client';

describe('CenterScheduleClient.getMyBookings', () => {
  it('pide los turnos del centro activo entre dos instantes ISO', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    let count = -1;
    const from = new Date('2026-11-04T04:00:00.000Z');
    const to = new Date('2026-11-05T04:00:00.000Z');
    TestBed.inject(CenterScheduleClient)
      .getMyBookings(from, to)
      .subscribe((page) => (count = page.count));

    const req = http.expectOne((r) => r.url === '/diagnostic-units/me/bookings');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe(from.toISOString());
    expect(req.request.params.get('to')).toBe(to.toISOString());
    req.flush({ items: [], count: 0 });
    expect(count).toBe(0);
    http.verify();
  });
});
