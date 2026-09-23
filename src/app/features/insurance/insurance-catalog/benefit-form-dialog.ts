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
import type { Observable } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  PlanBenefit,
  UpdatePlanBenefitInput,
} from '../../../core/data-access/insurance/insurance.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import {
  apiErrorMessage,
  dateRangeValidator,
  nullableDecimal,
  optional,
} from './insurance-form.helpers';

const MONEY = /^\d+(?:\.\d{1,2})?$/;
const COVERAGE = /^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/;

@Component({
  selector: 'app-benefit-form-dialog',
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
  templateUrl: './benefit-form-dialog.html',
  styleUrl: './insurance-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BenefitFormDialog {
  readonly mode = input.required<'create' | 'edit'>();
  readonly planId = input.required<string>();
  readonly planName = input.required<string>();
  readonly benefit = input<PlanBenefit | null>(null);
  readonly saved = output<UpdatePlanBenefitInput | null>();
  readonly closed = output<void>();

  private readonly insurance = inject(InsuranceClient);
  private readonly fb = inject(FormBuilder);
  private initializedBenefitId: string | null = null;
  protected readonly dialog = viewChild.required(ContentDialog);
  protected readonly categoryConceptId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      effectiveFrom: [''],
      effectiveTo: [''],
      coveragePercent: ['', Validators.pattern(COVERAGE)],
      copayAmount: ['', Validators.pattern(MONEY)],
      deductibleAmount: ['', Validators.pattern(MONEY)],
      annualLimitAmount: ['', Validators.pattern(MONEY)],
    },
    { validators: dateRangeValidator },
  );

  constructor() {
    effect(() => {
      const benefit = this.benefit();
      if (this.mode() !== 'edit' || benefit === null || benefit.id === this.initializedBenefitId) {
        return;
      }
      this.initializedBenefitId = benefit.id;
      this.form.reset({
        effectiveFrom: '',
        effectiveTo: '',
        coveragePercent: benefit.coveragePercent ?? '',
        copayAmount: benefit.copayAmount ?? '',
        deductibleAmount: benefit.deductibleAmount ?? '',
        annualLimitAmount: benefit.annualLimitAmount ?? '',
      });
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid || (this.mode() === 'create' && this.categoryConceptId() === null)) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const economics: UpdatePlanBenefitInput = {
      coveragePercent: nullableDecimal(value.coveragePercent),
      copayAmount: nullableDecimal(value.copayAmount),
      deductibleAmount: nullableDecimal(value.deductibleAmount),
      annualLimitAmount: nullableDecimal(value.annualLimitAmount),
    };
    this.saving.set(true);
    this.errorMessage.set(null);

    const benefit = this.benefit();
    const request: Observable<unknown> =
      this.mode() === 'edit' && benefit !== null
        ? this.insurance.updateBenefit(this.planId(), benefit.id, economics)
        : this.insurance.createBenefit(this.planId(), {
            benefitCategoryConceptId: this.categoryConceptId()!,
            ...optional('effectiveFrom', value.effectiveFrom),
            ...optional('effectiveTo', value.effectiveTo),
            ...(economics.coveragePercent === null
              ? {}
              : { coveragePercent: economics.coveragePercent }),
            ...(economics.copayAmount === null ? {} : { copayAmount: economics.copayAmount }),
            ...(economics.deductibleAmount === null
              ? {}
              : { deductibleAmount: economics.deductibleAmount }),
            ...(economics.annualLimitAmount === null
              ? {}
              : { annualLimitAmount: economics.annualLimitAmount }),
          });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit(this.mode() === 'edit' ? economics : null);
        this.dialog().close();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(apiErrorMessage(error));
      },
    });
  }
}
