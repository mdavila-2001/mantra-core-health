import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  NewVerificationCase,
  OpenedCase,
} from '../../../core/data-access/identity/identity-admin.types';
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
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/**
 * Abrir un caso de verificación (V27-02, `POST /identity/verification-cases`).
 *
 * El caso es el expediente del ciclo: nace contra una política vigente, junta
 * evidencia y checks, y vence solo si nadie lo resuelve antes. El correlation
 * id es un UUID de idempotencia — repetir la apertura con el mismo devuelve el
 * caso ya abierto en vez de duplicarlo.
 */
@Component({
  selector: 'app-case-open-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './case-open-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseOpenForm {
  private readonly client = inject(IdentityAdminClient);
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
      titulo: 'Qué se verifica',
      hint: 'La política que rige el caso y el sujeto al que se le verifica la identidad.',
      campos: [
        { key: 'identityVerificationPolicyId', label: 'Política de verificación', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'subjectTypeConceptId', label: 'Tipo de sujeto (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'subjectEntityId', label: 'Entidad sujeto', hint: 'El id del paciente, profesional o representante que se verifica.', control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Condiciones',
      hint: 'Nivel solicitado, idempotencia de la apertura y vencimiento.',
      campos: [
        { key: 'requestedAssuranceLevelConceptId', label: 'Nivel de aseguramiento solicitado (concepto)', hint: 'Opcional: por defecto rige el que exige la política.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'correlationId', label: 'Correlación (idempotencia)', hint: 'Opcional: un UUID propio; repetir la apertura con el mismo no duplica el caso.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'expiresInHours', label: 'Vence en (horas)', hint: 'Opcional: por defecto, 72 horas.', control: 'number', mensajeDeError: 'La vigencia empieza en 1 hora.' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    identityVerificationPolicyId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    subjectTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    subjectEntityId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    requestedAssuranceLevelConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    correlationId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    expiresInHours: new FormControl<number | null>(null, {
      validators: [Validators.min(1)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly opened = signal<OpenedCase | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
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

    this.client.openCase(this.datos()).subscribe({
      next: (opened) => {
        this.state.set(ready(null));
        this.opened.set(opened);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroCaso(): void {
    this.form.reset();
    this.opened.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewVerificationCase {
    const valores = this.form.getRawValue();
    const solicitado = valores.requestedAssuranceLevelConceptId.trim();
    const correlacion = valores.correlationId.trim();

    return {
      identityVerificationPolicyId: valores.identityVerificationPolicyId.trim(),
      subjectTypeConceptId: valores.subjectTypeConceptId.trim(),
      subjectEntityId: valores.subjectEntityId.trim(),
      ...(solicitado === '' ? {} : { requestedAssuranceLevelConceptId: solicitado }),
      ...(correlacion === '' ? {} : { correlationId: correlacion }),
      ...(valores.expiresInHours === null ? {} : { expiresInHours: valores.expiresInHours }),
    };
  }
}
