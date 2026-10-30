import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ReferralDetail } from './referral-detail';

/** Una derivación que un colega le hizo a la profesional de la sesión. */
const INCOMING: Referral = {
  id: 'r-1',
  patientProfileId: 'p-1',
  statusConceptId: 'st',
  status: 'PENDING',
  createdAt: new Date('2026-10-28T10:00:00Z'),
  referralType: 'CONSULTATION',
  referringProfileId: 'hp-colega',
  targetProfileId: 'hp-yo',
  targetDisplayName: 'Dra. Rojas',
  requestedServiceText: 'Interconsulta',
  clinicalSummary: 'Dolor torácico atípico.',
};

const DTO = { id: 'r-1', patientProfileId: 'p-1', statusConceptId: 'st', createdAt: '2026-10-28T10:00:00Z' };

/**
 * El detalle de una derivación: qué acciones ofrece según el estado y quién
 * la emitió (la API vuelve a decidir), qué manda cada una, y que el 404 de
 * quien no es destino se dice en palabras.
 */
describe('ReferralDetail', () => {
  let fixture: ComponentFixture<ReferralDetail>;
  let http: HttpTestingController;
  let reason: string | null;
  let confirmed: boolean;

  function create(referral: Referral): void {
    fixture = TestBed.createComponent(ReferralDetail);
    fixture.componentRef.setInput('referral', referral);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-abierto');
    fixture.detectChanges();
  }

  function byTestId(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);
  }

  function member<T>(name: string): T {
    const c = fixture.componentInstance as unknown as Record<string, unknown>;
    const value = c[name];
    return (typeof value === 'function' ? value.bind(c) : value) as T;
  }

  beforeEach(() => {
    reason = 'Sin cupo hasta diciembre';
    confirmed = true;
    TestBed.configureTestingModule({
      imports: [ReferralDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            practitionerProfileId: signal<string | null>('hp-yo'),
            activeTenantId: signal<string | null>('t-1'),
            roles: signal<readonly string[]>(['PRACTITIONER']),
            displayName: signal<string | null>('Dra. Rojas'),
          },
        },
        {
          provide: DialogService,
          useValue: {
            confirm: () => Promise.resolve(confirmed),
            confirmWithReason: () => Promise.resolve(reason),
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    for (const r of http.match((req) => req.url === '/consent/treatment-informed-consents')) {
      r.flush({ items: [] });
    }
    http.verify();
  });

  it('al destino de una pendiente le ofrece aceptar y rechazar con el mismo peso, y anular', () => {
    create(INCOMING);
    const accept = byTestId('referral-accept');
    const reject = byTestId('referral-reject');
    expect(accept).not.toBeNull();
    expect(reject).not.toBeNull();
    expect(accept!.getAttribute('variant')).toBe(reject!.getAttribute('variant'));
    expect(byTestId('referral-cancel')).not.toBeNull();
    expect(byTestId('referral-counter')).toBeNull();
  });

  it('a quien la emitió no le ofrece responderla (es del destino), sí anularla', () => {
    create({ ...INCOMING, referringProfileId: 'hp-yo', targetProfileId: 'hp-otro' });
    expect(byTestId('referral-accept')).toBeNull();
    expect(byTestId('referral-cancel')).not.toBeNull();
  });

  it('aceptar manda ACCEPT y avisa con la derivación del servidor', async () => {
    create(INCOMING);
    let changed: Referral | null = null;
    fixture.componentInstance.changed.subscribe((r) => (changed = r));
    await member<() => Promise<void>>('accept')();
    const req = http.expectOne((r) => r.url === '/referrals/r-1/respond');
    expect(req.request.body).toEqual({ decision: 'ACCEPT' });
    req.flush({ ok: true, ...DTO, status: 'ACCEPTED' });
    expect(changed!.status).toBe('ACCEPTED');
  });

  it('rechazar manda el motivo; sin motivo (cancelado) no manda nada', async () => {
    create(INCOMING);
    await member<() => Promise<void>>('reject')();
    const req = http.expectOne((r) => r.url === '/referrals/r-1/respond');
    expect(req.request.body).toEqual({ decision: 'REJECT', rejectReason: 'Sin cupo hasta diciembre' });
    req.flush({ ok: true, ...DTO, status: 'REJECTED' });

    reason = null;
    await member<() => Promise<void>>('reject')();
    http.expectNone((r) => r.url === '/referrals/r-1/respond');
  });

  it('anular pide confirmación: sin ella no manda nada; con ella, PATCH cancel', async () => {
    create(INCOMING);
    confirmed = false;
    await member<() => Promise<void>>('cancel')();
    http.expectNone((r) => r.url === '/referrals/r-1/cancel');

    confirmed = true;
    await member<() => Promise<void>>('cancel')();
    http.expectOne((r) => r.url === '/referrals/r-1/cancel').flush({ ...DTO, status: 'CANCELLED' });
  });

  it('el 404 de quien no es destino se dice en palabras, sin confirmar que exista', async () => {
    create(INCOMING);
    await member<() => Promise<void>>('accept')();
    http
      .expectOne((r) => r.url === '/referrals/r-1/respond')
      .flush(
        { statusCode: 404, code: 'NOT_FOUND', reason: 'REFERRAL_NOT_FOUND', message: 'Referencia no encontrada' },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();
    expect(byTestId('referral-action-error')?.textContent).toContain('No encontramos esta derivación');
  });

  it('una aceptada ofrece la contrarreferencia al destino', async () => {
    create({ ...INCOMING, status: 'ACCEPTED' });
    expect(byTestId('referral-counter')).not.toBeNull();
    await member<() => Promise<void>>('counterRefer')();
    const req = http.expectOne((r) => r.url === '/referrals/r-1/counter-referral');
    expect(req.request.body).toEqual({ counterReferralText: 'Sin cupo hasta diciembre' });
    req.flush({ ...DTO, status: 'COMPLETED' });
  });

  it('el consentimiento sólo para los tipos que lo piden, atado al origen o a la atención abierta', () => {
    create(INCOMING);
    expect(byTestId('referral-detail-consent')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-informed-consent-panel')).toBeNull();

    fixture.componentRef.setInput('referral', { ...INCOMING, referralType: 'THERAPY', informedConsentId: 'c-1' });
    fixture.detectChanges();
    expect(byTestId('referral-detail-consent')?.textContent).toContain('Aceptado y vinculado');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-informed-consent-panel')).not.toBeNull();
    expect(member<() => string | null>('consentEncounterId')()).toBe('enc-abierto');

    fixture.componentRef.setInput('referral', { ...INCOMING, referralType: 'THERAPY', sourceEncounterId: 'enc-origen' });
    expect(member<() => string | null>('consentEncounterId')()).toBe('enc-origen');
  });
});
