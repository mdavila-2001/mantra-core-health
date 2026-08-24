import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  CreatedVerificationPolicy,
  NewVerificationPolicy,
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
import {
  errorMessageOf,
  objetoJson,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

/** Techo generoso para los objetos declarativos; el DDL no fija uno. */
const MAX_JSON = 2000;

/**
 * Crear una política de verificación (V27-18,
 * `POST /identity/verification-policies`).
 *
 * La política es la precondición de todo lo demás: un caso se abre **contra**
 * una política, que declara qué nivel de identidad exige el trámite según su
 * riesgo. IAL es obligatorio; AAL y FAL solo si el trámite los pide.
 */
@Component({
  selector: 'app-verification-policy-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './verification-policy-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationPolicyForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxJson = MAX_JSON;

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué política',
      hint: 'Cómo se identifica y qué versión es.',
      campos: [
        { key: 'policyCode', label: 'Código de la política', hint: 'Único; hasta 100 caracteres. Por ejemplo, IAL2-PACIENTE.', control: 'text', required: true, mensajeDeError: 'Ingresá el código (hasta 100 caracteres).' },
        { key: 'versionNumber', label: 'Número de versión', hint: 'Opcional: si no se indica, arranca en 1.', control: 'number', mensajeDeError: 'La versión empieza en 1.' },
      ],
    },
    {
      titulo: 'A quién y ante qué riesgo',
      hint: 'Qué tipo de sujeto se verifica y qué riesgo tiene la transacción que lo exige.',
      campos: [
        { key: 'subjectTypeConceptId', label: 'Tipo de sujeto (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'transactionRiskConceptId', label: 'Riesgo de la transacción (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Niveles exigidos',
      hint: 'El de identidad es obligatorio; autenticador y federación, solo si el trámite los pide.',
      campos: [
        { key: 'requiredIdentityAssuranceLevelConceptId', label: 'Nivel de identidad exigido — IAL (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'requiredAuthenticatorAssuranceLevelConceptId', label: 'Nivel de autenticador — AAL (concepto)', hint: 'Opcional.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'requiredFederationAssuranceLevelConceptId', label: 'Nivel de federación — FAL (concepto)', hint: 'Opcional.', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Evidencia y controles',
      hint: 'Objetos declarativos del modelo; vacíos, no viajan.',
      campos: [
        { key: 'evidenceRequirementsJson', label: 'Requisitos de evidencia (JSON)', hint: 'Opcional: un objeto JSON. Vacío, no viaja.', control: 'textarea', mensajeDeError: 'Tiene que ser un objeto JSON válido, como {&quot;campo&quot;: &quot;valor&quot;}.' },
        { key: 'fraudControlsJson', label: 'Controles de fraude (JSON)', hint: 'Opcional: un objeto JSON. Vacío, no viaja.', control: 'textarea', mensajeDeError: 'Tiene que ser un objeto JSON válido, como {&quot;campo&quot;: &quot;valor&quot;}.' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    policyCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    versionNumber: new FormControl<number | null>(null, {
      validators: [Validators.min(1)],
    }),
    subjectTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    transactionRiskConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    requiredIdentityAssuranceLevelConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    requiredAuthenticatorAssuranceLevelConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    requiredFederationAssuranceLevelConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    evidenceRequirementsJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_JSON), objetoJson],
    }),
    fraudControlsJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_JSON), objetoJson],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedVerificationPolicy | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // El cuerpo recién se arma con el formulario válido: antes, los objetos
    // JSON podrían ni parsear.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.createVerificationPolicy(this.datos()).subscribe({
      next: (policy) => {
        this.state.set(ready(null));
        this.created.set(policy);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraPolitica(): void {
    this.form.reset();
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewVerificationPolicy {
    const valores = this.form.getRawValue();
    const aal = valores.requiredAuthenticatorAssuranceLevelConceptId.trim();
    const fal = valores.requiredFederationAssuranceLevelConceptId.trim();
    const evidencia = valores.evidenceRequirementsJson.trim();
    const controles = valores.fraudControlsJson.trim();

    return {
      policyCode: valores.policyCode.trim(),
      subjectTypeConceptId: valores.subjectTypeConceptId.trim(),
      transactionRiskConceptId: valores.transactionRiskConceptId.trim(),
      requiredIdentityAssuranceLevelConceptId:
        valores.requiredIdentityAssuranceLevelConceptId.trim(),
      ...(aal === '' ? {} : { requiredAuthenticatorAssuranceLevelConceptId: aal }),
      ...(fal === '' ? {} : { requiredFederationAssuranceLevelConceptId: fal }),
      ...(evidencia === ''
        ? {}
        : { evidenceRequirementsJson: JSON.parse(evidencia) as Record<string, unknown> }),
      ...(controles === ''
        ? {}
        : { fraudControlsJson: JSON.parse(controles) as Record<string, unknown> }),
      ...(valores.versionNumber === null ? {} : { versionNumber: valores.versionNumber }),
    };
  }
}
