import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué delegación',
      hint: 'La delegación cuyo alcance efectivo se quiere conocer.',
      campos: [
        { key: 'practitionerDelegateAssignmentId', label: 'Identificador de la delegación', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Con qué propósito',
      hint: 'La misma delegación puede permitir tratamiento y denegar facturación.',
      campos: [
        { key: 'purpose', label: 'Propósito de uso', control: 'radio', options: [{ value: 'TREATMENT', label: 'Tratamiento' }, { value: 'BILLING', label: 'Facturación' }, { value: 'OPERATIONS', label: 'Operaciones' }], required: true },
      ],
    },
    {
      titulo: 'En qué contexto',
      hint: 'Opcional: cuanto más concreto el contexto, más fiel el veredicto.',
      campos: [
        { key: 'permissionId', label: 'Permiso concreto que se ejerce', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'patientProfileId', label: 'Paciente sobre el que se accede', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'encounterId', label: 'Encuentro sobre el que se accede', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'resourceType', label: 'Tipo de recurso', control: 'radio', options: [{ value: 'CLINICAL_NOTE', label: 'Nota clínica' }, { value: 'APPOINTMENT', label: 'Cita' }, { value: 'PRESCRIPTION', label: 'Receta' }] },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    practitionerDelegateAssignmentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    permissionId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    patientProfileId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    encounterId: new FormControl('', { nonNullable: true, validators: [UUID_OPCIONAL] }),
    /** Obligatorio por contrato: toda evaluación es por propósito. */
    purpose: new FormControl<PurposeOfUse | null>(null, {
      validators: [Validators.required],
    }),
    resourceType: new FormControl<GrantResourceType | null>(null),
  });

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

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    // El grupo ya lo exige; se vuelve a comprobar contra el contrato porque el
    // tipo del control admite `null` y lo que sale de acá es el cuerpo real.
    const proposito = opcionDe(PURPOSES, valores.purpose);
    if (proposito === null) {
      return;
    }
    const permiso = valores.permissionId.trim();
    const paciente = valores.patientProfileId.trim();
    const encuentro = valores.encounterId.trim();
    const recurso = opcionDe(RESOURCE_TYPES, valores.resourceType);

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
