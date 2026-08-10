import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  AccountLinkRequestResult,
  NewAccountLinkRequest,
} from '../../../core/data-access/auth-providers/auth-providers.types';
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
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const MAX_SUBJECT = 300;
const MAX_MINUTES = 1440;

/**
 * Solicitar la vinculación de una cuenta (V40-01,
 * `POST /auth-providers/account-link-requests`).
 *
 * Liga un sujeto externo con una cuenta local mediante un token de un solo
 * uso. El token se devuelve **una sola vez** — en la tabla queda su hash;
 * perderlo obliga a solicitar de nuevo.
 */
@Component({
  selector: 'app-account-link-request-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    DatePipe,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
  ],
  templateUrl: './account-link-request-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLinkRequestForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    externalSubject: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_SUBJECT)],
    }),
    expiresInMinutes: new FormControl<number | null>(null, {
      validators: [Validators.min(1), Validators.max(MAX_MINUTES)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly requested = signal<AccountLinkRequestResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la vinculación de cuentas.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.requestAccountLink(this.datos()).subscribe({
      next: (solicitud) => {
        this.state.set(ready(null));
        this.requested.set(solicitud);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraSolicitud(): void {
    this.form.reset();
    this.requested.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewAccountLinkRequest {
    const valores = this.form.getRawValue();

    return {
      providerId: valores.providerId.trim(),
      externalSubject: valores.externalSubject.trim(),
      ...(valores.expiresInMinutes === null ? {} : { expiresInMinutes: valores.expiresInMinutes }),
    };
  }
}
