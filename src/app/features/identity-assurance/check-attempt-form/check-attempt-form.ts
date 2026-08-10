import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  AttemptOutcome,
  NewCheckAttempt,
  RecordedAttempt,
} from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const OUTCOMES: readonly AttemptOutcome[] = ['SUCCESS', 'PENDING', 'FAILED'];

/**
 * Registrar un intento contra la autoridad (V27-11,
 * `POST /identity/checks/:id/attempts`).
 *
 * El intento es el registro técnico de la consulta: por qué endpoint salió,
 * cómo terminó y con qué mensajes se correlaciona. El veredicto del check no
 * va acá — eso es el resultado (V27-12), que es otro registro y es inmutable.
 */
@Component({
  selector: 'app-check-attempt-form',
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
    Radio,
    RadioGroup,
    Switch,
  ],
  templateUrl: './check-attempt-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckAttemptForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    checkId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    identityAuthorityEndpointId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    idempotencyKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    requestMessageId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    responseMessageId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    technicalErrorCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    retryEligible: new FormControl(false, { nonNullable: true }),
  });

  /** Nace en el default del contrato; la radio siempre tiene una elección. */
  protected readonly outcome = signal<AttemptOutcome>('SUCCESS');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<RecordedAttempt | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected elegirResultado(valor: unknown): void {
    this.outcome.set(opcionDe(OUTCOMES, valor) ?? 'SUCCESS');
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { checkId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.recordCheckAttempt(checkId.trim(), this.datos()).subscribe({
      next: (attempt) => {
        this.state.set(ready(null));
        this.recorded.set(attempt);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroIntento(): void {
    this.form.reset();
    this.outcome.set('SUCCESS');
    this.recorded.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewCheckAttempt {
    const valores = this.form.getRawValue();
    const clave = valores.idempotencyKey.trim();
    const salida = valores.requestMessageId.trim();
    const entrada = valores.responseMessageId.trim();
    const codigo = valores.technicalErrorCode.trim();

    return {
      identityAuthorityEndpointId: valores.identityAuthorityEndpointId.trim(),
      // La radio y el switch viajan siempre: son decisiones explícitas y
      // visibles, igual que los interruptores del M29 y el M40.
      outcome: this.outcome(),
      ...(clave === '' ? {} : { idempotencyKey: clave }),
      ...(salida === '' ? {} : { requestMessageId: salida }),
      ...(entrada === '' ? {} : { responseMessageId: entrada }),
      ...(codigo === '' ? {} : { technicalErrorCode: codigo }),
      retryEligible: valores.retryEligible,
    };
  }
}
