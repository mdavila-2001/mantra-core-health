import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
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
