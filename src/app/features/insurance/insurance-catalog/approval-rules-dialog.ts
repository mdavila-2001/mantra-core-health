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
import {
  APPROVAL_DOCUMENT_CODES,
  type ApprovalDocumentCode,
  type PlanBenefit,
  type UpdatePlanBenefitRulesInput,
} from '../../../core/data-access/insurance/insurance.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import {
  CheckboxGroup,
  type OpcionDeCasilla,
} from '../../../shared/components/molecules/checkbox-group/checkbox-group';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { apiErrorMessage } from './insurance-form.helpers';

const DOCUMENT_LABELS: Readonly<Record<ApprovalDocumentCode, string>> = {
  FIRMA_MEDICO: 'Firma del médico tratante',
  SELLO_MEDICO: 'Sello profesional y matrícula',
  ORDEN_MEDICA: 'Orden médica justificativa',
  INFORME_CLINICO: 'Informe clínico o resumen de historia',
};

@Component({
  selector: 'app-approval-rules-dialog',
  imports: [
    ReactiveFormsModule,
    AnnounceOnAppear,
    AppButton,
    Checkbox,
    CheckboxGroup,
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

  protected readonly documentOptions: readonly OpcionDeCasilla[] = APPROVAL_DOCUMENT_CODES.map(
    (code) => ({ value: code, label: DOCUMENT_LABELS[code] }),
  );

  protected readonly form = this.fb.nonNullable.group({
    requiresPriorAuthorization: [false],
    requiredDocuments: [[] as readonly string[]],
    exclusionNotes: ['', Validators.maxLength(1000)],
  });

  constructor() {
    effect(() => {
      const benefit = this.benefit();
      if (benefit.id === this.initializedBenefitId) return;
      this.initializedBenefitId = benefit.id;
      this.form.reset({
        requiresPriorAuthorization: benefit.requiresPriorAuthorization ?? false,
        requiredDocuments: benefit.approvalRules.requiredDocuments,
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
    const requiredDocuments = APPROVAL_DOCUMENT_CODES.filter((code) =>
      value.requiredDocuments.includes(code),
    );
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
