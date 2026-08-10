import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  NewFraudSignal,
  RaisedFraudSignal,
} from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  NUMBER_STRING_ERROR,
  NUMBER_STRING_PATTERN,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

/**
 * Registrar una señal de fraude sobre un caso (V27-06,
 * `POST /identity/verification-cases/:id/fraud-signals`).
 *
 * La señal es una sospecha tipificada — no un veredicto: nace sin resolver y
 * es la revisión manual la que decide qué hacer con el caso. El puntaje de
 * confianza viaja como **texto** porque el DTO valida con `@IsNumberString`.
 */
@Component({
  selector: 'app-fraud-signal-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
  ],
  templateUrl: './fraud-signal-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FraudSignalForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly scoreError = NUMBER_STRING_ERROR;

  protected readonly form = new FormGroup({
    caseId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    signalTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    severityConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    confidenceScore: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    sourceConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    evidenceReference: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly raised = signal<RaisedFraudSignal | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { caseId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.raiseFraudSignal(caseId.trim(), this.datos()).subscribe({
      next: (signal) => {
        this.state.set(ready(null));
        this.raised.set(signal);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraSenal(): void {
    this.form.reset();
    this.raised.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewFraudSignal {
    const valores = this.form.getRawValue();
    const confianza = valores.confidenceScore.trim();
    const fuente = valores.sourceConceptId.trim();
    const referencia = valores.evidenceReference.trim();

    return {
      signalTypeConceptId: valores.signalTypeConceptId.trim(),
      severityConceptId: valores.severityConceptId.trim(),
      ...(confianza === '' ? {} : { confidenceScore: confianza }),
      ...(fuente === '' ? {} : { sourceConceptId: fuente }),
      ...(referencia === '' ? {} : { evidenceReference: referencia }),
    };
  }
}
