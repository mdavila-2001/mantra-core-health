import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { SessionStore } from '../../../../core/auth/session.store';
import { PharmacyWelcome } from './pharmacy-welcome';

/** base64url over UTF-8, like the real token. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const PHARMACY_ACCOUNT = {
  sub: 'u-farmacia',
  roles: ['USER', 'PHARMACY_STAFF'],
  tenants: ['t-farmacia'],
  tenantTypes: { 't-farmacia': 'PHARMACY' },
  name: 'Farmacia Vida',
};

function mount(claims: Record<string, unknown>, pharmacyName = ''): HTMLElement {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  TestBed.inject(SessionStore).start({ accessToken: jwt(claims), refreshToken: 'r-1' });
  const fixture = TestBed.createComponent(PharmacyWelcome);
  fixture.componentRef.setInput('pharmacyName', pharmacyName);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PharmacyWelcome', () => {
  it('greets the pharmacy by its full name, not a "first name"', () => {
    const root = mount(PHARMACY_ACCOUNT, 'Farmacia Vida Central');
    expect(root.querySelector('h1')?.textContent).toContain('Farmacia Vida Central');
  });

  it('falls back to the account name while the pharmacy is unknown', () => {
    const root = mount(PHARMACY_ACCOUNT);
    expect(root.querySelector('h1')?.textContent).toContain('Farmacia Vida');
  });

  it('offers the four pharmacy shortcuts the menu also shows', () => {
    const root = mount(PHARMACY_ACCOUNT);
    const hrefs = [...root.querySelectorAll('a.shortcut')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/administration/pharmacy-orders',
      '/administration/pharmacy-catalog',
      '/administration/pharmacy-campaigns',
      '/administration/pharmacy-hours',
    ]);
  });

  it('hides pharmacy shortcuts from a session the menu would not show them to', () => {
    const root = mount({ ...PHARMACY_ACCOUNT, tenantTypes: { 't-farmacia': 'PAYER' } });
    expect(root.querySelectorAll('a.shortcut')).toHaveLength(0);
  });

  it('carries the counter panel on the side', () => {
    const root = mount(PHARMACY_ACCOUNT);
    expect(root.querySelector('aside app-counter-today')).not.toBeNull();
  });
});
