import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué se configura',
      hint: 'El proveedor y el alcance de la regla.',
      campos: [
        { key: 'providerId', label: 'Identificador del proveedor', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'tenantId', label: 'Organización a la que aplica', hint: 'Opcional: vacía, la regla aplica a todas. Pegá el identificador (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Decisión',
      hint: 'Cuándo casa la regla y qué hace cuando casa.',
      campos: [
        { key: 'priority', label: 'Prioridad', hint: 'Única por proveedor; la primera regla que case decide.', control: 'number', required: true, mensajeDeError: 'Un número entero desde 1.' },
        { key: 'conditionJson', label: 'Condición sobre los claims (JSON)', hint: 'Opcional: un objeto JSON. Vacía, no viaja.', control: 'textarea', mensajeDeError: 'Tiene que ser un objeto JSON válido, como {&quot;campo&quot;: &quot;valor&quot;}.' },
        { key: 'effect', label: 'Efecto', control: 'radio', options: [{ value: 'ALLOW', label: 'Permitir el aprovisionamiento' }, { value: 'DENY', label: 'Denegar el aprovisionamiento' }], required: true },
      ],
    },
    {
      titulo: 'Asignaciones',
      hint: 'Solo con efecto Permitir: qué recibe el sujeto aprovisionado.',
      campos: [
        { key: 'assignRoleConceptId', label: 'Rol a asignar (concepto)', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'assignTenantId', label: 'Organización a asignar', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
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
    /** Obligatorio por contrato; arranca sin elegir para no decidir por nadie. */
    effect: new FormControl<ProvisioningEffect | null>(null, {
      validators: [Validators.required],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedProvisioningRule | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para configurar proveedores de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // El cuerpo recién se arma con el formulario válido: antes, la condición
    // podría ni parsear.
    if (this.form.invalid) {
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
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewProvisioningRule | null {
    const valores = this.form.getRawValue();
    const efecto = opcionDe(EFFECTS, valores.effect);
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
