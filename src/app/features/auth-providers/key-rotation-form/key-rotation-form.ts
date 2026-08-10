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
import type { KeyRotationResult } from '../../../core/data-access/auth-providers/auth-providers.types';
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

/** Techo del contrato: 720 horas de gracia, un mes. */
const MAX_GRACE_HOURS = 720;

/**
 * Rotar la clave de firma del proveedor (V40-08·A,
 * `POST /auth-providers/identity-providers/:id/signing-keys/rotate`).
 *
 * Publica la clave nueva y pasa las salientes a retirándose durante la
 * gracia. **Cero es un valor con sentido** —retira las salientes al instante,
 * lo que se quiere ante una clave comprometida—, así que la pantalla lo
 * distingue de «sin cargar»: vacío no viaja y el backend aplica sus 24 horas.
 */
@Component({
  selector: 'app-key-rotation-form',
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
  templateUrl: './key-rotation-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyRotationForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxGraceHours = MAX_GRACE_HOURS;

  protected readonly campos = viewChild.required(SigningKeyFields);

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    graceHours: new FormControl<number | null>(null, {
      validators: [Validators.min(0), Validators.max(MAX_GRACE_HOURS)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly rotated = signal<KeyRotationResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para rotar claves de firma.'),
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

    const { providerId, graceHours } = this.form.getRawValue();

    this.state.set(loading());

    this.client
      .rotateSigningKey(providerId.trim(), {
        ...clave,
        // Cero viaja; solo el campo sin cargar se omite.
        ...(graceHours === null ? {} : { graceHours }),
      })
      .subscribe({
        next: (result) => {
          this.state.set(ready(null));
          this.rotated.set(result);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraRotacion(): void {
    // El panel de éxito desmontó los campos de la clave: renacen frescos al
    // volver al formulario, así que acá solo se limpia lo propio.
    this.form.reset();
    this.rotated.set(null);
    this.state.set(ready(null));
  }
}
