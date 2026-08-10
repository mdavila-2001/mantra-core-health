import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  NewCaseEvidence,
  SubmittedEvidence,
} from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/** Techo del hash del identificador; el DTO declara `MaxLength(200)`. */
const MAX_HASH = 200;

/**
 * Aportar evidencia a un caso de verificación (V27-05,
 * `POST /identity/verification-cases/:id/evidence`).
 *
 * El documento no viaja nunca: se referencia por hash, por archivo ya subido o
 * por una referencia cifrada al almacenamiento de objetos — minimización de
 * datos. El caso al que pertenece va en la URL, no en el cuerpo.
 */
@Component({
  selector: 'app-case-evidence-form',
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
  ],
  templateUrl: './case-evidence-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseEvidenceForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxHash = MAX_HASH;

  protected readonly form = new FormGroup({
    caseId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    evidenceTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    issuerAuthorityId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    evidenceQualityConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    collectedUnderConsentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    evidenceIdentifierHash: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_HASH)],
    }),
    evidenceFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    encryptedEvidenceReference: new FormControl('', { nonNullable: true }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly submitted = signal<SubmittedEvidence | null>(null);

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

    const { caseId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.submitEvidence(caseId.trim(), this.datos()).subscribe({
      next: (evidence) => {
        this.state.set(ready(null));
        this.submitted.set(evidence);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraEvidencia(): void {
    this.form.reset();
    this.submitted.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewCaseEvidence {
    const valores = this.form.getRawValue();
    const emisora = valores.issuerAuthorityId.trim();
    const calidad = valores.evidenceQualityConceptId.trim();
    const consentimiento = valores.collectedUnderConsentId.trim();
    const hash = valores.evidenceIdentifierHash.trim();
    const archivo = valores.evidenceFileId.trim();
    const referencia = valores.encryptedEvidenceReference.trim();

    return {
      evidenceTypeConceptId: valores.evidenceTypeConceptId.trim(),
      ...(emisora === '' ? {} : { issuerAuthorityId: emisora }),
      ...(hash === '' ? {} : { evidenceIdentifierHash: hash }),
      ...(archivo === '' ? {} : { evidenceFileId: archivo }),
      ...(referencia === '' ? {} : { encryptedEvidenceReference: referencia }),
      ...(calidad === '' ? {} : { evidenceQualityConceptId: calidad }),
      ...(consentimiento === '' ? {} : { collectedUnderConsentId: consentimiento }),
    };
  }
}
