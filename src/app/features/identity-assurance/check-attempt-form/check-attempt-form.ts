import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué check',
      hint: 'El check planificado al que pertenece el intento.',
      campos: [
        { key: 'checkId', label: 'Check', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'El intento',
      hint: 'Contra qué endpoint publicado salió la consulta y cómo terminó.',
      campos: [
        { key: 'identityAuthorityEndpointId', label: 'Endpoint de autoridad', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'outcome', label: 'Resultado técnico', control: 'radio', options: [{ value: 'SUCCESS', label: 'Exitoso' }, { value: 'PENDING', label: 'Pendiente' }, { value: 'FAILED', label: 'Fallido' }], required: true },
        { key: 'technicalErrorCode', label: 'Código de error técnico', hint: 'Opcional: si falló, el código que devolvió la integración (hasta 100 caracteres).', control: 'text', mensajeDeError: 'Hasta 100 caracteres.' },
        { key: 'retryEligible', label: 'Elegible para reintento', control: 'switch' },
      ],
    },
    {
      titulo: 'Correlación técnica',
      hint: 'Cómo enlazar el intento con la mensajería de integraciones.',
      campos: [
        { key: 'idempotencyKey', label: 'Clave de idempotencia', hint: 'Opcional: repetir el intento con la misma clave no lo duplica (hasta 200 caracteres).', control: 'text', mensajeDeError: 'Hasta 200 caracteres.' },
        { key: 'requestMessageId', label: 'Mensaje saliente', hint: 'Opcional: el mensaje de integración con el que salió la consulta.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'responseMessageId', label: 'Mensaje entrante', hint: 'Opcional: el mensaje de integración con el que respondió la autoridad.', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
  ]);

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
    /** La radio siempre tiene una elección: el contrato nace en «éxito». */
    outcome: new FormControl<AttemptOutcome>('SUCCESS', { nonNullable: true }),
  });

  /** Nace en el default del contrato; la radio siempre tiene una elección. */

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<RecordedAttempt | null>(null);

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
      outcome: opcionDe(OUTCOMES, valores.outcome) ?? 'SUCCESS',
      ...(clave === '' ? {} : { idempotencyKey: clave }),
      ...(salida === '' ? {} : { requestMessageId: salida }),
      ...(entrada === '' ? {} : { responseMessageId: entrada }),
      ...(codigo === '' ? {} : { technicalErrorCode: codigo }),
      retryEligible: valores.retryEligible,
    };
  }
}
