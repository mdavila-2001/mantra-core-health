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
import type {
  ApprovalDocumentCode,
  PlanBenefit,
  UpdatePlanBenefitRulesInput,
} from '../../../core/data-access/insurance/insurance.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { apiErrorMessage } from './insurance-form.helpers';

@Component({
  selector: 'app-approval-rules-dialog',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    AppButton,
    Checkbox,
    Textarea,
    Alert,
    FormField,
    ContentDialog,
  ],
  templateUrl: './approval-rules-dialog.html',
  styleUrl: './insurance-dialogs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalRulesDialog {
  readonly planId = input.required<string>();
  readonly planName = input.required<string>();
  readonly benefit = input.required<PlanBenefit>();
  readonly saved = output<UpdatePlanBenefitRulesInput>();
  readonly closed = output<void>();

  private readonly insurance = inject(InsuranceClient);
  private readonly fb = inject(FormBuilder);
  private initializedBenefitId: string | null = null;
  protected readonly dialog = viewChild.required(ContentDialog);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    requiresPriorAuthorization: [false],
    firmaMedico: [false],
    selloMedico: [false],
    ordenMedica: [false],
    informeClinico: [false],
    exclusionNotes: ['', Validators.maxLength(1000)],
  });

  constructor() {
    effect(() => {
      const benefit = this.benefit();
      if (benefit.id === this.initializedBenefitId) return;
      this.initializedBenefitId = benefit.id;
      const documents = new Set(benefit.approvalRules.requiredDocuments);
      this.form.reset({
        requiresPriorAuthorization: benefit.requiresPriorAuthorization ?? false,
        firmaMedico: documents.has('FIRMA_MEDICO'),
        selloMedico: documents.has('SELLO_MEDICO'),
        ordenMedica: documents.has('ORDEN_MEDICA'),
        informeClinico: documents.has('INFORME_CLINICO'),
        exclusionNotes: benefit.approvalRules.exclusionNotes ?? '',
      });
    });
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const requiredDocuments: ApprovalDocumentCode[] = [];
    if (value.firmaMedico) requiredDocuments.push('FIRMA_MEDICO');
    if (value.selloMedico) requiredDocuments.push('SELLO_MEDICO');
    if (value.ordenMedica) requiredDocuments.push('ORDEN_MEDICA');
    if (value.informeClinico) requiredDocuments.push('INFORME_CLINICO');
    const input: UpdatePlanBenefitRulesInput = {
      requiresPriorAuthorization: value.requiresPriorAuthorization,
      requiredDocuments,
      exclusionNotes: value.exclusionNotes.trim() || null,
    };

    this.saving.set(true);
    this.errorMessage.set(null);
    this.insurance.updateBenefitRules(this.planId(), this.benefit().id, input).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit(input);
        this.dialog().close();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorMessage.set(apiErrorMessage(error));
      },
    });
  }
}
