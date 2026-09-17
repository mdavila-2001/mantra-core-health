import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { Plan } from '../../../core/data-access/insurance/insurance.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { apiErrorMessage, nullableDecimal } from './insurance-form.helpers';

/** Sin decimales negativos y hasta dos decimales — mismo patrón que el resto del módulo. */
const MONEY = /^\d+(?:\.\d{1,2})?$/;

/**
 * Declarar (o quitar) la prima de lista mensual de un plan ya existente —
 * v4.2.14, subtarea 3.1.
 *
 * `PUT /insurance-plans/:planId/premium` es un reemplazo COMPLETO de un solo
 * valor: dejar el campo vacío manda `null` y quita la prima declarada, no la
 * conserva. Es el mismo patrón que `BenefitFormDialog` en modo edición, pero
 * de un único campo — no hace falta el modo `create`.
 */
@Component({
  selector: 'app-plan-premium-dialog',
  imports: [ReactiveFormsModule, AnnounceOnAppear, AppButton, Input, Alert, FormField, ContentDialog],
  templateUrl: './plan-premium-dialog.html',
  styleUrl: './insurance-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanPremiumDialog {
  readonly plan = input.required<Plan>();
  readonly saved = output<string | null>();
  readonly closed = output<void>();

  private readonly insurance = inject(InsuranceClient);
  private readonly fb = inject(FormBuilder);
  private initializedPlanId: string | null = null;
  protected readonly dialog = viewChild.required(ContentDialog);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    monthlyPremiumAmount: ['', Validators.pattern(MONEY)],
  });

  constructor() {
    effect(() => {
      const plan = this.plan();
      if (plan.id === this.initializedPlanId) return;
      this.initializedPlanId = plan.id;
      this.form.reset({ monthlyPremiumAmount: plan.monthlyPremiumAmount ?? '' });
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const monthlyPremiumAmount = nullableDecimal(this.form.getRawValue().monthlyPremiumAmount);
    this.saving.set(true);
    this.errorMessage.set(null);
    this.insurance.updatePlanPremium(this.plan().id, { monthlyPremiumAmount }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit(monthlyPremiumAmount);
        this.dialog().close();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(apiErrorMessage(error));
      },
    });
  }
}
