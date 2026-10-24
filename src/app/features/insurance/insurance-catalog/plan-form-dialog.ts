import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import {
  apiErrorMessage,
  dateOnlyInputValue,
  dateRangeValidator,
  optional,
} from './insurance-form.helpers';

/** Sin decimales negativos y hasta dos decimales — mismo patrón que el resto del módulo. */
const MONEY = /^\d+(?:\.\d{1,2})?$/;

/**
 * Alta y edición de los datos generales de un **producto seguro** (un plan).
 *
 * En edición no se ofrecen moneda ni prima: la prima tiene su propio diálogo y
 * cambiar la moneda reinterpretaría los importes de todas las cláusulas.
 */
@Component({
  selector: 'app-plan-form-dialog',
  imports: [PaginatedForm, CampoPersonalizado,
    ReactiveFormsModule,
    AnnounceOnAppear,
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
  protected readonly planPages = computed<readonly PaginaDeFormulario[]>(() => [
    { titulo: 'Identificación', campos: ['planCode', 'name'].map((key) => ({ key, label: '', control: 'custom' })) },
    {
      titulo: 'Vigencia e importes',
      campos: ['effectiveFrom', 'effectiveTo', ...(this.mode() === 'create' ? ['currencyConceptId', 'monthlyPremiumAmount'] : [])]
        .map((key) => ({ key, label: '', control: 'custom' })),
    },
  ]);

  readonly mode = input<'create' | 'edit'>('create');
  readonly productId = input.required<string>();
  readonly productName = input.required<string>();
  /** El producto seguro a editar. Sólo se lee con `mode="edit"`. */
  readonly plan = input<Plan | null>(null);
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
      monthlyPremiumAmount: ['', Validators.pattern(MONEY)],
    },
    { validators: dateRangeValidator },
  );

  constructor() {
    effect(() => {
      const plan = this.plan();
      if (this.mode() !== 'edit' || plan === null) return;
      this.form.reset({
        planCode: plan.planCode,
        name: plan.name,
        effectiveFrom: dateOnlyInputValue(plan.effectiveFrom),
        effectiveTo: dateOnlyInputValue(plan.effectiveTo),
        monthlyPremiumAmount: '',
      });
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    const plan = this.plan();
    if (this.mode() === 'edit' && plan !== null) {
      this.update(plan.id);
      return;
    }
    const value = this.form.getRawValue();
    const currency = this.currencyConceptId();
    this.insurance
      .createPlan(this.productId(), {
        planCode: value.planCode.trim(),
        name: value.name.trim(),
        ...optional('effectiveFrom', value.effectiveFrom),
        ...optional('effectiveTo', value.effectiveTo),
        ...(currency === null ? {} : { currencyConceptId: currency }),
        ...optional('monthlyPremiumAmount', value.monthlyPremiumAmount),
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

  private update(planId: string): void {
    const value = this.form.getRawValue();
    this.insurance
      .updatePlan(planId, {
        planCode: value.planCode.trim(),
        name: value.name.trim(),
        // Reemplazo completo: una vigencia borrada viaja `null` y se quita.
        effectiveFrom: value.effectiveFrom === '' ? null : value.effectiveFrom,
        effectiveTo: value.effectiveTo === '' ? null : value.effectiveTo,
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
