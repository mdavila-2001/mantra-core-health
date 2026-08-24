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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    CampoPersonalizado,
    PageHeader,
    PaginatedForm,
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

  /**
   * El editor vive dentro de la página que lo proyecta, así que **no existe**
   * mientras se contesta la primera. La consulta no puede ser `required`: lo
   * único que lo lee es el envío, y el envío sólo ocurre en la última página.
   */
  protected readonly editor = viewChild(AttributeMappingsEditor);

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  /**
   * Las páginas, con el editor de mapeos como campo `custom`.
   *
   * Los mapeos son una **lista que crece**, no una pregunta: el motor le
   * reserva su sitio en la página y el editor sigue siendo quien la maneja. Lo
   * que sí gana la pantalla es que el proveedor y los mapeos dejan de llegar
   * juntos, y que el editor no se ve hasta haber dicho de qué proveedor es.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué se configura',
      hint: 'El proveedor cuyo mapeo se fija.',
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
    {
      titulo: 'Mapeos',
      hint: 'Al menos uno; los interruptores viajan siempre, como decisión explícita.',
      campos: [
        {
          key: 'mapeos',
          label: 'Mapeos de atributos',
          control: 'custom' as const,
          required: true,
        },
      ],
    },
  ]);

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
    const mapeos = this.editor()?.intentarEnvio() ?? null;
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
