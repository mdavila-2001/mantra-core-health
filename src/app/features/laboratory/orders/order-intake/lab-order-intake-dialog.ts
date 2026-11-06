import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, startWith, switchMap } from 'rxjs';

import { LabOrderIntakeClient } from '../../../../core/data-access/lab-portal/lab-order-intake.client';
import type {
  LabOrderCategory,
  LabOrderIntakeFields,
  LabPatientMatch,
} from '../../../../core/data-access/lab-portal/lab-order-intake.types';
import type { LabOrder } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import {
  TARGET_ESTUDIO,
  TARGET_PRIORIDAD,
} from '../../../clinical-record/patient-chart/analysis-order-block/analysis-order-block';
import { PRIORITY_LABELS } from '../../../clinical-record/patient-chart/analysis-order-block/analysis-order-block.helpers';
import { apiMessageOf } from '../laboratory-orders.logic';

const text = (value: string | number | null): string => String(value ?? '');
const optional = (value: string): string | undefined => value.trim() || undefined;

/**
 * Enter the order a patient brings on paper, or a walk-in request, and fix one
 * the center entered before receiving it. Without `order` it creates: the
 * patient is found by exact national id first. With `order` it edits: the
 * patient is fixed, the rest is replaced. The API decides (409/422); this
 * dialog only keeps an incomplete form from being sent.
 */
@Component({
  selector: 'app-lab-order-intake-dialog',
  imports: [Alert, AppButton, ConceptSelect, ContentDialog, FormField, Input],
  templateUrl: './lab-order-intake-dialog.html',
  styleUrl: './lab-order-intake-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabOrderIntakeDialog {
  private readonly intake = inject(LabOrderIntakeClient);

  readonly order = input<LabOrder | null>(null);
  readonly saved = output<LabOrder>();
  readonly closed = output<void>();

  protected readonly targetStudy = TARGET_ESTUDIO;
  protected readonly targetPriority = TARGET_PRIORIDAD;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly text = text;

  protected readonly nationalId = signal('');
  protected readonly patient = signal<LabPatientMatch | null>(null);
  protected readonly lookingUp = signal(false);
  protected readonly study = linkedSignal(() => this.order()?.codeConceptId ?? null);
  protected readonly priority = linkedSignal(() => this.order()?.priorityConceptId ?? null);
  protected readonly requester = linkedSignal(() => this.order()?.externalRequesterName ?? '');
  protected readonly license = linkedSignal(() => this.order()?.externalRequesterLicense ?? '');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** The chosen study's family, from the catalog: `undefined` while it is asked. */
  private readonly family = toSignal(
    toObservable(this.study).pipe(
      switchMap((study) =>
        study === null
          ? of(null)
          : this.intake.studyFamily(study).pipe(
              catchError(() => of(null)),
              startWith(undefined),
            ),
      ),
    ),
    { initialValue: undefined },
  );

  protected readonly editing = computed(() => this.order() !== null);
  protected readonly category = computed<LabOrderCategory | null>(() => {
    const family = this.family();
    return family === 'LAB' || family === 'IMAGING' ? family : null;
  });
  protected readonly notDiagnostic = computed(
    () => this.study() !== null && this.family() !== undefined && this.category() === null,
  );
  protected readonly canSave = computed(
    () =>
      !this.saving() && this.category() !== null && (this.editing() || this.patient() !== null),
  );

  protected lookUp(): void {
    const nationalId = this.nationalId().trim();
    if (nationalId === '' || this.lookingUp()) return;
    this.lookingUp.set(true);
    this.error.set(null);
    this.patient.set(null);
    this.intake.lookupPatient(nationalId).subscribe({
      next: (match) => {
        this.lookingUp.set(false);
        this.patient.set(match);
      },
      error: (error: unknown) => {
        this.lookingUp.set(false);
        this.error.set(apiMessageOf(error, 'No pudimos buscar al paciente.'));
      },
    });
  }

  protected save(event?: Event): void {
    event?.preventDefault();
    const study = this.study();
    const category = this.category();
    if (!this.canSave() || study === null || category === null) return;
    const fields: LabOrderIntakeFields = {
      codeConceptId: study,
      category,
      priorityConceptId: this.priority() ?? undefined,
      externalRequesterName: optional(this.requester()),
      externalRequesterLicense: optional(this.license()),
    };
    const order = this.order();
    const patient = this.patient();
    const request =
      order !== null
        ? this.intake.updateOrder(order.orderId, fields)
        : this.intake.createOrder({ ...fields, patientProfileId: patient!.patientProfileId });
    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: (savedOrder) => {
        this.saving.set(false);
        this.saved.emit(savedOrder);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(apiMessageOf(error, 'No pudimos guardar la orden.'));
      },
    });
  }
}
