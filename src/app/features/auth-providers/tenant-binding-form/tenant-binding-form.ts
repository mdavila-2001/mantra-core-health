import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
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
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Switch,
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
