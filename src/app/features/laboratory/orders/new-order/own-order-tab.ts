import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

import type { LabPatientMatch } from '../../../../core/data-access/lab-portal/lab-order-intake.types';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { readApiError } from '../../../../core/http/api-error';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { createStudyCategoryState } from '../../../clinical-record/patient-chart/analysis-order-block/study-category';
import type { NewOrderResult } from './new-order.types';

const TARGET_STUDY = 'clinical.service_requests.code_concept_id';
const TARGET_CATEGORY = 'clinical.service_requests.category_concept_id';
const TARGET_PRIORITY = 'clinical.service_requests.priority_concept_id';

/**
 * Way 3: the center registers an order that arrives on paper or at the counter (real API:
 * `POST /diagnostics/lab/orders`). The patient is found by national id (in the body: it is PHI) and
 * confirmed by name; the family of the study (lab or imaging) comes from the study, not from a
 * second selector. Whoever signed the paper order is optional.
 */
@Component({
  selector: 'app-own-order-tab',
  imports: [Alert, AppButton, ConceptSelect, FormField, Input, Radio, RadioGroup],
  templateUrl: './own-order-tab.html',
  styleUrl: './own-order-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnOrderTab {
  private readonly lab = inject(LabPortalClient);

  readonly created = output<NewOrderResult>();

  protected readonly targetStudy = TARGET_STUDY;
  protected readonly targetPriority = TARGET_PRIORITY;
  protected readonly nationalId = signal('');
  protected readonly patient = signal<LabPatientMatch | null>(null);
  protected readonly study = signal<string | null>(null);
  protected readonly priority = signal<string | null>(null);
  protected readonly requesterName = signal('');
  protected readonly requesterLicense = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<{ patient?: string; study?: string }>({});
  private readonly category = createStudyCategoryState({ study: this.study, studyTarget: TARGET_STUDY, categoryTarget: TARGET_CATEGORY });
  /** Chosen by hand when the catalog code does not say whether the study is laboratory or imaging. */
  protected readonly manualCategory = signal<'LAB' | 'IMAGING' | null>(null);
  protected readonly askCategory = computed(() => this.category.family() === 'OTHER');
  /** Laboratory or imaging; any other family is not something this center performs. */
  protected readonly studyFamily = computed(() => {
    const family = this.category.family();
    return family === 'OTHER' ? this.manualCategory() : family;
  });
  protected readonly notForCenter = computed(() => {
    const family = this.studyFamily();
    return family !== null && family !== 'LAB' && family !== 'IMAGING';
  });

  protected lookupPatient(): void {
    const id = this.nationalId().trim();
    if (id === '' || this.busy()) return;
    this.busy.set(true);
    this.errors.set({});
    this.lab.lookupPatient(id).subscribe({
      next: (match) => {
        this.busy.set(false);
        this.patient.set(match);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.errors.update((e) => ({ ...e, patient: error instanceof HttpErrorResponse && error.status === 404 ? 'Nadie tiene ese documento.' : 'No pudimos buscar al paciente.' }));
      },
    });
  }

  protected changePatient(): void {
    this.patient.set(null);
    this.nationalId.set('');
  }

  protected submit(): void {
    const patient = this.patient();
    const study = this.study();
    const family = this.studyFamily();
    const errors = {
      ...(patient === null ? { patient: 'Busque al paciente por su documento.' } : {}),
      ...(study === null ? { study: 'Elija el estudio.' } : this.notForCenter() ? { study: 'Ese estudio no lo hace un laboratorio ni un centro de imagenología.' } : family === null ? { study: 'Indique si es de laboratorio o de imagenología.' } : {}),
    };
    this.errors.set(errors);
    this.error.set(null);
    if (this.busy() || patient === null || study === null || (family !== 'LAB' && family !== 'IMAGING')) return;
    this.busy.set(true);
    const name = this.requesterName().trim();
    const license = this.requesterLicense().trim();
    this.lab
      .createOrder({
        patientProfileId: patient.patientProfileId,
        codeConceptId: study,
        category: family,
        ...(this.priority() === null ? {} : { priorityConceptId: this.priority()! }),
        ...(name === '' ? {} : { externalRequesterName: name }),
        ...(license === '' ? {} : { externalRequesterLicense: license }),
      })
      .subscribe({
        next: (order) => {
          this.busy.set(false);
          this.created.emit({ order, created: true });
        },
        error: (error: unknown) => {
          // What was typed is kept: only say why it failed.
          this.busy.set(false);
          const message = error instanceof HttpErrorResponse ? readApiError(error)?.message : undefined;
          this.error.set(message ?? 'No pudimos crear la orden.');
        },
      });
  }
}
