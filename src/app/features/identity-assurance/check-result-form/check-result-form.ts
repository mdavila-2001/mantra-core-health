import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  CheckResultOutcome,
  NewCheckResult,
  RecordedCheckResult,
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
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const OUTCOMES: readonly CheckResultOutcome[] = ['MATCH', 'NO_MATCH'];

/**
 * Registrar el resultado de un check (V27-12,
 * `POST /identity/checks/:id/results`).
 *
 * El resultado es el veredicto inmutable: no se edita — una corrección se
 * registra como versión nueva, y el backend lleva la cuenta. El puntaje viaja
 * como **texto** porque el DTO valida con `@IsNumberString`. El veredicto
 * arranca sin elegir: es la esencia del registro y nadie decide por el
 * operador.
 */
@Component({
  selector: 'app-check-result-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './check-result-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckResultForm {
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
      titulo: 'Qué check',
      hint: 'El check cuyo veredicto se registra.',
      campos: [
        { key: 'checkId', label: 'Check', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'El veredicto',
      hint: 'Qué respondió la autoridad y con cuánta certeza.',
      campos: [
        { key: 'result', label: 'Veredicto', control: 'radio', options: [{ value: 'MATCH', label: 'Coincide' }, { value: 'NO_MATCH', label: 'No coincide' }], required: true },
        { key: 'matchScore', label: 'Puntaje de coincidencia', hint: 'Opcional: entre 0 y 1, como 0.98. Viaja como texto.', control: 'text', mensajeDeError: NUMBER_STRING_ERROR },
        { key: 'discrepancyCodes', label: 'Códigos de discrepancia', hint: 'Opcional: separá los códigos con comas, como DOB_MISMATCH, NAME_PARTIAL.', control: 'text' },
        { key: 'sourceResponseHash', label: 'Hash de la respuesta fuente', hint: 'Opcional: hash de lo que respondió la autoridad (hasta 200 caracteres).', control: 'text', mensajeDeError: 'Hasta 200 caracteres.' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    checkId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    matchScore: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(NUMBER_STRING_PATTERN)],
    }),
    discrepancyCodes: new FormControl('', { nonNullable: true }),
    sourceResponseHash: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    /** Obligatorio por contrato; arranca sin elegir para no decidir por nadie. */
    result: new FormControl<CheckResultOutcome | null>(null, {
      validators: [Validators.required],
    }),
  });


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<RecordedCheckResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const datos = this.datos();
    if (this.form.invalid || datos === null) {
      this.form.markAllAsTouched();
      return;
    }

    const { checkId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.recordCheckResult(checkId.trim(), datos).subscribe({
      next: (result) => {
        this.state.set(ready(null));
        this.recorded.set(result);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroResultado(): void {
    this.form.reset();
    this.recorded.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewCheckResult | null {
    const valores = this.form.getRawValue();
    const veredicto = opcionDe(OUTCOMES, valores.result);
    if (veredicto === null) {
      return null;
    }
    const puntaje = valores.matchScore.trim();
    const hash = valores.sourceResponseHash.trim();
    const codigos = valores.discrepancyCodes
      .split(',')
      .map((codigo) => codigo.trim())
      .filter((codigo) => codigo !== '');

    return {
      result: veredicto,
      ...(puntaje === '' ? {} : { matchScore: puntaje }),
      ...(codigos.length === 0 ? {} : { discrepancyCodes: codigos }),
      ...(hash === '' ? {} : { sourceResponseHash: hash }),
    };
  }
}
