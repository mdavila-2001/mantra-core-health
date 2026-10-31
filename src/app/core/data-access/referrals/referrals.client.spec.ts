import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { referralErrorDetail } from './referrals.errors';
import { ReferralsClient } from './referrals.client';
import { referralIssues, type Referral, type ReferralCreated } from './referrals.types';

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

describe('ReferralsClient · detalle, respuesta, contrarreferencia y anulación', () => {
  let client: ReferralsClient;
  let http: HttpTestingController;
  const DTO = { id: 'r-1', patientProfileId: 'p-1', statusConceptId: 's', createdAt: '2026-10-28T10:00:00Z' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ReferralsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('get lee una y trae el estado legible, el destino sede/externo y la contrarreferencia', () => {
    let referral: Referral | null = null;
    client.get('r-1').subscribe((r) => (referral = r));
    http.expectOne((r) => r.url === '/referrals/r-1').flush({
      ...DTO,
      status: 'COMPLETED',
      referralType: 'THERAPY',
      targetBranchId: 'b-1',
      targetBranchName: 'Anexo Norte',
      targetExternalName: null,
      clinicalSummary: 'Resumen',
      counterReferralText: 'Alta',
      counterReferralAt: '2026-10-29T10:00:00Z',
      informedConsentId: 'c-1',
    });
    expect(referral!.status).toBe('COMPLETED');
    expect(referral!.referralType).toBe('THERAPY');
    expect(referral!.targetBranchName).toBe('Anexo Norte');
    expect('targetExternalName' in referral!).toBe(false);
    expect(referral!.counterReferralAt).toEqual(new Date('2026-10-29T10:00:00Z'));
    expect(referral!.informedConsentId).toBe('c-1');
  });

  it('un estado que esta versión no conoce no se inventa', () => {
    let referral: Referral | null = null;
    client.get('r-1').subscribe((r) => (referral = r));
    http.expectOne((r) => r.url === '/referrals/r-1').flush({ ...DTO, status: 'ARCHIVED' });
    expect(referral!.status).toBeUndefined();
  });

  it('create manda el destino externo, el servicio en texto y lo clínico', () => {
    client
      .create({
        patientProfileId: 'p-1',
        referralType: 'OTHER',
        targetExternalName: 'Dr. Quispe',
        targetExternalContact: '70000000',
        requestedServiceText: 'Hemodiálisis',
        clinicalSummary: 'ERC estadio 5.',
        diagnosisText: 'N18.5',
        treatmentGivenText: 'Dieta',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/referrals');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      referralType: 'OTHER',
      targetExternalName: 'Dr. Quispe',
      targetExternalContact: '70000000',
      requestedServiceText: 'Hemodiálisis',
      clinicalSummary: 'ERC estadio 5.',
      diagnosisText: 'N18.5',
      treatmentGivenText: 'Dieta',
    });
    expect('informedConsentId' in (req.request.body as object)).toBe(false);
    req.flush({ ...DTO });
  });

  it('responde con motivo sólo si lo hay, sin el ok en la derivación', () => {
    let answered: Referral | null = null;
    client.respond('r-1', { decision: 'ACCEPT', rejectReason: '  ' }).subscribe((r) => (answered = r));
    const accept = http.expectOne((r) => r.url === '/referrals/r-1/respond');
    expect(accept.request.method).toBe('PATCH');
    expect(accept.request.body).toEqual({ decision: 'ACCEPT' });
    accept.flush({ ok: true, ...DTO, status: 'ACCEPTED' });
    expect(answered!.status).toBe('ACCEPTED');
    expect('ok' in answered!).toBe(false);

    client.respond('r-1', { decision: 'REJECT', rejectReason: ' Sin cupo ' }).subscribe();
    const reject = http.expectOne((r) => r.url === '/referrals/r-1/respond');
    expect(reject.request.body).toEqual({ decision: 'REJECT', rejectReason: 'Sin cupo' });
    reject.flush({ ok: true, ...DTO, status: 'REJECTED', rejectReason: 'Sin cupo' });
  });

  it('registra la contrarreferencia y anula', () => {
    client.counterReferral('r-1', 'Alta de fisioterapia.').subscribe();
    const counter = http.expectOne((r) => r.url === '/referrals/r-1/counter-referral');
    expect(counter.request.method).toBe('PATCH');
    expect(counter.request.body).toEqual({ counterReferralText: 'Alta de fisioterapia.' });
    counter.flush({ ...DTO, status: 'COMPLETED' });

    let cancelled: Referral | null = null;
    client.cancel('r-1').subscribe((r) => (cancelled = r));
    const cancel = http.expectOne((r) => r.url === '/referrals/r-1/cancel');
    expect(cancel.request.method).toBe('PATCH');
    cancel.flush({ ...DTO, status: 'CANCELLED' });
    expect(cancelled!.status).toBe('CANCELLED');
  });

  it('lee el sub-código del error (arriba o en details) y lo pone en palabras', () => {
    let error: unknown = null;
    client.cancel('r-1').subscribe({ error: (e: unknown) => (error = e) });
    http.expectOne((r) => r.url === '/referrals/r-1/cancel').flush(
      { statusCode: 422, code: 'PRECONDITION_FAILED', reason: 'REFERRAL_ALREADY_CLOSED', message: 'x', details: {} },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(referralErrorDetail(error)?.message).toContain('ya está cerrada');

    client.respond('r-1', { decision: 'ACCEPT' }).subscribe({ error: (e: unknown) => (error = e) });
    http.expectOne((r) => r.url === '/referrals/r-1/respond').flush(
      { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', details: { reason: 'TENANT_REQUIRED' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(referralErrorDetail(error)?.reason).toBe('TENANT_REQUIRED');

    client.respond('r-1', { decision: 'ACCEPT' }).subscribe({ error: (e: unknown) => (error = e) });
    http.expectOne((r) => r.url === '/referrals/r-1/respond').flush(
      { statusCode: 404, code: 'NOT_FOUND', reason: 'REFERRAL_NOT_FOUND', message: 'x', details: { fields: ['id'] } },
      { status: 404, statusText: 'Not Found' },
    );
    expect(referralErrorDetail(error)?.reason).toBe('REFERRAL_NOT_FOUND');
    expect(referralErrorDetail(error)?.fields).toEqual(['id']);
  });
});

describe('referralIssues', () => {
  const today = new Date(2026, 9, 28);
  const valid = {
    patientProfileId: 'p-1',
    referralType: 'TREATMENT' as const,
    targetTenantId: 't-1',
    targetBranchId: 'b-1',
    requestedServiceText: 'Hemodiálisis',
    clinicalSummary: 'ERC estadio 5.',
  };

  it('no objeta una derivación completa', () => {
    expect(referralIssues(valid, today)).toEqual([]);
  });

  it('sin servicio del catálogo exige destino, servicio en texto y resumen clínico', () => {
    const fields = referralIssues({ patientProfileId: 'p-1', referralType: 'TREATMENT' }, today).map((p) => p.field);
    expect(fields).toEqual(['target', 'requestedServiceText', 'clinicalSummary']);
  });

  it('con un servicio del catálogo no exige el texto ni el resumen (la regla de la API)', () => {
    expect(
      referralIssues({ patientProfileId: 'p-1', referralType: 'TREATMENT', targetProfileId: 'hp', targetServiceCatalogId: 's' }, today),
    ).toEqual([]);
  });

  it('un destino externo alcanza como destino', () => {
    const { targetTenantId: _t, targetBranchId: _b, ...withoutTarget } = valid;
    expect(referralIssues({ ...withoutTarget, targetExternalName: 'Dr. Quispe' }, today)).toEqual([]);
  });

  it('respeta los topes del DTO', () => {
    const fields = referralIssues(
      { ...valid, requestedServiceText: 'x'.repeat(501), targetExternalName: 'y'.repeat(201) },
      today,
    ).map((p) => p.field);
    expect(fields).toEqual(['targetExternalName', 'requestedServiceText']);
  });

  it('la vigencia no termina antes de hoy, pero hoy vale', () => {
    expect(referralIssues({ ...valid, validUntil: new Date(2026, 9, 28) }, today)).toEqual([]);
    expect(referralIssues({ ...valid, validUntil: new Date(2026, 9, 27) }, today).map((p) => p.field)).toEqual([
      'validUntil',
    ]);
  });
});
