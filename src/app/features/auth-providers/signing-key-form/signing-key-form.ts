import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type { PublishedSigningKey } from '../../../core/data-access/auth-providers/auth-providers.types';
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
  controlesDeClaveDeFirma,
  leerClaveDeFirma,
  SECCION_CLAVE_DE_FIRMA,
} from '../signing-key-fields/signing-key-fields';
import {
  errorMessageOf,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

/**
 * Publicar una clave de firma del proveedor (V40-08,
 * `POST /auth-providers/identity-providers/:id/signing-keys`).
 */
@Component({
  selector: 'app-signing-key-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    ...controlesDeClaveDeFirma(),
  });

  protected readonly paginas = paginarCampos([
    {
      titulo: 'De qué proveedor',
      hint: 'La clave cuelga del proveedor.',
      campos: [
        {
          key: 'providerId',
          label: 'Identificador del proveedor',
          hint: UUID_HINT,
          control: 'text' as const,
          required: true,
          mensajeDeError: UUID_ERROR,
        },
      ],
    },
    SECCION_CLAVE_DE_FIRMA,
  ]);

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

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const clave = leerClaveDeFirma(valores);
    const { providerId } = valores;

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
    this.form.reset();
    this.published.set(null);
    this.state.set(ready(null));
  }
}
