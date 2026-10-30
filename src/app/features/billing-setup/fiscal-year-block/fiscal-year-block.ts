import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, signal } from '@angular/core';

import { AccountingClient } from '../../../core/data-access/accounting/accounting.client';
import type { FiscalYear } from '../../../core/data-access/accounting/accounting.types';
import {
  calendarFiscalYear,
  FiscalYearOpeningClient,
} from '../../../core/data-access/billing-setup/fiscal-year-opening.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { apiMessage, dayMonthYear, isMissingFiscalYear } from '../billing-setup-errors';

/**
 * «Ejercicio fiscal»: el vigente de la práctica (`GET /accounting/fiscal-years`)
 * o, si la API responde que no hay, el formulario para abrir el del año con sus
 * doce meses. Quién puede abrirlo lo decide la API (S-8): un 403 o un 409 se
 * muestran con su texto.
 */
@Component({
  selector: 'app-fiscal-year-block',
  imports: [AppButton, Alert, FormField, Input, ViewStateHost],
  templateUrl: './fiscal-year-block.html',
  styleUrl: '../billing-setup-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiscalYearBlock {
  private readonly accounting = inject(AccountingClient);
  private readonly opening = inject(FiscalYearOpeningClient);

  readonly practiceId = input.required<string>();
  /** El año que se va a abrir. Vive en la página: la pestaña cerrada no conserva sus controles. */
  readonly yearDraft = model<string>(String(new Date().getFullYear()));

  /** `ready(null)`: la práctica todavía no tiene ejercicio. */
  protected readonly fiscalYear = signal<ViewState<FiscalYear | null>>(loading());
  protected readonly saving = signal(false);
  protected readonly openError = signal<string | null>(null);

  protected readonly yearError = computed(() =>
    /^\d{4}$/.test(this.yearDraft().trim()) ? null : 'Escriba el año con cuatro cifras, por ejemplo 2026.',
  );

  protected readonly currentPeriodName = computed(() => {
    const state = this.fiscalYear();
    if (state.status !== 'ready' || state.data === null) return null;
    const fy = state.data;
    return fy.periods.find((period) => period.id === fy.currentPeriodId)?.name ?? null;
  });

  protected readonly dayMonthYear = dayMonthYear;

  constructor() {
    effect(() => this.load(this.practiceId()));
  }

  protected writeYear(value: string | number | null): void {
    this.yearDraft.set(value === null ? '' : String(value));
  }

  protected reload(): void {
    this.load(this.practiceId());
  }

  protected open(): void {
    if (this.yearError() !== null || this.saving()) return;
    this.saving.set(true);
    this.openError.set(null);
    const body = calendarFiscalYear(this.practiceId(), Number(this.yearDraft().trim()));
    this.opening.openFiscalYear(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.openError.set(apiMessage(error, 'No pudimos abrir el ejercicio. Pruebe de nuevo.'));
      },
    });
  }

  private load(practiceId: string): void {
    this.fiscalYear.set(loading());
    this.accounting.fiscalYear(practiceId).subscribe({
      next: (fy) => this.fiscalYear.set(ready(fy)),
      error: (error: unknown) =>
        this.fiscalYear.set(isMissingFiscalYear(error) ? ready(null) : errorToViewState(error)),
    });
  }
}
