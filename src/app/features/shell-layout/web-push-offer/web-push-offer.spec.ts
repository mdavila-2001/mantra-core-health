import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { WebPushService, type WebPushOutcome } from '../../../core/notifications/web-push.service';
import { WebPushOffer } from './web-push-offer';

function jwt(sub: string): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub, roles: ['CLINICIAN'], tenants: ['t-1'] })}.firma`;
}

/**
 * The shell offer: shown once per person when push can be offered and the server
 * has it, calls the subscribe flow from the click, and restores push on login.
 */
describe('WebPushOffer', () => {
  let fixture: ComponentFixture<WebPushOffer>;
  let http: HttpTestingController;
  let session: SessionStore;
  let offerable = true;
  let outcome: WebPushOutcome = 'enabled';
  const fake = {
    busy: signal(false),
    refresh: vi.fn(async () => undefined),
    resync: vi.fn(async () => undefined),
    canOffer: vi.fn(() => offerable),
    markOffered: vi.fn(),
    enable: vi.fn(async () => outcome),
    watchWorker: vi.fn(() => () => undefined),
  };

  const query = (id: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  async function mountSignedIn(enabled = true): Promise<void> {
    fixture = TestBed.createComponent(WebPushOffer);
    session.start({ accessToken: jwt('u-1'), refreshToken: 'r' });
    fixture.detectChanges();
    if (offerable) {
      const config = await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/web-push/config')));
      config.flush({ enabled, publicKey: enabled ? 'BAAA' : null });
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    offerable = true;
    outcome = 'enabled';
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WebPushService, useValue: fake },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  it('on login restores push for whoever had it on, before deciding to offer', async () => {
    await mountSignedIn();
    expect(fake.resync).toHaveBeenCalledTimes(1);
    expect(fake.watchWorker).toHaveBeenCalledTimes(1);
  });

  it('offers once and «Activar avisos» runs the subscribe flow from the click', async () => {
    await mountSignedIn();
    expect(query('web-push-offer')).not.toBeNull();

    query('web-push-offer-activar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fake.markOffered).toHaveBeenCalled();
    expect(fake.enable).toHaveBeenCalledTimes(1);
    expect(query('web-push-offer')).toBeNull();
  });

  it('«Ahora no» hides it and records the offer, without asking the browser', async () => {
    await mountSignedIn();
    query('web-push-offer-ahora-no')!.click();
    fixture.detectChanges();

    expect(fake.markOffered).toHaveBeenCalledTimes(1);
    expect(fake.enable).not.toHaveBeenCalled();
    expect(query('web-push-offer')).toBeNull();
  });

  it('blocked by the browser: says how to unblock it and offers only «Entendido»', async () => {
    outcome = 'denied';
    await mountSignedIn();
    query('web-push-offer-activar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('web-push-offer-notice')?.textContent).toContain('candado');
    expect(query('web-push-offer-notice')?.getAttribute('role')).toBeNull();
    // The app cannot undo a browser block: no link that would pretend otherwise.
    expect(query('web-push-offer-ajustes')).toBeNull();
    expect(query('web-push-offer-activar')).toBeNull();
    query('web-push-offer-entendido')!.click();
    fixture.detectChanges();
    expect(query('web-push-offer')).toBeNull();
  });

  it('unavailable: only «Entendido»; a transient failure keeps «Reintentar»', async () => {
    outcome = 'unavailable';
    await mountSignedIn();
    query('web-push-offer-activar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(query('web-push-offer-activar')).toBeNull();
    expect(query('web-push-offer-entendido')).not.toBeNull();

    outcome = 'failed';
    fixture.componentInstance['failure'].set(null);
    fixture.detectChanges();
    query('web-push-offer-activar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(query('web-push-offer-activar')?.textContent).toContain('Reintentar');

    // While retrying, «Entendido» is disabled too.
    fake.busy.set(true);
    fixture.detectChanges();
    expect(query('web-push-offer-entendido')?.getAttribute('aria-disabled')).toBe('true');
    fake.busy.set(false);
  });

  it('permission granted but the browser push service is off: says where to turn it on, no «Reintentar»', async () => {
    outcome = 'service';
    await mountSignedIn();
    query('web-push-offer-activar')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(query('web-push-offer-notice')?.getAttribute('data-reason')).toBe('service');
    expect(query('web-push-offer-notice')?.textContent).toContain('mensajería push');
    expect(query('web-push-offer-notice')?.textContent).not.toContain('Intente de nuevo');
    // Retrying in AloVida cannot fix a browser setting.
    expect(query('web-push-offer-activar')).toBeNull();
    expect(query('web-push-offer-entendido')).not.toBeNull();
  });

  it('a disabled «Ahora no» while activating does not fire', async () => {
    await mountSignedIn();
    fake.busy.set(true);
    fixture.detectChanges();
    query('web-push-offer-ahora-no')!.click();
    expect(fake.markOffered).not.toHaveBeenCalled();
    fake.busy.set(false);
  });

  it('does not offer what the server cannot deliver', async () => {
    await mountSignedIn(false);
    expect(query('web-push-offer')).toBeNull();
  });

  it('nothing when the person was already offered (no config request either)', async () => {
    offerable = false;
    await mountSignedIn();
    http.expectNone((r) => r.url.endsWith('/web-push/config'));
    expect(query('web-push-offer')).toBeNull();
  });

  it('waits while another shell notice is up (held)', async () => {
    fixture = TestBed.createComponent(WebPushOffer);
    fixture.componentRef.setInput('held', true);
    session.start({ accessToken: jwt('u-1'), refreshToken: 'r' });
    fixture.detectChanges();
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/web-push/config')))).flush({ enabled: true, publicKey: 'BAAA' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(query('web-push-offer')).toBeNull();

    fixture.componentRef.setInput('held', false);
    fixture.detectChanges();
    expect(query('web-push-offer')).not.toBeNull();
  });
});
