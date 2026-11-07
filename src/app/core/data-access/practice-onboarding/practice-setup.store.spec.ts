import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../auth/session.store';
import { AccountingClient } from '../accounting/accounting.client';
import { PracticeSetupStore } from './practice-setup.store';

function build(type: string | null, listPractices: () => unknown) {
  const spy = vi.fn(listPractices);
  TestBed.configureTestingModule({
    providers: [
      { provide: SessionStore, useValue: { activeTenantId: signal('t-1'), activeTenantType: signal(type) } },
      { provide: AccountingClient, useValue: { listPractices: spy } },
    ],
  });
  const store = TestBed.inject(PracticeSetupStore);
  TestBed.tick();
  return { store, spy };
}

describe('PracticeSetupStore', () => {
  it('is done when the medical organization already has a practice', () => {
    const { store } = build('HOSPITAL', () => of([{ id: 'p-1' }]));
    expect(store.done()).toBe(true);
  });

  it('is not done while the organization has no practice, and creating one flips it', () => {
    const { store } = build('CLINIC', () => of([]));
    expect(store.done()).toBe(false);
    store.markDone();
    expect(store.done()).toBe(true);
  });

  it('stays unknown when the lookup fails, so the entry is never hidden by mistake', () => {
    const { store } = build('HOSPITAL', () => throwError(() => new Error('403')));
    expect(store.done()).toBeNull();
  });

  it('does not ask anything for an organization that is not medical', () => {
    const { store, spy } = build('PHARMACY', () => of([{ id: 'p-1' }]));
    expect(spy).not.toHaveBeenCalled();
    expect(store.done()).toBeNull();
  });
});
