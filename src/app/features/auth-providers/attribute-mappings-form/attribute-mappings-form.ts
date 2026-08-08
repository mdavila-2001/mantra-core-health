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
import type { AttributeMappingsResult } from '../../../core/data-access/auth-providers/auth-providers.types';
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
import { AttributeMappingsEditor } from '../attribute-mappings-editor/attribute-mappings-editor';

/**
 * Fijar el mapeo de atributos del proveedor (V40-04,
 * `PUT /auth-providers/identity-providers/:id/attribute-mappings`).
 *
 * Es un reemplazo completo: lo que no esté en la lista se retira. La regla
 * «exactamente un claim identificador» vive en el servicio del backend, no en
 * el DTO, así que acá es aviso y no bloqueo: el backend tiene la última
 * palabra.
 */
@Component({
  selector: 'app-attribute-mappings-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    AttributeMappingsEditor,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
  ],
  templateUrl: './attribute-mappings-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttributeMappingsForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly editor = viewChild.required(AttributeMappingsEditor);

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly applied = signal<AttributeMappingsResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para configurar proveedores de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // Los mapeos se leen primero para que un solo intento marque los errores
    // de los dos bloques a la vez, no de a uno.
    const mapeos = this.editor().intentarEnvio();
    if (this.form.invalid || mapeos === null) {
      this.form.markAllAsTouched();
      return;
    }

    const { providerId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.setAttributeMappings(providerId.trim(), { mappings: mapeos }).subscribe({
      next: (result) => {
        this.state.set(ready(null));
        this.applied.set(result);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroMapeo(): void {
    // El panel de éxito desmontó el editor de mapeos: renace fresco al volver
    // al formulario, así que acá solo se limpia lo propio.
    this.form.reset();
    this.applied.set(null);
    this.state.set(ready(null));
  }
}
