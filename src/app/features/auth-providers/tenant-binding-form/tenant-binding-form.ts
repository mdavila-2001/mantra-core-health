import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  NewTenantBinding,
  TenantBindingResult,
} from '../../../core/data-access/auth-providers/auth-providers.types';
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
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

/**
 * Vincular un proveedor con una organización (V40-09,
 * `POST /auth-providers/tenant-bindings`).
 *
 * Si el vínculo ya existía, el backend lo actualiza en vez de duplicarlo
 * (`updated`). «Aprovisionar exige el rol por defecto» vive en el servicio,
 * no en el DTO: acá es aviso y no bloqueo.
 */
@Component({
  selector: 'app-tenant-binding-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './tenant-binding-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantBindingForm {
  private readonly client = inject(AuthProvidersClient);
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
      titulo: 'Qué se vincula',
      hint: 'El proveedor y la organización que va a poder usarlo.',
      campos: [
        { key: 'providerId', label: 'Identificador del proveedor', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'tenantId', label: 'Identificador de la organización', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Aprovisionamiento',
      hint: 'Qué pasa cuando llega alguien de esa organización sin usuario local.',
      campos: [
        { key: 'defaultRoleConceptId', label: 'Rol con el que se aprovisiona (concepto)', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'allowedEmailDomains', label: 'Dominios de correo admitidos', hint: 'Separados por coma. Vacío, no viaja.', control: 'text', mensajeDeError: 'Hasta 500 caracteres.' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    tenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    // Prendido de entrada: es el default del backend. Los tres interruptores
    // viajan siempre, como decisión explícita.
    isEnabled: new FormControl(true, { nonNullable: true }),
    autoProvision: new FormControl(false, { nonNullable: true }),
    justInTimeProvisioning: new FormControl(false, { nonNullable: true }),
    defaultRoleConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    allowedEmailDomains: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly bound = signal<TenantBindingResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para configurar proveedores de identidad.'),
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

    this.client.bindTenant(this.datos()).subscribe({
      next: (binding) => {
        this.state.set(ready(null));
        this.bound.set(binding);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroVinculo(): void {
    // `reset` vuelve a los valores iniciales de cada control, así que el
    // vínculo nuevo arranca otra vez habilitado y sin aprovisionar.
    this.form.reset();
    this.bound.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewTenantBinding {
    const valores = this.form.getRawValue();
    const rol = valores.defaultRoleConceptId.trim();
    const dominios = valores.allowedEmailDomains.trim();

    return {
      providerId: valores.providerId.trim(),
      tenantId: valores.tenantId.trim(),
      isEnabled: valores.isEnabled,
      autoProvision: valores.autoProvision,
      justInTimeProvisioning: valores.justInTimeProvisioning,
      ...(rol === '' ? {} : { defaultRoleConceptId: rol }),
      ...(dominios === '' ? {} : { allowedEmailDomains: dominios }),
    };
  }
}
