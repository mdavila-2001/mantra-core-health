import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NewDeviceAlert } from '../../../core/auth/new-device-alert';
import { SessionStore } from '../../../core/auth/session.store';
import { UxConsent } from '../../../core/observability/consent/ux-consent.service';
import { ShellNotices } from './shell-notices';

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', roles: ['USER'], tenants: ['t-1'], ...claims })}.firma`;
}

/** The push offer is optional, so it waits while any other shell notice is up. */
describe('ShellNotices · push offer ordering', () => {
  const consentVisible = signal(false);

  function held(): boolean {
    const fixture = TestBed.createComponent(ShellNotices);
    return (fixture.componentInstance as unknown as { pushHeld: () => boolean }).pushHeld();
  }

  beforeEach(async () => {
    consentVisible.set(false);
    TestBed.configureTestingModule({ providers: [{ provide: UxConsent, useValue: { avisoVisible: consentVisible } }] });
    // Only the ordering rule is under test here; each notice has its own spec.
    TestBed.overrideComponent(ShellNotices, { set: { imports: [], template: '' } });
    await TestBed.compileComponents();
  });

  it('nothing else showing: the offer may show', () => {
    TestBed.inject(SessionStore).start({ accessToken: jwt({}), refreshToken: 'r' });
    expect(held()).toBe(false);
  });

  it('waits for the new-device notice, the denied organizations and the usage consent', () => {
    TestBed.inject(NewDeviceAlert).show({ deviceId: 'd', label: 'Chrome', occurredAt: new Date() });
    expect(held()).toBe(true);
    TestBed.inject(NewDeviceAlert).dismiss();

    TestBed.inject(SessionStore).start({ accessToken: jwt({ deniedTenants: { 't-2': 'OUTSIDE_HOURS' } }), refreshToken: 'r' });
    expect(held()).toBe(true);
    TestBed.inject(SessionStore).start({ accessToken: jwt({}), refreshToken: 'r' });

    consentVisible.set(true);
    expect(held()).toBe(true);
  });
});
