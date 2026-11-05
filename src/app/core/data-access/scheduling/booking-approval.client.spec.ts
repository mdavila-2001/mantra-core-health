import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BookingApprovalClient, type AgendaApproval } from './booking-approval.client';

describe('BookingApprovalClient (v4.2.88)', () => {
  let client: BookingApprovalClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(BookingApprovalClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listMine pide las agendas propias de la organización', () => {
    client.listMine('t-1').subscribe();

    const req = http.expectOne((r) => r.url === '/scheduling/my-resources');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('tenantId')).toBe('t-1');
    req.flush({ items: [] });
  });

  it('setRequiresApproval hace PATCH al recurso con sólo ese campo', () => {
    let stored: AgendaApproval | undefined;
    client.setRequiresApproval('r-1', false).subscribe((r) => (stored = r));

    const req = http.expectOne('/scheduling/resources/r-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ requiresApproval: false });
    req.flush({ id: 'r-1', name: 'Consultorio', requiresApproval: false });
    expect(stored?.requiresApproval).toBe(false);
  });
});
