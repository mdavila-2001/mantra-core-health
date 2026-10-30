import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  AccountingPractices,
  NO_ACTIVE_PRACTICE,
} from '../../core/data-access/accounting/accounting-practices';
import type { Practice } from '../../core/data-access/accounting/accounting.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { ConsultationPriceBlock } from './consultation-price-block/consultation-price-block';
import { FiscalYearBlock } from './fiscal-year-block/fiscal-year-block';
import { InvoiceIssuerBlock } from './invoice-issuer-block/invoice-issuer-block';

/**
 * «Configuración para facturar» (FAC-06): lo que una práctica necesita para que
 * un pago llegue a facturación y a la contabilidad. Una tarjeta con tres
 * pestañas: el ejercicio fiscal, el precio de la consulta y el emisor de prueba.
 *
 * Ruta hija `/administration/accounting/billing-setup`, sin renglón propio en el
 * menú: se llega desde la contabilidad. La práctica se elige como en la vista
 * contable (`AccountingPractices`); quién puede cambiar cada cosa lo decide la API.
 */
@Component({
  selector: 'app-billing-setup',
  imports: [
    Card,
    ConsultationPriceBlock,
    FiscalYearBlock,
    FormField,
    InvoiceIssuerBlock,
    PageHeader,
    Select,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './billing-setup.html',
  styleUrl: './billing-setup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingSetup {
  private readonly accountingPractices = inject(AccountingPractices);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly practices = signal<ViewState<readonly Practice[]>>(loading());
  protected readonly selectedPracticeId = signal<string | null>(null);
  protected readonly tab = signal(0);
  /** Los borradores viven acá: una pestaña cerrada no conserva sus controles (composition-rules §5). */
  protected readonly yearDraft = signal(String(new Date().getFullYear()));
  protected readonly priceDraft = signal('');

  protected readonly practiceOptions = computed<readonly SelectOption<string>[]>(() => {
    const state = this.practices();
    return state.status === 'ready' ? state.data.map((p) => ({ value: p.id, label: p.name })) : [];
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.practices.set(loading());
    this.accountingPractices.list().subscribe({
      next: (items) => {
        if (items.length === 0) {
          this.practices.set(NO_ACTIVE_PRACTICE);
          return;
        }
        this.practices.set(ready(items));
        if (!items.some((p) => p.id === this.selectedPracticeId())) {
          this.selectedPracticeId.set(items[0]!.id);
        }
      },
      error: (error: unknown) => this.practices.set(errorToViewState(error)),
    });
  }

  protected choosePractice(id: string | null): void {
    if (id === null || id === this.selectedPracticeId()) return;
    this.selectedPracticeId.set(id);
    this.priceDraft.set('');
  }
}
