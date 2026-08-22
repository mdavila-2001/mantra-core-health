import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué caso',
      hint: 'El expediente sobre el que pesa la sospecha.',
      campos: [
        { key: 'caseId', label: 'Caso de verificación', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'La señal',
      hint: 'Qué se sospecha, con qué gravedad y con cuánta certeza.',
      campos: [
        { key: 'signalTypeConceptId', label: 'Tipo de señal (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'severityConceptId', label: 'Severidad (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'confidenceScore', label: 'Puntaje de confianza', hint: 'Opcional: entre 0 y 1, como 0.75. Viaja como texto.', control: 'text', mensajeDeError: NUMBER_STRING_ERROR },
        { key: 'sourceConceptId', label: 'Fuente (concepto)', hint: 'Opcional: de dónde salió la señal — un check, un operador, un sistema.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'evidenceReference', label: 'Referencia a la evidencia', hint: 'Opcional: dónde está lo que respalda la sospecha (hasta 200 caracteres).', control: 'text', mensajeDeError: 'Hasta 200 caracteres.' },
      ],
    },
  ]);

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
