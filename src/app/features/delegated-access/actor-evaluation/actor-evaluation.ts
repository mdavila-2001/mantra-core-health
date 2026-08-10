import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  ActorEvaluationResult,
  GrantResourceType,
  PurposeOfUse,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const PURPOSES: readonly PurposeOfUse[] = ['TREATMENT', 'BILLING', 'OPERATIONS'];
const RESOURCE_TYPES: readonly GrantResourceType[] = [
  'CLINICAL_NOTE',
  'APPOINTMENT',
  'PRESCRIPTION',
];

const UUID_OPCIONAL = Validators.pattern(UUID_PATTERN);

/**
 * Evaluar el actor efectivo por propósito (V29-06,
 * `POST /authz/effective-actor/evaluate`).
 *
 * Es la única operación del módulo que no muta nada: pregunta qué puede hacer
 * un delegado en un contexto concreto y devuelve el veredicto — permitido,
 * permitido con paso extra de autenticación (step-up), o denegado.
 */
@Component({
  selector: 'app-actor-evaluation',
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
  ],
  templateUrl: './actor-evaluation.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActorEvaluation {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    practitionerDelegateAssignmentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    permissionId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    patientProfileId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    encounterId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
  });

  /** Obligatorio por contrato: toda evaluación es por propósito. */
  protected readonly purpose = signal<PurposeOfUse | null>(null);

  protected readonly resourceType = signal<GrantResourceType | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly veredicto = signal<ActorEvaluationResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para evaluar actores efectivos.'),
  );

  /** El tono del veredicto; las palabras del template cargan el significado. */
  protected readonly tonoDelVeredicto = computed<'success' | 'warning' | 'error'>(() => {
    const resultado = this.veredicto();
    if (resultado === null || !resultado.allowed) {
      return 'error';
    }
    return resultado.requiresStepUp ? 'warning' : 'success';
  });

  protected elegirProposito(valor: unknown): void {
    this.purpose.set(opcionDe(PURPOSES, valor));
  }

  protected elegirRecurso(valor: unknown): void {
    this.resourceType.set(opcionDe(RESOURCE_TYPES, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const proposito = this.purpose();
    if (this.form.invalid || proposito === null) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const permiso = valores.permissionId.trim();
    const paciente = valores.patientProfileId.trim();
    const encuentro = valores.encounterId.trim();
    const recurso = this.resourceType();

    this.state.set(loading());

    this.client
      .evaluateEffectiveActor({
        practitionerDelegateAssignmentId: valores.practitionerDelegateAssignmentId.trim(),
        purpose: proposito,
        ...(permiso === '' ? {} : { permissionId: permiso }),
        ...(paciente === '' ? {} : { patientProfileId: paciente }),
        ...(encuentro === '' ? {} : { encounterId: encuentro }),
        ...(recurso === null ? {} : { resourceType: recurso }),
      })
      .subscribe({
        next: (resultado) => {
          this.state.set(ready(null));
          this.veredicto.set(resultado);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraEvaluacion(): void {
    // La consulta no muta nada: se conserva lo cargado para variar solo el
    // contexto (otro propósito, otro paciente) sin repetir todo el tipeo.
    this.veredicto.set(null);
    this.state.set(ready(null));
  }
}
