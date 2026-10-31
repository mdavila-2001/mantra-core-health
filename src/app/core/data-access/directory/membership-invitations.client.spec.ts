import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MembershipInvitationsClient } from './membership-invitations.client';

describe('MembershipInvitationsClient', () => {
  let client: MembershipInvitationsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(MembershipInvitationsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /tenants/me/membership-invitations trae las pendientes con la fecha como Date y un rol conocido', () => {
    let lista: unknown;
    client.list().subscribe((l) => (lista = l));
    http.expectOne('/tenants/me/membership-invitations').flush({
      items: [
        { id: 'm-1', tenantId: 't-1', tenantName: 'Clínica del Sur', role: 'STAFF', invitedAt: '2026-10-29T10:00:00Z' },
        { id: 'm-2', tenantId: 't-2', tenantName: 'Farmacia Vida', role: 'RARO', invitedAt: '2026-10-30T10:00:00Z' },
      ],
    });
    expect(lista).toEqual([
      { id: 'm-1', tenantId: 't-1', tenantName: 'Clínica del Sur', role: 'STAFF', invitedAt: new Date('2026-10-29T10:00:00Z') },
      { id: 'm-2', tenantId: 't-2', tenantName: 'Farmacia Vida', role: 'OTHER', invitedAt: new Date('2026-10-30T10:00:00Z') },
    ]);
  });

  it('aceptar y rechazar son POST a la membresía, con el id escapado', () => {
    let aceptada: unknown;
    let rechazada: unknown;
    client.accept('m/1').subscribe((r) => (aceptada = r));
    const aceptar = http.expectOne('/tenants/me/membership-invitations/m%2F1/accept');
    expect(aceptar.request.method).toBe('POST');
    aceptar.flush({ id: 'm/1', tenantId: 't-1', status: 'ACTIVE' });
    client.decline('m-2').subscribe((r) => (rechazada = r));
    const rechazar = http.expectOne('/tenants/me/membership-invitations/m-2/decline');
    expect(rechazar.request.method).toBe('POST');
    rechazar.flush({ id: 'm-2', tenantId: 't-2', status: 'DECLINED' });
    expect(aceptada).toEqual({ id: 'm/1', tenantId: 't-1', status: 'ACTIVE' });
    expect(rechazada).toEqual({ id: 'm-2', tenantId: 't-2', status: 'DECLINED' });
  });

  it('la organización retira una invitación pendiente con POST …/offboard y declara su propia organización', () => {
    let r: unknown;
    client.withdraw('t-1', 'm-9').subscribe((x) => (r = x));
    const req = http.expectOne('/tenants/t-1/memberships/m-9/offboard');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Tenant-Id')).toBe('t-1');
    req.flush({ ok: true });
    expect(r).toEqual({ ok: true });
  });
});
