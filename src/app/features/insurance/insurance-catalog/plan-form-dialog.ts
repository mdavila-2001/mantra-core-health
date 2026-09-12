import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { apiErrorMessage, dateRangeValidator, optional } from './insurance-form.helpers';

@Component({
  selector: 'app-plan-form-dialog',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    AppButton,
    Input,
    Alert,
    ConceptSelect,
    FormField,
    ContentDialog,
  ],
  templateUrl: './plan-form-dialog.html',
  styleUrl: './insurance-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanFormDialog {
  readonly productId = input.required<string>();
  readonly productName = input.required<string>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  private readonly insurance = inject(InsuranceClient);
  private readonly fb = inject(FormBuilder);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly currencyConceptId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      planCode: ['', [Validators.required, Validators.maxLength(60)]],
      name: ['', [Validators.required, Validators.maxLength(200)]],
      effectiveFrom: [''],
      effectiveTo: [''],
    },
    { validators: dateRangeValidator },
  );

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();
    const currency = this.currencyConceptId();
    this.insurance
      .createPlan(this.productId(), {
        planCode: value.planCode.trim(),
        name: value.name.trim(),
        ...optional('effectiveFrom', value.effectiveFrom),
        ...optional('effectiveTo', value.effectiveTo),
        ...(currency === null ? {} : { currencyConceptId: currency }),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
          this.dialog().close();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(apiErrorMessage(error));
        },
      });
  }
}
