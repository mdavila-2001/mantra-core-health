import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
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
  });

  /** Obligatorio por contrato; arranca sin elegir para no decidir por nadie. */
  protected readonly result = signal<CheckResultOutcome | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly recorded = signal<RecordedCheckResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected elegirVeredicto(valor: unknown): void {
    this.result.set(opcionDe(OUTCOMES, valor));
  }

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
    this.result.set(null);
    this.recorded.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewCheckResult | null {
    const veredicto = this.result();
    if (veredicto === null) {
      return null;
    }

    const valores = this.form.getRawValue();
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
