import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ReferralsClient } from './referrals.client';
import type { Referral, ReferralCreated } from './referrals.types';

/** Una fila como la manda la API: opcionales en `null`, fechas en texto. */
const ROW = {
  id: 'r-1',
  patientProfileId: 'p-1',
  sourceEncounterId: null,
  targetProfileId: null,
  targetTenantId: 't-hospital',
  targetServiceCatalogId: 's-1',
  statusConceptId: 'st-solicitada',
  reasonText: null,
  validUntil: '2026-12-31T00:00:00.000Z',
  respondedAt: null,
  createdAt: '2026-10-28T12:00:00.000Z',
  referralType: 'TREATMENT',
  targetDisplayName: 'Hospital San Lucas',
  targetServiceName: 'Fisioterapia',
};

describe('ReferralsClient', () => {
  let client: ReferralsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ReferralsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searchTargets manda lo escrito y la clase de destino, y devuelve los items', () => {
    let items: readonly unknown[] = [];
    client.searchTargets('car', 'PRACTITIONER').subscribe((r) => (items = r));

    const req = http.expectOne((r) => r.url === '/referrals/targets');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('car');
    expect(req.request.params.get('kind')).toBe('PRACTITIONER');
    req.flush({
      items: [{ kind: 'PRACTITIONER', id: 'hp-1', displayName: 'Dr. X', tenantId: null, subtitle: null }],
    });

    expect(items).toHaveLength(1);
  });

  it('listTargetServices pide por profesional o por organización, nunca por los dos', () => {
    client.listTargetServices({ targetProfileId: 'hp-1' }).subscribe();
    const byPractitioner = http.expectOne((r) => r.url === '/referrals/target-services');
    expect(byPractitioner.request.params.get('targetProfileId')).toBe('hp-1');
    expect(byPractitioner.request.params.has('targetTenantId')).toBe(false);
    byPractitioner.flush({ items: [] });

    client.listTargetServices({ targetTenantId: 't-1' }).subscribe();
    const byOrganization = http.expectOne((r) => r.url === '/referrals/target-services');
    expect(byOrganization.request.params.get('targetTenantId')).toBe('t-1');
    expect(byOrganization.request.params.has('targetProfileId')).toBe(false);
    byOrganization.flush({ items: [] });
  });

  it('listByPatient quita los null y convierte las fechas', () => {
    let list: readonly Referral[] = [];
    client.listByPatient('p-1').subscribe((r) => (list = r));

    const req = http.expectOne((r) => r.url === '/referrals');
    expect(req.request.params.get('patientProfileId')).toBe('p-1');
    req.flush([ROW]);

    const [referral] = list;
    expect(referral?.createdAt).toEqual(new Date('2026-10-28T12:00:00.000Z'));
    // Fecha sin hora: la medianoche local, no la de Greenwich.
    expect(referral?.validUntil?.getDate()).toBe(31);
    expect(referral?.referralType).toBe('TREATMENT');
    expect('reasonText' in (referral ?? {})).toBe(false);
    expect('respondedAt' in (referral ?? {})).toBe(false);
    expect(referral?.targetServiceName).toBe('Fisioterapia');
  });

  it('un tipo que esta versión no conoce no se inventa', () => {
    let list: readonly Referral[] = [];
    client.listByPatient('p-1').subscribe((r) => (list = r));
    http.expectOne((r) => r.url === '/referrals').flush([{ ...ROW, referralType: 'NUEVO' }]);

    expect(list[0]?.referralType).toBeUndefined();
  });

  it('create manda la vigencia como YYYY-MM-DD del día local y devuelve el alta', () => {
    let created: ReferralCreated | undefined;
    client
      .create({
        patientProfileId: 'p-1',
        targetTenantId: 't-1',
        targetServiceCatalogId: 's-1',
        referralType: 'TREATMENT',
        validUntil: new Date(2026, 11, 31, 22, 30),
      })
      .subscribe((r) => (created = r));

    const req = http.expectOne((r) => r.url === '/referrals');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      targetTenantId: 't-1',
      targetServiceCatalogId: 's-1',
      referralType: 'TREATMENT',
      validUntil: '2026-12-31',
    });
    req.flush({
      id: 'r-9',
      patientProfileId: 'p-1',
      statusConceptId: 'st',
      createdAt: '2026-10-28T12:00:00.000Z',
    });

    expect(created?.id).toBe('r-9');
  });

  it('create sin vigencia no manda la clave', () => {
    client.create({ patientProfileId: 'p-1', targetProfileId: 'hp-1' }).subscribe();
    const req = http.expectOne((r) => r.url === '/referrals');
    expect('validUntil' in (req.request.body as object)).toBe(false);
    req.flush({ id: 'r', patientProfileId: 'p-1', statusConceptId: 'st', createdAt: '2026-10-28T12:00:00.000Z' });
  });
});
