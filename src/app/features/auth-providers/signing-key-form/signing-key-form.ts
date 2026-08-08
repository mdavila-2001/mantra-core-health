import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type { PublishedSigningKey } from '../../../core/data-access/auth-providers/auth-providers.types';
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
import { SigningKeyFields } from '../signing-key-fields/signing-key-fields';

/**
 * Publicar una clave de firma del proveedor (V40-08,
 * `POST /auth-providers/identity-providers/:id/signing-keys`).
 */
@Component({
  selector: 'app-signing-key-form',
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
    SigningKeyFields,
  ],
  templateUrl: './signing-key-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SigningKeyForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly campos = viewChild.required(SigningKeyFields);

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly published = signal<PublishedSigningKey | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para publicar claves de firma.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // La clave se lee primero para que un solo intento marque los errores de
    // los dos bloques a la vez, no de a uno.
    const clave = this.campos().intentarLeer();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (clave === null) {
      return;
    }

    const { providerId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.publishSigningKey(providerId.trim(), clave).subscribe({
      next: (key) => {
        this.state.set(ready(null));
        this.published.set(key);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraClave(): void {
    // El panel de éxito desmontó los campos de la clave: renacen frescos al
    // volver al formulario, así que acá solo se limpia lo propio.
    this.form.reset();
    this.published.set(null);
    this.state.set(ready(null));
  }
}
