import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  AccountLinkCompletion,
  AccountLinkCompletionResult,
} from '../../../core/data-access/auth-providers/auth-providers.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, objetoJson } from '../../../shared/forms/form-support';

const MAX_TOKEN = 200;
const MAX_EMAIL = 300;
const MAX_NAME = 200;

/** Techo generoso para los claims declarativos; el DDL no fija uno. */
const MAX_CLAIMS = 2000;

/**
 * Completar la vinculación de una cuenta (V40-01·A,
 * `POST /auth-providers/account-link-requests/complete`).
 *
 * El cierre del vínculo: se presenta el token recibido al solicitar y la
 * identidad federada queda activa. El token va enmascarado — es un secreto de
 * un solo uso, no un dato para mostrar.
 */
@Component({
  selector: 'app-account-link-complete-form',
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
    Textarea,
  ],
  templateUrl: './account-link-complete-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLinkCompleteForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly maxClaims = MAX_CLAIMS;

  protected readonly form = new FormGroup({
    linkToken: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_TOKEN)],
    }),
    externalEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_EMAIL)],
    }),
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_NAME)],
    }),
    claims: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_CLAIMS), objetoJson],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly completed = signal<AccountLinkCompletionResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la vinculación de cuentas.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // El cuerpo recién se arma con el formulario válido: antes, los claims
    // podrían ni parsear.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.completeAccountLink(this.datos()).subscribe({
      next: (vinculo) => {
        this.state.set(ready(null));
        this.completed.set(vinculo);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraVinculacion(): void {
    this.form.reset();
    this.completed.set(null);
    this.state.set(ready(null));
  }

  private datos(): AccountLinkCompletion {
    const valores = this.form.getRawValue();
    const correo = valores.externalEmail.trim();
    const nombre = valores.displayName.trim();
    const claims = valores.claims.trim();

    return {
      linkToken: valores.linkToken.trim(),
      ...(correo === '' ? {} : { externalEmail: correo }),
      ...(nombre === '' ? {} : { displayName: nombre }),
      ...(claims === '' ? {} : { claims: JSON.parse(claims) as Record<string, unknown> }),
    };
  }
}
