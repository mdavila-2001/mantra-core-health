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

describe('CenterScheduleClient: equipos del centro', () => {
  const setup = () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { http: TestBed.inject(HttpTestingController), client: TestBed.inject(CenterScheduleClient) };
  };

  it('alta, cambio, baja y horario propio van a las rutas del equipo', () => {
    const { http, client } = setup();
    const block = { windows: [{ dayOfWeek: 1, startTime: '14:00', endTime: '20:00' }], slotMinutes: 30 };
    client.getEquipmentTypes().subscribe();
    client.addEquipment('u 1', { typeCode: 'MR', model: 'Ingenia' }).subscribe();
    client.updateEquipment('u 1', 'e/1', { serialNumber: 'SN-2' }).subscribe();
    client.setEquipmentStatus('u 1', 'e/1', 'MAINTENANCE').subscribe();
    client.removeEquipment('u 1', 'e/1').subscribe();
    client.saveEquipmentSchedule('u 1', 'e/1', block).subscribe();
    client.saveEquipmentSchedule('u 1', 'e/1', null).subscribe();

    expect(http.expectOne('/diagnostic-units/me/equipment-types').request.method).toBe('GET');
    const add = http.expectOne((r) => r.method === 'POST' && r.url === '/diagnostic-units/u%201/equipment');
    expect(add.request.body).toEqual({ typeCode: 'MR', model: 'Ingenia' });
    const patches = http.match((r) => r.method === 'PATCH' && r.url === '/diagnostic-units/u%201/equipment/e%2F1');
    expect(patches.map((p) => p.request.body)).toEqual([{ serialNumber: 'SN-2' }, { status: 'MAINTENANCE' }]);
    expect(http.expectOne((r) => r.method === 'DELETE' && r.url === '/diagnostic-units/u%201/equipment/e%2F1')).toBeTruthy();
    const schedules = http.match((r) => r.method === 'PUT' && r.url === '/diagnostic-units/u%201/equipment/e%2F1/schedule');
    expect(schedules.map((p) => p.request.body)).toEqual([{ schedule: block }, { schedule: null }]);
    http.verify({ ignoreCancelled: true });
  });
});
