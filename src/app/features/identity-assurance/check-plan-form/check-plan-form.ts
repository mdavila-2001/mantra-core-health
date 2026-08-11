import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  CheckPlan,
  PlannedCheck,
  PlannedChecksResult,
} from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

type FilaDeCheck = FormGroup<{
  checkTypeConceptId: FormControl<string>;
  authorityId: FormControl<string>;
  required: FormControl<boolean>;
}>;

function nuevaFila(): FilaDeCheck {
  return new FormGroup({
    checkTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    authorityId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    // Nace prendido: es el default del contrato, y apagarlo es una decisión.
    required: new FormControl(true, { nonNullable: true }),
  });
}

/**
 * Planificar los checks de un caso (V27-04,
 * `POST /identity/verification-cases/:id/checks:plan`).
 *
 * El plan dice qué se consulta y contra qué autoridad; el contrato exige **al
 * menos un check** (`ArrayMinSize(1)`), así que el repetidor nace con una fila
 * y la última no se puede quitar — mismo trato que los ítems del M29. El
 * segmento `checks:plan` lleva los dos puntos de verdad.
 */
@Component({
  selector: 'app-check-plan-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    Card,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Switch,
  ],
  templateUrl: './check-plan-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckPlanForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    caseId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly filas = new FormArray<FilaDeCheck>([nuevaFila()]);

  /**
   * El `FormArray` muta por dentro sin que ninguna señal lo note; este
   * contador es el latido que le avisa a la vista `OnPush` que la lista de
   * filas cambió de tamaño.
   */
  protected readonly version = signal(0);

  /** Las filas que pinta la vista; leer `version` la engancha al latido. */
  protected readonly filasVisibles = computed(() => {
    this.version();
    return this.filas.controls;
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly planned = signal<PlannedChecksResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected agregarFila(): void {
    this.filas.push(nuevaFila());
    this.version.update((v) => v + 1);
  }

  protected quitarFila(indice: number): void {
    if (this.filas.length <= 1) {
      return;
    }
    this.filas.removeAt(indice);
    this.version.update((v) => v + 1);
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid || this.filas.invalid) {
      this.form.markAllAsTouched();
      this.filas.markAllAsTouched();
      this.version.update((v) => v + 1);
      return;
    }

    const { caseId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.planChecks(caseId.trim(), this.datos()).subscribe({
      next: (planned) => {
        this.state.set(ready(null));
        this.planned.set(planned);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroPlan(): void {
    this.form.reset();
    while (this.filas.length > 1) {
      this.filas.removeAt(this.filas.length - 1);
    }
    this.filas.reset();
    this.version.update((v) => v + 1);
    this.planned.set(null);
    this.state.set(ready(null));
  }

  private datos(): CheckPlan {
    const checks: readonly PlannedCheck[] = this.filas.controls.map((fila) => {
      const valores = fila.getRawValue();
      const autoridad = valores.authorityId.trim();
      return {
        checkTypeConceptId: valores.checkTypeConceptId.trim(),
        ...(autoridad === '' ? {} : { authorityId: autoridad }),
        // El switch viaja siempre, prendido o apagado: es decisión explícita.
        required: valores.required,
      };
    });

    return { checks };
  }
}
