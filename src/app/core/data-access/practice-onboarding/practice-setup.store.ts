import { effect, inject, Injectable, signal, untracked } from '@angular/core';

import { SessionStore } from '../../auth/session.store';
import { AccountingClient } from '../accounting/accounting.client';
import { MEDICAL_ORGANIZATION_TYPES } from '../directory/directory.types';

/**
 * Whether the active medical organization already has its practice, for the menu: «Configurar
 * práctica» is only offered until it does. `null` while unknown, for other kinds of
 * organization and when the lookup fails, so the entry is never hidden by mistake.
 */
@Injectable({ providedIn: 'root' })
export class PracticeSetupStore {
  private readonly session = inject(SessionStore);
  private readonly accounting = inject(AccountingClient);

  readonly done = signal<boolean | null>(null);

  constructor() {
    effect(() => {
      const tenantId = this.session.activeTenantId();
      const type = this.session.activeTenantType();
      untracked(() => this.load(tenantId, type));
    });
  }

  /** The setup screen created the practice: no need to ask again. */
  markDone(): void {
    this.done.set(true);
  }

  private load(tenantId: string | null, type: string | null): void {
    this.done.set(null);
    if (
      tenantId === null ||
      type === null ||
      !(MEDICAL_ORGANIZATION_TYPES as readonly string[]).includes(type)
    )
      return;
    this.accounting.listPractices().subscribe({
      next: (practices) => this.done.set(practices.length > 0),
      error: () => this.done.set(null),
    });
  }
}
