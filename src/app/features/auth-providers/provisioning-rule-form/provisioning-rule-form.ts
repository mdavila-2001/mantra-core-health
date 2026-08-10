import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  CreatedProvisioningRule,
  NewProvisioningRule,
  ProvisioningEffect,
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
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  objetoJson,
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const EFFECTS: readonly ProvisioningEffect[] = ['ALLOW', 'DENY'];

/** Techo generoso para la condición declarativa; el DDL no fija uno. */
const MAX_CONDITION = 2000;

/**
 * Definir una regla de aprovisionamiento (V40-07,
 * `POST /auth-providers/identity-providers/:id/provisioning-rules`).
 *
 * La prioridad es única por proveedor y la primera regla que case decide.
 * «Rol y organización asignados solo con efecto Permitir» vive en el servicio
 * del backend, no en el DTO: acá es aviso y no bloqueo.
 */
@Component({
  selector: 'app-provisioning-rule-form',
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
    Textarea,
  ],
  templateUrl: './provisioning-rule-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProvisioningRuleForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxCondition = MAX_CONDITION;

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    tenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    priority: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    conditionJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_CONDITION), objetoJson],
    }),
    assignRoleConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    assignTenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  /** Obligatorio por contrato; arranca sin elegir para no decidir por nadie. */
  protected readonly effect = signal<ProvisioningEffect | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedProvisioningRule | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para configurar proveedores de identidad.'),
  );

  protected elegirEfecto(valor: unknown): void {
    this.effect.set(opcionDe(EFFECTS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // El cuerpo recién se arma con el formulario válido: antes, la condición
    // podría ni parsear.
    if (this.form.invalid || this.effect() === null) {
      this.form.markAllAsTouched();
      return;
    }

    const datos = this.datos();
    if (datos === null) {
      return;
    }

    const { providerId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.createProvisioningRule(providerId.trim(), datos).subscribe({
      next: (rule) => {
        this.state.set(ready(null));
        this.created.set(rule);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraRegla(): void {
    this.form.reset();
    this.effect.set(null);
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewProvisioningRule | null {
    const efecto = this.effect();
    const valores = this.form.getRawValue();
    if (efecto === null || valores.priority === null) {
      return null;
    }

    const alcance = valores.tenantId.trim();
    const condicion = valores.conditionJson.trim();
    const rol = valores.assignRoleConceptId.trim();
    const organizacion = valores.assignTenantId.trim();

    return {
      ...(alcance === '' ? {} : { tenantId: alcance }),
      priority: valores.priority,
      ...(condicion === ''
        ? {}
        : { conditionJson: JSON.parse(condicion) as Record<string, unknown> }),
      effect: efecto,
      ...(rol === '' ? {} : { assignRoleConceptId: rol }),
      ...(organizacion === '' ? {} : { assignTenantId: organizacion }),
    };
  }
}
